"""ApiDashboardMixin：机器人 / 事件 / 配置 / 外观 / 存储 API"""

import asyncio
import os
from pathlib import Path

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiDashboardMixin:
    """机器人、事件、配置、外观与存储 API。"""


    async def _api_bots(self, request: Request) -> JSONResponse:
        # 一次性获取所有 bots 数据，避免重复调用 list_bots
        all_bots = self.sdk.adapter.list_bots()
        platforms = list(all_bots.keys())
        if not platforms:
            return JSONResponse({"bots": []})

        # 并行获取每个平台的能力信息（最慢的操作）
        async def _fetch_caps(p: str):
            try:
                # list_sends 如果不可用则可能在同步上下文运行；用线程池兜底
                loop = asyncio.get_running_loop()
                return p, await loop.run_in_executor(
                    None, lambda pp=p: self.sdk.adapter.list_sends(pp) or []
                )
            except Exception:
                try:
                    return p, self.sdk.adapter.list_sends(p) or []
                except Exception:
                    return p, []

        cap_results = await asyncio.gather(*[_fetch_caps(p) for p in platforms])
        capabilities_cache = dict(cap_results)

        # is_running / is_enabled 都是快速字典查找，串行无妨
        bots = []
        for p, bs in all_bots.items():
            try:
                running = self.sdk.adapter.is_running(p)
            except Exception:
                running = False
            try:
                enabled = self.sdk.adapter.is_enabled(p)
            except Exception:
                enabled = False
            for bid, bd in bs.items():
                bots.append(
                    {
                        "platform": p,
                        "bot_id": bid,
                        "status": bd.get("status", "unknown"),
                        "last_active": bd.get("last_active", 0),
                        "info": bd.get("info", {}),
                        "capabilities": capabilities_cache.get(p, []),
                        "adapter_running": running,
                        "adapter_enabled": enabled,
                        "adapter_status": "started"
                        if running
                        else ("stopped" if enabled else "unknown"),
                    }
                )
        return JSONResponse({"bots": bots})

    async def _api_events(self, request: Request) -> JSONResponse:
        limit = int(request.query_params.get("limit", "50"))
        et = request.query_params.get("type")
        ep = request.query_params.get("platform")
        evts = list(self._event_log)
        if et:
            evts = [e for e in evts if e["type"] == et]
        if ep:
            evts = [e for e in evts if e["platform"] == ep]
        return JSONResponse(
            {
                "events": evts[-limit:],
                "total": len(evts),
                "total_count": self._total_event_count,
            }
        )

    async def _api_events_clear(self, request: Request) -> JSONResponse:
        self._event_log.clear()
        self._persist_events()
        self._add_audit_log("clear_events", "", request)
        return JSONResponse({"success": True})

    async def _api_config(self, request: Request) -> JSONResponse:
        config = dict(self.sdk.config._cache)
        # 移除可能包含大型 base64 图片的外观配置，避免响应过大卡死前端
        config.pop("Dashboard", None)
        # 单独返回 Dashboard 配置（脱敏 token、移除 base64）
        dash_cfg = self.sdk.config.getConfig("Dashboard") or {}
        if isinstance(dash_cfg, dict):
            safe_dash = dict(dash_cfg)
            safe_dash.pop("token", None)
            if "appearance" in safe_dash and isinstance(safe_dash["appearance"], dict):
                safe_dash["appearance"] = self._sanitize_appearance(
                    safe_dash["appearance"]
                )
            config["Dashboard"] = safe_dash
        return JSONResponse({"config": config})

    async def _api_config_update(self, request: Request) -> JSONResponse:
        body = await request.json()
        key, value = body.get("key", ""), body.get("value")
        if not key:
            return JSONResponse({"error": "key is required"}, status_code=400)
        if value == "******":
            self._add_audit_log("config_update", f"{key} (unchanged secret)", request)
            return JSONResponse({"success": True})
        self.sdk.config.setConfig(key, value)
        self._add_audit_log("config_update", key, request)
        return JSONResponse({"success": True})

    async def _api_fonts_upload(self, request: Request) -> JSONResponse:
        """上传自定义字体文件（ttf/otf/woff/woff2），保存后返回引用 URL"""
        import uuid as _uuid

        try:
            form = await request.form()
            file = form.get("file")
            if file is None:
                return JSONResponse({"error": "file is required"}, status_code=400)
            name = getattr(file, "filename", "") or "font"
            ext = os.path.splitext(name)[1].lower()
            if ext not in (".ttf", ".otf", ".woff", ".woff2"):
                return JSONResponse(
                    {"error": "only font files (.ttf/.otf/.woff/.woff2) are allowed"},
                    status_code=400,
                )
            data = await file.read()
            if len(data) > 15 * 1024 * 1024:
                return JSONResponse(
                    {"error": "font too large (max 15MB)"}, status_code=400
                )
            upload_dir = Path(__file__).parent.parent / "static" / "res" / "fonts_upload"
            upload_dir.mkdir(parents=True, exist_ok=True)
            filename = f"font_{_uuid.uuid4().hex}{ext}"
            (upload_dir / filename).write_bytes(data)
            url = f"/Dashboard/static/res/fonts_upload/{filename}"
            self._add_audit_log("font_upload", url, request)
            return JSONResponse({"success": True, "url": url, "name": name})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_fonts_delete(self, request: Request) -> JSONResponse:
        """删除已上传的字体文件（仅限 fonts_upload 目录内）"""
        try:
            body = await request.json()
            url = body.get("url", "")
            if not url:
                return JSONResponse({"error": "url is required"}, status_code=400)
            marker = "res/fonts_upload/"
            if marker not in url:
                return JSONResponse({"error": "invalid url"}, status_code=400)
            filename = url.split(marker)[-1]
            if "/" in filename or ".." in filename or "\\" in filename:
                return JSONResponse({"error": "invalid url"}, status_code=400)
            target = Path(__file__).parent.parent / "static" / "res" / "fonts_upload" / filename
            if target.exists():
                target.unlink()
            self._add_audit_log("font_delete", url, request)
            return JSONResponse({"success": True})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_i18n_sync(self, request: Request) -> JSONResponse:
        """将 Dashboard 前端语言同步到框架 i18n"""
        try:
            body = await request.json()
        except Exception:
            body = {}
        frontend_lang = str(body.get("lang", "") or "")
        # 前端语言码 → 框架语言码映射
        lang_map = {
            "zh": "zh-CN",
            "zh-CN": "zh-CN",
            "zh-TW": "zh-TW",
            "en": "en",
            "ja": "ja",
            "ru": "ru",
        }
        mapped = lang_map.get(frontend_lang, frontend_lang)
        if not mapped:
            return JSONResponse({"error": "lang is required"}, status_code=400)
        try:
            i18n = self.sdk.i18n
            supported = set(getattr(i18n, "get_supported_languages", lambda: [])() or [])
            if supported and mapped not in supported:
                return JSONResponse(
                    {"error": f"unsupported language: {mapped}"}, status_code=400
                )
        except Exception:
            pass
        # 1) 运行时切换：内存 + 全局持久化（立即生效）
        try:
            if hasattr(self.sdk.i18n, "set_language"):
                self.sdk.i18n.set_language(mapped)
        except Exception:
            pass
        # 2) 配置持久化：写入 ErisPulse.i18n.language 作为兜底，保证配置与运行态一致
        try:
            self.sdk.config.setConfig(
                "ErisPulse.i18n.language", mapped, immediate=True
            )
        except Exception:
            pass
        self._add_audit_log("i18n_sync", mapped, request)
        current = None
        try:
            if hasattr(self.sdk.i18n, "get_language"):
                current = self.sdk.i18n.get_language()
        except Exception:
            pass
        return JSONResponse({"success": True, "language": current or mapped})

    # ════════════════ 外观 ════════════════

    async def _api_appearance(self, request: Request) -> JSONResponse:
        appearance = self.sdk.config.getConfig("Dashboard.appearance") or {}
        # 清理可能残留的 base64 图片数据（防止污染）
        appearance = self._sanitize_appearance(appearance)
        return JSONResponse({"appearance": appearance})

    async def _api_appearance_update(self, request: Request) -> JSONResponse:
        """
        主动上传全局外观：以当前请求的外观为全局外观，并广播给所有客户端。

        前端在「设置-外观」点击「上传全局」时调用；其他客户端收到
        appearance_changed 广播后自动套用该外观。
        """
        body = await request.json()
        # 过滤掉 base64 图片数据，避免污染配置文件
        body = self._sanitize_appearance(body)
        # 合并到已有配置，避免直接覆盖丢失字段
        existing = self.sdk.config.getConfig("Dashboard.appearance") or {}
        if not isinstance(existing, dict):
            existing = {}
        merged = {**existing, **body}
        if "_global_enabled" in body:
            # 显式切换全局同步开关（True/False 均按请求值生效）
            pass
        else:
            # 主动上传外观 → 视为开启全局外观，供其他端自动套用
            merged["_global_enabled"] = True
        self.sdk.config.setConfig("Dashboard.appearance", merged)
        self._add_audit_log("appearance_update", "Dashboard.appearance", request)
        self._safe_broadcast({"type": "appearance_changed"})
        return JSONResponse({"success": True})

    async def _api_appearance_upload(self, request: Request) -> JSONResponse:
        import uuid as _uuid

        try:
            form = await request.form()
            file = form.get("file")
            if file is None:
                return JSONResponse({"error": "file is required"}, status_code=400)
            content_type = getattr(file, "content_type", "") or ""
            if not content_type.startswith("image/"):
                return JSONResponse(
                    {"error": "only image files are allowed"}, status_code=400
                )
            ext_map = {
                "image/png": ".png",
                "image/jpeg": ".jpg",
                "image/jpg": ".jpg",
                "image/gif": ".gif",
                "image/webp": ".webp",
            }
            ext = ext_map.get(content_type, ".png")
            upload_dir = Path(__file__).parent.parent / "static" / "res" / "bg_upload"
            upload_dir.mkdir(parents=True, exist_ok=True)
            filename = f"bg_{_uuid.uuid4().hex}{ext}"
            file_path = upload_dir / filename
            data = await file.read()
            # 限制大小（5MB）
            if len(data) > 5 * 1024 * 1024:
                return JSONResponse(
                    {"error": "image too large (max 5MB)"}, status_code=400
                )
            file_path.write_bytes(data)
            url = f"/Dashboard/static/res/bg_upload/{filename}"
            self._add_audit_log("appearance_upload", url, request)
            return JSONResponse({"success": True, "url": url})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    def _sanitize_appearance(self, data: dict) -> dict:
        """移除外观数据中的 base64 图片，避免污染配置与响应"""
        if not isinstance(data, dict):
            return {}
        clean = dict(data)
        img = clean.get("bg_image")
        if isinstance(img, str) and img.startswith("data:"):
            clean["bg_image"] = ""
        return clean

    # ════════════════ 存储 ════════════════

    async def _api_storage(self, request: Request) -> JSONResponse:
        keys = self.storage.get_all_keys()
        data = {}
        for k in keys[:200]:
            data[k] = self.storage.get(k)
        return JSONResponse({"keys": keys, "data": data, "total": len(keys)})

    async def _api_storage_set(self, request: Request) -> JSONResponse:
        body = await request.json()
        key, value = body.get("key", ""), body.get("value")
        if not key:
            return JSONResponse({"error": "key is required"}, status_code=400)
        self.storage.set(key, value)
        self._add_audit_log("storage_set", key, request)
        return JSONResponse({"success": True})

    async def _api_storage_delete(self, request: Request) -> JSONResponse:
        body = await request.json()
        key = body.get("key", "")
        if not key:
            return JSONResponse({"error": "key is required"}, status_code=400)
        self.storage.delete(key)
        self._add_audit_log("storage_delete", key, request)
        return JSONResponse({"success": True})
