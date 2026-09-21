"""ViewsMixin：模块内嵌视图注册与视图标题多语言解析"""

import secrets

from fastapi import Request

from .Helpers import VIEW_LANG_KEY_TO_I18N, _VIEW_I18N_LOCK


class ViewsMixin:
    """模块内嵌视图注册（对外公开 API）与视图标题 i18n 解析。"""


    # ════════════════ 视图标题 i18n 解析 ════════════════

    def _resolve_view_value(self, value, lang_key: str) -> str:
        """将单个标题/分组标题的值解析为指定前端语言键下的字符串。

        支持三种形态（兼容旧格式）:
        1. {"i18n": key, "default": text} — 框架 i18n 引用（官方格式，随语言解析）
        2. {"<lang>": text, ...}           — 逐语言字典（命中 lang_key 取该值）
        3. 纯字符串 / None                 — 原样返回
        """
        # 逐语言字典
        if isinstance(value, dict) and "i18n" not in value:
            if value.get(lang_key):
                return value[lang_key]
            return value.get("zh") or value.get("en") or ""
        # i18n 引用
        if isinstance(value, dict) and "i18n" in value:
            return self._do_view_i18n_resolve(
                value.get("i18n"), value.get("default"), lang_key
            )
        return value if value is not None else ""

    def _do_view_i18n_resolve(self, key, default, lang_key: str) -> str:
        """通过框架 i18n 在指定语言下解析引用（线程安全，解析后恢复）。"""
        if not key:
            return default or key
        try:
            i18n_obj = self.sdk.i18n
            framework_lang = VIEW_LANG_KEY_TO_I18N.get(lang_key, lang_key)
            with _VIEW_I18N_LOCK:
                prev = i18n_obj.get_language()
                try:
                    i18n_obj.set_language(framework_lang, persist=False)
                    return i18n_obj.t(key, default=default)
                finally:
                    try:
                        i18n_obj.set_language(prev, persist=False)
                    except Exception:
                        pass
        except Exception:
            return default or key

    def _build_view_lang_dict(self, value, primary_en="", fallback="") -> dict:
        """把单个标题/分组标题构建成前端 5 语言字典。

        value 可为: 逐语言字典 / i18n 引用 / 纯字符串。
        未明确提供语言的键，将回退到 primary_en 或 fallback 后再解析。
        """
        out = {}
        for lk in VIEW_LANG_KEY_TO_I18N:
            if isinstance(value, dict) and "i18n" not in value:
                # 逐语言字典：命中取该值，否则回退到 zh -> en -> 兜底
                if value.get(lk):
                    out[lk] = self._resolve_view_value(value[lk], lk)
                else:
                    out[lk] = self._resolve_view_value(
                        value.get("zh") or value.get("en") or fallback, lk
                    )
            elif isinstance(value, dict):
                # i18n 引用：每种语言都按引用解析
                out[lk] = self._resolve_view_value(value, lk)
            else:
                # 纯字符串 / None：非 zh/zh-TW 语言回退到 primary_en 或该字符串
                src = value or fallback
                if lk not in ("zh", "zh-TW"):
                    src = primary_en or src
                out[lk] = self._resolve_view_value(src, lk)
        return out

    # ════════════════ 模块内嵌视图 i18n ════════════════

    def register_view(
        self,
        *,
        id: str,
        title: str = "",
        title_en: str = "",
        titles: dict = None,
        icon_svg: str = "",
        html_content: str = "",
        js_content: str = "",
        css_content: str = "",
        iframe_url: str = "",
        loader: str = "",
        group: str = "group_extensions",
        group_title: str = "",
        group_title_en: str = "",
        group_titles: dict = None,
        **kwargs,
    ) -> bool:
        """注册一个模块管理视窗。

        title / group_title 等文案字段支持三种形态（向后兼容）:
        - 纯字符串（zh/zh-TW 使用 title，其余语言使用 title_en）;
        - 逐语言字典 {"zh": ..., "zh-TW": ..., "en": ..., "ja": ..., "ru": ...};
        - 框架官方 i18n 引用 {"i18n": "MyAdapter.endpoint", "default": "API 地址"},
          会按当前系统语言就近映射，未注册翻译时回退 default。
        """
        if not id:
            self.logger.warning("register_view: id is required")
            return False
        if id in self._registered_views:
            self.logger.warning(
                f"register_view: view '{id}' already registered, overwriting"
            )

        # 构建多语言标题字典
        if titles and isinstance(titles, dict):
            view_titles = self._build_view_lang_dict(titles, title_en, title or id)
        else:
            view_titles = self._build_view_lang_dict(title, title_en, title or id)

        if group_titles and isinstance(group_titles, dict):
            grp_titles = self._build_view_lang_dict(
                group_titles, group_title_en, group_title or ""
            )
        else:
            grp_titles = self._build_view_lang_dict(
                group_title, group_title_en, group_title or ""
            )

        # 保留向后兼容的「主标题」字段（前后端兜底用）
        default_title = view_titles.get("zh") or title or id
        default_title_en = view_titles.get("en") or title_en or default_title
        default_grp = grp_titles.get("zh") or group_title or ""
        default_grp_en = grp_titles.get("en") or group_title_en or default_grp

        view_data = {
            "id": id,
            "title": default_title,
            "title_en": default_title_en,
            "titles": view_titles,
            "icon_svg": icon_svg,
            "html_content": html_content,
            "js_content": js_content,
            "css_content": css_content,
            "iframe_url": iframe_url,
            "loader": loader,
            "group": group,
            "group_title": default_grp,
            "group_title_en": default_grp_en,
            "group_titles": grp_titles,
        }
        self._registered_views[id] = view_data
        self.logger.info(f"Module view registered: {id}")
        self._safe_broadcast(
            {"type": "views_changed", "data": {"action": "register", "id": id}}
        )
        return True

    def unregister_view(self, id: str) -> bool:
        if id not in self._registered_views:
            return False
        del self._registered_views[id]
        self.logger.info(f"Module view unregistered: {id}")
        self._safe_broadcast(
            {"type": "views_changed", "data": {"action": "unregister", "id": id}}
        )
        return True

    def get_registered_views(self) -> list[dict]:
        return list(self._registered_views.values())

    # ════════════════ 认证辅助 ════════════════

    def verify_token(self, token: str) -> bool:
        if not token:
            return False
        return secrets.compare_digest(str(token), self._token)

    def verify_request(self, request: Request) -> bool:
        return self.verify_token(self._get_token_from_request(request))
