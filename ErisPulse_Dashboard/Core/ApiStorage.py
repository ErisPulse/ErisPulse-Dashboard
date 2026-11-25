"""ApiStorageMixin：存储表浏览器 API（KV 之上的表级浏览）+ 备份的全表导出 / 导入"""

import base64
import json
import math
import re
from datetime import date, datetime, time as dt_time, timezone
from decimal import Decimal
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


# 表名严格白名单：仅字母/数字/下划线，1-64 位（防注入第一道闸，先于任何 SQL 拼装）
_TABLE_NAME_RE = re.compile(r"^[A-Za-z0-9_]{1,64}$")

# 框架内建表：KV 主表（config）+ 会话收件箱（transcript）
_BUILTIN_TABLES = {"config", "transcript"}

# 单元格安全化阈值：超长截断并标记
_MAX_CELL_LEN = 500
# 表清单规模上限：防御异常库（如误连系统库）时逐表 COUNT 的放大效应
_MAX_TABLES = 500
# 分页参数边界
_DEFAULT_PAGE_SIZE = 50
_MAX_PAGE_SIZE = 200

# 各方言"列出全部表"的系统表查询（无参数，全部走占位符漏斗；表名不参与拼接）
_LIST_TABLES_SQL: dict[str, tuple[str, list[Any]]] = {
    "sqlite": (
        "SELECT name FROM sqlite_master "
        "WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        [],
    ),
    "mysql": (
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' "
        "ORDER BY table_name",
        [],
    ),
    "postgres": (
        "SELECT tablename FROM pg_tables "
        "WHERE schemaname = current_schema() ORDER BY tablename",
        [],
    ),
}

# ════════════════ 备份：全表导出 / 导入 ════════════════

# KV 主表由备份的 storage 节（KV 接口）承载，不进 tables——同一份数据不走两条恢复路径
_BACKUP_KV_TABLE = "config"
# 导出分批读取 / 导入每批一个短事务的行数（执行漏斗固定 fetchall，无流式游标）
_BACKUP_BATCH = 500
# bytes 单元格在 JSON 里的形态：{"__ep_b64__": "<base64>"}
_BACKUP_BYTES_KEY = "__ep_b64__"

# 备份文件是用户上传的：其中的表名 / 列名 / 列定义会进建表语句。导入时只按
# 下列文法解析后重新拼装，文件里的原始字符串一律不直接进 SQL
_BACKUP_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
_BACKUP_COLUMN_DEF_RE = re.compile(
    r"^(?P<type>[A-Za-z][A-Za-z0-9_]*(?:\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)"
    r"(?P<pk>\s+PRIMARY\s+KEY(?P<autoinc>\s+AUTOINCREMENT)?)?"
    r"(?P<unique>\s+UNIQUE)?"
    r"(?P<notnull>\s+NOT\s+NULL)?"
    r"(?:\s+DEFAULT\s+(?P<default>-?\d+(?:\.\d+)?|CURRENT_TIMESTAMP|TRUE|FALSE"
    r"|'[^'\\;\x00\r\n]{0,200}'))?$",
    re.IGNORECASE,
)

# 各方言的列元数据查询（列序即 _backup_columns_* 的解包顺序）
_BACKUP_COLUMN_META_SQL: dict[str, str] = {
    "mysql": (
        "SELECT column_name, column_type, is_nullable, column_default, "
        "column_key, extra FROM information_schema.columns "
        "WHERE table_schema = DATABASE() AND table_name = ? "
        "ORDER BY ordinal_position"
    ),
    "postgres": (
        "SELECT column_name, data_type, is_nullable, column_default, "
        "character_maximum_length, numeric_precision, numeric_scale "
        "FROM information_schema.columns "
        "WHERE table_schema = current_schema() AND table_name = ? "
        "ORDER BY ordinal_position"
    ),
}
# PostgreSQL 的主键列（information_schema.columns 不带主键标记）
_BACKUP_PK_SQL: dict[str, str] = {
    "postgres": (
        "SELECT a.attname FROM pg_index i "
        "JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey::int2[]) "
        "WHERE i.indisprimary AND i.indrelid = to_regclass(?) "
        "ORDER BY array_position(i.indkey::int2[], a.attnum)"
    ),
}

# 导入时按列的基础类型分族转换：PostgreSQL 驱动严格校验参数类型
_BACKUP_INT_TYPES = {"INTEGER", "INT", "BIGINT", "SMALLINT", "TINYINT", "MEDIUMINT"}
_BACKUP_REAL_TYPES = {"REAL", "FLOAT", "DOUBLE"}
_BACKUP_DECIMAL_TYPES = {"DECIMAL", "NUMERIC"}
_BACKUP_TIME_TYPES = {"DATETIME", "TIMESTAMP"}


def _backup_split_type(col_type: Any) -> str:
    """列定义的基础类型首词（大写，VARCHAR(64) → VARCHAR）"""
    match = re.match(r"[A-Za-z]+", str(col_type or ""))
    return match.group(0).upper() if match else ""


def _backup_norm_type(text: Any, fallback: str) -> str:
    """库里的类型文本收敛为可安全进建表语句的形式；不合规时用 fallback"""
    raw = str(text or "").strip()
    if not re.fullmatch(
        r"[A-Za-z][A-Za-z0-9_]*(\(\s*\d+(?:\s*,\s*\d+)?\s*\))?", raw
    ):
        return fallback
    base = re.match(r"[A-Za-z][A-Za-z0-9_]*", raw).group(0).upper()
    args = re.search(r"\(.*\)", raw)
    if not args:
        return base
    parts = [part.strip() for part in args.group(0)[1:-1].split(",")]
    return base + "(" + ",".join(parts) + ")"


def _backup_type_from_mysql(column_type: Any) -> str:
    """MySQL 的 column_type → SQLite 风格类型（按 SDK 的类型词汇表反推）"""
    text = str(column_type or "").strip().lower()
    match = re.match(r"^([a-z]+)(?:\(([^)]*)\))?", text)
    base, args = (match.group(1), (match.group(2) or "").strip()) if match else (text, "")
    if base in ("int", "integer", "mediumint"):
        return "INTEGER"
    if base == "bigint":
        return "BIGINT"
    if base == "smallint":
        return "SMALLINT"
    if base in ("tinyint", "bool", "boolean"):
        # tinyint(1) 是 MySQL 对 BOOLEAN 的实际存储形态
        return "BOOLEAN" if base != "tinyint" or args in ("", "1") else "TINYINT"
    if base in ("varchar", "char"):
        return base.upper() + f"({args})" if args.isdigit() else ("TEXT" if base == "varchar" else "CHAR")
    if base == "datetime":
        return "DATETIME"
    if base == "timestamp":
        return "TIMESTAMP"
    if base == "date":
        return "DATE"
    if base in ("double", "float", "real"):
        return base.upper()
    if base in ("decimal", "numeric"):
        return base.upper() + f"({args})" if re.fullmatch(r"\d+\s*,\s*\d+", args) else base.upper()
    if base in ("blob", "tinyblob", "mediumblob", "longblob", "binary", "varbinary"):
        return "BLOB"
    return "TEXT"


def _backup_type_from_postgres(
    data_type: Any, char_len: Any = None, precision: Any = None, scale: Any = None
) -> str:
    """PostgreSQL 的 data_type → SQLite 风格类型（按 SDK 的类型词汇表反推）"""
    text = str(data_type or "").strip().lower()
    if text in ("integer", "int", "int4"):
        return "INTEGER"
    if text in ("bigint", "int8"):
        return "BIGINT"
    if text in ("smallint", "int2"):
        return "SMALLINT"
    if text in ("character varying", "varchar"):
        return f"VARCHAR({int(char_len)})" if char_len else "TEXT"
    if text in ("character", "char"):
        return f"CHAR({int(char_len)})" if char_len else "CHAR"
    if text == "text":
        return "TEXT"
    if text.startswith("timestamp"):
        return "TIMESTAMP"
    if text == "date":
        return "DATE"
    if text == "double precision":
        return "DOUBLE"
    if text == "real":
        return "REAL"
    if text == "numeric":
        return f"DECIMAL({int(precision)},{int(scale)})" if precision is not None else "NUMERIC"
    if text == "boolean":
        return "BOOLEAN"
    if text == "bytea":
        return "BLOB"
    return "TEXT"


def _backup_norm_default(raw: Any, base_type: str, generated: bool = False) -> str | None:
    """
    库里的默认值文本 → 可安全进建表语句的字面量；表达不了的丢弃（返回 None）

    :param raw: information_schema / PRAGMA 给出的默认值原文
    :param base_type: 列的基础类型（BOOLEAN 的数值默认值改写成 TRUE/FALSE）
    :param generated: MySQL 的表达式默认值（DEFAULT_GENERATED）——非字面量的丢弃
    """
    if raw is None:
        return None
    if isinstance(raw, bool):
        return "TRUE" if raw else "FALSE"
    text = str(raw).strip()
    # 空串是合法的默认值（DEFAULT ''），只有 SQL NULL 才表示没有默认值
    if text.upper() == "NULL" or text.upper().startswith(("NEXTVAL(", "NULL::")):
        return None  # 自增序列由 AUTOINCREMENT 表达
    if generated and text.startswith("("):
        return None
    upper = text.upper()
    if "CURRENT_TIMESTAMP" in upper or upper.startswith("NOW("):
        return "CURRENT_TIMESTAMP"
    if re.fullmatch(r"-?\d+(?:\.\d+)?", text):
        if base_type == "BOOLEAN":
            return "FALSE" if Decimal(text) == 0 else "TRUE"
        return text
    if upper in ("TRUE", "FALSE"):
        return upper
    literal = re.fullmatch(r"'((?:[^']|'')*)'\s*(?:::[\w \"().]+)?", text, re.DOTALL)
    inner = literal.group(1).replace("''", "'") if literal else text  # MySQL 的字符串默认值不带引号
    if len(inner) > 200 or any(ch in inner for ch in "'\\;\x00\r\n"):
        return None
    return "'" + inner + "'"


def _backup_build_column_def(col: dict) -> str:
    """结构化列元数据 → SQLite 风格列定义"""
    parts = [col["type"]]
    if col.get("pk"):
        # 内联主键不写 NOT NULL：MySQL / PostgreSQL 本就隐含，SQLite 以原声明为准
        parts.append("PRIMARY KEY")
        if col.get("autoinc"):
            parts.append("AUTOINCREMENT")
    if col.get("unique"):
        parts.append("UNIQUE")
    if col.get("notnull") and not col.get("pk"):
        parts.append("NOT NULL")
    if col.get("default") is not None:
        parts.append("DEFAULT " + col["default"])
    return " ".join(parts)


def _backup_encode_cell(value: Any) -> Any:
    """单元格 → JSON 可表达的值（JSON 原生类型原样保留）"""
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {_BACKUP_BYTES_KEY: base64.b64encode(bytes(value)).decode("ascii")}
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            # 目标列一律是不带时区的时间类型：先归一到 UTC 再去掉时区
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value.isoformat(sep=" ")
    if isinstance(value, (date, dt_time)):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _backup_coerce_cell(value: Any, col_type: str, strict: bool) -> Any:
    """
    JSON 值 → 目标驱动接受的 Python 值（按列的基础类型分族）

    :param strict: 目标是 PostgreSQL 时为 True——驱动严格校验参数类型
        （时间必须是 datetime、定点数必须是 Decimal、文本必须是 str）
    """
    base = _backup_split_type(col_type)
    if base == "BLOB":
        if isinstance(value, dict) and set(value) == {_BACKUP_BYTES_KEY}:
            return base64.b64decode(str(value[_BACKUP_BYTES_KEY]))
        if value is None or isinstance(value, (bytes, bytearray)):
            return value
        return str(value).encode("utf-8")
    if value is None:
        return None
    if base in _BACKUP_INT_TYPES:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return int(str(value).strip())
    if base in _BACKUP_DECIMAL_TYPES:
        return Decimal(str(value)) if strict else value
    if base in _BACKUP_REAL_TYPES:
        return float(value) if strict else value
    if base == "BOOLEAN":
        if isinstance(value, str):
            low = value.strip().lower()
            if low not in ("1", "true", "t", "yes", "on", "0", "false", "f", "no", "off"):
                raise ValueError(f"invalid boolean literal: {value!r}")
            value = low in ("1", "true", "t", "yes", "on")
        return bool(value)
    if base in _BACKUP_TIME_TYPES or base == "DATE":
        if not strict:
            return value
        parsed = _backup_parse_time(value, base == "DATE")
        return parsed
    if isinstance(value, str):
        return value
    return str(value)


def _backup_parse_time(value: Any, date_only: bool) -> Any:
    """JSON 值 → datetime / date（PostgreSQL 导入用）；无法解析抛 ValueError"""
    if isinstance(value, bool):
        raise ValueError(f"invalid datetime literal: {value!r}")
    if isinstance(value, (int, float)):
        # 数值按 Unix 时间戳理解（毫秒值按量级识别）
        stamp = value / 1000 if abs(value) > 1e11 else value
        parsed = datetime.fromtimestamp(stamp, tz=timezone.utc)
    elif isinstance(value, str):
        text = value.strip()
        if text.endswith(("Z", "z")):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            parsed = None
            for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d"):
                try:
                    parsed = datetime.strptime(text, fmt)
                except ValueError:
                    continue
            if parsed is None:
                raise ValueError(f"invalid datetime literal: {value!r}") from None
    else:
        raise ValueError(f"invalid datetime literal: {value!r}")
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed.date() if date_only else parsed


class ApiStorageMixin:
    """存储表浏览器 API：表清单、表数据分页与清空；备份的全表导出 / 导入。"""


    # ════════════════ 内部工具 ════════════════

    def _storage_dialect_name(self) -> str:
        """探测当前存储后端方言：优先运行时实例的 dialect.name，读配置兜底"""
        storage = getattr(self, "storage", None)
        dialect = getattr(storage, "dialect", None)
        name = getattr(dialect, "name", "")
        if name:
            return name
        # 实例不可用（理论上不发生）时按配置 ErisPulse.storage.backend 兜底
        backend = ""
        try:
            backend = str(
                self.sdk.config.getConfig("ErisPulse.storage.backend") or ""
            ).strip().lower()
        except Exception:
            pass
        if backend.startswith("postgres"):
            return "postgres"
        return backend or "sqlite"

    def _sanitize_table_name(self, name: Any) -> str | None:
        """表名严格校验：^[A-Za-z0-9_]{1,64}$；合法返回原值，非法返回 None"""
        if not isinstance(name, str) or not _TABLE_NAME_RE.match(name):
            return None
        return name

    async def _list_table_names(self) -> list[str]:
        """直查系统表列举全部表名（SDK 无公开"列全部表"API，借执行漏斗）"""
        dialect = self._storage_dialect_name()
        spec = _LIST_TABLES_SQL.get(dialect)
        if spec is None:
            raise RuntimeError(f"unsupported storage backend: {dialect}")
        sql, params = spec
        rows, _cols = await self.storage._execute_query("select", sql, params)
        names: list[str] = []
        for row in rows or []:
            value = row[0] if isinstance(row, (tuple, list)) and row else row
            if value is None:
                continue
            if isinstance(value, bytes):
                value = value.decode("utf-8", "replace")
            names.append(str(value))
        return names[:_MAX_TABLES]

    async def _count_table_rows(self, name: str) -> int | None:
        """SELECT COUNT(*) 统计表行数；统计失败返回 None（由前端显示为未知）"""
        try:
            return int(await self.storage.Table(name).aCount())
        except Exception:
            return None

    @staticmethod
    def _serialize_cell(value: Any) -> dict:
        """单元格安全化：bytes → base64 标记；超长截断 500 字符并标记 truncated"""
        if value is None:
            return {"v": None}
        if isinstance(value, bytes):
            encoded = base64.b64encode(value).decode("ascii")
            return {
                "v": encoded[:_MAX_CELL_LEN],
                "bytes": True,
                "size": len(value),
                "truncated": len(encoded) > _MAX_CELL_LEN,
            }
        if isinstance(value, bool) or isinstance(value, (int, float)):
            # 数值/布尔保持原生 JSON 类型（bool 先于 int 判断）
            return {"v": value, "truncated": False}
        if isinstance(value, (dict, list, tuple, set)):
            try:
                text = json.dumps(value, ensure_ascii=False, default=str)
            except Exception:
                text = str(value)
        else:
            text = str(value)
        return {"v": text[:_MAX_CELL_LEN], "truncated": len(text) > _MAX_CELL_LEN}

    # ════════════════ 表浏览器端点 ════════════════

    async def _api_storage_tables(self, request: Request) -> JSONResponse:
        """列出存储全部表：[{name, rows, builtin}]；后端方言探测后直查系统表"""
        try:
            names = await self._list_table_names()
        except Exception as e:
            return JSONResponse(
                {
                    "error": "list_tables_failed",
                    "message": str(e),
                    "backend": self._storage_dialect_name(),
                    "tables": [],
                },
                status_code=500,
            )
        tables = [
            {
                "name": name,
                "rows": await self._count_table_rows(name),
                "builtin": name in _BUILTIN_TABLES,
            }
            for name in names
        ]
        return JSONResponse(
            {
                "backend": self._storage_dialect_name(),
                "tables": tables,
                "total": len(tables),
            }
        )

    async def _api_storage_table(self, request: Request) -> JSONResponse:
        """分页读取表数据：{columns, rows, total, page, size}"""
        name = self._sanitize_table_name(request.query_params.get("name", ""))
        if name is None:
            return JSONResponse(
                {"error": "invalid table name"}, status_code=400
            )
        try:
            page = max(1, int(request.query_params.get("page", "1")))
            size = int(request.query_params.get("size", str(_DEFAULT_PAGE_SIZE)))
        except ValueError:
            page, size = 1, _DEFAULT_PAGE_SIZE
        size = min(max(1, size), _MAX_PAGE_SIZE)

        try:
            exists = await self.storage.aHasTable(name)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
        if not exists:
            return JSONResponse({"error": "table not found"}, status_code=404)

        try:
            columns = await self.storage.aGetTableColumns(name)
            total = int(await self.storage.Table(name).aCount())
            offset = (page - 1) * size
            builder = self.storage.Table(name).Select().Limit(size).Offset(offset)
            # 稳定分页：按首列排序（列名源自系统表，且经构建器黑名单校验兜底）
            if columns and re.match(r"^[A-Za-z0-9_]+$", columns[0]):
                builder = builder.OrderBy(columns[0])
            raw_rows = await builder.aExecute()
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

        rows = [
            [self._serialize_cell(cell) for cell in row]
            if isinstance(row, (tuple, list))
            else [self._serialize_cell(row)]
            for row in (raw_rows or [])
        ]
        # 列名枚举失败时按首行宽度派生占位列名，保证前端仍可渲染
        if not columns and rows:
            columns = [f"col{i + 1}" for i in range(len(rows[0]))]
        return JSONResponse(
            {
                "name": name,
                "columns": columns,
                "rows": rows,
                "total": total,
                "page": page,
                "size": size,
                "pages": (total + size - 1) // size if size else 0,
            }
        )

    async def _api_storage_table_clear(self, request: Request) -> JSONResponse:
        """清空表数据（DELETE 全表，不做 DropTable）：危险操作，记审计"""
        try:
            body = await request.json()
        except Exception:
            body = {}
        name = self._sanitize_table_name(body.get("name", ""))
        if name is None:
            return JSONResponse(
                {"error": "invalid table name"}, status_code=400
            )
        try:
            exists = await self.storage.aHasTable(name)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
        if not exists:
            return JSONResponse({"error": "table not found"}, status_code=404)
        try:
            affected = int(await self.storage.Table(name).Delete().aExecute())
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
        self._add_audit_log(
            "storage_table_clear", f"{name} ({affected} rows)", request
        )
        return JSONResponse({"success": True, "name": name, "deleted": affected})

    # ════════════════ 备份：全表导出 ════════════════

    async def _backup_column_defs(self, table: str) -> tuple[dict[str, str], list[str]]:
        """
        表的列定义还原为 SQLite 风格（aCreateTable 的入参形态）

        SDK 的方言翻译是单向的（AUTOINCREMENT → AUTO_INCREMENT / SERIAL 回不去），
        只能从各后端的系统表反推。

        :return: (列名到定义的有序字典, 复合主键的列名列表)
        """
        dialect = self._storage_dialect_name()
        if dialect == "sqlite":
            cols = await self._backup_columns_sqlite(table)
        elif dialect == "mysql":
            cols = await self._backup_columns_mysql(table)
        elif dialect == "postgres":
            cols = await self._backup_columns_postgres(table)
        else:
            raise RuntimeError(f"unsupported storage backend: {dialect}")
        pk_cols = [col["name"] for col in cols if col["pk"]]
        composite = len(pk_cols) > 1
        defs = {}
        for col in cols:
            if composite and col["pk"]:
                # 复合主键走表级约束，列定义里不再内联；非空标志按各方言如实记录的来
                col = dict(col, pk=False, autoinc=False)
            defs[col["name"]] = _backup_build_column_def(col)
        return defs, (pk_cols if composite else [])

    async def _backup_columns_sqlite(self, table: str) -> list[dict]:
        """SQLite：PRAGMA table_info 的 type 列即原始定义文本，信息最完整"""
        # 表名已经过 _sanitize_table_name（仅字母数字下划线）；PRAGMA 不支持占位符
        rows, _cols = await self.storage._execute_query(
            "select", f"PRAGMA table_info({table})", []
        )
        sql_rows, _cols = await self.storage._execute_query(
            "select",
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
            [table],
        )
        create_sql = str(sql_rows[0][0]) if sql_rows else ""
        # AUTOINCREMENT 只允许用于单列 INTEGER 主键：建表语句里出现即属于该列
        has_autoinc = bool(re.search(r"\bAUTOINCREMENT\b", create_sql, re.IGNORECASE))
        pk_cols = [str(row[1]) for row in rows if row[5]]
        cols = []
        for row in rows:
            name, ctype, notnull, default, pk = (
                str(row[1]),
                str(row[2] or ""),
                row[3],
                row[4],
                bool(row[5]),
            )
            # 无类型列按 BLOB 还原（NONE 亲和，存取不做转换）
            col_type = _backup_norm_type(ctype, "BLOB")
            cols.append(
                {
                    "name": name,
                    "type": col_type,
                    "notnull": bool(notnull),
                    "pk": pk,
                    "autoinc": has_autoinc and pk and col_type == "INTEGER" and len(pk_cols) == 1,
                    "unique": False,
                    "default": _backup_norm_default(default, _backup_split_type(col_type)),
                }
            )
        return cols

    async def _backup_columns_mysql(self, table: str) -> list[dict]:
        """MySQL：information_schema.columns（column_default 为 SQL NULL 与空串是两回事）"""
        rows, _cols = await self.storage._execute_query(
            "select", _BACKUP_COLUMN_META_SQL["mysql"], [table]
        )
        cols = []
        for row in rows:
            name = str(row[0])
            nullable = str(row[2] or "").upper()
            key = str(row[4] or "").upper()
            extra = str(row[5] or "")
            is_pk = key == "PRI"
            col_type = _backup_type_from_mysql(row[1])
            cols.append(
                {
                    "name": name,
                    "type": col_type,
                    "notnull": nullable == "NO",
                    "pk": is_pk,
                    "autoinc": "auto_increment" in extra.lower(),
                    "unique": key == "UNI",
                    "default": _backup_norm_default(
                        row[3],
                        _backup_split_type(col_type),
                        generated="DEFAULT_GENERATED" in extra.upper(),
                    ),
                }
            )
        return cols

    async def _backup_columns_postgres(self, table: str) -> list[dict]:
        """PostgreSQL：information_schema.columns + pg_index 取主键"""
        rows, _cols = await self.storage._execute_query(
            "select", _BACKUP_COLUMN_META_SQL["postgres"], [table]
        )
        pk_set = set(await self._backup_postgres_pk(table))
        serial_cols = [
            str(row[0]) for row in rows if str(row[3] or "").lower().startswith("nextval(")
        ]
        if not pk_set:
            # 主键查询不可用时退一步：自增列必然是主键
            pk_set = set(serial_cols)
        cols = []
        for row in rows:
            name = str(row[0])
            col_type = _backup_type_from_postgres(row[1], row[4], row[5], row[6])
            cols.append(
                {
                    "name": name,
                    "type": col_type,
                    "notnull": str(row[2] or "").upper() == "NO",
                    "pk": name in pk_set,
                    "autoinc": name in serial_cols,
                    "unique": False,
                    "default": _backup_norm_default(row[3], _backup_split_type(col_type)),
                }
            )
        return cols

    async def _backup_postgres_pk(self, table: str) -> list[str]:
        """主键列（按序）；查询失败时回退为空"""
        try:
            rows, _cols = await self.storage._execute_query(
                "select", _BACKUP_PK_SQL["postgres"], [table]
            )
        except Exception:
            return []
        return [str(row[0]) for row in rows]

    async def _backup_read_rows(
        self, table: str, columns: list[str], defs: dict[str, str]
    ) -> list[list[Any]]:
        """
        分批读出全表数据（单元格已转成 JSON 可表达的值）

        整数自增主键表走键集分页（WHERE pk > ?）：面板在框架进程内运行，导出期间
        表仍可能被写入，偏移分页会因此漏行或重行。
        """
        key_col = None
        for col, col_def in defs.items():
            match = _BACKUP_COLUMN_DEF_RE.match(col_def)
            if match and match.group("autoinc"):
                key_col = col
                break
        key_idx = columns.index(key_col) if key_col in columns else -1
        out: list[list[Any]] = []
        last = None
        offset = 0
        while True:
            builder = self.storage.Table(table).Select(*columns).Limit(_BACKUP_BATCH)
            if key_idx >= 0:
                builder = builder.OrderBy(key_col)
                if last is not None:
                    builder = builder.Where(f"{key_col} > ?", last)
            else:
                builder = builder.Offset(offset)
            rows = await builder.aExecute() or []
            out.extend([_backup_encode_cell(value) for value in row] for row in rows)
            if len(rows) < _BACKUP_BATCH:
                break
            if key_idx >= 0:
                last = rows[-1][key_idx]
            else:
                offset += _BACKUP_BATCH
        return out

    async def _backup_export_tables(self) -> list[dict]:
        """除 KV 主表外的全部表：[{name, columns, primary_key, rows}]"""
        tables = []
        for name in await self._list_table_names():
            if name == _BACKUP_KV_TABLE or not self._sanitize_table_name(name):
                continue
            defs, pk = await self._backup_column_defs(name)
            if not defs:
                continue
            # 行按 defs 的列序读出，备份里的 columns 与 rows 因此严格对齐
            actual = await self.storage.aGetTableColumns(name)
            if set(actual) != set(defs):
                raise RuntimeError(f"column introspection mismatch on table {name!r}")
            tables.append(
                {
                    "name": name,
                    "columns": defs,
                    "primary_key": pk,
                    "rows": await self._backup_read_rows(name, list(defs), defs),
                }
            )
        return tables

    # ════════════════ 备份：全表导入 ════════════════

    @staticmethod
    def _backup_plan_table(entry: Any) -> dict:
        """
        校验备份里的一张表并生成导入计划；不合规抛 ValueError（整份备份拒绝）

        列定义只按文法解析后重新拼装，文件里的原始字符串不直接进 SQL。
        """
        if not isinstance(entry, dict):
            raise ValueError("table entry must be an object")
        name = str(entry.get("name") or "")
        if not _BACKUP_IDENTIFIER_RE.match(name):
            raise ValueError(f"invalid table name: {name!r}")
        raw_columns = entry.get("columns")
        if not isinstance(raw_columns, dict) or not raw_columns:
            raise ValueError(f"table {name}: columns must be a non-empty object")
        pk = entry.get("primary_key") or []
        if not isinstance(pk, list) or not all(
            isinstance(col, str) and _BACKUP_IDENTIFIER_RE.match(col) for col in pk
        ):
            raise ValueError(f"table {name}: invalid primary_key")
        composite = len(pk) > 1
        defs: dict[str, str] = {}
        types: dict[str, str] = {}
        autoinc_col = None
        for col, raw_def in raw_columns.items():
            col = str(col)
            if not _BACKUP_IDENTIFIER_RE.match(col):
                raise ValueError(f"table {name}: invalid column name {col!r}")
            match = _BACKUP_COLUMN_DEF_RE.match(str(raw_def or "").strip())
            if not match:
                raise ValueError(f"table {name}: invalid column definition for {col!r}")
            parts = [match.group("type")]
            if match.group("pk") and not composite:
                parts.append("PRIMARY KEY")
                if match.group("autoinc"):
                    parts.append("AUTOINCREMENT")
                    autoinc_col = col
            if match.group("unique"):
                parts.append("UNIQUE")
            if match.group("notnull"):
                parts.append("NOT NULL")
            if match.group("default"):
                parts.append("DEFAULT " + match.group("default"))
            defs[col] = " ".join(parts)
            types[col] = match.group("type")
        rows = entry.get("rows")
        if not isinstance(rows, list):
            raise ValueError(f"table {name}: rows must be a list")
        for row in rows:
            if not isinstance(row, list) or len(row) != len(defs):
                raise ValueError(f"table {name}: row width does not match columns")
        return {
            "name": name,
            "defs": defs,
            "types": types,
            "constraints": [f"PRIMARY KEY ({', '.join(pk)})"] if composite else [],
            "autoinc": autoinc_col,
            "rows": rows,
        }

    async def _backup_import_tables(self, tables: Any, overwrite: bool) -> dict:
        """
        把备份里的表导入当前后端

        先整体校验与冲突预检（这一步不写任何数据），再逐表：建表（不存在时）→
        每批一个短事务导入 → 核对行数。面板在框架进程内运行，长事务会长时间占住
        SQLite 写锁，所以一批一提交。

        :return: {"tables": [{name, rows, ok[, error]}]}；目标表非空且未要求覆盖时
            返回 {"error": "tables_not_empty", "tables": [...]}
        """
        if not isinstance(tables, list):
            raise ValueError("tables must be a list")
        plan = [self._backup_plan_table(entry) for entry in tables]

        conflicts = []
        if not overwrite:
            for item in plan:
                if await self.storage.aHasTable(
                    item["name"]
                ) and await self.storage.Table(item["name"]).aCount():
                    conflicts.append(item["name"])
        if conflicts:
            return {"error": "tables_not_empty", "tables": conflicts}

        strict = self._storage_dialect_name() == "postgres"
        results = []
        for item in plan:
            name, rows, cols = item["name"], item["rows"], list(item["defs"])
            info: dict[str, Any] = {"name": name, "rows": len(rows), "ok": False}
            created = False
            try:
                if not await self.storage.aHasTable(name):
                    if not await self.storage.aCreateTable(
                        name, item["defs"], item["constraints"]
                    ):
                        raise RuntimeError("create table failed")
                    created = True
                elif overwrite:
                    async with self.storage.atransaction():
                        await self.storage.Table(name).Delete().aExecute()
                for start in range(0, len(rows), _BACKUP_BATCH):
                    batch = [
                        {
                            col: _backup_coerce_cell(value, item["types"][col], strict)
                            for col, value in zip(cols, row)
                        }
                        for row in rows[start : start + _BACKUP_BATCH]
                    ]
                    async with self.storage.atransaction():
                        await self.storage.Table(name).InsertMulti(batch).aExecute()
                if strict and item["autoinc"]:
                    await self._backup_resync_sequence(name, item["autoinc"])
                actual = await self.storage.Table(name).aCount()
                if actual != len(rows):
                    raise RuntimeError(
                        f"row count mismatch: imported {actual}, expected {len(rows)}"
                    )
                info["ok"] = True
            except Exception as e:
                info["error"] = str(e) or type(e).__name__
                if created:
                    # 新建的表导入失败：删掉，免得半截数据挡住下一次导入
                    try:
                        await self.storage.aDropTable(name)
                    except Exception:
                        pass
            results.append(info)
        return {"tables": results}

    async def _backup_resync_sequence(self, table: str, column: str) -> None:
        """PostgreSQL：显式写入自增主键不会推进序列，校正到 MAX(col)+1，否则后续插入主键冲突"""
        quote = self.storage.dialect.quote
        sql = (
            "SELECT setval(pg_get_serial_sequence(?, ?), "
            f"(SELECT COALESCE(MAX({quote(column)}), 0) + 1 FROM {quote(table)}), false)"
        )
        await self.storage._execute_query("select", sql, [table, column])
