"""
Dashboard 国际化文本定义

集中管理 Dashboard 模块注册到框架 i18n 系统的翻译文本，
与主逻辑（Core.py 的 _register_i18n）分离。

{!--< tips >!--}
1. 这里是纯数据（dict），不依赖声明式 I18nClass，兼容旧版本 SDK
2. 新增语言/文本时同时补充全部 5 种语言（zh-CN / zh-TW / en / ja / ru）
3. domain 统一为 "dashboard"，键格式 "dashboard.xxx"
{!--< /tips >!--}
"""

# 控制台横幅的多语言文本（键为 i18n key，值为对应语言文本）
DASHBOARD_BANNER_TEXTS = {
    "zh-CN": {
        "dashboard.banner.title": "ErisPulse Dashboard",
        "dashboard.banner.url": "访问地址: /Dashboard",
        "dashboard.banner.token": "访问令牌:",
        "dashboard.banner.token_saved": "令牌已保存至配置文件 Dashboard.token",
        "dashboard.banner.token_hidden_hint": "请在 config 配置文件查看 Dashboard.token",
    },
    "zh-TW": {
        "dashboard.banner.title": "ErisPulse Dashboard",
        "dashboard.banner.url": "訪問位址: /Dashboard",
        "dashboard.banner.token": "訪問令牌:",
        "dashboard.banner.token_saved": "令牌已儲存至設定檔 Dashboard.token",
        "dashboard.banner.token_hidden_hint": "請在 config 設定檔查看 Dashboard.token",
    },
    "en": {
        "dashboard.banner.title": "ErisPulse Dashboard",
        "dashboard.banner.url": "URL: /Dashboard",
        "dashboard.banner.token": "Access Token:",
        "dashboard.banner.token_saved": "Token saved to config Dashboard.token",
        "dashboard.banner.token_hidden_hint": "Check Dashboard.token in the config file",
    },
    "ja": {
        "dashboard.banner.title": "ErisPulse Dashboard",
        "dashboard.banner.url": "アクセス先: /Dashboard",
        "dashboard.banner.token": "アクセストークン:",
        "dashboard.banner.token_saved": "トークンは設定ファイル Dashboard.token に保存されました",
        "dashboard.banner.token_hidden_hint": "設定ファイルで Dashboard.token を確認してください",
    },
    "ru": {
        "dashboard.banner.title": "ErisPulse Dashboard",
        "dashboard.banner.url": "Адрес: /Dashboard",
        "dashboard.banner.token": "Токен доступа:",
        "dashboard.banner.token_saved": "Токен сохранён в конфиг Dashboard.token",
        "dashboard.banner.token_hidden_hint": "Проверьте Dashboard.token в файле конфигурации",
    },
}
