"""ApiModules 影子端点薄壳转发单测。

whl 摄取 / 持久化逻辑在 SDK 侧（2.12+）；本文件验证 Dashboard 端点只做
转发与响应包装：上传 → sdk.module.shadow_ingest_whl，转正持久化 →
sdk.module.shadow_promote_persist。用 stub 父包按文件路径隔离装载
ApiModules，不触发 SDK 导入（fastapi 为真实依赖）。
"""

import importlib.util
import sys
import types
from pathlib import Path

import pytest
from fastapi.responses import JSONResponse

ROOT = Path(__file__).resolve().parents[1]


def _load_isolated_apimodules():
    pkg = types.ModuleType("ErisPulse_Dashboard")
    pkg.__path__ = [str(ROOT / "ErisPulse_Dashboard")]
    core = types.ModuleType("ErisPulse_Dashboard.Core")
    core.__path__ = [str(ROOT / "ErisPulse_Dashboard" / "Core")]
    sys.modules.setdefault("ErisPulse_Dashboard", pkg)
    sys.modules.setdefault("ErisPulse_Dashboard.Core", core)
    spec = importlib.util.spec_from_file_location(
        "ErisPulse_Dashboard.Core.ApiModules",
        ROOT / "ErisPulse_Dashboard" / "Core" / "ApiModules.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["ErisPulse_Dashboard.Core.ApiModules"] = module
    spec.loader.exec_module(module)
    return module


_api_modules = _load_isolated_apimodules()
ApiModulesMixin = _api_modules.ApiModulesMixin


class _FakeFile:
    def __init__(self, data: bytes, filename: str):
        self._data = data
        self.filename = filename

    async def read(self) -> bytes:
        return self._data


class _StubModuleManager:
    """SDK 2.11 桩：仅基础影子能力（无 ingest / persist）"""

    def __init__(self):
        self.calls: list[str] = []

    def shadow_start(self, *a, **k):
        self.calls.append("shadow_start")

    def promote_shadow(self, *a, **k):
        self.calls.append("promote_shadow")

    def dismiss_shadow(self, *a, **k):
        self.calls.append("dismiss_shadow")

    def shadow_diff(self, *a, **k):
        self.calls.append("shadow_diff")
        return {"shadow_owner": None, "count": 0, "aligned": []}


class _ModernModuleManager(_StubModuleManager):
    """SDK 2.12+ 桩：基础能力 + whl 摄取 / 持久化"""

    def __init__(self):
        super().__init__()
        self.ingest_calls: list[dict] = []
        self.persist_calls: list[dict] = []

    def shadow_ingest_whl(self, name, *, data, filename):
        self.ingest_calls.append({"name": name, "data": data, "filename": filename})
        return {"source": f"shadows/{name}/ts/pkg", "whl_path": f"shadows/{name}/ts/pkg.whl"}

    async def shadow_promote_persist(self, name, *, whl_path):
        self.persist_calls.append({"name": name, "whl_path": whl_path})
        return {"task_id": "sp_abc", "promoted": True}

    def shadow_persist_status(self, task_id):
        return {"status": "success", "task_id": task_id}


class _StubDashboard(ApiModulesMixin):
    def __init__(self, modern: bool = True):
        self.audit: list[tuple] = []
        self.sdk = types.SimpleNamespace(
            module=_ModernModuleManager() if modern else _StubModuleManager()
        )

    def _add_audit_log(self, action, detail, request=None):
        self.audit.append((action, detail))


def _make_form_request(file):
    async def form():
        return {"file": file}

    return types.SimpleNamespace(path_params={"name": "MyModule"}, form=form)


def _make_json_request(body):
    async def json_body():
        return body

    return types.SimpleNamespace(path_params={"name": "MyModule"}, json=json_body)


@pytest.mark.asyncio
class TestShadowThinShell:
    async def test_upload_forwards_to_sdk(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        dash = _StubDashboard(modern=True)
        file = _FakeFile(b"PK", "fakepkg-1.0.0-py3-none-any.whl")
        response = await dash._api_module_shadow_upload(_make_form_request(file))
        assert isinstance(response, JSONResponse)
        assert dash.sdk.module.ingest_calls == [
            {
                "name": "MyModule",
                "data": b"PK",
                "filename": "fakepkg-1.0.0-py3-none-any.whl",
            }
        ]

    async def test_upload_legacy_sdk_uses_local_fallback(self, tmp_path, monkeypatch):
        import io
        import zipfile

        monkeypatch.chdir(tmp_path)
        dash = _StubDashboard(modern=False)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("fakepkg/__init__.py", "VALUE = 1\n")
        file = _FakeFile(buf.getvalue(), "fakepkg-1.0.0-py3-none-any.whl")
        response = await dash._api_module_shadow_upload(_make_form_request(file))
        assert isinstance(response, JSONResponse)
        import json

        payload = json.loads(response.body)
        assert payload["success"] is True
        # 本地降级：whl 原件落盘，source 为解包目录
        from pathlib import Path

        assert Path(payload["source"]).is_dir()
        assert Path(payload["whl_path"]).is_file()

    async def test_missing_file_rejected_without_sdk_call(self):
        dash = _StubDashboard()

        async def empty_form():
            return {}

        request = types.SimpleNamespace(path_params={"name": "MyModule"}, form=empty_form)
        response = await dash._api_module_shadow_upload(request)
        assert response.status_code == 400
        assert not getattr(dash.sdk.module, "ingest_calls", [])

    async def test_promote_persist_forwards_to_sdk(self):
        dash = _StubDashboard(modern=True)
        response = await dash._shadow_promote_persist(
            "MyModule", {"whl_path": "shadows/MyModule/ts/pkg.whl"}, None
        )
        assert isinstance(response, JSONResponse)
        assert dash.sdk.module.persist_calls == [
            {"name": "MyModule", "whl_path": "shadows/MyModule/ts/pkg.whl"}
        ]

    async def test_promote_persist_requires_whl_path(self):
        dash = _StubDashboard(modern=True)
        response = await dash._shadow_promote_persist("MyModule", {}, None)
        assert response.status_code == 400
        assert not dash.sdk.module.persist_calls

    async def test_promote_persist_legacy_sdk_501(self):
        dash = _StubDashboard(modern=False)
        response = await dash._shadow_promote_persist(
            "MyModule", {"whl_path": "x"}, None
        )
        assert response.status_code == 501

    async def test_sdk_errors_surface_as_400(self):
        dash = _StubDashboard(modern=True)

        class _Boom:
            def shadow_ingest_whl(self, *a, **k):
                return {}

            def shadow_persist_status(self, task_id):
                return None

            async def shadow_promote_persist(self, name, *, whl_path):
                raise ValueError("whl_path outside module shadows dir")

        dash.sdk.module = _Boom()
        response = await dash._shadow_promote_persist(
            "MyModule", {"whl_path": "x"}, None
        )
        assert response.status_code == 400


def test_caps_probe_two_levels():
    modern = _StubDashboard(modern=True)
    assert modern._shadow_supported() is True
    assert modern._shadow_persist_supported() is True

    legacy = _StubDashboard(modern=False)
    # 旧 SDK：基础影子可用（功能不退化），持久化能力不可用
    assert legacy._shadow_supported() is True
    assert legacy._shadow_persist_supported() is False
