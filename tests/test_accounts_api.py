"""
账户保存端点（_api_adapter_accounts_set）回归测试：
- .bots 旧键存量迁移合并到 .accounts（不再回落写死键）
- 合并语义：新值覆盖旧值，未提交字段保留
- 迁移完成后旧 .bots 清空
"""

import asyncio
from dataclasses import dataclass
from types import SimpleNamespace

from ErisPulse_Dashboard.Core.ApiAdapters import ApiAdaptersMixin


@dataclass
class FakeAccountConfig:
    enabled: bool = True
    name: str = ""
    mode: str = "client"
    url: str = "ws://127.0.0.1:3001"
    token: str = ""


class FakeConfig:
    def __init__(self):
        self.store = {}

    def getConfig(self, key):
        return self.store.get(key)

    def setConfig(self, key, value, immediate=False):
        self.store[key] = value


class FakeAdapter:
    AccountConfigClass = FakeAccountConfig

    def _get_config_key(self):
        return "SnowLuma_Adapter"


class FakeAdapterMgr:
    def get(self, name):
        return FakeAdapter()


class FakeRequest:
    path_params = {"platform": "snowluma"}

    def __init__(self, body):
        self._body = body

    async def json(self):
        return self._body


def make_host(store):
    h = ApiAdaptersMixin()
    h.sdk = SimpleNamespace(config=FakeConfig(), adapter=FakeAdapterMgr())
    h.logger = SimpleNamespace(debug=lambda *a, **k: None)
    h._add_audit_log = lambda *a, **k: None

    async def _reload(a, p, reload=True):
        return False

    h._reload_adapter_if_running = _reload
    h.sdk.config.store = store
    return h


def _set_accounts(host, body):
    return asyncio.run(host._api_adapter_accounts_set(FakeRequest(body)))


def test_legacy_bots_migrated_into_accounts():
    """旧格式 .bots 存量必须并入 .accounts 新键（不再回落写死键）"""
    host = make_host({"SnowLuma_Adapter.bots": {"default": {"token": "old"}}})
    resp = _set_accounts(
        host, {"accounts": {"default": {"enabled": True, "url": "ws://x"}}}
    )
    assert resp.status_code == 200
    store = host.sdk.config.store
    acc = store["SnowLuma_Adapter.accounts"]["default"]
    assert acc["url"] == "ws://x"
    assert acc["token"] == "old"  # 存量字段保留
    assert store["SnowLuma_Adapter.bots"] == {}  # 迁移后旧键清空


def test_accounts_key_is_authoritative():
    """保存必须写 .accounts（运行时读取键），不得回落 .bots"""
    host = make_host({})
    resp = _set_accounts(
        host, {"accounts": {"default": {"enabled": True, "mode": "client"}}}
    )
    assert resp.status_code == 200
    store = host.sdk.config.store
    assert "SnowLuma_Adapter.accounts" in store
    assert "SnowLuma_Adapter.bots" not in store


def test_new_value_overrides_legacy():
    """同字段新值覆盖旧值"""
    host = make_host(
        {
            "SnowLuma_Adapter.bots": {"default": {"url": "ws://old:3001"}},
            "SnowLuma_Adapter.accounts": {"default": {"url": "ws://new:3001"}},
        }
    )
    resp = _set_accounts(host, {"accounts": {"default": {"url": "ws://newest"}}})
    assert resp.status_code == 200
    acc = host.sdk.config.store["SnowLuma_Adapter.accounts"]["default"]
    assert acc["url"] == "ws://newest"
