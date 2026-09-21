"""ApiObservabilityMixin：配置源码 / 日志 / 审计 / 生命周期 / 性能 / 路由 / 备份 API"""

import time

from fastapi import Request
from fastapi.responses import JSONResponse


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
        """获取所有注册的 API 路由"""

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

                    handler_name = (
                        handler.__name__ if hasattr(handler, "__name__") else "unknown"
                    )
                    handler_file = (
                        inspect.getfile(handler)
                        if inspect.isfunction(handler)
                        else "unknown"
                    )
                    handler_line = (
                        inspect.getsourcelines(handler)[0]
                        if inspect.isfunction(handler)
                        else "unknown"
                    )

                    http_routes.append(
                        {
                            "path": path.replace("/" + module_name, "", 1)
                            or "/",  # 移除模块前缀
                            "full_path": path,
                            "method": method,
                            "module": module_name,
                            "handler": {
                                "name": handler_name,
                                "file": handler_file,
                                "line": handler_line,
                            },
                        }
                    )

        ws_routes = []
        for module_name, paths in ws_routes_dict.items():
            for path, route_info in paths.items():
                if isinstance(route_info, tuple):
                    handler = route_info[0]
                    auth_handler = route_info[1] if len(route_info) > 1 else None
                    auto_accept = route_info[2] if len(route_info) > 2 else True
                else:
                    handler = route_info
                    auth_handler = None
                    auto_accept = True
                import inspect

                handler_name = (
                    handler.__name__ if hasattr(handler, "__name__") else "unknown"
                )
                handler_file = (
                    inspect.getfile(handler)
                    if inspect.isfunction(handler)
                    else "unknown"
                )
                handler_line = (
                    inspect.getsourcelines(handler)[0]
                    if inspect.isfunction(handler)
                    else "unknown"
                )

                ws_routes.append(
                    {
                        "path": path.replace("/" + module_name, "", 1)
                        or "/",  # 移除模块前缀
                        "full_path": path,
                        "module": module_name,
                        "has_auth": auth_handler is not None,
                        "auto_accept": auto_accept,
                        "handler": {
                            "name": handler_name,
                            "file": handler_file,
                            "line": handler_line,
                        },
                    }
                )

        return JSONResponse({"http_routes": http_routes, "ws_routes": ws_routes})

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

    # ════════════════ API · 备份 ════════════════

    async def _api_backup_export(self, request: Request) -> JSONResponse:
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
