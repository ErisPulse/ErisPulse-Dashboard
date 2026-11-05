"""无状态工具与模块级常量（供 Core 包各分区共用）"""

import threading

# 前端语言键 -> 框架 i18n 语言码（框架仅支持 5 语言并按就近原则映射）
VIEW_LANG_KEY_TO_I18N = {
    "zh": "zh-CN",
    "zh-TW": "zh-TW",
    "en": "en",
    "ja": "ja",
    "ru": "ru",
}

# 解析模块视窗 i18n 引用时，需临时切换框架语言，全程加锁保证线程安全
_VIEW_I18N_LOCK = threading.RLock()


class _CoreHelpers:
    """无状态工具函数集合（不依赖实例，供 Main 各分区调用）"""

    @staticmethod
    def _pep440_sort_key(v: str) -> tuple:
        """
        生成 PEP-440 感知的版本排序键（正式版 > rc > beta > alpha > dev）。

        与 packaging.version 行为一致，但容错：无法解析的字符串不会抛异常，
        避免单个异常版本导致整体回退到字典序。

        :param v: str 版本字符串
        :return: tuple 排序键 (数字段列表, 预发布等级, 预发布序号, 原串)
        """
        import re

        s = str(v).lstrip("vV").lower()
        m = re.match(
            r"^(\d+(?:\.\d+)*)(?:[-.]?(dev|a|alpha|b|beta|c|rc|pre|post)(?:[-.]?(\d+))?)?",
            s,
        )
        if not m:
            return ([], 0, 0, s)
        nums = [int(x) for x in m.group(1).split(".")]
        tag = m.group(2)
        pnum = int(m.group(3) or 0) if m.group(3) else 0
        rank = {
            "dev": 0,
            "a": 1,
            "alpha": 1,
            "b": 2,
            "beta": 2,
            "c": 3,
            "rc": 3,
            "pre": 3,
            "post": 5,
        }.get(tag, 4)
        return (nums, rank, pnum, s)

    @staticmethod
    def _display_width(s: str) -> int:
        """计算字符串的显示宽度（CJK 字符算 2 列）"""
        import unicodedata

        w = 0
        for ch in s:
            w += 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1
        return w

    @classmethod
    def _pad_banner(cls, text: str, width: int) -> str:
        """按显示宽度右填充空格，对齐表格边框（兼容 CJK）"""
        pad = width - cls._display_width(text)
        return text + (" " * pad if pad > 0 else "")

    @staticmethod
    def _fmt_uptime(s):
        d, s = divmod(int(s), 86400)
        h, s = divmod(s, 3600)
        m, s = divmod(s, 60)
        if d:
            return f"{d}d {h}h {m}m"
        if h:
            return f"{h}h {m}m"
        if m:
            return f"{m}m {s}s"
        return f"{s}s"

    @staticmethod
    def _packages_contain_dashboard(packages: list[str]) -> bool:
        """判断升级包列表是否包含 Dashboard 自身（兼容 wheel 文件名/带版本号/git URL 形式）"""
        for p in packages or []:
            name = p.split("==", 1)[0].strip().lower().replace("_", "-")
            if name == "erispulse-dashboard" or name.startswith("erispulse-dashboard-"):
                return True
            # git+https://.../ErisPulse-Dashboard(.git) 等直装形式，pip 安装前无法得知项目名
            if name.startswith("git+") and "erispulse-dashboard" in name:
                return True
        return False

    @staticmethod
    def _json_safe(value, _depth: int = 0):
        """深度净化为可 JSON 序列化的结构（拓扑元数据含类对象等）"""
        if _depth > 12:
            return str(value)
        if value is None or isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, dict):
            return {
                str(k): _CoreHelpers._json_safe(v, _depth + 1)
                for k, v in value.items()
            }
        if isinstance(value, (list, tuple, set)):
            return [_CoreHelpers._json_safe(v, _depth + 1) for v in value]
        if isinstance(value, type):
            return getattr(value, "__name__", str(value))
        return str(value)
