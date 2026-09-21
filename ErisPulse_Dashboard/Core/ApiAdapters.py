"""ApiAdaptersMixin：适配器列表、配置与多账号管理 API"""

import copy
from pathlib import Path

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiAdaptersMixin:
    """适配器列表、配置读写与多账号管理 API。"""


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

    async def _api_adapter_logos(self, request: Request) -> JSONResponse:
        import os as _os

        logo_dir = Path(__file__).parent.parent / "static" / "res" / "adapter_logo"
        logos = {}
        if logo_dir.exists() and logo_dir.is_dir():
            for f in _os.listdir(str(logo_dir)):
                if f.lower().endswith(".png"):
                    name = f[:-4]
                    logos[name] = "/Dashboard/static/res/adapter_logo/" + f
        return JSONResponse({"logos": logos})

    # ════════════════ 适配器配置 ════════════════

    def _get_adapter_config_info(self, platform: str) -> dict | None:
        adapter_instance = self.sdk.adapter.get(platform)
        if not adapter_instance:
            return None

        config_key = adapter_instance._get_config_key()
        config_class = getattr(adapter_instance, "ConfigClass", None)
        account_config_class = getattr(adapter_instance, "AccountConfigClass", None)

        result = {
            "platform": platform,
            "config_key": config_key,
            "has_config": config_class is not None,
            "has_accounts": account_config_class is not None,
            "schema": None,
            "values": None,
            "account_schema": None,
            "accounts": None,
            "accounts_key": None,
        }

        if config_class is not None:
            try:
                from ErisPulse.runtime.config_schema import resolve_config_schema

                # 使用 resolve_config_schema 解析 i18n 描述为当前语言文本
                result["schema"] = resolve_config_schema(config_class)
            except Exception as e:
                self.logger.debug(f"Failed to get config schema for {platform}: {e}")
            result["values"] = copy.deepcopy(
                self.sdk.config.getConfig(config_key) or {}
            )

        if account_config_class is not None:
            try:
                from ErisPulse.runtime.config_schema import resolve_config_schema

                result["account_schema"] = resolve_config_schema(account_config_class)
            except Exception as e:
                self.logger.debug(
                    f"Failed to get account config schema for {platform}: {e}"
                )

            accounts_key = config_key + ".accounts"
            accounts_data = self.sdk.config.getConfig(accounts_key)
            if accounts_data is None:
                accounts_key = config_key + ".bots"
                accounts_data = self.sdk.config.getConfig(accounts_key)
            result["accounts_key"] = accounts_key
            result["accounts"] = copy.deepcopy(accounts_data or {})

        return result

    async def _api_adapter_config_get(self, request: Request) -> JSONResponse:
        platform = request.path_params.get("platform", "")
        info = self._get_adapter_config_info(platform)
        if info is None:
            return JSONResponse({"error": "Adapter not found"}, status_code=404)

        return JSONResponse(info)

    async def _api_adapter_config_set(self, request: Request) -> JSONResponse:
        platform = request.path_params.get("platform", "")
        adapter_instance = self.sdk.adapter.get(platform)
        if not adapter_instance:
            return JSONResponse({"error": "Adapter not found"}, status_code=404)

        body = await request.json()
        config_key = adapter_instance._get_config_key()
        config_class = getattr(adapter_instance, "ConfigClass", None)

        values = body.get("values")
        if values is not None:
            current = self.sdk.config.getConfig(config_key) or {}
            merged = {**current, **values}

            if config_class is not None:
                try:
                    from ErisPulse.runtime.config_schema import (
                        dict_to_dataclass,
                        validate_config,
                    )

                    instance = dict_to_dataclass(config_class, merged)
                    errors = validate_config(instance)
                    if errors:
                        return JSONResponse(
                            {"success": False, "errors": errors}, status_code=400
                        )
                except Exception as e:
                    self.logger.debug(f"Config validation error: {e}")

            self.sdk.config.setConfig(config_key, merged)

            # 配置热更新回调现由框架核心统一维护（监听 config.set 事件），
            # Dashboard 不再主动调用 on_config_update，避免重复触发。

            self._add_audit_log("adapter_config_update", platform, request)
            return JSONResponse({"success": True})

        key = body.get("key", "")
        value = body.get("value")
        if not key:
            return JSONResponse({"error": "key or values required"}, status_code=400)

        full_key = config_key + "." + key
        self.sdk.config.setConfig(full_key, value)
        self._add_audit_log("adapter_config_update", f"{platform}.{key}", request)
        return JSONResponse({"success": True})

    # ════════════════ 适配器多账号 ════════════════

    async def _api_adapter_accounts_get(self, request: Request) -> JSONResponse:
        platform = request.path_params.get("platform", "")
        info = self._get_adapter_config_info(platform)
        if info is None:
            return JSONResponse({"error": "Adapter not found"}, status_code=404)
        if not info.get("has_accounts"):
            return JSONResponse(
                {"error": "Adapter has no account config"}, status_code=400
            )

        accounts = info.get("accounts", {})

        return JSONResponse(
            {
                "schema": info.get("account_schema"),
                "accounts": accounts,
                "accounts_key": info.get("accounts_key"),
            }
        )

    async def _api_adapter_accounts_set(self, request: Request) -> JSONResponse:
        platform = request.path_params.get("platform", "")
        adapter_instance = self.sdk.adapter.get(platform)
        if not adapter_instance:
            return JSONResponse({"error": "Adapter not found"}, status_code=404)

        account_config_class = getattr(adapter_instance, "AccountConfigClass", None)
        if not account_config_class:
            return JSONResponse(
                {"error": "Adapter has no account config"}, status_code=400
            )

        body = await request.json()
        accounts = body.get("accounts")
        if accounts is None:
            return JSONResponse({"error": "accounts required"}, status_code=400)

        config_key = adapter_instance._get_config_key()
        accounts_key = config_key + ".accounts"
        old_accounts = self.sdk.config.getConfig(accounts_key)
        if old_accounts is None:
            accounts_key = config_key + ".bots"
            old_accounts = self.sdk.config.getConfig(accounts_key) or {}

        merged_accounts = {}
        for aname, adata in accounts.items():
            old = old_accounts.get(aname, {}) or {}
            merged_accounts[aname] = {
                **old,
                **(adata if isinstance(adata, dict) else {}),
            }

        all_errors = []
        try:
            from ErisPulse.runtime.config_schema import (
                dict_to_dataclass,
                validate_config,
            )

            for aname, adata in merged_accounts.items():
                if not isinstance(adata, dict):
                    continue
                instance = dict_to_dataclass(account_config_class, adata)
                errors = validate_config(instance)
                if errors:
                    all_errors.extend([f"[{aname}] {e}" for e in errors])
        except Exception as e:
            self.logger.debug(f"Account validation error: {e}")

        if all_errors:
            return JSONResponse(
                {"success": False, "errors": all_errors}, status_code=400
            )

        self.sdk.config.setConfig(accounts_key, merged_accounts)

        reloaded = await self._reload_adapter_if_running(adapter_instance, platform)

        self._add_audit_log("adapter_accounts_update", platform, request)
        response = {"success": True, "module": adapter_instance.__class__.__name__}
        if reloaded:
            response["message"] = (
                "部分缓存可能导致不可知的问题，如果发生错误，硬重启是一个不错的选择~"
            )
        return JSONResponse(response)

    async def _api_adapter_accounts_add(self, request: Request) -> JSONResponse:
        platform = request.path_params.get("platform", "")
        adapter_instance = self.sdk.adapter.get(platform)
        if not adapter_instance:
            return JSONResponse({"error": "Adapter not found"}, status_code=404)

        account_config_class = getattr(adapter_instance, "AccountConfigClass", None)
        if not account_config_class:
            return JSONResponse(
                {"error": "Adapter has no account config"}, status_code=400
            )

        body = await request.json()
        account_name = body.get("name", "")
        if not account_name:
            return JSONResponse({"error": "name required"}, status_code=400)

        config_key = adapter_instance._get_config_key()
        accounts_key = config_key + ".accounts"
        accounts_data = self.sdk.config.getConfig(accounts_key)
        if accounts_data is None:
            accounts_key = config_key + ".bots"
            accounts_data = self.sdk.config.getConfig(accounts_key) or {}

        if account_name in accounts_data:
            return JSONResponse({"error": "Account already exists"}, status_code=400)

        try:
            from ErisPulse.runtime.config_schema import dataclass_to_defaults_dict

            default_data = dataclass_to_defaults_dict(account_config_class)
            default_data.update(body.get("data", {}))
        except Exception:
            default_data = body.get("data", {"enabled": True, "name": account_name})

        default_data["name"] = account_name
        if "enabled" not in default_data:
            default_data["enabled"] = True

        accounts_data[account_name] = default_data
        self.sdk.config.setConfig(accounts_key, accounts_data)

        # 添加账户时只刷新内存数据，不重启适配器（用户尚未填写配置）
        await self._reload_adapter_if_running(adapter_instance, platform, reload=False)

        self._add_audit_log(
            "adapter_account_add", f"{platform}/{account_name}", request
        )
        return JSONResponse({"success": True})

    async def _api_adapter_accounts_delete(self, request: Request) -> JSONResponse:
        platform = request.path_params.get("platform", "")
        account_name = request.path_params.get("name", "")
        adapter_instance = self.sdk.adapter.get(platform)
        if not adapter_instance:
            return JSONResponse({"error": "Adapter not found"}, status_code=404)

        config_key = adapter_instance._get_config_key()
        accounts_key = config_key + ".accounts"
        accounts_data = self.sdk.config.getConfig(accounts_key)
        if accounts_data is None:
            accounts_key = config_key + ".bots"
            accounts_data = self.sdk.config.getConfig(accounts_key) or {}

        if account_name not in accounts_data:
            return JSONResponse({"error": "Account not found"}, status_code=404)

        del accounts_data[account_name]
        self.sdk.config.setConfig(accounts_key, accounts_data)

        reloaded = await self._reload_adapter_if_running(adapter_instance, platform)

        self._add_audit_log(
            "adapter_account_delete", f"{platform}/{account_name}", request
        )
        response = {"success": True, "module": adapter_instance.__class__.__name__}
        if reloaded:
            response["message"] = (
                "部分缓存可能导致不可知的问题，如果发生错误，硬重启是一个不错的选择~"
            )
        return JSONResponse(response)

    async def _reload_adapter_if_running(
        self, adapter_instance, platform, reload: bool = True
    ) -> bool:
        """刷新适配器；reload=True 且适配器运行中时，交由框架执行完整重载"""
        try:
            # 配置现在实时读取，无需手动刷新缓存
            if reload and adapter_instance in getattr(
                self.sdk.adapter, "_started_instances", set()
            ):
                # 生命周期（shutdown + 资源清理 + start）由框架统一处理
                return await self.sdk.adapter.restart(platform)
        except Exception as e:
            self.logger.error(f"适配器重载失败: {e}")
        return False
