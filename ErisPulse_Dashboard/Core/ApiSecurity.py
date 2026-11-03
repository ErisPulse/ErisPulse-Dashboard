"""API 密钥管理：多密钥体系（Dashboard.keys 配置段）

密钥存加盐 SHA-256（每密钥独立 salt，防彩虹表），明文仅创建/重生成时一次性返回。
角色：admin（全权限）/ viewer（只读，非 GET 返回 403）。
主令牌（Dashboard.token）保持明文：它是最终恢复通道（等同 root 口令位），
哈希化后遗忘即永久锁死 WebUI，只能手改 config.toml。
"""

import hashlib
import hmac
import secrets
import time

from fastapi import Request
from fastapi.responses import JSONResponse

ROLE_ADMIN = "admin"
ROLE_VIEWER = "viewer"
_VALID_ROLES = (ROLE_ADMIN, ROLE_VIEWER)

 
 
 
 
DEFAULT_PAGE_API_PREFIXES: dict[str, tuple[str, ...]] = {
    "dashboard": ("/api/status", "/api/health", "/api/performance", "/api/message-stats", "/api/dashboard/"),
    "event-stream": ("/api/events",),
    "transcript": ("/api/transcript",),
    "bots": ("/api/bots", "/api/master/candidates"),
    "module-mgmt": ("/api/modules", "/api/adapters", "/api/ownership"),
    "store": ("/api/store",),
    "packages": ("/api/packages",),
    "config": ("/api/config", "/api/module/"),
    "framework": ("/api/framework/",),
    "logs": ("/api/logs", "/api/lifecycle", "/api/audit", "/api/routes"),
    "api-routes": ("/api/routes",),
    "permissions": ("/api/scope", "/api/master", "/api/commands"),
    "files": ("/api/files",),
    "cluster": ("/api/cluster",),
    "topology": ("/api/topology",),
    "settings": ("/api/system", "/api/storage", "/api/backup", "/api/security/", "/api/i18n/"),
    "about": (),
}

 
_key_last_used: dict[str, float] = {}

_HASH_ALGO = "sha256"


def _hash_key(raw: str, salt_hex: str) -> str:
    """加盐哈希：HMAC-SHA256(salt, key)，hmac 结构防长度扩展。"""
    return hmac.new(
        bytes.fromhex(salt_hex), raw.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _new_key_entry(name: str, role: str, raw: str | None = None) -> tuple[dict, str]:
    """生成密钥条目与明文。返回 (entry, plaintext)。"""
    raw = raw or ("epk_" + secrets.token_urlsafe(32))
    salt_hex = secrets.token_hex(16)
    entry = {
        "id": "k-" + secrets.token_hex(6),
        "name": name,
        "role": role,
        "enabled": True,
        "key_hash": _hash_key(raw, salt_hex),
        "key_salt": salt_hex,
        "key_algo": _HASH_ALGO,
        "key_prefix": raw[:10],
        "created_at": int(time.time()),
    }
    return entry, raw


class ApiKeysMixin:
    """密钥 CRUD 与角色化验证，混入 Dashboard 主类。"""

     

    def _load_keys(self) -> list[dict]:
        raw = self.sdk.config.getConfig("Dashboard.keys")
        out = []
        for k in raw or []:
            if (
                isinstance(k, dict)
                and k.get("id")
                and k.get("key_hash")
                and k.get("key_salt")
            ):
                out.append(k)
        return out

    def _save_keys(self, keys: list[dict]) -> None:
        self.sdk.config.setConfig("Dashboard.keys", keys, immediate=True)

     

    def _resolve_access(self, provided: str | None) -> tuple[bool, str, str, list]:
        """解析凭据为 (ok, role, key_id, pages)。

        匹配顺序：主令牌（admin）→ Dashboard.keys 中启用密钥。
        pages 为页面白名单（仅 viewer 有意义；空 = 不限制）。
        全程常数时间比较。
        """
        if not provided:
            return False, "", "", []
        provided_str = str(provided)
         
        try:
            if secrets.compare_digest(
                provided_str.encode("utf-8"), self._token.encode("utf-8")
            ):
                return True, ROLE_ADMIN, "primary", []
        except Exception:
            pass
         
        for k in self._load_keys():
            salt_hex = str(k.get("key_salt", ""))
            try:
                hashed = _hash_key(provided_str, salt_hex)
                if not secrets.compare_digest(hashed, str(k.get("key_hash", ""))):
                    continue
            except Exception:
                continue
            if not k.get("enabled", True):
                return False, "", "", []
            key_id = str(k.get("id", ""))
            _key_last_used[key_id] = time.time()
            pages = [str(p) for p in (k.get("pages") or []) if isinstance(p, str)]
            return True, str(k.get("role", ROLE_VIEWER)), key_id, pages
        return False, "", "", []

    def _is_admin_credential(self, provided: str | None) -> bool:
        ok, role, _, _ = self._resolve_access(provided)
        return ok and role == ROLE_ADMIN

    def _page_api_map(self) -> dict[str, tuple[str, ...]]:
        """页面 → API 前缀映射：内置默认 + Dashboard.rbac.page_api_map 覆盖。

        覆盖项为 dict（页面 id → 前缀数组/字符串）；未列出的页面沿用默认。
        """
        out: dict[str, tuple[str, ...]] = dict(DEFAULT_PAGE_API_PREFIXES)
        try:
            custom = self.sdk.config.getConfig("Dashboard.rbac.page_api_map") or {}
        except Exception:
            custom = {}
        if isinstance(custom, dict):
            for page, prefixes in custom.items():
                if isinstance(prefixes, str):
                    prefixes = [prefixes]
                if isinstance(prefixes, (list, tuple)):
                    out[str(page)] = tuple(
                        str(p) for p in prefixes if isinstance(p, str)
                    )
        return out

    def _page_allowed(self, pages: list, api_path: str) -> bool:
        """viewer 页面白名单下的 API 放行判定（api_path 为 /Dashboard 相对路径）。"""
        if not pages:
            return True   
        page_map = self._page_api_map()
        for page in pages:
            prefixes = page_map.get(page)
            if not prefixes:
                continue
            for pfx in prefixes:
                if api_path == pfx or api_path.startswith(pfx):
                    return True
        return False

     

    def _sanitize_key(self, k: dict) -> dict:
        return {
            "id": k.get("id"),
            "name": k.get("name", ""),
            "role": k.get("role", ROLE_VIEWER),
            "enabled": bool(k.get("enabled", True)),
            "pages": [str(p) for p in (k.get("pages") or [])],
            "key_prefix": k.get("key_prefix", ""),
            "created_at": k.get("created_at", 0),
            "last_used": _key_last_used.get(str(k.get("id", "")), 0),
        }

    async def _api_keys_list(self, request: Request) -> JSONResponse:
         
        keys = [self._sanitize_key(k) for k in self._load_keys()]
        return JSONResponse({"keys": keys})

    async def _api_security_pages(self, request: Request) -> JSONResponse:
        """对外暴露 页面 → API 前缀 映射（密钥权限编辑器与文档的单一数据源）。

        含内置默认与 Dashboard.rbac.page_api_map 覆盖结果，便于前端展示
        "该页面能访问哪些接口"，也便于用户核对自定义映射。
        """
        page_map = self._page_api_map()
        return JSONResponse(
            {
                "pages": {k: list(v) for k, v in page_map.items()},
                "rbac": {
                    "roles": [ROLE_ADMIN, ROLE_VIEWER],
                    "viewer_denies_non_get": True,
                    "empty_pages_means_all_readonly": True,
                    "override_key": "Dashboard.rbac.page_api_map",
                },
            }
        )

    async def _api_keys_create(self, request: Request) -> JSONResponse:
        try:
            body = await request.json()
        except Exception:
            body = {}
        name = str((body or {}).get("name") or "").strip()
        role = str((body or {}).get("role") or ROLE_VIEWER)
        pages = [str(p) for p in ((body or {}).get("pages") or []) if isinstance(p, str)]
        if not name:
            return JSONResponse({"error": "name is required"}, status_code=400)
        if len(name) > 64:
            return JSONResponse({"error": "name too long"}, status_code=400)
        if role not in _VALID_ROLES:
            return JSONResponse(
                {"error": f"role must be one of {_VALID_ROLES}"}, status_code=400
            )
         
        if role == ROLE_ADMIN:
            pages = []
        entry, raw = _new_key_entry(name, role)
        keys = self._load_keys()
        keys.append(entry)
        self._save_keys(keys)
        self._add_audit_log("api_key_create", f"{entry['id']} name={name} role={role}", request)
         
        return JSONResponse({"success": True, "key": raw, "key_info": self._sanitize_key(entry)})

    async def _api_keys_update(self, request: Request) -> JSONResponse:
        key_id = request.path_params.get("id", "")
        try:
            body = await request.json()
        except Exception:
            body = {}
        body = body or {}
        keys = self._load_keys()
        for k in keys:
            if str(k.get("id")) == key_id:
                if "enabled" in body:
                    k["enabled"] = bool(body["enabled"])
                if "name" in body:
                    new_name = str(body["name"]).strip()
                    if new_name:
                        k["name"] = new_name[:64]
                if "role" in body and body["role"] in _VALID_ROLES:
                    k["role"] = body["role"]
                if "pages" in body and k.get("role", ROLE_VIEWER) != ROLE_ADMIN:
                    k["pages"] = [
                        str(p) for p in (body["pages"] or []) if isinstance(p, str)
                    ]
                self._save_keys(keys)
                self._add_audit_log("api_key_update", key_id, request)
                return JSONResponse({"success": True, "key": self._sanitize_key(k)})
        return JSONResponse({"error": "key not found"}, status_code=404)

    async def _api_keys_delete(self, request: Request) -> JSONResponse:
        key_id = request.path_params.get("id", "")
        keys = self._load_keys()
        remain = [k for k in keys if str(k.get("id")) != key_id]
        if len(remain) == len(keys):
            return JSONResponse({"error": "key not found"}, status_code=404)
        self._save_keys(remain)
        _key_last_used.pop(key_id, None)
        self._add_audit_log("api_key_delete", key_id, request)
        return JSONResponse({"success": True})

    async def _api_keys_regenerate(self, request: Request) -> JSONResponse:
        key_id = request.path_params.get("id", "")
        keys = self._load_keys()
        for k in keys:
            if str(k.get("id")) == key_id:
                raw = "epk_" + secrets.token_urlsafe(32)
                salt_hex = secrets.token_hex(16)
                k["key_hash"] = _hash_key(raw, salt_hex)
                k["key_salt"] = salt_hex
                k["key_algo"] = _HASH_ALGO
                k["key_prefix"] = raw[:10]
                self._save_keys(keys)
                self._add_audit_log("api_key_regenerate", key_id, request)
                return JSONResponse({"success": True, "key": raw, "key_info": self._sanitize_key(k)})
        return JSONResponse({"error": "key not found"}, status_code=404)
