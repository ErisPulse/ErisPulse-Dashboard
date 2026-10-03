"""ApiSslMixin：SSL 证书管理 API（热应用 / 上传 / 状态与证书信息 / 目录推送监控）"""

import asyncio
import os
import ssl as _sslmod
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Request
from fastapi.responses import JSONResponse

from .Constants import MAX_SSL_UPLOAD_SIZE

# ErisPulse.server 下与 SSL 相关的配置键
_SSL_CONFIG_KEYS = ("ssl_certfile", "ssl_keyfile", "ssl_cert", "ssl_key")
# 允许上传的证书/私钥扩展名（按字段区分）
_SSL_CERT_EXTS = (".pem", ".crt", ".cer")
_SSL_KEY_EXTS = (".pem", ".key")
# 证书目录监控轮询间隔（秒）；覆盖 acme.sh / certbot deploy-hook 推送证书的场景
_SSL_WATCH_INTERVAL = 5


class ApiSslMixin:
    """SSL 证书管理：热应用（reload 即校验）、上传落盘 config/ssl/、状态与目录监控。"""


    # ════════════════ 端点 ════════════════

    async def _api_ssl_status(self, request: Request) -> JSONResponse:
        server = self._ssl_server_section()
        certfile = server.get("ssl_certfile")
        keyfile = server.get("ssl_keyfile")
        ssl_cert = server.get("ssl_cert")
        ssl_key = server.get("ssl_key")
        mode = (
            "inline"
            if (ssl_cert and ssl_key)
            else ("path" if (certfile and keyfile) else "none")
        )
        router = getattr(self.sdk, "router", None)
        base_url = str(getattr(router, "base_url", "") or "")
        return JSONResponse(
            {
                "success": True,
                "enabled": mode != "none",
                "mode": mode,
                "certfile": certfile,
                "keyfile": keyfile,
                "has_inline_cert": bool(ssl_cert),
                "has_inline_key": bool(ssl_key),
                # 私钥/证书内容绝不回传，只回传解析结果
                "cert_info": self._ssl_parse_cert_info(
                    ssl_cert if mode == "inline" else certfile,
                    inline=(mode == "inline"),
                ),
                "https_active": base_url.startswith("https"),
                "can_reload": hasattr(router, "reload"),
            }
        )

    async def _api_ssl_apply(self, request: Request) -> JSONResponse:
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid json body"}, status_code=400)
        if not isinstance(body, dict):
            return JSONResponse({"error": "invalid json body"}, status_code=400)

        if body.get("clear"):
            new_cfg = {k: None for k in _SSL_CONFIG_KEYS}
        else:
            mode = body.get("mode")
            if mode == "path":
                certfile = str(body.get("certfile") or "").strip()
                keyfile = str(body.get("keyfile") or "").strip()
                if not certfile or not keyfile:
                    return JSONResponse(
                        {"error": "certfile 和 keyfile 均必填"}, status_code=400
                    )
                err = self._ssl_validate_pair_files(certfile, keyfile)
                if err:
                    return JSONResponse({"error": err}, status_code=400)
                new_cfg = {
                    "ssl_certfile": certfile,
                    "ssl_keyfile": keyfile,
                    "ssl_cert": None,
                    "ssl_key": None,
                }
            elif mode == "inline":
                cert = str(body.get("cert") or "")
                key = str(body.get("key") or "")
                if not cert or not key:
                    return JSONResponse(
                        {"error": "cert 和 key 均必填"}, status_code=400
                    )
                err = self._ssl_validate_pair_pem(cert, key)
                if err:
                    return JSONResponse({"error": f"证书校验失败: {err}"}, status_code=400)
                new_cfg = {
                    "ssl_certfile": None,
                    "ssl_keyfile": None,
                    "ssl_cert": cert,
                    "ssl_key": key,
                }
            else:
                return JSONResponse(
                    {"error": "mode 必须为 path / inline，或 clear=true"}, status_code=400
                )

        # 先持久化（reload 失败时旧服务保持可用，配置保存后重启/下次启动生效）
        for k, v in new_cfg.items():
            self.sdk.config.setConfig(f"ErisPulse.server.{k}", v, immediate=True)

        reloaded = await self._ssl_try_reload(new_cfg)
        action = "ssl_clear" if body.get("clear") else "ssl_apply"
        self._add_audit_log(action, f"reloaded={reloaded}", request)

        message = None
        if not reloaded:
            message = (
                "已保存；未能热应用（服务未运行或热应用失败），重启框架后生效"
                if hasattr(self.sdk.router, "reload")
                else "已保存；当前 SDK 版本不支持热应用，重启框架后生效"
            )
        return JSONResponse({"success": True, "reloaded": reloaded, "message": message})

    async def _api_ssl_upload(self, request: Request) -> JSONResponse:
        try:
            form = await request.form()
        except Exception:
            return JSONResponse({"error": "invalid form body"}, status_code=400)

        ssl_dir = self._ssl_dir()
        saved = {}
        for field, allowed in (("cert", _SSL_CERT_EXTS), ("key", _SSL_KEY_EXTS)):
            f = form.get(field)
            if f is None:
                continue
            data = await f.read()
            if len(data) > MAX_SSL_UPLOAD_SIZE:
                return JSONResponse(
                    {"error": f"{field} 超过大小限制 ({MAX_SSL_UPLOAD_SIZE // 1024}KB)"},
                    status_code=400,
                )
            name = os.path.basename(getattr(f, "filename", "") or f"{field}.pem")
            if os.path.splitext(name)[1].lower() not in allowed:
                return JSONResponse(
                    {"error": f"{field} 仅支持 {'/'.join(allowed)} 文件"}, status_code=400
                )
            target = ssl_dir / name
            try:
                target.write_bytes(data)
            except Exception as e:
                return JSONResponse({"error": f"写入失败: {e}"}, status_code=500)
            saved[f"{field}_path"] = target.relative_to(Path.cwd()).as_posix()

        if not saved:
            return JSONResponse({"error": "未提供 cert/key 文件"}, status_code=400)
        self._add_audit_log("ssl_upload", ", ".join(saved.values()), request)
        return JSONResponse({"success": True, **saved})

    # ════════════════ 证书目录监控 ════════════════

    async def _ssl_watch_loop(self):
        ssl_dir = self._ssl_dir()
        last = self._ssl_dir_signature(ssl_dir)
        while True:
            await asyncio.sleep(_SSL_WATCH_INTERVAL)
            try:
                sig = self._ssl_dir_signature(ssl_dir)
            except Exception:
                continue
            if sig != last:
                last = sig
                try:
                    self._safe_broadcast({"type": "cert_files_changed"})
                except Exception:
                    pass

    def _start_ssl_watch(self):
        if self._ssl_watcher_task is None:
            self._ssl_watcher_task = asyncio.create_task(self._ssl_watch_loop())

    def _stop_ssl_watch(self):
        if self._ssl_watcher_task is not None:
            self._ssl_watcher_task.cancel()
            self._ssl_watcher_task = None

    # ════════════════ 内部工具 ════════════════

    def _ssl_dir(self) -> Path:
        ssl_dir = Path.cwd() / "config" / "ssl"
        ssl_dir.mkdir(parents=True, exist_ok=True)
        return ssl_dir

    def _ssl_server_section(self) -> dict:
        server = self.sdk.config.getConfig("ErisPulse.server", {}) or {}
        return server if isinstance(server, dict) else {}

    async def _ssl_try_reload(self, new_cfg: dict) -> bool:
        """热应用；无 reload 的旧 SDK 直接返回 False（回退：仅持久化 + 重启生效）。

        reload 的参数缺省=沿用当前值，因此切换模式时用空字符串显式清空
        另一种表示（inline ↔ path），None 会沿用旧值导致两种表示叠加。
        """
        router = getattr(self.sdk, "router", None)
        reload_fn = getattr(router, "reload", None)
        if reload_fn is None:
            return False
        try:
            return bool(
                await reload_fn(
                    ssl_certfile=new_cfg.get("ssl_certfile") or "",
                    ssl_keyfile=new_cfg.get("ssl_keyfile") or "",
                    ssl_cert=new_cfg.get("ssl_cert") or "",
                    ssl_key=new_cfg.get("ssl_key") or "",
                )
            )
        except Exception as e:
            self.logger.error(f"SSL 热应用失败: {e}")
            return False

    @staticmethod
    def _ssl_dir_signature(ssl_dir: Path):
        if not ssl_dir.is_dir():
            return None
        sig = []
        for p in sorted(ssl_dir.iterdir()):
            if p.is_file() and p.suffix.lower() in (_SSL_CERT_EXTS + _SSL_KEY_EXTS):
                st = p.stat()
                sig.append((p.name, st.st_size, st.st_mtime))
        return tuple(sig)

    @staticmethod
    def _ssl_validate_pair_pem(cert_pem: str, key_pem: str) -> str | None:
        """stdlib 校验证书/私钥配对可用性；返回错误信息，None 表示通过。"""
        cfd, cpath = tempfile.mkstemp(suffix=".crt")
        kfd, kpath = tempfile.mkstemp(suffix=".key")
        try:
            with os.fdopen(cfd, "w", encoding="utf-8") as f:
                f.write(cert_pem)
            with os.fdopen(kfd, "w", encoding="utf-8") as f:
                f.write(key_pem)
            try:
                ctx = _sslmod.SSLContext(_sslmod.PROTOCOL_TLS_SERVER)
                ctx.load_cert_chain(cpath, kpath)
            except Exception as e:
                return str(e) or e.__class__.__name__
        finally:
            for p in (cpath, kpath):
                try:
                    os.unlink(p)
                except OSError:
                    pass
        return None

    @classmethod
    def _ssl_validate_pair_files(cls, certfile: str, keyfile: str) -> str | None:
        cpath, kpath = Path(certfile), Path(keyfile)
        if not cpath.is_file():
            return f"证书文件不存在: {certfile}"
        if not kpath.is_file():
            return f"私钥文件不存在: {keyfile}"
        try:
            cert_pem = cpath.read_text(encoding="utf-8", errors="replace")
            key_pem = kpath.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            return f"证书文件读取失败: {e}"
        return cls._ssl_validate_pair_pem(cert_pem, key_pem)

    def _ssl_parse_cert_info(self, cert: str | None, *, inline: bool) -> dict | None:
        """解析当前证书详情；解析失败返回 None（前端不展示详情）。"""
        if not cert:
            return None
        tmp_path = None
        try:
            if inline:
                fd, tmp_path = tempfile.mkstemp(suffix=".pem")
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    f.write(cert)
                path = tmp_path
            else:
                path = cert
                if not Path(path).is_file():
                    return None
            return self._ssl_decode_cert_file(path)
        except Exception:
            return None
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    @staticmethod
    def _ssl_decode_cert_file(path: str) -> dict | None:
        """优先 cryptography，未安装回退 stdlib 私有 API，均失败返回 None。"""
        now = datetime.now(timezone.utc)

        def _finish(subject_cn, issuer_cn, not_after, sans):
            return {
                "subject_cn": subject_cn,
                "issuer_cn": issuer_cn,
                "not_after": not_after.strftime("%Y-%m-%d"),
                "days_remaining": (not_after - now).days,
                "sans": sans,
            }

        # 1) cryptography（可选依赖，装了就用）
        try:
            from cryptography import x509
            from cryptography.x509.oid import NameOID

            with open(path, "rb") as f:
                cert = x509.load_pem_x509_certificate(f.read())

            def _cn(name):
                attrs = name.get_attributes_for_oid(NameOID.COMMON_NAME)
                return attrs[0].value if attrs else None

            not_after = getattr(cert, "not_valid_after_utc", None)
            if not_after is None:
                not_after = cert.not_valid_after.replace(tzinfo=timezone.utc)
            sans = []
            try:
                ext = cert.extensions.get_extension_for_class(
                    x509.SubjectAlternativeName
                )
                sans = ext.value.get_values_for_type(x509.DNSName)[:16]
            except Exception:
                pass
            return _finish(_cn(cert.subject), _cn(cert.issuer), not_after, sans)
        except ImportError:
            pass
        except Exception:
            return None

        # 2) stdlib 私有 API（CPython 长期稳定，失败则放弃）
        try:
            info = _sslmod._ssl._test_decode_cert(path)
        except Exception:
            return None

        def _cn_from(part):
            for rdn in part or []:
                for k, v in rdn:
                    if k == "commonName":
                        return v
            return None

        try:
            na = time.strptime(info["notAfter"], "%b %d %H:%M:%S %Y %Z")
            not_after = datetime(*na[:6], tzinfo=timezone.utc)
        except Exception:
            return None
        sans = [
            v for typ, v in (info.get("subjectAltName") or []) if typ == "DNS"
        ][:16]
        return _finish(
            _cn_from(info.get("subject")),
            _cn_from(info.get("issuer")),
            not_after,
            sans,
        )
