"""包管理命令的拼装：uv 后端必须显式指定目标解释器。

uv 默认按 cwd / VIRTUAL_ENV 探测目标环境，与运行中的进程对不上时会把包装进
别的环境——装完当前进程照样导不到（cwd 里有别的 .venv、从别的工作目录启动、
Windows 更新在新控制台里执行，都会这样）。这里锁死：uv 命令带 --python 且紧跟
在子命令之后（放到子命令前面 uv 直接报 unexpected argument），目标不在虚拟
环境里时再带 --system；pip 后端的命令里本身带解释器，不加这两个参数。
"""

import importlib.util
import os
import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _load_isolated():
    """按文件路径装载 PackageManager；SDK 相关导入用桩模块顶替，不触发框架初始化"""
    pkg = types.ModuleType("ErisPulse_Dashboard")
    pkg.__path__ = [str(ROOT / "ErisPulse_Dashboard")]
    core = types.ModuleType("ErisPulse_Dashboard.Core")
    core.__path__ = [str(ROOT / "ErisPulse_Dashboard" / "Core")]
    sys.modules.setdefault("ErisPulse_Dashboard", pkg)
    sys.modules.setdefault("ErisPulse_Dashboard.Core", core)

    stubs = {}
    for name in ("ErisPulse", "ErisPulse.Core", "ErisPulse.Core.Bases", "ErisPulse.finders"):
        if name not in sys.modules:
            stubs[name] = sys.modules[name] = types.ModuleType(name)
    errors = sys.modules.setdefault(
        "ErisPulse.Core.Bases.errors", types.ModuleType("ErisPulse.Core.Bases.errors")
    )
    errors.ClientError = type("ClientError", (Exception,), {})
    sys.modules["ErisPulse.Core"].client = types.SimpleNamespace()
    for finder in ("AdapterFinder", "ModuleFinder"):
        setattr(sys.modules["ErisPulse.finders"], finder, type(finder, (), {}))

    spec = importlib.util.spec_from_file_location(
        "ErisPulse_Dashboard.Core.PackageManager",
        ROOT / "ErisPulse_Dashboard" / "Core" / "PackageManager.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["ErisPulse_Dashboard.Core.PackageManager"] = module
    try:
        spec.loader.exec_module(module)
    finally:
        # 桩只服务这一次装载，不留在 sys.modules 里影响别的用例
        for name in stubs:
            sys.modules.pop(name, None)
    return module


_m = _load_isolated()
DashboardPackageManager = _m.DashboardPackageManager


def _python_in(venv_dir: Path) -> Path:
    """虚拟环境里解释器的常规位置（Windows 在 Scripts/，其余在 bin/）"""
    return venv_dir / ("Scripts" if sys.platform == "win32" else "bin") / (
        "python.exe" if sys.platform == "win32" else "python"
    )


def _fake_venv(tmp_path: Path) -> Path:
    venv = tmp_path / "venv"
    python = _python_in(venv)
    python.parent.mkdir(parents=True)
    python.touch()
    (venv / "pyvenv.cfg").write_text("home = /usr\n", encoding="utf-8")
    return python


def _manager(monkeypatch, uv_command, target):
    # 跳过 __init__（会连存储、建模块查找器），只装上拼命令要用的状态
    manager = DashboardPackageManager.__new__(DashboardPackageManager)
    manager._uv_checked = True
    manager._uv_command = uv_command
    manager.no_uv = False
    monkeypatch.setenv("ERISPULSE_NO_UV", "")
    monkeypatch.setattr(manager, "_get_target_python", lambda: str(target))
    monkeypatch.setattr(manager, "_ensure_pip", lambda _python: True)
    return manager


class TestPipCommand:
    def test_uv_installs_into_the_target_interpreter(self, monkeypatch, tmp_path):
        python = _fake_venv(tmp_path)
        manager = _manager(monkeypatch, ["uv"], python)
        cmd = manager.pip_command(
            "install", "--index-url", "https://example.invalid/simple", "aiomysql"
        )
        assert cmd == [
            "uv", "pip", "install",
            "--python", str(python),
            "--index-url", "https://example.invalid/simple", "aiomysql",
        ]

    def test_python_dash_m_uv_backend(self, monkeypatch, tmp_path):
        python = _fake_venv(tmp_path)
        manager = _manager(monkeypatch, [sys.executable, "-m", "uv"], python)
        assert manager.pip_command("uninstall", "aiomysql") == [
            sys.executable, "-m", "uv", "pip", "uninstall", "--python", str(python), "aiomysql",
        ]

    def test_system_target_declares_itself(self, monkeypatch, tmp_path):
        python = tmp_path / "Python312" / "python.exe"
        manager = _manager(monkeypatch, ["uv"], python)
        assert manager.pip_command("install", "aiomysql") == [
            "uv", "pip", "install", "--python", str(python), "--system", "aiomysql",
        ]

    def test_pip_backend_already_carries_the_interpreter(self, monkeypatch, tmp_path):
        python = tmp_path / "Python312" / "python.exe"
        manager = _manager(monkeypatch, None, python)
        assert manager.pip_command("install", "aiomysql") == [
            str(python), "-m", "pip", "install", "aiomysql",
        ]

    def test_uv_disabled_falls_back_to_pip(self, monkeypatch, tmp_path):
        python = _fake_venv(tmp_path)
        manager = _manager(monkeypatch, ["uv"], python)
        manager.no_uv = True
        assert manager.pip_command("install", "aiomysql") == [
            str(python), "-m", "pip", "install", "aiomysql",
        ]

    def test_subcommand_comes_before_python_flag(self, monkeypatch, tmp_path):
        # uv pip --python X install 会报 unexpected argument
        python = _fake_venv(tmp_path)
        cmd = _manager(monkeypatch, ["uv"], python).pip_command("install", "aiomysql")
        assert cmd[:2] == ["uv", "pip"] and cmd[2] == "install" and cmd[3] == "--python"

    @pytest.mark.parametrize("subcommand", ["install", "uninstall"])
    def test_every_subcommand_gets_the_target(self, monkeypatch, tmp_path, subcommand):
        python = _fake_venv(tmp_path)
        cmd = _manager(monkeypatch, ["uv"], python).pip_command(subcommand, "aiomysql")
        assert cmd[3:5] == ["--python", str(python)]


class TestVenvDetection:
    def test_pyvenv_cfg_next_to_or_above_the_executable(self, tmp_path):
        assert DashboardPackageManager._in_venv(str(_fake_venv(tmp_path / "a")))
        # 可执行文件直接和 pyvenv.cfg 同级也算
        flat = tmp_path / "b"
        flat.mkdir()
        (flat / "pyvenv.cfg").touch()
        assert DashboardPackageManager._in_venv(str(flat / "python"))
        # 系统解释器：没有 pyvenv.cfg
        system = tmp_path / "c" / "Python312"
        system.mkdir(parents=True)
        assert not DashboardPackageManager._in_venv(str(system / "python.exe"))


class TestTargetPython:
    """目标解释器的既有口径不变：激活了别的虚拟环境就装进那个环境"""

    def _manager(self):
        return DashboardPackageManager.__new__(DashboardPackageManager)

    def test_without_virtual_env_targets_running_interpreter(self, monkeypatch):
        monkeypatch.delenv("VIRTUAL_ENV", raising=False)
        assert self._manager()._get_target_python() == sys.executable

    def test_activated_foreign_venv_is_honored(self, monkeypatch, tmp_path):
        venv = tmp_path / "activated"
        python = _python_in(venv)
        python.parent.mkdir(parents=True)
        python.touch()
        monkeypatch.setenv("VIRTUAL_ENV", str(venv))
        monkeypatch.setattr(sys, "executable", str(tmp_path / "elsewhere" / "python.exe"))
        assert os.path.normcase(self._manager()._get_target_python()) == os.path.normcase(
            str(python)
        )

    def test_running_inside_the_activated_venv(self, monkeypatch, tmp_path):
        python = _fake_venv(tmp_path)
        monkeypatch.setenv("VIRTUAL_ENV", str(tmp_path / "venv"))
        monkeypatch.setattr(sys, "executable", str(python))
        assert self._manager()._get_target_python() == str(python)
