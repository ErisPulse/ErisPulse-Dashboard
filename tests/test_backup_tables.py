"""备份的全表导出 / 导入。

覆盖三块：各方言列类型与默认值的反推、备份文件里列定义文法的校验（文件是用户
上传的，表名 / 列名 / 列定义会进建表语句）、单元格的 JSON 编码与按列类型还原；
外加用假存储跑通导出 / 导入编排（键集分页、冲突预检、分批短事务、行数核对）。
真库的端到端在 SDK 的 venv 里另跑，不在这份单测里。
"""

import asyncio
import base64
import copy
import importlib.util
import json
import re
import sys
import types
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _load_isolated():
    """按文件路径装载 ApiStorageMixin，不触发 SDK 导入（fastapi 为真实依赖）"""
    pkg = types.ModuleType("ErisPulse_Dashboard")
    pkg.__path__ = [str(ROOT / "ErisPulse_Dashboard")]
    core = types.ModuleType("ErisPulse_Dashboard.Core")
    core.__path__ = [str(ROOT / "ErisPulse_Dashboard" / "Core")]
    sys.modules.setdefault("ErisPulse_Dashboard", pkg)
    sys.modules.setdefault("ErisPulse_Dashboard.Core", core)
    spec = importlib.util.spec_from_file_location(
        "ErisPulse_Dashboard.Core.ApiStorage",
        ROOT / "ErisPulse_Dashboard" / "Core" / "ApiStorage.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["ErisPulse_Dashboard.Core.ApiStorage"] = module
    spec.loader.exec_module(module)
    return module


_m = _load_isolated()
ApiStorageMixin = _m.ApiStorageMixin


class TestTypeReverseMapping:
    """MySQL / PostgreSQL 系统表里的类型 → SQLite 风格（SDK 的方言翻译是单向的）"""

    @pytest.mark.parametrize(
        "column_type, expected",
        [
            ("int", "INTEGER"),
            ("bigint", "BIGINT"),
            ("smallint", "SMALLINT"),
            ("tinyint(1)", "BOOLEAN"),
            ("tinyint(4)", "TINYINT"),
            ("varchar(255)", "VARCHAR(255)"),
            ("char(8)", "CHAR(8)"),
            ("text", "TEXT"),
            ("longtext", "TEXT"),
            ("datetime", "DATETIME"),
            ("timestamp", "TIMESTAMP"),
            ("double", "DOUBLE"),
            ("decimal(10,2)", "DECIMAL(10,2)"),
            ("blob", "BLOB"),
            ("longblob", "BLOB"),
            ("json", "TEXT"),
            ("enum('a','b')", "TEXT"),
        ],
    )
    def test_mysql(self, column_type, expected):
        assert _m._backup_type_from_mysql(column_type) == expected

    @pytest.mark.parametrize(
        "row, expected",
        [
            (("integer", None, None, None), "INTEGER"),
            (("bigint", None, None, None), "BIGINT"),
            (("character varying", 64, None, None), "VARCHAR(64)"),
            (("character varying", None, None, None), "TEXT"),
            (("numeric", None, 10, 2), "DECIMAL(10,2)"),
            (("numeric", None, None, None), "NUMERIC"),
            (("timestamp without time zone", None, None, None), "TIMESTAMP"),
            (("double precision", None, None, None), "DOUBLE"),
            (("bytea", None, None, None), "BLOB"),
            (("jsonb", None, None, None), "TEXT"),
            (("uuid", None, None, None), "TEXT"),
            (("boolean", None, None, None), "BOOLEAN"),
        ],
    )
    def test_postgres(self, row, expected):
        assert _m._backup_type_from_postgres(*row) == expected


class TestDefaultNormalization:
    """库里的默认值原文 → 可安全进建表语句的字面量，表达不了的丢弃"""

    def test_absent_and_sequence_dropped(self):
        assert _m._backup_norm_default(None, "INTEGER") is None
        assert (
            _m._backup_norm_default("nextval('users_id_seq'::regclass)", "INTEGER")
            is None
        )
        assert _m._backup_norm_default("NULL::text", "TEXT") is None

    def test_current_timestamp_variants(self):
        for raw in ("CURRENT_TIMESTAMP", "current_timestamp()", "now()"):
            assert _m._backup_norm_default(raw, "DATETIME") == "CURRENT_TIMESTAMP"

    def test_numbers_and_boolean(self):
        assert _m._backup_norm_default(0, "INTEGER") == "0"
        assert _m._backup_norm_default("-1.5", "REAL") == "-1.5"
        assert _m._backup_norm_default("0", "BOOLEAN") == "FALSE"
        assert _m._backup_norm_default("0.0", "BOOLEAN") == "FALSE"
        assert _m._backup_norm_default("1", "BOOLEAN") == "TRUE"
        assert _m._backup_norm_default("false", "BOOLEAN") == "FALSE"

    def test_string_literals(self):
        # MySQL 的字符串默认值不带引号；空串与 SQL NULL 是两回事
        assert _m._backup_norm_default("", "TEXT") == "''"
        assert _m._backup_norm_default("{}", "TEXT") == "'{}'"
        assert _m._backup_norm_default("'{}'::jsonb", "TEXT") == "'{}'"

    def test_unsafe_or_expression_dropped(self):
        assert _m._backup_norm_default("a;b", "TEXT") is None
        assert _m._backup_norm_default("line\nbreak", "TEXT") is None
        assert _m._backup_norm_default("'it''s'::text", "TEXT") is None
        assert _m._backup_norm_default("(uuid())", "TEXT", generated=True) is None


class TestColumnDefGrammar:
    """导入只按文法解析列定义，文件里的原始字符串不进 SQL"""

    @pytest.mark.parametrize(
        "column_def",
        [
            "TEXT",
            "TEXT NOT NULL",
            "TEXT DEFAULT ''",
            "VARCHAR(64) NOT NULL DEFAULT 'x'",
            "INTEGER PRIMARY KEY AUTOINCREMENT",
            "BIGINT PRIMARY KEY AUTOINCREMENT",
            "TEXT PRIMARY KEY",
            "INTEGER PRIMARY KEY NOT NULL",
            "REAL DEFAULT 0",
            "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "BOOLEAN DEFAULT FALSE",
            "TEXT UNIQUE NOT NULL",
        ],
    )
    def test_accepted(self, column_def):
        assert _m._BACKUP_COLUMN_DEF_RE.match(column_def)

    @pytest.mark.parametrize(
        "column_def",
        [
            "TEXT); DROP TABLE users; --",
            "TEXT DEFAULT 'a;b'",
            "TEXT DEFAULT 'it''s'",
            "TEXT DEFAULT x' OR 1=1",
            "TEXT CHECK (a > 0)",
            "TEXT REFERENCES t(c)",
            "TEXT DEFAULT 'line\nbreak'",
            "TEXT, admin TEXT",
            "TEXT (10); --",
            "",
        ],
    )
    def test_rejected(self, column_def):
        assert not _m._BACKUP_COLUMN_DEF_RE.match(column_def)


def _plan(entry):
    return ApiStorageMixin._backup_plan_table(entry)


class TestPlanTable:
    def test_rebuilds_defs_from_grammar(self):
        plan = _plan(
            {
                "name": "users",
                "columns": {
                    "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
                    "name": "text not null default ''",
                },
                "primary_key": [],
                "rows": [[1, "a"]],
            }
        )
        assert plan["defs"] == {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "name": "text NOT NULL DEFAULT ''",
        }
        assert plan["types"] == {"id": "INTEGER", "name": "text"}
        assert plan["autoinc"] == "id"
        assert plan["constraints"] == []

    def test_composite_pk_moves_to_table_constraint(self):
        plan = _plan(
            {
                "name": "t",
                "columns": {"a": "INTEGER", "b": "TEXT", "v": "TEXT"},
                "primary_key": ["a", "b"],
                "rows": [],
            }
        )
        assert plan["constraints"] == ["PRIMARY KEY (a, b)"]
        assert plan["autoinc"] is None

    def test_inline_pk_dropped_when_composite(self):
        plan = _plan(
            {
                "name": "t",
                "columns": {"a": "INTEGER PRIMARY KEY AUTOINCREMENT", "b": "TEXT"},
                "primary_key": ["a", "b"],
                "rows": [],
            }
        )
        assert plan["defs"]["a"] == "INTEGER"

    @pytest.mark.parametrize(
        "entry",
        [
            {"name": "users; drop", "columns": {"a": "TEXT"}, "rows": []},
            {"name": "t", "columns": {"a text": "TEXT"}, "rows": []},
            {"name": "t", "columns": {"a": "TEXT); DROP TABLE x; --"}, "rows": []},
            {"name": "t", "columns": {"a": "TEXT"}, "primary_key": ["a) ; --"], "rows": []},
            {"name": "t", "columns": {}, "rows": []},
            {"name": "t", "columns": {"a": "TEXT"}, "rows": [[1, 2]]},
            {"name": "t", "columns": {"a": "TEXT"}, "rows": "nope"},
            "nope",
        ],
    )
    def test_rejects_unsafe_or_malformed(self, entry):
        with pytest.raises(ValueError):
            _plan(entry)


class TestCellCodec:
    def test_json_native_passthrough(self):
        for value in (None, True, False, 0, 5, -3, 1.5, "", "文本"):
            assert _m._backup_encode_cell(value) == value

    def test_output_is_always_strict_json(self):
        cells = [
            _m._backup_encode_cell(value)
            for value in (b"\x00", Decimal("1.5"), float("nan"), float("inf"), {"a": 1})
        ]
        json.dumps(cells, allow_nan=False)

    def test_bytes_marker_roundtrip(self):
        encoded = _m._backup_encode_cell(b"\x00\xffab")
        assert encoded == {_m._BACKUP_BYTES_KEY: base64.b64encode(b"\x00\xffab").decode()}
        assert _m._backup_coerce_cell(encoded, "BLOB", True) == b"\x00\xffab"
        # 文本值落进 BLOB 列：按 UTF-8 存，不当作 base64 解
        assert _m._backup_coerce_cell("aGk=", "BLOB", False) == "aGk=".encode()

    def test_decimal(self):
        assert _m._backup_encode_cell(Decimal("12.50")) == "12.50"
        assert _m._backup_coerce_cell("12.50", "DECIMAL(10,2)", True) == Decimal("12.50")

    def test_datetime_normalized_to_utc_naive(self):
        aware = datetime(2026, 11, 25, 10, 0, tzinfo=timezone(timedelta(hours=8)))
        assert _m._backup_encode_cell(aware) == "2026-11-25 02:00:00"
        assert (
            _m._backup_encode_cell(datetime(2026, 1, 2, 3, 4, 5))
            == "2026-01-02 03:04:05"
        )
        assert _m._backup_encode_cell(date(2026, 1, 2)) == "2026-01-02"

    @pytest.mark.parametrize(
        "value, expected", [(True, 1), (3.0, 3), ("7", 7), ("-2", -2)]
    )
    def test_int_family(self, value, expected):
        coerced = _m._backup_coerce_cell(value, "BIGINT", True)
        assert coerced == expected and type(coerced) is int

    def test_int_family_rejects_fraction(self):
        with pytest.raises(ValueError):
            _m._backup_coerce_cell(1.5, "INTEGER", True)

    def test_real_family(self):
        assert _m._backup_coerce_cell("1.5", "REAL", True) == 1.5
        assert _m._backup_coerce_cell("1.5", "REAL", False) == "1.5"

    def test_boolean(self):
        assert _m._backup_coerce_cell(1, "BOOLEAN", True) is True
        assert _m._backup_coerce_cell("0", "BOOLEAN", True) is False
        with pytest.raises(ValueError):
            _m._backup_coerce_cell("maybe", "BOOLEAN", True)

    def test_time_strict(self):
        assert (
            _m._backup_coerce_cell("2026-11-25T10:00:00", "TIMESTAMP", True)
            == datetime(2026, 11, 25, 10, 0)
        )
        assert (
            _m._backup_coerce_cell("2026-11-25 10:00:00", "DATETIME", True)
            == datetime(2026, 11, 25, 10, 0)
        )
        epoch = datetime(2026, 11, 25, 10, 0, tzinfo=timezone.utc)
        assert _m._backup_coerce_cell("2026-11-25 10:00:00Z", "DATETIME", True) == epoch.replace(
            tzinfo=None
        )
        assert _m._backup_coerce_cell(epoch.timestamp(), "DATETIME", True) == epoch.replace(
            tzinfo=None
        )
        assert _m._backup_coerce_cell("2026-11-25", "DATE", True) == date(2026, 11, 25)
        with pytest.raises(ValueError):
            _m._backup_coerce_cell("not a time", "TIMESTAMP", True)

    def test_time_lenient_keeps_value(self):
        assert _m._backup_coerce_cell("2026-11-25", "DATE", False) == "2026-11-25"
        assert _m._backup_coerce_cell(1790000000, "DATETIME", False) == 1790000000

    def test_text_family(self):
        # 声明为文本的列一律按文本写入（SQLite 的 TEXT 亲和本来也会这样存）
        assert _m._backup_coerce_cell(5, "TEXT", True) == "5"
        assert _m._backup_coerce_cell(5, "VARCHAR(10)", False) == "5"


# ════════════════ 假存储：跑通导出 / 导入编排 ════════════════


def _pragma_rows(table):
    """按 SQLite 的 PRAGMA table_info 形状描述一张假表"""
    columns = table["columns"]
    pk = [c for c, d in columns.items() if re.search(r"\bPRIMARY\s+KEY\b", d, re.I)]
    rows = []
    for cid, (col, coldef) in enumerate(columns.items()):
        base = re.match(r"\w+", coldef).group(0)
        default = re.search(r"\bDEFAULT\s+(\S.*)$", coldef, re.I)
        rows.append(
            (
                cid,
                col,
                base,
                int(bool(re.search(r"\bNOT\s+NULL\b", coldef, re.I))),
                default.group(1) if default else None,
                pk.index(col) + 1 if col in pk else 0,
            )
        )
    return rows


class _FakeBuilder:
    def __init__(self, store, table):
        self._store = store
        self._table = table
        self._cols = None
        self._where = None
        self._order = None
        self._limit = None
        self._offset = 0
        self._op = None
        self._data = None

    def Select(self, *cols):
        self._cols = list(cols)
        return self

    def Where(self, cond, value):
        self._where = (cond, value)
        return self

    def OrderBy(self, col):
        self._order = col
        return self

    def Limit(self, count):
        self._limit = count
        return self

    def Offset(self, count):
        self._offset = count
        return self

    def InsertMulti(self, rows):
        self._op = "insert"
        self._data = rows
        return self

    def Delete(self):
        self._op = "delete"
        return self

    async def aExecute(self):
        store = self._store
        table = store.tables[self._table]
        if self._op == "insert":
            assert store.in_txn, "批量写入必须在事务内"
            store.batches.append(len(self._data))
            if not store.lossy:
                table["rows"].extend(copy.deepcopy(self._data))
            return len(self._data)
        if self._op == "delete":
            assert store.in_txn, "清空目标表必须在事务内"
            removed = len(table["rows"])
            table["rows"].clear()
            return removed
        store.reads.append(
            {
                "table": self._table,
                "where": self._where,
                "order": self._order,
                "limit": self._limit,
                "offset": self._offset,
            }
        )
        rows = list(table["rows"])
        if self._where is not None:
            column = self._where[0].split()[0]
            rows = [row for row in rows if row[column] > self._where[1]]
        if self._order:
            rows.sort(key=lambda row: row[self._order])
        stop = self._offset + (self._limit or len(rows))
        cols = self._cols or list(table["columns"])
        return [tuple(row[col] for col in cols) for row in rows[self._offset : stop]]

    async def aCount(self):
        return len(self._store.tables[self._table]["rows"])


class _FakeStorage:
    def __init__(self, tables):
        self.tables = tables
        self.reads = []
        self.batches = []
        self.created = []
        self.dropped = []
        self.seq_fixes = []
        self.queries = []
        self.preset = {}
        self.txns = 0
        self.in_txn = False
        self.lossy = False
        self.dialect = types.SimpleNamespace(name="sqlite", quote=lambda n: f'"{n}"')

    def Table(self, name):
        return _FakeBuilder(self, name)

    async def aHasTable(self, name):
        return name in self.tables

    async def aGetTableColumns(self, name):
        return list(self.tables[name]["columns"])

    async def aCreateTable(self, name, columns, constraints=None):
        self.created.append((name, dict(columns), list(constraints or [])))
        self.tables[name] = {
            "columns": {col: " ".join(d.split()[:1]) for col, d in columns.items()},
            "rows": [],
        }
        return True

    async def aDropTable(self, name):
        self.dropped.append(name)
        self.tables.pop(name, None)
        return True

    @asynccontextmanager
    async def atransaction(self):
        self.txns += 1
        self.in_txn = True
        try:
            yield
        finally:
            self.in_txn = False

    async def _execute_query(self, kind, sql, params=()):
        params = list(params or [])
        self.queries.append(sql)
        if sql in self.preset:
            return self.preset[sql], None
        if sql.startswith("PRAGMA table_info("):
            return _pragma_rows(self.tables[sql[len("PRAGMA table_info(") : -1]]), None
        if sql.startswith("SELECT sql FROM sqlite_master"):
            return ([(self.tables[params[0]]["sql"],)] if params[0] in self.tables else []), None
        if sql.startswith("SELECT name FROM sqlite_master"):
            return [(name,) for name in sorted(self.tables)], None  # ORDER BY name
        if "setval(" in sql:
            self.seq_fixes.append(params)
            return [(None,)], None
        raise AssertionError(f"unexpected query: {sql}")


class _Harness(ApiStorageMixin):
    def __init__(self, storage, backend="sqlite"):
        self.storage = storage
        self._backend = backend

    def _storage_dialect_name(self):
        return self._backend


def _users_table(count=1200):
    return {
        "columns": {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "name": "TEXT NOT NULL",
            "note": "TEXT DEFAULT ''",
        },
        "sql": "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, note TEXT DEFAULT '')",
        "rows": [{"id": i, "name": f"user{i}", "note": ""} for i in range(1, count + 1)],
    }


class TestColumnDefsPerDialect:
    def test_sqlite_uses_pragma_and_create_sql(self):
        storage = _FakeStorage({"users": _users_table(0)})
        defs, pk = asyncio.run(_Harness(storage)._backup_column_defs("users"))
        assert list(defs) == ["id", "name", "note"]
        assert defs == {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "name": "TEXT NOT NULL",
            "note": "TEXT DEFAULT ''",
        }
        assert pk == []

    def test_mysql_information_schema(self):
        storage = _FakeStorage({})
        storage.preset[_m._BACKUP_COLUMN_META_SQL["mysql"]] = [
            ("id", "int", "NO", None, "PRI", "auto_increment"),
            ("name", "varchar(64)", "NO", "", "UNI", ""),
            ("active", "tinyint(1)", "YES", "1", "", ""),
            ("created", "datetime", "YES", "CURRENT_TIMESTAMP", "", "DEFAULT_GENERATED"),
            ("note", "longtext", "YES", None, "", ""),
            ("token", "varchar(36)", "YES", "(uuid())", "", "DEFAULT_GENERATED"),
        ]
        defs, pk = asyncio.run(_Harness(storage, "mysql")._backup_column_defs("users"))
        assert defs == {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            # 空串默认值不能被当成"没有默认值"
            "name": "VARCHAR(64) UNIQUE NOT NULL DEFAULT ''",
            "active": "BOOLEAN DEFAULT TRUE",
            "created": "DATETIME DEFAULT CURRENT_TIMESTAMP",
            "note": "TEXT",
            # 表达式默认值不迁移
            "token": "VARCHAR(36)",
        }
        assert pk == []

    def test_mysql_composite_pk(self):
        storage = _FakeStorage({})
        storage.preset[_m._BACKUP_COLUMN_META_SQL["mysql"]] = [
            ("a", "int", "NO", None, "PRI", ""),
            ("b", "varchar(32)", "NO", None, "PRI", ""),
            ("v", "text", "YES", None, "", ""),
        ]
        defs, pk = asyncio.run(_Harness(storage, "mysql")._backup_column_defs("t"))
        assert pk == ["a", "b"]
        assert defs == {"a": "INTEGER NOT NULL", "b": "VARCHAR(32) NOT NULL", "v": "TEXT"}

    def test_postgres_information_schema_and_pg_index(self):
        storage = _FakeStorage({})
        storage.preset[_m._BACKUP_COLUMN_META_SQL["postgres"]] = [
            ("id", "integer", "NO", "nextval('users_id_seq'::regclass)", None, 32, 0),
            ("name", "character varying", "NO", None, 64, None, None),
            ("score", "numeric", "YES", None, None, 10, 2),
            ("avatar", "bytea", "YES", None, None, None, None),
            ("meta", "jsonb", "YES", "'{}'::jsonb", None, None, None),
            ("ts", "timestamp without time zone", "YES", "CURRENT_TIMESTAMP", None, None, None),
        ]
        storage.preset[_m._BACKUP_PK_SQL["postgres"]] = [("id",)]
        defs, pk = asyncio.run(_Harness(storage, "postgres")._backup_column_defs("users"))
        assert defs == {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "name": "VARCHAR(64) NOT NULL",
            "score": "DECIMAL(10,2)",
            "avatar": "BLOB",
            "meta": "TEXT DEFAULT '{}'",
            "ts": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        }
        assert pk == []

    def test_postgres_pk_query_failure_still_detects_serial(self):
        storage = _FakeStorage({})
        storage.preset[_m._BACKUP_COLUMN_META_SQL["postgres"]] = [
            ("id", "bigint", "NO", "nextval('t_id_seq'::regclass)", None, 64, 0),
            ("v", "text", "YES", None, None, None, None),
        ]
        # pg_index 查询没有预置结果 → 抛异常 → 主键回退为空，自增列仍按主键还原
        defs, _pk = asyncio.run(_Harness(storage, "postgres")._backup_column_defs("t"))
        assert defs["id"] == "BIGINT PRIMARY KEY AUTOINCREMENT"

    def test_unknown_backend_refuses(self):
        with pytest.raises(RuntimeError, match="unsupported storage backend"):
            asyncio.run(_Harness(_FakeStorage({}), "mongodb")._backup_column_defs("t"))


class TestExportTables:
    def test_all_tables_except_kv_with_keyset_paging(self):
        storage = _FakeStorage(
            {
                "config": {
                    "columns": {"key": "TEXT PRIMARY KEY", "value": "TEXT NOT NULL"},
                    "rows": [{"key": "a", "value": "1"}],
                },
                "users": _users_table(1200),
                "tags": {
                    "columns": {"name": "TEXT PRIMARY KEY"},
                    "sql": "CREATE TABLE tags (name TEXT PRIMARY KEY)",
                    "rows": [{"name": f"tag{i}"} for i in range(3)],
                },
            }
        )
        tables = asyncio.run(_Harness(storage)._backup_export_tables())
        # KV 主表不进 tables（由备份的 storage 节承载）
        assert [table["name"] for table in tables] == ["tags", "users"]
        users = tables[1]
        assert users["columns"] == {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "name": "TEXT NOT NULL",
            "note": "TEXT DEFAULT ''",
        }
        assert users["primary_key"] == []
        assert [row[0] for row in users["rows"]] == list(range(1, 1201))
        assert users["rows"][7] == [8, "user8", ""]
        # 整数自增主键表走键集分页，不漏不重
        reads = [read for read in storage.reads if read["table"] == "users"]
        assert [(read["where"], read["order"]) for read in reads] == [
            (None, "id"),
            (("id > ?", 500), "id"),
            (("id > ?", 1000), "id"),
        ]
        # 其余表走偏移分页
        assert storage.reads[0]["table"] == "tags" and storage.reads[0]["where"] is None

    def test_offset_paging_for_wide_tables(self):
        table = {
            "columns": {"a": "INTEGER", "b": "INTEGER"},
            "sql": "CREATE TABLE t (a INTEGER, b INTEGER)",
            "rows": [{"a": i, "b": i} for i in range(1001)],
        }
        (exported,) = asyncio.run(
            _Harness(_FakeStorage({"t": table}))._backup_export_tables()
        )
        assert len(exported["rows"]) == 1001

    def test_non_json_cells_are_encoded(self):
        table = {
            "columns": {"id": "INTEGER PRIMARY KEY AUTOINCREMENT", "blob": "BLOB"},
            "sql": "CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, blob BLOB)",
            "rows": [{"id": 1, "blob": b"\x00\xff"}],
        }
        (exported,) = asyncio.run(
            _Harness(_FakeStorage({"t": table}))._backup_export_tables()
        )
        json.dumps(exported, allow_nan=False)
        assert exported["rows"] == [[1, {_m._BACKUP_BYTES_KEY: base64.b64encode(b"\x00\xff").decode()}]]


class TestImportTables:
    def _backup(self, count=1200):
        source = _FakeStorage({"users": _users_table(count)})
        return asyncio.run(_Harness(source)._backup_export_tables())[0]

    def test_conflict_aborts_before_any_write(self):
        target = _FakeStorage(
            {"users": {"columns": _users_table(0)["columns"], "rows": [{"id": 9, "name": "x", "note": ""}]}}
        )
        result = asyncio.run(_Harness(target)._backup_import_tables([self._backup(3)], False))
        assert result == {"error": "tables_not_empty", "tables": ["users"]}
        assert [row["id"] for row in target.tables["users"]["rows"]] == [9]
        assert target.txns == 0

    def test_empty_target_table_is_not_a_conflict(self):
        columns = _users_table(0)["columns"]
        target = _FakeStorage({"users": {"columns": columns, "rows": []}})
        result = asyncio.run(_Harness(target)._backup_import_tables([self._backup(3)], False))
        assert result == {"tables": [{"name": "users", "rows": 3, "ok": True}]}

    def test_overwrite_clears_then_imports_in_short_transactions(self):
        target = _FakeStorage({"users": _users_table(5)})
        result = asyncio.run(_Harness(target)._backup_import_tables([self._backup()], True))
        assert result["tables"][0]["ok"] is True
        assert [row["id"] for row in target.tables["users"]["rows"]] == list(range(1, 1201))
        # 清空一批 + 导入三批：每批一个短事务，不长时间占住写锁
        assert target.txns == 4
        assert target.batches == [500, 500, 200]

    def test_missing_table_is_created_from_defs(self):
        backup = {
            "name": "t",
            "columns": {"a": "INTEGER", "b": "TEXT NOT NULL", "v": "TEXT DEFAULT ''"},
            "primary_key": ["a", "b"],
            "rows": [[1, "x", ""], [2, "y", "z"]],
        }
        target = _FakeStorage({})
        result = asyncio.run(_Harness(target)._backup_import_tables([backup], False))
        assert result["tables"][0]["ok"] is True
        assert target.created == [
            ("t", backup["columns"], ["PRIMARY KEY (a, b)"])
        ]
        assert target.tables["t"]["rows"] == [
            {"a": 1, "b": "x", "v": ""},
            {"a": 2, "b": "y", "v": "z"},
        ]

    def test_created_table_dropped_when_import_fails(self):
        target = _FakeStorage({})
        target.lossy = True  # 写入被静默吞掉 → 行数核对不过
        result = asyncio.run(_Harness(target)._backup_import_tables([self._backup(3)], False))
        assert result["tables"] == [
            {"name": "users", "rows": 3, "ok": False, "error": "row count mismatch: imported 0, expected 3"}
        ]
        # 新建的半截表删掉，免得挡住下一次导入
        assert target.dropped == ["users"] and "users" not in target.tables

    def test_existing_table_kept_when_import_fails(self):
        target = _FakeStorage({"users": _users_table(2)})
        target.lossy = True
        result = asyncio.run(_Harness(target)._backup_import_tables([self._backup(3)], True))
        assert result["tables"][0]["ok"] is False
        assert "users" in target.tables and target.dropped == []

    def test_postgres_strict_types_and_sequence(self):
        backup = {
            "name": "events",
            "columns": {
                "id": "BIGINT PRIMARY KEY AUTOINCREMENT",
                "ts": "TIMESTAMP",
                "amount": "DECIMAL(10,2)",
                "flag": "BOOLEAN",
                "note": "TEXT",
            },
            "primary_key": [],
            "rows": [[7, "2026-11-25 10:00:00", "1.50", 1, 42]],
        }
        target = _FakeStorage({})
        result = asyncio.run(
            _Harness(target, "postgres")._backup_import_tables([backup], False)
        )
        assert result["tables"][0]["ok"] is True
        (row,) = target.tables["events"]["rows"]
        assert row == {
            "id": 7,
            "ts": datetime(2026, 11, 25, 10, 0),
            "amount": Decimal("1.50"),
            "flag": True,
            "note": "42",
        }
        # 显式写入自增主键后序列要校正，否则后续插入主键冲突
        assert target.seq_fixes == [["events", "id"]]

    def test_invalid_backup_writes_nothing(self):
        # 一张合法 + 一张不合规：整份拒绝，合法的那张也不写
        tables = [self._backup(3), {"name": "evil; drop", "columns": {"a": "TEXT"}, "rows": []}]
        target = _FakeStorage({})
        with pytest.raises(ValueError):
            asyncio.run(_Harness(target)._backup_import_tables(tables, False))
        assert target.created == [] and target.batches == [] and target.txns == 0

    def test_roundtrip_source_to_target(self):
        source = _FakeStorage(
            {
                "users": _users_table(7),
                "files": {
                    "columns": {"id": "INTEGER PRIMARY KEY AUTOINCREMENT", "data": "BLOB"},
                    "sql": "CREATE TABLE files (id INTEGER PRIMARY KEY AUTOINCREMENT, data BLOB)",
                    "rows": [{"id": 1, "data": b"\x00\x01\xff"}],
                },
            }
        )
        exported = asyncio.run(_Harness(source)._backup_export_tables())
        target = _FakeStorage({})
        result = asyncio.run(_Harness(target)._backup_import_tables(exported, False))
        assert all(table["ok"] for table in result["tables"])
        assert target.tables["users"]["rows"] == source.tables["users"]["rows"]
        assert target.tables["files"]["rows"] == source.tables["files"]["rows"]
