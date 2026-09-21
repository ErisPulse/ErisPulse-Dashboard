"""ApiFrameworkMixin：框架版本查询与自升级、重启 API"""

import asyncio
import os
import secrets
import subprocess
import sys
import threading
import time

from ErisPulse.Core import client
from ErisPulse.Core.Bases.errors import ClientError
from fastapi import Request
from fastapi.responses import JSONResponse

from .Helpers import _CoreHelpers


class ApiFrameworkMixin:
    """框架版本 / 更新日志查询、框架自升级与进程重启 API。"""


    async def _api_restart(self, request: Request) -> JSONResponse:

        async def _delayed_restart():
            await asyncio.sleep(0.5)
            if hasattr(self.sdk, "hard_restart"):
                await self.sdk.hard_restart()
            else:
                await self.sdk.restart()

        self._add_audit_log("restart_framework", "", request)
        asyncio.create_task(_delayed_restart())
        return JSONResponse({"success": True})

    async def _api_framework_versions(self, request: Request) -> JSONResponse:

        notes_ver = request.query_params.get("notes", "")
        if notes_ver:
            return await self._get_release_notes(notes_ver)

        pre = request.query_params.get("pre", "") == "true"
        current = self._get_framework_info()["version"]
        versions = await self._fetch_pypi_versions("ErisPulse", pre)
        can_update = sys.platform != "win32"
        error = (
            None
            if versions
            else "无法获取版本列表，请前往 GitHub Releases 查看更新 https://github.com/ErisPulse/ErisPulse/releases"
        )

        return JSONResponse(
            {
                "current": current,
                "versions": versions,
                "can_update": can_update,
                "platform": sys.platform,
                "error": error,
            }
        )

    async def _get_release_notes(self, version: str) -> JSONResponse:
        """多源获取发行说明，支持 GitHub 官方 / ghproxy / fastgit 镜像"""
        from ErisPulse.Core import client
        from ErisPulse.Core.Bases.errors import ClientError

        headers = {"Accept": "application/vnd.github.v3+json"}

        # 标签查询（多源回退）
        tag_sources = [
            f"https://api.github.com/repos/ErisPulse/ErisPulse/releases/tags/v{version}",
            f"https://ghproxy.net/https://api.github.com/repos/ErisPulse/ErisPulse/releases/tags/v{version}",
            f"https://ghfast.top/https://api.github.com/repos/ErisPulse/ErisPulse/releases/tags/v{version}",
        ]

        for url in tag_sources:
            try:
                resp = await client.get(url, headers=headers, timeout=8)
                if resp.status == 200:
                    try:
                        data = await resp.json()
                        body = data.get("body", "") or ""
                        self.logger.info(
                            f"Release notes fetched from {url}, {len(body)} chars"
                        )
                        return JSONResponse({"notes": body[:10000]})
                    except Exception as e:
                        self.logger.debug(f"JSON parse failed for {url}: {e}")
                        continue
                else:
                    try:
                        detail = await resp.text()
                    except Exception:
                        detail = "<read failed>"
                    self.logger.debug(
                        f"GitHub API returned {resp.status} for {url}: {detail[:200]}"
                    )
            except ClientError as e:
                self.logger.debug(f"GitHub fetch failed for {url}: {e}")
                continue

        # 列表查询回退
        list_sources = [
            "https://api.github.com/repos/ErisPulse/ErisPulse/releases?per_page=30",
            "https://ghproxy.net/https://api.github.com/repos/ErisPulse/ErisPulse/releases?per_page=30",
            "https://ghfast.top/https://api.github.com/repos/ErisPulse/ErisPulse/releases?per_page=30",
        ]
        for url in list_sources:
            try:
                resp = await client.get(url, headers=headers, timeout=10)
                if resp.status == 200:
                    try:
                        releases = await resp.json()
                        for rel in releases:
                            tag = rel.get("tag_name", "")
                            if tag in [version, f"v{version}"]:
                                body = rel.get("body", "") or ""
                                return JSONResponse({"notes": body[:10000]})
                    except Exception as e:
                        self.logger.debug(
                            f"GitHub list JSON parse failed for {url}: {e}"
                        )
                        continue
                else:
                    try:
                        detail = await resp.text()
                    except Exception:
                        detail = "<read failed>"
                    self.logger.debug(
                        f"GitHub list API returned {resp.status} for {url}: {detail[:200]}"
                    )
            except ClientError as e:
                self.logger.debug(f"GitHub list fetch failed for {url}: {e}")
                continue

        self.logger.warning(
            f"所有 GitHub API 源均失败，请手动查看: "
            f"https://github.com/ErisPulse/ErisPulse/releases/tag/v{version}"
        )
        return JSONResponse(
            {
                "notes": "",
                "github_url": f"https://github.com/ErisPulse/ErisPulse/releases/tag/v{version}",
            }
        )

    async def _fetch_pypi_versions(self, package: str, pre: bool = False) -> list[str]:
        import re

        try:
            url = f"https://pypi.org/pypi/{package}/json"
            self.logger.debug(f"Fetching PyPI versions from: {url}")
            resp = await client.get(
                url,
                headers={"User-Agent": "ErisPulse-Dashboard/2.0"},
                timeout=10,
            )
            data = await resp.json()
        except ClientError as e:
            self.logger.warning(f"Failed to fetch PyPI versions for {package}: {e}")
            return []
        releases = data.get("releases", {})
        all_versions = []
        for ver, files in releases.items():
            if not files:
                continue
            if not pre and re.search(r"(a|alpha|b|beta|rc|dev|preview)", ver, re.I):
                continue
            all_versions.append(ver)
        all_versions.sort(key=_CoreHelpers._pep440_sort_key, reverse=True)
        return all_versions[:50]

    async def _api_framework_update(self, request: Request) -> JSONResponse:
        body = await request.json()
        version = body.get("version", "")
        lang = body.get("lang", "en")
        if not version:
            return JSONResponse({"error": "version required"}, status_code=400)
        task_id = secrets.token_urlsafe(8)

        if sys.platform == "win32":
            self._run_framework_update_windows(f"ErisPulse=={version}", task_id, lang)
        else:
            t = threading.Thread(
                target=self._run_pip_install,
                args=([f"ErisPulse=={version}"], task_id, True, None),
                daemon=True,
            )
            t.start()

        self._add_audit_log("framework_update", f"ErisPulse=={version}", request)
        return JSONResponse({"success": True, "task_id": task_id})

    def _run_framework_update_windows(self, package_spec: str, task_id: str, lang: str = "en"):
        """Windows 更新：新控制台窗口执行，随后退出 Dashboard 进程释放文件锁"""
        self._install_tasks[task_id] = {
            "status": "running",
            "started_at": time.time(),
            "packages": [package_spec],
        }

        backend = self._get_pkg_manager().get_pip_backend()

        update_script = f'''
import subprocess, sys, time, os

MSG = {{
    "zh": {{"ok": "更新成功! 请手动重启 ErisPulse。", "fail": "更新失败:", "err": "出错:", "close": "按任意键关闭..."}},
    "en": {{"ok": "Update successful! Please restart ErisPulse manually.", "fail": "Update failed:", "err": "Error:", "close": "Press any key to close..."}},
}}
lang = os.environ.get("EP_LANG", "")
if lang.startswith("zh"):
    m = MSG["zh"]
else:
    m = MSG["en"]

time.sleep(10)
cmd = {backend + ["install", "--upgrade", package_spec]!r}
try:
    result = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", timeout=300
    )
    if result.returncode == 0:
        print(m["ok"])
    else:
        print(m["fail"], (result.stderr or "")[-800:])
except Exception as e:
    print(m["err"], e)
print("\\n" + m["close"])
try:
    input()
except Exception:
    pass
try:
    os.remove(__file__)
except Exception:
    pass
'''
        import tempfile
        script_path = os.path.join(tempfile.gettempdir(), "ep_fw_update.py")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(update_script)

        try:
            subprocess.Popen(
                ["cmd", "/c", "start", "ErisPulse Update", sys.executable, script_path],
                creationflags=subprocess.CREATE_NEW_CONSOLE,
                env={**os.environ, "EP_LANG": lang},
            )
        except Exception as e:
            self.logger.error(f"Windows update spawn failed: {e}")
            self._install_tasks[task_id]["status"] = "error"
            self._install_tasks[task_id]["error"] = str(e)
            return

        self._install_tasks[task_id]["status"] = "pending_restart"
        self._install_tasks[task_id]["message"] = "更新窗口已打开，Dashboard 即将退出"

        # 先 uninit 清理（async，投到主事件循环），再延迟退出释放进程
        def _shutdown_and_exit():
            time.sleep(1)
            try:
                if self._loop and not self._loop.is_closed():
                    future = asyncio.run_coroutine_threadsafe(
                        self.sdk.uninit(), self._loop
                    )
                    future.result(timeout=15)
            except Exception:
                pass
            os._exit(0)

        threading.Thread(target=_shutdown_and_exit, daemon=True).start()
