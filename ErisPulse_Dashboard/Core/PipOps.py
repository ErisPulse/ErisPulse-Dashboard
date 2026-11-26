"""PipOpsMixin：pip 安装 / 卸载 / 升级 / 离线包安装运行器"""

import asyncio
import os
import re
import shutil
import subprocess
import threading
import time

from .Helpers import _CoreHelpers


class PipOpsMixin:
    """pip 子进程运行器（安装 / 卸载 / 升级 / 离线包）。"""

    @staticmethod
    def _parse_installed_dists(lines) -> list:
        """
        从 pip 输出解析本次实际安装的发行名（"Successfully installed ..." 行）

        git URL 等直装形式无法按传入名匹配注册组件，须以 pip 实际装上的
        发行名为准驱动升级后的热重载。

        :param lines: pip 输出行
        :return: 归一化（小写、下划线转连字符）后的发行名列表，无匹配返回空列表
        """
        names = []
        for line in lines or []:
            text = str(line).strip()
            if not text.lower().startswith("successfully installed"):
                continue
            for token in text[len("Successfully installed"):].split():
                name = token.rsplit("-", 1)[0].strip().lower().replace("_", "-")
                if name and name not in names:
                    names.append(name)
        return names

    @staticmethod
    def _wheel_dist_identity(file_path: str) -> tuple[str, str]:
        """
        从 wheel 内部 dist-info/METADATA 读真实发行名与版本

        上传/暂存环节都可能改文件名，文件名推断不可靠（uv/pip 对裸路径安装
        也从文件名推包名并与 dist-info 严格比对，不一致直接拒装）——元数据
        才是唯一事实源。

        :return: (name, version)；无法解析返回空串对
        """
        import zipfile

        try:
            with zipfile.ZipFile(file_path) as zf:
                metadata_name = next(
                    (n for n in zf.namelist() if re.match(r"[^/]+\.dist-info/METADATA$", n)),
                    None,
                )
                if not metadata_name:
                    return "", ""
                name = version = ""
                for line in zf.read(metadata_name).decode("utf-8", "replace").splitlines():
                    if line.startswith("Name:"):
                        name = line[5:].strip()
                    elif line.startswith("Version:"):
                        version = line[8:].strip()
                    if name and version:
                        break
                return name, version
        except Exception:
            return "", ""

    @staticmethod
    def _normalize_pep440_version(version: str) -> str:
        """
        PEP 440 规范化版本号（写入 wheel 文件名用）

        文件名的版本段不能含连字符：2.12.1-dev.1 会被按连字符拆段，dev.1
        落进 build tag 位——pip 判"非法 build tag"拒装，支持 PEP 825 的 uv
        则误判为变体 wheel 而去找 dist-info/variant.json 报包格式无效。
        统一改写为规范形式（2.12.1.dev1）；pip/uv 与 METADATA 比对版本时
        按 PEP 440 等价处理，文件名规范化不影响安装。
        """
        mapping = {"alpha": "a", "beta": "b", "c": "rc", "pre": "rc", "preview": "rc"}

        def repl(match):
            seg, num = match.group(1), match.group(2) or ""
            if seg == "dev":
                return f".dev{num}"
            if seg in ("post", "rev", "r"):
                return f".post{num}"
            return mapping.get(seg, seg) + num

        return re.sub(r"[-_.]+(alpha|beta|preview|pre|post|rev|dev|a|b|c|rc)[-_.]?(\d+)?", repl, version.strip().lower())

    def _canonicalize_wheel_name(self, file_path: str, stem: str, tmp_dir: str) -> tuple[str, str, str]:
        """
        wheel 暂存名与内部元数据不符时改写为规范文件名

        用户把 wheel 改过名再上传（如 qvqchat.whl）会让 uv/pip 从文件名推出
        错误包名而拒装——这里以 dist-info 元数据为准改写暂存文件名
        （{name}-{version}-{原tags}，缺 tags 补 py3-none-any）。版本号按
        PEP 440 规范化写入（2.12.1-dev.1 → 2.12.1.dev1），连字符版本会把
        文件名拆出非法 build tag 段。

        :return: (新文件路径, 新 stem, 新文件名)；已是规范名/解析失败原样返回
        """
        try:
            real_name, real_version = self._wheel_dist_identity(file_path)
            if not real_name or not real_version:
                return file_path, stem, stem + ".whl"
            real_version = self._normalize_pep440_version(real_version)
            parts = stem.split("-")
            cur_name = parts[0].strip().lower().replace("_", "-")
            cur_version = parts[1].strip() if len(parts) > 1 else ""
            want_name = real_name.strip().lower().replace("_", "-")
            if cur_name == want_name and cur_version == real_version:
                return file_path, stem, stem + ".whl"
            escaped = re.sub(r"[^\w.]+", "_", real_name.strip())
            # 版本段含连字符时会把后续段吞进版本（如 2.12.1-dev.1 拆成 6 段），
            # tags 取末三段而非紧随版本段，避免把残段拼回文件名
            tags = "-".join(parts[-3:]) if len(parts) >= 5 else "py3-none-any"
            new_stem = f"{escaped}-{real_version}-{tags}"
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,180}", new_stem) or ".." in new_stem:
                return file_path, stem, stem + ".whl"
            new_path = os.path.join(tmp_dir, new_stem + ".whl")
            os.replace(file_path, new_path)
            return new_path, new_stem, new_stem + ".whl"
        except Exception:
            return file_path, stem, stem + ".whl"

    @staticmethod
    def _resolve_file_dist_name(file_path: str, filename: str) -> str:
        """
        从安装文件推断发行名

        wheel 优先读内部 dist-info 元数据（文件名可能被上传/暂存环节改过，
        不可信），失败再退回文件名首段（下划线还原为连字符）；
        zip 取压缩包内 pyproject.toml 的 project.name（3.10 无 tomllib，正则解析）。

        :param file_path: 安装文件路径
        :param filename: 安装文件名
        :return: 归一化发行名，无法识别返回空字符串
        """
        lower = str(filename).lower()
        try:
            if lower.endswith(".whl"):
                name, _version = PipOpsMixin._wheel_dist_identity(file_path)
                if name:
                    return name.strip().lower().replace("_", "-")
                stem = os.path.splitext(filename)[0]
                return stem.split("-")[0].strip().lower().replace("_", "-")
            if lower.endswith(".zip"):
                import zipfile

                with zipfile.ZipFile(file_path) as zf:
                    candidates = sorted(
                        (
                            n
                            for n in zf.namelist()
                            if n == "pyproject.toml" or n.endswith("/pyproject.toml")
                        ),
                        key=lambda n: n.count("/"),
                    )
                    if candidates:
                        text = zf.read(candidates[0]).decode("utf-8", "replace")
                        match = re.search(
                            r'^\s*name\s*=\s*"([^"]+)"', text, re.MULTILINE
                        )
                        if match:
                            return match.group(1).strip().lower().replace("_", "-")
        except Exception:
            pass
        return ""

    @staticmethod
    def _dist_installed(dist_name: str) -> bool:
        """发行名是否已安装（覆盖安装判定）"""
        try:
            import importlib.metadata as imd

            imd.distribution(dist_name)
            return True
        except Exception:
            return False

    def _resolve_dist_components(self, package_name: str):
        """
        按发行名解析其包含的模块与适配器入口名

        :param package_name: pip 发行名
        :return: (模块入口名列表, 适配器入口名列表)
        """
        target = str(package_name).strip().lower().replace("_", "-")
        module_targets = []
        adapter_targets = []
        try:
            from ErisPulse.finders import AdapterFinder, ModuleFinder

            mf = ModuleFinder()
            mf.clear_cache()
            for ep_name, ep in mf.get_entry_point_map().items():
                dist_name = (ep.dist.name if ep else "") or ""
                if dist_name.lower().replace("_", "-") == target:
                    module_targets.append(ep_name)
            af = AdapterFinder()
            af.clear_cache()
            for ep_name, ep in af.get_entry_point_map().items():
                dist_name = (ep.dist.name if ep else "") or ""
                if dist_name.lower().replace("_", "-") == target:
                    adapter_targets.append(ep_name)
        except Exception as e:
            self.logger.warning(
                f"Resolve uninstall targets for {package_name} failed: {e}"
            )
        return module_targets, adapter_targets

    def _detach_dist_components(self, module_targets: list, adapter_targets: list):
        """
        卸载前停止运行中组件（unload 模块 / shutdown 适配器），阻塞等待完成

        unregister 只摘注册不停止运行：若先删文件后摘除，旧实例会带着已删除
        的代码继续服务到重启。须在 pip 卸载之前完成。

        :param module_targets: 模块入口名列表
        :param adapter_targets: 适配器入口名列表
        """
        if (not module_targets and not adapter_targets) or not self._loop or self._loop.is_closed():
            return

        async def _detach():
            for name in module_targets:
                try:
                    if self.sdk.module.is_loaded(name):
                        await self.sdk.module.unload(name)
                except Exception as e:
                    self.logger.warning(
                        f"Unload module {name} before uninstall failed: {e}"
                    )
            for name in adapter_targets:
                try:
                    await self.sdk.adapter.shutdown(name)
                except Exception as e:
                    self.logger.warning(
                        f"Shutdown adapter {name} before uninstall failed: {e}"
                    )

        try:
            asyncio.run_coroutine_threadsafe(_detach(), self._loop).result(timeout=60)
        except Exception as e:
            self.logger.warning(f"Detach components before uninstall failed: {e}")

    def _remove_dist_components(self, module_targets: list, adapter_targets: list):
        """
        卸载成功后取消双侧注册并清理启用状态配置

        :param module_targets: 模块入口名列表
        :param adapter_targets: 适配器入口名列表
        """
        for name in module_targets:
            try:
                self.sdk.module.unregister(name)
            except Exception as e:
                self.logger.warning(f"Unregister module {name} failed: {e}")
            try:
                self.sdk.config.setConfig(f"ErisPulse.modules.status.{name}", None)
            except Exception:
                pass
        for name in adapter_targets:
            try:
                self.sdk.adapter.unregister(name)
            except Exception as e:
                self.logger.warning(f"Unregister adapter {name} failed: {e}")
            try:
                self.sdk.config.setConfig(f"ErisPulse.adapters.status.{name}", None)
            except Exception:
                pass


    def _run_pip_install(
        self,
        packages: list[str],
        task_id: str,
        force: bool = False,
        index_url: str = None,
        extra_args: str = None,
    ):
        # 未显式指定镜像时回落默认镜像源（ErisPulse_Dashboard.default_mirror，
        # 首次设置向导/配置可写），国内网络直连 PyPI 易超时
        if not index_url:
            try:
                index_url = (
                    self.sdk.config.getConfig("ErisPulse_Dashboard.default_mirror")
                    or None
                )
            except Exception:
                index_url = None
        cmd = self._get_pkg_manager().pip_command("install")
        if force:
            cmd.append("--force-reinstall")
        if index_url:
            cmd.extend(["--index-url", index_url])
        if extra_args:
            cmd.extend(extra_args.split())
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

            last_push = [time.time()]

            def read_pipe(pipe):
                try:
                    for line in iter(pipe.readline, ""):
                        combined_lines.append(line.rstrip())
                        # 行到达即推（800ms 节流），每 20 行兜底推一次；
                        now = time.time()
                        if now - last_push[0] >= 0.8 or len(combined_lines) % 20 == 0:
                            last_push[0] = now
                            self._safe_broadcast(
                                {
                                    "type": "install_progress",
                                    "task_id": task_id,
                                    "status": "running",
                                    "packages": packages,
                                    "output": combined_lines[-10:],
                                }
                            )
                except Exception:
                    pass
                pipe.close()

            def _pip_heartbeat():
                # pip 依赖解析/下载可能长时间零输出：10s 心跳证明任务仍活着
                while proc.poll() is None:
                    self._safe_broadcast(
                        {
                            "type": "install_progress",
                            "task_id": task_id,
                            "status": "running",
                            "packages": packages,
                        }
                    )
                    time.sleep(10)

            hb = threading.Thread(target=_pip_heartbeat, daemon=True)
            hb.start()
            t_out = threading.Thread(target=read_pipe, args=(proc.stdout,))
            t_err = threading.Thread(target=read_pipe, args=(proc.stderr,))
            t_out.start()
            t_err.start()

            # 大包（如 Dashboard 16MB）在国内直连 PyPI 时下载较慢，
            # 超时默认 15 分钟，可用 ErisPulse_Dashboard.install_timeout 配置调整
            timeout_s = 900
            try:
                timeout_s = int(
                    self.sdk.config.getConfig("ErisPulse_Dashboard.install_timeout")
                    or 900
                )
            except Exception:
                pass
            try:
                proc.wait(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                self._install_tasks[task_id]["status"] = "timeout"
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "packages": packages,
                        "message": (
                            f"Install timed out ({timeout_s // 60} min) — "
                            "try selecting a mirror (Tsinghua/Aliyun) in the store"
                        ),
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
                        "packages": packages,
                        "output": combined_lines,
                    }
                )
                self._dynamic_load_new_modules()
                # 升级涉及本模块时不再自动重载：是否应用新版由用户在
                # Dashboard 点击"重启应用"确认（前端 promptDashboardRefresh）
            else:
                self._install_tasks[task_id]["status"] = "error"
                self._install_tasks[task_id]["error"] = "\n".join(combined_lines[-20:])
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "packages": packages,
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
                    "packages": packages,
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
            # 1. 解析该发行名下的模块/适配器入口
            module_targets, adapter_targets = self._resolve_dist_components(package_name)
            # 2. 先停止运行中组件再删文件（unregister 不停止运行，顺序不能反）
            self._detach_dist_components(module_targets, adapter_targets)
            # 3. pip 卸载
            # uv pip uninstall 不支持 -y 参数（本身即为非交互式）
            confirm = [] if pkg_mgr.is_using_uv() else ["-y"]
            cmd = pkg_mgr.pip_command("uninstall", *confirm, package_name)
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if proc.returncode == 0:
                # 4. 取消双侧注册并清理启用状态配置
                self._remove_dist_components(module_targets, adapter_targets)
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
                        "packages": [package_name],
                        "output": proc.stdout.splitlines()[-20:],
                    }
                )
                for name in module_targets:
                    self._safe_broadcast(
                        {
                            "type": "module_changed",
                            "data": {"name": name, "action": "uninstalled"},
                        }
                    )
                for name in adapter_targets:
                    self._safe_broadcast(
                        {
                            "type": "module_changed",
                            "data": {"name": name, "action": "uninstalled"},
                        }
                    )
                if not module_targets and not adapter_targets:
                    self._safe_broadcast(
                        {
                            "type": "module_changed",
                            "data": {"name": package_name, "action": "uninstalled"},
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
                        "packages": [package_name],
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
                    "packages": [package_name],
                    "message": str(e),
                }
            )

    def _run_pip_upgrade(
        self,
        packages: list[str],
        task_id: str,
        index_url: str = None,
        extra_args: str = None,
    ):
        if not index_url:
            try:
                index_url = (
                    self.sdk.config.getConfig("ErisPulse_Dashboard.default_mirror")
                    or None
                )
            except Exception:
                index_url = None
        cmd = self._get_pkg_manager().pip_command("install", "--upgrade")
        # 大包国内直连 PyPI 下载慢：超时默认 15 分钟，可配置（同 install 路径）
        timeout_s = 900
        try:
            timeout_s = int(
                self.sdk.config.getConfig("ErisPulse_Dashboard.install_timeout") or 900
            )
        except Exception:
            pass
        # git 直装没有可比较的版本号变化（pip 按版本号判断是否重装，同版本号的新
        # 提交会被 "already satisfied" 跳过）：强制重装该包本身，--no-deps 避免
        # 连带重装依赖（含运行中的框架自身）
        if any(p.startswith("git+") for p in packages):
            cmd.extend(["--force-reinstall", "--no-deps"])
        if index_url:
            cmd.extend(["--index-url", index_url])
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
        if extra_args:
            cmd.extend(extra_args.split())
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

            last_push = [time.time()]

            def read_pipe(pipe):
                try:
                    for line in iter(pipe.readline, ""):
                        combined_lines.append(line.rstrip())
                        # 行到达即推（800ms 节流），每 20 行兜底推一次；
                        now = time.time()
                        if now - last_push[0] >= 0.8 or len(combined_lines) % 20 == 0:
                            last_push[0] = now
                            self._safe_broadcast(
                                {
                                    "type": "install_progress",
                                    "task_id": task_id,
                                    "status": "running",
                                    "packages": packages,
                                    "output": combined_lines[-10:],
                                }
                            )
                except Exception:
                    pass
                pipe.close()

            def _pip_heartbeat():
                # pip 依赖解析/下载可能长时间零输出：10s 心跳证明任务仍活着
                while proc.poll() is None:
                    self._safe_broadcast(
                        {
                            "type": "install_progress",
                            "task_id": task_id,
                            "status": "running",
                            "packages": packages,
                        }
                    )
                    time.sleep(10)

            hb = threading.Thread(target=_pip_heartbeat, daemon=True)
            hb.start()
            t_out = threading.Thread(target=read_pipe, args=(proc.stdout,))
            t_err = threading.Thread(target=read_pipe, args=(proc.stderr,))
            t_out.start()
            t_err.start()

            try:
                proc.wait(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                self._install_tasks[task_id]["status"] = "timeout"
                self._safe_broadcast(
                    {
                        "type": "install_progress",
                        "task_id": task_id,
                        "status": "error",
                        "packages": packages,
                        "message": (
                            f"Upgrade timed out ({timeout_s // 60} min) — "
                            "try selecting a mirror (Tsinghua/Aliyun) in the store"
                        ),
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
                        "packages": packages,
                        "output": combined_lines,
                    }
                )
                self._get_pkg_manager().invalidate_caches()
                # 从 pip 输出解析实际装上的发行名：git URL 等直装形式无法按传入名
                # 匹配注册组件，须以实际发行名驱动升级后的热重载
                installed_dists = self._parse_installed_dists(combined_lines)
                reload_targets = installed_dists or packages
                # 重载受升级影响的已注册模块（遵守 enabled 状态）
                self._reload_upgraded_registered_modules(reload_targets)
                # 升级涉及本模块时不再自动重载（同上，用户确认制）
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
                        "packages": packages,
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
                    "packages": packages,
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
        extra_args: str = None,
    ):
        # 未显式指定镜像时回落默认镜像源（上传安装同样生效）
        if not index_url:
            try:
                index_url = (
                    self.sdk.config.getConfig("ErisPulse_Dashboard.default_mirror")
                    or None
                )
            except Exception:
                index_url = None
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
            pip_cmd = self._get_pkg_manager().pip_command("install")
            # 覆盖安装（同发行名已存在）必须强制重装：pip 对同版本号会跳过，
            # 本地 whl/zip 的新代码落不了盘；--no-deps 避免连带重装依赖
            target_dist = self._resolve_file_dist_name(file_path, filename)
            if not force and target_dist and self._dist_installed(target_dist):
                pip_cmd.extend(["--force-reinstall", "--no-deps"])
            if force:
                pip_cmd.append("--force-reinstall")
            if index_url:
                pip_cmd.extend(["--index-url", index_url])
            if extra_args:
                pip_cmd.extend(extra_args.split())
            pip_cmd.extend(packages)
            proc = subprocess.Popen(
                pip_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1,
            )
            combined_lines: list[str] = []

            last_push = [time.time()]

            def read_pipe(pipe):
                try:
                    for line in iter(pipe.readline, ""):
                        combined_lines.append(line.rstrip())
                        # 行到达即推（800ms 节流），每 20 行兜底推一次；
                        now = time.time()
                        if now - last_push[0] >= 0.8 or len(combined_lines) % 20 == 0:
                            last_push[0] = now
                            self._safe_broadcast(
                                {
                                    "type": "install_progress",
                                    "task_id": task_id,
                                    "status": "running",
                                    "packages": packages,
                                    "output": combined_lines[-10:],
                                }
                            )
                except Exception:
                    pass
                pipe.close()

            def _pip_heartbeat():
                # pip 依赖解析/下载可能长时间零输出：10s 心跳证明任务仍活着
                while proc.poll() is None:
                    self._safe_broadcast(
                        {
                            "type": "install_progress",
                            "task_id": task_id,
                            "status": "running",
                            "packages": packages,
                        }
                    )
                    time.sleep(10)

            hb = threading.Thread(target=_pip_heartbeat, daemon=True)
            hb.start()
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
                        "packages": [filename],
                        "output": all_lines[-50:],
                    }
                )
                self._dynamic_load_new_modules()
                # 覆盖安装（升级已注册组件）时动态加载只登记新组件，
                # 须按实际安装的发行名重载已有实例
                installed_dists = self._parse_installed_dists(all_lines)
                if installed_dists:
                    self._reload_upgraded_registered_modules(installed_dists)
                # 本地文件安装涉及本模块时同样不自动重载（用户确认制，同远端安装）
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
                        "packages": [filename],
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
                    "packages": [filename],
                    "message": str(e),
                }
            )
        finally:
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass
