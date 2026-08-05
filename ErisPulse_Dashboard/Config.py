"""
Dashboard 配置定义

集中管理 Dashboard 模块自身的配置键与默认值，
与主逻辑（Core.py 的 _load_config）分离。

{!--< tips >!--}
1. 这里是纯数据，不依赖声明式 ConfigClass，兼容旧版本 SDK
2. Dashboard 模块配置存储于配置根下的 "Dashboard" 段
3. 框架级默认配置见 Constants.py 的 DEFAULT_ERISPULSE_CONFIG
{!--< /tips >!--}
"""

# Dashboard 模块自身配置默认值（首次写入配置时使用）
DASHBOARD_DEFAULT_CONFIG = {
    "max_event_log": 500,
}
