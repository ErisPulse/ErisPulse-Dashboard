"""ApiBuilderMixin：事件构建器 API"""

import json

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiBuilderMixin:
    """事件构建器（校验 / 提交 / 事件段）。"""


    async def _api_builder_validate(self, request: Request) -> JSONResponse:
        """验证事件数据"""

        body = await request.json()
        event_type = body.get("type")

        # 事件类型定义
        EVENT_TYPES = {
            "message": {
                "detail_types": [
                    "private",
                    "group",
                    "channel",
                    "guild",
                    "thread",
                    "user",
                ],
                "required_fields": ["message", "alt_message", "user_id"],
                "optional_fields": [
                    "group_id",
                    "channel_id",
                    "guild_id",
                    "user_nickname",
                    "message_id",
                ],
            },
            "notice": {
                "detail_types": [
                    "friend_increase",
                    "friend_decrease",
                    "group_member_increase",
                    "group_member_decrease",
                ],
                "required_fields": ["user_id"],
                "optional_fields": [
                    "user_nickname",
                    "group_id",
                    "operator_id",
                    "operator_nickname",
                ],
            },
            "request": {
                "detail_types": ["friend", "group"],
                "required_fields": ["user_id", "comment"],
                "optional_fields": ["user_nickname", "group_id"],
            },
            "meta": {
                "detail_types": ["connect", "disconnect", "heartbeat"],
                "required_fields": [],
                "optional_fields": [],
            },
        }

        if event_type not in EVENT_TYPES:
            return JSONResponse(
                {"valid": False, "errors": [f"未知的事件类型: {event_type}"]}
            )

        type_def = EVENT_TYPES[event_type]
        errors = []

        # 验证必填字段
        for field in type_def["required_fields"]:
            if field not in body or body[field] is None or body[field] == "":
                errors.append(f"缺少必填字段: {field}")

        # 验证时间戳
        if "time" in body:
            try:
                timestamp = int(body["time"])
                if timestamp < 1000000000 or timestamp > 9999999999:
                    errors.append("时间戳格式不正确（应为 10 位 Unix 时间戳）")
            except (ValueError, TypeError):
                errors.append("时间戳必须是数字")

        return JSONResponse(
            {"valid": len(errors) == 0, "errors": errors, "warnings": []}
        )

    async def _api_builder_submit(self, request: Request) -> JSONResponse:
        """提交构建的事件"""

        body = await request.json()

        # 先验证
        validation = await self._api_builder_validate(request)
        validation_data = (
            validation.body.decode() if hasattr(validation, "body") else {}
        )
        if isinstance(validation_data, str):
            validation_data = json.loads(validation_data)

        if not validation_data.get("valid", False):
            return JSONResponse(
                {"success": False, "errors": validation_data.get("errors", [])},
                status_code=400,
            )

        # 发送事件到适配器系统
        try:
            await self.sdk.adapter.emit(body)
            return JSONResponse({"success": True, "message": "事件已提交"})
        except Exception as e:
            self.logger.error(f"提交事件失败: {e}")
            return JSONResponse({"success": False, "error": str(e)}, status_code=500)

    async def _api_builder_segments(self, request: Request) -> JSONResponse:
        """获取支持的消息段类型"""

        return JSONResponse(
            {
                "standard_segments": [
                    {
                        "type": "text",
                        "name": "文本",
                        "fields": [
                            {"name": "text", "type": "string", "required": True}
                        ],
                    },
                    {
                        "type": "mention",
                        "name": "@用户",
                        "fields": [
                            {"name": "user_id", "type": "string", "required": True},
                            {"name": "user_name", "type": "string", "required": False},
                        ],
                    },
                    {"type": "mention_all", "name": "@全体", "fields": []},
                    {
                        "type": "image",
                        "name": "图片",
                        "fields": [
                            {"name": "file", "type": "string", "required": True}
                        ],
                    },
                    {
                        "type": "reply",
                        "name": "回复",
                        "fields": [
                            {"name": "message_id", "type": "string", "required": True}
                        ],
                    },
                ],
                "platform_segments": {
                    "yunhu": [
                        {
                            "type": "yunhu_form",
                            "name": "表单",
                            "fields": [{"name": "form_id", "type": "string"}],
                        }
                    ],
                    "telegram": [
                        {
                            "type": "telegram_sticker",
                            "name": "贴纸",
                            "fields": [{"name": "file_id", "type": "string"}],
                        }
                    ],
                },
            }
        )
