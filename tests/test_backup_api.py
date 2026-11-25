"""备份导出 / 导入端点的编排。

端点本身很薄，这里盯住顺序与边界：数据表冲突时配置与 KV 都不能动、
ErisPulse.storage 配置节不恢复、KV 读写走异步接口（同步接口在异步上下文里
会阻塞事件循环，框架已弃用）。
"""

import asyncio
import copy
import importlib.util
import json
import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _load_isolated():
    """按文件路径装载 ApiObservabilityMixin，不触发 SDK 导入（fastapi 为真实依赖）"""
    pkg = types.ModuleType("ErisPulse_Dashboard")
    pkg.__path__ = [str(ROOT / "ErisPulse_Dashboard")]
    core = types.ModuleType("ErisPulse_Dashboard.Core")
    core.__path__ = [str(ROOT / "ErisPulse_Dashboard" / "Core")]
    sys.modules.setdefault("ErisPulse_Dashboard", pkg)
    sys.modules.setdefault("ErisPulse_Dashboard.Core", core)
    spec = importlib.util.spec_from_file_location(
        "ErisPulse_Dashboard.Core.ApiObservability",
        ROOT / "ErisPulse_Dashboard" / "Core" / "ApiObservability.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["ErisPulse_Dashboard.Core.ApiObservability"] = module
    spec.loader.exec_module(module)
    return module


_m = _load_isolated()
ApiObservabilityMixin = _m.ApiObservabilityMixin


class _Request:
    def __init__(self, body=None, params=None):
        self._body = body
        self.query_params = params or {}

    async def json(self):
        return self._body


class _Config:
    def __init__(self):
        self.set_calls = []
        self.data = {
            "ErisPulse": {"storage": {"backend": "sqlite"}, "logger": {"level": "INFO"}},
            "Dashboard": {"token": "current"},
        }

    def getAllConfig(self):
        return copy.deepcopy(self.data)

    def setConfig(self, key, value):
        self.set_calls.append((key, copy.deepcopy(value)))


class _AsyncKV:
    """只提供异步 KV 接口；同步接口一被调用就判失败"""

    def __init__(self, kv=None):
        self.kv = dict(kv or {})
        self.multi_writes = []
        self.write_ok = True

    async def aget_all_keys(self):
        return list(self.kv)

    async def aget_multi(self, keys):
        return {key: self.kv[key] for key in keys if key in self.kv}

    async def aset_multi(self, items):
        self.multi_writes.append(dict(items))
        if self.write_ok:
            self.kv.update(items)
        return self.write_ok

    def _sync(self, *_args, **_kwargs):
        raise AssertionError("同步 KV 接口已弃用，不应被调用")

    get_all_keys = get = get_multi = set = set_multi = _sync


class _LegacyKV:
    """旧 SDK：只有逐键的同步 KV 接口"""

    def __init__(self, kv=None):
        self.kv = dict(kv or {})

    def get_all_keys(self):
        return list(self.kv)

    def get(self, key):
        return self.kv[key]


class _Harness(ApiObservabilityMixin):
    def __init__(self, storage, tables_impl=None):
        self.storage = storage
        self.sdk = types.SimpleNamespace(config=_Config())
        self._audit_log = []
        self.import_calls = []
        self.tables_impl = tables_impl or (lambda tables, overwrite: {"tables": []})

    def _storage_dialect_name(self):
        return "sqlite"

    def _add_audit_log(self, action, detail="", request=None):
        self._audit_log.append(action)

    async def _backup_export_tables(self):
        return [{"name": "users", "columns": {"id": "INTEGER"}, "primary_key": [], "rows": [[1]]}]

    async def _backup_import_tables(self, tables, overwrite):
        self.import_calls.append((tables, overwrite))
        return self.tables_impl(tables, overwrite)


def _call(coro):
    response = asyncio.run(coro)
    return response.status_code, json.loads(response.body)


BACKUP = {
    "version": "2.0",
    "config": {"ErisPulse": {"storage": {"backend": "mysql"}, "logger": {"level": "DEBUG"}}},
    "storage": {"app.name": "MyApp", "__ep_events__": "[]"},
    "tables": [{"name": "users", "columns": {"id": "INTEGER"}, "rows": [[1]]}],
}


class TestExport:
    def test_full_kv_and_tables_over_async_kv(self):
        storage = _AsyncKV({"app.name": "MyApp", "x": 1})
        status, body = _call(_Harness(storage)._api_backup_export(_Request()))
        assert status == 200
        assert body["version"] == "2.0"
        assert body["backend"] == "sqlite"
        # 不再有 500 键上限
        assert body["storage"] == {"app.name": "MyApp", "x": 1}
        assert body["tables"][0]["name"] == "users"
        assert "Dashboard" in body["config"]

    def test_legacy_sdk_falls_back_to_sync_kv(self):
        storage = _LegacyKV({"app.name": "MyApp"})
        _status, body = _call(_Harness(storage)._api_backup_export(_Request()))
        assert body["storage"] == {"app.name": "MyApp"}


class TestImport:
    def test_conflict_touches_nothing_and_returns_409(self):
        def conflict(tables, overwrite):
            return {"error": "tables_not_empty", "tables": ["users"]}

        harness = _Harness(_AsyncKV(), conflict)
        status, body = _call(harness._api_backup_import(_Request(copy.deepcopy(BACKUP))))
        assert (status, body) == (409, {"error": "tables_not_empty", "tables": ["users"]})
        assert harness.sdk.config.set_calls == []
        assert harness.storage.multi_writes == []
        assert harness.import_calls == [(BACKUP["tables"], False)]

    def test_malformed_backup_returns_400_and_writes_nothing(self):
        def malformed(tables, overwrite):
            raise ValueError("table users: invalid column definition for 'a'")

        harness = _Harness(_AsyncKV(), malformed)
        status, body = _call(harness._api_backup_import(_Request(copy.deepcopy(BACKUP))))
        assert (status, body) == (400, {"error": "table users: invalid column definition for 'a'"})
        assert harness.sdk.config.set_calls == [] and harness.storage.multi_writes == []

    def test_restores_config_without_storage_section(self):
        harness = _Harness(_AsyncKV())
        backup = copy.deepcopy(BACKUP)
        status, body = _call(harness._api_backup_import(_Request(backup)))
        assert status == 200 and body["success"] is True
        assert harness.sdk.config.set_calls == [("ErisPulse", {"logger": {"level": "DEBUG"}})]
        # 请求体不能被就地改掉
        assert backup["config"]["ErisPulse"]["storage"] == {"backend": "mysql"}

    def test_restores_kv_over_async_api_skipping_system_keys(self):
        harness = _Harness(_AsyncKV())
        _call(harness._api_backup_import(_Request(copy.deepcopy(BACKUP))))
        assert harness.storage.multi_writes == [{"app.name": "MyApp"}]
        assert harness.storage.kv == {"app.name": "MyApp"}

    def test_tables_go_first(self):
        order = []

        class _H(_Harness):
            async def _backup_import_tables(self, tables, overwrite):
                order.append("tables")
                return {"tables": []}

        def _config_set(key, value):
            order.append("config")

        harness = _H(_AsyncKV())
        harness.sdk.config.setConfig = _config_set
        _call(harness._api_backup_import(_Request(copy.deepcopy(BACKUP))))
        assert order[0] == "tables" and "config" in order

    def test_overwrite_query_flag(self):
        harness = _Harness(_AsyncKV())
        _call(harness._api_backup_import(_Request(BACKUP, {"overwrite": "true"})))
        assert harness.import_calls == [(BACKUP["tables"], True)]

    def test_kv_write_failure_is_reported(self):
        storage = _AsyncKV()
        storage.write_ok = False
        _status, body = _call(_Harness(storage)._api_backup_import(_Request(copy.deepcopy(BACKUP))))
        assert body["success"] is False
        assert body["storage_restored"] == 1

    def test_legacy_backup_without_tables(self):
        harness = _Harness(_AsyncKV())
        legacy = {"version": "1.0", "config": {"ErisPulse": {"logger": {"level": "DEBUG"}}}, "storage": {"a": 1}}
        status, body = _call(harness._api_backup_import(_Request(legacy)))
        assert status == 200 and body["success"] is True
        assert body["tables"] == [] and body["storage_restored"] == 1

    @pytest.mark.parametrize("body", [[], "text", 42])
    def test_non_object_body_rejected(self, body):
        status, payload = _call(_Harness(_AsyncKV())._api_backup_import(_Request(body)))
        assert (status, payload) == (400, {"error": "Invalid backup format"})
