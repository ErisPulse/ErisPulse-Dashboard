"""ModulesOpsMixin：模块动态加载、ghost 模块注册与自升级重载"""

import asyncio
import threading
import time


class ModulesOpsMixin:
    """模块动态加载、ghost 模块注册与 Dashboard 自升级重载。"""


    def _dynamic_load_new_modules(self):
        try:
            from ErisPulse.finders import AdapterFinder, ModuleFinder
            from ErisPulse.loaders import AdapterLoader, ModuleLoader

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
                                "version": getattr(
                                    module_pkg,
                                    "__version__",
                                    dist.version if dist else "1.0.0",
                                ),
                                "description": getattr(
                                    module_pkg, "__description__", ""
                                ),
                                "author": getattr(module_pkg, "__author__", ""),
                                "license": getattr(module_pkg, "__license__", ""),
                                "package": ep.dist.name,
                                "lazy_load": False,
                                "priority": 0,
                                "is_base_module": True,
                            },
                            "module_class": module_class,
                        }
                        # 注册配置（默认禁用，遵守配置中已有的禁用状态）
                        self.sdk.module._config_register(ep_name, True)
                        self.sdk.module.register(ep_name, module_class, module_info)

                        # 仅当模块未被禁用时才加载
                        if self.sdk.module.is_enabled(ep_name):
                            if self._loop and not self._loop.is_closed():
                                asyncio.run_coroutine_threadsafe(
                                    self.sdk.module.load(ep_name), self._loop
                                )
                            # 仅实际加载了才提示"已动态加载"；禁用的仅注册进列表
                            self._safe_broadcast(
                                {
                                    "type": "module_changed",
                                    "data": {"name": ep_name, "action": "installed"},
                                }
                            )
                        else:
                            self.logger.info(
                                f"Module {ep_name} is disabled, skip loading"
                            )
                    except Exception as e:
                        self.logger.warning(
                            f"Failed to dynamic load module {ep_name}: {e}"
                        )

            new_adapter_map = af.get_entry_point_map()
            existing_adapters = set(self.sdk.adapter.list_registered())
            new_adapter_names = []
            for ep_name, ep in new_adapter_map.items():
                if ep_name not in existing_adapters:
                    self.logger.info(f"Dynamic loading new adapter: {ep_name}")
                    try:
                        adapter_class = ep.load()
                        import importlib.metadata as imd
                        import sys

                        adapter_obj = sys.modules.get(adapter_class.__module__)
                        dist = imd.distribution(ep.dist.name) if ep.dist else None
                        adapter_info = {
                            "meta": {
                                "name": ep_name,
                                "version": getattr(
                                    adapter_obj,
                                    "__version__",
                                    dist.version if dist else "1.0.0",
                                ),
                                "description": getattr(
                                    adapter_obj, "__description__", ""
                                ),
                                "author": getattr(adapter_obj, "__author__", ""),
                                "license": getattr(adapter_obj, "__license__", ""),
                                "package": ep.dist.name if ep.dist else "",
                                "top_level": af.get_top_level_modules(ep.dist.name)
                                if ep.dist
                                else [],
                            },
                            "adapter_class": adapter_class,
                        }
                        if adapter_obj is not None:
                            if not hasattr(adapter_obj, "adapterInfo"):
                                setattr(adapter_obj, "adapterInfo", {})
                            adapter_obj.adapterInfo[ep_name] = adapter_info

                        self.sdk.adapter._config_register(ep_name, True)
                        self.sdk.adapter.register(ep_name, adapter_class, adapter_info)
                        new_adapter_names.append(ep_name)
                        self.logger.info(f"Adapter {ep_name} registered successfully")
                    except Exception as e:
                        self.logger.warning(
                            f"Failed to dynamic load adapter {ep_name}: {e}"
                        )

            if new_adapter_names and self._loop and not self._loop.is_closed():

                async def _startup_new_adapters():
                    for platform in new_adapter_names:
                        # 仅当适配器未被禁用时才启动
                        if not self.sdk.adapter.is_enabled(platform):
                            self.logger.info(
                                f"Adapter {platform} is disabled, skip startup"
                            )
                            continue
                        try:
                            await self.sdk.adapter.startup(platform)
                            self.logger.info(f"Adapter {platform} started successfully")
                        except Exception as e:
                            self.logger.warning(
                                f"Failed to startup adapter {platform}: {e}"
                            )

                asyncio.run_coroutine_threadsafe(_startup_new_adapters(), self._loop)

            for ep_name in new_adapter_names:
                # 禁用的适配器仅注册不启动，不提示"已动态加载"（列表刷新后可见其禁用状态）
                if not self.sdk.adapter.is_enabled(ep_name):
                    self.logger.info(
                        f"Adapter {ep_name} is disabled, skip loaded notice"
                    )
                    continue
                self._safe_broadcast(
                    {
                        "type": "module_changed",
                        "data": {"name": ep_name, "action": "installed_adapter"},
                    }
                )
        except Exception as e:
            self.logger.warning(f"Dynamic module loading failed: {e}")

    # ════════════════ 自升级重载 ════════════════

    def request_dashboard_self_reload(self, delay: float = 2.0):
        """
        用户确认后的 Dashboard 自重载入口（升级后不再自动重载，见 PipOps）。

        延迟只是为了先给前端返回响应；重载完成广播 dashboard_reloaded，
        前端据其 sessionStorage 标记强刷页面。
        """
        self._schedule_dashboard_self_reload(delay)

    def _schedule_dashboard_self_reload(self, delay: float = 1.5):
        """
        升级涉及 Dashboard 自身：延迟卸载并重新加载模块，使新后端代码生效。
        延迟是为了让最终的 install_progress 广播先送达前端（前端收到后自动刷新页面）。
        """
        def _do():
            if not self._loop or self._loop.is_closed():
                return

            async def _reload():
                # 热重载必须走 SDK reload：内部会清理 sys.modules 并重新
                # import 磁盘新代码；朴素 unload+load 只会重新实例化注册
                reloaded = False
                try:
                    reloaded = await self.sdk.module.reload("Dashboard")
                except Exception as e:
                    self.logger.warning(f"Dashboard hot reload error: {e}")
                if not reloaded:
                    # 旧 SDK 无 reload 能力时回退旧路径（需重启框架才能完全生效）
                    try:
                        await self.sdk.module.unload("Dashboard")
                    except Exception:
                        pass
                    try:
                        await self.sdk.module.load("Dashboard")
                    except Exception as e:
                        self.logger.warning(f"Dashboard self-reload failed: {e}")
                        return
                self._safe_broadcast({"type": "dashboard_reloaded"})

            asyncio.run_coroutine_threadsafe(_reload(), self._loop)

        t = threading.Timer(delay, _do)
        t.daemon = True
        t.start()

    def _reload_upgraded_registered_modules(self, packages: list[str]):
        """
        升级完成后，重载受影响且已注册的模块（unload+load，遵守 enabled 状态）。
        使"升级包后无需重启框架"即可让新代码生效。Dashboard 由
        _schedule_dashboard_self_reload 单独处理。
        """
        norm = set()
        for p in packages or []:
            norm.add(p.split("==", 1)[0].strip().lower().replace("_", "-"))
        if not norm:
            return
        module_targets = []
        adapter_targets = []
        try:
            from ErisPulse.finders import ModuleFinder

            mf = ModuleFinder()
            mf.clear_cache()
            for ep_name, ep in mf.get_entry_point_map().items():
                if ep_name == "Dashboard":
                    continue
                if ep_name not in set(self.sdk.module.list_registered()):
                    continue
                dist_name = (ep.dist.name if ep else "") or ""
                if dist_name.lower().replace("_", "-") in norm:
                    module_targets.append(ep_name)
        except Exception as e:
            self.logger.warning(f"resolve upgraded modules failed: {e}")
        try:
            from ErisPulse.finders import AdapterFinder

            af = AdapterFinder()
            af.clear_cache()
            registered_adapters = set(self.sdk.adapter.list_registered())
            for ep_name, ep in af.get_entry_point_map().items():
                if ep_name not in registered_adapters:
                    continue
                dist_name = (ep.dist.name if ep else "") or ""
                if dist_name.lower().replace("_", "-") in norm:
                    adapter_targets.append(ep_name)
        except Exception as e:
            self.logger.warning(f"resolve upgraded adapters failed: {e}")
        if (
            not module_targets
            and not adapter_targets
        ) or not self._loop or self._loop.is_closed():
            return

        reloaded_names: list = []
        failed_names: list = []

        async def _reload_all():
            for name in module_targets:
                if not self.sdk.module.is_enabled(name):
                    self.logger.info(
                        f"Module {name} is disabled, skip reload after upgrade"
                    )
                    continue
                try:
                    if not self.sdk.module.is_loaded(name):
                        continue
                    reloaded = False
                    try:
                        reloaded = await self.sdk.module.reload(name)
                    except Exception as e:
                        self.logger.warning(f"Hot reload module {name} error: {e}")
                    if not reloaded:
                        await self.sdk.module.unload(name)
                        await self.sdk.module.load(name)
                    reloaded_names.append(name)
                    self.logger.info(f"Module {name} reloaded after upgrade")
                except Exception as e:
                    failed_names.append(name)
                    self.logger.warning(f"Reload module {name} after upgrade failed: {e}")
            for name in adapter_targets:
                if not self.sdk.adapter.is_enabled(name):
                    self.logger.info(
                        f"Adapter {name} is disabled, skip reload after upgrade"
                    )
                    continue
                try:
                    reloaded = False
                    try:
                        reloaded = await self.sdk.adapter.reload(name)
                    except Exception as e:
                        self.logger.warning(f"Hot reload adapter {name} error: {e}")
                    if not reloaded:
                        # 旧 SDK 无 reload：尽力重启适配器（代码仍需重启框架才生效）
                        try:
                            await self.sdk.adapter.shutdown(name)
                        except Exception:
                            pass
                        try:
                            await self.sdk.adapter.startup(name)
                        except Exception as e:
                            self.logger.warning(f"Adapter {name} restart failed: {e}")
                            failed_names.append(name)
                            continue
                    reloaded_names.append(name)
                    self.logger.info(f"Adapter {name} reloaded after upgrade")
                except Exception as e:
                    failed_names.append(name)
                    self.logger.warning(f"Reload adapter {name} after upgrade failed: {e}")

            # 结果广播：前端 toast 告知热重载结果（失败项提示需重启框架生效）
            self._safe_broadcast(
                {
                    "type": "modules_hot_reloaded",
                    "data": {"reloaded": reloaded_names, "failed": failed_names},
                }
            )

        asyncio.run_coroutine_threadsafe(_reload_all(), self._loop)

    # ════════════════ ghost 模块 ════════════════

    def _ghost_enabled(self, kind: str, name: str) -> bool:
        """未注册模块从配置读取启用状态：仅显式 False 视为禁用"""
        try:
            mgr = self.sdk.module if kind == "modules" else self.sdk.adapter
            return bool(mgr.is_enabled(name))
        except Exception:
            pass
        try:
            v = self.sdk.config.getConfig(f"ErisPulse.{kind}.status.{name}")
            if v is not None:
                return bool(v)
        except Exception:
            pass
        return True

    def _discover_ghost_modules(self, known_adapters: list) -> list:
        """
        发现未注册（禁用后失去句柄）的模块/适配器：
        通过 Finder 入口点 + 配置文件还原其启用状态，供 WebUI 展示为
        "未加载 / 禁用中"，允许用户自行启用。结果缓存 30 秒。
        """
        now = time.time()
        if self._ghost_cache.get("ts", 0) > now - 30:
            return self._ghost_cache.get("data", [])
        data: list[dict] = []
        try:
            import importlib.metadata as imd

            from ErisPulse.finders import AdapterFinder, ModuleFinder

            mf = ModuleFinder()
            mf.clear_cache()
            af = AdapterFinder()
            af.clear_cache()

            known_m = set(self.sdk.module.list_registered())
            for ep_name, ep in mf.get_entry_point_map().items():
                if ep_name in known_m:
                    continue
                try:
                    dist = imd.distribution(ep.dist.name) if ep.dist else None
                    version = dist.version if dist else ""
                except Exception:
                    version = ""
                data.append(
                    {
                        "name": ep_name,
                        "type": "module",
                        "enabled": self._ghost_enabled("modules", ep_name),
                        "loaded": False,
                        "unregistered": True,
                        "version": version,
                        "description": "",
                        "author": "",
                        "package": (ep.dist.name if ep.dist else ""),
                        "has_config": False,
                    }
                )

            for ep_name, ep in af.get_entry_point_map().items():
                if ep_name in known_adapters:
                    continue
                data.append(
                    {
                        "name": ep_name,
                        "type": "adapter",
                        "enabled": self._ghost_enabled("adapters", ep_name),
                        "loaded": False,
                        "unregistered": True,
                        "version": "",
                        "description": "",
                        "author": "",
                        "package": (ep.dist.name if ep.dist else ""),
                    }
                )
        except Exception as e:
            self.logger.warning(f"ghost module discovery failed: {e}")
        self._ghost_cache = {"ts": now, "data": data}
        return data

    def _register_ghost_module(self, name: str) -> bool:
        """通过 Finder 入口点重新注册失去句柄的模块（禁用后未持有实例）"""
        try:
            from ErisPulse.finders import ModuleFinder

            mf = ModuleFinder()
            mf.clear_cache()
            ep = mf.get_entry_point_map().get(name)
            if not ep:
                return False
            module_class = ep.load()
            import importlib.metadata as imd
            import sys

            dist = imd.distribution(ep.dist.name) if ep.dist else None
            module_pkg = sys.modules.get(module_class.__module__)
            module_info = {
                "meta": {
                    "name": name,
                    "version": getattr(
                        module_pkg,
                        "__version__",
                        dist.version if dist else "1.0.0",
                    ),
                    "description": getattr(module_pkg, "__description__", ""),
                    "author": getattr(module_pkg, "__author__", ""),
                    "license": getattr(module_pkg, "__license__", ""),
                    "package": ep.dist.name if ep.dist else "",
                    "lazy_load": False,
                    "priority": 0,
                    "is_base_module": True,
                },
                "module_class": module_class,
            }
            self.sdk.module._config_register(name, True)
            self.sdk.module.register(name, module_class, module_info)
            self._ghost_cache["ts"] = 0
            return True
        except Exception as e:
            self.logger.warning(f"register ghost module {name} failed: {e}")
            return False

    def _register_ghost_adapter(self, name: str) -> bool:
        """通过 Finder 入口点重新注册失去句柄的适配器"""
        try:
            from ErisPulse.finders import AdapterFinder

            af = AdapterFinder()
            af.clear_cache()
            ep = af.get_entry_point_map().get(name)
            if not ep:
                return False
            adapter_class = ep.load()
            import importlib.metadata as imd
            import sys

            adapter_obj = sys.modules.get(adapter_class.__module__)
            dist = imd.distribution(ep.dist.name) if ep.dist else None
            adapter_info = {
                "meta": {
                    "name": name,
                    "version": getattr(
                        adapter_obj,
                        "__version__",
                        dist.version if dist else "1.0.0",
                    ),
                    "description": getattr(
                        adapter_obj, "__description__", ""
                    ),
                    "author": getattr(adapter_obj, "__author__", ""),
                    "license": getattr(adapter_obj, "__license__", ""),
                    "package": ep.dist.name if ep.dist else "",
                    "top_level_packages": [],
                },
                "adapter_class": adapter_class,
            }
            if adapter_obj is not None and not hasattr(
                adapter_obj, "adapterInfo"
            ):
                setattr(adapter_obj, "adapterInfo", {})
            self.sdk.adapter._config_register(name, True)
            self.sdk.adapter.register(name, adapter_class, adapter_info)
            self._ghost_cache["ts"] = 0
            return True
        except Exception as e:
            self.logger.warning(f"register ghost adapter {name} failed: {e}")
            return False
