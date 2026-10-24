"""ApiTranscriptMixin：会话收件箱（transcript）API

依赖 SDK 的 ``sdk.transcript``（TranscriptManager）。旧 SDK 无该属性时，
全部端点返回 ``{"supported": False}``，前端据此展示能力缺失空态。

会话键格式：``platform:detail_type:target_id``。
"""

from fastapi import Request
from fastapi.responses import JSONResponse

from .Helpers import _CoreHelpers


# 会话列表聚合的默认时间窗（小时）与单会话消息明细的最大条数
_TRANSCRIPT_SESSIONS_DEFAULT_HOURS = 24
_TRANSCRIPT_SESSIONS_MAX_HOURS = 24 * 30
_TRANSCRIPT_SESSIONS_LIMIT = 1000
_TRANSCRIPT_DEFAULT_N = 100
_TRANSCRIPT_MAX_N = 500
# 会话摘要的最大长度（字符）
_TRANSCRIPT_SUMMARY_CHARS = 20


class ApiTranscriptMixin:
    """会话收件箱查询、清空与保留策略 API。"""

    def _get_transcript(self):
        """获取会话收件箱管理器（SDK 无 transcript 能力时返回 None）"""
        return getattr(self.sdk, "transcript", None)

    async def _call_transcript(self, method, *args, **kwargs):
        """
        调用 transcript 方法并统一结果（同步 / 异步实现均兼容）

        {!--< internal-use >!--}
        当前 SDK 的查询方法为同步实现；为兼容潜在的异步签名，awaitable
        结果统一等待后再返回。
        """
        import inspect

        result = method(*args, **kwargs)
        if inspect.isawaitable(result):
            result = await result
        return result

    @staticmethod
    def _split_session_key(key: str) -> dict:
        """{!--< internal-use >!--} 拆解会话键（platform:detail_type:target_id）"""
        parts = str(key or "").split(":", 2)
        return {
            "platform": parts[0] if len(parts) > 0 else "",
            "detail_type": parts[1] if len(parts) > 1 else "",
            "target_id": parts[2] if len(parts) > 2 else "",
        }

    @classmethod
    def _summarize(cls, text: str) -> str:
        """{!--< internal-use >!--} 单行摘要（换行折叠，超长截断）"""
        flat = " ".join(str(text or "").split())
        return flat[:_TRANSCRIPT_SUMMARY_CHARS]

    async def _api_transcript_info(self, request: Request) -> JSONResponse:
        """能力探测 + 配置段读取（enabled / max_per_session / ttl_hours）"""
        tr = self._get_transcript()
        if tr is None:
            return JSONResponse({"supported": False})
        try:
            enabled = bool(tr.enabled)
        except Exception:
            enabled = False
        try:
            retention = await self._call_transcript(tr.get_retention)
        except Exception:
            retention = {}
        if not isinstance(retention, dict):
            retention = {}
        return JSONResponse(
            {
                "supported": True,
                "enabled": enabled,
                "max_per_session": retention.get("max_per_session"),
                "ttl_hours": retention.get("ttl_hours"),
                "overridden": retention.get("overridden", []),
            }
        )

    async def _api_transcript_sessions(self, request: Request) -> JSONResponse:
        """
        聚合时间窗内的会话列表（跨会话全局时间窗为枚举活跃会话的唯一途径）

        按 ``hours`` 查询参数回溯（默认 24，上限 720），对 ``recent()`` 结果
        按会话键聚合出消息数 / 最新时间 / 摘要 / 最后一条 role，按最新时间倒序。
        """
        tr = self._get_transcript()
        if tr is None:
            return JSONResponse({"supported": False})
        try:
            hours = float(request.query_params.get("hours", "") or _TRANSCRIPT_SESSIONS_DEFAULT_HOURS)
        except ValueError:
            hours = _TRANSCRIPT_SESSIONS_DEFAULT_HOURS
        hours = max(0.1, min(hours, _TRANSCRIPT_SESSIONS_MAX_HOURS))
        try:
            rows = await self._call_transcript(
                tr.recent, hours * 3600.0, _TRANSCRIPT_SESSIONS_LIMIT
            )
        except Exception:
            rows = []
        if not isinstance(rows, list):
            rows = []

        sessions: dict[str, dict] = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            key = str(row.get("session_key") or "")
            if not key:
                continue
            ts = float(row.get("ts") or 0.0)
            entry = sessions.get(key)
            if entry is None:
                entry = {
                    "session_key": key,
                    "count": 0,
                    "last_ts": 0.0,
                    "last_text": "",
                    "last_role": "",
                }
                sessions[key] = entry
            entry["count"] += 1
            if ts >= entry["last_ts"]:
                entry["last_ts"] = ts
                entry["last_text"] = str(row.get("text") or "")
                entry["last_role"] = str(row.get("role") or "")

        result = []
        for key, entry in sessions.items():
            info = self._split_session_key(key)
            info.update(
                {
                    "count": entry["count"],
                    "last_ts": entry["last_ts"],
                    "summary": self._summarize(entry["last_text"]),
                    "last_role": entry["last_role"],
                }
            )
            result.append(info)
        result.sort(key=lambda s: s["last_ts"], reverse=True)
        return JSONResponse(
            {"supported": True, "hours": hours, "sessions": result}
        )

    async def _api_transcript_messages(self, request: Request) -> JSONResponse:
        """查询单会话近期消息（时间升序，含 role / text / ts / event_id / sender / meta）"""
        tr = self._get_transcript()
        if tr is None:
            return JSONResponse({"supported": False})
        session = str(request.query_params.get("session", "") or "").strip()
        if not session:
            return JSONResponse({"error": "session is required"}, status_code=400)
        try:
            n = int(request.query_params.get("n", "") or _TRANSCRIPT_DEFAULT_N)
        except ValueError:
            n = _TRANSCRIPT_DEFAULT_N
        n = max(1, min(n, _TRANSCRIPT_MAX_N))
        try:
            messages = await self._call_transcript(tr.get, session, n)
        except Exception:
            messages = []
        if not isinstance(messages, list):
            messages = []
        messages = [m for m in messages if isinstance(m, dict)]
        return JSONResponse(
            {
                "supported": True,
                "session": session,
                "n": n,
                "messages": _CoreHelpers._json_safe(messages),
            }
        )

    async def _api_transcript_trace(self, request: Request) -> JSONResponse:
        """按链路 ID（trace_id / event_id）查询出站记录"""
        tr = self._get_transcript()
        if tr is None:
            return JSONResponse({"supported": False})
        trace_id = str(request.query_params.get("trace_id", "") or "").strip()
        if not trace_id:
            return JSONResponse({"error": "trace_id is required"}, status_code=400)
        try:
            messages = await self._call_transcript(tr.get_by_trace, trace_id, _TRANSCRIPT_DEFAULT_N)
        except Exception:
            messages = []
        if not isinstance(messages, list):
            messages = []
        messages = [m for m in messages if isinstance(m, dict)]
        return JSONResponse(
            {
                "supported": True,
                "trace_id": trace_id,
                "messages": _CoreHelpers._json_safe(messages),
            }
        )

    async def _api_transcript_clear(self, request: Request) -> JSONResponse:
        """清空指定会话的收件箱（记审计 transcript_clear）"""
        tr = self._get_transcript()
        if tr is None:
            return JSONResponse({"error": "transcript not supported"}, status_code=501)
        try:
            body = await request.json()
        except Exception:
            body = {}
        session = str((body or {}).get("session", "") or "").strip()
        if not session:
            return JSONResponse({"error": "session is required"}, status_code=400)
        try:
            removed = await self._call_transcript(tr.clear, session)
        except Exception:
            removed = 0
        self._add_audit_log("transcript_clear", f"{session} removed={removed}", request)
        return JSONResponse({"success": True, "removed": int(removed or 0)})

    async def _api_transcript_retention(self, request: Request) -> JSONResponse:
        """查询当前生效的保留策略"""
        tr = self._get_transcript()
        if tr is None:
            return JSONResponse({"supported": False})
        try:
            retention = await self._call_transcript(tr.get_retention)
        except Exception:
            retention = {}
        if not isinstance(retention, dict):
            retention = {}
        return JSONResponse({"supported": True, "retention": retention})

    async def _api_transcript_retention_set(self, request: Request) -> JSONResponse:
        """
        运行时覆盖保留策略（记审计 transcript_retention）

        覆盖仅驻内存、重启后恢复配置值；``reset=true`` 时清除全部运行时覆盖。
        """
        tr = self._get_transcript()
        if tr is None:
            return JSONResponse({"error": "transcript not supported"}, status_code=501)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        body = body if isinstance(body, dict) else {}

        if body.get("reset"):
            try:
                await self._call_transcript(tr.reset_retention)
            except Exception as e:
                return JSONResponse({"error": str(e)}, status_code=400)
            self._add_audit_log("transcript_retention", "reset", request)
            return JSONResponse({"success": True, "reset": True})

        payload: dict = {}
        if "max_per_session" in body and body.get("max_per_session") is not None:
            try:
                payload["max_per_session"] = int(body["max_per_session"])
            except (TypeError, ValueError):
                return JSONResponse({"error": "max_per_session must be int"}, status_code=400)
        if "ttl_hours" in body and body.get("ttl_hours") is not None:
            try:
                payload["ttl_hours"] = float(body["ttl_hours"])
            except (TypeError, ValueError):
                return JSONResponse({"error": "ttl_hours must be number"}, status_code=400)
        if not payload:
            return JSONResponse({"error": "max_per_session or ttl_hours is required"}, status_code=400)
        try:
            await self._call_transcript(tr.set_retention, **payload)
        except ValueError as e:
            return JSONResponse({"error": str(e)}, status_code=400)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
        try:
            retention = await self._call_transcript(tr.get_retention)
        except Exception:
            retention = {}
        self._add_audit_log(
            "transcript_retention",
            " ".join(f"{k}={v}" for k, v in sorted(payload.items())),
            request,
        )
        return JSONResponse(
            {"success": True, "retention": retention if isinstance(retention, dict) else {}}
        )
