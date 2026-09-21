"""CommandsMixin：命令系统中间件与命令 / 主人管理 API"""

from fastapi import Request
from fastapi.responses import JSONResponse


class CommandsMixin:
    """命令规则同步、命令系统中间件与命令 / 主人管理 API。"""


    # ════════════════ 命令系统中间件 ════════════════

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
            for tag in list(getattr(cmd_handler, "_dashboard_aliases", set())):
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

        # 命令覆写 / ACL（SDK 覆写系统，缺失时静默降级）
        acl_map: dict[str, dict] = {}
        override_params: dict[str, dict] = {}
        try:
            from ErisPulse.Core.Event import overrides as _ovr

            for name, info in commands.items():
                if name != info.get("main_name", name):
                    continue
                try:
                    acl_map[name] = _ovr.acl.get(name)
                except Exception:
                    acl_map[name] = {"allow": [], "deny": []}
                owner = info.get("owner")
                if owner:
                    try:
                        override_params[name] = _ovr.command.get(owner, name) or {}
                    except Exception:
                        override_params[name] = {}
        except Exception:
            pass

        result = []
        for name, info in commands.items():
            if name != info.get("main_name", name):
                continue
            main_name = info.get("main_name", name)
            original_aliases = [
                a for a, m in cmd_handler.aliases.items() if m == main_name
            ]
            rule = self._command_rules.get(main_name, {})
            result.append(
                {
                    "name": main_name,
                    "help": info.get("help"),
                    "usage": info.get("usage"),
                    "group": info.get("group"),
                    "hidden": info.get("hidden", False),
                    "owner": info.get("owner", ""),
                    "original_aliases": original_aliases,
                    "custom_aliases": rule.get("aliases", []),
                    "enabled": rule.get("enabled", True),
                    "allowed_platforms": rule.get("allowed_platforms", []),
                    "blocked_platforms": rule.get("blocked_platforms", []),
                    "transform_to": rule.get("transform_to"),
                    "acl": acl_map.get(main_name, {"allow": [], "deny": []}),
                    "params": override_params.get(main_name, {}),
                }
            )
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
                raw_prefix = command_config.get("prefix", "/")
                case_sensitive = command_config.get("case_sensitive", True)
            except Exception:
                raw_prefix = "/"
                case_sensitive = True

            # 归一化前缀为列表
            if isinstance(raw_prefix, list):
                prefixes = [str(p) for p in raw_prefix] if raw_prefix else ["/"]
            else:
                prefixes = [str(raw_prefix)]
            if not case_sensitive:
                prefixes = [p.lower() for p in prefixes]

            check_text = text if case_sensitive else text.lower()

            # 查找匹配的前缀（支持多个前缀）
            matched_prefix = None
            for p in prefixes:
                if check_text.startswith(p):
                    matched_prefix = p
                    break
            if matched_prefix is None:
                return data

            command_part = check_text[len(matched_prefix) :].strip()
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
                new_cmd_text = matched_prefix + transform_to + " " + " ".join(parts[1:])
                new_cmd_text = new_cmd_text.strip()
                for i, segment in enumerate(message_segments):
                    if segment.get("type") == "text":
                        message_segments[i] = {
                            "type": "text",
                            "data": {"text": new_cmd_text},
                        }
                        break
                data["message"] = message_segments
                if alt_message and alt_message == text:
                    data["alt_message"] = new_cmd_text

            return data

        self._command_middleware_func = _command_middleware

    # ════════════════ API · 命令 / 主人 ════════════════

    async def _api_commands(self, request: Request) -> JSONResponse:
        commands = self._get_all_commands_info()
        try:
            from ErisPulse.runtime import get_event_config

            event_config = get_event_config()
            command_config = event_config.get("command", {})
        except Exception:
            command_config = {}
        raw_prefix = command_config.get("prefix", "/")
        if isinstance(raw_prefix, list):
            all_prefixes = [str(p) for p in raw_prefix] if raw_prefix else ["/"]
            main_prefix = all_prefixes[0]
        else:
            all_prefixes = [str(raw_prefix)]
            main_prefix = str(raw_prefix)
        global_settings = {
            "prefix": main_prefix,
            "prefixes": all_prefixes,
            "case_sensitive": command_config.get("case_sensitive", True),
            "allow_space_prefix": command_config.get("allow_space_prefix", False),
            "must_at_bot": command_config.get("must_at_bot", False),
        }
        acl_default_allow = True
        try:
            from ErisPulse.Core.Event import overrides as _ovr

            acl_default_allow = bool(_ovr.acl.default_allow)
        except Exception:
            pass
        registered_platforms = self.sdk.adapter.list_registered()
        return JSONResponse(
            {
                "commands": commands,
                "global_settings": global_settings,
                "acl_default_allow": acl_default_allow,
                "platforms": registered_platforms,
                "total": len(commands),
            }
        )

    async def _api_command_update(self, request: Request) -> JSONResponse:
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
                    return JSONResponse(
                        {"error": f"command '{cmd_name}' not found"}, status_code=404
                    )
                cmd_name = actual
        except Exception:
            return JSONResponse(
                {"error": "failed to access command registry"}, status_code=500
            )

        rule = self._command_rules.get(cmd_name, {})

        if "enabled" in body:
            rule["enabled"] = bool(body["enabled"])
        if "aliases" in body:
            aliases = body["aliases"]
            if not isinstance(aliases, list):
                return JSONResponse(
                    {"error": "aliases must be a list"}, status_code=400
                )
            rule["aliases"] = [str(a) for a in aliases if a]
        if "allowed_platforms" in body:
            platforms = body["allowed_platforms"]
            if not isinstance(platforms, list):
                return JSONResponse(
                    {"error": "allowed_platforms must be a list"}, status_code=400
                )
            rule["allowed_platforms"] = [str(p) for p in platforms if p]
        if "blocked_platforms" in body:
            platforms = body["blocked_platforms"]
            if not isinstance(platforms, list):
                return JSONResponse(
                    {"error": "blocked_platforms must be a list"}, status_code=400
                )
            rule["blocked_platforms"] = [str(p) for p in platforms if p]
        if "transform_to" in body:
            val = body["transform_to"]
            rule["transform_to"] = str(val) if val else None

        self._command_rules[cmd_name] = rule
        self._save_command_rules()
        self._sync_command_aliases()

        # 命令 ACL 用户黑白名单（overrides.acl，用户标识 "platform:uid"）
        acl_result = None
        if "acl" in body:
            acl = body.get("acl") or {}

            def _clean_tags(value):
                if isinstance(value, str):
                    value = [value]
                if not isinstance(value, list):
                    return []
                return [str(v).strip() for v in value if str(v).strip()]

            allow = _clean_tags(acl.get("allow"))
            deny = _clean_tags(acl.get("deny"))
            try:
                from ErisPulse.Core.Event import overrides as _ovr

                if allow or deny:
                    _ovr.acl.set(cmd_name, allow=allow or None, deny=deny or None)
                else:
                    _ovr.acl.delete(cmd_name)
                acl_result = _ovr.acl.get(cmd_name)
            except Exception as e:
                self.logger.warning(f"Failed to update command ACL {cmd_name}: {e}")

        # 命令实现参数覆写（overrides.command：master / hidden，用户优先）
        params_result = None
        raw_params = body.get("params")
        if isinstance(raw_params, dict):
            owner = ""
            try:
                cmd_handler = self.sdk.Event.command
                info = cmd_handler.get_commands().get(cmd_name, {})
                owner = info.get("owner", "")
            except Exception:
                owner = ""
            params: dict = {}
            if "master" in raw_params:
                params["master"] = bool(raw_params["master"])
            if "hidden" in raw_params:
                params["hidden"] = bool(raw_params["hidden"])
            try:
                from ErisPulse.Core.Event import overrides as _ovr

                if params and owner:
                    _ovr.command.set(owner, cmd_name, **params)
                elif owner:
                    _ovr.command.delete(owner, cmd_name)
                if owner:
                    params_result = _ovr.command.get(owner, cmd_name) or {}
            except Exception as e:
                self.logger.warning(f"Failed to update command params {cmd_name}: {e}")

        self._add_audit_log("command_update", cmd_name, request)
        response = {"success": True, "rule": rule}
        if acl_result is not None:
            response["acl"] = acl_result
        if params_result is not None:
            response["params"] = params_result
        return JSONResponse(response)

    async def _api_command_settings_update(self, request: Request) -> JSONResponse:
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)

        allowed_keys = {
            "prefix",
            "case_sensitive",
            "allow_space_prefix",
            "must_at_bot",
        }
        updates = {}
        for key in allowed_keys:
            if key in body:
                updates[key] = body[key]

        if "prefix" in updates:
            prefix_val = updates["prefix"]
            if isinstance(prefix_val, str):
                parts = [p.strip() for p in prefix_val.split(",") if p.strip()]
                updates["prefix"] = parts if len(parts) > 1 else (parts[0] if parts else "/")
            elif isinstance(prefix_val, list):
                updates["prefix"] = [str(p) for p in prefix_val if str(p).strip()]
            else:
                return JSONResponse({"error": "invalid prefix type"}, status_code=400)
        if "case_sensitive" in updates:
            updates["case_sensitive"] = bool(updates["case_sensitive"])
        if "allow_space_prefix" in updates:
            updates["allow_space_prefix"] = bool(updates["allow_space_prefix"])
        if "must_at_bot" in updates:
            updates["must_at_bot"] = bool(updates["must_at_bot"])

        if not updates:
            return JSONResponse({"error": "no valid fields to update"}, status_code=400)

        for key, value in updates.items():
            self.sdk.config.setConfig(
                f"ErisPulse.event.command.{key}", value, immediate=True
            )

        try:
            from ErisPulse.runtime.frame_config import get_event_config

            event_config = get_event_config()
            new_command_config = event_config.get("command", {})
        except Exception:
            new_command_config = updates

        self._add_audit_log(
            "command_settings_update", ", ".join(sorted(updates.keys())), request
        )
        return JSONResponse({"success": True, "command": new_command_config})

    async def _api_master_get(self, request: Request) -> JSONResponse:
        try:
            from ErisPulse.runtime.frame_config import get_master_config

            master_config = get_master_config()
        except Exception:
            master_config = {}
        try:
            all_platforms = list(self.sdk.adapter.list_items().keys())
        except Exception:
            all_platforms = self.sdk.adapter.list_registered()

        # 自定义身份源 provider（含注册归属，模块卸载时由框架自动注销）
        providers: list[dict] = []
        try:
            master_obj = getattr(self.sdk, "master", None)
            provider_owners = getattr(master_obj, "_provider_owners", {}) or {}
            for fn in getattr(master_obj, "_providers", []) or []:
                name = getattr(fn, "__name__", None) or repr(fn)
                providers.append(
                    {
                        "name": str(name),
                        "owner": provider_owners.get(id(fn), ""),
                    }
                )
        except Exception:
            providers = []

        return JSONResponse(
            {
                "master": master_config,
                "platforms": all_platforms,
                "providers": providers,
            }
        )

    async def _api_master_update(self, request: Request) -> JSONResponse:
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)

        users = body.get("users")
        if users is None:
            return JSONResponse({"error": "users is required"}, status_code=400)

        if isinstance(users, list):
            cleaned = [str(u).strip() for u in users if str(u).strip()]
        elif isinstance(users, dict):
            cleaned = {}
            for platform, user_list in users.items():
                if isinstance(user_list, list):
                    cleaned[str(platform)] = [
                        str(u).strip() for u in user_list if str(u).strip()
                    ]
                else:
                    cleaned[str(platform)] = [str(user_list)]
        else:
            return JSONResponse({"error": "users must be a list or dict"}, status_code=400)

        self.sdk.config.setConfig("ErisPulse.master.users", cleaned, immediate=True)

        try:
            from ErisPulse.runtime.frame_config import get_master_config

            new_master = get_master_config()
        except Exception:
            new_master = {"users": cleaned}

        self._add_audit_log("master_update", f"users_count={len(cleaned)}", request)
        return JSONResponse({"success": True, "master": new_master})
