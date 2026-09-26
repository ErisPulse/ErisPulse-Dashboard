"""RoutesMixin：全部路由注册 / 注销、认证中间件与 WebSocket 通道"""

import asyncio

from fastapi import Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, Response


class RoutesMixin:
    """路由注册 / 注销（含认证中间件）与 WebSocket 实时通道。"""


    def _register_routes(self):
        r = self.sdk.router
        mn = "Dashboard"

        from pathlib import Path

        static_dir = Path(__file__).parent.parent / "static"

        # 根路径 - HTML
        async def _html(request: Request) -> HTMLResponse:
            html_path = static_dir / "dash.html"
            return HTMLResponse(html_path.read_text(encoding="utf-8"))

        # CSS 文件
        async def _css(request: Request):
            from fastapi.responses import Response

            css_path = static_dir / "dash.css"
            return Response(
                content=css_path.read_text(encoding="utf-8"), media_type="text/css"
            )

        # 如果有 JS 文件也可以加上
        async def _js(request: Request):
            from fastapi.responses import Response

            js_path = static_dir / "dash.js"
            if js_path.exists():
                return Response(
                    content=js_path.read_text(encoding="utf-8"),
                    media_type="application/javascript",
                )
            return JSONResponse({"error": "File not found"}, status_code=404)

        r.register_http_route(mn, "/", handler=_html, methods=["GET"])
        r.register_http_route(mn, "/static/dash.css", handler=_css, methods=["GET"])
        r.register_http_route(mn, "/static/dash.js", handler=_js, methods=["GET"])

        import mimetypes as _mimetypes

        async def _static_res(request: Request):
            subpath = request.path_params.get("path", "")
            file_path = static_dir / "res" / subpath
            if file_path.exists() and file_path.is_file() and ".." not in subpath:
                ct, _ = _mimetypes.guess_type(str(file_path))
                return Response(
                    content=file_path.read_bytes(),
                    media_type=ct or "application/octet-stream",
                )
            return JSONResponse({"error": "Not found"}, status_code=404)

        r.register_http_route(
            mn, "/static/res/{path:path}", handler=_static_res, methods=["GET"]
        )

        # 通用静态资源
        async def _static_any(request: Request):
            subpath = request.path_params.get("path", "")
            file_path = static_dir / subpath
            try:
                resolved = file_path.resolve()
                if (
                    file_path.exists()
                    and file_path.is_file()
                    and str(resolved).startswith(str(static_dir.resolve()))
                ):
                    ct, _ = _mimetypes.guess_type(str(file_path))
                    return Response(
                        content=file_path.read_bytes(),
                        media_type=ct or "application/octet-stream",
                    )
            except Exception:
                pass
            return JSONResponse({"error": "Not found"}, status_code=404)

        r.register_http_route(
            mn, "/static/{path:path}", handler=_static_any, methods=["GET"]
        )

        # API 路由保持不变

        # 认证中间件：统一校验 /Dashboard/api/* 的 token（公开端点放行）
        async def _auth_middleware(request: Request):
            """
            统一校验 /Dashboard/api/* 请求的 token（公开端点放行）。

            {!--< internal-use >!--}
            返回 JSONResponse 时短路请求；返回 request 则继续执行 handler。
            """
            p = str(request.url.path)
            if p in (
                "/Dashboard/api/auth",
                "/Dashboard/api/auth/status",
                "/Dashboard/api/adapter-logos",
            ):
                return request
            token = self._get_token_from_request(request)
            if not self._verify_token(token):
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
            # 多令牌权限：受限令牌按能力集放行
            # - 已映射端点：按能力 ID 校验
            # - 模块视图数据端点：按 "view:<id>" 校验（外部注册页面独立授权）
            # - 未映射端点：默认放行（兼容第三方模块自有 API）
            info = self._get_token_info(token)
            if info and not info.get("admin"):
                caps = set(info.get("caps") or [])
                api_path = p[len("/Dashboard"):] if p.startswith("/Dashboard") else p
                cap = self._resolve_api_capability(api_path)
                if cap and cap not in caps:
                    return JSONResponse({"error": "forbidden"}, status_code=403)
                if api_path.startswith("/api/views/data/"):
                    view_id = api_path[len("/api/views/data/"):]
                    if ("view:" + view_id) not in caps:
                        return JSONResponse({"error": "forbidden"}, status_code=403)
            return request

        r.middleware("/Dashboard/api/*")(_auth_middleware)

        r.register_http_route(mn, "/api/auth", handler=self._api_auth, methods=["POST"])
        r.register_http_route(
            mn, "/api/auth/status", handler=self._api_auth_status, methods=["GET"]
        )
        r.register_http_route(
            mn,
            "/api/auth/permissions",
            handler=self._api_auth_permissions,
            methods=["GET"],
        )
        r.register_http_route(
            mn, "/api/users/caps", handler=self._api_users_caps, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/users/caps", handler=self._api_users_caps, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/users/tokens", handler=self._api_users_tokens, methods=["GET"]
        )
        r.register_http_route(
            mn,
            "/api/users/tokens",
            handler=self._api_users_tokens_create,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/users/tokens/delete",
            handler=self._api_users_tokens_delete,
            methods=["POST"],
        )
        r.register_http_route(
            mn, "/api/status", handler=self._api_status, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/system", handler=self._api_system, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/adapter-logos", handler=self._api_adapter_logos, methods=["GET"]
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
        r.register_http_route(
            mn,
            "/api/module/{name}/config",
            handler=self._api_module_config_get,
            methods=["GET"],
        )
        r.register_http_route(
            mn,
            "/api/module/{name}/config",
            handler=self._api_module_config_set,
            methods=["PUT"],
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
            mn, "/api/appearance", handler=self._api_appearance, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/appearance", handler=self._api_appearance_update, methods=["PUT"]
        )
        r.register_http_route(
            mn, "/api/i18n/language", handler=self._api_i18n_sync, methods=["POST"]
        )
        r.register_http_route(
            mn,
            "/api/fonts/upload",
            handler=self._api_fonts_upload,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/fonts/delete",
            handler=self._api_fonts_delete,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/appearance/upload",
            handler=self._api_appearance_upload,
            methods=["GET", "POST"],
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
            mn,
            "/api/store/package/detail",
            handler=self._api_package_detail,
            methods=["GET"],
        )

        r.register_http_route(
            mn, "/api/packages", handler=self._api_packages, methods=["GET"]
        )
        r.register_http_route(
            mn,
            "/api/packages/updates",
            handler=self._api_packages_updates,
            methods=["GET"],
        )
        r.register_http_route(
            mn,
            "/api/packages/upgrade",
            handler=self._api_packages_upgrade,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/packages/install",
            handler=self._api_packages_install,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/packages/git",
            handler=self._api_packages_git,
            methods=["GET"],
        )
        r.register_http_route(
            mn,
            "/api/packages/git-upgrade",
            handler=self._api_packages_git_upgrade,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/packages/uninstall",
            handler=self._api_packages_uninstall,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/framework/versions",
            handler=self._api_framework_versions,
            methods=["GET"],
        )
        r.register_http_route(
            mn,
            "/api/framework/update",
            handler=self._api_framework_update,
            methods=["POST"],
        )
        r.register_http_route(
            mn, "/api/restart", handler=self._api_restart, methods=["POST"]
        )

        # 事件构建器相关 API
        r.register_http_route(
            mn,
            "/api/builder/validate",
            handler=self._api_builder_validate,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/builder/submit",
            handler=self._api_builder_submit,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/builder/segments",
            handler=self._api_builder_segments,
            methods=["GET"],
        )

        # 配置源码相关 API
        r.register_http_route(
            mn,
            "/api/config/source",
            handler=self._api_config_source,
            methods=["GET", "POST"],
        )

        # 日志相关 API
        r.register_http_route(mn, "/api/logs", handler=self._api_logs, methods=["GET"])
        r.register_http_route(
            mn, "/api/logs/clear", handler=self._api_logs_clear, methods=["POST"]
        )

        # 生命周期相关 API
        r.register_http_route(
            mn, "/api/lifecycle", handler=self._api_lifecycle, methods=["GET"]
        )
        r.register_http_route(
            mn,
            "/api/lifecycle/clear",
            handler=self._api_lifecycle_clear,
            methods=["POST"],
        )

        # 性能监控相关 API
        r.register_http_route(
            mn, "/api/performance", handler=self._api_performance, methods=["GET"]
        )

        # API 路由列表相关 API
        r.register_http_route(
            mn, "/api/routes", handler=self._api_routes, methods=["GET"]
        )

        # 消息统计相关 API
        r.register_http_route(
            mn, "/api/message-stats", handler=self._api_message_stats, methods=["GET"]
        )

        r.register_http_route(
            mn, "/api/audit", handler=self._api_audit, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/audit/clear", handler=self._api_audit_clear, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/backup/export", handler=self._api_backup_export, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/backup/import", handler=self._api_backup_import, methods=["POST"]
        )

        r.register_http_route(
            mn, "/api/files/browse", handler=self._api_files_browse, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/files/read", handler=self._api_files_read, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/files/write", handler=self._api_files_write, methods=["PUT"]
        )
        r.register_http_route(
            mn, "/api/files/upload", handler=self._api_files_upload, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/files/download", handler=self._api_files_download, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/files/mkdir", handler=self._api_files_mkdir, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/files/delete", handler=self._api_files_delete, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/files/rename", handler=self._api_files_rename, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/files/copy", handler=self._api_files_copy, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/files/chmod", handler=self._api_files_chmod, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/files/stat", handler=self._api_files_stat, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/files/search", handler=self._api_files_search, methods=["GET"]
        )
        r.register_http_route(
            mn,
            "/api/files/compress",
            handler=self._api_files_compress,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/files/decompress",
            handler=self._api_files_decompress,
            methods=["POST"],
        )

        r.register_http_route(
            mn, "/api/commands", handler=self._api_commands, methods=["GET"]
        )
        # 注意: 具体路径必须在参数化路径之前注册，否则会被 {name} 匹配
        r.register_http_route(
            mn,
            "/api/commands/settings",
            handler=self._api_command_settings_update,
            methods=["PUT"],
        )
        r.register_http_route(
            mn,
            "/api/commands/{name}",
            handler=self._api_command_update,
            methods=["PUT"],
        )
        r.register_http_route(
            mn, "/api/master", handler=self._api_master_get, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/master", handler=self._api_master_update, methods=["PUT"]
        )

        # 作用域（scope）相关 API
        r.register_http_route(
            mn, "/api/scope", handler=self._api_scope_get, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/scope/settings", handler=self._api_scope_settings, methods=["PUT"]
        )
        r.register_http_route(
            mn, "/api/scope/module", handler=self._api_scope_module, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/scope/module", handler=self._api_scope_module, methods=["DELETE"]
        )
        r.register_http_route(
            mn, "/api/scope/identity", handler=self._api_scope_identity, methods=["POST"]
        )
        r.register_http_route(
            mn,
            "/api/scope/identity",
            handler=self._api_scope_identity,
            methods=["DELETE"],
        )
        r.register_http_route(
            mn, "/api/scope/action", handler=self._api_scope_action, methods=["POST"]
        )
        r.register_http_route(
            mn, "/api/scope/action", handler=self._api_scope_action, methods=["DELETE"]
        )
        r.register_http_route(
            mn, "/api/scope/test", handler=self._api_scope_test, methods=["POST"]
        )
        r.register_http_route(
            mn,
            "/api/scope/stats/reset",
            handler=self._api_scope_stats_reset,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/scope/runtime/cleanup",
            handler=self._api_scope_runtime_cleanup,
            methods=["POST"],
        )
        r.register_http_route(
            mn, "/api/scope/export", handler=self._api_scope_export, methods=["GET"]
        )
        r.register_http_route(
            mn, "/api/scope/import", handler=self._api_scope_import, methods=["POST"]
        )

        # 拓扑树 API
        r.register_http_route(
            mn, "/api/topology", handler=self._api_topology, methods=["GET"]
        )

        r.register_http_route(
            mn, "/api/views", handler=self._api_views, methods=["GET"]
        )

        # 集群管理 API
        r.register_http_route(
            mn,
            "/api/cluster/nodes",
            handler=self._api_cluster_nodes_list,
            methods=["GET"],
        )
        r.register_http_route(
            mn,
            "/api/cluster/nodes",
            handler=self._api_cluster_nodes_add,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/cluster/nodes/{node_id}",
            handler=self._api_cluster_nodes_update,
            methods=["PUT"],
        )
        r.register_http_route(
            mn,
            "/api/cluster/nodes/{node_id}",
            handler=self._api_cluster_nodes_delete,
            methods=["DELETE"],
        )
        r.register_http_route(
            mn,
            "/api/cluster/nodes/{node_id}/ping",
            handler=self._api_cluster_ping,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/cluster/nodes/{node_id}/probe",
            handler=self._api_cluster_probe,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/cluster/nodes/{node_id}/status",
            handler=self._api_cluster_node_status,
            methods=["GET"],
        )
        r.register_http_route(
            mn,
            "/api/cluster/proxy/{node_id}/{path:path}",
            handler=self._api_cluster_proxy,
            methods=["GET", "POST", "PUT", "DELETE"],
        )
        r.register_http_route(
            mn,
            "/api/cluster/overview",
            handler=self._api_cluster_overview,
            methods=["GET"],
        )
        r.register_http_route(
            mn,
            "/api/cluster/sync/events",
            handler=self._api_cluster_sync_events,
            methods=["POST"],
        )

        r.register_http_route(
            mn,
            "/api/adapter/{platform}/config",
            handler=self._api_adapter_config_get,
            methods=["GET"],
        )
        r.register_http_route(
            mn,
            "/api/adapter/{platform}/config",
            handler=self._api_adapter_config_set,
            methods=["PUT"],
        )
        r.register_http_route(
            mn,
            "/api/adapter/{platform}/accounts",
            handler=self._api_adapter_accounts_get,
            methods=["GET"],
        )
        r.register_http_route(
            mn,
            "/api/adapter/{platform}/accounts",
            handler=self._api_adapter_accounts_set,
            methods=["PUT"],
        )
        r.register_http_route(
            mn,
            "/api/adapter/{platform}/accounts/add",
            handler=self._api_adapter_accounts_add,
            methods=["POST"],
        )
        r.register_http_route(
            mn,
            "/api/adapter/{platform}/accounts/{name}",
            handler=self._api_adapter_accounts_delete,
            methods=["DELETE"],
        )

        r.register_websocket(mn, "/ws", handler=self._ws_handler)

    def _unregister_routes(self):
        """
        从路由管理器自省实际注册内容并注销，避免注册/注销列表漂移。

        {!--< internal-use >!--}
        在模块卸载/热重载时调用，确保所有 Dashboard 路由被正确清理。
        不依赖硬编码路径清单，注册与注销永远一致。
        """
        r = self.sdk.router
        mn = "Dashboard"

        http_routes_dict = getattr(r, "_http_routes", None)
        if isinstance(http_routes_dict, dict):
            paths = http_routes_dict.get(mn, {})
            for full_path in list(paths.keys()):
                rel = full_path.replace("/" + mn, "", 1) or "/"
                try:
                    r.unregister_http_route(mn, rel)
                except Exception:
                    pass

        ws_routes_dict = getattr(r, "_websocket_routes", None)
        if isinstance(ws_routes_dict, dict):
            ws_paths = ws_routes_dict.get(mn, {})
            for ws_path in list(ws_paths.keys()):
                rel = ws_path.replace("/" + mn, "", 1) or "/ws"
                try:
                    r.unregister_websocket(mn, rel)
                except Exception:
                    pass

    def _get_token_from_request(self, request: Request) -> str | None:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:]
        return request.query_params.get("token")


    def _resolve_api_capability(self, path: str) -> str | None:
        """API 路径 → 能力 ID：先精确匹配，再按最长前缀匹配；未映射返回 None（放行）"""
        from .Cluster import API_TO_CAPABILITY_MAP

        if path in API_TO_CAPABILITY_MAP:
            return API_TO_CAPABILITY_MAP[path]
        best, best_len = None, 0
        for route, cap in API_TO_CAPABILITY_MAP.items():
            if path.startswith(route) and len(route) > best_len:
                best, best_len = cap, len(route)
        return best

    # ════════════════ WebSocket 实时通道 ════════════════

    async def _ws_handler(self, websocket: WebSocket):
        token = websocket.query_params.get("token", "")
        if not self._verify_token(token):
            await websocket.close(code=1008, reason="Unauthorized")
            return
        self._ws_clients.append(websocket)
        try:

            async def _heartbeat():
                while websocket in self._ws_clients:
                    await asyncio.sleep(30)
                    try:
                        await websocket.send_json({"type": "ping"})
                    except Exception:
                        break

            hb = asyncio.create_task(_heartbeat())
            try:
                while True:
                    await websocket.receive_text()
            finally:
                hb.cancel()
        except WebSocketDisconnect:
            pass
        finally:
            if websocket in self._ws_clients:
                self._ws_clients.remove(websocket)
