"""EventLogMixin：事件 / 日志 / 审计采集、持久化与 WebSocket 广播"""

import asyncio
import time
from collections import deque
from datetime import datetime, timedelta

from fastapi import Request


class EventLogMixin:
    """事件 / 日志 / 审计采集、持久化恢复与 WebSocket 广播。"""


    # ════════════════ 事件 / 日志 / 审计采集与持久化 ════════════════

    def _setup_log_streaming(self):
        """注册日志订阅器，通过 WebSocket 实时推送日志"""
        try:
            self.sdk.logger._register_handler(
                "dashboard_log_stream",
                self._on_log_entry,
                "TRACE",
            )
        except Exception:
            pass

    def _on_log_entry(self, log_data: dict):
        """日志订阅回调，按级别分流到独立缓冲并通过 WebSocket 推送"""
        entry = {
            "timestamp": log_data.get("timestamp", ""),
            "level": log_data.get("level", ""),
            "level_num": log_data.get("level_num", 0),
            "module": log_data.get("module", ""),
            "message": log_data.get("message", ""),
        }
        level_key = (entry["level"] or "UNKNOWN").upper()
        buf = self._log_by_level.get(level_key)
        if buf is None:
            buf = deque(maxlen=self._max_per_level)
            self._log_by_level[level_key] = buf
        buf.append(entry)
        self._logs_dirty = True
        self._safe_broadcast({
            "type": "log_entry",
            "data": entry,
        })

    def _setup_event_interceptors(self):
        _all_events = {
            "core.init.start",
            "core.init.complete",
            "core.uninit.complete",
            "module.register",
            "module.load",
            "module.init",
            "module.unload",
            "adapter.load",
            "adapter.start",
            "adapter.status.change",
            "adapter.stop",
            "adapter.stopped",
            "adapter.event.receive",
            "adapter.event.dispatched",
            "adapter.bot.online",
            "adapter.bot.offline",
            "server.start",
            "server.stop",
            "server.request",
            "server.response",
            "server.websocket.connect",
            "server.websocket.disconnect",
            "event.pre_process",
            "message.sending",
            "message.sent",
            "command.matched",
            "command.executed",
            "config.set",
            "config.updated",
        }

        @self.sdk.adapter.on("*")
        async def log_all_events(data: dict):
            self._add_event_log(data)

        for _ev in _all_events:

            @self.sdk.lifecycle.on(_ev)
            async def _on_lifecycle_event(data: dict, _name=_ev):
                entry = (
                    data
                    if data.get("event")
                    else {
                        "event": _name,
                        "timestamp": time.time(),
                        "data": data,
                        "source": "",
                        "msg": "",
                    }
                )
                self._add_lifecycle_log(entry)
                self._lifecycle_counts[_name] = self._lifecycle_counts.get(_name, 0) + 1

        @self.sdk.lifecycle.on("*")
        async def _lifecycle_catch_all(data: dict):
            event_type = data.get("event")
            if not event_type:
                return
            if event_type in _all_events:
                return
            self._add_lifecycle_log(data)
            self._lifecycle_counts[event_type] = (
                self._lifecycle_counts.get(event_type, 0) + 1
            )

    def _add_event_log(self, data: dict):
        entry = {
            "id": data.get("id", ""),
            "time": data.get("time", time.time()),
            "type": data.get("type", "unknown"),
            "detail_type": data.get("detail_type", ""),
            "platform": data.get("platform", "unknown"),
            "sub_type": data.get("sub_type", ""),
            "self_id": "",
            "user_id": "",
            "group_id": "",
            "alt_message": "",
        }
        self_field = data.get("self")
        if isinstance(self_field, dict):
            entry["self_id"] = str(self_field.get("user_id", ""))
        entry["user_id"] = str(
            data.get("user_id", data.get("sender", {}).get("user_id", ""))
        )
        entry["group_id"] = str(data.get("group_id", ""))
        entry["alt_message"] = data.get("alt_message", data.get("raw_message", ""))
        self._event_log.append(entry)
        self._total_event_count += 1
        if len(self._event_log) > self._max_log:
            self._event_log = self._event_log[-self._max_log :]
        self._events_dirty = True
        asyncio.ensure_future(self._broadcast_event(entry))

    def _add_lifecycle_log(self, data: dict):
        """添加生命周期事件日志（按类型限制数量）"""
        entry = {
            "event": data.get("event", ""),
            "timestamp": data.get("timestamp", time.time()),
            "data": data.get("data", {}),
            "source": data.get("source", ""),
            "msg": data.get("msg", ""),
        }
        self._lifecycle_log.append(entry)

        # 按类型限制：每种类型最多保留 _max_per_type 条
        type_count = {}
        for e in self._lifecycle_log:
            t = e.get("event", "").split(".")[0]  # 取第一段作为类型
            type_count[t] = type_count.get(t, 0) + 1

        # 如果超过总限制，按类型裁剪
        if len(self._lifecycle_log) > self._max_lifecycle_log:
            # 分组保留最新条数
            groups = {}
            for e in self._lifecycle_log:
                t = e.get("event", "").split(".")[0]
                groups.setdefault(t, []).append(e)

            trimmed = []
            for t, items in groups.items():
                trimmed.extend(items[-self._max_per_type :])

            # 按时间排序
            trimmed.sort(key=lambda x: x.get("timestamp", 0))
            self._lifecycle_log = trimmed[-self._max_lifecycle_log :]

    async def _broadcast_event(self, event: dict):
        if not self._ws_clients:
            return
        dead = []
        for ws in self._ws_clients:
            try:
                await ws.send_json({"type": "event", "data": event})
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._ws_clients.remove(ws)

    def _persist_events(self):
        try:
            self.storage.set("__ep_events__", self._event_log[-self._max_log :])
            self._events_dirty = False
        except Exception:
            pass

    def _persist_logs(self):
        try:
            self.storage.set("__ep_logs__", {
                lvl: list(deq) for lvl, deq in self._log_by_level.items() if deq
            })
            self._logs_dirty = False
        except Exception:
            pass

    def _purge_old_logs(self):
        """按保留天数清理过期日志（解析失败的时间戳保留，不误删）"""
        if self._log_retention_days <= 0:
            return
        cutoff = datetime.now() - timedelta(days=self._log_retention_days)
        changed = False
        for lvl, deq in self._log_by_level.items():
            if not deq:
                continue
            kept = deque(maxlen=deq.maxlen)
            for e in deq:
                ts = e.get("timestamp", "")
                try:
                    dt = datetime.strptime(ts[:19], "%Y-%m-%d %H:%M:%S")
                    if dt >= cutoff:
                        kept.append(e)
                    else:
                        changed = True
                except (ValueError, TypeError):
                    kept.append(e)
            if changed:
                deq.clear()
                deq.extend(kept)
        if changed:
            self._logs_dirty = True

    async def _events_flush_loop(self):
        while True:
            await asyncio.sleep(5)
            if self._events_dirty:
                self._persist_events()
            if self._logs_dirty:
                self._purge_old_logs()
                self._persist_logs()

    def _restore_persisted_data(self):
        try:
            events = self.storage.get("__ep_events__")
            if isinstance(events, list):
                self._event_log = events[-self._max_log :]
                self._total_event_count = max(self._total_event_count, len(events))
        except Exception:
            pass
        try:
            logs = self.storage.get("__ep_logs__")
            if isinstance(logs, dict):
                for lvl, entries in logs.items():
                    if not isinstance(entries, list):
                        continue
                    deq = self._log_by_level.get(lvl.upper())
                    if deq is None:
                        deq = deque(maxlen=self._max_per_level)
                        self._log_by_level[lvl.upper()] = deq
                    deq.extend(entries[-self._max_per_level :])
            elif isinstance(logs, list):
                # 兼容最早的单缓冲格式
                for e in logs[-self._max_per_level :]:
                    level_key = (e.get("level") or "UNKNOWN").upper() if isinstance(e, dict) else "UNKNOWN"
                    deq = self._log_by_level.get(level_key)
                    if deq is None:
                        deq = deque(maxlen=self._max_per_level)
                        self._log_by_level[level_key] = deq
                    if isinstance(e, dict):
                        deq.append(e)
        except Exception:
            pass

    def _add_audit_log(
        self, action: str, detail: str = "", request: Request | None = None
    ):
        ip = ""
        if request:
            ip = request.client.host if request.client else ""
            forwarded = request.headers.get("X-Forwarded-For", "")
            if forwarded:
                ip = forwarded.split(",")[0].strip()
        entry = {
            "timestamp": time.time(),
            "action": action,
            "detail": detail,
            "ip": ip,
        }
        self._audit_log.append(entry)
        if len(self._audit_log) > self._max_audit_log:
            self._audit_log = self._audit_log[-self._max_audit_log :]
        self._persist_audit()

    def _persist_audit(self):
        try:
            self.storage.set("__ep_audit__", self._audit_log[-self._max_audit_log :])
        except Exception:
            pass

    def _restore_audit_data(self):
        try:
            logs = self.storage.get("__ep_audit__")
            if isinstance(logs, list):
                self._audit_log = logs[-self._max_audit_log :]
        except Exception:
            pass

    # ════════════════ WebSocket 广播 ════════════════

    async def _broadcast(self, msg: dict):
        if not self._ws_clients:
            return
        dead = []
        for ws in self._ws_clients:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._ws_clients.remove(ws)

    def _safe_broadcast(self, msg: dict):
        if self._loop and not self._loop.is_closed():
            asyncio.run_coroutine_threadsafe(self._broadcast(msg), self._loop)
