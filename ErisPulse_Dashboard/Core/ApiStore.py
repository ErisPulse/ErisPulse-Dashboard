"""ApiStoreMixin：插件商店与包管理 API"""

import os
import secrets
import tempfile
import threading

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiStoreMixin:
    """插件商店远程列表、安装上传与包管理 API。"""


    async def _api_store_remote(self, request: Request) -> JSONResponse:
        try:
            force = request.query_params.get("force", "") == "true"
            data = await self._get_pkg_manager().get_store_data(force)
            return JSONResponse(data)
        except Exception as e:
            return JSONResponse({"error": str(e), "packages": None})

    async def _api_store_install(self, request: Request) -> JSONResponse:
        body = await request.json()
        packages = body.get("packages", [])
        if not packages:
            return JSONResponse({"error": "packages required"}, status_code=400)
        force = body.get("force", False)
        index_url = body.get("index_url", "") or None
        task_id = secrets.token_urlsafe(8)
        t = threading.Thread(
            target=self._run_pip_install,
            args=(packages, task_id, force, index_url),
            daemon=True,
        )
        t.start()
        self._add_audit_log("package_install", ", ".join(packages), request)
        self._get_pkg_manager().invalidate_caches()
        return JSONResponse({"success": True, "task_id": task_id})

    async def _api_store_upload(self, request: Request) -> JSONResponse:
        form = await request.form()
        file = form.get("file")
        if not file:
            return JSONResponse({"error": "file required"}, status_code=400)
        filename = file.filename or ""
        if not (filename.endswith(".whl") or filename.endswith(".zip")):
            return JSONResponse(
                {"error": "only .whl and .zip files are supported"}, status_code=400
            )
        force = str(form.get("force", "false")).lower() == "true"
        index_url = str(form.get("index_url", "")) or None
        tmp_dir = tempfile.mkdtemp(prefix="ep_upload_")
        task_id = secrets.token_urlsafe(8)
        file_path = os.path.join(tmp_dir, os.path.basename(filename))
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        t = threading.Thread(
            target=self._run_pip_install_file,
            args=(file_path, filename, tmp_dir, task_id, force, index_url),
            daemon=True,
        )
        t.start()
        self._get_pkg_manager().invalidate_caches()
        return JSONResponse({"success": True, "task_id": task_id})

    async def _api_store_install_status(self, request: Request) -> JSONResponse:
        tid = request.query_params.get("task_id", "")
        info = self._install_tasks.get(tid)
        if not info:
            return JSONResponse({"error": "task not found"}, status_code=404)
        return JSONResponse(info)

    async def _api_package_detail(self, request: Request) -> JSONResponse:
        package = request.query_params.get("package", "")
        if not package:
            return JSONResponse(
                {"error": "package parameter required"}, status_code=400
            )
        try:
            detail = await self._get_pkg_manager().get_package_detail(package)
            return JSONResponse(detail)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    # ════════════════ 已装包管理 ════════════════

    async def _api_packages(self, request: Request) -> JSONResponse:
        force = request.query_params.get("force", "") == "true"
        try:
            result = self._get_pkg_manager().get_installed_packages(force)
            return JSONResponse(result)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_packages_updates(self, request: Request) -> JSONResponse:
        force = request.query_params.get("force", "") == "true"
        try:
            updates = await self._get_pkg_manager().check_updates(force)
            return JSONResponse({"updates": updates})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_packages_upgrade(self, request: Request) -> JSONResponse:
        body = await request.json()
        packages = body.get("packages", [])
        if not packages:
            return JSONResponse({"error": "packages required"}, status_code=400)
        index_url = body.get("index_url", "") or None
        task_id = secrets.token_urlsafe(8)
        t = threading.Thread(
            target=self._run_pip_upgrade,
            args=(packages, task_id, index_url),
            daemon=True,
        )
        t.start()
        self._add_audit_log("package_upgrade", ", ".join(packages), request)
        self._get_pkg_manager().invalidate_caches()
        return JSONResponse({"success": True, "task_id": task_id})

    async def _api_packages_install(self, request: Request) -> JSONResponse:
        body = await request.json()
        packages = body.get("packages", [])
        if not packages:
            return JSONResponse({"error": "packages required"}, status_code=400)
        force = body.get("force", False)
        index_url = body.get("index_url", "") or None

        # Detect git+ URLs and register for tracking
        git_urls = [p for p in packages if p.startswith("git+")]
        for git_url in git_urls:
            self._get_pkg_manager().register_git_package(
                package_name=git_url,
                git_url=git_url,
                installed_version="pending",
            )

        task_id = secrets.token_urlsafe(8)
        t = threading.Thread(
            target=self._run_pip_install,
            args=(packages, task_id, force, index_url),
            daemon=True,
        )
        t.start()
        self._add_audit_log("package_install", ", ".join(packages), request)
        self._get_pkg_manager().invalidate_caches()
        return JSONResponse({"success": True, "task_id": task_id})

    async def _api_packages_uninstall(self, request: Request) -> JSONResponse:
        body = await request.json()
        package = body.get("package", "")
        if not package:
            return JSONResponse({"error": "package required"}, status_code=400)
        protected = {"erispulse", "erispulse-dashboard"}
        if package.lower().replace("-", "").replace("_", "") in {
            p.replace("-", "").replace("_", "") for p in protected
        }:
            return JSONResponse(
                {"error": "Cannot uninstall core package"}, status_code=400
            )
        task_id = secrets.token_urlsafe(8)
        t = threading.Thread(
            target=self._run_pip_uninstall, args=(package, "", task_id), daemon=True
        )
        t.start()
        self._add_audit_log("package_uninstall", package, request)
        self._get_pkg_manager().invalidate_caches()
        return JSONResponse({"success": True, "task_id": task_id})

    async def _api_packages_git(self, request: Request) -> JSONResponse:
        git_pkgs = self._get_pkg_manager().get_git_packages()
        git_updates = await self._get_pkg_manager().check_git_updates()
        return JSONResponse(
            {
                "packages": list(git_pkgs.values()),
                "updates": git_updates,
            }
        )

    async def _api_packages_git_upgrade(self, request: Request) -> JSONResponse:
        body = await request.json()
        git_url = body.get("git_url", "")
        if not git_url:
            return JSONResponse({"error": "git_url required"}, status_code=400)
        task_id = secrets.token_urlsafe(8)
        t = threading.Thread(
            target=self._run_pip_upgrade,
            args=([git_url], task_id, None),
            daemon=True,
        )
        t.start()
        self._add_audit_log("package_git_upgrade", git_url, request)
        return JSONResponse({"success": True, "task_id": task_id})
