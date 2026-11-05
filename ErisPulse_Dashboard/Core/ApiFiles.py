"""ApiFilesMixin：文件管理器 API"""

import mimetypes
import os
import shutil
from pathlib import Path
from urllib.parse import quote

from fastapi import Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

from .Constants import MAX_READ_SIZE, MAX_UPLOAD_SIZE, SENSITIVE_FILES


def _content_disposition(filename: str, disposition: str = "attachment") -> str:
    """RFC 6266/5987 兼容的 Content-Disposition 头，保证值 latin-1 可编码。"""
    quoted = quote(filename, safe="")
    if quoted == filename:
        return f'{disposition}; filename="{filename}"'
    return f'{disposition}; filename="{quoted}"; filename*=UTF-8\'\'{quoted}'


# mimetypes 在精简环境（无 /etc/mime.types、无注册表项）可能缺失的常见媒体类型兜底
_MEDIA_TYPE_FALLBACK = {
    ".webp": "image/webp",
    ".mkv": "video/x-matroska",
    ".m4v": "video/x-m4v",
    ".mov": "video/quicktime",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".opus": "audio/ogg",
    ".aac": "audio/aac",
}


def _guess_media_type(filename: str) -> str:
    ct, _ = mimetypes.guess_type(filename)
    if not ct:
        ct = _MEDIA_TYPE_FALLBACK.get(Path(filename).suffix.lower())
    return ct or "application/octet-stream"


def _is_inline_safe(media_type: str) -> bool:
    """inline 放行白名单：仅浏览器可安全内联渲染的媒体类型。

    刻意排除 text/html 与 image/svg+xml——两者可直接导航执行脚本，
    与 Dashboard 同源会暴露 localStorage 内的 token；SVG 经 <img> 预览
    不执行脚本，attachment 头不影响 <img> 嵌入展示。
    """
    return (
        media_type.startswith(("image/", "video/", "audio/"))
        and media_type != "image/svg+xml"
    ) or media_type in ("application/pdf", "text/plain")


class ApiFilesMixin:
    """文件管理器 API（浏览 / 读写 / 上传下载 / 压缩等）。"""


    # ════════════════ 文件工具 ════════════════

    def _get_project_root(self) -> Path:
        return Path.cwd()

    def _resolve_safe_path(self, relative_path: str) -> Path | None:
        root = self._get_project_root().resolve()
        decoded = relative_path.replace("\\", "/")
        while decoded.startswith("/"):
            decoded = decoded[1:]
        target = (root / decoded).resolve()
        try:
            target.relative_to(root)
        except ValueError:
            return None
        return target

    def _is_sensitive_file(self, path: Path) -> bool:
        return (
            path.name in SENSITIVE_FILES
            or path.name.endswith(".key")
            or path.name.endswith(".pem")
        )

    def _format_permissions(self, mode: int) -> str:
        def _rwx(m):
            r = "r" if m & 4 else "-"
            w = "w" if m & 2 else "-"
            x = "x" if m & 1 else "-"
            return r + w + x

        owner = _rwx((mode >> 6) & 7)
        group = _rwx((mode >> 3) & 7)
        others = _rwx(mode & 7)
        return owner + group + others

    def _file_entry(self, path: Path, root: Path) -> dict:
        try:
            st = path.stat()
            is_dir = path.is_dir()
            rel = str(path.relative_to(root)).replace("\\", "/")
            perm = (
                self._format_permissions(st.st_mode & 0o777)
                if hasattr(st, "st_mode")
                else ""
            )
            return {
                "name": path.name,
                "path": rel,
                "type": "directory" if is_dir else "file",
                "size": 0 if is_dir else st.st_size,
                "modified": st.st_mtime,
                "permissions": perm,
                "mode_octal": oct(st.st_mode & 0o777),
                "readable": os.access(path, os.R_OK),
                "writable": os.access(path, os.W_OK),
            }
        except (OSError, PermissionError):
            rel = str(path.relative_to(root)).replace("\\", "/")
            return {
                "name": path.name,
                "path": rel,
                "type": "unknown",
                "error": "access_denied",
            }

    # ════════════════ API · 文件管理 ════════════════

    async def _api_files_browse(self, request: Request) -> JSONResponse:
        dir_path = request.query_params.get("path", ".")
        sort_by = request.query_params.get("sort", "name")
        show_hidden = request.query_params.get("hidden", "false") == "true"
        target = self._resolve_safe_path(dir_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists() or not target.is_dir():
            return JSONResponse({"error": "Directory not found"}, status_code=404)
        try:
            entries = []
            for item in target.iterdir():
                if not show_hidden and item.name.startswith("."):
                    continue
                entries.append(
                    self._file_entry(item, self._get_project_root().resolve())
                )
        except PermissionError:
            return JSONResponse({"error": "Permission denied"}, status_code=403)
        sort_key_map = {
            "name": "name",
            "size": "size",
            "modified": "modified",
            "type": "type",
        }
        sort_key = sort_key_map.get(sort_by, "name")
        entries.sort(
            key=lambda e: (e.get("type", "") != "directory", e.get(sort_key, ""))
        )
        root = self._get_project_root().resolve()
        return JSONResponse(
            {
                "path": str(target.relative_to(root)).replace("\\", "/")
                if target != root
                else ".",
                "absolute_path": str(target),
                "entries": entries,
                "total": len(entries),
            }
        )

    async def _api_files_read(self, request: Request) -> JSONResponse:
        file_path = request.query_params.get("path", "")
        encoding = request.query_params.get("encoding", "utf-8")
        target = self._resolve_safe_path(file_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists() or not target.is_file():
            return JSONResponse({"error": "File not found"}, status_code=404)
        if self._is_sensitive_file(target):
            return JSONResponse(
                {"error": "Cannot read sensitive file"}, status_code=403
            )
        try:
            st = target.stat()
            if st.st_size > MAX_READ_SIZE:
                return JSONResponse(
                    {
                        "error": "File too large",
                        "size": st.st_size,
                        "max_size": MAX_READ_SIZE,
                    },
                    status_code=413,
                )
        except OSError:
            pass
        try:
            content = target.read_text(encoding=encoding)
            return JSONResponse(
                {
                    "content": content,
                    "size": st.st_size,
                    "encoding": encoding,
                    "path": file_path,
                }
            )
        except UnicodeDecodeError:
            return JSONResponse(
                {"error": "Binary file, cannot display as text", "binary": True},
                status_code=415,
            )
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_write(self, request: Request) -> JSONResponse:
        body = await request.json()
        file_path = body.get("path", "")
        content = body.get("content", "")
        encoding = body.get("encoding", "utf-8")
        target = self._resolve_safe_path(file_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding=encoding)
            self._add_audit_log("file_write", file_path, request)
            return JSONResponse(
                {
                    "success": True,
                    "path": file_path,
                    "size": len(content.encode(encoding)),
                }
            )
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_upload(self, request: Request) -> JSONResponse:
        form = await request.form()
        dest_dir = request.query_params.get("path", ".")
        target_dir = self._resolve_safe_path(dest_dir)
        if target_dir is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target_dir.exists():
            target_dir.mkdir(parents=True, exist_ok=True)
        files = (
            form.getlist("files") if hasattr(form, "getlist") else [form.get("file")]
        )
        if not files or files[0] is None:
            files = [v for k, v in form.items() if hasattr(v, "filename")]
        if not files:
            return JSONResponse({"error": "No files provided"}, status_code=400)
        uploaded = []
        for f in files:
            if not hasattr(f, "filename") or not f.filename:
                continue
            rel_name = f.filename.replace("\\", "/")
            safe_name = "/".join(rel_name.split("/"))
            target_path = target_dir / safe_name
            resolved = self._resolve_safe_path(
                str(target_path.relative_to(self._get_project_root().resolve()))
            )
            if resolved is None:
                continue
            content = await f.read()
            if len(content) > MAX_UPLOAD_SIZE:
                continue
            resolved.parent.mkdir(parents=True, exist_ok=True)
            resolved.write_bytes(content)
            uploaded.append({"name": safe_name, "size": len(content)})
        self._add_audit_log(
            "file_upload", f"{dest_dir}: {len(uploaded)} files", request
        )
        return JSONResponse(
            {"success": True, "uploaded": uploaded, "count": len(uploaded)}
        )

    async def _api_files_download(self, request: Request):
        file_path = request.query_params.get("path", "")
        # inline=1 供在线预览（img/video/audio/iframe）内联渲染；
        # 非白名单类型自动回退 attachment，不开同源 HTML/SVG 脚本口子
        inline = request.query_params.get("inline", "") in ("1", "true")
        target = self._resolve_safe_path(file_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists() or not target.is_file():
            return JSONResponse({"error": "File not found"}, status_code=404)

        size = target.stat().st_size
        media_type = _guess_media_type(target.name)
        if inline and not _is_inline_safe(media_type):
            inline = False
        disposition = "inline" if inline else "attachment"

        headers = {
            "Content-Disposition": _content_disposition(target.name, disposition),
            "Content-Length": str(size),
        }
        start, end = 0, size - 1 if size else 0
        status_code = 200

        # Range 支持：视频拖动进度条 / PDF 分段加载 / 断点续传
        if size and request.headers.get("range", "").startswith("bytes="):
            spec = request.headers["range"][6:].split(",")[0].strip()
            try:
                first, _, last = spec.partition("-")
                if first:
                    start = int(first)
                    if last:
                        end = min(int(last), size - 1)
                elif last:
                    start = max(size - int(last), 0)
            except ValueError:
                start, end = 0, size - 1
            else:
                if start > end or start >= size:
                    return Response(
                        status_code=416,
                        headers={"Content-Range": f"bytes */{size}"},
                    )
                status_code = 206
                headers["Content-Range"] = f"bytes {start}-{end}/{size}"
                headers["Content-Length"] = str(end - start + 1)

        def _iter():
            with open(target, "rb") as f:
                f.seek(start)
                remaining = end - start + 1
                while remaining > 0:
                    chunk = f.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        if status_code == 206:
            headers["Accept-Ranges"] = "bytes"
        return StreamingResponse(
            _iter(),
            status_code=status_code,
            media_type=media_type,
            headers=headers,
        )

    async def _api_files_mkdir(self, request: Request) -> JSONResponse:
        body = await request.json()
        dir_path = body.get("path", "")
        recursive = body.get("recursive", True)
        target = self._resolve_safe_path(dir_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        try:
            target.mkdir(parents=recursive, exist_ok=False)
            self._add_audit_log("file_mkdir", dir_path, request)
            return JSONResponse({"success": True, "path": dir_path})
        except FileExistsError:
            return JSONResponse({"error": "Directory already exists"}, status_code=409)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_delete(self, request: Request) -> JSONResponse:
        body = await request.json()
        paths = body.get("paths", [])
        if not paths:
            return JSONResponse({"error": "paths required"}, status_code=400)
        deleted = []
        for p in paths:
            target = self._resolve_safe_path(p)
            if target is None:
                continue
            if not target.exists():
                continue
            try:
                if target.is_dir():
                    shutil.rmtree(target)
                else:
                    target.unlink()
                deleted.append(p)
            except Exception:
                pass
        self._add_audit_log("file_delete", f"{len(deleted)} items", request)
        return JSONResponse(
            {"success": True, "deleted": deleted, "count": len(deleted)}
        )

    async def _api_files_rename(self, request: Request) -> JSONResponse:
        body = await request.json()
        old_path = body.get("old_path", "")
        new_path = body.get("new_path", "")
        if not old_path or not new_path:
            return JSONResponse(
                {"error": "old_path and new_path required"}, status_code=400
            )
        old_target = self._resolve_safe_path(old_path)
        new_target = self._resolve_safe_path(new_path)
        if old_target is None or new_target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not old_target.exists():
            return JSONResponse({"error": "Source not found"}, status_code=404)
        try:
            new_target.parent.mkdir(parents=True, exist_ok=True)
            old_target.rename(new_target)
            self._add_audit_log("file_rename", f"{old_path} -> {new_path}", request)
            return JSONResponse({"success": True})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_copy(self, request: Request) -> JSONResponse:
        body = await request.json()
        src_path = body.get("src", "")
        dst_path = body.get("dst", "")
        if not src_path or not dst_path:
            return JSONResponse({"error": "src and dst required"}, status_code=400)
        src = self._resolve_safe_path(src_path)
        dst = self._resolve_safe_path(dst_path)
        if src is None or dst is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not src.exists():
            return JSONResponse({"error": "Source not found"}, status_code=404)
        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
            if src.is_dir():
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)
            self._add_audit_log("file_copy", f"{src_path} -> {dst_path}", request)
            return JSONResponse({"success": True})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_chmod(self, request: Request) -> JSONResponse:
        body = await request.json()
        file_path = body.get("path", "")
        mode = body.get("mode", "")
        if not file_path or not mode:
            return JSONResponse({"error": "path and mode required"}, status_code=400)
        target = self._resolve_safe_path(file_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists():
            return JSONResponse({"error": "File not found"}, status_code=404)
        try:
            if isinstance(mode, str):
                mode_int = int(mode, 8)
            else:
                mode_int = int(mode)
            target.chmod(mode_int)
            self._add_audit_log(
                "file_chmod", f"{file_path} -> {oct(mode_int)}", request
            )
            return JSONResponse({"success": True, "mode": oct(mode_int)})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_stat(self, request: Request) -> JSONResponse:
        file_path = request.query_params.get("path", "")
        target = self._resolve_safe_path(file_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists():
            return JSONResponse({"error": "Not found"}, status_code=404)
        try:
            st = target.stat()
            is_dir = target.is_dir()
            root = self._get_project_root().resolve()
            rel = str(target.relative_to(root)).replace("\\", "/")
            return JSONResponse(
                {
                    "name": target.name,
                    "path": rel,
                    "type": "directory" if is_dir else "file",
                    "size": st.st_size,
                    "modified": st.st_mtime,
                    "created": st.st_ctime,
                    "permissions": self._format_permissions(st.st_mode & 0o777),
                    "mode_octal": oct(st.st_mode & 0o777),
                    "readable": os.access(target, os.R_OK),
                    "writable": os.access(target, os.W_OK),
                    "executable": os.access(target, os.X_OK),
                    "is_symlink": target.is_symlink(),
                }
            )
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

    async def _api_files_search(self, request: Request) -> JSONResponse:
        search_path = request.query_params.get("path", ".")
        pattern = request.query_params.get("pattern", "*")
        max_results = int(request.query_params.get("limit", "100"))
        target = self._resolve_safe_path(search_path)
        if target is None:
            return JSONResponse({"error": "Path not allowed"}, status_code=403)
        if not target.exists() or not target.is_dir():
            return JSONResponse({"error": "Directory not found"}, status_code=404)
        root = self._get_project_root().resolve()
        results = []
        try:
            for item in target.rglob(pattern):
                if len(results) >= max_results:
                    break
                if item.name.startswith(".") and not pattern.startswith("."):
                    continue
                results.append(self._file_entry(item, root))
        except PermissionError:
            pass
        return JSONResponse(
            {"results": results, "total": len(results), "pattern": pattern}
        )

    async def _api_files_compress(self, request: Request) -> JSONResponse:
        body = await request.json()
        paths = body.get("paths", [])
        archive_name = body.get("archive_name", "archive.zip")
        if not paths:
            return JSONResponse({"error": "paths required"}, status_code=400)
        import io
        import zipfile

        buf = io.BytesIO()
        root = self._get_project_root().resolve()
        added = 0
        try:
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for p in paths:
                    target = self._resolve_safe_path(p)
                    if target is None or not target.exists():
                        continue
                    arcname = str(target.relative_to(root)).replace("\\", "/")
                    if target.is_dir():
                        for f in target.rglob("*"):
                            if f.name.startswith("."):
                                continue
                            if f.is_file():
                                f_rel = str(f.relative_to(root)).replace("\\", "/")
                                zf.write(f, f_rel)
                                added += 1
                    else:
                        zf.write(target, arcname)
                        added += 1
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
        buf.seek(0)
        self._add_audit_log(
            "file_compress", f"{len(paths)} items -> {archive_name}", request
        )
        return Response(
            content=buf.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": _content_disposition(archive_name)},
        )

    async def _api_files_decompress(self, request: Request) -> JSONResponse:
        body = await request.json()
        file_path = body.get("path", "")
        if not file_path:
            return JSONResponse({"error": "path required"}, status_code=400)
        target = self._resolve_safe_path(file_path)
        if target is None or not target.exists() or not target.is_file():
            return JSONResponse({"error": "File not found"}, status_code=404)
        import tarfile
        import zipfile

        dest = target.parent
        try:
            name_lower = target.name.lower()
            if name_lower.endswith(".zip"):
                with zipfile.ZipFile(target, "r") as zf:
                    # 防 Zip Slip：拒绝绝对路径与 .. 上跳的条目
                    for member in zf.namelist():
                        normalized = member.replace("\\", "/")
                        if (
                            normalized.startswith("/")
                            or ".." in normalized.split("/")
                        ):
                            return JSONResponse(
                                {"error": "Unsafe archive entry: " + member},
                                status_code=400,
                            )
                    zf.extractall(dest)
            elif name_lower.endswith(
                (".tar.gz", ".tgz", ".tar.bz2", ".tar.xz", ".tar")
            ):
                with tarfile.open(target, "r:*") as tf:
                    # 3.12+ 显式 data 过滤器（拒绝绝对路径/..逃逸/设备文件）；
                    # 旧版本回退为逐成员校验
                    try:
                        tf.extractall(dest, filter="data")
                    except TypeError:
                        for member in tf.getmembers():
                            name = member.name.replace("\\", "/")
                            if (
                                name.startswith("/")
                                or ".." in name.split("/")
                                or member.issym()
                                or member.islnk()
                            ):
                                return JSONResponse(
                                    {
                                        "error": "Unsafe archive entry: "
                                        + member.name
                                    },
                                    status_code=400,
                                )
                        tf.extractall(dest)
            else:
                return JSONResponse(
                    {"error": "Unsupported archive format. Use .zip, .tar.gz, .tgz"},
                    status_code=400,
                )
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
        self._add_audit_log("file_decompress", file_path, request)
        return JSONResponse(
            {
                "success": True,
                "path": str(
                    dest.relative_to(self._get_project_root().resolve())
                ).replace("\\", "/"),
            }
        )
