"""ApiScopeMixin：命令作用域管理 API"""

import copy
from datetime import datetime

from fastapi import Request
from fastapi.responses import JSONResponse

from .Helpers import _CoreHelpers


class ApiScopeMixin:
    """命令作用域（scope）查询、绑定、导入导出与统计 API。"""


    def _get_scope(self):
        """获取作用域管理器（SDK < 2.8.0 无此属性时返回 None）"""
        return getattr(self.sdk, "scope", None)

    @staticmethod
    def _scope_runtime_bindings(scope_obj) -> list[dict]:
        """读取运行时绑定及其归属 owner（模块卸载时由框架按归属自动回收）"""
        try:
            from ErisPulse.Core.scope import _RUNTIME_DELETED

            overrides_raw = getattr(scope_obj, "_runtime_overrides", {}) or {}
            owners_raw = getattr(scope_obj, "_runtime_owners", {}) or {}
            bindings = []
            for path, value in overrides_raw.items():
                if value is _RUNTIME_DELETED:
                    continue
                bindings.append(
                    {
                        "path": path,
                        "owner": owners_raw.get(path, ""),
                        "value": copy.deepcopy(value),
                    }
                )
            return bindings
        except Exception:
            return []

    async def _api_scope_get(self, request: Request) -> JSONResponse:
        scope_obj = self._get_scope()
        if scope_obj is None:
            return JSONResponse({"supported": False})
        try:
            topology = scope_obj.topology()
        except Exception:
            topology = {}
        try:
            stats = scope_obj.stats()
        except Exception:
            stats = {}
        try:
            default_allow = bool(getattr(scope_obj, "_default_allow", True))
        except Exception:
            default_allow = True
        return JSONResponse(
            {
                "supported": True,
                "default_allow": default_allow,
                "topology": _CoreHelpers._json_safe(topology),
                "stats": _CoreHelpers._json_safe(stats),
                "runtime_bindings": _CoreHelpers._json_safe(
                    self._scope_runtime_bindings(scope_obj)
                ),
            }
        )

    async def _api_scope_settings(self, request: Request) -> JSONResponse:
        scope_obj = self._get_scope()
        if scope_obj is None:
            return JSONResponse({"error": "scope not supported"}, status_code=501)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        if "default_allow" not in body:
            return JSONResponse({"error": "default_allow is required"}, status_code=400)
        value = bool(body["default_allow"])
        self.sdk.config.setConfig("ErisPulse.scope.default_allow", value, immediate=True)
        self._add_audit_log("scope_settings", f"default_allow={value}", request)
        return JSONResponse({"success": True, "default_allow": value})

    async def _api_scope_module(self, request: Request) -> JSONResponse:
        scope_obj = self._get_scope()
        if scope_obj is None:
            return JSONResponse({"error": "scope not supported"}, status_code=501)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        platform = str(body.get("platform", "") or "").strip()
        if not platform:
            return JSONResponse({"error": "platform is required"}, status_code=400)
        bot_id = str(body.get("bot_id", "") or "").strip() or None
        session_id = str(body.get("session_id", "") or "").strip() or None

        if request.method == "DELETE":
            removed = scope_obj.delete_module(platform, bot_id=bot_id, session_id=session_id)
            self._add_audit_log(
                "scope_module_delete", f"{platform}/{bot_id or ''}/{session_id or ''}", request
            )
            return JSONResponse({"success": True, "removed": bool(removed)})

        modules = body.get("modules") or []
        blocked = body.get("blocked") or []
        if isinstance(modules, str):
            modules = [modules]
        if isinstance(blocked, str):
            blocked = [blocked]
        if not isinstance(modules, list) or not isinstance(blocked, list):
            return JSONResponse({"error": "modules/blocked must be lists"}, status_code=400)
        scope_obj.set_module(
            platform,
            bot_id=bot_id,
            session_id=session_id,
            modules=[str(m) for m in modules if str(m).strip()],
            blocked=[str(b) for b in blocked if str(b).strip()],
            merge=bool(body.get("merge", False)),
        )
        self._add_audit_log(
            "scope_module_set",
            f"{platform}/{bot_id or ''}/{session_id or ''} modules={modules} blocked={blocked}",
            request,
        )
        return JSONResponse({"success": True})

    async def _api_scope_identity(self, request: Request) -> JSONResponse:
        scope_obj = self._get_scope()
        if scope_obj is None:
            return JSONResponse({"error": "scope not supported"}, status_code=501)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        platform = str(body.get("platform", "") or "").strip()
        if not platform:
            return JSONResponse({"error": "platform is required"}, status_code=400)
        bot_id = str(body.get("bot_id", "") or "").strip() or None
        session_id = str(body.get("session_id", "") or "").strip() or None
        user_id = str(body.get("user_id", "") or "").strip() or None

        if request.method == "DELETE":
            removed = scope_obj.delete_identity(
                platform, bot_id=bot_id, session_id=session_id, user_id=user_id
            )
            self._add_audit_log(
                "scope_identity_delete",
                f"{platform}/{bot_id or ''}/{session_id or ''}/{user_id or ''}",
                request,
            )
            return JSONResponse({"success": True, "removed": bool(removed)})

        allow = bool(body.get("allow", False))
        deny = bool(body.get("deny", False))
        if not allow and not deny:
            return JSONResponse({"error": "allow or deny is required"}, status_code=400)
        scope_obj.set_identity(
            platform,
            bot_id=bot_id,
            session_id=session_id,
            user_id=user_id,
            allow=allow,
            deny=deny,
        )
        policy = "deny" if deny else "allow"
        self._add_audit_log(
            "scope_identity_set",
            f"{platform}/{bot_id or ''}/{session_id or ''}/{user_id or ''} {policy}",
            request,
        )
        return JSONResponse({"success": True})

    async def _api_scope_action(self, request: Request) -> JSONResponse:
        scope_obj = self._get_scope()
        if scope_obj is None:
            return JSONResponse({"error": "scope not supported"}, status_code=501)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        module = str(body.get("module", "") or "").strip()
        if not module:
            return JSONResponse({"error": "module is required"}, status_code=400)

        if request.method == "DELETE":
            action = str(body.get("action", "") or "").strip() or None
            removed = scope_obj.delete_action(module, action)
            self._add_audit_log(
                "scope_action_delete", f"{module}/{action or '*'}", request
            )
            return JSONResponse({"success": True, "removed": bool(removed)})

        action = str(body.get("action", "") or "").strip()
        if not action:
            return JSONResponse({"error": "action is required"}, status_code=400)
        allow = body.get("allow")
        deny = body.get("deny")
        if isinstance(allow, str):
            allow = [allow]
        if allow is not None and not isinstance(allow, list):
            return JSONResponse({"error": "allow must be a list"}, status_code=400)
        if deny is not None and not isinstance(deny, (bool, str, list)):
            return JSONResponse({"error": "deny must be bool/str/list"}, status_code=400)
        try:
            scope_obj.set_action(
                module,
                action,
                allow=allow,
                deny=deny,
            )
        except ValueError as e:
            return JSONResponse({"error": str(e)}, status_code=400)
        self._add_audit_log(
            "scope_action_set", f"{module}/{action} allow={allow} deny={deny}", request
        )
        return JSONResponse({"success": True})

    async def _api_scope_test(self, request: Request) -> JSONResponse:
        scope_obj = self._get_scope()
        if scope_obj is None:
            return JSONResponse({"error": "scope not supported"}, status_code=501)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        kind = str(body.get("kind", "") or "").strip()

        def _opt(key: str):
            value = body.get(key)
            if value is None:
                return None
            text = str(value).strip()
            return text or None

        try:
            if kind == "module":
                platform = _opt("platform") or ""
                allowed = scope_obj.is_allowed(
                    platform, _opt("bot_id"), _opt("module"), _opt("session_id")
                )
                return JSONResponse({"kind": kind, "allowed": bool(allowed)})
            if kind == "identity":
                platform = _opt("platform") or ""
                allowed = scope_obj.is_identity_allowed(
                    platform, _opt("bot_id"), _opt("session_id"), _opt("user_id")
                )
                return JSONResponse({"kind": kind, "allowed": bool(allowed)})
            if kind == "action":
                module = _opt("module") or ""
                action = _opt("action") or ""
                allowed = scope_obj.is_action_allowed(module, action, name=_opt("name"))
                return JSONResponse({"kind": kind, "allowed": bool(allowed)})
            return JSONResponse(
                {"error": "kind must be module/identity/action"}, status_code=400
            )
        except ValueError as e:
            return JSONResponse({"error": str(e)}, status_code=400)

    async def _api_scope_stats_reset(self, request: Request) -> JSONResponse:
        scope_obj = self._get_scope()
        if scope_obj is None:
            return JSONResponse({"error": "scope not supported"}, status_code=501)
        scope_obj.reset_stats()
        self._add_audit_log("scope_stats_reset", "", request)
        return JSONResponse({"success": True})

    async def _api_scope_runtime_cleanup(self, request: Request) -> JSONResponse:
        scope_obj = self._get_scope()
        if scope_obj is None:
            return JSONResponse({"error": "scope not supported"}, status_code=501)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        owner = str(body.get("owner", "") or "").strip()
        if not owner:
            return JSONResponse({"error": "owner is required"}, status_code=400)
        removed = scope_obj.unregister_by_owner(owner)
        self._add_audit_log(
            "scope_runtime_cleanup", f"owner={owner} removed={removed}", request
        )
        return JSONResponse({"success": True, "removed": int(removed)})

    async def _api_scope_export(self, request: Request) -> JSONResponse:
        scope_obj = self._get_scope()
        if scope_obj is None:
            return JSONResponse({"error": "scope not supported"}, status_code=501)
        try:
            default_allow = bool(getattr(scope_obj, "_default_allow", True))
        except Exception:
            default_allow = True
        payload = {
            "type": "erispulse_scope_config",
            "version": 1,
            "exported_at": datetime.now().isoformat(timespec="seconds"),
            "default_allow": default_allow,
            "config": scope_obj.topology(),
        }
        self._add_audit_log("scope_export", "", request)
        return JSONResponse(_CoreHelpers._json_safe(payload))

    async def _api_scope_import(self, request: Request) -> JSONResponse:
        scope_obj = self._get_scope()
        if scope_obj is None:
            return JSONResponse({"error": "scope not supported"}, status_code=501)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        cfg = body.get("config")
        if not isinstance(cfg, dict):
            return JSONResponse({"error": "config object is required"}, status_code=400)
        mode = str(body.get("mode", "merge") or "merge")
        if mode not in ("merge", "replace"):
            return JSONResponse({"error": "mode must be merge/replace"}, status_code=400)

        # 替换模式：先持久化清空现有规则（scope.clear() 仅内存生效，
        # 且 delete 叶子键会残留空父字典，故直接按路径整节删除）
        if mode == "replace":
            try:
                old = scope_obj.topology()
                for p in list((old.get("platforms") or {}).keys()):
                    scope_obj.delete(f"platforms.{p}")
                for p, sub in (old.get("bots") or {}).items():
                    for b in list((sub or {}).keys()):
                        scope_obj.delete(f"bots.{p}.{b}")
                    scope_obj.delete(f"bots.{p}")
                for p, sub in (old.get("sessions") or {}).items():
                    for s in list((sub or {}).keys()):
                        scope_obj.delete(f"sessions.{p}.{s}")
                    scope_obj.delete(f"sessions.{p}")
                for bucket in ("identity.adapters", "identity.bots", "identity.sessions", "identity.users"):
                    scope_obj.delete(bucket)
                scope_obj.delete("actions")
            except Exception as e:
                return JSONResponse({"error": f"clear failed: {e}"}, status_code=500)

        counts = {
            "platforms": 0,
            "bots": 0,
            "sessions": 0,
            "identity": 0,
            "actions": 0,
        }

        def _binding_entries(value):
            return value if isinstance(value, dict) else {}

        try:
            for p, entry in _binding_entries(cfg.get("platforms")).items():
                if not isinstance(entry, dict):
                    continue
                scope_obj.set_module(
                    str(p),
                    modules=list(entry.get("modules") or []),
                    blocked=list(entry.get("blocked") or []),
                    merge=bool(entry.get("merge", False)),
                )
                counts["platforms"] += 1
            for p, sub in _binding_entries(cfg.get("bots")).items():
                for bid, entry in _binding_entries(sub).items():
                    if not isinstance(entry, dict):
                        continue
                    scope_obj.set_module(
                        str(p),
                        bot_id=str(bid),
                        modules=list(entry.get("modules") or []),
                        blocked=list(entry.get("blocked") or []),
                        merge=bool(entry.get("merge", False)),
                    )
                    counts["bots"] += 1
            for p, sub in _binding_entries(cfg.get("sessions")).items():
                for sid, entry in _binding_entries(sub).items():
                    if not isinstance(entry, dict):
                        continue
                    scope_obj.set_module(
                        str(p),
                        session_id=str(sid),
                        modules=list(entry.get("modules") or []),
                        blocked=list(entry.get("blocked") or []),
                        merge=bool(entry.get("merge", False)),
                    )
                    counts["sessions"] += 1

            identity = _binding_entries(cfg.get("identity"))
            identity_levels = ("adapters", "bots", "sessions", "users")
            for level_key in identity_levels:
                for p, sub in _binding_entries(identity.get(level_key)).items():
                    if level_key == "adapters":
                        entries = [(None, sub)] if isinstance(sub, dict) else []
                    else:
                        entries = list(_binding_entries(sub).items())
                    for key, entry in entries:
                        if not isinstance(entry, dict):
                            continue
                        allow = bool(entry.get("allow", False))
                        deny = bool(entry.get("deny", False))
                        if not allow and not deny:
                            continue
                        if level_key == "adapters":
                            scope_obj.set_identity(str(p), allow=allow, deny=deny)
                        elif level_key == "bots":
                            scope_obj.set_identity(str(p), bot_id=str(key), allow=allow, deny=deny)
                        elif level_key == "sessions":
                            scope_obj.set_identity(str(p), session_id=str(key), allow=allow, deny=deny)
                        else:
                            scope_obj.set_identity(str(p), user_id=str(key), allow=allow, deny=deny)
                        counts["identity"] += 1

            for m, acts in _binding_entries(cfg.get("actions")).items():
                for a, rule in _binding_entries(acts).items():
                    if not isinstance(rule, dict):
                        continue
                    scope_obj.set_action(
                        str(m),
                        str(a),
                        allow=rule.get("allow"),
                        deny=rule.get("deny"),
                    )
                    counts["actions"] += 1
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=400)

        if isinstance(body.get("default_allow"), bool):
            self.sdk.config.setConfig(
                "ErisPulse.scope.default_allow", body["default_allow"], immediate=True
            )

        self._add_audit_log(
            "scope_import", f"mode={mode} {counts}", request
        )
        return JSONResponse({"success": True, "mode": mode, "imported": counts})
