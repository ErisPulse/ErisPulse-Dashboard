"""PipOpsMixin：pip 安装 / 卸载 / 升级 / 离线包安装运行器"""

import os
import shutil
import subprocess
import threading
import time

from .Helpers import _CoreHelpers


class PipOpsMixin:
    """pip 子进程运行器（安装 / 卸载 / 升级 / 离线包）。"""


    def _run_pip_install(
        self,
        packages: list[str],
        task_id: str,
        force: bool = False,
        index_url: str = None,
    ):
        backend = self._get_pkg_manager().get_pip_backend()
        cmd = backend + ["install"]
        if force:
            cmd.append("--force-reinstall")
        if index_url:
            cmd.extend(["--index-url", index_url])
        cmd.extend(packages)
        self._install_tasks[task_id] = {
            "status": "running",
            "started_at": time.time(),
            "packages": packages,
        }
        self._safe_broadcast(
            {
                "type": "install_progress",
                "task_id": task_id,
                "status": "running",
                "packages": packages,
            }
        )
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1,
            )
            combined_lines = []

            def read_pipe(pipe):
                try:
                    for line in iter(pipe.readline, ""):
                        combined_lines.append(line.rstrip())
                        if len(combined_lines) % 5 == 0:
                            self._safe_broadcast(
                                {
                                    "type": "install_progress",
                                    "task_id": task_id,
                                    "status": "running",
                                    "output": combined_lines[-10:],
                                }
                            )
                except Exception:
                    pass
                pipe.close()

            t_out = threading.Thread(target=read_pipe, args=(proc.stdout,))
            t_err = threading.Thread(target=read_pipe, args=(proc.stderr,))
            t_out.start()
            t_err.start()

            try:
                proc.wait(timeout=300)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                self._install_tasks[task_id]["status"] = "timeout"
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "message": "Install timed out (5 min)",
                    }
                )
                return

            t_out.join(timeout=10)
            t_err.join(timeout=10)

            if proc.returncode == 0:
                self._install_tasks[task_id]["status"] = "success"
                self._install_tasks[task_id]["output"] = combined_lines
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "success",
                        "output": combined_lines,
                    }
                )
                self._dynamic_load_new_modules()
                # 升级涉及本模块时：延迟重载 Dashboard，使新后端代码生效
                if _CoreHelpers._packages_contain_dashboard(packages):
                    self._schedule_dashboard_self_reload()
            else:
                self._install_tasks[task_id]["status"] = "error"
                self._install_tasks[task_id]["error"] = "\n".join(combined_lines[-20:])
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "output": combined_lines,
                        "message": "\n".join(combined_lines[-10:])
                        if combined_lines
                        else "Unknown error",
                    }
                )
        except Exception as e:
            self._install_tasks[task_id]["status"] = "error"
            self._install_tasks[task_id]["error"] = str(e)
            self._safe_broadcast(
                {
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "error",
                    "message": str(e),
                }
            )

    def _run_pip_uninstall(self, package_name: str, module_name: str, task_id: str):
        self._install_tasks[task_id] = {
            "status": "running",
            "started_at": time.time(),
            "packages": [package_name],
        }
        self._safe_broadcast(
            {
                "type": "install_progress",
                "task_id": task_id,
                "status": "running",
                "packages": [package_name],
            }
        )
        try:
            pkg_mgr = self._get_pkg_manager()
            backend = pkg_mgr.get_pip_backend()
            # uv pip uninstall 不支持 -y 参数（本身即为非交互式）
            if pkg_mgr.is_using_uv():
                cmd = backend + ["uninstall", package_name]
            else:
                cmd = backend + ["uninstall", "-y", package_name]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if proc.returncode == 0:
                self.sdk.module.unregister(module_name)
                self.sdk.config.setConfig(
                    f"ErisPulse.modules.status.{module_name}", None
                )
                self._ghost_cache["ts"] = 0
                self._install_tasks[task_id] = {
                    "status": "success",
                    "started_at": time.time(),
                    "packages": [package_name],
                    "output": proc.stdout.splitlines()[-20:],
                }
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "success",
                        "output": proc.stdout.splitlines()[-20:],
                    }
                )
                self._safe_broadcast(
                    {
                        "type": "module_changed",
                        "data": {"name": module_name, "action": "uninstalled"},
                    }
                )
            else:
                self._install_tasks[task_id] = {
                    "status": "error",
                    "started_at": time.time(),
                    "packages": [package_name],
                    "error": proc.stderr,
                }
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "message": proc.stderr[-500:]
                        if proc.stderr
                        else "Uninstall failed",
                    }
                )
        except Exception as e:
            self._install_tasks[task_id] = {
                "status": "error",
                "started_at": time.time(),
                "packages": [package_name],
                "error": str(e),
            }
            self._safe_broadcast(
                {
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "error",
                    "message": str(e),
                }
            )

    def _run_pip_upgrade(
        self, packages: list[str], task_id: str, index_url: str = None
    ):
        backend = self._get_pkg_manager().get_pip_backend()
        cmd = backend + ["install", "--upgrade"]
        if index_url:
            cmd.extend(["--index-url", index_url])
        # 通道感知：对 ErisPulse 无版本 pin 的升级若当前已装版本是 pre/rc，
        # 自动带 --pre，避免升级被解析为"回退到最新正式版"（dev > stable 之外
        # 的更常见场景：已装 pre 后无 pin 升级会把 pre 覆盖为正式版）
        if any(p.split("==", 1)[0].strip().lower() == "erispulse" and "==" not in p for p in packages):
            try:
                import re as _re

                from importlib.metadata import version as _pkg_version

                _cur = _pkg_version("ErisPulse") or ""
                # PEP 440 预发布段：dev/a/b/rc/pre 后跟数字或直接后缀
                if _re.search(r"(\.dev\d+|\.a\d+|\.b\d+|\.rc\d+|[ab]\d+|rc\d+)\s*$", _cur, _re.I):
                    cmd.append("--pre")
            except Exception:
                pass
        cmd.extend(packages)
        self._install_tasks[task_id] = {
            "status": "running",
            "started_at": time.time(),
            "packages": packages,
        }
        self._safe_broadcast(
            {
                "type": "install_progress",
                "task_id": task_id,
                "status": "running",
                "packages": packages,
            }
        )
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1,
            )
            combined_lines = []

            def read_pipe(pipe):
                try:
                    for line in iter(pipe.readline, ""):
                        combined_lines.append(line.rstrip())
                        if len(combined_lines) % 5 == 0:
                            self._safe_broadcast(
                                {
                                    "type": "install_progress",
                                    "task_id": task_id,
                                    "status": "running",
                                    "output": combined_lines[-10:],
                                }
                            )
                except Exception:
                    pass
                pipe.close()

            t_out = threading.Thread(target=read_pipe, args=(proc.stdout,))
            t_err = threading.Thread(target=read_pipe, args=(proc.stderr,))
            t_out.start()
            t_err.start()

            try:
                proc.wait(timeout=300)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                self._install_tasks[task_id]["status"] = "timeout"
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "message": "Upgrade timed out (5 min)",
                    }
                )
                return

            t_out.join(timeout=10)
            t_err.join(timeout=10)

            if proc.returncode == 0:
                self._install_tasks[task_id]["status"] = "success"
                self._install_tasks[task_id]["output"] = combined_lines
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "success",
                        "output": combined_lines,
                    }
                )
                self._get_pkg_manager().invalidate_caches()
                # 重载受升级影响的已注册模块（遵守 enabled 状态）
                self._reload_upgraded_registered_modules(packages)
                self._safe_broadcast(
                    {"type": "module_changed", "data": {"action": "upgraded"}}
                )
            else:
                self._install_tasks[task_id]["status"] = "error"
                self._install_tasks[task_id]["error"] = "\n".join(combined_lines[-20:])
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "output": combined_lines,
                        "message": "\n".join(combined_lines[-10:])
                        if combined_lines
                        else "Unknown error",
                    }
                )
        except Exception as e:
            self._install_tasks[task_id]["status"] = "error"
            self._install_tasks[task_id]["error"] = str(e)
            self._safe_broadcast(
                {
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "error",
                    "message": str(e),
                }
            )

    def _run_pip_install_file(
        self,
        file_path: str,
        filename: str,
        tmp_dir: str,
        task_id: str,
        force: bool = False,
        index_url: str = None,
    ):
        self._install_tasks[task_id] = {
            "status": "running",
            "started_at": time.time(),
            "packages": [filename],
        }
        self._safe_broadcast(
            {
                "type": "install_progress",
                "task_id": task_id,
                "status": "running",
                "packages": [filename],
            }
        )

        def _do_install(packages: list[str]) -> tuple[list[str], int]:
            backend = self._get_pkg_manager().get_pip_backend()
            pip_cmd = backend + ["install"]
            if force:
                pip_cmd.append("--force-reinstall")
            if index_url:
                pip_cmd.extend(["--index-url", index_url])
            pip_cmd.extend(packages)
            proc = subprocess.Popen(
                pip_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1,
            )
            combined_lines: list[str] = []

            def read_pipe(pipe):
                try:
                    for line in iter(pipe.readline, ""):
                        combined_lines.append(line.rstrip())
                        if len(combined_lines) % 5 == 0:
                            self._safe_broadcast(
                                {
                                    "type": "install_progress",
                                    "task_id": task_id,
                                    "status": "running",
                                    "output": combined_lines[-10:],
                                }
                            )
                except Exception:
                    pass
                pipe.close()

            t_out = threading.Thread(target=read_pipe, args=(proc.stdout,))
            t_err = threading.Thread(target=read_pipe, args=(proc.stderr,))
            t_out.start()
            t_err.start()
            try:
                proc.wait(timeout=300)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                t_out.join(timeout=10)
                t_err.join(timeout=10)
                return combined_lines, 1
            t_out.join(timeout=10)
            t_err.join(timeout=10)
            return combined_lines, proc.returncode

        try:
            all_lines, rc = _do_install([file_path])
            if rc != 0 and filename.endswith(".zip"):
                stem = os.path.splitext(os.path.basename(filename))[0]
                extract_dir = os.path.join(tmp_dir, stem)
                shutil.unpack_archive(file_path, extract_dir)
                more_lines, rc2 = _do_install([extract_dir])
                all_lines = all_lines + more_lines
                rc = rc2
            if rc == 0:
                self._install_tasks[task_id] = {
                    "status": "success",
                    "started_at": time.time(),
                    "packages": [filename],
                    "output": all_lines[-50:],
                }
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "success",
                        "output": all_lines[-50:],
                    }
                )
                self._dynamic_load_new_modules()
                # 本地文件安装涉及本模块时：延迟重载 Dashboard
                if _CoreHelpers._packages_contain_dashboard([filename]):
                    self._schedule_dashboard_self_reload()
            else:
                self._install_tasks[task_id] = {
                    "status": "error",
                    "started_at": time.time(),
                    "packages": [filename],
                    "output": all_lines[-50:],
                }
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "output": all_lines[-50:],
                        "message": "Install failed",
                    }
                )
        except Exception as e:
            self._install_tasks[task_id] = {
                "status": "error",
                "started_at": time.time(),
                "packages": [filename],
                "output": [str(e)],
            }
            self._safe_broadcast(
                {
                    "type": "install_progress",
                    "task_id": task_id,
                    "status": "error",
                    "message": str(e),
                }
            )
        finally:
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass
