"""ApiObservabilityMixin：配置源码 / 日志 / 审计 / 生命周期 / 性能 / 路由 / 备份 API"""

import os
import time

from fastapi import Request, Response
from fastapi.responses import FileResponse, JSONResponse


def _remove_temp_file(path: str) -> None:
    """响应完成后删除日志导出临时文件（后台任务调用，失败静默）"""
    try:
        os.remove(path)
    except OSError:
        pass


class ApiObservabilityMixin:
    """配置源码、日志、审计、生命周期、性能、路由与备份 API。"""


    async def _api_config_source(self, request: Request) -> JSONResponse:
        """获取/更新配置文件源码"""

        from pathlib import Path

        config_path = Path.cwd() / "config" / "config.toml"

        if request.method == "POST":
            body = await request.json()
            content = body.get("content", "")

            try:
                config_path.write_text(content, encoding="utf-8")
                self.sdk.config.reload()
                self._add_audit_log("config_source_save", "", request)
                return JSONResponse({"success": True})
            except Exception as e:
                return JSONResponse(
                    {"success": False, "error": str(e)}, status_code=400
                )
        else:
            if config_path.exists():
                content = config_path.read_text(encoding="utf-8")
                return JSONResponse({"content": content})
            else:
                return JSONResponse({"error": "Config file not found"}, status_code=404)

    # ════════════════ API · 日志 / 审计 / 生命周期 / 性能 ════════════════

    async def _api_logs(self, request: Request) -> JSONResponse:
        """获取日志（从 Dashboard 按级别分缓冲读取）"""

        limit = int(request.query_params.get("limit", "200"))
        module_filter = request.query_params.get("module", "")
        levels_param = request.query_params.get("levels", "")
        level_filter = request.query_params.get("level", "").upper()
        search = request.query_params.get("search", "").lower()

        requested_levels = None
        if levels_param:
            requested_levels = set(
                l.strip().upper() for l in levels_param.split(",") if l.strip()
            )

        logs_list = []

        # 从 Dashboard 按级别分缓冲读取
        buf = []
        for lvl, deq in self._log_by_level.items():
            if requested_levels is not None and lvl not in requested_levels:
                continue
            buf.extend(deq)

        if buf:
            for entry in buf:
                level_num = entry.get("level_num", 0)
                module_name = entry.get("module", "")
                message = entry.get("message", "")
                if module_filter and module_filter.lower() not in module_name.lower():
                    continue
                if level_filter:
                    filter_num = self.sdk.logger._resolve_level(level_filter)
                    if filter_num is not None and level_num < filter_num:
                        continue
                if search and search not in message.lower():
                    continue
                logs_list.append({
                    "module": module_name,
                    "timestamp": entry.get("timestamp", ""),
                    "message": message,
                    "level": entry.get("level", ""),
                    "level_num": level_num,
                })
        else:
            # 回退：从 sdk.logger._logs 读取（受全局日志级别限制）
            try:
                internal_logs = self.sdk.logger._logs
                for module_name, entries in internal_logs.items():
                    if module_filter and module_filter.lower() not in module_name.lower():
                        continue
                    for entry in entries:
                        level_name = entry.get("level", "")
                        level_num = entry.get("level_num", 0)
                        if requested_levels is not None and level_name.upper() not in requested_levels:
                            continue
                        if level_filter:
                            filter_num = self.sdk.logger._resolve_level(level_filter)
                            if filter_num is not None and level_num < filter_num:
                                continue
                        message = entry.get("message", "")
                        if search and search not in message.lower():
                            continue
                        logs_list.append({
                            "module": module_name,
                            "timestamp": entry.get("timestamp", ""),
                            "message": message,
                            "level": level_name,
                            "level_num": level_num,
                        })
            except Exception:
                # 最终回退：公开 API（旧版本，无级别信息）
                all_logs = self.sdk.logger.get_logs()
                import re
                for module_name, logs in all_logs.items():
                    if module_filter and module_filter.lower() not in module_name.lower():
                        continue
                    for log_entry in logs:
                        timestamp_str = ""
                        message = ""
                        if isinstance(log_entry, dict):
                            timestamp_str = log_entry.get("timestamp", "")
                            message = log_entry.get("message", "")
                        elif " - " in log_entry:
                            parts = log_entry.split(" - ", 1)
                            timestamp_str = parts[0]
                            message = parts[1]
                        else:
                            match = re.match(
                                r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.+)$",
                                log_entry,
                            )
                            if match:
                                timestamp_str = match.group(1)
                                message = match.group(3)
                            else:
                                message = log_entry
                        if search and search not in message.lower():
                            continue
                        logs_list.append({
                            "module": module_name,
                            "timestamp": timestamp_str,
                            "message": message,
                            "level": "",
                            "level_num": 0,
                        })

        logs_list.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        return JSONResponse({"logs": logs_list[:limit], "total": len(logs_list)})

    async def _api_logs_clear(self, request: Request) -> JSONResponse:
        """清空 Dashboard 缓存的日志缓冲"""

        for deq in self._log_by_level.values():
            deq.clear()
        self._logs_dirty = True
        self._add_audit_log("logs_clear", "", request)
        return JSONResponse({"success": True, "message": "日志缓存已清空"})

    async def _api_lifecycle(self, request: Request) -> JSONResponse:
        """获取生命周期事件"""

        return JSONResponse(
            {"events": list(self._lifecycle_log), "total": len(self._lifecycle_log)}
        )

    async def _api_lifecycle_clear(self, request: Request) -> JSONResponse:
        """清空生命周期事件"""

        self._lifecycle_log.clear()
        self._lifecycle_counts.clear()
        self._add_audit_log("lifecycle_clear", "", request)
        return JSONResponse({"success": True})

    async def _api_performance(self, request: Request) -> JSONResponse:
        """获取性能监控数据"""

        system_status = await self._get_system_status()

        # 添加 WebSocket 连接统计
        ws_stats = {
            "active_connections": len(self._ws_clients),
            "uptime_seconds": system_status["uptime_seconds"],
            "uptime_human": system_status["uptime_human"],
        }

        return JSONResponse(
            {
                "system": system_status,
                "websocket": ws_stats,
                "lifecycle_counts": self._lifecycle_counts,
            }
        )

    async def _api_routes(self, request: Request) -> JSONResponse:
        """获取所有注册的 API 路由（kind 分组）。

        优先使用路由管理器公开枚举 API（list_namespaces / get_module_routes /
        get_module_urls），私有 _http_routes / _websocket_routes 仅作旧 SDK 回退；
        同时输出旧版扁平字段 http_routes / ws_routes，保持旧前端与集群旧节点兼容。
        """

        router_manager = self.sdk.router
        base_url = ""
        namespaces: dict = {}

        list_namespaces = getattr(router_manager, "list_namespaces", None)
        get_module_routes = getattr(router_manager, "get_module_routes", None)
        get_module_urls = getattr(router_manager, "get_module_urls", None)

        if list_namespaces is not None:
            try:
                ns_map = list_namespaces() or {}
            except Exception:
                ns_map = {}

            for ns, kind_paths in ns_map.items():
                kind_paths = kind_paths or {}
                detail: dict = {}
                urls: dict = {}
                if get_module_routes is not None:
                    try:
                        detail = get_module_routes(ns) or {}
                    except Exception:
                        detail = {}
                if get_module_urls is not None:
                    try:
                        urls = get_module_urls(ns) or {}
                        base_url = urls.get("base_url", "") or base_url
                    except Exception:
                        urls = {}

                # HTTP 行：path + methods + url（get_module_routes 为主，list_namespaces 纯路径兜底）
                url_http = {
                    i.get("path"): i.get("url", "") for i in (urls.get("http") or [])
                }
                http_rows: dict = {}
                for item in detail.get("http") or []:
                    row_path = item.get("path", "")
                    row = http_rows.setdefault(
                        row_path,
                        {
                            "path": row_path,
                            "methods": [],
                            "url": url_http.get(row_path, ""),
                        },
                    )
                    for m in item.get("methods") or []:
                        if m not in row["methods"]:
                            row["methods"].append(m)
                for path in kind_paths.get("http") or []:
                    http_rows.setdefault(
                        path, {"path": path, "methods": [], "url": url_http.get(path, "")}
                    )

                # WS / SSE 行：detail 提供认证与流式标记，list_namespaces 提供路径兜底
                detail_ws = {
                    i.get("path"): bool(i.get("auth"))
                    for i in detail.get("websocket") or []
                }
                ws_paths = list(
                    dict.fromkeys(
                        [i.get("path") for i in detail.get("websocket") or []]
                        + list(kind_paths.get("websocket") or [])
                    )
                )
                sse_paths = list(
                    dict.fromkeys(
                        [i.get("path") for i in detail.get("sse") or []]
                        + list(kind_paths.get("sse") or [])
                    )
                )
                url_ws = {
                    i.get("path"): i.get("url", "") for i in (urls.get("websocket") or [])
                }
                url_sse = {
                    i.get("path"): i.get("url", "") for i in (urls.get("sse") or [])
                }

                namespaces[ns] = {
                    "http": sorted(
                        (
                            {**row, "methods": sorted(row["methods"])}
                            for row in http_rows.values()
                        ),
                        key=lambda r: r["path"],
                    ),
                    "websocket": [
                        {"path": p, "url": url_ws.get(p, ""), "auth": detail_ws.get(p, False)}
                        for p in ws_paths
                    ],
                    "sse": [{"path": p, "url": url_sse.get(p, "")} for p in sse_paths],
                }
        else:
            # 旧 SDK 回退：私有路由表内省（仅结构化信息，不再 inspect 处理器源码）
            http_routes_dict = getattr(router_manager, "_http_routes", None) or {}
            ws_routes_dict = getattr(router_manager, "_websocket_routes", None) or {}
            if isinstance(http_routes_dict, dict):
                for module_name, paths in http_routes_dict.items():
                    entry = namespaces.setdefault(
                        module_name, {"http": [], "websocket": [], "sse": []}
                    )
                    for path, methods in paths.items():
                        entry["http"].append(
                            {"path": path, "methods": sorted(methods.keys()), "url": ""}
                        )
            if isinstance(ws_routes_dict, dict):
                for module_name, paths in ws_routes_dict.items():
                    entry = namespaces.setdefault(
                        module_name, {"http": [], "websocket": [], "sse": []}
                    )
                    for path, route_info in paths.items():
                        auth_handler = (
                            route_info[1]
                            if isinstance(route_info, tuple) and len(route_info) > 1
                            else None
                        )
                        entry["websocket"].append(
                            {"path": path, "url": "", "auth": auth_handler is not None}
                        )

        # 旧版扁平字段：由 kind 分组数据派生（移除模块前缀的展示路径与原字段保持一致）
        http_routes: list = []
        ws_routes: list = []
        for ns, kinds in namespaces.items():
            for row in kinds["http"]:
                for method in row["methods"]:
                    http_routes.append(
                        {
                            "path": row["path"].replace("/" + ns, "", 1) or "/",
                            "full_path": row["path"],
                            "method": method,
                            "module": ns,
                        }
                    )
            for row in kinds["websocket"]:
                ws_routes.append(
                    {
                        "path": row["path"].replace("/" + ns, "", 1) or "/",
                        "full_path": row["path"],
                        "module": ns,
                        "has_auth": bool(row.get("auth")),
                        "auto_accept": True,
                    }
                )

        return JSONResponse(
            {
                "kind_grouped": True,
                "base_url": base_url,
                "namespaces": namespaces,
                "http_routes": http_routes,
                "ws_routes": ws_routes,
            }
        )

    # ════════════════ API · 健康聚合 / 连接注册表 / 日志导出 ════════════════

    async def _api_health(self, request: Request) -> JSONResponse:
        """框架核心组件健康聚合（对齐 SDK /health 语义，进程内直接组装，不做 HTTP 自调用）。

        返回 {storage, adapters, modules, router, detail}；storage 经 _is_ready 探测，
        旧 SDK 无该方法时回退兜底查询测试。
        """

        s = self.sdk
        detail: dict = {}
        storage_error = ""

        # ---- storage：优先 _is_ready 探测（与 SDK /health 同源），无则兜底查询 ----
        storage_ok: bool | None = None
        is_ready = getattr(s.storage, "_is_ready", None)
        if is_ready is not None:
            try:
                storage_ok = bool(is_ready())
            except Exception as e:
                storage_ok = False
                storage_error = str(e)
        if storage_ok is None:
            try:
                s.storage.get("__ep_dashboard_health_probe__")
                storage_ok = True
            except Exception as e:
                storage_ok = False
                storage_error = str(e)
        detail["storage"] = {
            "backend": type(s.storage).__name__,
        }
        if storage_error:
            detail["storage"]["error"] = storage_error

        # ---- adapters：get_status_summary 为主，_started_instances 计数兜底 ----
        adapters_summary: dict = {}
        summary_fn = getattr(s.adapter, "get_status_summary", None)
        if summary_fn is not None:
            try:
                adapters_summary = summary_fn().get("adapters", {}) or {}
            except Exception:
                adapters_summary = {}
        started_instances = getattr(s.adapter, "_started_instances", None)
        if started_instances is not None:
            adapters_ok = len(started_instances) > 0
            started_count = len(started_instances)
        else:
            started_count = sum(
                1
                for a in adapters_summary.values()
                if isinstance(a, dict) and a.get("status") == "started"
            )
            adapters_ok = started_count > 0
        online_bots = 0
        for a in adapters_summary.values():
            if not isinstance(a, dict):
                continue
            for bot in (a.get("bots") or {}).values():
                if isinstance(bot, dict) and bot.get("status") == "online":
                    online_bots += 1
        detail["adapters"] = {
            "total": len(adapters_summary),
            "started": started_count,
            "online_bots": online_bots,
        }

        # ---- modules：_loaded_modules 计数，公开 list_loaded 兜底 ----
        loaded_modules = getattr(s.module, "_loaded_modules", None)
        if not isinstance(loaded_modules, (set, list, tuple)):
            try:
                loaded_modules = s.module.list_loaded()
            except Exception:
                loaded_modules = []
        modules_ok = len(loaded_modules) > 0
        detail["modules"] = {"loaded": len(loaded_modules)}

        # ---- router：_uvicorn_server 探测；属性缺失时以"本请求已被路由"为真 ----
        uvicorn_server = getattr(s.router, "_uvicorn_server", None)
        router_ok = True if uvicorn_server is None else uvicorn_server is not None
        detail["router"] = {"listening": router_ok}

        return JSONResponse(
            {
                "storage": bool(storage_ok),
                "adapters": bool(adapters_ok),
                "modules": bool(modules_ok),
                "router": bool(router_ok),
                "status": "ok"
                if (storage_ok and adapters_ok and modules_ok and router_ok)
                else "degraded",
                "detail": detail,
                "timestamp": time.time(),
            }
        )

    def _get_connections_mgr(self):
        """连接注册表单例：位于 ErisPulse.Core.connections（Core 包级单例，
        非 sdk 属性——sdk.connections 不存在，访问会触发 __getattr__ 报错）"""
        try:
            from ErisPulse.Core import connections as conn_mgr

            if hasattr(conn_mgr, "list"):
                return conn_mgr
        except Exception:
            pass
        return None

    async def _api_connections(self, request: Request) -> JSONResponse:
        """连接注册表面板数据：list() + stats()（旧 SDK 无 connections 模块时返回 supported=false）。"""

        conn_mgr = self._get_connections_mgr()
        if conn_mgr is None or not hasattr(conn_mgr, "list"):
            return JSONResponse(
                {"supported": False, "connections": [], "stats": {}}
            )

        try:
            conns = conn_mgr.list()
        except Exception as e:
            return JSONResponse(
                {"supported": True, "connections": [], "stats": {}, "error": str(e)}
            )

        items = []
        for conn in conns:
            try:
                groups = getattr(conn, "groups", None) or ()
                meta = getattr(conn, "_conn_meta", None) or {}
                items.append(
                    {
                        "id": getattr(conn, "id", ""),
                        "namespace": getattr(conn, "namespace", "") or "",
                        "owner": getattr(conn, "owner", "") or "",
                        "kind": getattr(conn, "kind", "") or "",
                        "groups": sorted(str(g) for g in groups),
                        "meta": dict(meta) if isinstance(meta, dict) else {},
                    }
                )
            except Exception:
                continue
        items.sort(key=lambda c: (c["namespace"], c["kind"], c["id"]))

        stats: dict = {}
        if hasattr(conn_mgr, "stats"):
            try:
                stats = conn_mgr.stats() or {}
            except Exception:
                stats = {}

        return JSONResponse(
            {"supported": True, "connections": items, "stats": stats}
        )

    async def _api_connections_close(self, request: Request) -> JSONResponse:
        """关闭指定连接（管理面操作，记审计）。"""

        try:
            body = await request.json()
        except Exception:
            body = {}
        conn_id = ""
        if isinstance(body, dict):
            conn_id = str(body.get("id", "") or "")
        if not conn_id:
            conn_id = str(request.query_params.get("id", "") or "")
        if not conn_id:
            return JSONResponse({"error": "Missing connection id"}, status_code=400)

        conn_mgr = self._get_connections_mgr()
        if conn_mgr is None or not hasattr(conn_mgr, "close"):
            return JSONResponse(
                {"success": False, "error": "connections API unavailable"},
                status_code=501,
            )

        success = False
        error = ""
        try:
            success = bool(await conn_mgr.close(conn_id))
        except Exception as first_err:
            # 跨 owner 关闭被权限校验拒绝时，按管理面语义强制关闭（框架回收路径同参）
            try:
                success = bool(await conn_mgr.close(conn_id, force=True))
            except Exception as second_err:
                error = str(second_err) if second_err else str(first_err)

        self._add_audit_log(
            "connection_close",
            f"{conn_id}" + ("" if success else f" failed: {error}"),
            request,
        )
        return JSONResponse({"success": success, "error": error})

    async def _api_logs_export(self, request: Request) -> Response:
        """导出框架内存日志为可下载文件。

        经 sdk.logger.save_logs 落临时文件后由 FileResponse 流式返回，
        临时文件随响应完成在后台任务中删除（FileResponse 惰性读取，
        不能在 handler 返回前删除）。
        """

        import tempfile
        from datetime import datetime

        from starlette.background import BackgroundTask

        from .ApiFiles import _content_disposition

        save_logs = getattr(self.sdk.logger, "save_logs", None)
        if save_logs is None:
            return JSONResponse(
                {"error": "logger.save_logs unavailable"}, status_code=501
            )

        fd, tmp_path = tempfile.mkstemp(prefix="erispulse-logs-", suffix=".log")
        os.close(fd)
        try:
            ok = save_logs(tmp_path)
        except Exception as e:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
            return JSONResponse({"error": str(e)}, status_code=500)

        if not ok:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
            return JSONResponse({"error": "no logs to export"}, status_code=404)

        date_str = datetime.now().strftime("%Y-%m-%d")
        filename = f"erispulse-logs-{date_str}.log"
        return FileResponse(
            tmp_path,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": _content_disposition(filename)},
            background=BackgroundTask(_remove_temp_file, tmp_path),
        )

    async def _api_message_stats(self, request: Request) -> JSONResponse:
        """获取消息统计"""

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

        return JSONResponse(
            {
                "total_events": self._total_event_count,
                "by_type": type_counts,
                "by_platform": platform_counts,
                "hourly": hourly_stats,
            }
        )

    async def _api_audit(self, request: Request) -> JSONResponse:
        limit = int(request.query_params.get("limit", "200"))
        action_filter = request.query_params.get("action", "")
        logs = list(self._audit_log)
        if action_filter:
            logs = [l for l in logs if l.get("action") == action_filter]
        return JSONResponse({"logs": logs[-limit:], "total": len(logs)})

    async def _api_audit_clear(self, request: Request) -> JSONResponse:
        self._audit_log.clear()
        self._persist_audit()
        self._add_audit_log("audit_clear", "", request)
        return JSONResponse({"success": True})

    async def _api_capabilities(self, request: Request) -> JSONResponse:
        """SDK 能力探测表（hasattr 一次成型），供前端按能力显隐功能"""
        s = self.sdk
        return JSONResponse(
            {
                "capabilities": {
                    "ssl_reload": hasattr(s.router, "reload"),
                    "config_get_all": hasattr(s.config, "getAllConfig"),
                    "config_delete": hasattr(s.config, "delConfig"),
                    "adapter_meta": hasattr(s.adapter, "get_meta"),
                    "adapter_connection": hasattr(
                        s.adapter, "get_connection_info"
                    ),
                    "dump_state": hasattr(s, "dump_state"),
                    "is_supervised": hasattr(s, "is_supervised"),
                    "home_entry": hasattr(s.router, "register_home_entry"),
                    "logger_handler": hasattr(s.logger, "handler"),
                    "unregister_all_by_namespace": hasattr(
                        s.router, "unregister_all_by_namespace"
                    ),
                    "module_views": True,
                }
            }
        )

    async def _api_diagnostics(self, request: Request) -> JSONResponse:
        """诊断快照：框架信息 + 运行状态 + SDK dump_state（守卫）+ 近期审计"""
        dump = None
        dump_fn = getattr(self.sdk, "dump_state", None)
        if dump_fn is not None:
            try:
                dump = dump_fn()
            except Exception as e:
                dump = {"error": str(e)}
        return JSONResponse(
            {
                "framework": self._get_framework_info(),
                "adapters": self.sdk.adapter.get_status_summary().get(
                    "adapters", {}
                ),
                "modules": {
                    n: self.sdk.module.is_loaded(n)
                    for n in self.sdk.module.list_registered()
                },
                "sdk_state": dump,
                "audit_recent": self._audit_log[-20:],
                "timestamp": time.time(),
            }
        )

    # ════════════════ API · 备份 ════════════════

    async def _api_backup_export(self, request: Request) -> JSONResponse:
        # 优先公开 API 全量读取，旧 SDK 回退私有 _cache
        if hasattr(self.sdk.config, "getAllConfig"):
            config_data = dict(self.sdk.config.getAllConfig())
        else:
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
        self._add_audit_log("backup_export", "", request)
        return JSONResponse(backup)

    async def _api_backup_import(self, request: Request) -> JSONResponse:
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
        self._add_audit_log(
            "backup_import",
            f"config: {len(config_data)} keys, storage: {len(storage_data)} keys",
            request,
        )
        return JSONResponse(
            {
                "success": True,
                "config_restored": len(config_data),
                "storage_restored": len(storage_data),
            }
        )
