import asyncio
import hashlib
import importlib.resources
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
import threading
from typing import Any

from ErisPulse import sdk
from ErisPulse.Core.Bases import BaseModule
from fastapi import Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse


class Main(BaseModule):
    def __init__(self):
        self.sdk = sdk
        self.logger = self.sdk.logger.get_child("Dashboard")
        self.storage = self.sdk.storage
        self.config = self._load_config()
        self._token = self._ensure_token()
        self._ws_clients: list[WebSocket] = []
        self._event_log: list[dict] = []
        self._max_log = 500
        self._start_time = time.time()
        self._install_tasks: dict[str, dict] = {}
        self._loop: asyncio.AbstractEventLoop | None = None
        self._register_routes()

    @staticmethod
    def get_load_strategy():
        from ErisPulse.loaders import ModuleLoadStrategy

        return ModuleLoadStrategy(lazy_load=False, priority=100)

    async def on_load(self, event: dict) -> bool:
        self._loop = asyncio.get_running_loop()
        self._setup_event_interceptors()
        self.logger.info("WebUI module loaded")
        if getattr(self, "_token_new", False):
            self.logger.warning("┌──────────────────────────────────────────────┐")
            self.logger.warning("│           ErisPulse Dashboard                │")
            self.logger.warning("│  访问地址: /Dashboard                       │")
            self.logger.warning("│  访问令牌: %s", self._token)
            self.logger.warning("│  令牌已保存至配置文件 Dashboard.token         │")
            self.logger.warning("└──────────────────────────────────────────────┘")
        else:
            self.logger.warning("Dashboard-Access-Token: %s", self._token)
        return True
    async def on_unload(self, event: dict) -> bool:
        for ws in self._ws_clients:
            try:
                await ws.close()
            except Exception:
                pass
        self._ws_clients.clear()
        self._unregister_routes()
        self.logger.info("WebUI module unloaded")
        return True

    def _load_config(self):
        config = self.sdk.config.getConfig("Dashboard")
        if not config:
            default_config = {"title": "ErisPulse Dashboard", "max_event_log": 500}
            self.sdk.config.setConfig("Dashboard", default_config)
            return default_config
        return config

    def _ensure_token(self) -> str:
        token = self.sdk.config.getConfig("Dashboard.token")
        if not token:
            token = secrets.token_urlsafe(32)
            self.sdk.config.setConfig("Dashboard.token", token)
            self._token_new = True
        else:
            self._token_new = False
        return str(token)

    def _verify_token(self, provided: str | None) -> bool:
        if not provided:
            return False
        return secrets.compare_digest(str(provided), self._token)

    def _setup_event_interceptors(self):
        @self.sdk.adapter.on("*")
        async def log_all_events(data: dict):
            self._add_event_log(data)

    def _add_event_log(self, data: dict):
        entry = {
            "id": data.get("id", ""),
            "time": data.get("time", time.time()),
            "type": data.get("type", "unknown"),
            "detail_type": data.get("detail_type", ""),
            "platform": data.get("platform", "unknown"),
            "sub_type": data.get("sub_type", ""),
            "self_id": "",
            "user_id": "",
            "group_id": "",
            "alt_message": "",
        }
        self_field = data.get("self")
        if isinstance(self_field, dict):
            entry["self_id"] = str(self_field.get("user_id", ""))
        entry["user_id"] = str(
            data.get("user_id", data.get("sender", {}).get("user_id", ""))
        )
        entry["group_id"] = str(data.get("group_id", ""))
        entry["alt_message"] = data.get("alt_message", data.get("raw_message", ""))
        self._event_log.append(entry)
        if len(self._event_log) > self._max_log:
            self._event_log = self._event_log[-self._max_log :]
        asyncio.ensure_future(self._broadcast_event(entry))

    async def _broadcast_event(self, event: dict):
        if not self._ws_clients:
            return
        dead = []
        for ws in self._ws_clients:
            try:
                await ws.send_json({"type": "event", "data": event})
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._ws_clients.remove(ws)

    async def _broadcast(self, msg: dict):
        if not self._ws_clients:
            return
        dead = []
        for ws in self._ws_clients:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._ws_clients.remove(ws)

    def _safe_broadcast(self, msg: dict):
        if self._loop and not self._loop.is_closed():
            asyncio.run_coroutine_threadsafe(self._broadcast(msg), self._loop)

    def _run_pip_install(self, packages: list[str], task_id: str):
        cmd = [sys.executable, "-m", "pip", "install"] + packages
        self._install_tasks[task_id] = {
            "status": "running",
            "started_at": time.time(),
            "packages": packages,
        }
        self._safe_broadcast(
            {
                "type": "install_progress",
                "task_id": task_id,
                "status": "running",
                "packages": packages,
            }
        )
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1,
            )
            stdout_lines = []
            stderr_lines = []

            def read_pipe(pipe, lines):
                try:
                    for line in iter(pipe.readline, ""):
                        lines.append(line.rstrip())
                        if len(lines) % 5 == 0:
                            self._safe_broadcast(
                                {
                                    "type": "install_progress",
                                    "task_id": task_id,
                                    "status": "running",
                                    "output": lines[-10:],
                                }
                            )
                except Exception:
                    pass
                pipe.close()

            t_out = threading.Thread(target=read_pipe, args=(proc.stdout, stdout_lines))
            t_err = threading.Thread(target=read_pipe, args=(proc.stderr, stderr_lines))
            t_out.start()
            t_err.start()

            try:
                proc.wait(timeout=300)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                self._install_tasks[task_id]["status"] = "timeout"
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "message": "Install timed out (5 min)",
                    }
                )
                return

            t_out.join(timeout=10)
            t_err.join(timeout=10)

            if proc.returncode == 0:
                self._install_tasks[task_id]["status"] = "success"
                self._install_tasks[task_id]["output"] = stdout_lines
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "success",
                        "output": stdout_lines,
                    }
                )
            else:
                self._install_tasks[task_id]["status"] = "error"
                self._install_tasks[task_id]["error"] = "\n".join(stderr_lines)
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "output": stdout_lines + stderr_lines,
                        "message": "\n".join(stderr_lines[-10:])
                        if stderr_lines
                        else "Unknown error",
                    }
                )
        except Exception as e:
            self._install_tasks[task_id]["status"] = "error"
            self._install_tasks[task_id]["error"] = str(e)
            self._safe_broadcast(
                {
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "error",
                    "message": str(e),
                }
            )

    def _get_framework_info(self) -> dict:
        try:
            import importlib.metadata

            version = importlib.metadata.version("ErisPulse")
        except importlib.metadata.PackageNotFoundError:
            version = "unknown"
        return {
            "version": version,
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        }

    def _get_system_status(self) -> dict:
        import platform as pf

        uptime = time.time() - self._start_time
        mem = {}
        try:
            import psutil

            proc = psutil.Process(os.getpid())
            mem["rss_mb"] = round(proc.memory_info().rss / 1024 / 1024, 1)
            mem["cpu_percent"] = proc.cpu_percent()
            mem["system_percent"] = psutil.virtual_memory().percent
        except ImportError:
            mem["rss_mb"] = "N/A"
            mem["cpu_percent"] = "N/A"
            mem["system_percent"] = "N/A"
        ec = {}
        for e in self._event_log:
            t = e["type"]
            ec[t] = ec.get(t, 0) + 1
        return {
            "uptime_seconds": round(uptime),
            "uptime_human": self._fmt_uptime(uptime),
            "platform": pf.system(),
            "platform_release": pf.release(),
            "platform_machine": pf.machine(),
            "pid": os.getpid(),
            "memory": mem,
            "event_counts": ec,
            "total_events": len(self._event_log),
        }

    @staticmethod
    def _fmt_uptime(s):
        d, s = divmod(int(s), 86400)
        h, s = divmod(s, 3600)
        m, s = divmod(s, 60)
        if d:
            return f"{d}d {h}h {m}m"
        if h:
            return f"{h}h {m}m"
        if m:
            return f"{m}m {s}s"
        return f"{s}s"

    def _register_routes(self):
        r = self.sdk.router
        mn = "Dashboard"

        async def _html(request: Request) -> HTMLResponse:
            return HTMLResponse(self._get_html())

        r.register_http_route(mn, "/", handler=_html, methods=["GET"])
        r.register_http_route(mn, "/api/auth", handler=self._api_auth, methods=["POST"])
        r.register_http_route(
            mn, "/api/auth/status", handler=self._api_auth_status, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/status", handler=self._api_status, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/system", handler=self._api_system, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/adapters", handler=self._api_adapters, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/modules", handler=self._api_modules, methods=["GET"]
        )
        r.register_http_route(
            mn,
            "/api/modules/action",
            handler=self._api_modules_action,
            methods=["POST"],
        )
        r.register_http_route(mn, "/api/bots", handler=self._api_bots, methods=["GET"])
        r.register_http_route(
            mn, "/api/events", handler=self._api_events, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/events/clear", handler=self._api_events_clear, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/config", handler=self._api_config, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/config", handler=self._api_config_update, methods=["PUT"]
        )
        r.register_http_route(
            mn, "/api/storage", handler=self._api_storage, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/storage", handler=self._api_storage_set, methods=["POST"]
        )
        r.register_http_route(
            mn,
            "/api/storage/delete",
            handler=self._api_storage_delete,
            methods=["POST"],
        )
        r.register_http_route(
            mn, "/api/store/remote", handler=self._api_store_remote, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/store/install", handler=self._api_store_install, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/store/upload", handler=self._api_store_upload, methods=["POST"]
        )
        r.register_http_route(
            mn,
            "/api/store/install/status",
            handler=self._api_store_install_status,
            methods=["GET"],
        )
        r.register_http_route(
            mn, "/api/restart", handler=self._api_restart, methods=["POST"]
        )
        r.register_websocket(mn, "/ws", handler=self._ws_handler)

    def _unregister_routes(self):
        r = self.sdk.router
        mn = "Dashboard"
        for p in [
            "/",
            "/api/auth",
            "/api/auth/status",
            "/api/status",
            "/api/system",
            "/api/adapters",
            "/api/modules",
            "/api/modules/action",
            "/api/bots",
            "/api/events",
            "/api/events/clear",
            "/api/config",
            "/api/storage",
            "/api/storage/delete",
            "/api/store/remote",
            "/api/store/install",
            "/api/store/upload",
            "/api/store/install/status",
            "/api/restart",
        ]:
            try:
                r.unregister_http_route(mn, p)
            except Exception:
                pass
        try:
            r.unregister_websocket(mn, "/ws")
        except Exception:
            pass

    def _get_token_from_request(self, request: Request) -> str | None:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:]
        return request.query_params.get("token")

    async def _api_auth(self, request: Request) -> JSONResponse:
        body = await request.json()
        token = body.get("token", "")
        if self._verify_token(token):
            return JSONResponse({"success": True})
        return JSONResponse(
            {"success": False, "error": "Invalid token"}, status_code=401
        )

    async def _api_auth_status(self, request: Request) -> JSONResponse:
        token = self._get_token_from_request(request)
        if self._verify_token(token):
            return JSONResponse({"authenticated": True})
        return JSONResponse({"authenticated": False}, status_code=401)

    async def _api_status(self, request: Request) -> JSONResponse:
        fw = self._get_framework_info()
        return JSONResponse(
            {
                "framework": fw,
                "adapters": self.sdk.adapter.get_status_summary().get("adapters", {}),
                "modules": {
                    n: self.sdk.module.is_loaded(n)
                    for n in self.sdk.module.list_registered()
                },
            }
        )

    async def _api_system(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        return JSONResponse(self._get_system_status())

    async def _api_adapters(self, request: Request) -> JSONResponse:
        adapters = []
        for platform in self.sdk.adapter.list_registered():
            info = {
                "platform": platform,
                "enabled": self.sdk.adapter.is_enabled(platform),
                "running": self.sdk.adapter.is_running(platform),
                "bots": [],
            }
            bots = self.sdk.adapter.list_bots(platform).get(platform, {})
            for bot_id, bd in bots.items():
                info["bots"].append(
                    {
                        "bot_id": bot_id,
                        "status": bd.get("status", "unknown"),
                        "last_active": bd.get("last_active", 0),
                        "info": bd.get("info", {}),
                    }
                )
            adapters.append(info)
        return JSONResponse({"adapters": adapters})

    async def _api_modules_action(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        action, name, mtype = (
            body.get("action"),
            body.get("name", ""),
            body.get("type", "module"),
        )
        if not name or not action:
            return JSONResponse({"error": "name and action required"}, status_code=400)
        if action not in ("load", "unload"):
            return JSONResponse(
                {"error": f"unknown action: {action}"}, status_code=400
            )
        if mtype == "adapter":
            if action == "unload":
                shutdown_adapter = self.sdk.adapter.get(name)
                if shutdown_adapter:
                    await shutdown_adapter.shutdown()
                    self.sdk.adapter._started_instances.discard(shutdown_adapter)
                    result = True
            elif action == "load":
                load_adapter = self.sdk.adapter.get(name)
                if load_adapter:
                    await load_adapter.start()
                    self.sdk.adapter._started_instances.add(load_adapter)
                    result = True
            else:
                return JSONResponse(
                    {"error": f"unknown action for adapter: {action}"}, status_code=400
                )
            if not result:
                return JSONResponse({"error": "adapter not found"}, status_code=404)
            return JSONResponse({"success": True, "requires_restart": True})
        else:
            if action == "load":
                result = await self.sdk.module.load(name)
            elif action == "unload":
                result = await self.sdk.module.unload(name)
            if not result:
                return JSONResponse(
                    {"error": f"action {action} failed"}, status_code=400
                )
        return JSONResponse({"success": True})

    async def _api_bots(self, request: Request) -> JSONResponse:
        bots = []
        for p, bs in self.sdk.adapter.list_bots().items():
            for bid, bd in bs.items():
                bots.append(
                    {
                        "platform": p,
                        "bot_id": bid,
                        "status": bd.get("status", "unknown"),
                        "last_active": bd.get("last_active", 0),
                        "info": bd.get("info", {}),
                    }
                )
        return JSONResponse({"bots": bots})

    async def _api_events(self, request: Request) -> JSONResponse:
        limit = int(request.query_params.get("limit", "50"))
        et = request.query_params.get("type")
        ep = request.query_params.get("platform")
        evts = list(self._event_log)
        if et:
            evts = [e for e in evts if e["type"] == et]
        if ep:
            evts = [e for e in evts if e["platform"] == ep]
        return JSONResponse({"events": evts[-limit:], "total": len(evts)})

    async def _api_events_clear(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        self._event_log.clear()
        return JSONResponse({"success": True})

    async def _api_config(self, request: Request) -> JSONResponse:
        config = dict(self.sdk.config._cache)
        return JSONResponse({"config": config})

    async def _api_config_update(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        key, value = body.get("key", ""), body.get("value")
        if not key:
            return JSONResponse({"error": "key is required"}, status_code=400)
        self.sdk.config.setConfig(key, value)
        return JSONResponse({"success": True})

    async def _api_storage(self, request: Request) -> JSONResponse:
        keys = self.storage.get_all_keys()
        data = {}
        for k in keys[:200]:
            data[k] = self.storage.get(k)
        return JSONResponse({"keys": keys, "data": data, "total": len(keys)})

    async def _api_storage_set(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        key, value = body.get("key", ""), body.get("value")
        if not key:
            return JSONResponse({"error": "key is required"}, status_code=400)
        self.storage.set(key, value)
        return JSONResponse({"success": True})

    async def _api_storage_delete(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        key = body.get("key", "")
        if not key:
            return JSONResponse({"error": "key is required"}, status_code=400)
        self.storage.delete(key)
        return JSONResponse({"success": True})

    async def _api_store_remote(self, request: Request) -> JSONResponse:
        try:
            from ErisPulse.CLI.utils import PackageManager

            pm = PackageManager()
            remote = await pm.get_remote_packages()
            return JSONResponse({"packages": remote})
        except Exception as e:
            return JSONResponse({"error": str(e), "packages": None})

    async def _api_store_install(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        packages = body.get("packages", [])
        if not packages:
            return JSONResponse({"error": "packages required"}, status_code=400)
        task_id = secrets.token_urlsafe(8)
        t = threading.Thread(
            target=self._run_pip_install, args=(packages, task_id), daemon=True
        )
        t.start()
        return JSONResponse({"success": True, "task_id": task_id})

    async def _api_store_install_status(self, request: Request) -> JSONResponse:
        tid = request.query_params.get("task_id", "")
        info = self._install_tasks.get(tid)
        if not info:
            return JSONResponse({"error": "task not found"}, status_code=404)
        return JSONResponse(info)

    async def _api_store_upload(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        form = await request.form()
        file = form.get("file")
        if not file:
            return JSONResponse({"error": "file required"}, status_code=400)
        filename = file.filename or ""
        if not (filename.endswith(".whl") or filename.endswith(".zip")):
            return JSONResponse(
                {"error": "only .whl and .zip files are supported"}, status_code=400
            )
        tmp_dir = tempfile.mkdtemp(prefix="ep_upload_")
        task_id = secrets.token_urlsafe(8)
        file_path = os.path.join(tmp_dir, os.path.basename(filename))
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        t = threading.Thread(
            target=self._run_pip_install_file,
            args=(file_path, filename, tmp_dir, task_id),
            daemon=True,
        )
        t.start()
        return JSONResponse({"success": True, "task_id": task_id})

    def _run_pip_install_file(
        self, file_path: str, filename: str, tmp_dir: str, task_id: str
    ):
        self._install_tasks[task_id] = {
            "status": "running",
            "started_at": time.time(),
            "packages": [filename],
        }
        self._safe_broadcast(
            {
                "type": "install_progress",
                "task_id": task_id,
                "status": "running",
                "packages": [filename],
            }
        )

        def _do_install(packages: list[str]) -> tuple[list[str], list[str], int]:
            proc = subprocess.Popen(
                [sys.executable, "-m", "pip", "install"] + packages,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1,
            )
            stdout_lines: list[str] = []
            stderr_lines: list[str] = []

            def read_pipe(pipe, lines):
                try:
                    for line in iter(pipe.readline, ""):
                        lines.append(line.rstrip())
                        if len(lines) % 5 == 0:
                            self._safe_broadcast(
                                {
                                    "type": "install_progress",
                                    "task_id": task_id,
                                    "status": "running",
                                    "output": lines[-10:],
                                }
                            )
                except Exception:
                    pass
                pipe.close()

            t_out = threading.Thread(target=read_pipe, args=(proc.stdout, stdout_lines))
            t_err = threading.Thread(target=read_pipe, args=(proc.stderr, stderr_lines))
            t_out.start()
            t_err.start()
            try:
                proc.wait(timeout=300)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                t_out.join(timeout=10)
                t_err.join(timeout=10)
                return stdout_lines, stderr_lines, 1
            t_out.join(timeout=10)
            t_err.join(timeout=10)
            return stdout_lines, stderr_lines, proc.returncode

        try:
            stdout, stderr, rc = _do_install([file_path])
            if rc != 0 and filename.endswith(".zip"):
                stem = os.path.splitext(os.path.basename(filename))[0]
                extract_dir = os.path.join(tmp_dir, stem)
                shutil.unpack_archive(file_path, extract_dir)
                stdout2, stderr2, rc2 = _do_install([extract_dir])
                stdout = stdout + stdout2
                stderr = stderr + stderr2
                rc = rc2
            all_lines = stdout + stderr
            if rc == 0:
                self._install_tasks[task_id] = {
                    "status": "success",
                    "started_at": time.time(),
                    "packages": [filename],
                    "output": all_lines[-50:],
                }
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "success",
                        "output": all_lines[-50:],
                    }
                )
            else:
                self._install_tasks[task_id] = {
                    "status": "error",
                    "started_at": time.time(),
                    "packages": [filename],
                    "output": all_lines[-50:],
                }
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "output": all_lines[-50:],
                        "message": "Install failed",
                    }
                )
        except Exception as e:
            self._install_tasks[task_id] = {
                "status": "error",
                "started_at": time.time(),
                "packages": [filename],
                "output": [str(e)],
            }
            self._safe_broadcast(
                {
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "error",
                    "message": str(e),
                }
            )
        finally:
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass

    async def _api_restart(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)

        async def _delayed_restart():
            await asyncio.sleep(0.5)
            await self.sdk.restart()

        asyncio.create_task(_delayed_restart())
        return JSONResponse({"success": True})

    async def _api_modules(self, request: Request) -> JSONResponse:
        modules = []
        for name in self.sdk.module.list_registered():
            modules.append(
                {
                    "name": name,
                    "type": "module",
                    "enabled": self.sdk.module.is_enabled(name),
                    "loaded": self.sdk.module.is_loaded(name),
                }
            )
        for name in self.sdk.adapter.list_registered():
            modules.append(
                {
                    "name": name,
                    "type": "adapter",
                    "enabled": self.sdk.adapter.is_enabled(name),
                    "loaded": self.sdk.adapter.is_running(name),
                }
            )
        return JSONResponse({"modules": modules})

    async def _ws_handler(self, websocket: WebSocket):
        token = websocket.query_params.get("token", "")
        if not self._verify_token(token):
            await websocket.close(code=1008, reason="Unauthorized")
            return
        self._ws_clients.append(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            if websocket in self._ws_clients:
                self._ws_clients.remove(websocket)

    def _get_html(self) -> str:
        return _HTML
    
_HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>ErisPulse Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box
        }

        :root {
            --bg-p: #F5F5DC;
            --bg-s: #FAF9F6;
            --bg-t: #FFFFFF;
            --tx-p: #2C2C2C;
            --tx-s: #666666;
            --tx-t: #999999;
            --bd: #E0E0E0;
            --bd-h: #CCCCCC;
            --accent: #D4D4AA;
            --accent-h: #C4C49A;
            --sh: rgba(0, 0, 0, .08);
            --modal: rgba(0, 0, 0, .5);
            --ok-bg: #E8F5E9;
            --ok-c: #2E7D32;
            --ok-bd: #C8E6C9;
            --er-bg: #FFEBEE;
            --er-c: #C62828;
            --er-bd: #FFCDD2;
            --wr-bg: #FFF3E0;
            --wr-c: #E65100;
            --wr-bd: #FFE0B2;
            --pr-bg: #E8EAF6;
            --pr-c: #283593;
            --pr-bd: #C5CAE9;
            --sc-bg: #F3E5F5;
            --sc-c: #6A1B9A;
            --sc-bd: #E1BEE7;
            --lk: #1976D2;
        }

        [data-theme="dark"] {
            --bg-p: #1a1a1a;
            --bg-s: #252525;
            --bg-t: #2d2d2d;
            --tx-p: #E0E0E0;
            --tx-s: #A0A0A0;
            --tx-t: #707070;
            --bd: #404040;
            --bd-h: #505050;
            --accent: #5a5a3a;
            --accent-h: #4a4a2a;
            --sh: rgba(0, 0, 0, .3);
            --modal: rgba(0, 0, 0, .7);
            --ok-bg: #1B5E20;
            --ok-c: #A5D6A7;
            --ok-bd: #2E7D32;
            --er-bg: #B71C1C;
            --er-c: #FFCDD2;
            --er-bd: #C62828;
            --wr-bg: #4E342E;
            --wr-c: #FFCC80;
            --wr-bd: #5D4037;
            --pr-bg: #1A237E;
            --pr-c: #9FA8DA;
            --pr-bd: #283593;
            --sc-bg: #4A148C;
            --sc-c: #CE93D8;
            --sc-bd: #6A1B9A;
            --lk: #64B5F6;
        }

        html {
            height: -webkit-fill-available
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            background: var(--bg-p);
            color: var(--tx-p);
            height: 100vh;
            height: -webkit-fill-available;
            height: 100dvh;
            display: flex;
            flex-direction: column;
            font-size: 14px;
            overflow: hidden;
            -webkit-font-smoothing: antialiased
        }

        .app {
            display: none;
            height: 100vh;
            height: 100dvh;
            flex-direction: column
        }

        .app.authed {
            display: flex
        }

        .header {
            background: var(--bg-s);
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--bd);
            flex-shrink: 0
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 12px
        }

        .header h1 {
            font-size: 16px;
            font-weight: 600
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 8px
        }

        .ws-badge {
            font-size: 12px;
            font-weight: 500;
            padding: 4px 12px;
            border-radius: 12px;
            background: var(--bg-t);
            color: var(--tx-s);
            border: 1px solid var(--bd);
            display: flex;
            align-items: center;
            gap: 6px
        }

        .ws-badge.on {
            background: var(--ok-bg);
            color: var(--ok-c);
            border-color: var(--ok-bd)
        }

        .ws-badge .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--tx-t)
        }

        .ws-badge.on .dot {
            background: var(--ok-c)
        }

        .btn-icon {
            width: 36px;
            height: 36px;
            border: 1px solid var(--bd);
            background: var(--bg-t);
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--tx-p);
            transition: all .2s;
            flex-shrink: 0
        }

        .btn-icon:hover {
            border-color: var(--accent);
            background: var(--bg-s)
        }

        .btn-icon svg {
            width: 18px;
            height: 18px
        }

        .btn-icon.active {
            background: var(--accent);
            border-color: var(--accent)
        }

        .lang-btn {
            padding: 4px 12px;
            border: 1px solid var(--bd);
            background: var(--bg-t);
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            color: var(--tx-s);
            transition: all .2s
        }

        .lang-btn:hover {
            border-color: var(--accent);
            color: var(--tx-p)
        }

        .btn-hamburger {
            display: none;
            width: 40px;
            height: 40px;
            border: 1px solid var(--bd);
            background: var(--bg-t);
            border-radius: 8px;
            cursor: pointer;
            align-items: center;
            justify-content: center;
            color: var(--tx-p);
            transition: all .2s;
            flex-shrink: 0
        }

        .btn-hamburger:hover {
            border-color: var(--accent);
            background: var(--bg-s)
        }

        .btn-hamburger svg {
            width: 20px;
            height: 20px
        }

        .main {
            display: flex;
            flex: 1;
            overflow: hidden;
            min-height: 0
        }

        .sidebar {
            width: 240px;
            background: var(--bg-s);
            border-right: 1px solid var(--bd);
            display: flex;
            flex-direction: column;
            flex-shrink: 0
        }

        .sidebar-nav {
            flex: 1;
            overflow-y: auto;
            padding: 8px
        }

        .sidebar-nav::-webkit-scrollbar {
            width: 4px
        }

        .sidebar-nav::-webkit-scrollbar-track {
            background: transparent
        }

        .sidebar-nav::-webkit-scrollbar-thumb {
            background: var(--bd);
            border-radius: 2px
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            margin-bottom: 2px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 8px;
            cursor: pointer;
            transition: all .2s;
            color: var(--tx-s);
            text-decoration: none;
            font-size: 14px;
            font-weight: 500
        }

        .nav-item:hover {
            background: var(--bg-t);
            color: var(--tx-p)
        }

        .nav-item.active {
            background: var(--accent);
            border-color: var(--accent);
            color: var(--tx-p);
            font-weight: 600
        }

        .nav-item svg {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
            opacity: .7
        }

        .nav-item.active svg {
            opacity: 1
        }

        .sidebar-footer {
            padding: 12px 16px;
            border-top: 1px solid var(--bd);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px
        }

        .sidebar-footer .fw-ver {
            font-size: 11px;
            color: var(--tx-t);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
            flex: 1
        }

        .restart-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border: 1px solid var(--bd);
            border-radius: 8px;
            background: var(--bg);
            color: var(--tx-s);
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
            transition: all .2s
        }

        .restart-btn:hover {
            background: var(--accent);
            color: var(--tx);
            border-color: var(--accent)
        }

        .restart-btn svg {
            width: 14px;
            height: 14px;
            flex-shrink: 0
        }

        .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            overflow: hidden
        }

        .page {
            display: none;
            flex: 1;
            overflow-y: auto;
            padding: 24px
        }

        .page.active {
            display: block
        }

        .page::-webkit-scrollbar {
            width: 4px
        }

        .page::-webkit-scrollbar-track {
            background: transparent
        }

        .page::-webkit-scrollbar-thumb {
            background: var(--bd);
            border-radius: 2px
        }

        .page-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 4px
        }

        .page-desc {
            font-size: 14px;
            color: var(--tx-s);
            margin-bottom: 20px
        }

        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px
        }

        .grid-3 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px
        }

        .grid-4 {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px
        }

        .card {
            background: var(--bg-t);
            border-radius: 16px;
            box-shadow: 0 4px 12px var(--sh);
            overflow: hidden;
            transition: box-shadow .2s
        }

        .card:hover {
            box-shadow: 0 6px 16px rgba(0, 0, 0, .12)
        }

        .card-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 18px;
            font-size: 14px;
            font-weight: 600;
            border-bottom: 1px solid var(--bd)
        }

        .card-header svg {
            width: 18px;
            height: 18px;
            color: var(--tx-s);
            flex-shrink: 0
        }

        .card-body {
            padding: 4px 0
        }

        .card-header .header-actions {
            margin-left: auto;
            display: flex;
            gap: 4px
        }

        .stat-card {
            background: var(--bg-t);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 4px 12px var(--sh);
            transition: box-shadow .2s
        }

        .stat-card:hover {
            box-shadow: 0 6px 16px rgba(0, 0, 0, .12)
        }

        .stat-val {
            font-size: 32px;
            font-weight: 700;
            color: var(--tx-p);
            line-height: 1.1
        }

        .stat-label {
            font-size: 12px;
            color: var(--tx-s);
            margin-top: 6px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 4px
        }

        .stat-label svg {
            width: 14px;
            height: 14px;
            opacity: .6
        }

        .chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: .3px;
            white-space: nowrap
        }

        .chip-ok {
            background: var(--ok-bg);
            color: var(--ok-c);
            border: 1px solid var(--ok-bd)
        }

        .chip-er {
            background: var(--er-bg);
            color: var(--er-c);
            border: 1px solid var(--er-bd)
        }

        .chip-wr {
            background: var(--wr-bg);
            color: var(--wr-c);
            border: 1px solid var(--wr-bd)
        }

        .chip-pr {
            background: var(--pr-bg);
            color: var(--pr-c);
            border: 1px solid var(--pr-bd)
        }

        .chip-sc {
            background: var(--sc-bg);
            color: var(--sc-c);
            border: 1px solid var(--sc-bd)
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: none;
            cursor: pointer;
            font-family: inherit;
            font-size: 13px;
            font-weight: 600;
            border-radius: 8px;
            padding: 8px 16px;
            transition: all .2s;
            white-space: nowrap
        }

        .btn:hover {
            transform: translateY(-1px)
        }

        .btn:active {
            transform: translateY(0)
        }

        .btn-primary {
            background: var(--accent);
            color: var(--tx-p);
            border: none
        }

        .btn-primary:hover {
            background: var(--accent-h)
        }

        .btn-secondary {
            background: transparent;
            color: var(--tx-p);
            border: 1px solid var(--bd)
        }

        .btn-secondary:hover {
            border-color: var(--accent);
            background: var(--bg-s)
        }

        .btn-danger {
            background: var(--er-bg);
            color: var(--er-c);
            border: 1px solid var(--er-bd)
        }

        .btn-sm {
            padding: 6px 12px;
            font-size: 12px;
            border-radius: 6px
        }

        .btn-xs {
            padding: 4px 8px;
            font-size: 11px;
            border-radius: 4px
        }

        .list-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 18px;
            border-bottom: 1px solid var(--bd);
            transition: background .2s;
            font-size: 13px
        }

        .list-row:last-child {
            border-bottom: none
        }

        .list-row:hover {
            background: var(--bg-s)
        }

        .ev-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px 18px;
            border-bottom: 1px solid var(--bd);
            font-size: 13px;
            transition: background .2s
        }

        .ev-item:hover {
            background: var(--bg-s)
        }

        .ev-badge {
            font-weight: 600;
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 4px;
            text-transform: uppercase;
            min-width: 56px;
            text-align: center;
            flex-shrink: 0;
            letter-spacing: .3px
        }

        .ev-badge.message {
            background: var(--pr-bg);
            color: var(--pr-c)
        }

        .ev-badge.meta {
            background: var(--sc-bg);
            color: var(--sc-c)
        }

        .ev-badge.notice {
            background: var(--wr-bg);
            color: var(--wr-c)
        }

        .ev-badge.request {
            background: var(--er-bg);
            color: var(--er-c)
        }

        .bot-card {
            background: var(--bg-t);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: 0 4px 12px var(--sh);
            transition: all .2s
        }

        .bot-card:hover {
            box-shadow: 0 6px 16px rgba(0, 0, 0, .12);
            transform: translateY(-1px)
        }

        .bot-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--accent);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            overflow: hidden
        }

        .bot-avatar img {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            object-fit: cover
        }

        .bot-avatar svg {
            width: 24px;
            height: 24px;
            color: var(--tx-p);
            opacity: .7
        }

        .store-card {
            background: var(--bg-t);
            border: 1px solid var(--bd);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            box-shadow: 0 4px 12px var(--sh);
            transition: all .2s
        }

        .store-card:hover {
            box-shadow: 0 6px 16px rgba(0, 0, 0, .12);
            transform: translateY(-1px)
        }

        .kv-row {
            display: flex;
            align-items: center;
            padding: 0 18px;
            min-height: 48px;
            border-bottom: 1px solid var(--bd);
            transition: background .2s
        }

        .kv-row:hover {
            background: var(--bg-s)
        }

        .kv-key {
            width: 220px;
            flex-shrink: 0;
            font-size: 13px;
            font-weight: 500;
            padding: 10px 16px 10px 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap
        }

        .kv-actions {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 0;
            min-width: 0
        }

        .kv-input {
            flex: 1;
            min-width: 0;
            padding: 6px 12px;
            border: 1px solid var(--bd);
            border-radius: 8px;
            background: var(--bg-s);
            color: var(--tx-p);
            font-size: 13px;
            font-family: inherit;
            outline: none;
            transition: all .2s
        }

        .kv-input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 1px var(--accent)
        }

        .kv-btn {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            background: transparent;
            color: var(--tx-s);
            transition: all .2s
        }

        .kv-btn svg {
            width: 16px;
            height: 16px
        }

        .kv-btn-save:hover {
            background: var(--ok-bg);
            color: var(--ok-c)
        }

        .kv-btn-del:hover {
            background: var(--er-bg);
            color: var(--er-c)
        }

        .kv-group {
            margin-bottom: 2px
        }

        .kv-group-hd {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 10px 18px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            background: var(--bg-s);
            border-bottom: 1px solid var(--bd);
            user-select: none;
            transition: background .2s
        }

        .kv-group-hd:hover {
            background: var(--bg-t)
        }

        .kv-chevron {
            font-size: 18px;
            color: var(--tx-t);
            transition: transform .2s
        }

        .kv-group.collapsed .kv-chevron {
            transform: rotate(-90deg)
        }

        .kv-group-body {}

        .kv-group.collapsed .kv-group-body {
            display: none
        }

        .kv-count {
            font-size: 11px;
            padding: 1px 8px;
            border-radius: 12px;
            background: var(--bg-t);
            color: var(--tx-t);
            border: 1px solid var(--bd)
        }

        .filter-bar {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            flex-wrap: wrap;
            align-items: center
        }

        .filter-bar select {
            padding: 8px 14px;
            border: 1px solid var(--bd);
            border-radius: 8px;
            background: var(--bg-t);
            color: var(--tx-p);
            font-size: 13px;
            font-family: inherit;
            outline: none;
            transition: all .2s;
            cursor: pointer
        }

        .filter-bar select:focus {
            border-color: var(--accent)
        }

        .filter-bar input[type=text] {
            padding: 8px 14px;
            border: 1px solid var(--bd);
            border-radius: 8px;
            background: var(--bg-t);
            color: var(--tx-p);
            font-size: 13px;
            font-family: inherit;
            outline: none;
            transition: all .2s;
            max-width: 300px
        }

        .filter-bar input[type=text]:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 1px var(--accent)
        }

        .modal-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: var(--modal);
            backdrop-filter: blur(4px);
            z-index: 1000;
            justify-content: center;
            align-items: center
        }

        .modal-overlay.show {
            display: flex
        }

        .modal-box {
            background: var(--bg-t);
            padding: 24px;
            border-radius: 16px;
            width: 90%;
            max-width: 420px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, .15);
            animation: scaleIn .2s ease-out
        }

        @keyframes scaleIn {
            from {
                opacity: 0;
                transform: scale(.95)
            }

            to {
                opacity: 1;
                transform: scale(1)
            }
        }

        .modal-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px
        }

        .modal-text {
            font-size: 14px;
            color: var(--tx-s);
            line-height: 1.5;
            margin-bottom: 20px
        }

        .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px
        }

        .output-modal .modal-box {
            max-width: 600px
        }

        .output-pre {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 12px;
            font-family: 'Cascadia Code', 'Fira Code', Consolas, Monaco, monospace;
            line-height: 1.6;
            max-height: 280px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-all;
            margin-bottom: 20px
        }

        [data-theme="light"] .output-pre {
            background: #f5f5f5;
            color: #333
        }

        .login-overlay {
            position: fixed;
            inset: 0;
            background: var(--modal);
            backdrop-filter: blur(4px);
            z-index: 1001;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            opacity: 0;
            pointer-events: none;
            transition: opacity .2s
        }

        .login-overlay.show {
            opacity: 1;
            pointer-events: auto
        }

        .login-card {
            background: var(--bg-t);
            border-radius: 16px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, .15);
            animation: scaleIn .2s ease-out
        }

        .login-card h2 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px
        }

        .login-card p {
            font-size: 14px;
            color: var(--tx-s);
            margin-bottom: 24px;
            line-height: 1.5
        }

        .form-group {
            margin-bottom: 20px
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 500
        }

        .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid var(--bd);
            border-radius: 8px;
            font-size: 14px;
            background: var(--bg-s);
            color: var(--tx-p);
            transition: all .2s;
            font-family: inherit
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--accent);
            background: var(--bg-t)
        }

        .form-group input::placeholder {
            color: var(--tx-t)
        }

        .login-hint {
            font-size: 12px;
            color: var(--tx-t);
            line-height: 1.5;
            margin-bottom: 24px
        }

        .login-hint code {
            background: var(--bg-s);
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 11px;
            border: 1px solid var(--bd)
        }

        .login-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 48px 20px;
            color: var(--tx-s)
        }

        .empty-state svg {
            width: 48px;
            height: 48px;
            opacity: .3;
            margin-bottom: 8px
        }

        .empty-state h3 {
            font-size: 16px;
            font-weight: 600;
            color: var(--tx-p);
            margin-bottom: 4px
        }

        .empty-state p {
            font-size: 13px;
            color: var(--tx-s)
        }

        .overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, .5);
            z-index: 99;
            opacity: 0;
            transition: opacity .3s
        }

        .overlay.show {
            display: block;
            opacity: 1
        }

        @media(max-width:768px) {
            .btn-hamburger {
                display: flex
            }

            .sidebar {
                position: fixed;
                top: 0;
                left: 0;
                height: 100%;
                width: 280px;
                z-index: 1000;
                transform: translateX(-100%);
                transition: transform .3s;
                box-shadow: 2px 0 8px rgba(0, 0, 0, .1)
            }

            .sidebar.open {
                transform: translateX(0)
            }

            .page {
                padding: 16px
            }

            .grid-2,
            .grid-3,
            .grid-4 {
                grid-template-columns: 1fr
            }

            .kv-key {
                width: 140px
            }

            .modal-box {
                width: 95%;
                padding: 20px
            }

            .login-card {
                padding: 30px 24px
            }
        }

        @media(max-width:480px) {
            .header h1 {
                font-size: 14px
            }

            .page {
                padding: 12px
            }

            .sidebar {
                width: 260px
            }

            .login-card {
                padding: 24px 20px
            }

            .login-card h2 {
                font-size: 18px
            }
        }
    </style>
</head>

<body>
    <div class="app">
        <header class="header">
            <div class="header-left">
                <button class="btn-hamburger" onclick="toggleSidebar()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <h1 id="appTitle">ErisPulse Dashboard</h1>
            </div>
            <div class="header-right">
                <div class="ws-badge" id="wsBadge"><span class="dot"></span><span id="wsText">Offline</span></div>
                <button class="btn-icon" onclick="toggleTheme()" title="Toggle theme" id="themeBtn">
                    <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </svg>
                    <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        style="display:none">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                </button>
                <button class="lang-btn" onclick="toggleLang()" id="langBtn">EN</button>
            </div>
        </header>
        <div class="overlay" id="overlay" onclick="closeSidebar()"></div>
        <div class="main">
            <nav class="sidebar" id="sidebar">
                <div class="sidebar-nav">
                    <a class="nav-item active" data-page="dashboard" onclick="go('dashboard',this)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="7" height="7" rx="1.5" />
                            <rect x="14" y="3" width="7" height="7" rx="1.5" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" />
                            <rect x="14" y="14" width="7" height="7" rx="1.5" />
                        </svg>
                        <span data-i18n="dashboard"></span>
                    </a>
                    <a class="nav-item" data-page="bots" onclick="go('bots',this)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <rect x="5" y="8" width="14" height="10" rx="2" />
                            <circle cx="9" cy="13" r="1" fill="currentColor" />
                            <circle cx="15" cy="13" r="1" fill="currentColor" />
                            <line x1="12" y1="4" x2="12" y2="8" />
                            <circle cx="9" cy="4" r="1.5" fill="currentColor" />
                            <circle cx="15" cy="4" r="1.5" fill="currentColor" />
                        </svg>
                        <span data-i18n="bots"></span>
                    </a>
                    <a class="nav-item" data-page="events" onclick="go('events',this)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 01-3.46 0" />
                        </svg>
                        <span data-i18n="events"></span>
                    </a>
                    <a class="nav-item" data-page="modules" onclick="go('modules',this)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <path
                                d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                        <span data-i18n="modules"></span>
                    </a>
                    <a class="nav-item" data-page="store" onclick="go('store',this)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 01-8 0" />
                        </svg>
                        <span data-i18n="store"></span>
                    </a>
                    <a class="nav-item" data-page="config" onclick="go('config',this)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path
                                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.82 1.18V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1.08H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.08V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.2.65.77 1.09 1.51 1.08H21a2 2 0 010 4h-.09c-.74 0-1.31.44-1.51 1.08z" />
                        </svg>
                        <span data-i18n="config"></span>
                    </a>
                </div>
                <div class="sidebar-footer"><span class="fw-ver" id="fwInfo">Loading...</span><button
                        class="restart-btn" onclick="restartFramework()" title="Restart"><svg viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                            stroke-linejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                        </svg><span data-i18n="restart"></span></button></div>
            </nav>
            <div class="content">
                <div class="page active" id="p-dashboard">
                    <h1 class="page-title" data-i18n="dashboard"></h1>
                    <p class="page-desc" id="fwDesc"></p>
                    <div class="grid-4" style="margin-bottom:20px" id="statGrid"></div>
                    <div class="grid-2">
                        <div class="card">
                            <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="2" y1="12" x2="22" y2="12" />
                                    <path
                                        d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                                </svg><span data-i18n="adapters"></span></div>
                            <div class="card-body" id="dashAdapters"></div>
                        </div>
                        <div class="card">
                            <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path
                                        d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                                </svg><span data-i18n="modules_label"></span></div>
                            <div class="card-body" id="dashModules"></div>
                        </div>
                    </div>
                    <div class="card" style="margin-top:16px">
                        <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 01-3.46 0" />
                            </svg><span data-i18n="live_events"></span>
                            <div class="header-actions"><button class="btn-icon" onclick="clearEvents()"
                                    title="Clear"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                        style="width:16px;height:16px">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path
                                            d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                    </svg></button></div>
                        </div>
                        <div id="dashEvents" style="max-height:280px;overflow-y:auto"></div>
                    </div>
                </div>
                <div class="page" id="p-bots">
                    <h1 class="page-title" data-i18n="bots"></h1>
                    <p class="page-desc" data-i18n="bots_desc"></p>
                    <div class="grid-3" style="margin-top:16px" id="botGrid"></div>
                </div>
                <div class="page" id="p-events">
                    <h1 class="page-title" data-i18n="events"></h1>
                    <p class="page-desc" data-i18n="events_desc"></p>
                    <div class="filter-bar">
                        <select id="eTypeFilter" onchange="loadEvents()">
                            <option value="">--</option>
                            <option value="message">Message</option>
                            <option value="notice">Notice</option>
                            <option value="request">Request</option>
                            <option value="meta">Meta</option>
                        </select>
                        <select id="ePlatFilter" onchange="loadEvents()">
                            <option value="">--</option>
                        </select>
                        <div style="flex:1"></div>
                        <button class="btn btn-secondary btn-sm" onclick="loadEvents()"><svg viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" style="width:14px;height:14px">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                            </svg></button>
                        <button class="btn btn-secondary btn-sm" onclick="clearEvents()"><svg viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" style="width:14px;height:14px">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg></button>
                    </div>
                    <div class="card">
                        <div id="eventList" style="max-height:calc(100vh - 260px);overflow-y:auto"></div>
                    </div>
                </div>
                <div class="page" id="p-modules">
                    <h1 class="page-title" data-i18n="modules"></h1>
                    <p class="page-desc" data-i18n="modules_desc"></p>
                    <div class="card" style="margin-top:16px">
                        <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path
                                    d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                            </svg><span data-i18n="adapters"></span><span class="chip chip-pr" id="adapterCount"
                                style="margin-left:6px"></span>
                            <div class="header-actions"><button class="btn-icon" onclick="loadModules()"
                                    title="Refresh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                        style="width:16px;height:16px">
                                        <polyline points="23 4 23 10 17 10" />
                                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                                    </svg></button></div>
                        </div>
                        <div id="adapterList"></div>
                    </div>
                    <div class="card" style="margin-top:16px">
                        <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path
                                    d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                <line x1="12" y1="22.08" x2="12" y2="12" />
                            </svg><span data-i18n="modules_label"></span><span class="chip chip-sc" id="moduleCount"
                                style="margin-left:6px"></span>
                            <div class="header-actions"><button class="btn-icon" onclick="loadModules()"
                                    title="Refresh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                        style="width:16px;height:16px">
                                        <polyline points="23 4 23 10 17 10" />
                                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                                    </svg></button></div>
                        </div>
                        <div id="moduleList"></div>
                    </div>
                </div>
                <div class="page" id="p-store">
                    <h1 class="page-title" data-i18n="store"></h1>
                    <p class="page-desc" data-i18n="store_desc"></p>
                    <div class="filter-bar" style="margin-top:16px">
                        <input type="text" id="storeSearch" data-i18n-placeholder="search_packages"
                            oninput="debounceStore()">
                        <button class="btn btn-secondary btn-sm" onclick="loadStore()"><svg viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" style="width:14px;height:14px">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                            </svg></button>
                    </div>
                    <div class="card" style="margin-top:12px;margin-bottom:16px">
                        <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                style="width:16px;height:16px">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg><span data-i18n="upload_title"></span></div>
                        <div style="padding:12px 16px;display:flex;align-items:center;gap:12px">
                            <span style="font-size:13px;color:var(--tx-s)" data-i18n="upload_desc"></span>
                            <div style="flex:1"></div>
                            <input type="file" id="uploadFileInput" accept=".whl,.zip" style="display:none"
                                onchange="uploadModule(this)">
                            <button class="btn btn-primary btn-sm"
                                onclick="document.getElementById('uploadFileInput').click()"><svg viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                    stroke-linejoin="round" style="width:14px;height:14px;margin-right:4px">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg><span data-i18n="upload_btn"></span></button>
                        </div>
                    </div>
                    <div class="grid-3" id="storeGrid"></div>
                </div>
                <div class="page" id="p-config">
                    <h1 class="page-title" data-i18n="config"></h1>
                    <p class="page-desc" data-i18n="config_desc"></p>
                    <div class="card" style="margin-top:16px">
                        <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path
                                    d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.82 1.18V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1.08H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.08V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.2.65.77 1.09 1.51 1.08H21a2 2 0 010 4h-.09c-.74 0-1.31.44-1.51 1.08z" />
                            </svg><span data-i18n="configuration"></span>
                            <div class="header-actions"><button class="btn-icon" onclick="loadConfig()"
                                    title="Refresh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                        style="width:16px;height:16px">
                                        <polyline points="23 4 23 10 17 10" />
                                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                                    </svg></button></div>
                        </div>
                        <div id="configBody" style="max-height:420px;overflow-y:auto"></div>
                    </div>
                    <div class="card" style="margin-top:16px">
                        <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <ellipse cx="12" cy="5" rx="9" ry="3" />
                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                            </svg><span data-i18n="storage"></span><span class="chip chip-pr" id="storageCount"
                                style="margin-left:8px"></span>
                            <div class="header-actions"><button class="btn-icon" onclick="loadConfig()"
                                    title="Refresh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                        style="width:16px;height:16px">
                                        <polyline points="23 4 23 10 17 10" />
                                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                                    </svg></button></div>
                        </div>
                        <div id="storageBody" style="max-height:420px;overflow-y:auto"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="modalOv">
        <div class="modal-box">
            <div class="modal-title" id="modalTitle"></div>
            <div class="modal-text" id="modalText"></div>
            <div class="modal-actions" id="modalActions"></div>
        </div>
    </div>

    <div class="modal-overlay output-modal" id="outputOv">
        <div class="modal-box">
            <div class="modal-title" id="outputTitle"></div>
            <pre class="output-pre" id="outputPre"></pre>
            <div class="modal-actions" id="outputActions"></div>
        </div>
    </div>

    <div class="login-overlay" id="loginOv">
        <div class="login-card">
            <h2 data-i18n="auth_title"></h2>
            <p data-i18n="auth_desc_text"></p>
            <div class="form-group">
                <label data-i18n="auth_label"></label>
                <input id="loginInput" type="password" data-i18n-placeholder="auth_placeholder"
                    onkeydown="if(event.key==='Enter')doLogin()">
            </div>
            <div class="login-hint" id="authHint"></div>
            <div class="login-actions">
                <button class="btn btn-secondary" onclick="closeLogin()" data-i18n="cancel"></button>
                <button class="btn btn-primary" onclick="doLogin()" data-i18n="login"></button>
            </div>
        </div>
    </div>

    <script>
        const API = '/Dashboard', TK = '__ep_tk__';
        let ws = null, allEvents = [], platforms = [], authed = false;

        const I18N = {
            zh: {
                dashboard: '仪表盘', bots: '机器人', events: '事件流', modules: '插件', store: '模块商店', config: '配置管理',
                loading: '加载中...', online: '在线', offline: '离线', live: '实时',
                adapters: '适配器', modules_label: '模块', online_bots: '在线机器人', total_events: '事件总数',
                no_adapters: '暂无适配器', no_modules: '暂无模块', no_events: '暂无事件', no_bots: '暂无机器人',
                active: '活跃', inactive: '未活跃',
                enable: '启用', load: '加载', unload: '停止加载', install: '安装',
                search_packages: '搜索包...', live_events: '实时事件', waiting_events: '等待事件...',
                bots_desc: '各平台已发现的机器人', events_desc: '实时事件流',
                modules_desc: '管理已注册的模块和适配器', store_desc: '浏览并安装包',
                config_desc: '查看和管理配置与存储', configuration: '配置', storage: '存储',
                auth_title: '身份验证', auth_desc_text: '请输入访问令牌以继续', auth_label: '访问令牌',
                auth_placeholder: '请输入令牌',
                auth_hint: '令牌存储在配置中的 <code>Dashboard.token</code>',
                login: '登录', cancel: '取消', ok: '确定',
                logged_in: '登录成功', invalid_token: '无效令牌', action_completed: '操作完成', action_failed: '操作失败',
                installing: '安装中...', installed: '安装成功，建议重启框架', install_failed: '安装失败',
                install_success: '安装完成', install_timeout: '安装超时', install_restart_title: '重启加载新模块', install_restart_confirm: '模块安装成功，是否立即重启框架以加载新模块？', install_restart_btn: '重启',
                install_detail: '安装详情', no_token_refresh: '服务未就绪，请稍后刷新',
                unload_self_title: '警告', unload_self_confirm: '停止加载仪表盘模块后，你将无法再通过网页访问此界面。确定要继续吗？',
                upload_title: '上传安装', upload_desc: '上传 whl 或 zip 包直接安装模块', upload_btn: '选择文件并安装', uploading: '上传安装中...', upload_failed: '上传安装失败',
                restart: '重启框架', restart_confirm: '确定要重启框架吗？这将重新加载所有模块和适配器。',
                restart_success: '框架重启中...', restart_failed: '重启失败',
                clear_events: '清除事件', clear_confirm: '确定要清除所有事件日志吗？',
                all_types: '所有类型', all_platforms: '所有平台',
                no_packages: '没有匹配的包', failed_registry: '加载注册表失败',
                event_cleared: '事件已清除', empty_storage: '存储为空',
            },
            en: {
                dashboard: 'Dashboard', bots: 'Bots', events: 'Events', modules: 'Plugins', store: 'Module Store', config: 'Configuration',
                loading: 'Loading...', online: 'Online', offline: 'Offline', live: 'Live',
                adapters: 'Adapters', modules_label: 'Modules', online_bots: 'Online Bots', total_events: 'Total Events',
                no_adapters: 'No adapters', no_modules: 'No modules', no_events: 'No events', no_bots: 'No bots',
                active: 'Active', inactive: 'Inactive',
                enable: 'Enable', load: 'Load', unload: 'Unload', install: 'Install',
                search_packages: 'Search packages...', live_events: 'Live Events', waiting_events: 'Waiting for events...',
                bots_desc: 'Discovered bots across platforms', events_desc: 'Real-time event stream',
                modules_desc: 'Manage registered modules and adapters', store_desc: 'Browse and install packages',
                config_desc: 'View and manage configuration and storage', configuration: 'Configuration', storage: 'Storage',
                auth_title: 'Authentication', auth_desc_text: 'Please enter your access token to continue', auth_label: 'Access Token',
                auth_placeholder: 'Enter your token',
                auth_hint: 'Token is stored in config at <code>Dashboard.token</code>',
                login: 'Login', cancel: 'Cancel', ok: 'OK',
                logged_in: 'Logged in successfully', invalid_token: 'Invalid token', action_completed: 'Action completed', action_failed: 'Action failed',
                installing: 'Installing...', installed: 'Installed! Restart recommended', install_failed: 'Install failed',
                install_success: 'Install complete', install_timeout: 'Install timed out', install_restart_title: 'Restart to load new module', install_restart_confirm: 'Module installed successfully. Restart framework now to load it?', install_restart_btn: 'Restart',
                install_detail: 'Install Details', no_token_refresh: 'Service not ready, please refresh later',
                unload_self_title: 'Warning', unload_self_confirm: 'After unloading the dashboard module, you will not be able to access this interface via web. Continue?',
                upload_title: 'Upload Install', upload_desc: 'Upload a whl or zip package to install module', upload_btn: 'Select File & Install', uploading: 'Uploading & Installing...', upload_failed: 'Upload install failed',
                restart: 'Restart', restart_confirm: 'Restart the framework? This will reload all modules and adapters.',
                restart_success: 'Restarting framework...', restart_failed: 'Restart failed',
                clear_events: 'Clear Events', clear_confirm: 'Clear all event logs?',
                all_types: 'All Types', all_platforms: 'All Platforms',
                no_packages: 'No matching packages', failed_registry: 'Failed to load registry',
                event_cleared: 'Events cleared', empty_storage: 'Storage is empty',
            }
        };
        let lang = localStorage.getItem('ep_lang') || 'zh';
        function t(k) { return I18N[lang]?.[k] || k }
        function toggleLang() { lang = lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('ep_lang', lang); applyI18n(); loadAll() }
        function applyI18n() {
            document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (I18N[lang][k]) el.textContent = I18N[lang][k] });
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const k = el.getAttribute('data-i18n-placeholder'); if (I18N[lang][k]) el.placeholder = I18N[lang][k] });
            const ah = document.getElementById('authHint'); if (ah && I18N[lang].auth_hint) ah.innerHTML = I18N[lang].auth_hint;
            document.getElementById('langBtn').textContent = lang === 'zh' ? 'EN' : '中文';
            document.title = lang === 'zh' ? 'ErisPulse 仪表盘' : 'ErisPulse Dashboard';
            const tf = document.getElementById('eTypeFilter');
            if (tf) { tf.options[0].textContent = lang === 'zh' ? '所有类型' : 'All Types' }
            const pf = document.getElementById('ePlatFilter');
            if (pf) { pf.options[0].textContent = lang === 'zh' ? '所有平台' : 'All Platforms' }
        }

        function getTheme() {
            const s = localStorage.getItem('ep_theme');
            if (s) return s;
            return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
        }
        function applyTheme(th) {
            document.documentElement.setAttribute('data-theme', th);
            const sun = document.querySelector('#themeBtn .icon-sun');
            const moon = document.querySelector('#themeBtn .icon-moon');
            if (th === 'dark') { sun.style.display = 'block'; moon.style.display = 'none' }
            else { sun.style.display = 'none'; moon.style.display = 'block' }
        }
        function toggleTheme() { const th = getTheme() === 'dark' ? 'light' : 'dark'; localStorage.setItem('ep_theme', th); applyTheme(th) }

        function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('show') }
        function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('show') }

        function esc(s) { if (s == null) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

        function api(path, opts) {
            const tk = localStorage.getItem(TK);
            const headers = { ...(opts?.headers || {}), ...(tk ? { 'Authorization': 'Bearer ' + tk } : {}) };
            if (opts?.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
            return fetch(API + path, { ...opts, headers }).then(r => {
                if (r.status === 401) { authed = false; localStorage.removeItem(TK); document.querySelector('.app').classList.remove('authed'); showLogin(); return null }
                return r.json()
            }).catch(() => null);
        }

        function go(name, el) {
            if (!authed) { showLogin(); return }
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById('p-' + name).classList.add('active');
            if (el) el.classList.add('active');
            closeSidebar();
            if (name === 'events') loadEvents();
            if (name === 'config') loadConfig();
            if (name === 'bots') loadBots();
            if (name === 'modules') loadModules();
            if (name === 'store') loadStore();
        }

        function showModal(title, text, actions) {
            return new Promise(r => {
                document.getElementById('modalTitle').textContent = title;
                document.getElementById('modalText').innerHTML = text;
                const ac = document.getElementById('modalActions'); ac.innerHTML = '';
                actions.forEach(a => {
                    const b = document.createElement('button');
                    b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-secondary');
                    b.textContent = a.label;
                    b.onclick = () => { document.getElementById('modalOv').classList.remove('show'); r(a.value) };
                    ac.appendChild(b);
                });
                document.getElementById('modalOv').classList.add('show');
            });
        }
        function confirm2(title, text) { return showModal(title, text, [{ label: t('cancel'), value: false }, { label: t('ok'), value: true, primary: true }]) }
        function alert2(title, text) { return showModal(title, text, [{ label: t('ok'), value: true, primary: true }]) }

        function showOutputModal(title, lines, actions) {
            return new Promise(r => {
                document.getElementById('outputTitle').textContent = title;
                const pre = document.getElementById('outputPre');
                pre.textContent = (lines || []).join('\n') || '(no output)';
                const ac = document.getElementById('outputActions'); ac.innerHTML = '';
                actions.forEach(a => {
                    const b = document.createElement('button');
                    b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-secondary');
                    b.textContent = a.label;
                    b.onclick = () => { document.getElementById('outputOv').classList.remove('show'); r(a.value) };
                    ac.appendChild(b);
                });
                document.getElementById('outputOv').classList.add('show');
            });
        }

        function toast(msg, type) {
            const el = document.createElement('div');
            el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:8px;font-size:14px;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:9999;opacity:0;transition:opacity .2s;pointer-events:none';
            if (type === 'ok') { el.style.background = 'var(--ok-bg)'; el.style.color = 'var(--ok-c)'; el.style.border = '1px solid var(--ok-bd)' }
            else if (type === 'er') { el.style.background = 'var(--er-bg)'; el.style.color = 'var(--er-c)'; el.style.border = '1px solid var(--er-bd)' }
            else { el.style.background = 'var(--bg-t)'; el.style.color = 'var(--tx-p)'; el.style.border = '1px solid var(--bd)' }
            el.textContent = msg; document.body.appendChild(el);
            requestAnimationFrame(() => el.style.opacity = '1');
            setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200) }, 2500);
        }

        function showLogin() { document.querySelector('.app').classList.remove('authed'); document.getElementById('loginOv').classList.add('show'); document.getElementById('loginInput').focus() }
        function closeLogin() { document.getElementById('loginOv').classList.remove('show') }
        let _loginLock = false;
        async function doLogin() {
            if (_loginLock) return; _loginLock = true;
            const inp = document.getElementById('loginInput');
            const btn = inp.closest('.login-card').querySelector('.btn-primary');
            btn.disabled = true; btn.style.opacity = '.5';
            const v = inp.value.trim(); if (!v) { _loginLock = false; btn.disabled = false; btn.style.opacity = ''; return }
            const d = await api('/api/auth', { method: 'POST', body: JSON.stringify({ token: v }) });
            if (d && d.success) {
                localStorage.setItem(TK, v); authed = true; closeLogin();
                document.querySelector('.app').classList.add('authed');
                loadAll(); wsConnect(); setInterval(refreshDashboard, 5000);
                toast(t('logged_in'), 'ok');
            } else {
                if (!authed) localStorage.removeItem(TK);
                toast(t('invalid_token'), 'er');
                inp.select();
            }
            btn.disabled = false; btn.style.opacity = ''; _loginLock = false;
        }

        function evHtml(e) {
            const tm = new Date(e.time * 1000).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return '<div class="ev-item"><span class="ev-badge ' + e.type + '">' + esc(e.type) + '</span><div style="flex:1;min-width:0"><div>' + esc(e.alt_message || e.detail_type || '-') + '</div>' + (e.user_id ? '<div style="font-size:11px;color:var(--tx-s)">user: ' + esc(e.user_id) + '</div>' : '') + '</div><span style="font-size:11px;color:var(--tx-s);flex-shrink:0">' + esc(e.platform) + '</span><span style="font-size:11px;color:var(--tx-t);flex-shrink:0">' + tm + '</span></div>';
        }

        async function refreshDashboard() {
            const d = await api('/api/status'); if (!d) return;
            const fw = d.framework || {};
            document.getElementById('fwDesc').textContent = 'ErisPulse v' + fw.version + ' | Python ' + fw.python_version;
            document.getElementById('fwInfo').textContent = 'ErisPulse v' + fw.version;
            const ad = d.adapters || {}, mo = d.modules || {};
            let ob = 0; Object.values(ad).forEach(a => Object.values(a.bots || {}).forEach(b => { if (b.status === 'online') ob++ }));
            document.getElementById('statGrid').innerHTML =
                statCard(Object.keys(ad).length, t('adapters')) +
                statCard(Object.keys(mo).filter(k => mo[k]).length, t('modules_label')) +
                statCard(ob, t('online_bots')) +
                statCard(allEvents.length, t('total_events'));

            let aH = ''; Object.entries(ad).forEach(([n, i]) => {
                const on = i.status === 'started';
                aH += '<div class="list-row"><span class="chip ' + (on ? 'chip-ok' : 'chip-er') + '" style="min-width:60px;justify-content:center">' + esc(i.status) + '</span><span style="flex:1;font-weight:500">' + esc(n) + '</span><span style="font-size:12px;color:var(--tx-s)">' + Object.keys(i.bots || {}).length + ' bots</span></div>';
            });
            document.getElementById('dashAdapters').innerHTML = aH || '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' + t('no_adapters') + '</div>';

            let mH = ''; Object.entries(mo).forEach(([n, l]) => {
                mH += '<div class="list-row"><span class="chip ' + (l ? 'chip-ok' : 'chip-er') + '" style="min-width:60px;justify-content:center">' + (l ? t('active') : t('inactive')) + '</span><span style="flex:1;font-weight:500">' + esc(n) + '</span></div>';
            });
            document.getElementById('dashModules').innerHTML = mH || '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' + t('no_modules') + '</div>';

            platforms = Object.keys(ad);
        }

        function statCard(v, label) {
            return '<div class="stat-card"><div class="stat-val">' + v + '</div><div class="stat-label">' + esc(label) + '</div></div>';
        }

        async function loadEvents() {
            const tf = document.getElementById('eTypeFilter')?.value || '';
            const pf = document.getElementById('ePlatFilter')?.value || '';
            const u = new URLSearchParams({ limit: '100' }); if (tf) u.set('type', tf); if (pf) u.set('platform', pf);
            const d = await api('/api/events?' + u); if (!d) return;
            allEvents = d.events || [];
            document.getElementById('eventList').innerHTML = allEvents.length ? allEvents.slice().reverse().map(evHtml).join('') : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg><p>' + t('no_events') + '</p></div>';
            document.getElementById('dashEvents').innerHTML = allEvents.slice(-20).reverse().map(evHtml).join('') || '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' + t('waiting_events') + '</div>';
            const ps = document.getElementById('ePlatFilter');
            if (ps && platforms.length) {
                const ex = new Set([...ps.options].map(o => o.value));
                platforms.forEach(p => { if (!ex.has(p)) { const o = document.createElement('option'); o.value = p; o.textContent = p; ps.appendChild(o) } });
            }
        }

        async function clearEvents() {
            if (!authed) return showLogin();
            const ok = await confirm2(t('clear_events'), t('clear_confirm')); if (!ok) return;
            await api('/api/events/clear', { method: 'POST' });
            allEvents = []; loadEvents();
        }

        async function loadBots() {
            const d = await api('/api/bots'); if (!d) return;
            const b = d.bots || [];
            document.getElementById('botGrid').innerHTML = b.length ? b.map(x => {
                const i = x.info || {}, nm = i.user_name || i.nickname || x.bot_id, av = i.avatar;
                const la = x.last_active ? new Date(x.last_active * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US') : 'Never';
                const on = x.status === 'online';
                return '<div class="bot-card"><div class="bot-avatar">' + (av ? '<img src="' + esc(av) + '" onerror="this.outerHTML=\'<svg viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; style=&quot;width:24px;height:24px;opacity:.7&quot;><rect x=&quot;5&quot; y=&quot;8&quot; width=&quot;14&quot; height=&quot;10&quot; rx=&quot;2&quot;/><circle cx=&quot;9&quot; cy=&quot;13&quot; r=&quot;1&quot; fill=&quot;currentColor&quot;/><circle cx=&quot;15&quot; cy=&quot;13&quot; r=&quot;1&quot; fill=&quot;currentColor&quot;/></svg>\'">' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>') + '</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">' + esc(nm) + '</div><div style="font-size:12px;color:var(--tx-s);margin-top:2px">' + esc(x.platform) + ' / ' + esc(x.bot_id) + '</div></div><div style="text-align:right;flex-shrink:0"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><span class="dot" style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:' + (on ? 'var(--ok-c)' : 'var(--tx-t)') + '"></span><span style="font-size:12px;font-weight:500;color:' + (on ? 'var(--ok-c)' : 'var(--tx-s)') + '">' + (on ? t('online') : t('offline')) + '</span></div><div style="font-size:11px;color:var(--tx-t);margin-top:4px">' + esc(la) + '</div></div></div>';
            }).join('') : '<div class="empty-state" style="grid-column:span 3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg><h3>' + t('no_bots') + '</h3></div>';
        }

        async function loadModules() {
            const d = await api('/api/modules'); if (!d) return;
            const items = d.modules || [];
            const adapters = items.filter(m => m.type === 'adapter');
            const modules = items.filter(m => m.type === 'module');
            document.getElementById('adapterCount').textContent = adapters.length;
            document.getElementById('moduleCount').textContent = modules.length;
            document.getElementById('adapterList').innerHTML = adapters.length ? adapters.map(m => renderPluginRow(m, true)).join('') : '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' + t('no_adapters') + '</div>';
            document.getElementById('moduleList').innerHTML = modules.length ? modules.map(m => renderPluginRow(m, false)).join('') : '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' + t('no_modules') + '</div>';
        }
        function renderPluginRow(m, isAd) {
            const cl = m.loaded ? 'chip-ok' : 'chip-er';
            let acts = '';
            if (!isAd) {
                if (!m.loaded) acts += '<button class="btn btn-primary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'load\',\'' + esc(m.type) + '\')">' + t('load') + '</button> ';
                if (m.loaded) acts += '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'unload\',\'' + esc(m.type) + '\')">' + t('unload') + '</button> ';
            } else {
                if (!m.loaded) acts += '<button class="btn btn-primary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'load\',\'' + esc(m.type) + '\')">' + t('load') + '</button> ';
                if (m.loaded) acts += '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'unload\',\'' + esc(m.type) + '\')">' + t('unload') + '</button> ';
            }
            return '<div class="list-row"><span class="chip ' + cl + '" style="min-width:64px;justify-content:center">' + (m.loaded ? t('active') : t('inactive')) + '</span><span style="flex:1;font-weight:500">' + esc(m.name) + '</span><div style="display:flex;gap:4px">' + acts + '</div></div>';
        }
        async function moduleAction(name, action, type) {
            if (!authed) return showLogin();
            if (action === 'unload' && name === 'Dashboard') {
                const ok = await confirm2(t('unload_self_title'), t('unload_self_confirm')); if (!ok) return;
            }
            const d = await api('/api/modules/action', { method: 'POST', body: JSON.stringify({ name, action, type }) });
            if (d && d.success) {
                setTimeout(loadModules, 300); toast(t('action_completed'), 'ok');
            } else toast(t('action_failed'), 'er');
        }

        let _storeTimer;
        function debounceStore() { clearTimeout(_storeTimer); _storeTimer = setTimeout(loadStore, 300) }
        async function loadStore() {
            const q = document.getElementById('storeSearch')?.value?.toLowerCase() || '';
            const d = await api('/api/store/remote');
            if (!d || !d.packages) { document.getElementById('storeGrid').innerHTML = '<div class="empty-state" style="grid-column:span 3"><p>' + t('failed_registry') + '</p></div>'; return }
            const pk = d.packages;
            const all = [...Object.entries(pk.modules || {}).map(([n, i]) => ({ ...i, name: n, type: 'module' })), ...Object.entries(pk.adapters || {}).map(([n, i]) => ({ ...i, name: n, type: 'adapter' }))];
            const f = q ? all.filter(i => (i.name + i.description + i.package).toLowerCase().includes(q)) : all;
            document.getElementById('storeGrid').innerHTML = f.length ? f.map(i => '<div class="store-card"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px;font-weight:600">' + esc(i.name) + '</span><span class="chip chip-pr">' + esc(i.type) + '</span></div><div style="font-size:12px;color:var(--tx-t);font-family:Consolas,Monaco,monospace">' + esc(i.package) + '</div><div style="font-size:13px;color:var(--tx-s);line-height:1.4;margin-top:4px">' + esc(i.description || '-') + '</div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><span style="font-size:12px;color:var(--tx-s);font-weight:500">v' + esc(i.version || '?') + '</span><button class="btn btn-primary btn-sm" onclick="installPkg(\'' + esc(i.package) + '\')">' + t('install') + '</button></div></div>').join('') : '<div class="empty-state" style="grid-column:span 3"><p>' + t('no_packages') + '</p></div>';
        }
        let _installTaskIds = new Map();
        async function installPkg(pkg) {
            if (!authed) return showLogin();
            const ok = await confirm2(t('install'), 'Install <strong>' + esc(pkg) + '</strong>?'); if (!ok) return;
            const d = await api('/api/store/install', { method: 'POST', body: JSON.stringify({ packages: [pkg] }) });
            if (d && d.success && d.task_id) {
                _installTaskIds.set(d.task_id, pkg);
                toast(t('installing'), '');
            } else {
                toast(t('install_failed'), 'er');
            }
        }
        async function uploadModule(input) {
            if (!authed) return showLogin();
            const file = input.files && input.files[0];
            if (!file) return;
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext !== 'whl' && ext !== 'zip') { toast(t('upload_failed'), 'er'); input.value = ''; return }
            const fd = new FormData();
            fd.append('file', file);
            const ok = await confirm2(t('upload_title'), 'Upload <strong>' + esc(file.name) + '</strong>?'); if (!ok) { input.value = ''; return }
            const d = await api('/api/store/upload', { method: 'POST', body: fd });
            if (d && d.success && d.task_id) {
                _installTaskIds.set(d.task_id, file.name);
                toast(t('uploading'), '');
            } else {
                toast(t('upload_failed'), 'er');
            }
            input.value = '';
        }
        async function restartFramework() {
            if (!authed) return showLogin();
            const ok = await confirm2(t('restart'), t('restart_confirm')); if (!ok) return;
            toast(t('restart_success'), '');
            const d = await api('/api/restart', { method: 'POST' });
            if (!d || !d.success) { toast(t('restart_failed'), 'er') }
        }

        async function loadConfig() {
            const c = await api('/api/config');
            if (c && c.config) { window._kvData = c.config; document.getElementById('configBody').innerHTML = kvTree(c.config, 'config', '') };
            const s = await api('/api/storage');
            if (s) {
                document.getElementById('storageCount').textContent = (s.total || 0) + ' ' + t('total_events').replace('事件', '');
                const k = s.keys || [];
                document.getElementById('storageBody').innerHTML = k.length ? k.slice(0, 200).map(x => kvRow(esc(x), s.data[x], 'storage', x)).join('') : '<div class="empty-state"><p>' + t('empty_storage') + '</p></div>';
            }
        }

        function kvRow(k, v, mode, fk) {
            const tp = v === null ? 'null' : typeof v;
            const ds = tp === 'object' ? JSON.stringify(v) : String(v);
            const saveFn = mode === 'config' ? 'saveConfig(this)' : 'saveStorage(this)';
            const delBtn = mode === 'storage' ? '<button class="kv-btn kv-btn-del" onclick="delStorage(\'' + esc(fk) + '\',this)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>' : '';
            return '<div class="kv-row"><div class="kv-key">' + esc(k) + '</div><div class="kv-actions"><input class="kv-input" type="text" value="' + esc(ds) + '" data-key="' + esc(fk) + '" data-type="' + tp + '" onfocus="this.select()" onkeydown="if(event.key===\'Enter\'){event.preventDefault();' + saveFn + '}"><button class="kv-btn kv-btn-save" onclick="' + saveFn + '" title="Save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>' + delBtn + '</div></div>';
        }

        function kvTree(obj, mode, pfx, dep) {
            dep = dep || 0; let h = '';
            for (const [k, v] of Object.entries(obj)) {
                const fk = pfx ? pfx + '.' + k : k;
                if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
                    h += '<div class="kv-group collapsed" style="margin-left:' + dep * 12 + 'px" data-pfx="' + esc(fk) + '" data-mode="' + mode + '" data-dep="' + (dep + 1) + '"><div class="kv-group-hd" onclick="toggleKvGroup(this)"><span class="kv-chevron">\u25BC</span><span style="flex:1">' + esc(k) + '</span><span class="kv-count">' + Object.keys(v).length + '</span></div><div class="kv-group-body"></div></div>';
                } else {
                    h += '<div style="margin-left:' + dep * 12 + 'px">' + kvRow(k, v, mode, fk) + '</div>';
                }
            }
            return h;
        }

        function toggleKvGroup(hd) {
            const g = hd.parentElement;
            const body = g.querySelector('.kv-group-body');
            if (g.classList.contains('collapsed')) {
                if (!body.innerHTML) {
                    const obj = window._kvData;
                    function find(d, t) { const keys = t.split('.'); let cur = d; for (const k of keys) { if (cur == null || typeof cur !== 'object') return null; cur = cur[k] } return cur }
                    const data = find(obj, g.dataset.pfx);
                    if (data && typeof data === 'object') body.innerHTML = kvTree(data, g.dataset.mode, g.dataset.pfx, parseInt(g.dataset.dep));
                }
                g.classList.remove('collapsed');
            } else {
                g.classList.add('collapsed');
            }
        }

        async function saveConfig(btn) {
            const inp = btn.previousElementSibling; const fk = inp.dataset.key; const tp = inp.dataset.type;
            let v = inp.value;
            if (tp === 'boolean') v = v === 'true'; else if (tp === 'number') v = Number(v); else if (tp === 'object') { try { v = JSON.parse(v) } catch (e) { return } }
            const d = await api('/api/config', { method: 'PUT', body: JSON.stringify({ key: fk, value: v }) });
            inp.style.border = d && d.success ? '2px solid var(--ok-c)' : '2px solid var(--er-c)';
            setTimeout(() => inp.style.border = '', 1200);
        }
        async function saveStorage(btn) {
            const inp = btn.previousElementSibling; const k = inp.dataset.key; let v = inp.value;
            try { v = JSON.parse(v) } catch (e) { }
            const d = await api('/api/storage', { method: 'POST', body: JSON.stringify({ key: k, value: v }) });
            inp.style.border = d && d.success ? '2px solid var(--ok-c)' : '2px solid var(--er-c)';
            setTimeout(() => inp.style.border = '', 1200);
        }
        async function delStorage(k, btn) {
            const row = btn.closest('.kv-row'); row.style.opacity = '.3';
            const d = await api('/api/storage/delete', { method: 'POST', body: JSON.stringify({ key: k }) });
            if (d && d.success) { row.style.transition = 'all .2s'; requestAnimationFrame(() => { row.style.maxHeight = '0'; row.style.padding = '0'; row.style.overflow = 'hidden'; row.style.borderWidth = '0'; setTimeout(() => row.remove(), 200) }) }
            else row.style.opacity = '1';
        }

        function wsConnect() {
            const p = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const u = p + '//' + location.host + API + '/ws?token=' + encodeURIComponent(localStorage.getItem(TK) || '');
            ws = new WebSocket(u);
            ws.onopen = () => { document.getElementById('wsBadge').classList.add('on'); document.getElementById('wsText').textContent = t('live') };
            ws.onclose = () => { document.getElementById('wsBadge').classList.remove('on'); document.getElementById('wsText').textContent = t('offline'); setTimeout(wsConnect, 3000) };
            ws.onerror = () => ws.close();
            ws.onmessage = e => {
                try {
                    const m = JSON.parse(e.data);
                    if (m.type === 'event') {
                        allEvents.push(m.data); if (allEvents.length > 500) allEvents.shift();
                        const sv = document.getElementById('statGrid');
                        if (sv && sv.children[3]) sv.children[3].querySelector('.stat-val').textContent = allEvents.length;
                        if (document.querySelector('.page.active')?.id === 'p-dashboard') {
                            const dh = document.getElementById('dashEvents'); const em = dh?.querySelector('.empty-state');
                            if (em) em.remove(); dh?.insertAdjacentHTML('afterbegin', evHtml(m.data));
                            while (dh && dh.children.length > 20) dh.removeChild(dh.lastChild);
                        }
                    } else if (m.type === 'install_progress') {
                        const pkg = _installTaskIds.get(m.task_id) || '';
                        if (m.status === 'success') {
                            _installTaskIds.delete(m.task_id);
                            const title = pkg + ': ' + t('install_success');
                            showOutputModal(title + ' - ' + t('install_detail'), m.output || [], [{ label: t('install_restart_btn'), value: 'restart', primary: true }, { label: t('ok'), value: true }]).then(v => {
                                if (v === 'restart') restartFramework();
                            });
                            loadModules();
                        } else if (m.status === 'error') {
                            _installTaskIds.delete(m.task_id);
                            showOutputModal(pkg + ': ' + t('install_failed'), m.output || [], [{ label: t('ok'), value: true }]);
                        }
                    }
                } catch (err) { }
            };
        }

        function loadAll() { refreshDashboard(); loadEvents(); loadBots(); loadModules(); loadConfig(); loadStore() }

        (function () {
            applyTheme(getTheme()); applyI18n();
            const tk = localStorage.getItem(TK);
            if (tk) {
                fetch(API + '/api/auth/status', { headers: { 'Authorization': 'Bearer ' + tk } }).then(r => r.json()).then(d => {
                    if (d && d.authenticated) {
                        authed = true;
                        document.querySelector('.app').classList.add('authed');
                        loadAll(); wsConnect();
                        setInterval(refreshDashboard, 5000);
                    } else { localStorage.removeItem(TK); showLogin() }
                }).catch(() => { showLogin() });
            } else { showLogin() }
        })();
    </script>
</body>

</html>
"""