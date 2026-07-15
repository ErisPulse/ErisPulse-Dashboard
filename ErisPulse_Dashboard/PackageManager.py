import importlib.metadata
import os
import shutil
import subprocess
import sys
import time
from typing import List, Optional

from ErisPulse.Core import client
from ErisPulse.Core.Bases.errors import ClientError
from ErisPulse.finders import AdapterFinder, ModuleFinder

REMOTE_SOURCES = [
    "https://erisdev.com/packages.json",
    "https://raw.githubusercontent.com/ErisPulse/ErisPulse/main/packages.json",
]

CACHE_EXPIRY = 3600


class DashboardPackageManager:
    def __init__(self, storage=None):
        self._remote_cache: Optional[dict] = None
        self._remote_cache_ts: float = 0
        self._installed_cache: Optional[dict] = None
        self._installed_cache_ts: float = 0
        self._updates_cache: Optional[list] = None
        self._updates_cache_ts: float = 0
        self._pypi_cache: dict[str, tuple[str, float]] = {}
        self._pypi_detail_cache: dict[str, tuple[dict, float]] = {}
        self._module_finder = ModuleFinder()
        self._adapter_finder = AdapterFinder()
        self._storage = storage
        self._git_packages: dict[str, dict] = {}
        self._load_git_packages()
        self._uv_command: Optional[List[str]] = None
        self._uv_checked: bool = False
        self.no_uv: bool = False

    def _load_git_packages(self):
        if self._storage:
            try:
                data = self._storage.get("__ep_git_packages__")
                if isinstance(data, dict):
                    self._git_packages = data
            except Exception:
                self._git_packages = {}

    def _save_git_packages(self):
        if self._storage:
            try:
                self._storage.set("__ep_git_packages__", self._git_packages)
            except Exception:
                pass

    # ─── 后端检测：uv 优先，pip 回退 ───

    def _is_uv_disabled(self) -> bool:
        """是否禁用 uv：no_uv 属性优先，其次环境变量 ERISPULSE_NO_UV"""
        if getattr(self, "no_uv", False):
            return True
        return str(os.environ.get("ERISPULSE_NO_UV", "")).lower() in (
            "1",
            "true",
            "yes",
        )

    def _detect_uv(self) -> Optional[List[str]]:
        """
        检测可用的 uv 命令。

        优先使用 PATH 上的独立 uv 二进制，
        其次回退到 python -m uv。

        :return: 形如 ["uv"] 或 [python, "-m", "uv"] 的命令前缀；未找到返回 None
        """
        if self._uv_checked:
            return self._uv_command

        self._uv_checked = True

        # 1. 独立的 uv 二进制（最常见，全局安装）
        if shutil.which("uv"):
            self._uv_command = ["uv"]
            return self._uv_command

        # 2. 作为 pip 包安装的 uv: python -m uv
        try:
            result = subprocess.run(
                [sys.executable, "-m", "uv", "--version"],
                capture_output=True,
                timeout=5,
            )
            if result.returncode == 0:
                self._uv_command = [sys.executable, "-m", "uv"]
        except Exception:
            pass

        return self._uv_command

    def _get_uv_command(self) -> Optional[List[str]]:
        """返回应使用的 uv 命令前缀；禁用或不可用时返回 None"""
        if self._is_uv_disabled():
            return None
        return self._detect_uv()

    def _get_target_python(self) -> str:
        """
        返回应当作为安装目标的 Python 解释器路径。

        若用户激活了虚拟环境 (VIRTUAL_ENV) 但 Dashboard 自身运行在别处，
        则返回该虚拟环境的 Python，以确保包安装到用户期望的环境中。
        """
        venv = os.environ.get("VIRTUAL_ENV")
        if not venv:
            return sys.executable

        # Dashboard 已在该虚拟环境内运行
        try:
            venv_root = os.path.normcase(os.path.abspath(venv)) + os.sep
            exe_root = os.path.normcase(os.path.abspath(sys.executable))
            if exe_root.startswith(venv_root):
                return sys.executable
        except Exception:
            pass

        # 定位虚拟环境的 python
        if sys.platform == "win32":
            candidate = os.path.join(venv, "Scripts", "python.exe")
        else:
            candidate = os.path.join(venv, "bin", "python")

        return candidate if os.path.exists(candidate) else sys.executable

    def _build_subprocess_env(self) -> dict:
        """构建子进程环境变量，继承当前环境"""
        return os.environ.copy()

    def _ensure_pip(self, target_python: str) -> bool:
        """
        确保目标 Python 环境中有 pip 可用。
        
        若 python -m pip 不可用，尝试通过 ensurepip 引导安装。
        这是 Python 3.4+ 内置模块，用于修复 venv 缺少 pip 的情况。

        :return: 现在 pip 是否可用
        """
        # 先试试 pip 是否已经可用
        try:
            result = subprocess.run(
                [target_python, "-m", "pip", "--version"],
                capture_output=True,
                timeout=10,
            )
            if result.returncode == 0:
                return True
        except Exception:
            pass

        # pip 不可用，尝试 ensurepip 引导安装
        try:
            result = subprocess.run(
                [target_python, "-m", "ensurepip", "--default-pip"],
                capture_output=True,
                timeout=60,
            )
            if result.returncode == 0:
                return True
        except Exception:
            pass

        return False

    def get_pip_backend(self) -> List[str]:
        """
        返回 pip 操作的命令前缀。

        优先级：uv pip > python -m pip
        当 uv 可用时返回 [uv, pip]，否则返回 [target_python, -m, pip]。
        回退到 pip 前会自动 ensurepip 确保 pip 可用。

        :return: 可用于 subprocess 的命令前缀列表
        """
        uv_cmd = self._get_uv_command()
        if uv_cmd:
            return uv_cmd + ["pip"]

        # 回退 pip：先确保 venv 里有 pip（处理 --without-pip 创建的 venv）
        target_python = self._get_target_python()
        self._ensure_pip(target_python)
        return [target_python, "-m", "pip"]

    def is_using_uv(self) -> bool:
        """
        判断当前 pip 后端是否为 uv。

        uv 的 uninstall 命令不支持 -y 参数（本身即为非交互式），
        需要据此调整命令构造。

        :return: bool 是否使用 uv 作为 pip 后端
        """
        return self._get_uv_command() is not None

    def register_git_package(
        self, package_name: str, git_url: str, installed_version: str = ""
    ):
        self._git_packages[package_name.lower()] = {
            "name": package_name,
            "git_url": git_url,
            "installed_version": installed_version,
            "installed_at": time.time(),
        }
        self._save_git_packages()

    def remove_git_package(self, package_name: str):
        self._git_packages.pop(package_name.lower(), None)
        self._save_git_packages()

    def get_git_packages(self) -> dict:
        return dict(self._git_packages)

    def is_git_package(self, package_name: str) -> bool:
        return package_name.lower() in self._git_packages

    async def check_git_updates(self) -> list[dict]:
        updates = []
        for pkg_key, info in self._git_packages.items():
            git_url = info.get("git_url", "")
            installed_ver = info.get("installed_version", "")
            latest_commit = await self._get_git_latest_commit(git_url)
            if latest_commit and latest_commit != installed_ver:
                updates.append(
                    {
                        "name": info.get("name", pkg_key),
                        "current": installed_ver[:12] if installed_ver else "",
                        "latest": latest_commit[:12],
                        "source": "git",
                        "git_url": git_url,
                    }
                )
        return updates

    async def _get_git_latest_commit(self, git_url: str) -> Optional[str]:
        import asyncio

        def _fetch():
            try:
                import subprocess

                result = subprocess.run(
                    ["git", "ls-remote", git_url, "HEAD"],
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.split()[0]
            except Exception:
                pass
            return None

        return await asyncio.get_event_loop().run_in_executor(None, _fetch)

    def invalidate_caches(self):
        self._installed_cache = None
        self._updates_cache = None
        self._remote_cache = None
        self._module_finder.clear_cache()
        self._adapter_finder.clear_cache()

    async def get_remote_packages(self, force: bool = False) -> dict:
        if (
            not force
            and self._remote_cache
            and time.time() - self._remote_cache_ts < CACHE_EXPIRY
        ):
            return self._remote_cache

        result = {"modules": {}, "adapters": {}}
        for url in REMOTE_SOURCES:
            try:
                data = await self._fetch_json(url)
                if data and ("modules" in data or "adapters" in data):
                    result["modules"].update(data.get("modules", {}))
                    result["adapters"].update(data.get("adapters", {}))
                    break
            except Exception:
                continue

        self._remote_cache = result
        self._remote_cache_ts = time.time()
        return result

    async def _fetch_json(self, url: str) -> Optional[dict]:
        try:
            resp = await client.get(
                url,
                headers={"User-Agent": "ErisPulse-Dashboard/1.0"},
                timeout=10,
            )
            return await resp.json()
        except ClientError:
            return None

    def get_installed_packages(self, force: bool = False) -> dict:
        if (
            not force
            and self._installed_cache
            and time.time() - self._installed_cache_ts < 300
        ):
            return self._installed_cache

        self._module_finder.clear_cache()
        self._adapter_finder.clear_cache()

        module_pkgs = {}
        for entry in self._module_finder.find_all():
            if hasattr(entry, "dist") and entry.dist:
                pkg_name = entry.dist.name
                module_pkgs[pkg_name] = {
                    "name": entry.name,
                    "package": pkg_name,
                    "version": entry.dist.version,
                    "summary": entry.dist.metadata.get("Summary", ""),
                    "type": "module",
                }

        adapter_pkgs = {}
        for entry in self._adapter_finder.find_all():
            if hasattr(entry, "dist") and entry.dist:
                pkg_name = entry.dist.name
                adapter_pkgs[pkg_name] = {
                    "name": entry.name,
                    "package": pkg_name,
                    "version": entry.dist.version,
                    "summary": entry.dist.metadata.get("Summary", ""),
                    "type": "adapter",
                }

        erispulse_pkgs = {}
        for key in set(list(module_pkgs.keys()) + list(adapter_pkgs.keys())):
            info = module_pkgs.get(key) or adapter_pkgs.get(key)
            combined = dict(info)
            if key in module_pkgs and key in adapter_pkgs:
                combined["type"] = "module+adapter"
            erispulse_pkgs[key] = combined

        all_pkgs = {}
        try:
            for dist in importlib.metadata.distributions():
                name = dist.metadata["Name"]
                version = dist.metadata["Version"]
                summary = dist.metadata.get("Summary", "")
                if name in erispulse_pkgs:
                    all_pkgs[name] = {
                        "name": name,
                        "version": version,
                        "summary": summary,
                        "is_module": erispulse_pkgs[name]["type"]
                        in ("module", "module+adapter"),
                        "is_adapter": erispulse_pkgs[name]["type"]
                        in ("adapter", "module+adapter"),
                        "ep_names": erispulse_pkgs[name].get("name", ""),
                    }
                else:
                    all_pkgs[name] = {
                        "name": name,
                        "version": version,
                        "summary": summary,
                        "is_module": False,
                        "is_adapter": False,
                        "ep_names": "",
                    }
        except Exception:
            pass

        packages = sorted(
            all_pkgs.values(),
            key=lambda p: (not p["is_module"], not p["is_adapter"], p["name"].lower()),
        )
        result = {"packages": packages, "total": len(packages)}
        self._installed_cache = result
        self._installed_cache_ts = time.time()
        return result

    def get_installed_versions(self) -> dict[str, str]:
        versions = {}
        try:
            for dist in importlib.metadata.distributions():
                name = dist.metadata["Name"]
                version = dist.metadata["Version"]
                versions[name.lower()] = version
        except Exception:
            pass
        return versions

    async def check_updates(self, force: bool = False) -> list[dict]:
        if (
            not force
            and self._updates_cache
            and time.time() - self._updates_cache_ts < 300
        ):
            return self._updates_cache

        installed = self.get_installed_packages(force)
        packages = installed.get("packages", [])
        erispulse_pkgs = [p for p in packages if p["is_module"] or p["is_adapter"]]

        updates = []

        remote = await self.get_remote_packages(force)
        remote_index = {}
        for pkg_type in ("modules", "adapters"):
            for name, info in remote.get(pkg_type, {}).items():
                pkg_name = info.get("package", "")
                if pkg_name:
                    remote_index[pkg_name.lower()] = info.get("version", "")

        for pkg in erispulse_pkgs:
            current = pkg["version"]
            pkg_lower = pkg["name"].lower()
            remote_ver = remote_index.get(pkg_lower)
            if remote_ver and self._compare_versions(remote_ver, current) > 0:
                updates.append(
                    {
                        "name": pkg["name"],
                        "current": current,
                        "latest": remote_ver,
                        "source": "registry",
                    }
                )
                continue

            latest = await self._get_pypi_version(pkg["name"])
            if latest and self._compare_versions(latest, current) > 0:
                updates.append(
                    {
                        "name": pkg["name"],
                        "current": current,
                        "latest": latest,
                        "source": "pypi",
                    }
                )

        self._updates_cache = updates
        self._updates_cache_ts = time.time()
        return updates

    async def _get_pypi_version(self, package_name: str) -> Optional[str]:
        cache_key = package_name.lower()
        if cache_key in self._pypi_cache:
            ver, ts = self._pypi_cache[cache_key]
            if time.time() - ts < CACHE_EXPIRY:
                return ver

        try:
            url = f"https://pypi.org/pypi/{package_name}/json"
            resp = await client.get(
                url,
                headers={"User-Agent": "ErisPulse-Dashboard/1.0"},
                timeout=10,
            )
            data = await resp.json()
            version = data.get("info", {}).get("version")
            if version:
                self._pypi_cache[cache_key] = (version, time.time())
            return version
        except ClientError:
            return None

    @staticmethod
    def _compare_versions(v1: str, v2: str) -> int:
        try:
            from packaging.version import parse as vp

            pv1, pv2 = vp(v1), vp(v2)
            return (pv1 > pv2) - (pv1 < pv2)
        except Exception:
            return (v1 > v2) - (v1 < v2)

    async def get_store_data(self, force: bool = False) -> dict:
        remote = await self.get_remote_packages(force)
        installed_versions = self.get_installed_versions()
        return {"packages": remote, "installed_versions": installed_versions}

    async def get_package_detail(self, package_name: str) -> dict:
        cache_key = package_name.lower()
        if cache_key in self._pypi_detail_cache:
            data, ts = self._pypi_detail_cache[cache_key]
            if time.time() - ts < 300:
                return data

        try:
            url = f"https://pypi.org/pypi/{package_name}/json"
            resp = await client.get(
                url,
                headers={"User-Agent": "ErisPulse-Dashboard/1.0"},
                timeout=15,
            )
            pypi_data = await resp.json()
        except ClientError:
            pypi_data = None

        installed_versions = self.get_installed_versions()
        installed_version = installed_versions.get(package_name.lower(), "")

        remote = self._remote_cache or {}
        registry_info = None
        for pkg_type in ("modules", "adapters"):
            for name, info in remote.get(pkg_type, {}).items():
                if info.get("package", "").lower() == package_name.lower():
                    registry_info = info
                    registry_info["registry_type"] = pkg_type.rstrip("s")
                    break
            if registry_info:
                break

        if not pypi_data:
            result = {
                "name": package_name,
                "summary": registry_info.get("description", "")
                if registry_info
                else "",
                "description": registry_info.get("description", "")
                if registry_info
                else "",
                "requires_dist": [],
                "versions": [],
                "installed_version": installed_version,
                "latest_version": "",
                "home_page": "",
                "registry_info": registry_info,
            }
            return result

        info = pypi_data.get("info", {})
        releases = pypi_data.get("releases", {})
        versions = sorted(
            releases.keys(),
            key=lambda v: self._compare_versions(v, "0.0.0"),
            reverse=True,
        )

        result = {
            "name": info.get("name", package_name),
            "summary": info.get("summary", ""),
            "description": info.get("description", "") or info.get("summary", ""),
            "requires_dist": info.get("requires_dist") or [],
            "versions": versions[:30],
            "installed_version": installed_version,
            "latest_version": info.get("version", ""),
            "home_page": info.get("home_page", "") or info.get("project_url", ""),
            "project_urls": info.get("project_urls") or {},
            "license": info.get("license", ""),
            "author": info.get("author", ""),
            "registry_info": registry_info,
        }

        self._pypi_detail_cache[cache_key] = (result, time.time())
        return result
