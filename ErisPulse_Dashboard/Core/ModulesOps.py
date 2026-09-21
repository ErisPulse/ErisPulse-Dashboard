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
                        else:
                            self.logger.info(
                                f"Module {ep_name} is disabled, skip loading"
                            )

                        self._safe_broadcast(
                            {
                                "type": "module_changed",
                                "data": {"name": ep_name, "action": "installed"},
                            }
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
                self._safe_broadcast(
                    {
                        "type": "module_changed",
                        "data": {"name": ep_name, "action": "installed_adapter"},
                    }
                )
        except Exception as e:
            self.logger.warning(f"Dynamic module loading failed: {e}")

    # ════════════════ 自升级重载 ════════════════

    def _schedule_dashboard_self_reload(self, delay: float = 1.5):
        """
        升级涉及 Dashboard 自身：延迟卸载并重新加载模块，使新后端代码生效。
        延迟是为了让最终的 install_progress 广播先送达前端（前端收到后自动刷新页面）。
        """
        def _do():
            if not self._loop or self._loop.is_closed():
                return

            async def _reload():
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
        try:
            from ErisPulse.finders import ModuleFinder

            mf = ModuleFinder()
            mf.clear_cache()
            targets = []
            for ep_name, ep in mf.get_entry_point_map().items():
                if ep_name == "Dashboard":
                    continue
                if ep_name not in set(self.sdk.module.list_registered()):
                    continue
                dist_name = (ep.dist.name if ep else "") or ""
                if dist_name.lower().replace("_", "-") in norm:
                    targets.append(ep_name)
        except Exception as e:
            self.logger.warning(f"resolve upgraded modules failed: {e}")
            return
        if not targets or not self._loop or self._loop.is_closed():
            return

        async def _reload_all():
            for name in targets:
                if not self.sdk.module.is_enabled(name):
                    self.logger.info(
                        f"Module {name} is disabled, skip reload after upgrade"
                    )
                    continue
                try:
                    was_loaded = self.sdk.module.is_loaded(name)
                    if was_loaded:
                        await self.sdk.module.unload(name)
                        await self.sdk.module.load(name)
                        self.logger.info(f"Module {name} reloaded after upgrade")
                except Exception as e:
                    self.logger.warning(f"Reload module {name} after upgrade failed: {e}")

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
