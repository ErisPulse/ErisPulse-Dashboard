"""ApiStorageMixin：存储表浏览器 API（KV 之上的表级浏览）"""

import base64
import json
import re
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


# 表名严格白名单：仅字母/数字/下划线，1-64 位（防注入第一道闸，先于任何 SQL 拼装）
_TABLE_NAME_RE = re.compile(r"^[A-Za-z0-9_]{1,64}$")

# 框架内建表：KV 主表（config）+ 会话收件箱（transcript）
_BUILTIN_TABLES = {"config", "transcript"}

# 单元格安全化阈值：超长截断并标记，避免大字段拖垮响应
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


class ApiStorageMixin:
    """存储表浏览器 API：表清单、表数据分页与清空。"""


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

        # HasTable 二次确认：表清单与读取之间可能发生结构变化
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
