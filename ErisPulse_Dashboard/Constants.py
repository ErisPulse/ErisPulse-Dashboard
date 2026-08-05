"""
Dashboard 常量定义

集中管理 ErisPulse Dashboard 模块使用的硬编码常量与框架默认配置，
便于统一维护和修改。

{!--< tips >!--}
1. DEFAULT_ERISPULSE_CONFIG 复用框架 ErisPulse.Core.constants 中的 DEFAULT_* 常量，
   与框架官方默认配置保持一致，勿在此处硬编码魔法值
2. SENSITIVE_FILES / MAX_READ_SIZE / MAX_UPLOAD_SIZE 为文件管理安全限制
3. 修改常量前请仔细阅读注释，确认影响范围
{!--< /tips >!--}
"""

from ErisPulse.Core.constants import (
    DEFAULT_COMMAND_ALLOW_SPACE_PREFIX,
    DEFAULT_COMMAND_CASE_SENSITIVE,
    DEFAULT_COMMAND_MUST_AT_BOT,
    DEFAULT_COMMAND_PREFIX,
    DEFAULT_HANDLER_MAX_CONCURRENCY,
    DEFAULT_I18N_LANGUAGE,
    DEFAULT_LAZY_LOADING_ENABLED,
    DEFAULT_LOG_LEVEL,
    DEFAULT_LOG_MEMORY_LIMIT,
    DEFAULT_MESSAGE_IGNORE_SELF,
    DEFAULT_OFFLINE_BOT_EXPIRY_SECS,
    DEFAULT_PROACTIVE_GC_INTERVAL_SECS,
    DEFAULT_SERVER_AUTO_START,
    DEFAULT_SERVER_HOST,
    DEFAULT_SERVER_PORT,
    DEFAULT_STRICT_MODE,
    DEFAULT_UNINIT_TIMEOUT_SECS,
    DEFAULT_USE_GLOBAL_DB,
)

 
 
 
 
 
DEFAULT_ERISPULSE_CONFIG = {
    "server": {
        "host": DEFAULT_SERVER_HOST,
        "port": DEFAULT_SERVER_PORT,
        "auto_start": DEFAULT_SERVER_AUTO_START,
        "ssl_certfile": None,
        "ssl_keyfile": None,
    },
    "logger": {
        "level": DEFAULT_LOG_LEVEL,
        "format": "rich",
        "log_files": [],
        "memory_limit": DEFAULT_LOG_MEMORY_LIMIT,
    },
    "storage": {
        "use_global_db": DEFAULT_USE_GLOBAL_DB,
    },
    "modules": {},
    "adapters": {},
    "event": {
        "message": {
            "ignore_self": DEFAULT_MESSAGE_IGNORE_SELF,
        },
        "command": {
             
            "prefix": DEFAULT_COMMAND_PREFIX,
            "case_sensitive": DEFAULT_COMMAND_CASE_SENSITIVE,
            "allow_space_prefix": DEFAULT_COMMAND_ALLOW_SPACE_PREFIX,
            "must_at_bot": DEFAULT_COMMAND_MUST_AT_BOT,
        },
    },
     
     
     
    "master": {
        "users": {},
    },
    "framework": {
        "enable_lazy_loading": DEFAULT_LAZY_LOADING_ENABLED,
        "uninit_timeout": DEFAULT_UNINIT_TIMEOUT_SECS,
        "strict_mode": DEFAULT_STRICT_MODE,
        "strict_mode_exceptions": {
            "modules": [],
            "adapters": [],
        },
         
        "handler_max_concurrency": DEFAULT_HANDLER_MAX_CONCURRENCY,
        "proactive_gc_interval": DEFAULT_PROACTIVE_GC_INTERVAL_SECS,
        "offline_bot_expiry": DEFAULT_OFFLINE_BOT_EXPIRY_SECS,
    },
    "i18n": {
        "language": DEFAULT_I18N_LANGUAGE,
    },
}

 
 
 
 
 

 
 
SENSITIVE_FILES = {".env", "credentials.json", "id_rsa", "id_ed25519", ".htpasswd"}

 
 
MAX_READ_SIZE = 2 * 1024 * 1024

 
 
MAX_UPLOAD_SIZE = 50 * 1024 * 1024
