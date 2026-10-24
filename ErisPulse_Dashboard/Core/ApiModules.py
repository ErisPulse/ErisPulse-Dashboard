"""ApiModulesMixin：模块列表、加载操作与模块配置 API"""

import asyncio
import copy
import io
import re
import secrets
import shutil
import threading
import time
import uuid
import zipfile
from pathlib import Path

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiModulesMixin:
    """模块列表、加载 / 卸载 / 重载操作与模块配置 API。"""

    # 影子测试能力的方法全集（SDK 缺任一项即整体视为不支持）
    _SHADOW_CAPS = ("shadow_start", "promote_shadow", "dismiss_shadow", "shadow_diff")

    # 影子源 whl 上传限制：文件本体 / 解包总大小 / 解包条目（zip 炸弹防护）
    _SHADOW_WHL_MAX_BYTES = 50 * 1024 * 1024
    _SHADOW_EXTRACT_MAX_BYTES = 200 * 1024 * 1024
    _SHADOW_EXTRACT_MAX_ENTRIES = 2000
    # 影子源目录名段：仅允许模块名安全字符（防路径注入）
    _SHADOW_SEG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")

    def _shadow_supported(self) -> bool:
        """探测 SDK 模块管理器是否具备影子测试全量能力（getattr 探测，旧 SDK 降级）"""
        module_manager = getattr(self.sdk, "module", None)
        if module_manager is None:
            return False
        return all(hasattr(module_manager, attr) for attr in self._SHADOW_CAPS)


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

        # 影子测试能力（SDK 级探测一次，供前端决定模块卡菜单项显隐）
        shadow_supported = self._shadow_supported()

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
                    "shadow": shadow_supported,
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
                    "shadow": False,
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

    # ════════════════ 资源归属审计 ════════════════

    @staticmethod
    def _get_ownership_service():
        """惰性获取 SDK 归属权门面（旧 SDK 缺失时返回 None，调用方走降级）"""
        try:
            from ErisPulse.Core import ownership as ownership_service

            return ownership_service
        except Exception:
            return None

    @staticmethod
    def _normalize_counts(resources: dict) -> dict:
        """归一资源计数表：仅保留正整数量（去除空壳 owner）"""
        clean: dict[str, int] = {}
        for kind, count in (resources or {}).items():
            try:
                n = int(count)
            except Exception:
                continue
            if n > 0:
                clean[str(kind)] = n
        return clean

    async def _api_ownership(self, request: Request) -> JSONResponse:
        """资源归属审计：各 owner 在册资源计数（只读）+ 孤儿扫描（泄漏实锤）"""
        ownership_service = self._get_ownership_service()
        if ownership_service is None or not (
            hasattr(ownership_service, "counts")
            and hasattr(ownership_service, "orphans")
        ):
            return JSONResponse(
                {"supported": False, "owners": [], "orphans": []}
            )
        try:
            raw_counts = ownership_service.counts() or {}
            raw_orphans = ownership_service.orphans() or []
        except Exception as e:
            self.logger.debug(f"ownership audit failed: {e}")
            return JSONResponse(
                {"supported": False, "owners": [], "orphans": [], "error": str(e)}
            )
        owners = []
        for owner, resources in raw_counts.items():
            clean = self._normalize_counts(resources)
            if not clean:
                continue
            owners.append(
                {
                    "owner": str(owner),
                    "total": sum(clean.values()),
                    "resources": clean,
                }
            )
        owners.sort(key=lambda item: (-item["total"], item["owner"]))
        orphans = []
        for item in raw_orphans:
            if not isinstance(item, dict):
                continue
            clean = self._normalize_counts(item.get("resources"))
            orphans.append(
                {
                    "owner": str(item.get("owner", "")),
                    "total": int(item.get("total", 0) or sum(clean.values())),
                    "resources": clean,
                }
            )
        orphans.sort(key=lambda item: item["owner"])
        return JSONResponse(
            {"supported": True, "owners": owners, "orphans": orphans}
        )

    # ════════════════ 模块命令清单 ════════════════

    async def _api_module_commands(self, request: Request) -> JSONResponse:
        """模块已注册命令清单：SDK 命令总览按模块过滤（owner 字段缺失时返回空集）"""
        name = request.path_params.get("name", "")
        overview_fn = getattr(self.sdk.module, "get_commands_overview", None)
        if overview_fn is None:
            return JSONResponse(
                {"supported": False, "module": name, "commands": []}
            )
        try:
            overview = overview_fn() or {}
        except Exception as e:
            self.logger.debug(f"commands overview failed for {name}: {e}")
            return JSONResponse(
                {
                    "supported": False,
                    "module": name,
                    "commands": [],
                    "error": str(e),
                }
            )
        entry = overview.get(name) or {}
        # 权限信息补充：总览不含权限位，从命令注册表读取 master 限定标记
        # （permission 为可调用对象不可序列化，不透出）
        master_flags: dict[str, bool] = {}
        try:
            from ErisPulse.Core.Event import command as command_service

            for cmd_name, info in (
                getattr(command_service, "commands", {}) or {}
            ).items():
                if isinstance(info, dict) and info.get("owner") == name:
                    master_flags[cmd_name] = bool(info.get("must_master"))
        except Exception:
            pass
        commands = []
        for cmd in entry.get("commands", []):
            if not isinstance(cmd, dict) or not cmd.get("name"):
                continue
            cmd_name = str(cmd["name"])
            commands.append(
                {
                    "name": cmd_name,
                    "aliases": [str(a) for a in (cmd.get("aliases") or [])],
                    "group": cmd.get("group"),
                    "help": cmd.get("help"),
                    "hidden": bool(cmd.get("hidden", False)),
                    "master": master_flags.get(cmd_name, False),
                }
            )
        commands.sort(key=lambda c: c["name"])
        return JSONResponse(
            {"supported": True, "module": name, "commands": commands}
        )

    # ════════════════ 影子测试 ════════════════

    async def _api_module_shadow(self, request: Request) -> JSONResponse:
        """影子测试操作：action=start（source 为新版代码路径）/ promote / dismiss"""
        name = request.path_params.get("name", "")
        if not self._shadow_supported():
            return JSONResponse(
                {"error": "shadow not supported", "supported": False},
                status_code=501,
            )
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid json body"}, status_code=400)
        action = body.get("action", "")
        module_manager = self.sdk.module
        try:
            if action == "start":
                source = str(body.get("source") or "").strip()
                if not source:
                    return JSONResponse(
                        {"error": "source path required"}, status_code=400
                    )
                owner = str(body.get("owner") or "").strip() or None
                if owner:
                    shadow_owner = await module_manager.shadow_start(
                        name, source, owner=owner
                    )
                else:
                    shadow_owner = await module_manager.shadow_start(name, source)
                self._add_audit_log(
                    "shadow_start", f"{name} <- {shadow_owner}", request
                )
                return JSONResponse(
                    {"success": True, "shadow_owner": shadow_owner}
                )
            elif action == "promote":
                ok = await module_manager.promote_shadow(name)
                self._add_audit_log(
                    "shadow_promote", f"{name} ({'ok' if ok else 'rolled_back'})", request
                )
                return JSONResponse({"success": bool(ok)})
            elif action == "dismiss":
                ok = await module_manager.dismiss_shadow(name)
                self._add_audit_log("shadow_dismiss", name, request)
                return JSONResponse({"success": bool(ok)})
            else:
                return JSONResponse(
                    {"error": f"unknown action: {action}"}, status_code=400
                )
        except Exception as e:
            # 影子操作失败语义由 SDK 保证（promote 自动回滚旧实例），原样透出错误
            return JSONResponse({"error": str(e)}, status_code=400)

    # ════════════════ 影子测试 · whl 上传 ════════════════

    async def _api_module_shadow_upload(self, request: Request) -> JSONResponse:
        """
        上传 whl 作为影子源：保存并解包到 <cwd>/shadows/<module>/<时间戳>/，
        返回可交给 shadow_start 的 source 目录路径（本端点不启动影子）。
        """
        name = request.path_params.get("name", "")
        if not self._shadow_supported():
            return JSONResponse(
                {"error": "shadow not supported", "supported": False},
                status_code=501,
            )
        # 模块名仅作单层目录段使用：严格校验，防路径注入
        if (
            not name
            or name in (".", "..")
            or not self._SHADOW_SEG_RE.match(name)
        ):
            return JSONResponse({"error": "invalid module name"}, status_code=400)
        try:
            form = await request.form()
        except Exception:
            return JSONResponse({"error": "invalid multipart form"}, status_code=400)
        file = form.get("file")
        if file is None:
            return JSONResponse({"error": "file is required"}, status_code=400)
        filename = getattr(file, "filename", "") or ""
        source_dir = await self._prepare_shadow_whl(name, filename, file, request)
        if isinstance(source_dir, JSONResponse):
            return source_dir
        return JSONResponse(
            {"success": True, "module": name, "source": source_dir, "filename": filename}
        )

    async def _prepare_shadow_whl(
        self, name: str, filename: str, file: object, request: Request
    ):
        """校验 whl → 落盘解包 → 推导 shadow source；出错返回 JSONResponse"""
        if not filename.lower().endswith(".whl"):
            return JSONResponse(
                {"error": "only .whl files are allowed"}, status_code=400
            )
        # wheel 文件名粗校验（PEP 427）：name-version-[-build]-py-abi-platform.whl ≥ 5 段
        stem_parts = filename[:-4].split("-")
        if len(stem_parts) < 5 or any(not p for p in stem_parts):
            return JSONResponse(
                {"error": "invalid wheel filename (name-version-...whl)"}, status_code=400
            )
        try:
            data = await file.read()
        except Exception as e:
            return JSONResponse({"error": f"read upload failed: {e}"}, status_code=400)
        if len(data) > self._SHADOW_WHL_MAX_BYTES:
            return JSONResponse(
                {"error": "wheel too large (max 50MB)"}, status_code=400
            )
        # 保存目录：框架工作目录（cwd，与 config/plugins 同级，且在插件发现目录之外，
        # 符合 shadow_start 对 source 位置的建议）；持久化保存——影子运行期与转正后
        # 均需 source 路径继续有效，tempfile 会话级目录不满足
        ts = time.strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
        dest = Path.cwd() / "shadows" / name / ts
        try:
            source = await asyncio.to_thread(self._extract_shadow_whl, data, dest, stem_parts[0])
        except Exception as e:
            # 失败即清理本次时间戳目录，避免残留半成品
            shutil.rmtree(dest, ignore_errors=True)
            self.logger.debug(f"shadow whl upload failed for {name}: {e}")
            return JSONResponse({"error": str(e)}, status_code=400)
        self._add_audit_log("shadow_upload", f"{name} <- {filename}", request)
        return str(source)

    def _extract_shadow_whl(self, data: bytes, dest: Path, dist_name: str) -> Path:
        """
        解包 whl（zip）到 dest 并推导 shadow source 目录。

        安全限制：条目数 ≤ _SHADOW_EXTRACT_MAX_ENTRIES、解包总大小 ≤
        _SHADOW_EXTRACT_MAX_BYTES、拒绝绝对路径 / 盘符 / ..（防 ZipSlip）。
        source 推导：解包后扫描第一层——存在唯一含 ``__init__.py`` 的顶层包目录
        则取该目录；否则与 wheel 发行名归一化匹配的唯一包目录；否则解包根自身
        含 ``__init__.py``（扁平 wheel）取根；否则唯一同名 ``.py`` 单模块文件。
        """
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            entries = [i for i in zf.infolist() if not i.is_dir()]
            if len(entries) > self._SHADOW_EXTRACT_MAX_ENTRIES:
                raise ValueError(f"too many entries in wheel (max {self._SHADOW_EXTRACT_MAX_ENTRIES})")
            total = sum(i.file_size for i in entries)
            if total > self._SHADOW_EXTRACT_MAX_BYTES:
                raise ValueError(f"wheel decompressed size too large (max {self._SHADOW_EXTRACT_MAX_BYTES // (1024 * 1024)}MB)")
            for info in entries:
                n = info.filename.replace("\\", "/")
                if n.startswith("/") or re.match(r"^[A-Za-z]:", n):
                    raise ValueError(f"unsafe entry in wheel: {info.filename}")
                if any(part == ".." for part in n.split("/")):
                    raise ValueError(f"unsafe entry in wheel: {info.filename}")
            dest.mkdir(parents=True, exist_ok=True)
            dest_resolved = dest.resolve()
            for info in entries:
                target = dest / info.filename.replace("\\", "/")
                target.parent.mkdir(parents=True, exist_ok=True)
                if not str(target.resolve()).startswith(str(dest_resolved)):
                    raise ValueError(f"entry escapes target dir: {info.filename}")
                with zf.open(info) as src, open(target, "wb") as out:
                    shutil.copyfileobj(src, out, length=1024 * 1024)
        return self._derive_shadow_source(dest, dist_name)

    @staticmethod
    def _norm_wheel_dist_name(name: str) -> str:
        """wheel 发行名归一化（PEP 503）：连续 -/./_ 折叠为单 '-' 并小写"""
        return re.sub(r"[-_.]+", "-", name).lower()

    def _derive_shadow_source(self, dest: Path, dist_name: str) -> Path:
        """从解包结果推导 shadow_start 可用的 source（含 __init__.py 的目录或单 .py）"""
        tops = sorted(dest.iterdir(), key=lambda p: p.name)
        norm = self._norm_wheel_dist_name
        pkg_dirs = [
            p
            for p in tops
            if p.is_dir()
            and not p.name.endswith(".dist-info")
            and not p.name.endswith(".data")
            and not p.name.endswith(".libs")
        ]
        with_init = [p for p in pkg_dirs if (p / "__init__.py").exists()]
        matched = [p for p in with_init if norm(p.name) == norm(dist_name)]
        if len(matched) == 1:
            return matched[0]
        if len(with_init) == 1:
            return with_init[0]
        # 扁平 wheel：包内容直接在解包根（根目录即含 __init__.py）
        if (dest / "__init__.py").exists():
            return dest
        # 单模块 wheel：顶层唯一与发行名同名的 .py 文件
        singles = [p for p in tops if p.is_file() and p.suffix == ".py" and norm(p.stem) == norm(dist_name)]
        if len(singles) == 1:
            return singles[0]
        raise ValueError("no package dir with __init__.py found in wheel")

    async def _api_module_shadow_diff(self, request: Request) -> JSONResponse:
        """影子与线上行为对比：未绑定影子时 active=false（亦作为影子状态查询面）"""
        name = request.path_params.get("name", "")
        diff_fn = getattr(self.sdk.module, "shadow_diff", None)
        if diff_fn is None:
            return JSONResponse(
                {
                    "supported": False,
                    "module": name,
                    "active": False,
                    "count": 0,
                    "aligned": [],
                }
            )
        try:
            report = diff_fn(name) or {}
        except Exception as e:
            self.logger.debug(f"shadow diff failed for {name}: {e}")
            return JSONResponse(
                {
                    "supported": True,
                    "module": name,
                    "active": False,
                    "count": 0,
                    "aligned": [],
                    "error": str(e),
                }
            )
        shadow_owner = report.get("shadow_owner")
        return JSONResponse(
            {
                "supported": True,
                "module": name,
                "shadow_owner": shadow_owner,
                "active": bool(shadow_owner),
                "count": int(report.get("count", 0) or 0),
                "aligned": report.get("aligned", []),
            }
        )
