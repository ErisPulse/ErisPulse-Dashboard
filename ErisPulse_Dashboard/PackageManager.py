import importlib.metadata
import json
import subprocess
import sys
import time
import urllib.request
import urllib.error
from typing import Optional

from ErisPulse.finders import ModuleFinder, AdapterFinder


REMOTE_SOURCES = [
    "https://erisdev.com/packages.json",
    "https://raw.githubusercontent.com/ErisPulse/ErisPulse/main/packages.json",
]

CACHE_EXPIRY = 3600


class DashboardPackageManager:

    def __init__(self):
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

    def invalidate_caches(self):
        self._installed_cache = None
        self._updates_cache = None
        self._remote_cache = None
        self._module_finder.clear_cache()
        self._adapter_finder.clear_cache()

    async def get_remote_packages(self, force: bool = False) -> dict:
        if not force and self._remote_cache and time.time() - self._remote_cache_ts < CACHE_EXPIRY:
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
        import asyncio

        def _sync_fetch():
            req = urllib.request.Request(url, headers={"User-Agent": "ErisPulse-Dashboard/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))

        return await asyncio.get_event_loop().run_in_executor(None, _sync_fetch)

    def get_installed_packages(self, force: bool = False) -> dict:
        if not force and self._installed_cache and time.time() - self._installed_cache_ts < 300:
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
                        "is_module": erispulse_pkgs[name]["type"] in ("module", "module+adapter"),
                        "is_adapter": erispulse_pkgs[name]["type"] in ("adapter", "module+adapter"),
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
        if not force and self._updates_cache and time.time() - self._updates_cache_ts < 300:
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
                updates.append({
                    "name": pkg["name"],
                    "current": current,
                    "latest": remote_ver,
                    "source": "registry",
                })
                continue

            latest = await self._get_pypi_version(pkg["name"])
            if latest and self._compare_versions(latest, current) > 0:
                updates.append({
                    "name": pkg["name"],
                    "current": current,
                    "latest": latest,
                    "source": "pypi",
                })

        self._updates_cache = updates
        self._updates_cache_ts = time.time()
        return updates

    async def _get_pypi_version(self, package_name: str) -> Optional[str]:
        import asyncio

        cache_key = package_name.lower()
        if cache_key in self._pypi_cache:
            ver, ts = self._pypi_cache[cache_key]
            if time.time() - ts < CACHE_EXPIRY:
                return ver

        def _fetch():
            url = f"https://pypi.org/pypi/{package_name}/json"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "ErisPulse-Dashboard/1.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data.get("info", {}).get("version")
            except Exception:
                return None

        version = await asyncio.get_event_loop().run_in_executor(None, _fetch)
        if version:
            self._pypi_cache[cache_key] = (version, time.time())
        return version

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
        import asyncio

        cache_key = package_name.lower()
        if cache_key in self._pypi_detail_cache:
            data, ts = self._pypi_detail_cache[cache_key]
            if time.time() - ts < 300:
                return data

        def _fetch():
            url = f"https://pypi.org/pypi/{package_name}/json"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "ErisPulse-Dashboard/1.0"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except Exception:
                return None

        pypi_data = await asyncio.get_event_loop().run_in_executor(None, _fetch)

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
                "summary": registry_info.get("description", "") if registry_info else "",
                "description": registry_info.get("description", "") if registry_info else "",
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
