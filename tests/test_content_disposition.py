"""_content_disposition 纯函数单测。

零配置：`python -m pytest tests/ -q` 或 `python tests/test_content_disposition.py` 均可直跑。
包 __init__ 会连带初始化 ErisPulse SDK，这里用 stub 父包按文件路径隔离装载 ApiFiles，
不触发 SDK 导入（Constants 以空桩替代，fastapi 为真实依赖）。
"""

import importlib.util
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_isolated_apifiles():
    pkg = types.ModuleType("ErisPulse_Dashboard")
    pkg.__path__ = [str(ROOT / "ErisPulse_Dashboard")]
    core = types.ModuleType("ErisPulse_Dashboard.Core")
    core.__path__ = [str(ROOT / "ErisPulse_Dashboard" / "Core")]
    constants = types.ModuleType("ErisPulse_Dashboard.Core.Constants")
    constants.MAX_READ_SIZE = 0
    constants.MAX_UPLOAD_SIZE = 0
    constants.SENSITIVE_FILES = set()
    sys.modules["ErisPulse_Dashboard"] = pkg
    sys.modules["ErisPulse_Dashboard.Core"] = core
    sys.modules["ErisPulse_Dashboard.Core.Constants"] = constants
    spec = importlib.util.spec_from_file_location(
        "ErisPulse_Dashboard.Core.ApiFiles",
        ROOT / "ErisPulse_Dashboard" / "Core" / "ApiFiles.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["ErisPulse_Dashboard.Core.ApiFiles"] = module
    spec.loader.exec_module(module)
    return module


_content_disposition = _load_isolated_apifiles()._content_disposition


def test_ascii_name_unchanged():
    assert _content_disposition("archive.zip") == 'attachment; filename="archive.zip"'


def test_chinese_name_rfc5987_and_latin1_safe():
    value = _content_disposition("ErisPulse_hot_reload_修改说明书.md")
    value.encode("latin-1")  # HTTP 头必须 latin-1 可编码，抛错即失败
    assert "filename*=UTF-8''" in value
    assert "%E4%BF%AE" in value  # 「修」的 UTF-8 百分号编码
    extended = value.split("filename*=UTF-8''", 1)[1]
    assert " " not in extended  # 参数值内不得有裸空格（须编码为 %20）
    assert value.count('"') == 2  # 仅 fallback filename 一对引号，filename* 不带引号


def test_header_injection_neutralized():
    value = _content_disposition('x"\r\nEvil: 1')
    value.encode("latin-1")
    assert "\r" not in value and "\n" not in value
    assert "Evil: 1" not in value
    assert value.count('"') == 2


def test_space_in_ascii_name_also_encoded():
    value = _content_disposition("report final.md")
    assert value != 'attachment; filename="report final.md"'
    assert "filename*=UTF-8''report%20final.md" in value
    value.encode("latin-1")


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(list(globals().items())):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as e:
                failures += 1
                print(f"FAIL {name}: {e}")
    sys.exit(1 if failures else 0)
