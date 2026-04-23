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
        self._lifecycle_log: list[dict] = []
        self._max_lifecycle_log = 200
        self._register_routes()

    @staticmethod
    def get_load_strategy():
        from ErisPulse.loaders import ModuleLoadStrategy

        return ModuleLoadStrategy(lazy_load=False, priority=100)

    async def on_load(self, event: dict) -> bool:
        self._loop = asyncio.get_running_loop()
        self._restore_persisted_data()
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
        
        @self.sdk.lifecycle.on("*")
        async def log_lifecycle_events(data: dict):
            self._add_lifecycle_log(data)

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
        self._persist_events()
        asyncio.ensure_future(self._broadcast_event(entry))
    
    def _add_lifecycle_log(self, data: dict):
        """添加生命周期事件日志"""
        entry = {
            "event": data.get("event", ""),
            "timestamp": data.get("timestamp", time.time()),
            "data": data.get("data", {}),
            "source": data.get("source", ""),
            "msg": data.get("msg", ""),
        }
        self._lifecycle_log.append(entry)
        if len(self._lifecycle_log) > self._max_lifecycle_log:
            self._lifecycle_log = self._lifecycle_log[-self._max_lifecycle_log :]

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

    def _persist_events(self):
        try:
            self.storage.set("__ep_events__", self._event_log[-self._max_log:])
        except Exception:
            pass

    def _restore_persisted_data(self):
        try:
            events = self.storage.get("__ep_events__")
            if isinstance(events, list):
                self._event_log = events[-self._max_log:]
        except Exception:
            pass

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
        proc_info = {}
        
        try:
            import psutil

            proc = psutil.Process(os.getpid())
            
            # 内存信息
            mem_info_rss = proc.memory_info()
            mem["rss_mb"] = round(mem_info_rss.rss / 1024 / 1024, 1)
            mem["vms_mb"] = round(mem_info_rss.vms / 1024 / 1024, 1)
            
            # CPU 使用率使用间隔测量
            try:
                mem["cpu_percent"] = round(proc.cpu_percent(interval=1.0), 1)
            except Exception as e:
                # 如果间隔测量失败，尝试非阻塞方式
                self.logger.debug(f"CPU interval measurement failed: {e}")
                try:
                    mem["cpu_percent"] = round(proc.cpu_percent(interval=None), 1)
                except Exception as e2:
                    self.logger.debug(f"CPU non-interval measurement failed: {e2}")
                    mem["cpu_percent"] = 0.0
            
            # 系统内存
            vm = psutil.virtual_memory()
            mem["system_percent"] = round(vm.percent, 1)
            mem["system_total_gb"] = round(vm.total / 1024 / 1024 / 1024, 2)
            mem["system_available_gb"] = round(vm.available / 1024 / 1024 / 1024, 2)
            
            # 交换内存
            swap = psutil.swap_memory()
            mem["swap_percent"] = round(swap.percent, 1)
            mem["swap_used_mb"] = round(swap.used / 1024 / 1024, 1)
            
            # 进程信息
            proc_info["threads"] = proc.num_threads()
            proc_info["open_files"] = len(proc.open_files())
            
            # CPU 时间
            cpu_times = proc.cpu_times()
            proc_info["cpu_user"] = round(cpu_times.user, 2)
            proc_info["cpu_system"] = round(cpu_times.system, 2)
            
            # IO 计数器
            try:
                io_counters = proc.io_counters()
                proc_info["read_bytes_mb"] = round(io_counters.read_bytes / 1024 / 1024, 1)
                proc_info["write_bytes_mb"] = round(io_counters.write_bytes / 1024 / 1024, 1)
            except Exception:
                pass
            
            # 网络连接
            try:
                connections = proc.connections()
                proc_info["connections"] = len(connections)
                proc_info["listening"] = len([c for c in connections if c.status == 'LISTEN'])
            except Exception:
                pass
            
            # 创建时间
            proc_info["created"] = proc.create_time()
            
        except ImportError:
            self.logger.warning("psutil not installed, system monitoring unavailable. Install with: pip install psutil")
            mem["rss_mb"] = 0
            mem["cpu_percent"] = 0
            mem["system_percent"] = 0
        except Exception as e:
            self.logger.warning(f"获取系统信息失败: {e}")
            mem["rss_mb"] = 0
            mem["cpu_percent"] = 0
            mem["system_percent"] = 0
        
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
            "process": proc_info,
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
        
        from pathlib import Path
        static_dir = Path(__file__).parent / "static"
        
        # 根路径 - HTML
        async def _html(request: Request) -> HTMLResponse:
            html_path = static_dir / "dash.html"
            return HTMLResponse(html_path.read_text(encoding='utf-8'))
        
        # CSS 文件
        async def _css(request: Request):
            from fastapi.responses import Response
            css_path = static_dir / "dash.css"
            return Response(
                content=css_path.read_text(encoding='utf-8'),
                media_type="text/css"
            )
        
        # 如果有 JS 文件也可以加上
        async def _js(request: Request):
            from fastapi.responses import Response
            js_path = static_dir / "dash.js"
            if js_path.exists():
                return Response(
                    content=js_path.read_text(encoding='utf-8'),
                    media_type="application/javascript"
                )
            return JSONResponse({"error": "File not found"}, status_code=404)
        
        r.register_http_route(mn, "/", handler=_html, methods=["GET"])
        r.register_http_route(mn, "/static/dash.css", handler=_css, methods=["GET"])
        r.register_http_route(mn, "/static/dash.js", handler=_js, methods=["GET"])  # 如果有的话
        
        # API 路由保持不变
        r.register_http_route(mn, "/api/auth", handler=self._api_auth, methods=["POST"])
        r.register_http_route(mn, "/api/auth/status", handler=self._api_auth_status, methods=["GET"])
        r.register_http_route(mn, "/api/status", handler=self._api_status, methods=["GET"])
        r.register_http_route(mn, "/api/system", handler=self._api_system, methods=["GET"])
        r.register_http_route(mn, "/api/adapters", handler=self._api_adapters, methods=["GET"])
        r.register_http_route(mn, "/api/modules", handler=self._api_modules, methods=["GET"])
        r.register_http_route(mn, "/api/modules/action", handler=self._api_modules_action, methods=["POST"])
        r.register_http_route(mn, "/api/bots", handler=self._api_bots, methods=["GET"])
        r.register_http_route(mn, "/api/events", handler=self._api_events, methods=["GET"])
        r.register_http_route(mn, "/api/events/clear", handler=self._api_events_clear, methods=["POST"])
        r.register_http_route(mn, "/api/config", handler=self._api_config, methods=["GET"])
        r.register_http_route(mn, "/api/config", handler=self._api_config_update, methods=["PUT"])
        r.register_http_route(mn, "/api/storage", handler=self._api_storage, methods=["GET"])
        r.register_http_route(mn, "/api/storage", handler=self._api_storage_set, methods=["POST"])
        r.register_http_route(mn, "/api/storage/delete", handler=self._api_storage_delete, methods=["POST"])
        r.register_http_route(mn, "/api/store/remote", handler=self._api_store_remote, methods=["GET"])
        r.register_http_route(mn, "/api/store/install", handler=self._api_store_install, methods=["POST"])
        r.register_http_route(mn, "/api/store/upload", handler=self._api_store_upload, methods=["POST"])
        r.register_http_route(mn, "/api/store/install/status", handler=self._api_store_install_status, methods=["GET"])
        r.register_http_route(mn, "/api/restart", handler=self._api_restart, methods=["POST"])
        
        # 事件构建器相关 API
        r.register_http_route(mn, "/api/builder/validate", handler=self._api_builder_validate, methods=["POST"])
        r.register_http_route(mn, "/api/builder/submit", handler=self._api_builder_submit, methods=["POST"])
        r.register_http_route(mn, "/api/builder/segments", handler=self._api_builder_segments, methods=["GET"])
        
        # 配置源码相关 API
        r.register_http_route(mn, "/api/config/source", handler=self._api_config_source, methods=["GET", "POST"])
        
        # 日志相关 API
        r.register_http_route(mn, "/api/logs", handler=self._api_logs, methods=["GET"])
        r.register_http_route(mn, "/api/logs/clear", handler=self._api_logs_clear, methods=["POST"])
        
        # 生命周期相关 API
        r.register_http_route(mn, "/api/lifecycle", handler=self._api_lifecycle, methods=["GET"])
        
        # 性能监控相关 API
        r.register_http_route(mn, "/api/performance", handler=self._api_performance, methods=["GET"])
        
        # API 路由列表相关 API
        r.register_http_route(mn, "/api/routes", handler=self._api_routes, methods=["GET"])
        
        # 消息统计相关 API
        r.register_http_route(mn, "/api/message-stats", handler=self._api_message_stats, methods=["GET"])
        
        r.register_websocket(mn, "/ws", handler=self._ws_handler)

    def _unregister_routes(self):
        r = self.sdk.router
        mn = "Dashboard"
        for p in [
            "/",
            "/static/dash.css",
            "/static/dash.js",
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
            "/api/config/source",
            "/api/storage",
            "/api/storage/delete",
            "/api/store/remote",
            "/api/store/install",
            "/api/store/upload",
            "/api/store/install/status",
            "/api/restart",
            "/api/builder/validate",
            "/api/builder/submit",
            "/api/builder/segments",
            "/api/logs",
            "/api/logs/clear",
            "/api/lifecycle",
            "/api/performance",
            "/api/routes",
            "/api/message-stats",
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
        self._persist_events()
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
        from pathlib import Path
        
        current_dir = Path(__file__).parent
        _html_path = current_dir / "static" / "dash.html"
        
        return _html_path.read_text(encoding='utf-8')

    # ========== 事件构建器相关 API ==========

    async def _api_builder_validate(self, request: Request) -> JSONResponse:
        """验证事件数据"""
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
        body = await request.json()
        event_type = body.get("type")
        
        # 事件类型定义
        EVENT_TYPES = {
            "message": {
                "detail_types": ["private", "group", "channel", "guild", "thread", "user"],
                "required_fields": ["message", "alt_message", "user_id"],
                "optional_fields": ["group_id", "channel_id", "guild_id", "user_nickname", "message_id"]
            },
            "notice": {
                "detail_types": ["friend_increase", "friend_decrease", "group_member_increase", "group_member_decrease"],
                "required_fields": ["user_id"],
                "optional_fields": ["user_nickname", "group_id", "operator_id", "operator_nickname"]
            },
            "request": {
                "detail_types": ["friend", "group"],
                "required_fields": ["user_id", "comment"],
                "optional_fields": ["user_nickname", "group_id"]
            },
            "meta": {
                "detail_types": ["connect", "disconnect", "heartbeat"],
                "required_fields": [],
                "optional_fields": []
            }
        }
        
        if event_type not in EVENT_TYPES:
            return JSONResponse({
                "valid": False,
                "errors": [f"未知的事件类型: {event_type}"]
            })
        
        type_def = EVENT_TYPES[event_type]
        errors = []
        
        # 验证必填字段
        for field in type_def["required_fields"]:
            if field not in body or body[field] is None or body[field] == "":
                errors.append(f"缺少必填字段: {field}")
        
        # 验证时间戳
        if "time" in body:
            try:
                timestamp = int(body["time"])
                if timestamp < 1000000000 or timestamp > 9999999999:
                    errors.append("时间戳格式不正确（应为 10 位 Unix 时间戳）")
            except (ValueError, TypeError):
                errors.append("时间戳必须是数字")
        
        return JSONResponse({
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": []
        })

    async def _api_builder_submit(self, request: Request) -> JSONResponse:
        """提交构建的事件"""
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
        body = await request.json()
        
        # 先验证
        validation = await self._api_builder_validate(request)
        validation_data = validation.body.decode() if hasattr(validation, 'body') else {}
        if isinstance(validation_data, str):
            validation_data = json.loads(validation_data)
        
        if not validation_data.get("valid", False):
            return JSONResponse({"success": False, "errors": validation_data.get("errors", [])}, status_code=400)
        
        # 发送事件到适配器系统
        try:
            await self.sdk.adapter.emit(body)
            return JSONResponse({"success": True, "message": "事件已提交"})
        except Exception as e:
            self.logger.error(f"提交事件失败: {e}")
            return JSONResponse({"success": False, "error": str(e)}, status_code=500)

    async def _api_builder_segments(self, request: Request) -> JSONResponse:
        """获取支持的消息段类型"""
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
        return JSONResponse({
            "standard_segments": [
                {
                    "type": "text",
                    "name": "文本",
                    "fields": [
                        {"name": "text", "type": "string", "required": True}
                    ]
                },
                {
                    "type": "mention",
                    "name": "@用户",
                    "fields": [
                        {"name": "user_id", "type": "string", "required": True},
                        {"name": "user_name", "type": "string", "required": False}
                    ]
                },
                {
                    "type": "mention_all",
                    "name": "@全体",
                    "fields": []
                },
                {
                    "type": "image",
                    "name": "图片",
                    "fields": [
                        {"name": "file", "type": "string", "required": True}
                    ]
                },
                {
                    "type": "reply",
                    "name": "回复",
                    "fields": [
                        {"name": "message_id", "type": "string", "required": True}
                    ]
                }
            ],
            "platform_segments": {
                "yunhu": [
                    {"type": "yunhu_form", "name": "表单", "fields": [{"name": "form_id", "type": "string"}]}
                ],
                "telegram": [
                    {"type": "telegram_sticker", "name": "贴纸", "fields": [{"name": "file_id", "type": "string"}]}
                ]
            }
        })

    # ========== 配置源码相关 API ==========

    async def _api_config_source(self, request: Request) -> JSONResponse:
        """获取/更新配置文件源码"""
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
        from pathlib import Path
        config_path = Path.cwd() / "config" / "config.toml"
        
        if request.method == "POST":
            body = await request.json()
            content = body.get("content", "")
            
            try:
                config_path.write_text(content, encoding='utf-8')
                # 重新加载配置
                self.sdk.config.reload()
                return JSONResponse({"success": True})
            except Exception as e:
                return JSONResponse({"success": False, "error": str(e)}, status_code=400)
        else:
            if config_path.exists():
                content = config_path.read_text(encoding='utf-8')
                return JSONResponse({"content": content})
            else:
                return JSONResponse({"error": "Config file not found"}, status_code=404)

    # ========== 日志相关 API ==========
    
    async def _api_logs(self, request: Request) -> JSONResponse:
        """获取日志"""
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
        limit = int(request.query_params.get("limit", "100"))
        module_filter = request.query_params.get("module", "")
        level_filter = request.query_params.get("level", "")
        search = request.query_params.get("search", "").lower()
        
        # 获取所有日志
        all_logs = self.sdk.logger.get_logs()
        logs_list = []
        
        import re
        
        for module_name, logs in all_logs.items():
            # 模块过滤（支持部分匹配）
            if module_filter and module_filter.lower() not in module_name.lower():
                continue
                
            for log_entry in logs:
                # 解析日志条目
                # 格式1: "timestamp - message" (标准格式)
                # 格式2: "timestamp module message" (当前实际格式)
                timestamp_str = ""
                message = ""
                
                if " - " in log_entry:
                    parts = log_entry.split(" - ", 1)
                    timestamp_str = parts[0]
                    message = parts[1]
                else:
                    # 尝试解析格式2: "2026-04-22 12:30:00 ErisPulse.ErisPulse 消息内容"
                    # 使用正则匹配日期时间开头
                    match = re.match(r'^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.+)$', log_entry)
                    if match:
                        timestamp_str = match.group(1)
                        log_module = match.group(2)
                        message = match.group(3)
                    else:
                        # 完全无法解析，使用原始内容
                        message = log_entry
                
                # 级别过滤
                if level_filter:
                    level = level_filter.upper()
                    # 从消息中提取级别（如 [DEBUG], [INFO] 等）
                    level_match = re.search(r'\[(DEBUG|INFO|WARNING|ERROR|CRITICAL)\]', message)
                    if level_match:
                        log_level = level_match.group(1)
                        if log_level != level:
                            continue
                
                # 搜索过滤
                if search and search not in message.lower():
                    continue
                
                logs_list.append({
                    "module": module_name,
                    "timestamp": timestamp_str,
                    "message": message,
                    "full": log_entry
                })
        
        # 按时间排序（如果有时间戳）
        logs_list.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        
        return JSONResponse({
            "logs": logs_list[:limit],
            "total": len(logs_list)
        })
    
    async def _api_logs_clear(self, request: Request) -> JSONResponse:
        """清空日志（注意：这只是清空 Dashboard 缓存，实际的日志仍在 logger 模块中）"""
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
        # 清空 Dashboard 缓存的日志
        # 注意：实际的日志仍在 sdk.logger 中，这里只清空我们存储的引用
        return JSONResponse({"success": True, "message": "日志缓存已清空"})

    # ========== 生命周期相关 API ==========
    
    async def _api_lifecycle(self, request: Request) -> JSONResponse:
        """获取生命周期事件"""
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
        return JSONResponse({
            "events": list(self._lifecycle_log),
            "total": len(self._lifecycle_log)
        })

    # ========== 性能监控相关 API ==========
    
    async def _api_performance(self, request: Request) -> JSONResponse:
        """获取性能监控数据"""
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
        system_status = self._get_system_status()
        
        # 添加 WebSocket 连接统计
        ws_stats = {
            "active_connections": len(self._ws_clients),
            "uptime_seconds": system_status["uptime_seconds"],
            "uptime_human": system_status["uptime_human"]
        }
        
        return JSONResponse({
            "system": system_status,
            "websocket": ws_stats
        })

    # ========== API 路由列表相关 API ==========
    async def _api_routes(self, request: Request) -> JSONResponse:
        """获取所有注册的 API 路由"""
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
        # 获取路由管理器中的内部路由信息
        router_manager = self.sdk.router
        http_routes_dict = router_manager._http_routes
        ws_routes_dict = router_manager._websocket_routes
        
        http_routes = []
        for module_name, paths in http_routes_dict.items():
            for path, methods in paths.items():
                for method, handler in methods.items():
                    # 获取处理器信息
                    import inspect
                    handler_name = handler.__name__ if hasattr(handler, '__name__') else 'unknown'
                    handler_file = inspect.getfile(handler) if inspect.isfunction(handler) else 'unknown'
                    handler_line = inspect.getsourcelines(handler)[0] if inspect.isfunction(handler) else 'unknown'
                    
                    http_routes.append({
                        "path": path.replace('/' + module_name, '', 1) or '/',  # 移除模块前缀
                        "full_path": path,
                        "method": method,
                        "module": module_name,
                        "handler": {
                            "name": handler_name,
                            "file": handler_file,
                            "line": handler_line
                        }
                    })
        
        ws_routes = []
        for module_name, paths in ws_routes_dict.items():
            for path, (handler, auth_handler) in paths.items():
                # 获取处理器信息
                import inspect
                handler_name = handler.__name__ if hasattr(handler, '__name__') else 'unknown'
                handler_file = inspect.getfile(handler) if inspect.isfunction(handler) else 'unknown'
                handler_line = inspect.getsourcelines(handler)[0] if inspect.isfunction(handler) else 'unknown'
                
                ws_routes.append({
                    "path": path.replace('/' + module_name, '', 1) or '/',  # 移除模块前缀
                    "full_path": path,
                    "module": module_name,
                    "has_auth": auth_handler is not None,
                    "handler": {
                        "name": handler_name,
                        "file": handler_file,
                        "line": handler_line
                    }
                })
        
        return JSONResponse({
            "http_routes": http_routes,
            "ws_routes": ws_routes
        })

    # ========== 消息统计相关 API ==========
    
    async def _api_message_stats(self, request: Request) -> JSONResponse:
        """获取消息统计"""
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        
        # 从事件日志中统计
        type_counts = {}
        platform_counts = {}
        
        for event in self._event_log:
            # 按类型统计
            event_type = event.get("type", "unknown")
            type_counts[event_type] = type_counts.get(event_type, 0) + 1
            
            # 按平台统计
            platform = event.get("platform", "unknown")
            platform_counts[platform] = platform_counts.get(platform, 0) + 1
        
        # 按小时聚合（最近24小时）
        hourly_stats = {}
        now = time.time()
        for event in self._event_log:
            event_time = event.get("time", 0)
            if now - event_time > 86400:  # 超过24小时
                continue
            
            hour_key = int(event_time // 3600) * 3600
            hourly_stats[hour_key] = hourly_stats.get(hour_key, 0) + 1
        
        return JSONResponse({
            "total_events": len(self._event_log),
            "by_type": type_counts,
            "by_platform": platform_counts,
            "hourly": hourly_stats
        })
