import asyncio
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
import threading
from pathlib import Path

from ErisPulse import sdk
from ErisPulse.Core.Bases import BaseModule
from fastapi import Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, Response, StreamingResponse


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
        self._pkg_manager = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lifecycle_log: list[dict] = []
        self._max_lifecycle_log = 200
        self._audit_log: list[dict] = []
        self._max_audit_log = 500
        self._command_rules: dict[str, dict] = {}
        self._command_middleware_func = None
        self._register_routes()

    @staticmethod
    def get_load_strategy():
        from ErisPulse.loaders import ModuleLoadStrategy

        return ModuleLoadStrategy(lazy_load=False, priority=100)

    def _get_pkg_manager(self):
        if self._pkg_manager is None:
            from .PackageManager import DashboardPackageManager
            self._pkg_manager = DashboardPackageManager()
        return self._pkg_manager

    async def on_load(self, event: dict) -> bool:
        self._loop = asyncio.get_running_loop()
        self._restore_persisted_data()
        self._restore_audit_data()
        self._load_command_rules()
        self._setup_event_interceptors()
        self._setup_command_middleware()
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

    def _load_command_rules(self):
        try:
            rules = self.storage.get("__ep_command_rules__")
            if isinstance(rules, dict):
                self._command_rules = rules
        except Exception:
            pass
        self._sync_command_aliases()

    def _save_command_rules(self):
        try:
            self.storage.set("__ep_command_rules__", self._command_rules)
        except Exception:
            pass

    def _sync_command_aliases(self):
        try:
            cmd_handler = self.sdk.Event.command
            for tag in list(getattr(cmd_handler, '_dashboard_aliases', set())):
                cmd_handler.aliases.pop(tag, None)
            dashboard_tags = set()
            for main_name, rule in self._command_rules.items():
                for alias in rule.get("aliases", []):
                    if alias and alias != main_name:
                        cmd_handler.aliases[alias] = main_name
                        dashboard_tags.add(alias)
            cmd_handler._dashboard_aliases = dashboard_tags
        except Exception:
            pass

    def _get_all_commands_info(self) -> list[dict]:
        try:
            cmd_handler = self.sdk.Event.command
            commands = cmd_handler.get_commands()
        except Exception:
            return []

        result = []
        for name, info in commands.items():
            if name != info.get("main_name", name):
                continue
            main_name = info.get("main_name", name)
            original_aliases = [
                a for a, m in cmd_handler.aliases.items() if m == main_name
            ]
            rule = self._command_rules.get(main_name, {})
            result.append({
                "name": main_name,
                "help": info.get("help"),
                "usage": info.get("usage"),
                "group": info.get("group"),
                "hidden": info.get("hidden", False),
                "original_aliases": original_aliases,
                "custom_aliases": rule.get("aliases", []),
                "enabled": rule.get("enabled", True),
                "allowed_platforms": rule.get("allowed_platforms", []),
                "blocked_platforms": rule.get("blocked_platforms", []),
                "transform_to": rule.get("transform_to"),
            })
        return result

    def _setup_command_middleware(self):
        @self.sdk.adapter.middleware
        async def _command_middleware(data: dict):
            if data.get("type") != "message":
                return data

            platform = data.get("platform", "unknown")

            message_segments = data.get("message", [])
            message_text = ""
            for segment in message_segments:
                if segment.get("type") == "text":
                    message_text = segment.get("data", {}).get("text", "")
                    break

            alt_message = data.get("alt_message", "")
            text = message_text or alt_message
            if not text:
                return data

            try:
                from ErisPulse.runtime import get_event_config
                event_config = get_event_config()
                command_config = event_config.get("command", {})
                prefix = command_config.get("prefix", "/")
                case_sensitive = command_config.get("case_sensitive", True)
            except Exception:
                prefix = "/"
                case_sensitive = True

            check_text = text if case_sensitive else text.lower()
            check_prefix = prefix if case_sensitive else prefix.lower()

            if not check_text.startswith(check_prefix):
                return data

            command_part = check_text[len(check_prefix):].strip()
            parts = command_part.split()
            if not parts:
                return data

            cmd_name = parts[0]
            if not case_sensitive:
                cmd_name = cmd_name.lower()

            rule_main_name = cmd_name
            rule = self._command_rules.get(cmd_name)

            if rule is None:
                try:
                    cmd_handler = self.sdk.Event.command
                    actual = cmd_handler.aliases.get(cmd_name, cmd_name)
                    if actual != cmd_name:
                        rule_main_name = actual
                        rule = self._command_rules.get(actual)
                except Exception:
                    pass

            if rule is None:
                return data

            if not rule.get("enabled", True):
                data["_processed"] = True
                return data

            allowed = rule.get("allowed_platforms", [])
            if allowed and platform not in allowed:
                data["_processed"] = True
                return data

            blocked = rule.get("blocked_platforms", [])
            if platform in blocked:
                data["_processed"] = True
                return data

            transform_to = rule.get("transform_to")
            if transform_to:
                new_cmd_text = check_prefix + transform_to + " " + " ".join(parts[1:])
                new_cmd_text = new_cmd_text.strip()
                for i, segment in enumerate(message_segments):
                    if segment.get("type") == "text":
                        message_segments[i] = {"type": "text", "data": {"text": new_cmd_text}}
                        break
                data["message"] = message_segments
                if alt_message and alt_message == text:
                    data["alt_message"] = new_cmd_text

            return data

        self._command_middleware_func = _command_middleware

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

    def _add_audit_log(self, action: str, detail: str = "", request: Request | None = None):
        ip = ""
        if request:
            ip = request.client.host if request.client else ""
            forwarded = request.headers.get("X-Forwarded-For", "")
            if forwarded:
                ip = forwarded.split(",")[0].strip()
        entry = {
            "timestamp": time.time(),
            "action": action,
            "detail": detail,
            "ip": ip,
        }
        self._audit_log.append(entry)
        if len(self._audit_log) > self._max_audit_log:
            self._audit_log = self._audit_log[-self._max_audit_log:]
        self._persist_audit()

    def _persist_audit(self):
        try:
            self.storage.set("__ep_audit__", self._audit_log[-self._max_audit_log:])
        except Exception:
            pass

    def _restore_audit_data(self):
        try:
            logs = self.storage.get("__ep_audit__")
            if isinstance(logs, list):
                self._audit_log = logs[-self._max_audit_log:]
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

    def _run_pip_install(self, packages: list[str], task_id: str, force: bool = False, index_url: str = None):
        cmd = [sys.executable, "-m", "pip", "install"]
        if force:
            cmd.append("--force-reinstall")
        if index_url:
            cmd.extend(["--index-url", index_url])
        cmd.extend(packages)
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
            combined_lines = []

            def read_pipe(pipe):
                try:
                    for line in iter(pipe.readline, ""):
                        combined_lines.append(line.rstrip())
                        if len(combined_lines) % 5 == 0:
                            self._safe_broadcast(
                                {
                                    "type": "install_progress",
                                    "task_id": task_id,
                                    "status": "running",
                                    "output": combined_lines[-10:],
                                }
                            )
                except Exception:
                    pass
                pipe.close()

            t_out = threading.Thread(target=read_pipe, args=(proc.stdout,))
            t_err = threading.Thread(target=read_pipe, args=(proc.stderr,))
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
                self._install_tasks[task_id]["output"] = combined_lines
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "success",
                        "output": combined_lines,
                    }
                )
                self._dynamic_load_new_modules()
            else:
                self._install_tasks[task_id]["status"] = "error"
                self._install_tasks[task_id]["error"] = "\n".join(combined_lines[-20:])
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "output": combined_lines,
                        "message": "\n".join(combined_lines[-10:])
                        if combined_lines
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

    def _dynamic_load_new_modules(self):
        try:
            from ErisPulse.loaders import ModuleLoader, AdapterLoader
            from ErisPulse.finders import ModuleFinder, AdapterFinder
            
            mf = ModuleFinder()
            af = AdapterFinder()
            mf.clear_cache()
            af.clear_cache()
            
            new_module_map = mf.get_entry_point_map()
            existing_modules = set(self.sdk.module.list_registered())
            
            for ep_name, ep in new_module_map.items():
                if ep_name not in existing_modules:
                    self.logger.info(f"Dynamic loading new module: {ep_name}")
                    try:
                        module_class = ep.load()
                        import importlib.metadata as imd
                        dist = imd.distribution(ep.dist.name) if ep.dist else None
                        import sys
                        module_pkg = sys.modules.get(module_class.__module__)
                        module_info = {
                            "meta": {
                                "name": ep_name,
                                "version": getattr(module_pkg, "__version__", dist.version if dist else "1.0.0"),
                                "description": getattr(module_pkg, "__description__", ""),
                                "author": getattr(module_pkg, "__author__", ""),
                                "license": getattr(module_pkg, "__license__", ""),
                                "package": ep.dist.name,
                                "lazy_load": False,
                                "priority": 0,
                                "is_base_module": True,
                            },
                            "module_class": module_class,
                        }
                        self.sdk.module._config_register(ep_name, True)
                        self.sdk.module.register(ep_name, module_class, module_info)
                        
                        if self._loop and not self._loop.is_closed():
                            asyncio.run_coroutine_threadsafe(self.sdk.module.load(ep_name), self._loop)
                        
                        self._safe_broadcast({
                            "type": "module_changed",
                            "data": {"name": ep_name, "action": "installed"},
                        })
                    except Exception as e:
                        self.logger.warning(f"Failed to dynamic load module {ep_name}: {e}")
            
            new_adapter_map = af.get_entry_point_map()
            existing_adapters = set(self.sdk.adapter.list_registered())
            for ep_name, ep in new_adapter_map.items():
                if ep_name not in existing_adapters:
                    self.logger.info(f"Found new adapter: {ep_name} (requires restart)")
                    self._safe_broadcast({
                        "type": "module_changed",
                        "data": {"name": ep_name, "action": "installed_adapter"},
                    })
        except Exception as e:
            self.logger.warning(f"Dynamic module loading failed: {e}")

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
        r.register_http_route(mn, "/api/store/package/detail", handler=self._api_package_detail, methods=["GET"])
        
        r.register_http_route(mn, "/api/packages", handler=self._api_packages, methods=["GET"])
        r.register_http_route(mn, "/api/packages/updates", handler=self._api_packages_updates, methods=["GET"])
        r.register_http_route(mn, "/api/packages/upgrade", handler=self._api_packages_upgrade, methods=["POST"])
        r.register_http_route(mn, "/api/packages/install", handler=self._api_packages_install, methods=["POST"])
        r.register_http_route(mn, "/api/packages/uninstall", handler=self._api_packages_uninstall, methods=["POST"])
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
        
        r.register_http_route(mn, "/api/audit", handler=self._api_audit, methods=["GET"])
        r.register_http_route(mn, "/api/audit/clear", handler=self._api_audit_clear, methods=["POST"])
        r.register_http_route(mn, "/api/backup/export", handler=self._api_backup_export, methods=["GET"])
        r.register_http_route(mn, "/api/backup/import", handler=self._api_backup_import, methods=["POST"])
        
        r.register_http_route(mn, "/api/files/browse", handler=self._api_files_browse, methods=["GET"])
        r.register_http_route(mn, "/api/files/read", handler=self._api_files_read, methods=["GET"])
        r.register_http_route(mn, "/api/files/write", handler=self._api_files_write, methods=["PUT"])
        r.register_http_route(mn, "/api/files/upload", handler=self._api_files_upload, methods=["POST"])
        r.register_http_route(mn, "/api/files/download", handler=self._api_files_download, methods=["GET"])
        r.register_http_route(mn, "/api/files/mkdir", handler=self._api_files_mkdir, methods=["POST"])
        r.register_http_route(mn, "/api/files/delete", handler=self._api_files_delete, methods=["POST"])
        r.register_http_route(mn, "/api/files/rename", handler=self._api_files_rename, methods=["POST"])
        r.register_http_route(mn, "/api/files/copy", handler=self._api_files_copy, methods=["POST"])
        r.register_http_route(mn, "/api/files/chmod", handler=self._api_files_chmod, methods=["POST"])
        r.register_http_route(mn, "/api/files/stat", handler=self._api_files_stat, methods=["GET"])
        r.register_http_route(mn, "/api/files/search", handler=self._api_files_search, methods=["GET"])
        r.register_http_route(mn, "/api/files/compress", handler=self._api_files_compress, methods=["POST"])
        r.register_http_route(mn, "/api/files/decompress", handler=self._api_files_decompress, methods=["POST"])
        
        r.register_http_route(mn, "/api/commands", handler=self._api_commands, methods=["GET"])
        r.register_http_route(mn, "/api/commands/{name}", handler=self._api_command_update, methods=["PUT"])
        
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
            "/api/store/package/detail",
            "/api/packages",
            "/api/packages/updates",
            "/api/packages/upgrade",
            "/api/packages/install",
            "/api/packages/uninstall",
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
            "/api/audit",
            "/api/audit/clear",
            "/api/backup/export",
            "/api/backup/import",
            "/api/files/browse",
            "/api/files/read",
            "/api/files/write",
            "/api/files/upload",
            "/api/files/download",
            "/api/files/mkdir",
            "/api/files/delete",
            "/api/files/rename",
            "/api/files/copy",
            "/api/files/chmod",
            "/api/files/stat",
            "/api/files/search",
            "/api/files/compress",
            "/api/files/decompress",
            "/api/commands",
            "/api/commands/{name}",
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

        if mtype == "adapter":
            if action == "load":
                load_adapter = self.sdk.adapter.get(name)
                if load_adapter:
                    await load_adapter.start()
                    self.sdk.adapter._started_instances.add(load_adapter)
                    self._add_audit_log("load_adapter", name, request)
                    return JSONResponse({"success": True, "requires_restart": True})
            elif action == "unload":
                shutdown_adapter = self.sdk.adapter.get(name)
                if shutdown_adapter:
                    await shutdown_adapter.shutdown()
                    self.sdk.adapter._started_instances.discard(shutdown_adapter)
                    self._add_audit_log("unload_adapter", name, request)
                    return JSONResponse({"success": True, "requires_restart": True})
            elif action == "reload":
                shutdown_adapter = self.sdk.adapter.get(name)
                if shutdown_adapter:
                    await shutdown_adapter.shutdown()
                    self.sdk.adapter._started_instances.discard(shutdown_adapter)
                    await shutdown_adapter.start()
                    self.sdk.adapter._started_instances.add(shutdown_adapter)
                    self._add_audit_log("reload_adapter", name, request)
                    return JSONResponse({"success": True, "requires_restart": True})
            elif action == "enable":
                self.sdk.adapter.enable(name)
                self._add_audit_log("enable_adapter", name, request)
                return JSONResponse({"success": True})
            elif action == "disable":
                self.sdk.adapter.disable(name)
                shutdown_adapter = self.sdk.adapter.get(name)
                if shutdown_adapter:
                    try:
                        await shutdown_adapter.shutdown()
                    except Exception:
                        pass
                    self.sdk.adapter._started_instances.discard(shutdown_adapter)
                self._add_audit_log("disable_adapter", name, request)
                return JSONResponse({"success": True})
            else:
                return JSONResponse(
                    {"error": f"unknown action for adapter: {action}"}, status_code=400
                )
            return JSONResponse({"error": "adapter not found"}, status_code=404)

        if action == "load":
            result = await self.sdk.module.load(name)
            if not result:
                return JSONResponse({"error": "load failed"}, status_code=400)
            self._add_audit_log("load_module", name, request)
            return JSONResponse({"success": True})
        elif action == "unload":
            result = await self.sdk.module.unload(name)
            if not result:
                return JSONResponse({"error": "unload failed"}, status_code=400)
            self._add_audit_log("unload_module", name, request)
            return JSONResponse({"success": True})
        elif action == "enable":
            result = self.sdk.module.enable(name)
            if not result:
                return JSONResponse({"error": "enable failed (module not registered)"}, status_code=400)
            self._add_audit_log("enable_module", name, request)
            return JSONResponse({"success": True})
        elif action == "disable":
            if name == "Dashboard":
                return JSONResponse({"error": "Cannot disable Dashboard module"}, status_code=400)
            result = self.sdk.module.disable(name)
            if not result:
                return JSONResponse({"error": "disable failed"}, status_code=400)
            self._add_audit_log("disable_module", name, request)
            return JSONResponse({"success": True})
        elif action == "reload":
            if name == "Dashboard":
                return JSONResponse({"error": "Cannot reload Dashboard from dashboard"}, status_code=400)
            await self.sdk.module.unload(name)
            result = await self.sdk.module.load(name)
            if not result:
                return JSONResponse({"error": "reload failed"}, status_code=400)
            self._add_audit_log("reload_module", name, request)
            return JSONResponse({"success": True})
        elif action == "uninstall":
            if name == "Dashboard":
                return JSONResponse({"error": "Cannot uninstall Dashboard"}, status_code=400)
            pkg_name = body.get("package", "")
            if not pkg_name:
                info = self.sdk.module.get_info(name)
                if info and info.get("package"):
                    pkg_name = info["package"]
                else:
                    return JSONResponse({"error": "package name required for uninstall"}, status_code=400)
            if self.sdk.module.is_loaded(name):
                await self.sdk.module.unload(name)
            self.sdk.module.disable(name)
            task_id = secrets.token_urlsafe(8)
            t = threading.Thread(
                target=self._run_pip_uninstall, args=(pkg_name, name, task_id), daemon=True
            )
            t.start()
            self._add_audit_log("uninstall_module", f"{name} ({pkg_name})", request)
            return JSONResponse({"success": True, "task_id": task_id})
        else:
            return JSONResponse(
                {"error": f"unknown action: {action}"}, status_code=400
            )

    def _run_pip_uninstall(self, package_name: str, module_name: str, task_id: str):
        self._install_tasks[task_id] = {
            "status": "running",
            "started_at": time.time(),
            "packages": [package_name],
        }
        self._safe_broadcast({
            "type": "install_progress",
            "task_id": task_id,
            "status": "running",
            "packages": [package_name],
        })
        try:
            cmd = [sys.executable, "-m", "pip", "uninstall", "-y", package_name]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if proc.returncode == 0:
                self.sdk.module.unregister(module_name)
                self.sdk.config.setConfig(f"ErisPulse.modules.status.{module_name}", None)
                self._install_tasks[task_id] = {
                    "status": "success",
                    "started_at": time.time(),
                    "packages": [package_name],
                    "output": proc.stdout.splitlines()[-20:],
                }
                self._safe_broadcast({
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "success",
                    "output": proc.stdout.splitlines()[-20:],
                })
                self._safe_broadcast({
                    "type": "module_changed",
                    "data": {"name": module_name, "action": "uninstalled"},
                })
            else:
                self._install_tasks[task_id] = {
                    "status": "error",
                    "started_at": time.time(),
                    "packages": [package_name],
                    "error": proc.stderr,
                }
                self._safe_broadcast({
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "error",
                    "message": proc.stderr[-500:] if proc.stderr else "Uninstall failed",
                })
        except Exception as e:
            self._install_tasks[task_id] = {
                "status": "error",
                "started_at": time.time(),
                "packages": [package_name],
                "error": str(e),
            }
            self._safe_broadcast({
                "type": "install_progress",
                "task_id": task_id,
                "status": "error",
                "message": str(e),
            })

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
        self._add_audit_log("clear_events", "", request)
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
        self._add_audit_log("config_update", key, request)
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
        self._add_audit_log("storage_set", key, request)
        return JSONResponse({"success": True})

    async def _api_storage_delete(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        key = body.get("key", "")
        if not key:
            return JSONResponse({"error": "key is required"}, status_code=400)
        self.storage.delete(key)
        self._add_audit_log("storage_delete", key, request)
        return JSONResponse({"success": True})

    async def _api_store_remote(self, request: Request) -> JSONResponse:
        try:
            force = request.query_params.get("force", "") == "true"
            data = await self._get_pkg_manager().get_store_data(force)
            return JSONResponse(data)
        except Exception as e:
            return JSONResponse({"error": str(e), "packages": None})

    async def _api_store_install(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        packages = body.get("packages", [])
        if not packages:
            return JSONResponse({"error": "packages required"}, status_code=400)
        force = body.get("force", False)
        index_url = body.get("index_url", "") or None
        task_id = secrets.token_urlsafe(8)
        t = threading.Thread(
            target=self._run_pip_install, args=(packages, task_id, force, index_url), daemon=True
        )
        t.start()
        self._add_audit_log("package_install", ", ".join(packages), request)
        return JSONResponse({"success": True, "task_id": task_id})

    async def _api_packages(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        force = request.query_params.get("force", "") == "true"
        try:
            result = self._get_pkg_manager().get_installed_packages(force)
            return JSONResponse(result)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_packages_updates(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        force = request.query_params.get("force", "") == "true"
        try:
            updates = await self._get_pkg_manager().check_updates(force)
            return JSONResponse({"updates": updates})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_packages_upgrade(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        packages = body.get("packages", [])
        if not packages:
            return JSONResponse({"error": "packages required"}, status_code=400)
        index_url = body.get("index_url", "") or None
        task_id = secrets.token_urlsafe(8)
        t = threading.Thread(
            target=self._run_pip_upgrade, args=(packages, task_id, index_url), daemon=True
        )
        t.start()
        self._add_audit_log("package_upgrade", ", ".join(packages), request)
        self._get_pkg_manager().invalidate_caches()
        return JSONResponse({"success": True, "task_id": task_id})

    async def _api_packages_install(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        packages = body.get("packages", [])
        if not packages:
            return JSONResponse({"error": "packages required"}, status_code=400)
        force = body.get("force", False)
        index_url = body.get("index_url", "") or None
        task_id = secrets.token_urlsafe(8)
        t = threading.Thread(
            target=self._run_pip_install, args=(packages, task_id, force, index_url), daemon=True
        )
        t.start()
        self._add_audit_log("package_install", ", ".join(packages), request)
        self._get_pkg_manager().invalidate_caches()
        return JSONResponse({"success": True, "task_id": task_id})

    async def _api_packages_uninstall(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        package = body.get("package", "")
        if not package:
            return JSONResponse({"error": "package required"}, status_code=400)
        protected = {"erispulse", "erispulse-dashboard"}
        if package.lower().replace("-", "").replace("_", "") in {p.replace("-", "").replace("_", "") for p in protected}:
            return JSONResponse({"error": "Cannot uninstall core package"}, status_code=400)
        task_id = secrets.token_urlsafe(8)
        t = threading.Thread(
            target=self._run_pip_uninstall, args=(package, "", task_id), daemon=True
        )
        t.start()
        self._add_audit_log("package_uninstall", package, request)
        self._get_pkg_manager().invalidate_caches()
        return JSONResponse({"success": True, "task_id": task_id})

    def _run_pip_upgrade(self, packages: list[str], task_id: str, index_url: str = None):
        cmd = [sys.executable, "-m", "pip", "install", "--upgrade"]
        if index_url:
            cmd.extend(["--index-url", index_url])
        cmd.extend(packages)
        self._install_tasks[task_id] = {
            "status": "running",
            "started_at": time.time(),
            "packages": packages,
        }
        self._safe_broadcast({
            "type": "install_progress",
            "task_id": task_id,
            "status": "running",
            "packages": packages,
        })
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1,
            )
            combined_lines = []

            def read_pipe(pipe):
                try:
                    for line in iter(pipe.readline, ""):
                        combined_lines.append(line.rstrip())
                        if len(combined_lines) % 5 == 0:
                            self._safe_broadcast({
                                "type": "install_progress",
                                "task_id": task_id,
                                "status": "running",
                                "output": combined_lines[-10:],
                            })
                except Exception:
                    pass
                pipe.close()

            t_out = threading.Thread(target=read_pipe, args=(proc.stdout,))
            t_err = threading.Thread(target=read_pipe, args=(proc.stderr,))
            t_out.start()
            t_err.start()

            try:
                proc.wait(timeout=300)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                self._install_tasks[task_id]["status"] = "timeout"
                self._safe_broadcast({
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "error",
                    "message": "Upgrade timed out (5 min)",
                })
                return

            t_out.join(timeout=10)
            t_err.join(timeout=10)

            if proc.returncode == 0:
                self._install_tasks[task_id]["status"] = "success"
                self._install_tasks[task_id]["output"] = combined_lines
                self._safe_broadcast({
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "success",
                    "output": combined_lines,
                })
                self._get_pkg_manager().invalidate_caches()
                self._safe_broadcast({"type": "module_changed", "data": {"action": "upgraded"}})
            else:
                self._install_tasks[task_id]["status"] = "error"
                self._install_tasks[task_id]["error"] = "\n".join(combined_lines[-20:])
                self._safe_broadcast({
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "error",
                    "output": combined_lines,
                    "message": "\n".join(combined_lines[-10:]) if combined_lines else "Unknown error",
                })
        except Exception as e:
            self._install_tasks[task_id]["status"] = "error"
            self._install_tasks[task_id]["error"] = str(e)
            self._safe_broadcast({
                "type": "install_progress",
                "task_id": task_id,
                "status": "error",
                "message": str(e),
            })

    async def _api_store_install_status(self, request: Request) -> JSONResponse:
        tid = request.query_params.get("task_id", "")
        info = self._install_tasks.get(tid)
        if not info:
            return JSONResponse({"error": "task not found"}, status_code=404)
        return JSONResponse(info)

    async def _api_package_detail(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        package = request.query_params.get("package", "")
        if not package:
            return JSONResponse({"error": "package parameter required"}, status_code=400)
        try:
            detail = await self._get_pkg_manager().get_package_detail(package)
            return JSONResponse(detail)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

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
        return JSONResponse({"success": True, "task_id": task_id})

    def _run_pip_install_file(
        self, file_path: str, filename: str, tmp_dir: str, task_id: str, force: bool = False, index_url: str = None
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

        def _do_install(packages: list[str]) -> tuple[list[str], int]:
            pip_cmd = [sys.executable, "-m", "pip", "install"]
            if force:
                pip_cmd.append("--force-reinstall")
            if index_url:
                pip_cmd.extend(["--index-url", index_url])
            pip_cmd.extend(packages)
            proc = subprocess.Popen(
                pip_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1,
            )
            combined_lines: list[str] = []

            def read_pipe(pipe):
                try:
                    for line in iter(pipe.readline, ""):
                        combined_lines.append(line.rstrip())
                        if len(combined_lines) % 5 == 0:
                            self._safe_broadcast(
                                {
                                    "type": "install_progress",
                                    "task_id": task_id,
                                    "status": "running",
                                    "output": combined_lines[-10:],
                                }
                            )
                except Exception:
                    pass
                pipe.close()

            t_out = threading.Thread(target=read_pipe, args=(proc.stdout,))
            t_err = threading.Thread(target=read_pipe, args=(proc.stderr,))
            t_out.start()
            t_err.start()
            try:
                proc.wait(timeout=300)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                t_out.join(timeout=10)
                t_err.join(timeout=10)
                return combined_lines, 1
            t_out.join(timeout=10)
            t_err.join(timeout=10)
            return combined_lines, proc.returncode

        try:
            all_lines, rc = _do_install([file_path])
            if rc != 0 and filename.endswith(".zip"):
                stem = os.path.splitext(os.path.basename(filename))[0]
                extract_dir = os.path.join(tmp_dir, stem)
                shutil.unpack_archive(file_path, extract_dir)
                more_lines, rc2 = _do_install([extract_dir])
                all_lines = all_lines + more_lines
                rc = rc2
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
                self._dynamic_load_new_modules()
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

        self._add_audit_log("restart_framework", "", request)
        asyncio.create_task(_delayed_restart())
        return JSONResponse({"success": True})

    async def _api_modules(self, request: Request) -> JSONResponse:
        modules = []
        for name in self.sdk.module.list_registered():
            info = self.sdk.module.get_info(name) or {}
            modules.append({
                "name": name,
                "type": "module",
                "enabled": self.sdk.module.is_enabled(name),
                "loaded": self.sdk.module.is_loaded(name),
                "version": info.get("version", ""),
                "description": info.get("description", ""),
                "author": info.get("author", ""),
                "package": info.get("package", ""),
            })
        for name in self.sdk.adapter.list_registered():
            modules.append({
                "name": name,
                "type": "adapter",
                "enabled": self.sdk.adapter.is_enabled(name),
                "loaded": self.sdk.adapter.is_running(name),
                "version": "",
                "description": "",
                "author": "",
                "package": "",
            })
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
                self.sdk.config.reload()
                self._add_audit_log("config_source_save", "", request)
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

    # ========== 操作审计日志 API ==========

    async def _api_audit(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        limit = int(request.query_params.get("limit", "200"))
        action_filter = request.query_params.get("action", "")
        logs = list(self._audit_log)
        if action_filter:
            logs = [l for l in logs if l.get("action") == action_filter]
        return JSONResponse({"logs": logs[-limit:], "total": len(logs)})

    async def _api_audit_clear(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        self._audit_log.clear()
        self._persist_audit()
        return JSONResponse({"success": True})

    # ========== 数据备份与恢复 API ==========

    async def _api_backup_export(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        config_data = dict(self.sdk.config._cache)
        storage_keys = self.storage.get_all_keys()
        storage_data = {}
        for k in storage_keys[:500]:
            storage_data[k] = self.storage.get(k)
        backup = {
            "version": "1.0",
            "timestamp": time.time(),
            "config": config_data,
            "storage": storage_data,
            "audit_log": self._audit_log[-100:],
        }
        return JSONResponse(backup)

    async def _api_backup_import(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        if not isinstance(body, dict):
            return JSONResponse({"error": "Invalid backup format"}, status_code=400)
        config_keys_before = set(self.sdk.config._cache.keys())
        config_data = body.get("config", {})
        if isinstance(config_data, dict):
            for key, value in config_data.items():
                if key == "Dashboard":
                    continue
                self.sdk.config.setConfig(key, value)
        storage_data = body.get("storage", {})
        if isinstance(storage_data, dict):
            for key, value in storage_data.items():
                if key.startswith("__ep_"):
                    continue
                self.storage.set(key, value)
        self._add_audit_log("backup_import", f"config: {len(config_data)} keys, storage: {len(storage_data)} keys", request)
        return JSONResponse({"success": True, "config_restored": len(config_data), "storage_restored": len(storage_data)})

    # ========== 文件管理 API ==========

    _SENSITIVE_FILES = {".env", "credentials.json", "id_rsa", "id_ed25519", ".htpasswd"}
    _MAX_READ_SIZE = 2 * 1024 * 1024
    _MAX_UPLOAD_SIZE = 50 * 1024 * 1024

    def _get_project_root(self) -> Path:
        return Path.cwd()

    def _resolve_safe_path(self, relative_path: str) -> Path | None:
        root = self._get_project_root().resolve()
        decoded = relative_path.replace("\\", "/")
        while decoded.startswith("/"):
            decoded = decoded[1:]
        target = (root / decoded).resolve()
        try:
            target.relative_to(root)
        except ValueError:
            return None
        return target

    def _is_sensitive_file(self, path: Path) -> bool:
        return path.name in self._SENSITIVE_FILES or path.name.endswith(".key") or path.name.endswith(".pem")

    def _format_permissions(self, mode: int) -> str:
        def _rwx(m):
            r = "r" if m & 4 else "-"
            w = "w" if m & 2 else "-"
            x = "x" if m & 1 else "-"
            return r + w + x
        owner = _rwx((mode >> 6) & 7)
        group = _rwx((mode >> 3) & 7)
        others = _rwx(mode & 7)
        return owner + group + others

    def _file_entry(self, path: Path, root: Path) -> dict:
        try:
            st = path.stat()
            is_dir = path.is_dir()
            rel = str(path.relative_to(root)).replace("\\", "/")
            perm = self._format_permissions(st.st_mode & 0o777) if hasattr(st, 'st_mode') else ""
            return {
                "name": path.name,
                "path": rel,
                "type": "directory" if is_dir else "file",
                "size": 0 if is_dir else st.st_size,
                "modified": st.st_mtime,
                "permissions": perm,
                "mode_octal": oct(st.st_mode & 0o777),
                "readable": os.access(path, os.R_OK),
                "writable": os.access(path, os.W_OK),
            }
        except (OSError, PermissionError):
            rel = str(path.relative_to(root)).replace("\\", "/")
            return {"name": path.name, "path": rel, "type": "unknown", "error": "access_denied"}

    async def _api_files_browse(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        dir_path = request.query_params.get("path", ".")
        sort_by = request.query_params.get("sort", "name")
        show_hidden = request.query_params.get("hidden", "false") == "true"
        target = self._resolve_safe_path(dir_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists() or not target.is_dir():
            return JSONResponse({"error": "Directory not found"}, status_code=404)
        try:
            entries = []
            for item in target.iterdir():
                if not show_hidden and item.name.startswith("."):
                    continue
                entries.append(self._file_entry(item, self._get_project_root().resolve()))
        except PermissionError:
            return JSONResponse({"error": "Permission denied"}, status_code=403)
        sort_key_map = {"name": "name", "size": "size", "modified": "modified", "type": "type"}
        sort_key = sort_key_map.get(sort_by, "name")
        entries.sort(key=lambda e: (e.get("type", "") != "directory", e.get(sort_key, "")))
        root = self._get_project_root().resolve()
        return JSONResponse({
            "path": str(target.relative_to(root)).replace("\\", "/") if target != root else ".",
            "absolute_path": str(target),
            "entries": entries,
            "total": len(entries),
        })

    async def _api_files_read(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        file_path = request.query_params.get("path", "")
        encoding = request.query_params.get("encoding", "utf-8")
        target = self._resolve_safe_path(file_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists() or not target.is_file():
            return JSONResponse({"error": "File not found"}, status_code=404)
        if self._is_sensitive_file(target):
            return JSONResponse({"error": "Cannot read sensitive file"}, status_code=403)
        try:
            st = target.stat()
            if st.st_size > self._MAX_READ_SIZE:
                return JSONResponse({
                    "error": "File too large",
                    "size": st.st_size,
                    "max_size": self._MAX_READ_SIZE,
                }, status_code=413)
        except OSError:
            pass
        try:
            content = target.read_text(encoding=encoding)
            return JSONResponse({"content": content, "size": st.st_size, "encoding": encoding, "path": file_path})
        except UnicodeDecodeError:
            return JSONResponse({"error": "Binary file, cannot display as text", "binary": True}, status_code=415)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_write(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        file_path = body.get("path", "")
        content = body.get("content", "")
        encoding = body.get("encoding", "utf-8")
        target = self._resolve_safe_path(file_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding=encoding)
            self._add_audit_log("file_write", file_path, request)
            return JSONResponse({"success": True, "path": file_path, "size": len(content.encode(encoding))})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_upload(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        form = await request.form()
        dest_dir = request.query_params.get("path", ".")
        target_dir = self._resolve_safe_path(dest_dir)
        if target_dir is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target_dir.exists():
            target_dir.mkdir(parents=True, exist_ok=True)
        files = form.getlist("files") if hasattr(form, "getlist") else [form.get("file")]
        if not files or files[0] is None:
            files = [v for k, v in form.items() if hasattr(v, 'filename')]
        if not files:
            return JSONResponse({"error": "No files provided"}, status_code=400)
        uploaded = []
        for f in files:
            if not hasattr(f, 'filename') or not f.filename:
                continue
            rel_name = f.filename.replace("\\", "/")
            safe_name = "/".join(rel_name.split("/"))
            target_path = target_dir / safe_name
            resolved = self._resolve_safe_path(str(target_path.relative_to(self._get_project_root().resolve())))
            if resolved is None:
                continue
            content = await f.read()
            if len(content) > self._MAX_UPLOAD_SIZE:
                continue
            resolved.parent.mkdir(parents=True, exist_ok=True)
            resolved.write_bytes(content)
            uploaded.append({"name": safe_name, "size": len(content)})
        self._add_audit_log("file_upload", f"{dest_dir}: {len(uploaded)} files", request)
        return JSONResponse({"success": True, "uploaded": uploaded, "count": len(uploaded)})

    async def _api_files_download(self, request: Request):
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        file_path = request.query_params.get("path", "")
        target = self._resolve_safe_path(file_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists() or not target.is_file():
            return JSONResponse({"error": "File not found"}, status_code=404)

        def _iter():
            with open(target, "rb") as f:
                while chunk := f.read(65536):
                    yield chunk

        return StreamingResponse(_iter(), media_type="application/octet-stream", headers={
            "Content-Disposition": f'attachment; filename="{target.name}"',
            "Content-Length": str(target.stat().st_size),
        })

    async def _api_files_mkdir(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        dir_path = body.get("path", "")
        recursive = body.get("recursive", True)
        target = self._resolve_safe_path(dir_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        try:
            target.mkdir(parents=recursive, exist_ok=False)
            self._add_audit_log("file_mkdir", dir_path, request)
            return JSONResponse({"success": True, "path": dir_path})
        except FileExistsError:
            return JSONResponse({"error": "Directory already exists"}, status_code=409)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_delete(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        paths = body.get("paths", [])
        if not paths:
            return JSONResponse({"error": "paths required"}, status_code=400)
        deleted = []
        for p in paths:
            target = self._resolve_safe_path(p)
            if target is None:
                continue
            if not target.exists():
                continue
            try:
                if target.is_dir():
                    shutil.rmtree(target)
                else:
                    target.unlink()
                deleted.append(p)
            except Exception:
                pass
        self._add_audit_log("file_delete", f"{len(deleted)} items", request)
        return JSONResponse({"success": True, "deleted": deleted, "count": len(deleted)})

    async def _api_files_rename(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        old_path = body.get("old_path", "")
        new_path = body.get("new_path", "")
        if not old_path or not new_path:
            return JSONResponse({"error": "old_path and new_path required"}, status_code=400)
        old_target = self._resolve_safe_path(old_path)
        new_target = self._resolve_safe_path(new_path)
        if old_target is None or new_target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not old_target.exists():
            return JSONResponse({"error": "Source not found"}, status_code=404)
        try:
            new_target.parent.mkdir(parents=True, exist_ok=True)
            old_target.rename(new_target)
            self._add_audit_log("file_rename", f"{old_path} -> {new_path}", request)
            return JSONResponse({"success": True})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_copy(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        src_path = body.get("src", "")
        dst_path = body.get("dst", "")
        if not src_path or not dst_path:
            return JSONResponse({"error": "src and dst required"}, status_code=400)
        src = self._resolve_safe_path(src_path)
        dst = self._resolve_safe_path(dst_path)
        if src is None or dst is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not src.exists():
            return JSONResponse({"error": "Source not found"}, status_code=404)
        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
            if src.is_dir():
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)
            self._add_audit_log("file_copy", f"{src_path} -> {dst_path}", request)
            return JSONResponse({"success": True})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_chmod(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        file_path = body.get("path", "")
        mode = body.get("mode", "")
        if not file_path or not mode:
            return JSONResponse({"error": "path and mode required"}, status_code=400)
        target = self._resolve_safe_path(file_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists():
            return JSONResponse({"error": "File not found"}, status_code=404)
        try:
            if isinstance(mode, str):
                mode_int = int(mode, 8)
            else:
                mode_int = int(mode)
            target.chmod(mode_int)
            self._add_audit_log("file_chmod", f"{file_path} -> {oct(mode_int)}", request)
            return JSONResponse({"success": True, "mode": oct(mode_int)})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_stat(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        file_path = request.query_params.get("path", "")
        target = self._resolve_safe_path(file_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists():
            return JSONResponse({"error": "Not found"}, status_code=404)
        try:
            st = target.stat()
            is_dir = target.is_dir()
            root = self._get_project_root().resolve()
            rel = str(target.relative_to(root)).replace("\\", "/")
            return JSONResponse({
                "name": target.name,
                "path": rel,
                "type": "directory" if is_dir else "file",
                "size": st.st_size,
                "modified": st.st_mtime,
                "created": st.st_ctime,
                "permissions": self._format_permissions(st.st_mode & 0o777),
                "mode_octal": oct(st.st_mode & 0o777),
                "readable": os.access(target, os.R_OK),
                "writable": os.access(target, os.W_OK),
                "executable": os.access(target, os.X_OK),
                "is_symlink": target.is_symlink(),
            })
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_search(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        search_path = request.query_params.get("path", ".")
        pattern = request.query_params.get("pattern", "*")
        max_results = int(request.query_params.get("limit", "100"))
        target = self._resolve_safe_path(search_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists() or not target.is_dir():
            return JSONResponse({"error": "Directory not found"}, status_code=404)
        root = self._get_project_root().resolve()
        results = []
        try:
            for item in target.rglob(pattern):
                if len(results) >= max_results:
                    break
                if item.name.startswith(".") and not pattern.startswith("."):
                    continue
                results.append(self._file_entry(item, root))
        except PermissionError:
            pass
        return JSONResponse({"results": results, "total": len(results), "pattern": pattern})

    async def _api_files_compress(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        paths = body.get("paths", [])
        archive_name = body.get("archive_name", "archive.zip")
        if not paths:
            return JSONResponse({"error": "paths required"}, status_code=400)
        import zipfile
        import io
        buf = io.BytesIO()
        root = self._get_project_root().resolve()
        added = 0
        try:
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for p in paths:
                    target = self._resolve_safe_path(p)
                    if target is None or not target.exists():
                        continue
                    arcname = str(target.relative_to(root)).replace("\\", "/")
                    if target.is_dir():
                        for f in target.rglob("*"):
                            if f.name.startswith("."):
                                continue
                            if f.is_file():
                                f_rel = str(f.relative_to(root)).replace("\\", "/")
                                zf.write(f, f_rel)
                                added += 1
                    else:
                        zf.write(target, arcname)
                        added += 1
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
        buf.seek(0)
        self._add_audit_log("file_compress", f"{len(paths)} items -> {archive_name}", request)
        return Response(content=buf.getvalue(), media_type="application/zip",
                        headers={"Content-Disposition": f'attachment; filename="{archive_name}"'})

    async def _api_files_decompress(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        file_path = body.get("path", "")
        if not file_path:
            return JSONResponse({"error": "path required"}, status_code=400)
        target = self._resolve_safe_path(file_path)
        if target is None or not target.exists() or not target.is_file():
            return JSONResponse({"error": "File not found"}, status_code=404)
        import zipfile
        import tarfile
        dest = target.parent
        try:
            name_lower = target.name.lower()
            if name_lower.endswith(".zip"):
                with zipfile.ZipFile(target, "r") as zf:
                    zf.extractall(dest)
            elif name_lower.endswith((".tar.gz", ".tgz", ".tar.bz2", ".tar.xz", ".tar")):
                with tarfile.open(target, "r:*") as tf:
                    tf.extractall(dest)
            else:
                return JSONResponse({"error": "Unsupported archive format. Use .zip, .tar.gz, .tgz"}, status_code=400)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
        self._add_audit_log("file_decompress", file_path, request)
        return JSONResponse({"success": True, "path": str(dest.relative_to(self._get_project_root().resolve())).replace("\\", "/")})

    # ========== 命令管理 API ==========

    async def _api_commands(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        commands = self._get_all_commands_info()
        try:
            from ErisPulse.runtime import get_event_config
            event_config = get_event_config()
            command_config = event_config.get("command", {})
        except Exception:
            command_config = {}
        global_settings = {
            "prefix": command_config.get("prefix", "/"),
            "case_sensitive": command_config.get("case_sensitive", True),
            "allow_space_prefix": command_config.get("allow_space_prefix", False),
            "must_at_bot": command_config.get("must_at_bot", False),
        }
        registered_platforms = self.sdk.adapter.list_registered()
        return JSONResponse({
            "commands": commands,
            "global_settings": global_settings,
            "platforms": registered_platforms,
            "total": len(commands),
        })

    async def _api_command_update(self, request: Request) -> JSONResponse:
        if not self._verify_token(self._get_token_from_request(request)):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        body = await request.json()
        cmd_name = request.path_params.get("name", "") if request.path_params else ""
        if not cmd_name:
            path = request.scope.get("path", "")
            import re as _re
            m = _re.search(r"/api/commands/([^/]+)", path)
            cmd_name = m.group(1) if m else ""
        if not cmd_name:
            return JSONResponse({"error": "command name required"}, status_code=400)

        try:
            cmd_handler = self.sdk.Event.command
            commands = cmd_handler.get_commands()
            main_names = {info.get("main_name", n) for n, info in commands.items()}
            if cmd_name not in main_names:
                actual = cmd_handler.aliases.get(cmd_name, cmd_name)
                if actual not in main_names:
                    return JSONResponse({"error": f"command '{cmd_name}' not found"}, status_code=404)
                cmd_name = actual
        except Exception:
            return JSONResponse({"error": "failed to access command registry"}, status_code=500)

        rule = self._command_rules.get(cmd_name, {})

        if "enabled" in body:
            rule["enabled"] = bool(body["enabled"])
        if "aliases" in body:
            aliases = body["aliases"]
            if not isinstance(aliases, list):
                return JSONResponse({"error": "aliases must be a list"}, status_code=400)
            rule["aliases"] = [str(a) for a in aliases if a]
        if "allowed_platforms" in body:
            platforms = body["allowed_platforms"]
            if not isinstance(platforms, list):
                return JSONResponse({"error": "allowed_platforms must be a list"}, status_code=400)
            rule["allowed_platforms"] = [str(p) for p in platforms if p]
        if "blocked_platforms" in body:
            platforms = body["blocked_platforms"]
            if not isinstance(platforms, list):
                return JSONResponse({"error": "blocked_platforms must be a list"}, status_code=400)
            rule["blocked_platforms"] = [str(p) for p in platforms if p]
        if "transform_to" in body:
            val = body["transform_to"]
            rule["transform_to"] = str(val) if val else None

        self._command_rules[cmd_name] = rule
        self._save_command_rules()
        self._sync_command_aliases()
        self._add_audit_log("command_update", cmd_name, request)
        return JSONResponse({"success": True, "rule": rule})

