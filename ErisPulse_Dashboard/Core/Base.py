"""MainBase：模块生命周期、配置加载与访问令牌"""

import asyncio
import secrets
import time
from collections import deque

from ErisPulse import sdk
from fastapi import WebSocket

from .Cluster import ClusterManager
from .Config import DASHBOARD_DEFAULT_CONFIG
from .I18n import DASHBOARD_BANNER_TEXTS
from .Helpers import _CoreHelpers


class MainBase:
    """Dashboard 主模块基座：状态初始化、生命周期、配置与令牌。"""


    def __init__(self):
        self.sdk = sdk
        self.logger = self.sdk.logger.get_child("Dashboard")
        self.storage = self.sdk.storage
        self.config = self._load_config()
        self._token = self._ensure_token()
        self._ws_clients: list[WebSocket] = []
        self._event_log: list[dict] = []
        self._total_event_count: int = 0
        self._max_log = 500
        self._start_time = time.time()
        self._install_tasks: dict[str, dict] = {}
        self._psutil_mod = None
        self._login_fails = 0
        self._last_login_fail = 0.0
        self._events_dirty = False
        self._pkg_manager = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lifecycle_log: list[dict] = []
        self._max_lifecycle_log = 200
        self._max_per_type = 30  # 每种类型最多保留30条
        self._audit_log: list[dict] = []
        self._max_audit_log = 500
        self._max_per_level = 1000
        self._log_levels = ("TRACE", "DEBUG", "INFO", "EVENT", "WARNING", "ERROR", "CRITICAL")
        self._log_by_level: dict[str, deque] = {
            lvl: deque(maxlen=self._max_per_level) for lvl in self._log_levels
        }
        self._logs_dirty = False
        self._log_retention_days = int(
            self._load_config().get("log_retention_days", 14)
        )
        self._command_rules: dict[str, dict] = {}
        self._command_middleware_func = None
        self._registered_views: dict[str, dict] = {}
        self._cluster: ClusterManager | None = None
        self._lifecycle_counts: dict[str, int] = {}
        self._register_routes()

    @staticmethod
    def get_load_strategy():
        from ErisPulse.loaders import ModuleLoadStrategy

        return ModuleLoadStrategy(lazy_load=False, priority=99999)

    def _get_pkg_manager(self):
        if self._pkg_manager is None:
            from .PackageManager import DashboardPackageManager

            self._pkg_manager = DashboardPackageManager(storage=self.storage)
        return self._pkg_manager

    async def on_load(self, event: dict) -> bool:
        self._loop = asyncio.get_running_loop()
        self._register_i18n()
        self._restore_persisted_data()
        self._purge_old_logs()
        self._restore_audit_data()
        self._load_command_rules()
        self._setup_event_interceptors()
        self._setup_command_middleware()
        self._setup_log_streaming()
        asyncio.create_task(self._events_flush_loop())
        self._cluster = ClusterManager(self.storage, self.logger.get_child("Cluster"))
        asyncio.create_task(self._cluster.start_heartbeat())
        self.logger.info("WebUI module loaded")
        asyncio.create_task(self._show_token_later())
        return True

    def _register_i18n(self):
        """注册 Dashboard 模块的多语言翻译"""
        try:
            i18n = self.sdk.i18n
            domain = "dashboard"
            for lang, texts in DASHBOARD_BANNER_TEXTS.items():
                i18n.register(lang, texts, domain=domain)
        except Exception:
            pass

    async def _show_token_later(self):
        await asyncio.sleep(2)
        i18n = self.sdk.i18n
        title = i18n.t("dashboard.banner.title", default="ErisPulse Dashboard")
        url = i18n.t("dashboard.banner.url", default="URL: /Dashboard")
        token_label = i18n.t("dashboard.banner.token", default="Access Token:")
        is_new = getattr(self, "_token_new", False)
        if is_new:
            saved = i18n.t(
                "dashboard.banner.token_saved",
                default="Token saved to config Dashboard.token",
            )
            token_display = self._token
            extra_line = saved
        else:
            # 用星号脱敏，保持与令牌等长
            token_display = "*" * len(self._token)
            extra_line = i18n.t(
                "dashboard.banner.token_hidden_hint",
                default="Check Dashboard.token in the config file",
            )

        lines = [
            "  " + title,
            "  " + url,
            f"  {token_label} {token_display}",
            "  " + extra_line,
        ]
        # 根据最长行（含前导两空格）动态决定边框宽度，避免超长令牌/翻译溢出
        W = max(_CoreHelpers._display_width(ln) for ln in lines)
        border = "═" * W
        self.logger.warning("")
        self.logger.warning("╔%s╗", border)
        for ln in lines:
            self.logger.warning("║%s║", _CoreHelpers._pad_banner(ln, W))
        self.logger.warning("╚%s╝", border)
        self.logger.warning("")

    async def on_unload(self, event: dict) -> bool:
        if self._cluster:
            await self._cluster.close()
        try:
            self.sdk.logger.remove_handler("dashboard_log_stream")
        except Exception:
            pass
        for ws in self._ws_clients:
            try:
                await ws.close()
            except Exception:
                pass
        self._ws_clients.clear()
        self._unregister_routes()
        self.logger.info("WebUI module unloaded")
        return True

    # ════════════════ 配置与访问令牌 ════════════════

    def _load_config(self):
        config = self.sdk.config.getConfig("Dashboard")
        if not config:
            self.sdk.config.setConfig("Dashboard", DASHBOARD_DEFAULT_CONFIG)
            return DASHBOARD_DEFAULT_CONFIG
        return config

    def _ensure_token(self) -> str:
        token = self.sdk.config.getConfig("Dashboard.token")
        if not token:
            token = secrets.token_urlsafe(32)
            # immediate=True：立即落盘，避免延迟写入导致进程退出后 token 丢失
            self.sdk.config.setConfig("Dashboard.token", token, immediate=True)
            self._token_new = True
        else:
            self._token_new = False
        return str(token)

    def _verify_token(self, provided: str | None) -> bool:
        if not provided:
            return False
        return secrets.compare_digest(
            str(provided).encode("utf-8"), self._token.encode("utf-8")
        )
