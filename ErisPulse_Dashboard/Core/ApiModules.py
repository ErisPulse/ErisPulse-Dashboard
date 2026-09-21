"""ApiModulesMixin：模块列表、加载操作与模块配置 API"""

import asyncio
import copy
import secrets
import threading

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiModulesMixin:
    """模块列表、加载 / 卸载 / 重载操作与模块配置 API。"""


    async def _api_modules(self, request: Request) -> JSONResponse:

        module_manager = self.sdk.module
        adapter_list = self.sdk.adapter.list_registered()

        # --- 并行：路由计数 + 视窗计数 + Git 包 + Bot 计数 + 适配器能力 ---
        async def _compute_meta():
            """计算路由和视窗计数"""
            routes_counts: dict[str, int] = {}
            views_counts: dict[str, int] = {}
            try:
                router_manager = self.sdk.router
                for mn, paths in router_manager._http_routes.items():
                    routes_counts[mn] = routes_counts.get(mn, 0) + sum(
                        len(methods) for methods in paths.values()
                    )
                for mn, paths in router_manager._websocket_routes.items():
                    routes_counts[mn] = routes_counts.get(mn, 0) + len(paths)
            except Exception:
                pass
            try:
                for view in self.get_registered_views():
                    vid = view.get("id", "")
                    views_counts[vid] = views_counts.get(vid, 0) + 1
            except Exception:
                pass
            return routes_counts, views_counts

        async def _compute_adapter_extras():
            """计算 Bot 计数和适配器能力"""
            bot_counts: dict[str, int] = {}
            caps: dict[str, list] = {}
            try:
                all_bots = self.sdk.adapter.list_bots()
                for p, bs in all_bots.items():
                    bot_counts[p] = len(bs)
            except Exception:
                pass

            # 并行拉取每个平台的能力
            async def _one_cap(p: str):
                try:
                    return p, self.sdk.adapter.list_sends(p) or []
                except Exception:
                    return p, []

            if adapter_list:
                for coro in asyncio.as_completed([_one_cap(p) for p in adapter_list]):
                    p, val = await coro
                    caps[p] = val
            return bot_counts, caps

        # 并行执行两组计算
        (
            (routes_counts, views_counts),
            (adapter_bot_counts, adapter_capabilities),
        ) = await asyncio.gather(_compute_meta(), _compute_adapter_extras())

        # Git 包（纯内存查找）
        git_packages: dict[str, dict] = {}
        try:
            git_packages = self._get_pkg_manager().get_git_packages()
        except Exception:
            pass

        modules = []
        for name in module_manager.list_registered():
            info = module_manager.get_info(name) or {}
            load_strategy = None
            try:
                mc = module_manager._module_classes.get(name)
                if mc and hasattr(mc, "get_load_strategy"):
                    ls = mc.get_load_strategy()
                    load_strategy = {
                        "lazy_load": getattr(ls, "lazy_load", None),
                        "priority": getattr(ls, "priority", None),
                        "depends": getattr(ls, "depends", None) or [],
                    }
            except Exception:
                pass
            pkg_name = info.get("package", "")
            is_git = pkg_name.lower() in git_packages if pkg_name else False
            modules.append(
                {
                    "name": name,
                    "type": "module",
                    "enabled": module_manager.is_enabled(name),
                    "loaded": module_manager.is_loaded(name),
                    "version": info.get("version", ""),
                    "description": info.get("description", ""),
                    "author": info.get("author", ""),
                    "package": pkg_name,
                    "load_strategy": load_strategy,
                    "routes_count": routes_counts.get(name, 0),
                    "views_count": views_counts.get(name, 0),
                    "is_git": is_git,
                    "has_config": getattr(
                        module_manager._module_classes.get(name), "ConfigClass", None
                    ) is not None,
                }
            )
        for name in adapter_list:
            adapter_instance = self.sdk.adapter.get(name)
            modules.append(
                {
                    "name": name,
                    "type": "adapter",
                    "enabled": self.sdk.adapter.is_enabled(name),
                    "loaded": self.sdk.adapter.is_running(name),
                    "version": "",
                    "description": "",
                    "author": "",
                    "package": "",
                    "bots_count": adapter_bot_counts.get(name, 0),
                    "capabilities": adapter_capabilities.get(name, []),
                    "has_config": getattr(adapter_instance, "ConfigClass", None) is not None if adapter_instance else False,
                    "has_accounts": getattr(adapter_instance, "AccountConfigClass", None) is not None if adapter_instance else False,
                }
            )
        # 未注册（禁用后失去句柄）的模块/适配器：Finder + 配置还原状态，
        # WebUI 展示为"未加载/禁用中"，用户可自行启用
        modules.extend(self._discover_ghost_modules(adapter_list))
        return JSONResponse({"modules": modules})

    async def _api_modules_action(self, request: Request) -> JSONResponse:
        body = await request.json()
        action, name, mtype = (
            body.get("action"),
            body.get("name", ""),
            body.get("type", "module"),
        )
        if not name or not action:
            return JSONResponse({"error": "name and action required"}, status_code=400)

        if mtype == "adapter":
            # 禁用后的适配器失去句柄：enable/load 前尝试经 Finder 重新注册
            if action in ("load", "enable") and not self.sdk.adapter.get(name):
                if not self._register_ghost_adapter(name):
                    return JSONResponse(
                        {"error": "adapter discover failed"}, status_code=400
                    )
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

        # 禁用后的模块失去句柄：enable/load 前尝试经 Finder 重新注册
        if (
            action in ("enable", "load")
            and name not in set(self.sdk.module.list_registered())
        ):
            if not self._register_ghost_module(name):
                return JSONResponse(
                    {"error": "module discover failed"}, status_code=400
                )
            self._ghost_cache["ts"] = 0

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
                return JSONResponse(
                    {"error": "enable failed (module not registered)"}, status_code=400
                )
            self._add_audit_log("enable_module", name, request)
            return JSONResponse({"success": True})
        elif action == "disable":
            if name == "Dashboard":
                return JSONResponse(
                    {"error": "Cannot disable Dashboard module"}, status_code=400
                )
            result = self.sdk.module.disable(name)
            if not result:
                return JSONResponse({"error": "disable failed"}, status_code=400)
            self._add_audit_log("disable_module", name, request)
            return JSONResponse({"success": True})
        elif action == "reload":
            if name == "Dashboard":
                return JSONResponse(
                    {"error": "Cannot reload Dashboard from dashboard"}, status_code=400
                )
            await self.sdk.module.unload(name)
            result = await self.sdk.module.load(name)
            if not result:
                return JSONResponse({"error": "reload failed"}, status_code=400)
            self._add_audit_log("reload_module", name, request)
            return JSONResponse({"success": True})
        elif action == "uninstall":
            if name == "Dashboard":
                return JSONResponse(
                    {"error": "Cannot uninstall Dashboard"}, status_code=400
                )
            pkg_name = body.get("package", "")
            if not pkg_name:
                info = self.sdk.module.get_info(name)
                if info and info.get("package"):
                    pkg_name = info["package"]
                else:
                    return JSONResponse(
                        {"error": "package name required for uninstall"},
                        status_code=400,
                    )
            if self.sdk.module.is_loaded(name):
                await self.sdk.module.unload(name)
            self.sdk.module.disable(name)
            task_id = secrets.token_urlsafe(8)
            t = threading.Thread(
                target=self._run_pip_uninstall,
                args=(pkg_name, name, task_id),
                daemon=True,
            )
            t.start()
            self._add_audit_log("uninstall_module", f"{name} ({pkg_name})", request)
            return JSONResponse({"success": True, "task_id": task_id})
        else:
            return JSONResponse({"error": f"unknown action: {action}"}, status_code=400)

    # ════════════════ 模块配置 ════════════════

    def _get_module_config_info(self, module_name: str) -> dict | None:
        """获取模块配置信息（schema + 当前值）"""
        module_manager = self.sdk.module
        module_class = module_manager._module_classes.get(module_name)
        if module_class is None:
            return None

        config_class = getattr(module_class, "ConfigClass", None)

        result = {
            "module_name": module_name,
            "has_config": config_class is not None,
            "config_key": None,
            "schema": None,
            "values": None,
        }

        if config_class is not None:
            # 配置键名 = 模块注册名（与 BaseModule._get_config_key 一致）
            config_key = module_name

            result["config_key"] = config_key

            try:
                from ErisPulse.runtime.config_schema import resolve_config_schema

                result["schema"] = resolve_config_schema(config_class)
            except Exception as e:
                self.logger.debug(f"Failed to get config schema for module {module_name}: {e}")

            result["values"] = copy.deepcopy(
                self.sdk.config.getConfig(config_key) or {}
            )

        return result

    async def _api_module_config_get(self, request: Request) -> JSONResponse:
        module_name = request.path_params.get("name", "")
        info = self._get_module_config_info(module_name)
        if info is None:
            return JSONResponse({"error": "Module not found"}, status_code=404)
        if not info.get("has_config"):
            return JSONResponse({"error": "Module has no config schema"}, status_code=400)
        return JSONResponse(info)

    async def _api_module_config_set(self, request: Request) -> JSONResponse:
        module_name = request.path_params.get("name", "")
        module_manager = self.sdk.module
        module_class = module_manager._module_classes.get(module_name)
        if module_class is None:
            return JSONResponse({"error": "Module not found"}, status_code=404)

        config_class = getattr(module_class, "ConfigClass", None)
        if config_class is None:
            return JSONResponse({"error": "Module has no config schema"}, status_code=400)

        # 配置键名 = 模块注册名
        config_key = module_name

        body = await request.json()
        values = body.get("values")
        if values is not None:
            current = self.sdk.config.getConfig(config_key) or {}
            merged = {**current, **values}

            # 校验配置
            try:
                from ErisPulse.runtime.config_schema import (
                    dict_to_dataclass,
                    validate_config,
                )

                config_instance = dict_to_dataclass(config_class, merged)
                errors = validate_config(config_instance)
                if errors:
                    return JSONResponse(
                        {"success": False, "errors": errors}, status_code=400
                    )
            except Exception as e:
                self.logger.debug(f"Module config validation error: {e}")

            self.sdk.config.setConfig(config_key, merged)

            # 配置热更新回调现由框架核心统一维护（监听 config.set 事件），
            # Dashboard 不再主动调用 on_config_update，避免重复触发。

            self._add_audit_log("module_config_update", module_name, request)
            return JSONResponse({"success": True})

        # 单个 key 更新
        key = body.get("key", "")
        value = body.get("value")
        if not key:
            return JSONResponse({"error": "key or values required"}, status_code=400)

        full_key = config_key + "." + key
        self.sdk.config.setConfig(full_key, value)
        self._add_audit_log("module_config_update", f"{module_name}.{key}", request)
        return JSONResponse({"success": True})
