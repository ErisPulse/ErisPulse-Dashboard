"""ApiDashboard i18n 语言端点单测。

GET /api/i18n/language 返回框架当前生效语言与支持列表（供前端比对界面语言，
决定是否提示同步）；用 stub 父包按文件路径隔离装载 ApiDashboardMixin，
不触发 SDK 导入（fastapi 为真实依赖）。
"""

import asyncio
import importlib.util
import json
import sys
import types
from pathlib import Path

from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parents[1]


def _load_isolated_apidashboard():
    pkg = types.ModuleType("ErisPulse_Dashboard")
    pkg.__path__ = [str(ROOT / "ErisPulse_Dashboard")]
    core = types.ModuleType("ErisPulse_Dashboard.Core")
    core.__path__ = [str(ROOT / "ErisPulse_Dashboard" / "Core")]
    sys.modules.setdefault("ErisPulse_Dashboard", pkg)
    sys.modules.setdefault("ErisPulse_Dashboard.Core", core)
    spec = importlib.util.spec_from_file_location(
        "ErisPulse_Dashboard.Core.ApiDashboard",
        ROOT / "ErisPulse_Dashboard" / "Core" / "ApiDashboard.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["ErisPulse_Dashboard.Core.ApiDashboard"] = module
    spec.loader.exec_module(module)
    return module


_api_dashboard = _load_isolated_apidashboard()
ApiDashboardMixin = _api_dashboard.ApiDashboardMixin


class _StubDashboard(ApiDashboardMixin):
    def __init__(self, sdk):
        self.sdk = sdk


def _make_request():
    return types.SimpleNamespace(path_params={}, query_params={})


def _get(dash):
    return asyncio.run(dash._api_i18n_language_get(_make_request()))


def test_get_returns_resolved_language_and_supported():
    sdk = types.SimpleNamespace(
        i18n=types.SimpleNamespace(
            get_language=lambda: "zh-CN",
            get_supported_languages=lambda: ["zh-CN", "zh-TW", "en", "ja", "ru"],
        )
    )
    dash = _StubDashboard(sdk)
    response = _get(dash)
    assert isinstance(response, JSONResponse)
    payload = json.loads(response.body)
    assert payload == {
        "language": "zh-CN",
        "supported": ["zh-CN", "zh-TW", "en", "ja", "ru"],
    }


def test_get_degrades_when_sdk_lacks_i18n():
    dash = _StubDashboard(types.SimpleNamespace())
    response = _get(dash)
    payload = json.loads(response.body)
    assert payload == {"language": None, "supported": []}


def test_get_degrades_on_sdk_exception():
    class _Boom:
        @property
        def i18n(self):
            raise RuntimeError("sdk not ready")

    dash = _StubDashboard(_Boom())
    payload = json.loads(_get(dash).body)
    assert payload == {"language": None, "supported": []}
