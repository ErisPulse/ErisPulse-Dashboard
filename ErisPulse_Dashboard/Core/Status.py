"""StatusMixin：系统状态 / 框架信息与认证、系统状态 API"""

import asyncio
import os
import secrets
import sys
import time

from fastapi import Request
from fastapi.responses import JSONResponse

from .Helpers import _CoreHelpers


class StatusMixin:
    """系统状态 / 框架信息聚合与认证、系统状态 API。"""


    def _get_framework_info(self) -> dict:
        import platform as pf

        try:
            import importlib.metadata

            version = importlib.metadata.version("ErisPulse")
        except importlib.metadata.PackageNotFoundError:
            version = "unknown"
        return {
            "version": version,
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "platform": pf.system(),
            "is_windows": sys.platform == "win32",
        }

    async def _get_system_status(self) -> dict:
        import platform as pf

        uptime = time.time() - self._start_time
        mem = {}
        proc_info = {}

        psutil_ok = False
        proc = None
        try:
            # 使用缓存引用：运行期商店安装若连带升级 psutil，
            # 重新 import 可能拿到磁盘上被替换一半的模块导致属性缺失
            psutil = self._psutil_mod
            if psutil is None:
                import psutil as _psutil

                psutil = self._psutil_mod = _psutil

            proc = psutil.Process(os.getpid())
            psutil_ok = True
        except ImportError:
            self.logger.warning(
                "psutil not installed, system monitoring unavailable. Install with: pip install psutil"
            )
        except Exception as e:
            self.logger.warning(f"获取系统信息失败: {e}")

        if psutil_ok:
            # 逐项独立采集：任何一项失败只跳过该项（不设键），
            # 不影响其它指标——兼容 Android rootfs / 受限容器等
            # 部分 /proc 不可读的环境

            try:
                mem_info_rss = proc.memory_info()
                mem["rss_mb"] = round(mem_info_rss.rss / 1024 / 1024, 1)
                mem["vms_mb"] = round(mem_info_rss.vms / 1024 / 1024, 1)
            except Exception as e:
                self.logger.debug(f"memory_info failed: {e}")

            try:
                loop = asyncio.get_event_loop()
                cpu_val = await loop.run_in_executor(
                    None, lambda: proc.cpu_percent(interval=1.0)
                )
                mem["cpu_percent"] = round(cpu_val, 1)
            except Exception as e:
                self.logger.debug(f"CPU measurement failed: {e}")
                try:
                    mem["cpu_percent"] = round(proc.cpu_percent(interval=None), 1)
                except Exception as e2:
                    self.logger.debug(f"CPU fallback failed: {e2}")

            try:
                vm = psutil.virtual_memory()
                mem["system_percent"] = round(vm.percent, 1)
                mem["system_total_gb"] = round(vm.total / 1024 / 1024 / 1024, 2)
                mem["system_available_gb"] = round(vm.available / 1024 / 1024 / 1024, 2)
            except Exception as e:
                self.logger.debug(f"virtual_memory failed: {e}")

            try:
                mem["system_cpu_percent"] = round(psutil.cpu_percent(interval=0.1), 1)
            except Exception:
                pass

            try:
                swap = psutil.swap_memory()
                mem["swap_percent"] = round(swap.percent, 1)
                mem["swap_used_mb"] = round(swap.used / 1024 / 1024, 1)
            except Exception as e:
                self.logger.debug(f"swap_memory failed: {e}")

            try:
                proc_info["threads"] = proc.num_threads()
            except Exception as e:
                self.logger.debug(f"num_threads failed: {e}")

            try:
                proc_info["open_files"] = len(proc.open_files())
            except Exception as e:
                self.logger.debug(f"open_files failed: {e}")

            try:
                cpu_times = proc.cpu_times()
                proc_info["cpu_user"] = round(cpu_times.user, 2)
                proc_info["cpu_system"] = round(cpu_times.system, 2)
            except Exception as e:
                self.logger.debug(f"cpu_times failed: {e}")

            try:
                io_counters = proc.io_counters()
                proc_info["read_bytes_mb"] = round(
                    io_counters.read_bytes / 1024 / 1024, 1
                )
                proc_info["write_bytes_mb"] = round(
                    io_counters.write_bytes / 1024 / 1024, 1
                )
            except Exception:
                pass

            try:
                connections = proc.connections()
                proc_info["connections"] = len(connections)
                proc_info["listening"] = len(
                    [c for c in connections if c.status == "LISTEN"]
                )
            except Exception:
                pass

            try:
                proc_info["created"] = proc.create_time()
            except Exception as e:
                self.logger.debug(f"create_time failed: {e}")

        mem["psutil_ok"] = psutil_ok

        # ---- 降级链：psutil 缺失/部分失败时直接读 /proc 与 resource ----
        need_sys_mem = "system_percent" not in mem
        need_proc_mem = "rss_mb" not in mem
        need_proc_cpu = "cpu_percent" not in mem
        need_sys_cpu = "system_cpu_percent" not in mem

        if need_sys_mem:
            try:
                info = {}
                with open("/proc/meminfo", "r") as f:
                    for line in f:
                        parts = line.split(":")
                        if len(parts) == 2:
                            info[parts[0].strip()] = parts[1].strip().split()[0]
                total_kb = float(info.get("MemTotal", 0))
                avail_kb = float(
                    info.get("MemAvailable", info.get("MemFree", 0))
                )
                if total_kb > 0:
                    mem["system_total_gb"] = round(total_kb / 1024 / 1024, 2)
                    mem["system_available_gb"] = round(
                        avail_kb / 1024 / 1024, 2
                    )
                    mem["system_percent"] = round(
                        (total_kb - avail_kb) / total_kb * 100, 1
                    )
            except Exception as e:
                self.logger.debug(f"/proc/meminfo fallback failed: {e}")

        if need_proc_mem:
            got_rss = False
            try:
                with open("/proc/self/status", "r") as f:
                    for line in f:
                        if line.startswith("VmRSS:"):
                            mem["rss_mb"] = round(float(line.split()[1]) / 1024, 1)
                            got_rss = True
                            break
            except Exception as e:
                self.logger.debug(f"/proc/self/status fallback failed: {e}")
            if not got_rss:
                try:
                    import resource

                    maxrss = resource.getrusage(
                        resource.RUSAGE_SELF
                    ).ru_maxrss  # Linux 下为 KB
                    mem["rss_mb"] = round(maxrss / 1024, 1)
                except Exception as e:
                    self.logger.debug(f"getrusage fallback failed: {e}")

        try:
            now_mono = time.monotonic()
            ticks = 100
            try:
                ticks = os.sysconf("SC_CLK_TCK") or 100
            except Exception:
                pass

            if need_proc_cpu:
                try:
                    with open("/proc/self/stat", "r") as f:
                        fields = f.read().rsplit(")", 1)[-1].split()
                    total_j = float(fields[11]) + float(fields[12])
                    prev_j = getattr(self, "_last_proc_jiffies", None)
                    prev_t = getattr(self, "_last_proc_jiffies_ts", None)
                    if prev_j is not None and prev_t is not None:
                        dt = now_mono - prev_t
                        if dt > 0:
                            mem["cpu_percent"] = round(
                                min((total_j - prev_j) / (dt * ticks) * 100, 100), 1
                            )
                    self._last_proc_jiffies = total_j
                    self._last_proc_jiffies_ts = now_mono
                except Exception as e:
                    self.logger.debug(f"/proc/self/stat fallback failed: {e}")

            if need_sys_cpu:
                try:
                    with open("/proc/stat", "r") as f:
                        fields = [float(x) for x in f.readline().split()[1:]]
                    idle = fields[3] + (fields[4] if len(fields) > 4 else 0)
                    total = sum(fields)
                    prev = getattr(self, "_last_sys_cpu", None)
                    prev_t = getattr(self, "_last_sys_cpu_ts", None)
                    if prev is not None and prev_t is not None:
                        dt = now_mono - prev_t
                        d_total = total - prev["total"]
                        d_idle = idle - prev["idle"]
                        if dt > 0 and d_total > 0:
                            mem["system_cpu_percent"] = round(
                                min((1 - d_idle / d_total) * 100, 100), 1
                            )
                    self._last_sys_cpu = {"total": total, "idle": idle}
                    self._last_sys_cpu_ts = now_mono
                except Exception as e:
                    self.logger.debug(f"/proc/stat fallback failed: {e}")
        except Exception as e:
            self.logger.debug(f"proc fallback failed: {e}")

        try:
            mem["load_avg"] = [round(x, 2) for x in os.getloadavg()]
        except Exception:
            pass

        ec = {}
        for e in self._event_log:
            t = e["type"]
            ec[t] = ec.get(t, 0) + 1
        return {
            "uptime_seconds": round(uptime),
            "uptime_human": _CoreHelpers._fmt_uptime(uptime),
            "platform": pf.system(),
            "platform_release": pf.release(),
            "platform_machine": pf.machine(),
            "pid": os.getpid(),
            "memory": mem,
            "process": proc_info,
            "event_counts": ec,
            "total_events": self._total_event_count,
        }

    # ════════════════ API · 认证与系统状态 ════════════════

    async def _api_auth(self, request: Request) -> JSONResponse:
        if self._login_fails >= 10 and time.time() - self._last_login_fail > 60:
            self._login_fails = 0
        if self._login_fails >= 10:
            return JSONResponse(
                {"success": False, "error": "Too many attempts, try again later"},
                status_code=429,
            )
        body = await request.json()
        token = body.get("token", "")
        if self._verify_token(token):
            self._login_fails = 0
            self._add_audit_log("login_success", "", request)
            return JSONResponse({"success": True})
        self._login_fails += 1
        self._last_login_fail = time.time()
        self._add_audit_log("login_failed", "", request)
        return JSONResponse(
            {"success": False, "error": "Invalid token"}, status_code=401
        )

    async def _api_auth_status(self, request: Request) -> JSONResponse:
        token = self._get_token_from_request(request)
        if self._verify_token(token):
            return JSONResponse({"authenticated": True})
        return JSONResponse({"authenticated": False}, status_code=401)

    async def _api_status(self, request: Request) -> JSONResponse:
        fw = self._get_framework_info()
        return JSONResponse(
            {
                "framework": fw,
                "adapters": self.sdk.adapter.get_status_summary().get("adapters", {}),
                "modules": {
                    n: self.sdk.module.is_loaded(n)
                    for n in self.sdk.module.list_registered()
                },
            }
        )

    async def _api_auth_permissions(self, request: Request) -> JSONResponse:
        """返回当前令牌的身份与能力集（前端据此隐藏未授权页面/功能）"""
        token = self._get_token_from_request(request)
        info = self._get_token_info(token)
        if not info:
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        return JSONResponse(
            {
                "admin": info.get("admin", False),
                "name": info.get("name", ""),
                "caps": info.get("caps") or [],
            }
        )

    def _require_admin(self, request: Request) -> bool:
        """令牌管理仅限全局管理员（主令牌）"""
        token = self._get_token_from_request(request)
        info = self._get_token_info(token)
        return bool(info and info.get("admin"))

    async def _api_users_tokens(self, request: Request) -> JSONResponse:
        """列出受限令牌（脱敏，不含完整 token）"""
        if not self._require_admin(request):
            return JSONResponse({"error": "forbidden"}, status_code=403)
        tokens = self.sdk.config.getConfig("Dashboard.tokens") or []
        safe = [
            {
                "name": t.get("name", ""),
                "caps": t.get("caps") or [],
                "created": t.get("created", ""),
                "masked": str(t.get("token", ""))[:6] + "…" if t.get("token") else "",
            }
            for t in tokens
            if isinstance(t, dict)
        ]
        return JSONResponse({"tokens": safe})

    async def _api_users_tokens_create(self, request: Request) -> JSONResponse:
        """创建受限令牌：完整 token 仅在创建响应中返回一次"""
        if not self._require_admin(request):
            return JSONResponse({"error": "forbidden"}, status_code=403)
        body = await request.json()
        name = str(body.get("name", "")).strip()
        caps = body.get("caps") or []
        if not name:
            return JSONResponse({"error": "name is required"}, status_code=400)
        if not isinstance(caps, list):
            return JSONResponse({"error": "caps must be a list"}, status_code=400)
        tokens = self.sdk.config.getConfig("Dashboard.tokens") or []
        if any(isinstance(t, dict) and t.get("name") == name for t in tokens):
            return JSONResponse({"error": "name already exists"}, status_code=400)
        token = secrets.token_urlsafe(24)
        entry = {
            "name": name,
            "token": token,
            "caps": [str(c) for c in caps],
            "created": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        tokens.append(entry)
        self.sdk.config.setConfig("Dashboard.tokens", tokens, immediate=True)
        self._add_audit_log("user_token_create", name, request)
        return JSONResponse({"success": True, "token": token, "name": name})

    async def _api_users_tokens_delete(self, request: Request) -> JSONResponse:
        if not self._require_admin(request):
            return JSONResponse({"error": "forbidden"}, status_code=403)
        body = await request.json()
        name = str(body.get("name", ""))
        tokens = self.sdk.config.getConfig("Dashboard.tokens") or []
        remaining = [t for t in tokens if not (isinstance(t, dict) and t.get("name") == name)]
        if len(remaining) == len(tokens):
            return JSONResponse({"error": "not found"}, status_code=404)
        self.sdk.config.setConfig("Dashboard.tokens", remaining, immediate=True)
        self._add_audit_log("user_token_delete", name, request)
        return JSONResponse({"success": True})

    async def _api_system(self, request: Request) -> JSONResponse:
        return JSONResponse(await self._get_system_status())
