const API = "/Dashboard",
  TK = "__ep_tk__";
let ws = null,
  allEvents = [],
  _totalEventCount = 0,
  platforms = [],
  authed = false,
  _adapterLogos = {};
let currentNode = "local";
let nodeCapabilities = {};
let nodeRuntimeInfo = {};
let _lastOverview = null;

const _realFetch = window.fetch;
window.fetch = function (input, init) {
  if (
    currentNode !== "local" &&
    typeof input === "string" &&
    input.charAt(0) === "/" &&
    input.charAt(1) !== "/"
  ) {
    if (!input.startsWith(API + "/api/cluster/")) {
      input = API + "/api/cluster/proxy/" + currentNode + input;
    }
  }
  return _realFetch.call(this, input, init);
};

const I18N = {
  zh: {
    dashboard: "仪表盘",
    home_quick: "快捷导航",
    home_add: "添加",
    home_empty: "还没有固定任何项目，点击编辑添加",
    bots: "机器人",
    events: "事件系统",
    modules: "插件管理",
    store: "模块商店",
    config: "配置管理",
    sys_logs: "系统日志",
    logs: "日志",
    lifecycle: "生命周期",
    events_stream: "事件流",
    events_builder: "构建器",
    sys_logs_desc: "查看系统日志与生命周期",
    logs_desc: "查看和过滤系统日志",
    lifecycle_desc: "查看系统启动和运行过程",
    lifecycle_timeline: "生命周期时间轴",
    all_modules: "所有模块",
    search_logs: "搜索日志...",
    no_lifecycle: "暂无生命周期事件",
    log_list: "日志列表",
    api_routes: "API 路由",
    api_routes_desc: "查看所有注册的 HTTP 和 WebSocket 路由",
    http_routes: "HTTP 路由",
    ws_routes: "WebSocket 路由",
    loading: "加载中...",
    online: "在线",
    offline: "离线",
    live: "实时",
    adapters: "适配器",
    modules_label: "模块",
    online_bots: "在线机器人",
    total_events: "事件总数",
    no_adapters: "暂无适配器",
    no_modules: "暂无模块",
    no_events: "暂无事件",
    no_bots: "暂无机器人",
    no_logs: "暂无日志",
    no_http_routes: "暂无 HTTP 路由",
    no_ws_routes: "暂无 WebSocket 路由",
    no_data: "暂无数据",
    requires_auth: "需认证",
    active: "活跃",
    inactive: "未活跃",
    loaded_status: "已加载",
    enable: "启用",
    load: "加载",
    unload: "停止加载",
    install: "安装",
    search_packages: "搜索包...",
    search_modules: "搜索模块...",
    search_config: "搜索配置项...",
    all_status: "所有状态",
    live_events: "实时事件",
    waiting_events: "等待事件...",
    bots_desc: "各平台已发现的机器人",
    events_desc: "事件流查看/构建",
    module: "模块",
    adapter: "适配器",
    modules_desc: "管理已注册的模块和适配器",
    runtime: "运行时",
    runtime_desc: "查看系统运行状态和扩展概览",
    module_mgmt: "模块管理",
    module_mgmt_desc: "管理已注册的模块和适配器",
    store_desc: "浏览并安装包",
    config_desc: "查看和管理配置与存储",
    configuration: "配置",
    storage: "存储",
    auth_title: "身份验证",
    auth_desc_text: "请输入访问令牌以继续",
    auth_label: "访问令牌",
    auth_placeholder: "请输入令牌",
    auth_hint: "令牌存储在配置中的 <code>Dashboard.token</code>",
    login: "登录",
    cancel: "取消",
    ok: "确定",
    setup_title: "欢迎使用 ErisPulse",
    setup_desc:
      "首次使用，请设置您的访问令牌。此令牌将用于保护 Dashboard 的安全访问。",
    setup_token_label: "设置访问令牌",
    setup_token_placeholder: "请输入至少 8 位的令牌",
    setup_token_confirm: "确认令牌",
    setup_token_confirm_placeholder: "请再次输入令牌",
    setup_btn: "开始使用",
    setup_token_mismatch: "两次输入的令牌不一致",
    setup_token_too_short: "令牌长度至少为 8 位",
    logged_in: "登录成功",
    invalid_token: "无效令牌",
    action_completed: "操作完成",
    action_failed: "操作失败",
    installing: "安装中...",
    installed: "安装成功，建议重启框架",
    install_failed: "安装失败",
    install_success: "安装完成",
    install_timeout: "安装超时",
    install_restart_title: "重启加载新模块",
    install_restart_confirm: "模块安装成功，是否立即重启框架以加载新模块？",
    install_restart_btn: "重启",
    install_detail: "安装详情",
    no_token_refresh: "服务未就绪，请稍后刷新",
    unload_self_title: "警告",
    unload_self_confirm:
      "停止加载仪表盘模块后，你将无法再通过网页访问此界面。确定要继续吗？",
    unload_confirm_title: "确认停止加载",
    unload_confirm_text: "确定要停止加载此模块吗？",
    disable_confirm_title: "确认禁用",
    disable_confirm_text: "确定要禁用此模块吗？禁用后模块将无法响应事件。",
    uninstall_confirm_title: "确认卸载",
    uninstall_confirm_text: "确定要卸载此模块吗？这将删除模块包。",
    upload_title: "上传安装",
    upload_desc: "上传 whl 或 zip 包直接安装模块",
    upload_btn: "选择文件并安装",
    uploading: "上传安装中...",
    upload_failed: "上传安装失败",
    restart: "重启框架",
    restart_confirm: "确定要重启框架吗？这将重新加载所有模块和适配器。",
    restart_success: "框架重启中...",
    restart_failed: "重启失败",
    clear_events: "清除事件",
    clear_confirm: "确定要清除所有事件日志吗？",
    all_types: "所有类型",
    all_platforms: "所有平台",
    no_packages: "没有匹配的包",
    failed_registry: "加载注册表失败",
    event_cleared: "事件已清除",
    empty_storage: "存储为空",
    storage_items: "条",
    message: "消息",
    notice: "通知",
    request: "请求",
    meta: "元事件",
    platform: "平台",
    event_builder: "事件构建器",
    event_builder_desc: "构建自定义事件用于调试和测试",
    event_type: "事件类型",
    detail_type: "详情类型",
    platform_info: "平台信息",
    select_platform: "选择平台",
    select_bot: "选择 Bot",
    custom: "自定义",
    select_detail_type: "请选择详情类型...",
    select_platform_placeholder: "请先选择平台...",
    session_type: "会话类型",
    session_id: "会话 ID",
    session_private: "私聊",
    session_group: "群聊",
    session_channel: "频道",
    custom_platform_placeholder: "输入自定义平台名称",
    custom_bot_placeholder: "输入自定义 Bot ID",
    session_id_placeholder: "群号/频道号/用户 ID",
    message_content: "消息内容",
    optional_fields: "附加字段",
    json_preview: "JSON 预览",
    preview: "预览",
    submit_event: "提交事件",
    add_segment: "添加消息段",
    add_field: "添加字段",
    copy_json: "复制 JSON",
    validate_error: "验证错误",
    submit_success: "事件已提交",
    submit_failed: "提交失败",
    view_tree: "树形",
    view_source: "源码",
    reload_config: "重新加载",
    save_config: "保存配置",
    config_saved: "配置已保存",
    config_load_failed: "加载配置源码失败",
    read_only: "只读 (根配置)",
    cpu_usage: "CPU 使用率",
    process_cpu: "进程 CPU",
    cpu_user: "用户态",
    cpu_system: "内核态",
    memory_usage: "内存使用",
    rss_memory: "RSS 内存",
    system_memory: "系统内存",
    system_cpu: "系统 CPU",
    system_total_memory: "系统总内存",
    available_memory: "可用内存",
    swap_memory: "交换内存",
    io_read: "IO 读取",
    io_write: "IO 写入",
    active_connections: "活跃连接",
    system_details: "系统详情",
    view_details: "查看详情",
    cpu_details: "CPU 详情",
    memory_details: "内存详情",
    vms_memory: "VMS 内存",
    system_total: "系统总内存",
    system_available: "可用内存",
    swap_percent: "交换内存使用率",
    instance_info: "实例信息",
    instance_uptime: "运行时长",
    instance_platform: "系统平台",
    instance_pid: "进程 PID",
    instance_threads: "线程数",
    instance_connections: "连接数",
    instance_listening: "监听端口",
    instance_open_files: "打开文件",
    instance_ws_clients: "WS 客户端",
    lifecycle_commands: "命令执行",
    lifecycle_requests: "HTTP 请求",
    websocket: "WebSocket",
    message_stats: "消息统计",
    message_types: "消息类型",
    platform_distribution: "平台分布",
    last_24h_trend: "最近24小时趋势",
    registered_routes: "已注册路由",
    refresh: "刷新",
    copy: "复制",
    auto_refresh: "自动刷新",
    copy_all_logs: "复制所有日志",
    event_preview: "事件预览",
    copied_to_clipboard: "已复制到剪贴板",
    copy_failed: "复制失败",
    save_failed: "保存失败",
    unknown_error: "未知错误",
    validation_failed: "验证失败",
    server_error: "服务器错误",
    connection_error: "无法连接到服务器，请检查网络",
    auto_refresh_off: "自动刷新已关闭",
    auto_refresh_on: "自动刷新已开启",
    alt_message: "备用消息",
    request_comment: "请求附言",
    field_name_placeholder: "字段名",
    field_value_placeholder: "字段值",
    load_segments_first: "请先加载消息段类型",
    test: "测试",
    send: "发送",
    query_params: "Query 参数",
    request_body: "请求体",
    response: "响应",
    click_to_expand_routes: "点击展开查看路由",
    base_path: "基础路径",
    pause_scroll: "暂停滚动",
    resume_scroll: "恢复滚动",
    sort_newest_top: "最新日志在上方",
    sort_newest_bottom: "最新日志在下方",
    force_refresh: "强制刷新",
    audit_log: "审计日志",
    audit_log_desc: "查看系统操作记录",
    all_actions: "所有操作",
    backup_restore: "备份与恢复",
    backup_desc: "导出或导入系统配置和存储数据",
    backup_export: "导出备份",
    backup_import: "导入恢复",
    backup_export_success: "备份已导出",
    backup_import_confirm:
      "导入将覆盖当前配置和存储数据（Dashboard 配置除外）。确定要继续吗？",
    import_success: "恢复成功",
    import_failed: "恢复失败",
    backup_failed: "备份失败",
    audit_clear_confirm: "确定要清空审计日志吗？",
    audit_cleared: "审计日志已清空",
    last_run: "上次执行",
    never: "从未",
    run_count: "执行次数",
    action_load_module: "加载模块",
    action_unload_module: "卸载模块",
    action_load_adapter: "加载适配器",
    action_unload_adapter: "卸载适配器",
    action_config_update: "修改配置",
    action_config_source_save: "保存配置源码",
    action_storage_set: "设置存储",
    action_storage_delete: "删除存储",
    action_package_install: "安装包",
    action_clear_events: "清除事件",
    action_restart_framework: "重启框架",
    action_backup_import: "导入备份",
    files: "文件管理",
    files_desc: "浏览和管理项目文件",
    search_files: "搜索文件...",
    new_file: "新建文件",
    new_folder: "新建文件夹",
    upload: "上传",
    save: "保存",
    upload_success: "上传成功",
    upload_failed: "上传失败",
    upload_drop: "拖拽文件到此处或点击上传",
    file_saved: "文件已保存",
    file_save_failed: "保存失败",
    file_too_large: "文件过大，无法编辑",
    binary_file: "二进制文件，无法编辑",
    file_not_found: "文件未找到",
    folder_exists: "文件夹已存在",
    delete_confirm: "确定要删除选中的文件吗？此操作不可撤销。",
    delete_success: "删除成功",
    delete_failed: "删除失败",
    rename_label: "新名称",
    rename_success: "重命名成功",
    rename_failed: "重命名失败",
    new_file_name: "文件名",
    file_name: "名称",
    file_size: "大小",
    file_perm: "权限",
    file_modified: "修改时间",
    parent_dir: "上级目录",
    toggle_hidden: "显示/隐藏",
    show_hidden: "隐藏项",
    new_folder_name: "文件夹名",
    enable_module: "启用",
    disable_module: "禁用",
    reload_module: "重载",
    uninstall_module: "卸载",
    uninstall_confirm: "确定要卸载此模块吗？这将删除模块包。",
    module_uninstalling: "卸载中...",
    module_version: "版本",
    module_author: "作者",
    module_no_desc: "无描述",
    module_enabled_not_loaded: "已启用未加载",
    module_disabled: "已禁用",
    reload: "重载",
    action_enable_module: "启用模块",
    action_disable_module: "禁用模块",
    action_reload_module: "重载模块",
    action_uninstall_module: "卸载模块",
    search_modules: "搜索模块...",
    module_loaded_dynamic: "模块已动态加载",
    installed_no_restart: "安装完成，模块已自动加载",
    permissions: "权限",
    download: "下载",
    chmod: "修改权限",
    chmod_prompt: "输入权限值（如 755、644）",
    pkg_manager: "包管理",
    pkg_manager_desc: "管理已安装的 Python 包，检查更新并安装新包",
    pkg_installed: "已安装",
    pkg_updates: "可更新",
    pkg_install_new: "安装新包",
    pkg_updates_available: "可用的更新",
    pkg_upgrade_all: "全部更新",
    pkg_install_placeholder: "包名（如 requests 或 numpy==1.24.0）",
    pkg_install_hint:
      "支持输入包名、带版本号（package==version）或多个包用空格分隔",
    pkg_name: "包名",
    pkg_version: "版本",
    pkg_type: "类型",
    pkg_latest: "最新版本",
    pkg_type_module: "模块",
    pkg_type_adapter: "适配器",
    pkg_type_library: "库",
    pkg_no_installed: "未找到已安装的包",
    pkg_no_updates: "所有包均为最新版本",
    pkg_checking_updates: "正在检查更新...",
    pkg_upgrading: "更新中...",
    pkg_upgrade: "更新",
    pkg_upgrade_confirm: "确定要更新以下包吗？",
    pkg_upgrade_all_confirm: "确定要更新所有可更新的包吗？这可能需要一些时间。",
    pkg_uninstall_confirm: "确定要卸载此包吗？这可能导致依赖问题。",
    pkg_cannot_uninstall: "核心包不可卸载",
    pkg_install_success: "包安装完成",
    pkg_upgrade_success: "包更新完成",
    pkg_install_failed: "包安装失败",
    pkg_upgrade_failed: "包更新失败",
    store_version_current: "当前",
    store_version_latest: "最新",
    store_update_available: "有更新",
    action_package_upgrade: "更新包",
    action_package_uninstall: "卸载包",
    upgrade_all: "全部更新",
    module_hub: "模块中心",
    module_hub_desc: "管理模块、浏览商店、管理 Python 包",
    registered: "已注册",
    registered_desc: "管理已注册的模块和适配器",
    compress: "压缩",
    decompress: "解压",
    upload_folder: "上传文件夹",
    task_list: "任务列表",
    cmd_management: "命令管理",
    cmd_management_desc: "管理已注册的命令：别名、平台过滤、启用状态",
    cmd_global_settings: "全局命令设置",
    cmd_prefix: "命令前缀",
    cmd_case_sensitive: "大小写敏感",
    cmd_allow_space_prefix: "允许空前缀",
    cmd_must_at_bot: "必须@Bot",
    cmd_list: "命令列表",
    cmd_enabled: "已启用",
    cmd_disabled: "已禁用",
    cmd_custom_aliases: "自定义别名",
    cmd_alias_placeholder: "输入别名后回车添加",
    cmd_allowed_platforms: "允许的平台",
    cmd_allowed_platforms_hint: "留空表示允许所有平台",
    cmd_blocked_platforms: "禁止的平台",
    cmd_transform_to: "命令转换",
    cmd_transform_placeholder: "留空表示不转换，输入目标命令名将此命令重定向",
    cmd_original_aliases_label: "原始别名",
    cmd_no_commands: "暂无已注册的命令",
    cmd_help: "帮助",
    cmd_usage: "用法",
    cmd_group: "命令组",
    cmd_save_success: "命令规则已保存",
    cmd_save_failed: "保存失败",
    cmd_yes: "是",
    cmd_no: "否",
    cmd_aliases_label: "别名",
    group_overview: "概览",
    group_events: "事件",
    group_extensions: "扩展",
    group_system: "系统",
    group_tools: "工具",
    group_monitoring: "监控",
    group_network: "网络",
    group_config: "配置",
    event_stream: "事件流",
    event_stream_desc: "实时查看系统事件流",
    event_builder_desc: "构建自定义事件用于调试和测试",
    lifecycle_desc: "查看系统启动和运行过程",
    settings_title: "仪表盘设置",
    settings_appearance: "外观",
    settings_appearance_behavior: "外观与行为",
    settings_behavior: "行为",
    settings_theme: "深色主题",
    settings_language: "语言",
    settings_ui_style: "界面风格",
    settings_accent_color: "主题强调色",
    settings_accent_desc: "选择点缀颜色，按钮/链接等会随之变化",
    settings_background: "背景颜色",
    settings_background_desc: "自定义页面背景色",
    settings_custom: "自定义",
    settings_reset: "重置",
    settings_upload_image: "上传图片",
    settings_bg_auto_theme: "从背景自动取色",
    settings_sidebar: "折叠侧边栏",
    settings_show_node_selector: "显示节点选择器",
    settings_show_node_selector_desc: "开启后，仅当配置了远程节点时才会显示",
    settings_remember_groups: "记住导航分组状态",
    settings_remember_groups_desc: "刷新页面后保持导航分组的展开/收起状态",
    settings_refresh_interval: "刷新间隔",
    settings_event_limit: "事件流数量",
    settings_disabled: "关闭",
    settings_restart_desc: "重新加载所有模块和适配器",
    settings_logout: "退出登录",
    settings_logout_desc: "清除令牌并返回登录页",
    settings_page_desc: "自定义仪表盘的外观和行为",
    settings_global_scope: "全局同步",
    settings_global_active: "全局外观已启用，所有用户将看到相同的外观设置",
    settings_layout: "布局",
    settings_system: "系统",
    settings_dash_title: "仪表盘标题",
    settings_dash_title_desc: "设置顶部标题栏文字",
    upload_modal_title: "上传安装",
    upload_drop_hint: "拖拽文件到此处或点击选择",
    force_install: "强制安装",
    force_install_desc: "忽略版本号强制重新安装 (--force-reinstall)",
    start_install: "开始安装",
    pip_mirror: "pip 镜像源",
    install_version: "安装版本",
    latest_version: "最新版本",
    batch_install: "批量安装",
    batch_install_count: "已选择 {n} 个包",
    dependencies: "依赖项",
    version_history: "版本历史",
    no_dependencies: "无外部依赖",
    pkg_detail_loading: "加载详情中...",
    pkg_git_install: "Git 仓库安装",
    pkg_git_install_desc: "从 Git 仓库直接安装模块，无需发布到 PyPI",
    pkg_git_install_placeholder: "git+https://github.com/user/repo.git",
    pkg_git_examples:
      "示例：git+https://github.com/ErisPulse/erispulse-module-demo.git",
    pkg_git_installed: "已安装的 Git 模块",
    pkg_git_no_packages: "暂无 Git 安装的模块",
    pkg_git_update_available: "有可用更新",
    pkg_git_upgrade: "更新",
    pkg_git_url: "仓库地址",
    pkg_detail_failed: "加载详情失败",
    view_detail: "详情",
    upload_complete: "上传完成",
    upload_file_too_large: "文件过大",
    install_with_options: "安装选项",
    status_icons_conn: "连接状态",
    status_conn_disconnected: "未连接",
    status_conn_connected: "已连接",
    status_conn_error: "连接异常",
    expand_all: "展开全部",
    collapse_all: "收起全部",
    group_module_views: "模块视窗",
    module_view_load_error: "模块视窗加载失败",
    framework_config: "框架配置",
    framework_config_desc: "查看和修改 ErisPulse 框架的核心配置",
    restart_required_hint: "⚠ 更新配置后需要重启框架以生效",
    fw_section_server: "服务器",
    fw_section_logger: "日志",
    fw_section_storage: "存储",
    fw_section_event_message: "事件 › 消息",
    fw_section_event_command: "事件 › 命令",
    fw_section_framework: "框架",
    fw_section_i18n: "国际化",
    fw_section_adapters: "适配器",
    fw_section_modules: "模块",
    fw_field_server_host: "监听地址",
    fw_field_server_port: "监听端口",
    fw_field_server_ssl_certfile: "SSL 证书路径，设为 null 禁用 SSL",
    fw_field_server_ssl_keyfile: "SSL 私钥路径",
    fw_field_logger_level: "日志级别：DEBUG / INFO / WARNING / ERROR",
    fw_field_logger_log_files: '日志文件路径，如 ["logs/app.log"]',
    fw_field_logger_memory_limit: "内存中最大日志条数",
    fw_field_storage_use_global_db: "使用跨模块共享的全局数据库",
    fw_field_event_message_ignore_self: "忽略机器人自身发送的消息",
    fw_field_event_command_prefix: "命令触发前缀",
    fw_field_event_command_case_sensitive: "命令是否区分大小写",
    fw_field_event_command_allow_space_prefix: "允许命令前缀前有空格",
    fw_field_event_command_must_at_bot: "需要 @机器人 才能触发命令",
    fw_field_framework_enable_lazy_loading: "启用模块懒加载",
    fw_field_logger_format: "日志格式: rich（彩色终端）/ plain",
    fw_field_framework_uninit_timeout: "反初始化超时时间（秒）",
    fw_field_framework_strict_mode:
      "严格模式：0=宽松 / 1=严格-跳过 / 2=严格-致命",
    fw_field_framework_strict_mode_exceptions: "严格模式豁免清单",
    adapter_config: "适配器配置",
    adapter_config_desc: "管理各平台适配器的连接和账户配置",
    components: "组件",
    components_desc: "管理适配器和模块的配置",
    components_config: "组件配置",
    components_config_desc: "管理适配器和模块的配置",
    ext_config: "扩展配置",
    ext_config_desc: "管理适配器和模块的配置项",
    ext_settings: "扩展设置",
    ext_settings_desc: "管理适配器和模块的个性化配置",
    plugin_config: "插件配置",
    plugin_config_desc: "管理适配器和模块的配置项",
    adapter_global_config: "全局配置",
    adapter_accounts: "账户配置",
    add_account: "添加账户",
    remove_account: "删除账户",
    account_name: "账户名称",
    save_adapter_config: "保存配置",
    no_config_schema: "该适配器未声明配置 Schema（无可用配置项）",
    config_validation_failed: "配置校验失败",
    adapter_config_saved: "适配器配置已保存",
    module_config: "模块配置",
    module_config_desc: "管理各模块的配置项",
    module_config_empty: "暂无模块声明配置 Schema",
    save_module_config: "保存配置",
    module_config_saved: "模块配置已保存",
    account_removed: "账户已删除",
    account_added: "账户已添加",
    show_secret: "显示",
    hide_secret: "隐藏",
    confirm_remove_account: "确认删除此账户？",
    new_account_default_name: "新账户",
    select_adapter_prompt: "请选择一个适配器进行配置",
    adapter_no_adapters: "还没有安装任何适配器喔~",
    fw_version_note: "提示：部分配置在低版本 ErisPulse 中可能不生效",
    fw_server_warn_title: "⚠ 确认修改服务器配置",
    fw_server_warn_text:
      "您正在修改 ErisPulse 服务器连接配置（host/port/ssl）。请确定您在干什么，否则不要修改此处！\n\n在 Docker 容器中操作此项可能导致您无法外部访问 ErisPulse 的 routers。",
    fw_unknown_field: "未知字段",
    fw_win_warn:
      "Windows 将通过新控制台窗口执行更新，完成后请手动重启 ErisPulse",
    fw_cannot_update: "当前环境不支持自动更新",
    fw_popup_msg: "ErisPulse 有新版本 v{latest} 可用",
    fw_unknown_field_desc: "此配置项不属于当前版本的默认配置，建议删除",
    fw_reset_default: "恢复默认",
    fw_reset_confirm: "确认将 {key} 恢复为默认值？",
    fw_reset_done: "已恢复为默认值",
    fw_delete_field: "删除配置",
    fw_delete_confirm: "确认删除配置项 {key}？删除后将使用默认值",
    fw_delete_done: "配置项已删除",
    fw_add_field: "添加配置项",
    fw_add_field_section_hint: "输入分区名（如 server, logger, event.command）",
    fw_add_field_name_hint: "输入字段名",
    fw_add_field_value_hint: "输入值（JSON 或文本）",
    fw_update_title: "框架更新",
    fw_update_title_desc: "查看 ErisPulse 版本更新、发行说明并安装更新",
    release_notes_unavailable: "无法获取发行说明",
    fw_current_version: "当前版本",
    fw_latest_version: "最新版本",
    fw_select_version: "选择版本",
    fw_check_updates: "检查更新",
    fw_install_update: "安装更新",
    fw_latest_already: "已是最新",
    fw_current: "当前",
    fw_downgrade_title: "⚠ 降级确认",
    fw_downgrade_text:
      "您正在将 ErisPulse 降级到 {v}。降级可能导致兼容性问题。确定要继续吗？",
    fw_win_confirm_title: "Windows 更新提示",
    fw_win_confirm_text:
      "Windows 系统会锁定正在运行的文件。<br>将在新控制台窗口中执行更新，完成后请手动重启 ErisPulse。<br><br>是否继续？",
    fw_win_update_started: "新窗口已打开，正在下载更新...",
    fw_pending_restart: "更新完成，请重启框架",
    cluster_management: "集群管理",
    cluster_desc: "添加、编辑、删除远程节点，查看能力对比",
    cluster_overview: "聚合视图",
    cluster_overview_desc: "同时查看所有节点的运行状态",
    node_local: "本地实例",
    node_online: "在线",
    node_offline: "离线",
    node_add: "添加节点",
    node_edit: "编辑",
    node_delete: "删除",
    node_ping: "测试连通",
    node_probe: "重新探测",
    node_id: "节点 ID",
    node_name: "节点名称",
    node_url: "节点地址",
    node_token: "访问令牌",
    node_url_placeholder: "http://192.168.1.100:8000",
    node_token_placeholder: "远程 Dashboard 的 Token",
    node_add_success: "节点添加成功",
    handshake_success: "已自动在远端注册本节点",
    remote_unauthorized: "远端节点认证失败，请检查节点 Token",
    toggle_url_visibility: "显示/隐藏地址",
    node_add_failed: "节点添加失败",
    node_remove_confirm: "确定要移除此节点吗？",
    node_ping_success: "连接成功",
    node_ping_failed: "连接失败",
    leave_empty_to_keep: "留空不修改",
    node_probing: "正在探测节点能力...",
    node_probe_complete: "能力探测完成",
    unsupported_on_node: "该节点不支持此功能",
    unsupported_features: "不支持的功能",
    capability_matrix: "功能对比",
    cluster_card_detail: "详细信息",
    cluster_node_count: "个节点",
    process_memory: "进程内存",
    threads: "线程",
    connections: "连接",
    cap_status: "运行状态",
    cap_status_desc: "查看节点运行状态信息",
    cap_system: "系统信息",
    cap_system_desc: "查看系统资源使用情况",
    cap_adapters: "适配器",
    cap_adapters_desc: "管理和查看消息适配器",
    cap_modules: "模块",
    cap_modules_desc: "查看已注册的功能模块",
    cap_bots: "机器人",
    cap_bots_desc: "管理和查看 Bot 实例",
    cap_events: "事件流",
    cap_events_desc: "实时事件流监控",
    cap_config: "配置",
    cap_config_desc: "查看和修改模块配置",
    cap_storage: "存储",
    cap_storage_desc: "访问键值存储数据",
    cap_store: "商店",
    cap_store_desc: "浏览和安装扩展模块",
    cap_packages: "包管理",
    cap_packages_desc: "管理 Python 依赖包",
    cap_logs: "日志",
    cap_logs_desc: "查看系统和模块日志",
    cap_lifecycle: "生命周期",
    cap_lifecycle_desc: "控制模块启停和重载",
    cap_audit: "审计日志",
    cap_audit_desc: "查看 API 调用审计记录",
    cap_files: "文件管理",
    cap_files_desc: "浏览和管理服务器文件",
    cap_commands: "指令管理",
    cap_commands_desc: "查看和管理注册的指令",
    cap_event_builder: "事件构造器",
    cap_event_builder_desc: "构建和发送自定义事件",
    cap_config_source: "配置来源",
    cap_config_source_desc: "查看配置文件来源",
    cap_module_views: "模块视图",
    cap_module_views_desc: "模块提供的自定义页面",
    cap_performance: "性能",
    cap_performance_desc: "查看性能监控指标",
    cap_routes: "路由",
    cap_routes_desc: "查看已注册的 API 路由",
    cap_message_stats: "消息统计",
    cap_message_stats_desc: "查看消息收发统计",
    cap_framework_update: "框架更新",
    cap_framework_update_desc: "检查和更新 ErisPulse 框架",
    cluster_sync: "事件同步",
    cluster_sync_desc: "将事件从一个节点转发到另一个节点",
    sync_source: "源节点",
    sync_target: "目标节点",
    sync_start: "开始同步",
    sync_success: "同步完成",
    sync_failed: "同步失败",
    latency: "延迟",
    dashboard_version: "Dashboard 版本",
    node_already_exists: "节点 ID 已存在",
    node_not_found: "节点未找到",
    just_now: "刚刚",
    time_ago: "前",
    module_load_mode: "加载模式",
    module_lazy: "懒加载",
    module_eager: "即时加载",
    module_priority: "优先级",
    module_depends: "依赖",
    module_views_count: "注册视窗",
    capability: "能力",
    expand: "展开",
    collapse: "收起",
    store_tag_filter: "标签筛选",
    about: "关于",
    about_tagline: "事件驱动的多平台机器人开发框架",
    about_desc:
      "ErisPulse 是一个开源的 Python 库，目标是提供一个简单、易于使用的框架，用于构建异步、非阻塞的机器人程序。基于 OneBot12 标准接口，一次编写，多平台部署。灵活的插件系统、热重载支持和完整的开发者工具链，适用于从简单聊天机器人到复杂自动化系统的各种场景。",
    about_feat_event_title: "事件驱动架构",
    about_feat_event_desc:
      "基于 OneBot12 标准的清晰事件模型，让消息处理逻辑更加直观和高效",
    about_feat_cross_title: "跨平台兼容",
    about_feat_cross_desc:
      "插件模块编写一次即可在所有平台使用，无需为不同平台重复开发",
    about_feat_module_title: "模块化设计",
    about_feat_module_desc:
      "灵活的插件系统，易于扩展和集成，支持热插拔模块管理",
    about_feat_reload_title: "热重载支持",
    about_feat_reload_desc:
      "开发时无需重启即可重新加载代码，大幅提升开发迭代效率",
    about_star_hint: "喜欢我们的项目的话，就为我们点个 Star 吧~ 这真的很重要！",
    about_contributors: "贡献者",
    about_docs: "文档",
    about_discussions: "社区讨论",
    about_market: "模块市场",
  },
  en: {
    dashboard: "Dashboard",
    home_quick: "Quick Access",
    home_add: "Add",
    home_empty: "Nothing pinned yet — tap edit to add items",
    bots: "Bots",
    events: "Events",
    modules: "Plugins",
    store: "Module Store",
    config: "Configuration",
    sys_logs: "System Logs",
    logs: "Logs",
    lifecycle: "Lifecycle",
    events_stream: "Stream",
    events_builder: "Builder",
    sys_logs_desc: "View system logs and lifecycle events",
    logs_desc: "View and filter system logs",
    lifecycle_desc: "View system startup and runtime process",
    lifecycle_timeline: "Lifecycle Timeline",
    all_modules: "All Modules",
    search_logs: "Search logs...",
    no_lifecycle: "No lifecycle events",
    log_list: "Log List",
    api_routes: "API Routes",
    api_routes_desc: "View all registered HTTP and WebSocket routes",
    http_routes: "HTTP Routes",
    ws_routes: "WebSocket Routes",
    loading: "Loading...",
    online: "Online",
    offline: "Offline",
    live: "Live",
    adapters: "Adapters",
    modules_label: "Modules",
    online_bots: "Online Bots",
    total_events: "Total Events",
    no_adapters: "No adapters",
    no_modules: "No modules",
    no_events: "No events",
    no_bots: "No bots",
    no_logs: "No logs",
    no_http_routes: "No HTTP routes",
    no_ws_routes: "No WebSocket routes",
    no_data: "No data",
    requires_auth: "Auth Required",
    active: "Active",
    inactive: "Inactive",
    loaded_status: "Loaded",
    enable: "Enable",
    load: "Load",
    unload: "Unload",
    install: "Install",
    search_packages: "Search packages...",
    search_modules: "Search modules...",
    search_config: "Search config...",
    all_status: "All Status",
    live_events: "Live Events",
    waiting_events: "Waiting for events...",
    bots_desc: "Discovered bots across platforms",
    events_desc: "Event stream view/builder",
    module: "Module",
    adapter: "Adapter",
    modules_desc: "Manage registered modules and adapters",
    runtime: "Runtime",
    runtime_desc: "View system runtime status and extension overview",
    module_mgmt: "Module Management",
    module_mgmt_desc: "Manage registered modules and adapters",
    store_desc: "Browse and install packages",
    config_desc: "View and manage configuration and storage",
    configuration: "Configuration",
    storage: "Storage",
    auth_title: "Authentication",
    auth_desc_text: "Please enter your access token to continue",
    auth_label: "Access Token",
    auth_placeholder: "Enter your token",
    auth_hint: "Token is stored in config at <code>Dashboard.token</code>",
    login: "Login",
    cancel: "Cancel",
    ok: "OK",
    setup_title: "Welcome to ErisPulse",
    setup_desc:
      "First time here? Please set your access token. This token will be used to secure access to the Dashboard.",
    setup_token_label: "Set Access Token",
    setup_token_placeholder: "Enter at least 8 characters",
    setup_token_confirm: "Confirm Token",
    setup_token_confirm_placeholder: "Enter token again",
    setup_btn: "Get Started",
    setup_token_mismatch: "Tokens do not match",
    setup_token_too_short: "Token must be at least 8 characters",
    logged_in: "Logged in successfully",
    invalid_token: "Invalid token",
    action_completed: "Action completed",
    action_failed: "Action failed",
    installing: "Installing...",
    installed: "Installed! Restart recommended",
    install_failed: "Install failed",
    install_success: "Install complete",
    install_timeout: "Install timed out",
    install_restart_title: "Restart to load new module",
    install_restart_confirm:
      "Module installed successfully. Restart framework now to load it?",
    install_restart_btn: "Restart",
    install_detail: "Install Details",
    no_token_refresh: "Service not ready, please refresh later",
    unload_self_title: "Warning",
    unload_self_confirm:
      "After unloading the dashboard module, you will not be able to access this interface via web. Continue?",
    unload_confirm_title: "Confirm Unload",
    unload_confirm_text: "Are you sure you want to unload this module?",
    disable_confirm_title: "Confirm Disable",
    disable_confirm_text:
      "Are you sure you want to disable this module? It will stop responding to events.",
    uninstall_confirm_title: "Confirm Uninstall",
    uninstall_confirm_text:
      "Are you sure you want to uninstall this module? This will remove the package.",
    upload_title: "Upload Install",
    upload_desc: "Upload a whl or zip package to install module",
    upload_btn: "Select File & Install",
    uploading: "Uploading & Installing...",
    upload_failed: "Upload install failed",
    restart: "Restart",
    restart_confirm:
      "Restart the framework? This will reload all modules and adapters.",
    restart_success: "Restarting framework...",
    restart_failed: "Restart failed",
    clear_events: "Clear Events",
    clear_confirm: "Clear all event logs?",
    all_types: "All Types",
    all_platforms: "All Platforms",
    no_packages: "No matching packages",
    failed_registry: "Failed to load registry",
    event_cleared: "Events cleared",
    empty_storage: "Storage is empty",
    storage_items: "keys",
    message: "Message",
    notice: "Notice",
    request: "Request",
    meta: "Meta",
    platform: "Platform",
    event_builder: "Event Builder",
    event_builder_desc: "Build custom events for debugging and testing",
    event_type: "Event Type",
    detail_type: "Detail Type",
    platform_info: "Platform Info",
    select_platform: "Select Platform",
    select_bot: "Select Bot",
    custom: "Custom",
    select_detail_type: "Select detail type...",
    select_platform_placeholder: "Select a platform first...",
    session_type: "Session Type",
    session_id: "Session ID",
    session_private: "Private",
    session_group: "Group",
    session_channel: "Channel",
    custom_platform_placeholder: "Enter custom platform name",
    custom_bot_placeholder: "Enter custom Bot ID",
    session_id_placeholder: "Group/Channel/User ID",
    message_content: "Message Content",
    optional_fields: "Optional Fields",
    json_preview: "JSON Preview",
    preview: "Preview",
    submit_event: "Submit Event",
    add_segment: "Add Segment",
    add_field: "Add Field",
    copy_json: "Copy JSON",
    validate_error: "Validation error",
    submit_success: "Event submitted",
    submit_failed: "Submit failed",
    view_tree: "Tree",
    view_source: "Source",
    reload_config: "Reload",
    save_config: "Save",
    config_saved: "Configuration saved",
    config_load_failed: "Failed to load config source",
    read_only: "Read-only (root config)",
    cpu_usage: "CPU Usage",
    process_cpu: "Process CPU",
    cpu_user: "User",
    cpu_system: "System",
    memory_usage: "Memory Usage",
    rss_memory: "RSS Memory",
    system_memory: "System Memory",
    system_cpu: "System CPU",
    system_total_memory: "System Total Memory",
    available_memory: "Available Memory",
    swap_memory: "Swap Memory",
    io_read: "I/O Read",
    io_write: "I/O Write",
    active_connections: "Active Connections",
    system_details: "System Details",
    view_details: "View Details",
    cpu_details: "CPU Details",
    memory_details: "Memory Details",
    vms_memory: "VMS Memory",
    system_total: "System Total",
    system_available: "Available Memory",
    swap_percent: "Swap Usage",
    instance_info: "Instance Info",
    instance_uptime: "Uptime",
    instance_platform: "Platform",
    instance_pid: "PID",
    instance_threads: "Threads",
    instance_connections: "Connections",
    instance_listening: "Listening",
    instance_open_files: "Open Files",
    instance_ws_clients: "WS Clients",
    lifecycle_commands: "Commands",
    lifecycle_requests: "HTTP Requests",
    websocket: "WebSocket",
    message_stats: "Message Statistics",
    message_types: "Message Types",
    platform_distribution: "Platform Distribution",
    last_24h_trend: "Last 24 Hours",
    registered_routes: "Registered Routes",
    refresh: "Refresh",
    copy: "Copy",
    auto_refresh: "Auto Refresh",
    copy_all_logs: "Copy All Logs",
    event_preview: "Event Preview",
    copied_to_clipboard: "Copied to clipboard",
    copy_failed: "Copy failed",
    save_failed: "Save failed",
    unknown_error: "Unknown error",
    validation_failed: "Validation failed",
    server_error: "Server error",
    connection_error: "Cannot connect to server, check network",
    auto_refresh_off: "Auto refresh disabled",
    auto_refresh_on: "Auto refresh enabled",
    alt_message: "Alt Message",
    request_comment: "Request Comment",
    field_name_placeholder: "Field Name",
    field_value_placeholder: "Field Value",
    load_segments_first: "Please load segment types first",
    test: "Test",
    send: "Send",
    query_params: "Query Params",
    request_body: "Request Body",
    response: "Response",
    click_to_expand_routes: "Click to view routes",
    base_path: "Base",
    pause_scroll: "Pause scroll",
    resume_scroll: "Resume scroll",
    sort_newest_top: "Newest logs on top",
    sort_newest_bottom: "Newest logs on bottom",
    force_refresh: "Force Refresh",
    audit_log: "Audit Log",
    audit_log_desc: "View system operation records",
    all_actions: "All Actions",
    backup_restore: "Backup & Restore",
    backup_desc: "Export or import system configuration and storage data",
    backup_export: "Export Backup",
    backup_import: "Import Restore",
    backup_export_success: "Backup exported",
    backup_import_confirm:
      "Import will overwrite current config and storage (except Dashboard config). Continue?",
    import_success: "Restore successful",
    import_failed: "Restore failed",
    backup_failed: "Backup failed",
    audit_clear_confirm: "Clear all audit logs?",
    audit_cleared: "Audit logs cleared",
    last_run: "Last Run",
    never: "Never",
    run_count: "Run Count",
    action_load_module: "Load Module",
    action_unload_module: "Unload Module",
    action_load_adapter: "Load Adapter",
    action_unload_adapter: "Unload Adapter",
    action_config_update: "Update Config",
    action_config_source_save: "Save Config Source",
    action_storage_set: "Set Storage",
    action_storage_delete: "Delete Storage",
    action_package_install: "Install Package",
    action_clear_events: "Clear Events",
    action_restart_framework: "Restart Framework",
    action_backup_import: "Import Backup",
    files: "Files",
    files_desc: "Browse and manage project files",
    search_files: "Search files...",
    new_file: "New File",
    new_folder: "New Folder",
    upload: "Upload",
    save: "Save",
    upload_success: "Upload successful",
    upload_failed: "Upload failed",
    upload_drop: "Drop files here or click to upload",
    file_saved: "File saved",
    file_save_failed: "Save failed",
    file_too_large: "File too large to edit",
    binary_file: "Binary file, cannot edit",
    file_not_found: "File not found",
    folder_exists: "Folder already exists",
    delete_confirm: "Delete selected files? This cannot be undone.",
    delete_success: "Deleted",
    delete_failed: "Delete failed",
    rename_label: "New name",
    rename_success: "Renamed",
    rename_failed: "Rename failed",
    new_file_name: "File name",
    file_name: "Name",
    file_size: "Size",
    file_perm: "Perms",
    file_modified: "Modified",
    parent_dir: "Parent",
    toggle_hidden: "Toggle Hidden",
    show_hidden: "Hidden",
    new_folder_name: "Folder name",
    enable_module: "Enable",
    disable_module: "Disable",
    reload_module: "Reload",
    uninstall_module: "Uninstall",
    uninstall_confirm: "Uninstall this module? This will remove the package.",
    module_uninstalling: "Uninstalling...",
    module_version: "Version",
    module_author: "Author",
    module_no_desc: "No description",
    module_enabled_not_loaded: "Enabled",
    module_disabled: "Disabled",
    reload: "Reload",
    action_enable_module: "Enable Module",
    action_disable_module: "Disable Module",
    action_reload_module: "Reload Module",
    action_uninstall_module: "Uninstall Module",
    search_modules: "Search modules...",
    module_loaded_dynamic: "Module loaded dynamically",
    installed_no_restart: "Installed, module auto-loaded",
    permissions: "Permissions",
    download: "Download",
    chmod: "Change Permissions",
    chmod_prompt: "Enter permission (e.g. 755, 644)",
    pkg_manager: "Packages",
    pkg_manager_desc:
      "Manage installed Python packages, check updates and install new ones",
    pkg_installed: "Installed",
    pkg_updates: "Updates",
    pkg_install_new: "Install New",
    pkg_updates_available: "Updates Available",
    pkg_upgrade_all: "Upgrade All",
    pkg_install_placeholder: "Package name (e.g. requests or numpy==1.24.0)",
    pkg_install_hint:
      "Supports package name, with version (package==version), or multiple packages separated by spaces",
    pkg_name: "Package",
    pkg_version: "Version",
    pkg_type: "Type",
    pkg_latest: "Latest",
    pkg_type_module: "Module",
    pkg_type_adapter: "Adapter",
    pkg_type_library: "Library",
    pkg_no_installed: "No installed packages found",
    pkg_no_updates: "All packages are up to date",
    pkg_checking_updates: "Checking for updates...",
    pkg_upgrading: "Upgrading...",
    pkg_upgrade: "Upgrade",
    pkg_upgrade_confirm:
      "Are you sure you want to upgrade the following packages?",
    pkg_upgrade_all_confirm:
      "Are you sure you want to upgrade all outdated packages? This may take a while.",
    pkg_uninstall_confirm:
      "Are you sure you want to uninstall this package? This may cause dependency issues.",
    pkg_cannot_uninstall: "Cannot uninstall core package",
    pkg_install_success: "Package installed",
    pkg_upgrade_success: "Package upgraded",
    pkg_install_failed: "Package install failed",
    pkg_upgrade_failed: "Package upgrade failed",
    store_version_current: "Current",
    store_version_latest: "Latest",
    store_update_available: "Update available",
    action_package_upgrade: "Upgrade Package",
    action_package_uninstall: "Uninstall Package",
    upgrade_all: "Upgrade All",
    module_hub: "Module Hub",
    module_hub_desc: "Manage modules, browse store, manage Python packages",
    registered: "Registered",
    registered_desc: "Manage registered modules and adapters",
    compress: "Compress",
    decompress: "Decompress",
    upload_folder: "Upload Folder",
    task_list: "Task List",
    cmd_management: "Commands",
    cmd_management_desc:
      "Manage registered commands: aliases, platform filters, enable/disable",
    cmd_global_settings: "Global Command Settings",
    cmd_prefix: "Command Prefix",
    cmd_case_sensitive: "Case Sensitive",
    cmd_allow_space_prefix: "Allow Space Prefix",
    cmd_must_at_bot: "Must @Bot",
    cmd_list: "Command List",
    cmd_enabled: "Enabled",
    cmd_disabled: "Disabled",
    cmd_custom_aliases: "Custom Aliases",
    cmd_alias_placeholder: "Enter alias and press Enter",
    cmd_allowed_platforms: "Allowed Platforms",
    cmd_allowed_platforms_hint: "Leave empty to allow all platforms",
    cmd_blocked_platforms: "Blocked Platforms",
    cmd_transform_to: "Command Transform",
    cmd_transform_placeholder:
      "Leave empty for no transform, enter target command name to redirect",
    cmd_original_aliases_label: "Original Aliases",
    cmd_no_commands: "No registered commands",
    cmd_help: "Help",
    cmd_usage: "Usage",
    cmd_group: "Group",
    cmd_save_success: "Command rule saved",
    cmd_save_failed: "Save failed",
    cmd_yes: "Yes",
    cmd_no: "No",
    cmd_aliases_label: "Aliases",
    group_overview: "Overview",
    group_events: "Events",
    group_extensions: "Extensions",
    group_system: "System",
    group_tools: "Tools",
    group_monitoring: "Monitoring",
    group_network: "Network",
    group_config: "Configuration",
    event_stream: "Event Stream",
    event_stream_desc: "View real-time event stream",
    event_builder_desc: "Build custom events for debugging and testing",
    lifecycle_desc: "View system startup and runtime process",
    settings_title: "Dashboard Settings",
    settings_appearance: "Appearance",
    settings_appearance_behavior: "Appearance & Behavior",
    settings_behavior: "Behavior",
    settings_theme: "Dark Theme",
    settings_language: "Language",
    settings_ui_style: "UI Style",
    settings_accent_color: "Accent Color",
    settings_accent_desc:
      "Pick an accent — buttons, links and highlights follow it",
    settings_background: "Background Color",
    settings_background_desc: "Customize the page background",
    settings_custom: "Custom",
    settings_reset: "Reset",
    settings_upload_image: "Upload Image",
    settings_bg_auto_theme: "Auto color from background",
    settings_sidebar: "Collapse Sidebar",
    settings_show_node_selector: "Show Node Selector",
    settings_show_node_selector_desc:
      "When enabled, only shown if remote nodes are configured",
    settings_remember_groups: "Remember nav group state",
    settings_remember_groups_desc:
      "Keep nav groups expanded/collapsed after page refresh",
    settings_refresh_interval: "Refresh Interval",
    settings_event_limit: "Event Limit",
    settings_disabled: "Disabled",
    settings_restart_desc: "Reload all modules and adapters",
    settings_logout: "Sign Out",
    settings_logout_desc: "Clear token and return to login",
    settings_page_desc: "Customize dashboard appearance and behavior",
    settings_global_scope: "Global Sync",
    settings_global_active:
      "Global appearance is enabled — all users see the same look",
    settings_layout: "Layout",
    settings_system: "System",
    settings_dash_title: "Dashboard Title",
    settings_dash_title_desc: "Customize the header title text",
    upload_modal_title: "Upload & Install",
    upload_drop_hint: "Drop file here or click to select",
    force_install: "Force Install",
    force_install_desc:
      "Force reinstall regardless of version (--force-reinstall)",
    start_install: "Start Install",
    pip_mirror: "pip Mirror",
    install_version: "Install Version",
    latest_version: "Latest",
    batch_install: "Batch Install",
    batch_install_count: "{n} packages selected",
    dependencies: "Dependencies",
    version_history: "Version History",
    no_dependencies: "No external dependencies",
    pkg_detail_loading: "Loading details...",
    pkg_detail_failed: "Failed to load details",
    view_detail: "Details",
    pkg_git_install: "Git Install",
    pkg_git_install_desc:
      "Install directly from Git repository, no PyPI needed",
    pkg_git_install_placeholder: "git+https://github.com/user/repo.git",
    pkg_git_examples:
      "Example: git+https://github.com/ErisPulse/erispulse-module-demo.git",
    pkg_git_installed: "Installed Git Modules",
    pkg_git_no_packages: "No Git-installed modules",
    pkg_git_update_available: "Update available",
    pkg_git_upgrade: "Upgrade",
    pkg_git_url: "Repository URL",
    upload_complete: "Upload Complete",
    upload_file_too_large: "File too large",
    install_with_options: "Install Options",
    status_icons_conn: "Connection",
    status_conn_disconnected: "Disconnected",
    status_conn_connected: "Connected",
    status_conn_error: "Connection Error",
    expand_all: "Expand All",
    collapse_all: "Collapse All",
    group_module_views: "Module Views",
    module_view_load_error: "Failed to load module view",
    framework_config: "Framework Config",
    framework_config_desc:
      "View and modify ErisPulse framework core configuration",
    restart_required_hint:
      "⚠ Changes require a framework restart to take effect",
    fw_section_server: "Server",
    fw_section_logger: "Logger",
    fw_section_storage: "Storage",
    fw_section_event_message: "Event › Message",
    fw_section_event_command: "Event › Command",
    fw_section_framework: "Framework",
    fw_section_i18n: "Internationalization",
    fw_section_adapters: "Adapters",
    fw_section_modules: "Modules",
    fw_version_note:
      "Note: Some options may not take effect on older ErisPulse versions",
    fw_server_warn_title: "⚠ Confirm Server Config Change",
    fw_server_warn_text:
      "You are modifying ErisPulse server connection settings (host/port/ssl). Make sure you know what you are doing!\n\nChanging these in a Docker container may make ErisPulse routers inaccessible from outside.",
    fw_unknown_field: "Unknown Field",
    fw_win_warn:
      "Windows will run the update in a new console window. Please restart ErisPulse manually afterwards.",
    fw_cannot_update: "Auto-update is not supported in this environment",
    fw_popup_msg: "ErisPulse v{latest} is now available",
    fw_unknown_field_desc:
      "This config field is not part of the current default config. Consider deleting it.",
    fw_reset_default: "Reset to Default",
    fw_reset_confirm: "Reset {key} to its default value?",
    fw_reset_done: "Reset to default",
    fw_delete_field: "Delete Field",
    fw_delete_confirm: "Delete config field {key}?",
    fw_delete_done: "Config field deleted",
    fw_add_field: "Add Field",
    fw_add_field_section_hint:
      "Section name (e.g. server, logger, event.command)",
    fw_add_field_name_hint: "Field name",
    fw_add_field_value_hint: "Value (JSON or text)",
    fw_update_title: "Framework Update",
    fw_update_title_desc:
      "View version updates, release notes, and install updates",
    release_notes_unavailable: "Failed to fetch release notes",
    fw_current_version: "Current Version",
    fw_latest_version: "Latest Version",
    fw_select_version: "Select Version",
    fw_check_updates: "Check Updates",
    fw_install_update: "Install Update",
    fw_latest_already: "Already latest",
    fw_current: "current",
    fw_downgrade_title: "⚠ Downgrade Confirmation",
    fw_downgrade_text:
      "You are about to downgrade ErisPulse to {v}. Downgrading may cause compatibility issues. Continue?",
    fw_win_confirm_title: "Windows Update Notice",
    fw_win_confirm_text:
      "Windows locks running files.<br>A new console window will perform the update.<br>Please restart ErisPulse manually afterwards.<br><br>Continue?",
    fw_win_update_started: "Update window opened, downloading...",
    fw_pending_restart: "Update complete, please restart",
    fw_field_server_host: "Listen address",
    fw_field_server_port: "Listen port",
    fw_field_server_ssl_certfile:
      "SSL certificate path, set null to disable SSL",
    fw_field_server_ssl_keyfile: "SSL private key path",
    fw_field_logger_level: "Log level: DEBUG / INFO / WARNING / ERROR",
    fw_field_logger_log_files: 'Log file paths, e.g. ["logs/app.log"]',
    fw_field_logger_memory_limit: "Max in-memory log entries",
    fw_field_storage_use_global_db:
      "Use a global database shared across modules",
    fw_field_event_message_ignore_self:
      "Ignore messages sent by the bot itself",
    fw_field_event_command_prefix: "Command trigger prefix",
    fw_field_event_command_case_sensitive:
      "Whether commands are case-sensitive",
    fw_field_event_command_allow_space_prefix:
      "Allow spaces before the command prefix",
    fw_field_event_command_must_at_bot: "Require @bot to trigger commands",
    fw_field_framework_enable_lazy_loading: "Enable lazy-loading of modules",
    fw_field_logger_format: "Log format: rich (colored terminal) / plain",
    fw_field_framework_uninit_timeout: "Uninit timeout (seconds)",
    fw_field_framework_strict_mode:
      "Strict mode: 0=lenient / 1=strict-skip / 2=strict-fatal",
    fw_field_framework_strict_mode_exceptions: "Strict mode exemptions",
    adapter_config: "Adapter Config",
    adapter_config_desc:
      "Manage adapter platform connections and account settings",
    components: "Components",
    components_desc: "Manage adapter and module configurations",
    components_config: "Component Config",
    components_config_desc: "Manage adapter and module configurations",
    ext_config: "Extension Config",
    ext_config_desc: "Manage adapter and module configurations",
    ext_settings: "Extension Settings",
    ext_settings_desc: "Manage adapter and module configurations",
    plugin_config: "Plugin Config",
    plugin_config_desc: "Manage adapter and module configurations",
    adapter_global_config: "Global Config",
    adapter_accounts: "Accounts",
    add_account: "Add Account",
    remove_account: "Remove Account",
    account_name: "Account Name",
    save_adapter_config: "Save Config",
    no_config_schema: "This adapter has no config schema",
    config_validation_failed: "Config validation failed",
    adapter_config_saved: "Adapter config saved",
    module_config: "Module Config",
    module_config_desc: "Manage configuration for each module",
    module_config_empty: "No modules with config schema found",
    save_module_config: "Save Config",
    module_config_saved: "Module config saved",
    account_removed: "Account removed",
    account_added: "Account added",
    show_secret: "Show",
    hide_secret: "Hide",
    confirm_remove_account: "Confirm remove this account?",
    new_account_default_name: "new_account",
    select_adapter_prompt: "Select an adapter to configure",
    adapter_no_adapters: "No adapters installed yet~",
    cluster_management: "Cluster",
    cluster_desc: "Add, edit, remove remote nodes, view capability comparison",
    cluster_overview: "Overview",
    cluster_overview_desc: "View all nodes status at a glance",
    node_local: "Local",
    node_online: "Online",
    node_offline: "Offline",
    node_add: "Add Node",
    node_edit: "Edit",
    node_delete: "Delete",
    node_ping: "Test Connection",
    node_probe: "Re-probe",
    node_id: "Node ID",
    node_name: "Node Name",
    node_url: "Node URL",
    node_token: "Access Token",
    node_url_placeholder: "http://192.168.1.100:8000",
    node_token_placeholder: "Remote Dashboard Token",
    node_add_success: "Node added",
    handshake_success: "Auto-registered this node on remote",
    remote_unauthorized: "Remote node auth failed, check node Token",
    toggle_url_visibility: "Show/Hide URL",
    node_add_failed: "Failed to add node",
    node_remove_confirm: "Remove this node?",
    node_ping_success: "Connected",
    node_ping_failed: "Connection failed",
    leave_empty_to_keep: "leave empty to keep",
    node_probing: "Probing capabilities...",
    node_probe_complete: "Probe complete",
    unsupported_on_node: "Not supported on this node",
    unsupported_features: "Unsupported features",
    capability_matrix: "Capability Matrix",
    cluster_card_detail: "Details",
    cluster_node_count: "node(s)",
    process_memory: "Process",
    threads: "Threads",
    connections: "Conns",
    cap_status: "Status",
    cap_status_desc: "View node runtime status",
    cap_system: "System",
    cap_system_desc: "View system resource usage",
    cap_adapters: "Adapters",
    cap_adapters_desc: "Manage message adapters",
    cap_modules: "Modules",
    cap_modules_desc: "View registered modules",
    cap_bots: "Bots",
    cap_bots_desc: "Manage bot instances",
    cap_events: "Events",
    cap_events_desc: "Real-time event stream",
    cap_config: "Config",
    cap_config_desc: "View and edit module config",
    cap_storage: "Storage",
    cap_storage_desc: "Access key-value storage",
    cap_store: "Store",
    cap_store_desc: "Browse and install extensions",
    cap_packages: "Packages",
    cap_packages_desc: "Manage Python packages",
    cap_logs: "Logs",
    cap_logs_desc: "View system and module logs",
    cap_lifecycle: "Lifecycle",
    cap_lifecycle_desc: "Control module start/stop/reload",
    cap_audit: "Audit",
    cap_audit_desc: "View API call audit trail",
    cap_files: "Files",
    cap_files_desc: "Browse and manage server files",
    cap_commands: "Commands",
    cap_commands_desc: "View and manage registered commands",
    cap_event_builder: "Event Builder",
    cap_event_builder_desc: "Build and send custom events",
    cap_config_source: "Config Source",
    cap_config_source_desc: "View config file sources",
    cap_module_views: "Module Views",
    cap_module_views_desc: "Custom pages from modules",
    cap_performance: "Performance",
    cap_performance_desc: "View performance metrics",
    cap_routes: "Routes",
    cap_routes_desc: "View registered API routes",
    cap_message_stats: "Message Stats",
    cap_message_stats_desc: "View message statistics",
    cap_framework_update: "Framework Update",
    cap_framework_update_desc: "Check and update ErisPulse",
    cluster_sync: "Event Sync",
    cluster_sync_desc: "Forward events between nodes",
    sync_source: "Source",
    sync_target: "Target",
    sync_start: "Start Sync",
    sync_success: "Sync completed",
    sync_failed: "Sync failed",
    latency: "Latency",
    dashboard_version: "Dashboard Version",
    node_already_exists: "Node ID already exists",
    node_not_found: "Node not found",
    just_now: "just now",
    time_ago: "ago",
    module_load_mode: "Load Mode",
    module_lazy: "Lazy",
    module_eager: "Eager",
    module_priority: "Priority",
    module_depends: "Depends On",
    module_views_count: "Views",
    capability: "Capabilities",
    expand: "Expand",
    collapse: "Collapse",
    store_tag_filter: "Tag Filter",
    about: "About",
    about_tagline: "Event-driven multi-platform bot development framework",
    about_desc:
      "ErisPulse is an open-source Python library that aims to provide a simple, easy-to-use framework for building asynchronous, non-blocking bot programs. Based on the OneBot12 standard interface, write once and deploy across multiple platforms. With a flexible plugin system, hot-reload support, and a complete developer toolchain, it is suitable for everything from simple chatbots to complex automation systems.",
    about_feat_event_title: "Event-Driven Architecture",
    about_feat_event_desc:
      "Clear event model based on OneBot12 standard, making message processing logic more intuitive and efficient",
    about_feat_cross_title: "Cross-Platform Compatible",
    about_feat_cross_desc:
      "Write plugin modules once and use them on all platforms, no need for repetitive development",
    about_feat_module_title: "Modular Design",
    about_feat_module_desc:
      "Flexible plugin system, easy to extend and integrate, supports hot-pluggable module management",
    about_feat_reload_title: "Hot Reload Support",
    about_feat_reload_desc:
      "Reload code without restarting during development, greatly improving iteration efficiency",
    about_star_hint:
      "If you like our project, give us a Star~ It really matters!",
    about_contributors: "Contributors",
    about_docs: "Documentation",
    about_discussions: "Discussions",
    about_market: "Module Market",
  },
  "zh-TW": {
    dashboard: "儀表盤",
    home_quick: "快捷導航",
    home_add: "新增",
    home_empty: "尚未固定任何項目，點擊編輯來新增",
    bots: "機器人",
    events: "事件系統",
    modules: "插件管理",
    store: "模組商店",
    config: "配置管理",
    sys_logs: "系統日誌",
    logs: "日誌",
    lifecycle: "生命週期",
    events_stream: "事件流",
    events_builder: "構建器",
    sys_logs_desc: "查看系統日誌與生命週期",
    logs_desc: "查看和過濾系統日誌",
    lifecycle_desc: "查看系統啟動和運行過程",
    lifecycle_timeline: "生命週期時間軸",
    all_modules: "所有模組",
    search_logs: "搜尋日誌...",
    no_lifecycle: "暫無生命週期事件",
    log_list: "日誌列表",
    api_routes: "API 路由",
    api_routes_desc: "查看所有已註冊的 HTTP 和 WebSocket 路由",
    http_routes: "HTTP 路由",
    ws_routes: "WebSocket 路由",
    loading: "載入中...",
    online: "線上",
    offline: "離線",
    live: "即時",
    adapters: "適配器",
    modules_label: "模組",
    online_bots: "線上機器人",
    total_events: "事件總數",
    no_adapters: "暫無適配器",
    no_modules: "暫無模組",
    no_events: "暫無事件",
    no_bots: "暫無機器人",
    no_logs: "暫無日誌",
    no_http_routes: "暫無 HTTP 路由",
    no_ws_routes: "暫無 WebSocket 路由",
    no_data: "暫無資料",
    requires_auth: "需認證",
    active: "活躍",
    inactive: "未活躍",
    loaded_status: "已載入",
    enable: "啟用",
    load: "載入",
    unload: "停止載入",
    install: "安裝",
    search_packages: "搜尋套件...",
    search_modules: "搜尋模組...",
    search_config: "搜尋設定項...",
    all_status: "所有狀態",
    live_events: "即時事件",
    waiting_events: "等待事件...",
    bots_desc: "各平台已發現的機器人",
    events_desc: "事件流查看/構建",
    modules_desc: "管理已註冊的模組和適配器",
    runtime: "運行時",
    runtime_desc: "查看系統運行狀態和擴展概覽",
    module_mgmt: "模組管理",
    module_mgmt_desc: "管理已註冊的模組和適配器",
    store_desc: "瀏覽並安裝套件",
    config_desc: "查看和管理配置與儲存",
    configuration: "配置",
    storage: "儲存",
    auth_title: "身份驗證",
    auth_desc_text: "請輸入訪問令牌以繼續",
    auth_label: "訪問令牌",
    auth_placeholder: "請輸入令牌",
    auth_hint: "令牌儲存在配置中的 <code>Dashboard.token</code>",
    login: "登入",
    cancel: "取消",
    ok: "確定",
    setup_title: "歡迎使用 ErisPulse",
    setup_desc:
      "首次使用，請設定您的訪問令牌。此令牌將用於保護 Dashboard 的安全存取。",
    setup_token_label: "設定訪問令牌",
    setup_token_placeholder: "請輸入至少 8 字元的令牌",
    setup_token_confirm: "確認令牌",
    setup_token_confirm_placeholder: "請再次輸入令牌",
    setup_btn: "開始使用",
    setup_token_mismatch: "兩次輸入的令牌不一致",
    setup_token_too_short: "令牌長度至少為 8 字元",
    logged_in: "登入成功",
    invalid_token: "無效令牌",
    action_completed: "操作完成",
    action_failed: "操作失敗",
    installing: "安裝中...",
    installed: "安裝成功，建議重啟框架",
    install_failed: "安裝失敗",
    install_success: "安裝完成",
    install_timeout: "安裝超時",
    install_restart_title: "重啟載入新模組",
    install_restart_confirm: "模組安裝成功，是否立即重啟框架以載入新模組？",
    install_restart_btn: "重啟",
    install_detail: "安裝詳情",
    no_token_refresh: "服務未就緒，請稍後重新整理",
    unload_self_title: "警告",
    unload_self_confirm:
      "停止載入儀表盤模組後，你將無法再透過網頁訪問此介面。確定要繼續嗎？",
    unload_confirm_title: "確認停止載入",
    unload_confirm_text: "確定要停止載入此模組嗎？",
    disable_confirm_title: "確認禁用",
    disable_confirm_text: "確定要禁用此模組嗎？禁用後模組將無法回應事件。",
    uninstall_confirm_title: "確認卸載",
    uninstall_confirm_text: "確定要卸載此模組嗎？這將刪除模組包。",
    upload_title: "上傳安裝",
    upload_desc: "上傳 whl 或 zip 包直接安裝模組",
    upload_btn: "選擇檔案並安裝",
    uploading: "上傳安裝中...",
    upload_failed: "上傳安裝失敗",
    restart: "重啟框架",
    restart_confirm: "確定要重啟框架嗎？這將重新載入所有模組和適配器。",
    restart_success: "框架重啟中...",
    restart_failed: "重啟失敗",
    clear_events: "清除事件",
    clear_confirm: "確定要清除所有事件日誌嗎？",
    all_types: "所有類型",
    all_platforms: "所有平台",
    no_packages: "沒有符合的套件",
    failed_registry: "載入註冊表失敗",
    event_cleared: "事件已清除",
    empty_storage: "儲存為空",
    storage_items: "條",
    message: "訊息",
    notice: "通知",
    request: "請求",
    meta: "元事件",
    platform: "平台",
    event_builder: "事件構建器",
    event_builder_desc: "構建自定義事件用於除錯和測試",
    event_type: "事件類型",
    detail_type: "詳情類型",
    platform_info: "平台資訊",
    select_platform: "選擇平台",
    select_bot: "選擇 Bot",
    custom: "自定義",
    select_detail_type: "請選擇詳情類型...",
    select_platform_placeholder: "請先選擇平台...",
    session_type: "會話類型",
    session_id: "會話 ID",
    session_private: "私聊",
    session_group: "群聊",
    session_channel: "頻道",
    custom_platform_placeholder: "輸入自定義平台名稱",
    custom_bot_placeholder: "輸入自定義 Bot ID",
    session_id_placeholder: "群號/頻道號/使用者 ID",
    message_content: "訊息內容",
    optional_fields: "附加欄位",
    json_preview: "JSON 預覽",
    preview: "預覽",
    submit_event: "提交事件",
    add_segment: "添加訊息段",
    add_field: "添加欄位",
    copy_json: "複製 JSON",
    validate_error: "驗證錯誤",
    submit_success: "事件已提交",
    submit_failed: "提交失敗",
    view_tree: "樹形",
    view_source: "原始碼",
    reload_config: "重新載入",
    save_config: "儲存配置",
    config_saved: "配置已儲存",
    config_load_failed: "載入配置原始碼失敗",
    read_only: "唯讀 (根配置)",
    cpu_usage: "CPU 使用率",
    process_cpu: "處理程序 CPU",
    cpu_user: "使用者",
    cpu_system: "核心",
    memory_usage: "記憶體使用",
    rss_memory: "RSS 記憶體",
    system_memory: "系統記憶體",
    system_cpu: "系統 CPU",
    system_total_memory: "系統總記憶體",
    available_memory: "可用記憶體",
    swap_memory: "交換記憶體",
    io_read: "IO 讀取",
    io_write: "IO 寫入",
    active_connections: "活躍連線",
    system_details: "系統詳情",
    instance_info: "執行個體資訊",
    instance_uptime: "運行時長",
    instance_platform: "系統平台",
    instance_pid: "處理程序 PID",
    instance_threads: "執行緒數",
    instance_connections: "連線數",
    instance_listening: "監聽埠",
    instance_open_files: "開啟檔案",
    instance_ws_clients: "WS 客戶端",
    lifecycle_commands: "指令執行",
    lifecycle_requests: "HTTP 請求",
    websocket: "WebSocket",
    message_stats: "訊息統計",
    message_types: "訊息類型",
    platform_distribution: "平台分佈",
    last_24h_trend: "最近24小時趨勢",
    registered_routes: "已註冊路由",
    refresh: "重新整理",
    copy: "複製",
    auto_refresh: "自動重新整理",
    copy_all_logs: "複製所有日誌",
    event_preview: "事件預覽",
    copied_to_clipboard: "已複製到剪貼簿",
    copy_failed: "複製失敗",
    save_failed: "儲存失敗",
    unknown_error: "未知錯誤",
    validation_failed: "驗證失敗",
    server_error: "伺服器錯誤",
    connection_error: "無法連接伺服器，請檢查網路",
    auto_refresh_off: "自動重新整理已關閉",
    auto_refresh_on: "自動重新整理已開啟",
    alt_message: "備用訊息",
    request_comment: "請求附言",
    field_name_placeholder: "欄位名",
    field_value_placeholder: "欄位值",
    load_segments_first: "請先載入訊息段類型",
    test: "測試",
    send: "傳送",
    query_params: "Query 參數",
    request_body: "請求體",
    response: "回應",
    click_to_expand_routes: "點擊展開查看路由",
    base_path: "基礎路徑",
    pause_scroll: "暫停滾動",
    resume_scroll: "恢復滾動",
    sort_newest_top: "最新日誌在上方",
    sort_newest_bottom: "最新日誌在下方",
    force_refresh: "強制重新整理",
    audit_log: "審計日誌",
    audit_log_desc: "查看系統操作記錄",
    all_actions: "所有操作",
    backup_restore: "備份與還原",
    backup_desc: "匯出或匯入系統配置和儲存資料",
    backup_export: "匯出備份",
    backup_import: "匯入還原",
    backup_export_success: "備份已匯出",
    backup_import_confirm:
      "匯入將覆蓋當前配置和儲存資料（Dashboard 配置除外）。確定要繼續嗎？",
    import_success: "還原成功",
    import_failed: "還原失敗",
    backup_failed: "備份失敗",
    audit_clear_confirm: "確定要清空審計日誌嗎？",
    audit_cleared: "審計日誌已清空",
    last_run: "上次執行",
    never: "從未",
    run_count: "執行次數",
    action_load_module: "載入模組",
    action_unload_module: "卸載模組",
    action_load_adapter: "載入適配器",
    action_unload_adapter: "卸載適配器",
    action_config_update: "修改配置",
    action_config_source_save: "儲存配置原始碼",
    action_storage_set: "設定儲存",
    action_storage_delete: "刪除儲存",
    action_package_install: "安裝套件",
    action_clear_events: "清除事件",
    action_restart_framework: "重啟框架",
    action_backup_import: "匯入備份",
    files: "檔案管理",
    files_desc: "瀏覽和管理專案檔案",
    search_files: "搜尋檔案...",
    new_file: "新建檔案",
    new_folder: "新建資料夾",
    upload: "上傳",
    save: "儲存",
    upload_success: "上傳成功",
    upload_failed: "上傳失敗",
    upload_drop: "拖拽檔案到此處或點擊上傳",
    file_saved: "檔案已儲存",
    file_save_failed: "儲存失敗",
    file_too_large: "檔案過大，無法編輯",
    binary_file: "二進制檔案，無法編輯",
    file_not_found: "檔案未找到",
    folder_exists: "資料夾已存在",
    delete_confirm: "確定要刪除選中的檔案嗎？此操作不可撤銷。",
    delete_success: "刪除成功",
    delete_failed: "刪除失敗",
    rename_label: "新名稱",
    rename_success: "重新命名成功",
    rename_failed: "重新命名失敗",
    new_file_name: "檔案名",
    file_name: "名稱",
    file_size: "大小",
    file_perm: "權限",
    file_modified: "修改時間",
    parent_dir: "上級目錄",
    toggle_hidden: "顯示/隱藏",
    show_hidden: "隱藏項",
    new_folder_name: "資料夾名",
    enable_module: "啟用",
    disable_module: "禁用",
    reload_module: "重新載入",
    uninstall_module: "卸載",
    uninstall_confirm: "確定要卸載此模組嗎？這將刪除模組包。",
    module_uninstalling: "卸載中...",
    module_version: "版本",
    module_author: "作者",
    module_no_desc: "無描述",
    module_enabled_not_loaded: "已啟用未載入",
    module_disabled: "已禁用",
    reload: "重新載入",
    action_enable_module: "啟用模組",
    action_disable_module: "禁用模組",
    action_reload_module: "重新載入模組",
    action_uninstall_module: "卸載模組",
    search_modules: "搜尋模組...",
    module_loaded_dynamic: "模組已動態載入",
    installed_no_restart: "安裝完成，模組已自動載入",
    permissions: "權限",
    download: "下載",
    chmod: "修改權限",
    chmod_prompt: "輸入權限值（如 755、644）",
    pkg_manager: "套件管理",
    pkg_manager_desc: "管理已安裝的 Python 套件，檢查更新並安裝新套件",
    pkg_installed: "已安裝",
    pkg_updates: "可更新",
    pkg_install_new: "安裝新套件",
    pkg_updates_available: "可用的更新",
    pkg_upgrade_all: "全部更新",
    pkg_install_placeholder: "套件名（如 requests 或 numpy==1.24.0）",
    pkg_install_hint:
      "支援輸入套件名、帶版本號（package==version）或多個套件用空格分隔",
    pkg_name: "套件名",
    pkg_version: "版本",
    pkg_type: "類型",
    pkg_latest: "最新版本",
    pkg_type_module: "模組",
    pkg_type_adapter: "適配器",
    pkg_type_library: "庫",
    pkg_no_installed: "未找到已安裝的套件",
    pkg_no_updates: "所有套件均為最新版本",
    pkg_checking_updates: "正在檢查更新...",
    pkg_upgrading: "更新中...",
    pkg_upgrade: "更新",
    pkg_upgrade_confirm: "確定要更新以下套件嗎？",
    pkg_upgrade_all_confirm:
      "確定要更新所有可更新的套件嗎？這可能需要一些時間。",
    pkg_uninstall_confirm: "確定要卸載此套件嗎？這可能導致依賴問題。",
    pkg_cannot_uninstall: "核心套件不可卸載",
    pkg_install_success: "套件安裝完成",
    pkg_upgrade_success: "套件更新完成",
    pkg_install_failed: "套件安裝失敗",
    pkg_upgrade_failed: "套件更新失敗",
    store_version_current: "當前",
    store_version_latest: "最新",
    store_update_available: "有更新",
    action_package_upgrade: "更新套件",
    action_package_uninstall: "卸載套件",
    upgrade_all: "全部更新",
    module_hub: "模組中心",
    module_hub_desc: "管理模組、瀏覽商店、管理 Python 套件",
    registered: "已註冊",
    registered_desc: "管理已註冊的模組和適配器",
    compress: "壓縮",
    decompress: "解壓",
    upload_folder: "上傳資料夾",
    task_list: "任務列表",
    cmd_management: "命令管理",
    cmd_management_desc: "管理已註冊的命令：別名、平台過濾、啟用狀態",
    cmd_global_settings: "全局命令設定",
    cmd_prefix: "命令前綴",
    cmd_case_sensitive: "大小寫敏感",
    cmd_allow_space_prefix: "允許空前綴",
    cmd_must_at_bot: "必須@Bot",
    cmd_list: "命令列表",
    cmd_enabled: "已啟用",
    cmd_disabled: "已禁用",
    cmd_custom_aliases: "自定義別名",
    cmd_alias_placeholder: "輸入別名後回車添加",
    cmd_allowed_platforms: "允許的平台",
    cmd_allowed_platforms_hint: "留空表示允許所有平台",
    cmd_blocked_platforms: "禁止的平台",
    cmd_transform_to: "命令轉換",
    cmd_transform_placeholder: "留空表示不轉換，輸入目標命令名將此命令重定向",
    cmd_original_aliases_label: "原始別名",
    cmd_no_commands: "暫無已註冊的命令",
    cmd_help: "幫助",
    cmd_usage: "用法",
    cmd_group: "命令組",
    cmd_save_success: "命令規則已儲存",
    cmd_save_failed: "儲存失敗",
    cmd_yes: "是",
    cmd_no: "否",
    cmd_aliases_label: "別名",
    group_overview: "概覽",
    group_events: "事件",
    group_extensions: "擴展",
    group_system: "系統",
    group_tools: "工具",
    group_monitoring: "監控",
    group_network: "網路",
    group_config: "配置",
    event_stream: "事件流",
    event_stream_desc: "即時查看系統事件流",
    event_builder_desc: "構建自定義事件用於除錯和測試",
    lifecycle_desc: "查看系統啟動和運行過程",
    settings_title: "儀表盤設定",
    settings_appearance: "外觀",
    settings_appearance_behavior: "外觀與行為",
    settings_behavior: "行為",
    settings_theme: "深色主題",
    settings_language: "語言",
    settings_ui_style: "介面風格",
    settings_accent_color: "主題強調色",
    settings_accent_desc: "選擇點綴顏色，按鈕/連結等會隨之變化",
    settings_background: "背景顏色",
    settings_background_desc: "自訂頁面背景色",
    settings_custom: "自訂",
    settings_reset: "重設",
    settings_upload_image: "上傳圖片",
    settings_bg_auto_theme: "從背景自動取色",
    settings_sidebar: "摺疊側邊欄",
    settings_show_node_selector: "顯示節點選擇器",
    settings_show_node_selector_desc: "開啟後，僅當配置了遠端節點時才會顯示",
    settings_remember_groups: "記住導航分組狀態",
    settings_remember_groups_desc: "刷新頁面後保持導航分組的展開/收起狀態",
    settings_refresh_interval: "重新整理間隔",
    settings_event_limit: "事件流數量",
    settings_disabled: "關閉",
    settings_restart_desc: "重新載入所有模組和適配器",
    settings_logout: "登出",
    settings_logout_desc: "清除令牌並返回登入頁",
    settings_page_desc: "自訂儀表盤的外觀和行為",
    settings_global_scope: "全域同步",
    settings_global_active: "全域外觀已啟用，所有使用者將看到相同的外觀設定",
    settings_layout: "佈局",
    settings_system: "系統",
    settings_dash_title: "儀表盤標題",
    settings_dash_title_desc: "設定頂部標題欄文字",
    upload_modal_title: "上傳安裝",
    upload_drop_hint: "拖拽檔案到此處或點擊選擇",
    force_install: "強制安裝",
    force_install_desc: "忽略版本號強制重新安裝 (--force-reinstall)",
    start_install: "開始安裝",
    pip_mirror: "pip 鏡像源",
    install_version: "安裝版本",
    latest_version: "最新版本",
    batch_install: "批量安裝",
    batch_install_count: "已選擇 {n} 個套件",
    dependencies: "依賴項",
    version_history: "版本歷史",
    no_dependencies: "無外部依賴",
    pkg_detail_loading: "載入詳情中...",
    pkg_detail_failed: "載入詳情失敗",
    view_detail: "詳情",
    pkg_git_install: "Git 倉庫安裝",
    pkg_git_install_desc: "從 Git 倉庫直接安裝模組，無需發布到 PyPI",
    pkg_git_install_placeholder: "git+https://github.com/user/repo.git",
    pkg_git_examples:
      "範例：git+https://github.com/ErisPulse/erispulse-module-demo.git",
    pkg_git_installed: "已安裝的 Git 模組",
    pkg_git_no_packages: "暫無 Git 安裝的模組",
    pkg_git_update_available: "有可用更新",
    pkg_git_upgrade: "更新",
    pkg_git_url: "倉庫地址",
    upload_complete: "上傳完成",
    upload_file_too_large: "檔案過大",
    install_with_options: "安裝選項",
    status_icons_conn: "連線狀態",
    status_conn_disconnected: "未連線",
    status_conn_connected: "已連線",
    status_conn_error: "連線異常",
    expand_all: "展開全部",
    collapse_all: "收起全部",
    group_module_views: "模組視窗",
    module_view_load_error: "模組視窗載入失敗",
    framework_config: "框架配置",
    framework_config_desc: "查看和修改 ErisPulse 框架的核心配置",
    restart_required_hint: "⚠ 更新配置後需要重啟框架以生效",
    fw_section_server: "伺服器",
    fw_section_logger: "日誌",
    fw_section_storage: "儲存",
    fw_section_event_message: "事件 › 訊息",
    fw_section_event_command: "事件 › 指令",
    fw_section_framework: "框架",
    fw_section_i18n: "國際化",
    fw_section_adapters: "適配器",
    fw_section_modules: "模組",
    fw_field_server_host: "監聽地址",
    fw_field_server_port: "監聽埠",
    fw_field_server_ssl_certfile: "SSL 憑證路徑，設為 null 停用 SSL",
    fw_field_server_ssl_keyfile: "SSL 私鑰路徑",
    fw_field_logger_level: "日誌層級：DEBUG / INFO / WARNING / ERROR",
    fw_field_logger_log_files: '日誌檔案路徑，如 ["logs/app.log"]',
    fw_field_logger_memory_limit: "記憶體中最大日誌條數",
    fw_field_storage_use_global_db: "使用跨模組共享的全域資料庫",
    fw_field_event_message_ignore_self: "忽略機器人自身發送的訊息",
    fw_field_event_command_prefix: "指令觸發前綴",
    fw_field_event_command_case_sensitive: "指令是否區分大小寫",
    fw_field_event_command_allow_space_prefix: "允許指令前綴前有空格",
    fw_field_event_command_must_at_bot: "需要 @機器人才能觸發指令",
    fw_field_framework_enable_lazy_loading: "啟用模組懶載入",
    fw_field_logger_format: "日誌格式: rich（彩色終端）/ plain",
    fw_field_framework_uninit_timeout: "反初始化超時時間（秒）",
    fw_field_framework_strict_mode:
      "嚴格模式：0=寬鬆 / 1=嚴格-跳過 / 2=嚴格-致命",
    fw_field_framework_strict_mode_exceptions: "嚴格模式豁免清單",
    adapter_config: "適配器配置",
    adapter_config_desc: "管理各平台適配器的連接和帳戶配置",
    components: "組件",
    components_desc: "管理適配器和模組的配置",
    components_config: "組件配置",
    components_config_desc: "管理適配器和模組的配置",
    ext_config: "擴展配置",
    ext_config_desc: "管理適配器和模組的配置項",
    ext_settings: "擴展設定",
    ext_settings_desc: "管理適配器和模組的個性化配置",
    plugin_config: "插件配置",
    plugin_config_desc: "管理適配器和模組的配置項",
    adapter_global_config: "全域配置",
    adapter_accounts: "帳戶配置",
    add_account: "新增帳戶",
    remove_account: "刪除帳戶",
    account_name: "帳戶名稱",
    save_adapter_config: "儲存配置",
    no_config_schema: "該適配器未宣告配置 Schema（無可用配置項）",
    config_validation_failed: "配置驗證失敗",
    adapter_config_saved: "適配器配置已儲存",
    module_config: "模組配置",
    module_config_desc: "管理各模組的配置項",
    module_config_empty: "暫無模組宣告配置 Schema",
    save_module_config: "儲存配置",
    module_config_saved: "模組配置已儲存",
    account_removed: "帳戶已刪除",
    account_added: "帳戶已新增",
    confirm_remove_account: "確認刪除此帳戶？",
    new_account_default_name: "新帳戶",
    select_adapter_prompt: "請選擇一個適配器進行配置",
    adapter_no_adapters: "還沒有安裝任何適配器喔~",
    fw_version_note: "提示：部分配置在低版本 ErisPulse 中可能不生效",
    fw_server_warn_title: "⚠ 確認修改伺服器配置",
    fw_server_warn_text:
      "您正在修改 ErisPulse 伺服器連接配置（host/port/ssl）。請確定您在幹什麼，否則不要修改此處！\n\n在 Docker 容器中操作此項可能導致您無法外部存取 ErisPulse 的 routers。",
    fw_unknown_field: "未知欄位",
    fw_win_warn:
      "Windows 系統限制可能導致自動更新失敗，請手動檢查並更新 ErisPulse 框架",
    fw_cannot_update: "當前環境不支援自動更新",
    fw_popup_msg: "ErisPulse 有新版本 v{latest} 可用",
    fw_unknown_field_desc: "此配置項不屬於當前版本的默認配置，建議刪除",
    fw_reset_default: "恢復默認",
    fw_reset_confirm: "確認將 {key} 恢復為默認值？",
    fw_reset_done: "已恢復為默認值",
    fw_delete_field: "刪除配置",
    fw_delete_confirm: "確認刪除配置項 {key}？刪除後將使用默認值",
    fw_delete_done: "配置項已刪除",
    fw_add_field: "添加配置項",
    fw_add_field_section_hint: "輸入分區名（如 server, logger, event.command）",
    fw_add_field_name_hint: "輸入欄位名",
    fw_add_field_value_hint: "輸入值（JSON 或文字）",
    fw_update_title: "框架更新",
    fw_update_title_desc: "查看 ErisPulse 版本更新、發行說明並安裝更新",
    release_notes_unavailable: "無法獲取發行說明",
    fw_current_version: "當前版本",
    fw_latest_version: "最新版本",
    fw_select_version: "選擇版本",
    fw_check_updates: "檢查更新",
    fw_install_update: "安裝更新",
    fw_latest_already: "已是最新",
    fw_current: "當前",
    fw_downgrade_title: "⚠ 降級確認",
    fw_downgrade_text:
      "您正在將 ErisPulse 降級到 {v}。降級可能導致相容性問題。確定要繼續嗎？",
    cluster_management: "集群管理",
    cluster_desc: "新增、編輯、刪除遠端節點，查看能力對比",
    cluster_overview: "聚合視圖",
    cluster_overview_desc: "同時查看所有節點的運行狀態",
    node_local: "本地實例",
    node_online: "在線",
    node_offline: "離線",
    node_add: "新增節點",
    node_edit: "編輯",
    node_delete: "刪除",
    node_ping: "測試連通",
    node_probe: "重新探測",
    node_id: "節點 ID",
    node_name: "節點名稱",
    node_url: "節點地址",
    node_token: "存取令牌",
    node_url_placeholder: "http://192.168.1.100:8000",
    node_token_placeholder: "遠端 Dashboard 的 Token",
    node_add_success: "節點新增成功",
    handshake_success: "已自動在遠端註冊本節點",
    remote_unauthorized: "遠端節點認證失敗，請檢查節點 Token",
    toggle_url_visibility: "顯示/隱藏位址",
    node_add_failed: "節點新增失敗",
    node_remove_confirm: "確定要移除此節點嗎？",
    node_ping_success: "連接成功",
    node_ping_failed: "連接失敗",
    leave_empty_to_keep: "留空不修改",
    node_probing: "正在探測節點能力...",
    node_probe_complete: "能力探測完成",
    unsupported_on_node: "該節點不支持此功能",
    unsupported_features: "不支持的功能",
    capability_matrix: "功能對比",
    cluster_card_detail: "詳細資訊",
    cluster_node_count: "個節點",
    process_memory: "處理序記憶體",
    threads: "執行緒",
    connections: "連線",
    cap_status: "運行狀態",
    cap_status_desc: "查看節點運行狀態資訊",
    cap_system: "系統資訊",
    cap_system_desc: "查看系統資源使用情況",
    cap_adapters: "適配器",
    cap_adapters_desc: "管理和查看訊息適配器",
    cap_modules: "模組",
    cap_modules_desc: "查看已註冊的功能模組",
    cap_bots: "機器人",
    cap_bots_desc: "管理和查看 Bot 實例",
    cap_events: "事件流",
    cap_events_desc: "即時事件流監控",
    cap_config: "配置",
    cap_config_desc: "查看和修改模組配置",
    cap_storage: "儲存",
    cap_storage_desc: "存取鍵值儲存資料",
    cap_store: "商店",
    cap_store_desc: "瀏覽和安裝擴展模組",
    cap_packages: "套件管理",
    cap_packages_desc: "管理 Python 依賴套件",
    cap_logs: "日誌",
    cap_logs_desc: "查看系統和模組日誌",
    cap_lifecycle: "生命週期",
    cap_lifecycle_desc: "控制模組啟停和重載",
    cap_audit: "審計日誌",
    cap_audit_desc: "查看 API 呼叫審計記錄",
    cap_files: "檔案管理",
    cap_files_desc: "瀏覽和管理伺服器檔案",
    cap_commands: "指令管理",
    cap_commands_desc: "查看和管理註冊的指令",
    cap_event_builder: "事件建構器",
    cap_event_builder_desc: "建構和發送自訂事件",
    cap_config_source: "配置來源",
    cap_config_source_desc: "查看配置檔案來源",
    cap_module_views: "模組視圖",
    cap_module_views_desc: "模組提供的自訂頁面",
    cap_performance: "效能",
    cap_performance_desc: "查看效能監控指標",
    cap_routes: "路由",
    cap_routes_desc: "查看已註冊的 API 路由",
    cap_message_stats: "訊息統計",
    cap_message_stats_desc: "查看訊息收發統計",
    cap_framework_update: "框架更新",
    cap_framework_update_desc: "檢查和更新 ErisPulse 框架",
    cluster_sync: "事件同步",
    cluster_sync_desc: "將事件從一個節點轉發到另一個節點",
    sync_source: "源節點",
    sync_target: "目標節點",
    sync_start: "開始同步",
    sync_success: "同步完成",
    sync_failed: "同步失敗",
    latency: "延遲",
    dashboard_version: "Dashboard 版本",
    node_already_exists: "節點 ID 已存在",
    node_not_found: "節點未找到",
    just_now: "剛剛",
    time_ago: "前",
    module_load_mode: "加載模式",
    module_lazy: "懶加載",
    module_eager: "即時加載",
    module_priority: "優先級",
    module_depends: "依賴",
    module_views_count: "註冊視窗",
    capability: "能力",
    about: "關於",
    about_tagline: "事件驅動的多平台機器人開發框架",
    about_desc:
      "ErisPulse 是一個開源的 Python 函式庫，目標是提供一個簡單、易於使用的框架，用於構建非同步、非阻塞的機器人程式。基於 OneBot12 標準介面，一次編寫，多平台部署。靈活的外掛系統、熱重載支援和完整的開發者工具鏈，適用於從簡單聊天機器人到複雜自動化系統的各種場景。",
    about_feat_event_title: "事件驅動架構",
    about_feat_event_desc:
      "基於 OneBot12 標準的清晰事件模型，讓訊息處理邏輯更加直觀和高效",
    about_feat_cross_title: "跨平台相容",
    about_feat_cross_desc:
      "外掛模組編寫一次即可在所有平台使用，無需為不同平台重複開發",
    about_feat_module_title: "模組化設計",
    about_feat_module_desc:
      "靈活的外掛系統，易於擴展和整合，支援熱插拔模組管理",
    about_feat_reload_title: "熱重載支援",
    about_feat_reload_desc:
      "開發時無需重新啟動即可重新載入程式碼，大幅提升開發迭代效率",
    about_star_hint: "喜歡我們的話，就為我們點個 Star 吧~ 這真的很重要！",
    about_contributors: "貢獻者",
    about_docs: "文件",
    about_discussions: "社群討論",
    about_market: "模組市場",
  },
  ja: {
    dashboard: "ダッシュボード",
    home_quick: "クイックアクセス",
    home_add: "追加",
    home_empty: "まだピン留めされていません。編集から追加できます",
    bots: "ボット",
    events: "イベント",
    modules: "プラグイン",
    store: "モジュールストア",
    config: "設定",
    sys_logs: "システムログ",
    logs: "ログ",
    lifecycle: "ライフサイクル",
    events_stream: "ストリーム",
    events_builder: "ビルダー",
    sys_logs_desc: "システムログとライフサイクルイベントを表示",
    logs_desc: "システムログの表示とフィルタリング",
    lifecycle_desc: "システムの起動と実行プロセスを表示",
    lifecycle_timeline: "ライフサイクルタイムライン",
    all_modules: "すべてのモジュール",
    search_logs: "ログを検索...",
    no_lifecycle: "ライフサイクルイベントなし",
    log_list: "ログリスト",
    api_routes: "APIルート",
    api_routes_desc: "登録済みのHTTPおよびWebSocketルートを表示",
    http_routes: "HTTPルート",
    ws_routes: "WebSocketルート",
    loading: "読み込み中...",
    online: "オンライン",
    offline: "オフライン",
    live: "ライブ",
    adapters: "アダプタ",
    modules_label: "モジュール",
    online_bots: "オンラインボット",
    total_events: "イベント総数",
    no_adapters: "アダプタなし",
    no_modules: "モジュールなし",
    no_events: "イベントなし",
    no_bots: "ボットなし",
    no_logs: "ログなし",
    no_http_routes: "HTTPルートなし",
    no_ws_routes: "WebSocketルートなし",
    no_data: "データなし",
    requires_auth: "認証が必要",
    active: "アクティブ",
    inactive: "非アクティブ",
    loaded_status: "ロード済み",
    enable: "有効化",
    load: "ロード",
    unload: "アンロード",
    install: "インストール",
    search_packages: "パッケージを検索...",
    search_modules: "モジュールを検索...",
    search_config: "設定を検索...",
    all_status: "すべて",
    live_events: "ライブイベント",
    waiting_events: "イベントを待機中...",
    bots_desc: "各プラットフォームで検出されたボット",
    events_desc: "イベントストリームの表示/ビルド",
    modules_desc: "登録済みモジュールとアダプタの管理",
    runtime: "ランタイム",
    runtime_desc: "システム実行状況と拡張機能の概要を表示",
    module_mgmt: "モジュール管理",
    module_mgmt_desc: "登録済みモジュールとアダプターを管理",
    store_desc: "パッケージの閲覧とインストール",
    config_desc: "設定とストレージの表示・管理",
    configuration: "設定",
    storage: "ストレージ",
    auth_title: "認証",
    auth_desc_text: "アクセストークンを入力して続行してください",
    auth_label: "アクセストークン",
    auth_placeholder: "トークンを入力",
    auth_hint:
      "トークンは設定の <code>Dashboard.token</code> に保存されています",
    login: "ログイン",
    cancel: "キャンセル",
    ok: "OK",
    setup_title: "ErisPulse へようこそ",
    setup_desc:
      "初回利用です。アクセストークンを設定してください。このトークンは Dashboard への安全なアクセスを保護するために使用されます。",
    setup_token_label: "アクセストークンを設定",
    setup_token_placeholder: "8文字以上で入力してください",
    setup_token_confirm: "トークンを確認",
    setup_token_confirm_placeholder: "トークンを再入力してください",
    setup_btn: "はじめる",
    setup_token_mismatch: "トークンが一致しません",
    setup_token_too_short: "トークンは8文字以上必要です",
    logged_in: "ログイン成功",
    invalid_token: "無効なトークン",
    action_completed: "操作完了",
    action_failed: "操作失敗",
    installing: "インストール中...",
    installed: "インストール完了！再起動を推奨",
    install_failed: "インストール失敗",
    install_success: "インストール完了",
    install_timeout: "インストールがタイムアウト",
    install_restart_title: "新モジュールを読み込むために再起動",
    install_restart_confirm:
      "モジュールのインストールに成功しました。フレームワークを再起動して読み込みますか？",
    install_restart_btn: "再起動",
    install_detail: "インストール詳細",
    no_token_refresh: "サービスの準備ができていません。後で更新してください",
    unload_self_title: "警告",
    unload_self_confirm:
      "ダッシュボードモジュールをアンロードすると、Webからこのインターフェースにアクセスできなくなります。続行しますか？",
    unload_confirm_title: "アンロード確認",
    unload_confirm_text: "このモジュールをアンロードしてもよろしいですか？",
    disable_confirm_title: "無効化確認",
    disable_confirm_text:
      "このモジュールを無効化してもよろしいですか？イベントに応答しなくなります。",
    uninstall_confirm_title: "アンインストール確認",
    uninstall_confirm_text:
      "このモジュールをアンインストールしますか？パッケージが削除されます。",
    upload_title: "アップロードインストール",
    upload_desc:
      "whlまたはzipパッケージをアップロードしてモジュールをインストール",
    upload_btn: "ファイルを選択してインストール",
    uploading: "アップロード＆インストール中...",
    upload_failed: "アップロードインストール失敗",
    restart: "フレームワーク再起動",
    restart_confirm:
      "フレームワークを再起動しますか？すべてのモジュールとアダプタが再読み込みされます。",
    restart_success: "フレームワークを再起動中...",
    restart_failed: "再起動失敗",
    clear_events: "イベントをクリア",
    clear_confirm: "すべてのイベントログをクリアしますか？",
    all_types: "すべてのタイプ",
    all_platforms: "すべてのプラットフォーム",
    no_packages: "一致するパッケージなし",
    failed_registry: "レジストリの読み込みに失敗",
    event_cleared: "イベントをクリアしました",
    empty_storage: "ストレージは空です",
    storage_items: "件",
    message: "メッセージ",
    notice: "通知",
    request: "リクエスト",
    meta: "メタ",
    platform: "プラットフォーム",
    event_builder: "イベントビルダー",
    event_builder_desc: "デバッグとテスト用のカスタムイベントを構築",
    event_type: "イベントタイプ",
    detail_type: "詳細タイプ",
    platform_info: "プラットフォーム情報",
    select_platform: "プラットフォームを選択",
    select_bot: "Botを選択",
    custom: "カスタム",
    select_detail_type: "詳細タイプを選択...",
    select_platform_placeholder: "先にプラットフォームを選択...",
    session_type: "セッションタイプ",
    session_id: "セッションID",
    session_private: "プライベート",
    session_group: "グループ",
    session_channel: "チャンネル",
    custom_platform_placeholder: "カスタムプラットフォーム名を入力",
    custom_bot_placeholder: "カスタムBot IDを入力",
    session_id_placeholder: "グループ/チャンネル/ユーザーID",
    message_content: "メッセージ内容",
    optional_fields: "オプションフィールド",
    json_preview: "JSONプレビュー",
    preview: "プレビュー",
    submit_event: "イベントを送信",
    add_segment: "セグメントを追加",
    add_field: "フィールドを追加",
    copy_json: "JSONをコピー",
    validate_error: "検証エラー",
    submit_success: "イベントを送信しました",
    submit_failed: "送信失敗",
    view_tree: "ツリー",
    view_source: "ソース",
    reload_config: "再読込",
    save_config: "保存",
    config_saved: "設定を保存しました",
    config_load_failed: "設定ソースの読み込みに失敗",
    read_only: "読み取り専用（ルート設定）",
    cpu_usage: "CPU使用率",
    process_cpu: "プロセスCPU",
    cpu_user: "ユーザー",
    cpu_system: "システム",
    memory_usage: "メモリ使用量",
    rss_memory: "RSSメモリ",
    system_memory: "システムメモリ",
    system_cpu: "システム CPU",
    system_total_memory: "システム合計メモリ",
    available_memory: "利用可能メモリ",
    swap_memory: "スワップメモリ",
    io_read: "IO読み取り",
    io_write: "IO書き込み",
    active_connections: "アクティブ接続",
    system_details: "システム詳細",
    instance_info: "インスタンス情報",
    instance_uptime: "稼働時間",
    instance_platform: "プラットフォーム",
    instance_pid: "PID",
    instance_threads: "スレッド",
    instance_connections: "接続数",
    instance_listening: "リッスン中",
    instance_open_files: "開いているファイル",
    instance_ws_clients: "WS クライアント",
    lifecycle_commands: "コマンド実行",
    lifecycle_requests: "HTTP リクエスト",
    websocket: "WebSocket",
    message_stats: "メッセージ統計",
    message_types: "メッセージタイプ",
    platform_distribution: "プラットフォーム分布",
    last_24h_trend: "過去24時間の傾向",
    registered_routes: "登録済みルート",
    refresh: "更新",
    copy: "コピー",
    auto_refresh: "自動更新",
    copy_all_logs: "すべてのログをコピー",
    event_preview: "イベントプレビュー",
    copied_to_clipboard: "クリップボードにコピーしました",
    copy_failed: "コピー失敗",
    save_failed: "保存失敗",
    unknown_error: "不明なエラー",
    validation_failed: "検証失敗",
    server_error: "サーバーエラー",
    connection_error: "サーバーに接続できません。ネットワークを確認",
    auto_refresh_off: "自動更新をオフにしました",
    auto_refresh_on: "自動更新をオンにしました",
    alt_message: "代替メッセージ",
    request_comment: "リクエストコメント",
    field_name_placeholder: "フィールド名",
    field_value_placeholder: "フィールド値",
    load_segments_first: "先にセグメントタイプを読み込んでください",
    test: "テスト",
    send: "送信",
    query_params: "クエリパラメータ",
    request_body: "リクエストボディ",
    response: "レスポンス",
    click_to_expand_routes: "クリックしてルートを表示",
    base_path: "ベースパス",
    pause_scroll: "スクロール停止",
    resume_scroll: "スクロール再開",
    sort_newest_top: "最新ログを上に表示",
    sort_newest_bottom: "最新ログを下に表示",
    force_refresh: "強制更新",
    audit_log: "監査ログ",
    audit_log_desc: "システム操作記録を表示",
    all_actions: "すべての操作",
    backup_restore: "バックアップと復元",
    backup_desc: "システム設定とストレージデータのエクスポート/インポート",
    backup_export: "バックアップをエクスポート",
    backup_import: "インポートで復元",
    backup_export_success: "バックアップをエクスポートしました",
    backup_import_confirm:
      "インポートすると現在の設定とストレージが上書きされます（Dashboard設定を除く）。続行しますか？",
    import_success: "復元成功",
    import_failed: "復元失敗",
    backup_failed: "バックアップ失敗",
    audit_clear_confirm: "監査ログをすべてクリアしますか？",
    audit_cleared: "監査ログをクリアしました",
    last_run: "最終実行",
    never: "未実行",
    run_count: "実行回数",
    action_load_module: "モジュールをロード",
    action_unload_module: "モジュールをアンロード",
    action_load_adapter: "アダプタをロード",
    action_unload_adapter: "アダプタをアンロード",
    action_config_update: "設定を更新",
    action_config_source_save: "設定ソースを保存",
    action_storage_set: "ストレージを設定",
    action_storage_delete: "ストレージを削除",
    action_package_install: "パッケージをインストール",
    action_clear_events: "イベントをクリア",
    action_restart_framework: "フレームワークを再起動",
    action_backup_import: "バックアップをインポート",
    files: "ファイル",
    files_desc: "プロジェクトファイルの閲覧と管理",
    search_files: "ファイルを検索...",
    new_file: "新規ファイル",
    new_folder: "新規フォルダ",
    upload: "アップロード",
    save: "保存",
    upload_success: "アップロード成功",
    upload_failed: "アップロード失敗",
    upload_drop: "ファイルをここにドラッグまたはクリックしてアップロード",
    file_saved: "ファイルを保存しました",
    file_save_failed: "保存失敗",
    file_too_large: "ファイルが大きすぎて編集できません",
    binary_file: "バイナリファイル、編集不可",
    file_not_found: "ファイルが見つかりません",
    folder_exists: "フォルダは既に存在します",
    delete_confirm:
      "選択したファイルを削除しますか？この操作は取り消せません。",
    delete_success: "削除しました",
    delete_failed: "削除失敗",
    rename_label: "新しい名前",
    rename_success: "名前を変更しました",
    rename_failed: "名前変更失敗",
    new_file_name: "ファイル名",
    file_name: "名前",
    file_size: "サイズ",
    file_perm: "権限",
    file_modified: "更新日時",
    parent_dir: "親ディレクトリ",
    toggle_hidden: "隠し表示",
    show_hidden: "隠し",
    new_folder_name: "フォルダ名",
    enable_module: "有効化",
    disable_module: "無効化",
    reload_module: "リロード",
    uninstall_module: "アンインストール",
    uninstall_confirm:
      "このモジュールをアンインストールしますか？パッケージが削除されます。",
    module_uninstalling: "アンインストール中...",
    module_version: "バージョン",
    module_author: "作者",
    module_no_desc: "説明なし",
    module_enabled_not_loaded: "有効化済み（未ロード）",
    module_disabled: "無効",
    reload: "リロード",
    action_enable_module: "モジュールを有効化",
    action_disable_module: "モジュールを無効化",
    action_reload_module: "モジュールをリロード",
    action_uninstall_module: "モジュールをアンインストール",
    search_modules: "モジュールを検索...",
    module_loaded_dynamic: "モジュールが動的にロードされました",
    installed_no_restart: "インストール完了、モジュールは自動ロードされました",
    permissions: "権限",
    download: "ダウンロード",
    chmod: "権限変更",
    chmod_prompt: "権限値を入力（例: 755, 644）",
    pkg_manager: "パッケージ",
    pkg_manager_desc:
      "インストール済みPythonパッケージの管理、更新確認、新規インストール",
    pkg_installed: "インストール済み",
    pkg_updates: "更新",
    pkg_install_new: "新規インストール",
    pkg_updates_available: "利用可能な更新",
    pkg_upgrade_all: "すべて更新",
    pkg_install_placeholder: "パッケージ名（例: requests や numpy==1.24.0）",
    pkg_install_hint:
      "パッケージ名、バージョン指定（package==version）、またはスペース区切りで複数パッケージに対応",
    pkg_name: "パッケージ",
    pkg_version: "バージョン",
    pkg_type: "タイプ",
    pkg_latest: "最新バージョン",
    pkg_type_module: "モジュール",
    pkg_type_adapter: "アダプタ",
    pkg_type_library: "ライブラリ",
    pkg_no_installed: "インストール済みパッケージなし",
    pkg_no_updates: "すべてのパッケージが最新です",
    pkg_checking_updates: "更新を確認中...",
    pkg_upgrading: "更新中...",
    pkg_upgrade: "更新",
    pkg_upgrade_confirm: "以下のパッケージを更新しますか？",
    pkg_upgrade_all_confirm:
      "すべての古いパッケージを更新しますか？時間がかかる場合があります。",
    pkg_uninstall_confirm:
      "このパッケージをアンインストールしますか？依存関係に問題が生じる可能性があります。",
    pkg_cannot_uninstall: "コアパッケージはアンインストールできません",
    pkg_install_success: "パッケージをインストールしました",
    pkg_upgrade_success: "パッケージを更新しました",
    pkg_install_failed: "パッケージのインストールに失敗",
    pkg_upgrade_failed: "パッケージの更新に失敗",
    store_version_current: "現在",
    store_version_latest: "最新",
    store_update_available: "更新あり",
    action_package_upgrade: "パッケージを更新",
    action_package_uninstall: "パッケージをアンインストール",
    upgrade_all: "すべて更新",
    module_hub: "モジュールハブ",
    module_hub_desc: "モジュール管理、ストア閲覧、Pythonパッケージ管理",
    registered: "登録済み",
    registered_desc: "登録済みモジュールとアダプタの管理",
    compress: "圧縮",
    decompress: "解凍",
    upload_folder: "フォルダをアップロード",
    task_list: "タスクリスト",
    cmd_management: "コマンド管理",
    cmd_management_desc:
      "登録済みコマンドの管理：エイリアス、プラットフォームフィルタ、有効/無効",
    cmd_global_settings: "グローバルコマンド設定",
    cmd_prefix: "コマンドプレフィックス",
    cmd_case_sensitive: "大文字小文字を区別",
    cmd_allow_space_prefix: "スペースプレフィックスを許可",
    cmd_must_at_bot: "Botへのメンション必須",
    cmd_list: "コマンドリスト",
    cmd_enabled: "有効",
    cmd_disabled: "無効",
    cmd_custom_aliases: "カスタムエイリアス",
    cmd_alias_placeholder: "エイリアスを入力してEnter",
    cmd_allowed_platforms: "許可プラットフォーム",
    cmd_allowed_platforms_hint: "空欄で全プラットフォームを許可",
    cmd_blocked_platforms: "ブロックプラットフォーム",
    cmd_transform_to: "コマンド変換",
    cmd_transform_placeholder:
      "空欄で変換なし、対象コマンド名を入力でリダイレクト",
    cmd_original_aliases_label: "オリジナルエイリアス",
    cmd_no_commands: "登録済みコマンドなし",
    cmd_help: "ヘルプ",
    cmd_usage: "使用法",
    cmd_group: "コマンドグループ",
    cmd_save_success: "コマンドルールを保存しました",
    cmd_save_failed: "保存失敗",
    cmd_yes: "はい",
    cmd_no: "いいえ",
    cmd_aliases_label: "エイリアス",
    group_overview: "概要",
    group_events: "イベント",
    group_extensions: "拡張",
    group_system: "システム",
    group_tools: "ツール",
    group_monitoring: "監視",
    group_network: "ネットワーク",
    group_config: "設定",
    event_stream: "イベントストリーム",
    event_stream_desc: "リアルタイムイベントストリームを表示",
    event_builder_desc: "デバッグとテスト用のカスタムイベントを構築",
    lifecycle_desc: "システムの起動と実行プロセスを表示",
    settings_title: "ダッシュボード設定",
    settings_appearance: "外観",
    settings_appearance_behavior: "外観と動作",
    settings_behavior: "動作",
    settings_theme: "ダークテーマ",
    settings_language: "言語",
    settings_ui_style: "UIスタイル",
    settings_accent_color: "アクセントカラー",
    settings_accent_desc: "アクセントを選択すると、ボタンやリンクが連動します",
    settings_background: "背景色",
    settings_background_desc: "ページの背景色をカスタマイズ",
    settings_custom: "カスタム",
    settings_reset: "リセット",
    settings_upload_image: "画像をアップロード",
    settings_bg_auto_theme: "背景から自動で色を抽出",
    settings_sidebar: "サイドバーを折りたたむ",
    settings_show_node_selector: "ノードセレクタを表示",
    settings_show_node_selector_desc:
      "有効にすると、リモートノードが設定されている場合のみ表示されます",
    settings_remember_groups: "ナビグループの状態を記憶",
    settings_remember_groups_desc:
      "ページ更新後もナビグループの展開/折りたたみ状態を保持",
    settings_refresh_interval: "更新間隔",
    settings_event_limit: "イベント数制限",
    settings_disabled: "無効",
    settings_restart_desc: "すべてのモジュールとアダプタを再読込",
    settings_logout: "ログアウト",
    settings_logout_desc: "トークンを消去してログインページに戻る",
    settings_page_desc: "ダッシュボードの外観と動作をカスタマイズ",
    settings_global_scope: "グローバル同期",
    settings_global_active:
      "グローバル外観が有効です — すべてのユーザーが同じ外観を表示します",
    settings_layout: "レイアウト",
    settings_system: "システム",
    settings_dash_title: "ダッシュボードタイトル",
    settings_dash_title_desc: "ヘッダータイトルのカスタマイズ",
    upload_modal_title: "アップロードインストール",
    upload_drop_hint: "ファイルをここにドラッグまたはクリックして選択",
    force_install: "強制インストール",
    force_install_desc:
      "バージョンを無視して強制再インストール (--force-reinstall)",
    start_install: "インストール開始",
    pip_mirror: "pip ミラー",
    install_version: "インストールバージョン",
    latest_version: "最新",
    batch_install: "一括インストール",
    batch_install_count: "{n}個選択中",
    dependencies: "依存関係",
    version_history: "バージョン履歴",
    no_dependencies: "外部依存なし",
    pkg_detail_loading: "詳細を読み込み中...",
    pkg_detail_failed: "詳細の読み込みに失敗",
    view_detail: "詳細",
    pkg_git_install: "Git インストール",
    pkg_git_install_desc: "Gitリポジトリから直接インストール、PyPI不要",
    pkg_git_install_placeholder: "git+https://github.com/user/repo.git",
    pkg_git_examples:
      "例：git+https://github.com/ErisPulse/erispulse-module-demo.git",
    pkg_git_installed: "インストール済みGitモジュール",
    pkg_git_no_packages: "Gitインストールのモジュールはありません",
    pkg_git_update_available: "更新あり",
    pkg_git_upgrade: "更新",
    pkg_git_url: "リポジトリURL",
    upload_complete: "アップロード完了",
    upload_file_too_large: "ファイルが大きすぎます",
    install_with_options: "インストールオプション",
    status_icons_conn: "接続状態",
    status_conn_disconnected: "未接続",
    status_conn_connected: "接続済み",
    status_conn_error: "接続エラー",
    expand_all: "すべて展開",
    collapse_all: "すべて折り畳む",
    group_module_views: "モジュールビュー",
    module_view_load_error: "モジュールビューの読み込みに失敗しました",
    framework_config: "フレームワーク設定",
    framework_config_desc: "ErisPulseフレームワークのコア設定を表示・変更",
    restart_required_hint: "⚠ 設定を更新後、フレームワークの再起動が必要です",
    fw_section_server: "サーバー",
    fw_section_logger: "ロガー",
    fw_section_storage: "ストレージ",
    fw_section_event_message: "イベント › メッセージ",
    fw_section_event_command: "イベント › コマンド",
    fw_section_framework: "フレームワーク",
    fw_section_i18n: "国際化",
    fw_section_adapters: "アダプター",
    fw_section_modules: "モジュール",
    fw_field_server_host: "リッスンアドレス",
    fw_field_server_port: "リッスンポート",
    fw_field_server_ssl_certfile: "SSL証明書パス、nullでSSL無効",
    fw_field_server_ssl_keyfile: "SSL秘密鍵パス",
    fw_field_logger_level: "ログレベル：DEBUG / INFO / WARNING / ERROR",
    fw_field_logger_log_files: 'ログファイルパス（例: ["logs/app.log"]）',
    fw_field_logger_memory_limit: "メモリ内最大ログエントリ数",
    fw_field_storage_use_global_db:
      "モジュール間共有のグローバルデータベースを使用",
    fw_field_event_message_ignore_self: "ボット自身が送信したメッセージを無視",
    fw_field_event_command_prefix: "コマンドトリガープレフィックス",
    fw_field_event_command_case_sensitive: "コマンドの大文字小文字を区別するか",
    fw_field_event_command_allow_space_prefix:
      "コマンドプレフィックス前のスペースを許可",
    fw_field_event_command_must_at_bot: "コマンド実行に@ボットが必要",
    fw_field_framework_enable_lazy_loading: "モジュールの遅延読み込みを有効化",
    fw_field_logger_format: "ログ形式: rich（カラー）/ plain",
    fw_field_framework_uninit_timeout: "初期化解除のタイムアウト（秒）",
    fw_field_framework_strict_mode:
      "厳格モード: 0=緩和 / 1=厳格-スキップ / 2=厳格-致命",
    fw_field_framework_strict_mode_exceptions: "厳格モード除外リスト",
    adapter_config: "アダプター設定",
    adapter_config_desc:
      "プラットフォームアダプターの接続とアカウント設定を管理",
    components: "コンポーネント",
    components_desc: "アダプターとモジュールの設定を管理",
    components_config: "コンポーネント設定",
    components_config_desc: "アダプターとモジュールの設定を管理",
    ext_config: "拡張設定",
    ext_config_desc: "アダプターとモジュールの設定を管理",
    ext_settings: "拡張設定",
    ext_settings_desc: "アダプターとモジュールの設定を管理",
    plugin_config: "プラグイン設定",
    plugin_config_desc: "アダプターとモジュールの設定を管理",
    adapter_global_config: "グローバル設定",
    adapter_accounts: "アカウント設定",
    add_account: "アカウント追加",
    remove_account: "アカウント削除",
    account_name: "アカウント名",
    save_adapter_config: "設定を保存",
    no_config_schema: "このアダプターには設定スキーマがありません",
    config_validation_failed: "設定の検証に失敗しました",
    adapter_config_saved: "アダプター設定を保存しました",
    module_config: "モジュール設定",
    module_config_desc: "各モジュールの設定項目を管理",
    module_config_empty: "設定スキーマを持つモジュールがありません",
    save_module_config: "設定を保存",
    module_config_saved: "モジュール設定を保存しました",
    account_removed: "アカウントを削除しました",
    account_added: "アカウントを追加しました",
    confirm_remove_account: "このアカウントを削除してもよろしいですか？",
    new_account_default_name: "new_account",
    select_adapter_prompt: "アダプターを選択して設定",
    adapter_no_adapters: "まだアダプターがインストールされていません～",
    fw_server_warn_title: "⚠ サーバー設定変更の確認",
    fw_server_warn_text:
      "ErisPulseサーバーの接続設定（host/port/ssl）を変更しようとしています。何をしているか確認してください！\n\nDockerコンテナでこれを変更すると、外部からErisPulseルーターにアクセスできなくなる可能性があります。",
    fw_unknown_field: "不明なフィールド",
    fw_win_warn:
      "Windowsシステムの制限により自動更新が失敗する可能性があります。手動でErisPulseを更新してください",
    fw_cannot_update: "この環境では自動更新をサポートしていません",
    fw_popup_msg: "ErisPulse の新バージョン v{latest} が利用可能です",
    fw_unknown_field_desc:
      "この設定項目は現在のバージョンのデフォルト設定に含まれていません。削除をお勧めします。",
    fw_reset_default: "デフォルトに戻す",
    fw_reset_confirm: "{key} をデフォルト値に戻しますか？",
    fw_reset_done: "デフォルト値に戻しました",
    fw_delete_field: "設定を削除",
    fw_delete_confirm: "設定項目 {key} を削除しますか？",
    fw_delete_done: "設定項目を削除しました",
    fw_add_field: "設定項目を追加",
    fw_add_field_section_hint:
      "セクション名（例: server, logger, event.command）",
    fw_add_field_name_hint: "フィールド名",
    fw_add_field_value_hint: "値（JSONまたはテキスト）",
    fw_update_title: "フレームワーク更新",
    fw_update_title_desc:
      "バージョン更新、リリースノートの確認、更新のインストール",
    release_notes_unavailable: "リリースノートを取得できません",
    fw_current_version: "現在のバージョン",
    fw_latest_version: "最新バージョン",
    fw_select_version: "バージョン選択",
    fw_check_updates: "更新を確認",
    fw_install_update: "更新をインストール",
    fw_latest_already: "最新です",
    fw_current: "現在",
    fw_downgrade_title: "⚠ ダウングレード確認",
    fw_downgrade_text:
      "ErisPulseを {v} にダウングレードしようとしています。互換性の問題が発生する可能性があります。続行しますか？",
    cluster_management: "クラスタ管理",
    cluster_desc: "リモートノードの追加・編集・削除、機能比較の確認",
    cluster_overview: "概要ビュー",
    cluster_overview_desc: "全ノードの稼働状態を一覧表示",
    node_local: "ローカル",
    node_online: "オンライン",
    node_offline: "オフライン",
    node_add: "ノード追加",
    node_edit: "編集",
    node_delete: "削除",
    node_ping: "接続テスト",
    node_probe: "再プローブ",
    node_id: "ノード ID",
    node_name: "ノード名",
    node_url: "ノード URL",
    node_token: "アクセストークン",
    node_url_placeholder: "http://192.168.1.100:8000",
    node_token_placeholder: "リモート Dashboard のトークン",
    node_add_success: "ノードを追加しました",
    handshake_success: "リモート側にも自動登録しました",
    remote_unauthorized: "リモートノードの認証に失敗、Token を確認してください",
    toggle_url_visibility: "URLを表示/非表示",
    node_add_failed: "ノードの追加に失敗しました",
    node_remove_confirm: "このノードを削除しますか？",
    node_ping_success: "接続成功",
    node_ping_failed: "接続失敗",
    leave_empty_to_keep: "空欄は変更しない",
    node_probing: "ノード機能をプローブ中...",
    node_probe_complete: "プローブ完了",
    unsupported_on_node: "このノードではサポートされていません",
    unsupported_features: "未サポート機能",
    capability_matrix: "機能マトリクス",
    cluster_card_detail: "詳細",
    cluster_node_count: "ノード",
    process_memory: "プロセス",
    threads: "スレッド",
    connections: "接続",
    cap_status: "ステータス",
    cap_status_desc: "ノードの実行状態を表示",
    cap_system: "システム",
    cap_system_desc: "システムリソース使用状況を表示",
    cap_adapters: "アダプタ",
    cap_adapters_desc: "メッセージアダプタの管理",
    cap_modules: "モジュール",
    cap_modules_desc: "登録済みモジュールを表示",
    cap_bots: "ボット",
    cap_bots_desc: "Botインスタンスの管理",
    cap_events: "イベント",
    cap_events_desc: "リアルタイムイベントストリーム",
    cap_config: "設定",
    cap_config_desc: "モジュール設定の閲覧・編集",
    cap_storage: "ストレージ",
    cap_storage_desc: "キーバリューストレージにアクセス",
    cap_store: "ストア",
    cap_store_desc: "拡張モジュールの閲覧・インストール",
    cap_packages: "パッケージ",
    cap_packages_desc: "Pythonパッケージの管理",
    cap_logs: "ログ",
    cap_logs_desc: "システム・モジュールログの表示",
    cap_lifecycle: "ライフサイクル",
    cap_lifecycle_desc: "モジュールの開始/停止/リロード",
    cap_audit: "監査ログ",
    cap_audit_desc: "API呼び出しの監査記録を表示",
    cap_files: "ファイル",
    cap_files_desc: "サーバーファイルの閲覧・管理",
    cap_commands: "コマンド",
    cap_commands_desc: "登録済みコマンドの管理",
    cap_event_builder: "イベントビルダー",
    cap_event_builder_desc: "カスタムイベントの作成・送信",
    cap_config_source: "設定ソース",
    cap_config_source_desc: "設定ファイルのソースを表示",
    cap_module_views: "モジュールビュー",
    cap_module_views_desc: "モジュール提供のカスタムページ",
    cap_performance: "パフォーマンス",
    cap_performance_desc: "パフォーマンス指標を表示",
    cap_routes: "ルート",
    cap_routes_desc: "登録済みAPIルートを表示",
    cap_message_stats: "メッセージ統計",
    cap_message_stats_desc: "メッセージ統計を表示",
    cap_framework_update: "フレームワーク更新",
    cap_framework_update_desc: "ErisPulseの確認・更新",
    cluster_sync: "イベント同期",
    cluster_sync_desc: "ノード間でイベントを転送",
    sync_source: "送信元",
    sync_target: "送信先",
    sync_start: "同期開始",
    sync_success: "同期完了",
    sync_failed: "同期失敗",
    latency: "レイテンシ",
    dashboard_version: "Dashboard バージョン",
    node_already_exists: "ノード ID は既に存在します",
    node_not_found: "ノードが見つかりません",
    just_now: "たった今",
    time_ago: "前",
    module_load_mode: "ロードモード",
    module_lazy: "遅延",
    module_eager: "即時",
    module_priority: "優先度",
    module_depends: "依存",
    module_views_count: "ビュー",
    capability: "機能",
    about: "について",
    about_tagline:
      "イベント駆動型マルチプラットフォームボット開発フレームワーク",
    about_desc:
      "ErisPulse は、非同期・非ブロッキングのボットプログラムを構築するためのシンプルで使いやすいフレームワークを提供することを目指すオープンソースの Python ライブラリです。OneBot12 標準インターフェースに基づき、一度書けば複数プラットフォームにデプロイできます。柔軟なプラグインシステム、ホットリロードサポート、完全な開発者ツールチェーンを備え、シンプルなチャットボットから複雑な自動化システムまで様々なシーンに対応します。",
    about_feat_event_title: "イベント駆動アーキテクチャ",
    about_feat_event_desc:
      "OneBot12 標準に基づく明確なイベントモデルで、メッセージ処理ロジックがより直感的で効率的",
    about_feat_cross_title: "クロスプラットフォーム対応",
    about_feat_cross_desc:
      "プラグインモジュールは一度書けば全プラットフォームで使用可能、プラットフォームごとの重複開発不要",
    about_feat_module_title: "モジュラー設計",
    about_feat_module_desc:
      "柔軟なプラグインシステム、拡張と統合が容易、ホットプラグ可能なモジュール管理をサポート",
    about_feat_reload_title: "ホットリロードサポート",
    about_feat_reload_desc:
      "開発中に再起動なしでコードをリロード、開発イテレーション効率を大幅に向上",
    about_star_hint:
      "プロジェクトが気に入ったら、Star を付けてください~ とても大切です！",
    about_contributors: "貢献者",
    about_docs: "ドキュメント",
    about_discussions: "ディスカッション",
    about_market: "モジュールマーケット",
  },

  ru: {
    dashboard: "Панель управления",
    home_quick: "Быстрый доступ",
    home_add: "Добавить",
    home_empty: "Ничего не закреплено — нажмите «изменить»",
    bots: "Боты",
    events: "События",
    modules: "Плагины",
    store: "Магазин модулей",
    config: "Конфигурация",
    sys_logs: "Системные журналы",
    logs: "Журналы",
    lifecycle: "Жизненный цикл",
    events_stream: "Поток",
    events_builder: "Конструктор",
    sys_logs_desc: "Просмотр системных журналов и событий жизненного цикла",
    logs_desc: "Просмотр и фильтрация системных журналов",
    lifecycle_desc: "Просмотр процесса запуска и работы системы",
    lifecycle_timeline: "Шкала жизненного цикла",
    all_modules: "Все модули",
    search_logs: "Поиск в журналах...",
    no_lifecycle: "Нет событий жизненного цикла",
    log_list: "Список журналов",
    api_routes: "API маршруты",
    api_routes_desc:
      "Просмотр всех зарегистрированных HTTP и WebSocket маршрутов",
    http_routes: "HTTP маршруты",
    ws_routes: "WebSocket маршруты",
    loading: "Загрузка...",
    online: "В сети",
    offline: "Не в сети",
    live: "В реальном времени",
    adapters: "Адаптеры",
    modules_label: "Модули",
    online_bots: "Боты в сети",
    total_events: "Всего событий",
    no_adapters: "Нет адаптеров",
    no_modules: "Нет модулей",
    no_events: "Нет событий",
    no_bots: "Нет ботов",
    no_logs: "Нет журналов",
    no_http_routes: "Нет HTTP маршрутов",
    no_ws_routes: "Нет WebSocket маршрутов",
    no_data: "Нет данных",
    requires_auth: "Требуется авторизация",
    active: "Активен",
    inactive: "Неактивен",
    loaded_status: "Загружен",
    enable: "Включить",
    load: "Загрузить",
    unload: "Выгрузить",
    install: "Установить",
    search_packages: "Поиск пакетов...",
    search_modules: "Поиск модулей...",
    search_config: "Поиск конфигурации...",
    all_status: "Все",
    live_events: "События в реальном времени",
    waiting_events: "Ожидание событий...",
    bots_desc: "Обнаруженные боты на платформах",
    events_desc: "Просмотр/создание потока событий",
    modules_desc: "Управление зарегистрированными модулями и адаптерами",
    runtime: "Среда выполнения",
    runtime_desc: "Просмотр состояния системы и обзор расширений",
    module_mgmt: "Управление модулями",
    module_mgmt_desc: "Управление зарегистрированными модулями и адаптерами",
    store_desc: "Просмотр и установка пакетов",
    config_desc: "Просмотр и управление конфигурацией и хранилищем",
    configuration: "Конфигурация",
    storage: "Хранилище",
    auth_title: "Аутентификация",
    auth_desc_text: "Введите токен доступа для продолжения",
    auth_label: "Токен доступа",
    auth_placeholder: "Введите токен",
    auth_hint: "Токен хранится в конфигурации <code>Dashboard.token</code>",
    login: "Войти",
    cancel: "Отмена",
    ok: "OK",
    setup_title: "Добро пожаловать в ErisPulse",
    setup_desc:
      "Первый раз здесь? Установите токен доступа. Этот токен будет использоваться для защиты доступа к панели управления.",
    setup_token_label: "Установить токен доступа",
    setup_token_placeholder: "Введите не менее 8 символов",
    setup_token_confirm: "Подтвердить токен",
    setup_token_confirm_placeholder: "Введите токен еще раз",
    setup_btn: "Начать",
    setup_token_mismatch: "Токены не совпадают",
    setup_token_too_short: "Токен должен содержать не менее 8 символов",
    logged_in: "Вход выполнен",
    invalid_token: "Неверный токен",
    action_completed: "Действие выполнено",
    action_failed: "Действие не удалось",
    installing: "Установка...",
    installed: "Установлено! Рекомендуется перезапуск",
    install_failed: "Установка не удалась",
    install_success: "Установка завершена",
    install_timeout: "Таймаут установки",
    install_restart_title: "Перезапуск для загрузки нового модуля",
    install_restart_confirm:
      "Модуль успешно установлен. Перезапустить фреймворк для его загрузки?",
    install_restart_btn: "Перезапуск",
    install_detail: "Детали установки",
    no_token_refresh: "Сервис не готов, обновите позже",
    unload_self_title: "Предупреждение",
    unload_self_confirm:
      "После выгрузки модуля панели управления вы не сможете получить доступ к этому интерфейсу через веб. Продолжить?",
    unload_confirm_title: "Подтверждение выгрузки",
    unload_confirm_text: "Вы уверены, что хотите выгрузить этот модуль?",
    disable_confirm_title: "Подтверждение отключения",
    disable_confirm_text:
      "Вы уверены, что хотите отключить этот модуль? Он перестанет отвечать на события.",
    uninstall_confirm_title: "Подтверждение удаления",
    uninstall_confirm_text:
      "Вы уверены, что хотите удалить этот модуль? Пакет будет удалён.",
    upload_title: "Установка из файла",
    upload_desc: "Загрузите whl или zip пакет для установки модуля",
    upload_btn: "Выбрать файл и установить",
    uploading: "Загрузка и установка...",
    upload_failed: "Ошибка загрузки и установки",
    restart: "Перезапуск фреймворка",
    restart_confirm:
      "Перезапустить фреймворк? Все модули и адаптеры будут перезагружены.",
    restart_success: "Перезапуск фреймворка...",
    restart_failed: "Ошибка перезапуска",
    clear_events: "Очистить события",
    clear_confirm: "Очистить все журналы событий?",
    all_types: "Все типы",
    all_platforms: "Все платформы",
    no_packages: "Нет подходящих пакетов",
    failed_registry: "Не удалось загрузить реестр",
    event_cleared: "События очищены",
    empty_storage: "Хранилище пусто",
    storage_items: "записей",
    message: "Сообщение",
    notice: "Уведомление",
    request: "Запрос",
    meta: "Мета",
    platform: "Платформа",
    event_builder: "Конструктор событий",
    event_builder_desc:
      "Создание пользовательских событий для отладки и тестирования",
    event_type: "Тип события",
    detail_type: "Тип детали",
    platform_info: "Информация о платформе",
    select_platform: "Выбрать платформу",
    select_bot: "Выбрать бота",
    custom: "Пользовательский",
    select_detail_type: "Выберите тип детали...",
    select_platform_placeholder: "Сначала выберите платформу...",
    session_type: "Тип сессии",
    session_id: "ID сессии",
    session_private: "Личный",
    session_group: "Групповой",
    session_channel: "Канал",
    custom_platform_placeholder: "Введите название платформы",
    custom_bot_placeholder: "Введите пользовательский Bot ID",
    session_id_placeholder: "ID группы/канала/пользователя",
    message_content: "Содержание сообщения",
    optional_fields: "Дополнительные поля",
    json_preview: "Предпросмотр JSON",
    preview: "Предпросмотр",
    submit_event: "Отправить событие",
    add_segment: "Добавить сегмент",
    add_field: "Добавить поле",
    copy_json: "Копировать JSON",
    validate_error: "Ошибка валидации",
    submit_success: "Событие отправлено",
    submit_failed: "Ошибка отправки",
    view_tree: "Дерево",
    view_source: "Исходный код",
    reload_config: "Обновить",
    save_config: "Сохранить",
    config_saved: "Конфигурация сохранена",
    config_load_failed: "Не удалось загрузить исходный код конфигурации",
    read_only: "Только чтение (корневая конфигурация)",
    cpu_usage: "Использование CPU",
    process_cpu: "CPU процесса",
    cpu_user: "Пользователь",
    cpu_system: "Ядро",
    memory_usage: "Использование памяти",
    rss_memory: "RSS память",
    system_memory: "Системная память",
    system_cpu: "Системный CPU",
    system_total_memory: "Общая системная память",
    available_memory: "Доступная память",
    swap_memory: "Swap память",
    io_read: "IO чтение",
    io_write: "IO запись",
    active_connections: "Активные соединения",
    system_details: "Детали системы",
    instance_info: "Информация",
    instance_uptime: "Время работы",
    instance_platform: "Платформа",
    instance_pid: "PID",
    instance_threads: "Потоки",
    instance_connections: "Соединения",
    instance_listening: "Прослушивание",
    instance_open_files: "Открытые файлы",
    instance_ws_clients: "WS Клиенты",
    lifecycle_commands: "Команды",
    lifecycle_requests: "HTTP Запросы",
    websocket: "WebSocket",
    message_stats: "Статистика сообщений",
    message_types: "Типы сообщений",
    platform_distribution: "Распределение по платформам",
    last_24h_trend: "Тренд за 24 часа",
    registered_routes: "Зарегистрированные маршруты",
    refresh: "Обновить",
    copy: "Копировать",
    auto_refresh: "Автообновление",
    copy_all_logs: "Копировать все журналы",
    event_preview: "Предпросмотр события",
    copied_to_clipboard: "Скопировано в буфер обмена",
    copy_failed: "Ошибка копирования",
    save_failed: "Ошибка сохранения",
    unknown_error: "Неизвестная ошибка",
    validation_failed: "Ошибка валидации",
    server_error: "Ошибка сервера",
    connection_error: "Не удалось подключиться к серверу",
    auto_refresh_off: "Автообновление отключено",
    auto_refresh_on: "Автообновление включено",
    alt_message: "Альт. сообщение",
    request_comment: "Комментарий к запросу",
    field_name_placeholder: "Имя поля",
    field_value_placeholder: "Значение поля",
    load_segments_first: "Сначала загрузите типы сегментов",
    test: "Тест",
    send: "Отправить",
    query_params: "Параметры запроса",
    request_body: "Тело запроса",
    response: "Ответ",
    click_to_expand_routes: "Нажмите для просмотра маршрутов",
    base_path: "Базовый путь",
    pause_scroll: "Пауза",
    resume_scroll: "Продолжить",
    sort_newest_top: "Новые записи сверху",
    sort_newest_bottom: "Новые записи снизу",
    force_refresh: "Принудительное обновление",
    audit_log: "Журнал аудита",
    audit_log_desc: "Просмотр записей системных операций",
    all_actions: "Все действия",
    backup_restore: "Резервное копирование",
    backup_desc: "Экспорт или импорт конфигурации системы и данных хранилища",
    backup_export: "Экспортировать",
    backup_import: "Импортировать",
    backup_export_success: "Резервная копия экспортирована",
    backup_import_confirm:
      "Импорт перезапишет текущую конфигурацию и хранилище (кроме конфигурации Dashboard). Продолжить?",
    import_success: "Восстановление выполнено",
    import_failed: "Ошибка восстановления",
    backup_failed: "Ошибка резервного копирования",
    audit_clear_confirm: "Очистить все записи аудита?",
    audit_cleared: "Журнал аудита очищен",
    last_run: "Последний запуск",
    never: "Никогда",
    run_count: "Количество запусков",
    action_load_module: "Загрузить модуль",
    action_unload_module: "Выгрузить модуль",
    action_load_adapter: "Загрузить адаптер",
    action_unload_adapter: "Выгрузить адаптер",
    action_config_update: "Обновить конфигурацию",
    action_config_source_save: "Сохранить исходный код",
    action_storage_set: "Установить хранилище",
    action_storage_delete: "Удалить хранилище",
    action_package_install: "Установить пакет",
    action_clear_events: "Очистить события",
    action_restart_framework: "Перезапустить фреймворк",
    action_backup_import: "Импортировать backup",
    files: "Файлы",
    files_desc: "Просмотр и управление файлами проекта",
    search_files: "Поиск файлов...",
    new_file: "Новый файл",
    new_folder: "Новая папка",
    upload: "Загрузить",
    save: "Сохранить",
    upload_success: "Загрузка успешна",
    upload_failed: "Ошибка загрузки",
    upload_drop: "Перетащите файлы сюда или нажмите для загрузки",
    file_saved: "Файл сохранён",
    file_save_failed: "Ошибка сохранения",
    file_too_large: "Файл слишком большой для редактирования",
    binary_file: "Бинарный файл, нельзя редактировать",
    file_not_found: "Файл не найден",
    folder_exists: "Папка уже существует",
    delete_confirm: "Удалить выбранные файлы? Это действие нельзя отменить.",
    delete_success: "Удалено",
    delete_failed: "Ошибка удаления",
    rename_label: "Новое имя",
    rename_success: "Переименовано",
    rename_failed: "Ошибка переименования",
    new_file_name: "Имя файла",
    file_name: "Имя",
    file_size: "Размер",
    file_perm: "Права",
    file_modified: "Изменён",
    parent_dir: "Вверх",
    toggle_hidden: "Скрытые",
    show_hidden: "Скрытые",
    new_folder_name: "Имя папки",
    enable_module: "Включить",
    disable_module: "Отключить",
    reload_module: "Перезагрузить",
    uninstall_module: "Удалить",
    uninstall_confirm: "Удалить этот модуль? Пакет будет удалён.",
    module_uninstalling: "Удаление...",
    module_version: "Версия",
    module_author: "Автор",
    module_no_desc: "Без описания",
    module_enabled_not_loaded: "Включён, не загружен",
    module_disabled: "Отключён",
    reload: "Перезагрузить",
    action_enable_module: "Включить модуль",
    action_disable_module: "Отключить модуль",
    action_reload_module: "Перезагрузить модуль",
    action_uninstall_module: "Удалить модуль",
    search_modules: "Поиск модулей...",
    module_loaded_dynamic: "Модуль загружен динамически",
    installed_no_restart: "Установлено, модуль загружен автоматически",
    permissions: "Права доступа",
    download: "Скачать",
    chmod: "Изменить права",
    chmod_prompt: "Введите права (например, 755, 644)",
    pkg_manager: "Пакеты",
    pkg_manager_desc:
      "Управление установленными Python пакетами, проверка обновлений и установка новых",
    pkg_installed: "Установленные",
    pkg_updates: "Обновления",
    pkg_install_new: "Установить новый",
    pkg_updates_available: "Доступные обновления",
    pkg_upgrade_all: "Обновить все",
    pkg_install_placeholder:
      "Имя пакета (например, requests или numpy==1.24.0)",
    pkg_install_hint:
      "Поддерживается имя пакета, с версией (package==version) или несколько пакетов через пробел",
    pkg_name: "Пакет",
    pkg_version: "Версия",
    pkg_type: "Тип",
    pkg_latest: "Последняя",
    pkg_type_module: "Модуль",
    pkg_type_adapter: "Адаптер",
    pkg_type_library: "Библиотека",
    pkg_no_installed: "Установленные пакеты не найдены",
    pkg_no_updates: "Все пакеты актуальны",
    pkg_checking_updates: "Проверка обновлений...",
    pkg_upgrading: "Обновление...",
    pkg_upgrade: "Обновить",
    pkg_upgrade_confirm: "Обновить следующие пакеты?",
    pkg_upgrade_all_confirm:
      "Обновить все устаревшие пакеты? Это может занять некоторое время.",
    pkg_uninstall_confirm:
      "Удалить этот пакет? Это может вызвать проблемы с зависимостями.",
    pkg_cannot_uninstall: "Нельзя удалить базовый пакет",
    pkg_install_success: "Пакет установлен",
    pkg_upgrade_success: "Пакет обновлён",
    pkg_install_failed: "Ошибка установки пакета",
    pkg_upgrade_failed: "Ошибка обновления пакета",
    store_version_current: "Текущая",
    store_version_latest: "Последняя",
    store_update_available: "Доступно обновление",
    action_package_upgrade: "Обновить пакет",
    action_package_uninstall: "Удалить пакет",
    upgrade_all: "Обновить все",
    module_hub: "Центр модулей",
    module_hub_desc: "Управление модулями, магазин, управление Python пакетами",
    registered: "Зарегистрированные",
    registered_desc: "Управление зарегистрированными модулями и адаптерами",
    compress: "Сжать",
    decompress: "Распаковать",
    upload_folder: "Загрузить папку",
    task_list: "Список задач",
    cmd_management: "Управление командами",
    cmd_management_desc:
      "Управление командами: псевдонимы, фильтры платформ, вкл/выкл",
    cmd_global_settings: "Глобальные настройки команд",
    cmd_prefix: "Префикс команд",
    cmd_case_sensitive: "Чувствительность к регистру",
    cmd_allow_space_prefix: "Разрешить пробел как префикс",
    cmd_must_at_bot: "Обязательно @Bot",
    cmd_list: "Список команд",
    cmd_enabled: "Включена",
    cmd_disabled: "Отключена",
    cmd_custom_aliases: "Пользовательские псевдонимы",
    cmd_alias_placeholder: "Введите псевдоним и нажмите Enter",
    cmd_allowed_platforms: "Разрешённые платформы",
    cmd_allowed_platforms_hint: "Оставьте пустым для всех платформ",
    cmd_blocked_platforms: "Заблокированные платформы",
    cmd_transform_to: "Преобразование команды",
    cmd_transform_placeholder:
      "Оставьте пустым для отсутствия преобразования, введите имя целевой команды для перенаправления",
    cmd_original_aliases_label: "Оригинальные псевдонимы",
    cmd_no_commands: "Нет зарегистрированных команд",
    cmd_help: "Справка",
    cmd_usage: "Использование",
    cmd_group: "Группа команд",
    cmd_save_success: "Правило команды сохранено",
    cmd_save_failed: "Ошибка сохранения",
    cmd_yes: "Да",
    cmd_no: "Нет",
    cmd_aliases_label: "Псевдонимы",
    group_overview: "Обзор",
    group_events: "События",
    group_extensions: "Расширения",
    group_system: "Система",
    group_tools: "Инструменты",
    group_monitoring: "Мониторинг",
    group_network: "Сеть",
    group_config: "Конфигурация",
    event_stream: "Поток событий",
    event_stream_desc: "Просмотр потока событий в реальном времени",
    event_builder_desc:
      "Создание пользовательских событий для отладки и тестирования",
    lifecycle_desc: "Просмотр процесса запуска и работы системы",
    settings_title: "Настройки панели",
    settings_appearance: "Внешний вид",
    settings_appearance_behavior: "Внешний вид и поведение",
    settings_behavior: "Поведение",
    settings_theme: "Тёмная тема",
    settings_language: "Язык",
    settings_ui_style: "Стиль интерфейса",
    settings_accent_color: "Акцентный цвет",
    settings_accent_desc:
      "Выберите акцент — кнопки, ссылки и выделения изменятся",
    settings_background: "Цвет фона",
    settings_background_desc: "Настройте цвет фона страницы",
    settings_custom: "Свой",
    settings_reset: "Сбросить",
    settings_upload_image: "Загрузить изображение",
    settings_bg_auto_theme: "Авто-цвет из фона",
    settings_sidebar: "Свернуть боковую панель",
    settings_show_node_selector: "Показать селектор узлов",
    settings_show_node_selector_desc:
      "При включении отображается только если настроены удаленные узлы",
    settings_remember_groups: "Запомнить состояние групп",
    settings_remember_groups_desc:
      "Сохранять развернутое/свернутое состояние групп после обновления",
    settings_refresh_interval: "Интервал обновления",
    settings_event_limit: "Лимит событий",
    settings_disabled: "Отключено",
    settings_restart_desc: "Перезагрузить все модули и адаптеры",
    settings_logout: "Выйти",
    settings_logout_desc: "Очистить токен и вернуться к входу",
    settings_page_desc: "Настройте внешний вид и поведение панели",
    settings_global_scope: "Глобальная синхронизация",
    settings_global_active:
      "Глобальный внешний вид включён — все пользователи видят одинаковое оформление",
    settings_layout: "Макет",
    settings_system: "Система",
    settings_dash_title: "Заголовок панели",
    settings_dash_title_desc: "Настройка текста заголовка",
    upload_modal_title: "Загрузка и установка",
    upload_drop_hint: "Перетащите файл или нажмите для выбора",
    force_install: "Принудительная установка",
    force_install_desc:
      "Принудительная переустановка независимо от версии (--force-reinstall)",
    start_install: "Начать установку",
    pip_mirror: "pip зеркало",
    install_version: "Версия установки",
    latest_version: "Последняя",
    batch_install: "Пакетная установка",
    batch_install_count: "Выбрано: {n}",
    dependencies: "Зависимости",
    version_history: "История версий",
    no_dependencies: "Нет внешних зависимостей",
    pkg_detail_loading: "Загрузка деталей...",
    pkg_detail_failed: "Не удалось загрузить детали",
    view_detail: "Детали",
    pkg_git_install: "Установка из Git",
    pkg_git_install_desc:
      "Установка напрямую из Git-репозитория, PyPI не требуется",
    pkg_git_install_placeholder: "git+https://github.com/user/repo.git",
    pkg_git_examples:
      "Пример: git+https://github.com/ErisPulse/erispulse-module-demo.git",
    pkg_git_installed: "Установленные Git-модули",
    pkg_git_no_packages: "Нет модулей, установленных из Git",
    pkg_git_update_available: "Доступно обновление",
    pkg_git_upgrade: "Обновить",
    pkg_git_url: "URL репозитория",
    upload_complete: "Загрузка завершена",
    upload_file_too_large: "Файл слишком большой",
    install_with_options: "Параметры установки",
    status_icons_conn: "Соединение",
    status_conn_disconnected: "Отключено",
    status_conn_connected: "Подключено",
    status_conn_error: "Ошибка соединения",
    expand_all: "Развернуть всё",
    collapse_all: "Свернуть всё",
    group_module_views: "Представления модулей",
    module_view_load_error: "Не удалось загрузить представление модуля",
    framework_config: "Конфигурация фреймворка",
    framework_config_desc:
      "Просмотр и изменение основной конфигурации ErisPulse",
    restart_required_hint:
      "⚠ Для применения изменений требуется перезапуск фреймворка",
    fw_section_server: "Сервер",
    fw_section_logger: "Логгер",
    fw_section_storage: "Хранилище",
    fw_section_event_message: "Событие › Сообщение",
    fw_section_event_command: "Событие › Команда",
    fw_section_framework: "Фреймворк",
    fw_section_i18n: "Локализация",
    fw_section_adapters: "Адаптеры",
    fw_section_modules: "Модули",
    fw_field_server_host: "Адрес прослушивания",
    fw_field_server_port: "Порт прослушивания",
    fw_field_server_ssl_certfile:
      "Путь к SSL сертификату, null для отключения SSL",
    fw_field_server_ssl_keyfile: "Путь к SSL закрытому ключу",
    fw_field_logger_level:
      "Уровень логирования: DEBUG / INFO / WARNING / ERROR",
    fw_field_logger_log_files: 'Пути к файлам логов, напр. ["logs/app.log"]',
    fw_field_logger_memory_limit: "Макс. записей логов в памяти",
    fw_field_storage_use_global_db:
      "Использовать общую базу данных между модулями",
    fw_field_event_message_ignore_self:
      "Игнорировать сообщения, отправленные ботом",
    fw_field_event_command_prefix: "Префикс команды",
    fw_field_event_command_case_sensitive: "Учитывать регистр команд",
    fw_field_event_command_allow_space_prefix:
      "Разрешить пробелы перед префиксом",
    fw_field_event_command_must_at_bot: "Требовать @bot для вызова команд",
    fw_field_framework_enable_lazy_loading:
      "Включить отложенную загрузку модулей",
    fw_field_logger_format: "Формат лога: rich (цветной) / plain",
    fw_field_framework_uninit_timeout: "Тайм-аут деинициализации (сек)",
    fw_field_framework_strict_mode:
      "Строгий режим: 0=мягкий / 1=строгий-пропуск / 2=строгий-фатальный",
    fw_field_framework_strict_mode_exceptions: "Исключения строгого режима",
    adapter_config: "Настройки адаптера",
    adapter_config_desc:
      "Управление подключениями и учетными записями адаптеров платформ",
    components: "Компоненты",
    components_desc: "Управление конфигурациями адаптеров и модулей",
    components_config: "Конфиг компонентов",
    components_config_desc: "Управление конфигурациями адаптеров и модулей",
    ext_config: "Конфиг расширений",
    ext_config_desc: "Управление конфигурациями адаптеров и модулей",
    ext_settings: "Настройки расширений",
    ext_settings_desc: "Управление конфигурациями адаптеров и модулей",
    plugin_config: "Настройки плагинов",
    plugin_config_desc: "Управление конфигурациями адаптеров и модулей",
    adapter_global_config: "Глобальные настройки",
    adapter_accounts: "Учетные записи",
    add_account: "Добавить аккаунт",
    remove_account: "Удалить аккаунт",
    account_name: "Имя аккаунта",
    save_adapter_config: "Сохранить",
    no_config_schema: "У этого адаптера нет схемы конфигурации",
    config_validation_failed: "Ошибка валидации конфигурации",
    adapter_config_saved: "Конфигурация адаптера сохранена",
    module_config: "Настройки модулей",
    module_config_desc: "Управление настройками модулей",
    module_config_empty: "Нет модулей со схемой конфигурации",
    save_module_config: "Сохранить",
    module_config_saved: "Настройки модуля сохранены",
    account_removed: "Аккаунт удален",
    account_added: "Аккаунт добавлен",
    confirm_remove_account: "Подтвердите удаление аккаунта?",
    new_account_default_name: "new_account",
    select_adapter_prompt: "Выберите адаптер для настройки",
    adapter_no_adapters: "Адаптеры еще не установлены~",
    fw_server_warn_title: "⚠ Подтвердите изменение конфигурации сервера",
    fw_server_warn_text:
      "Вы изменяете настройки подключения сервера ErisPulse (host/port/ssl). Убедитесь, что вы знаете, что делаете!\n\nИзменение в Docker контейнере может сделать маршрутизаторы ErisPulse недоступными извне.",
    fw_unknown_field: "Неизвестное поле",
    fw_win_warn:
      "Ограничения Windows могут помешать автоматическому обновлению. Обновите ErisPulse вручную.",
    fw_cannot_update: "Автообновление не поддерживается в этой среде",
    fw_popup_msg: "Доступна новая версия ErisPulse v{latest}",
    fw_unknown_field_desc:
      "Это поле не входит в стандартную конфигурацию текущей версии. Рекомендуется удалить.",
    fw_reset_default: "Сбросить",
    fw_reset_confirm: "Сбросить {key} к значению по умолчанию?",
    fw_reset_done: "Сброшено к умолчанию",
    fw_delete_field: "Удалить поле",
    fw_delete_confirm: "Удалить поле {key}?",
    fw_delete_done: "Поле удалено",
    fw_add_field: "Добавить поле",
    fw_add_field_section_hint:
      "Имя секции (напр. server, logger, event.command)",
    fw_add_field_name_hint: "Имя поля",
    fw_add_field_value_hint: "Значение (JSON или текст)",
    fw_update_title: "Обновление фреймворка",
    fw_update_title_desc:
      "Просмотр обновлений, заметок о выпуске и установка обновлений",
    release_notes_unavailable: "Не удалось получить заметки о выпуске",
    fw_current_version: "Текущая версия",
    fw_latest_version: "Последняя версия",
    fw_select_version: "Выберите версию",
    fw_check_updates: "Проверить обновления",
    fw_install_update: "Установить обновление",
    fw_latest_already: "Уже актуально",
    fw_current: "текущая",
    fw_downgrade_title: "⚠ Подтверждение даунгрейда",
    fw_downgrade_text:
      "Вы собираетесь понизить ErisPulse до {v}. Это может вызвать проблемы совместимости. Продолжить?",
    about: "О проекте",
    about_tagline:
      "Фреймворк для разработки мультиплатформенных ботов на основе событий",
    about_desc:
      "ErisPulse — это библиотека с открытым исходным кодом, целью которой является предоставление простого и удобного фреймворка для создания асинхронных неблокирующих ботов. Основана на стандарте OneBot12, пишите один раз — разворачивайте на любой платформе. Гибкая система плагинов, горячая перезагрузка и полный набор инструментов разработчика подходят для всего — от простых чат-ботов до сложных систем автоматизации.",
    about_feat_event_title: "Архитектура на событиях",
    about_feat_event_desc:
      "Чёткая модель событий на основе стандарта OneBot12 делает обработку сообщений интуитивной и эффективной",
    about_feat_cross_title: "Кроссплатформенность",
    about_feat_cross_desc:
      "Плагины пишутся один раз и работают на всех платформах без повторной разработки",
    about_feat_module_title: "Модульный дизайн",
    about_feat_module_desc:
      "Гибкая система плагинов, легко расширяется и интегрируется, поддержка горячей замены модулей",
    about_feat_reload_title: "Горячая перезагрузка",
    about_feat_reload_desc:
      "Перезагрузка кода без перезапуска во время разработки, значительно ускоряет итерации",
    about_star_hint:
      "Если вам нравится наш проект, поставьте нам Star~ Это действительно важно!",
    about_contributors: "Участники",
    about_docs: "Документация",
    about_discussions: "Обсуждения",
    about_market: "Магазин модулей",
    cluster_management: "Кластер",
    cluster_desc:
      "Добавление, редактирование, удаление удалённых узлов, сравнение возможностей",
    cluster_overview: "Обзор",
    cluster_overview_desc: "Общий обзор состояния всех узлов",
    node_local: "Локальный",
    node_online: "Онлайн",
    node_offline: "Офлайн",
    node_add: "Добавить узел",
    node_edit: "Редактировать",
    node_delete: "Удалить",
    node_ping: "Проверить связь",
    node_probe: "Перепроверить",
    node_id: "ID узла",
    node_name: "Имя узла",
    node_url: "URL узла",
    node_token: "Токен доступа",
    node_url_placeholder: "http://192.168.1.100:8000",
    node_token_placeholder: "Токен удалённого Dashboard",
    node_add_success: "Узел добавлен",
    handshake_success:
      "Узел автоматически зарегистрирован на удалённой стороне",
    remote_unauthorized:
      "Ошибка аутентификации удалённого узла, проверьте токен",
    toggle_url_visibility: "Показать/скрыть URL",
    node_add_failed: "Не удалось добавить узел",
    node_remove_confirm: "Удалить этот узел?",
    node_ping_success: "Подключено",
    node_ping_failed: "Ошибка подключения",
    leave_empty_to_keep: "оставить без изменений",
    node_probing: "Проверка возможностей...",
    node_probe_complete: "Проверка завершена",
    unsupported_on_node: "Не поддерживается на этом узле",
    unsupported_features: "Неподдерживаемые функции",
    capability_matrix: "Сравнение возможностей",
    cluster_card_detail: "Подробности",
    cluster_node_count: "узел(ов)",
    process_memory: "Процесс",
    threads: "Потоки",
    connections: "Соединения",
    cap_status: "Статус",
    cap_status_desc: "Просмотр состояния узла",
    cap_system: "Система",
    cap_system_desc: "Просмотр использования ресурсов",
    cap_adapters: "Адаптеры",
    cap_adapters_desc: "Управление адаптерами сообщений",
    cap_modules: "Модули",
    cap_modules_desc: "Просмотр зарегистрированных модулей",
    cap_bots: "Боты",
    cap_bots_desc: "Управление экземплярами ботов",
    cap_events: "События",
    cap_events_desc: "Поток событий в реальном времени",
    cap_config: "Конфиг",
    cap_config_desc: "Просмотр и редактирование конфигурации",
    cap_storage: "Хранилище",
    cap_storage_desc: "Доступ к хранилищу ключ-значение",
    cap_store: "Магазин",
    cap_store_desc: "Просмотр и установка расширений",
    cap_packages: "Пакеты",
    cap_packages_desc: "Управление пакетами Python",
    cap_logs: "Журналы",
    cap_logs_desc: "Просмотр системных журналов",
    cap_lifecycle: "Жизненный цикл",
    cap_lifecycle_desc: "Управление модулями",
    cap_performance: "Производительность",
    cap_performance_desc: "Просмотр метрик",
    cap_routes: "Маршруты",
    cap_routes_desc: "Просмотр API маршрутов",
    cap_message_stats: "Статистика",
    cap_message_stats_desc: "Статистика сообщений",
    cap_framework_update: "Обновление",
    cap_framework_update_desc: "Проверка обновлений",
    cap_event_builder: "Конструктор событий",
    cap_event_builder_desc: "Создание и отправка событий",
    cap_config_source: "Источник конфига",
    cap_config_source_desc: "Просмотр источника конфигурации",
    cap_module_views: "Представления",
    cap_module_views_desc: "Пользовательские страницы модулей",
    cluster_sync: "Синхронизация событий",
    cluster_sync_desc: "Пересылка событий между узлами",
    sync_source: "Источник",
    sync_target: "Цель",
    sync_start: "Начать синхронизацию",
    sync_success: "Синхронизация завершена",
    sync_failed: "Ошибка синхронизации",
    latency: "Задержка",
    dashboard_version: "Версия Dashboard",
    node_already_exists: "ID узла уже существует",
    node_not_found: "Узел не найден",
    just_now: "только что",
    time_ago: "назад",
    module_load_mode: "Режим загрузки",
    module_lazy: "Отложенная",
    module_eager: "Немедленная",
    module_priority: "Приоритет",
    module_depends: "Зависимости",
    module_views_count: "Представления",
    capability: "Возможности",
  },
};

const STATUS_FRAMES = {
  conn: ["Disconnected.png", "Connected.png", "Connection Error  Broken.png"],
};

const STATUS_STATE_KEYS = {
  conn: [
    "status_conn_disconnected",
    "status_conn_connected",
    "status_conn_error",
  ],
};

const _statusRegistry = {};

function createStatusIcon(container, config) {
  const group = config.group;
  const size = config.size || "lg";
  const showLabel = config.showLabel !== false;
  const frames = STATUS_FRAMES[group];
  if (!frames) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "status-icon-container";

  const framesDiv = document.createElement("div");
  framesDiv.className = "status-icon-frames size-" + size;

  frames.forEach(function (src, i) {
    var img = document.createElement("img");
    img.src = "/Dashboard/static/res/" + group + "/" + encodeURIComponent(src);
    img.alt = src.replace(/\.png$/, "");
    img.dataset.frame = String(i);
    if (i === 0) img.classList.add("active");
    framesDiv.appendChild(img);
  });

  wrapper.appendChild(framesDiv);

  var labelEl = null,
    stateEl = null;
  if (showLabel) {
    labelEl = document.createElement("div");
    labelEl.className = "status-icon-label";
    labelEl.textContent = t("status_icons_" + group) || group;
    wrapper.appendChild(labelEl);

    stateEl = document.createElement("div");
    stateEl.className = "status-icon-state";
    stateEl.textContent = t(STATUS_STATE_KEYS[group][0]) || "";
    wrapper.appendChild(stateEl);
  }

  container.appendChild(wrapper);

  var instance = {
    id: "si_" + group + "_" + Math.random().toString(36).substr(2, 6),
    group: group,
    container: container,
    wrapper: wrapper,
    framesDiv: framesDiv,
    stateEl: stateEl,
    currentFrame: 0,
    animating: false,
    _timers: [],
    destroy: function () {
      instance._timers.forEach(clearTimeout);
      instance._timers = [];
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      delete _statusRegistry[instance.id];
    },
    setState: function (frameIndex, animate) {
      if (frameIndex < 0 || frameIndex >= frames.length) return;
      if (frameIndex === instance.currentFrame && !instance.animating) return;
      instance._timers.forEach(clearTimeout);
      instance._timers = [];
      instance.animating = false;

      if (animate) {
        _crtTransition(instance, frameIndex);
      } else {
        _setFrameDirect(instance, frameIndex);
      }
    },
  };

  _statusRegistry[instance.id] = instance;
  return instance;
}

function _setFrameDirect(inst, frameIndex) {
  var imgs = inst.framesDiv.querySelectorAll("img");
  imgs.forEach(function (img) {
    img.classList.remove("active", "crt-out", "crt-in");
    img.style.clipPath = "";
  });
  if (imgs[frameIndex]) imgs[frameIndex].classList.add("active");

  var beam = inst.framesDiv.querySelector(".scanline-beam");
  if (beam) beam.remove();
  inst.framesDiv.classList.remove("scanning");

  inst.currentFrame = frameIndex;
  if (inst.stateEl) {
    var key =
      STATUS_STATE_KEYS[inst.group] &&
      STATUS_STATE_KEYS[inst.group][frameIndex];
    if (key) inst.stateEl.textContent = t(key) || "";
  }
}

function _crtTransition(inst, newFrame) {
  if (inst.animating) {
    inst._timers.forEach(clearTimeout);
    inst._timers = [];
    var oldImgs = inst.framesDiv.querySelectorAll("img");
    oldImgs.forEach(function (img) {
      img.classList.remove("active", "crt-out", "crt-in");
      img.style.clipPath = "";
    });
    var oldBeam = inst.framesDiv.querySelector(".scanline-beam");
    if (oldBeam) oldBeam.remove();
    inst.framesDiv.classList.remove("scanning");
  }

  inst.animating = true;
  inst.framesDiv.classList.add("scanning");

  var imgs = inst.framesDiv.querySelectorAll("img");
  var oldFrame = inst.currentFrame;
  var oldImg = imgs[oldFrame];
  var newImg = imgs[newFrame];

  var sameFrame = oldImg === newImg;

  if (oldImg && !sameFrame) {
    oldImg.classList.remove("active", "crt-in");
    oldImg.classList.add("crt-out");
  }

  var beamOut = document.createElement("div");
  beamOut.className = "scanline-beam sweep-up";
  inst.framesDiv.appendChild(beamOut);

  inst._timers.push(
    setTimeout(function () {
      if (oldImg && !sameFrame) {
        oldImg.classList.remove("crt-out");
        oldImg.style.clipPath = "inset(100% 0 0 0)";
      }
      beamOut.remove();

      if (newImg) {
        newImg.classList.remove("crt-out");
        newImg.style.clipPath = "";
        newImg.classList.add("crt-in");
      }

      var beamIn = document.createElement("div");
      beamIn.className = "scanline-beam sweep-down";
      inst.framesDiv.appendChild(beamIn);

      inst._timers.push(
        setTimeout(function () {
          imgs.forEach(function (img) {
            img.classList.remove("crt-out", "crt-in", "active");
            img.style.clipPath = "";
          });
          if (imgs[newFrame]) imgs[newFrame].classList.add("active");

          beamIn.remove();
          inst.framesDiv.classList.remove("scanning");
          inst.currentFrame = newFrame;
          inst.animating = false;

          if (inst.stateEl) {
            var key =
              STATUS_STATE_KEYS[inst.group] &&
              STATUS_STATE_KEYS[inst.group][newFrame];
            if (key) inst.stateEl.textContent = t(key) || "";
          }
        }, 280),
      );
    }, 280),
  );
}

function updateStatusGroup(group, frameIndex, animate) {
  Object.keys(_statusRegistry).forEach(function (id) {
    var inst = _statusRegistry[id];
    if (inst.group === group) {
      inst.setState(frameIndex, animate !== false);
    }
  });
}

var _badgeInst = null,
  _panelInst = null,
  _collapseTimer = null;

function initHeaderStatusIcon() {
  var badgeContainer = document.getElementById("status-badge-icon");
  var panelContainer = document.getElementById("status-panel-icon");
  if (!badgeContainer || !panelContainer || badgeContainer.dataset.init === "1")
    return;
  badgeContainer.dataset.init = "1";

  _badgeInst = createStatusIcon(badgeContainer, {
    group: "conn",
    size: "custom",
    showLabel: false,
  });
  _panelInst = createStatusIcon(panelContainer, {
    group: "conn",
    size: "custom",
    showLabel: false,
  });

  _badgeInst.setState(0, false);
  _panelInst.setState(0, false);
}

function showConnPanel(title, desc) {
  var panel = document.getElementById("connPanel");
  var titleEl = document.getElementById("connPanelTitle");
  var descEl = document.getElementById("connPanelDesc");
  if (titleEl) titleEl.textContent = title || "";
  if (descEl) descEl.textContent = desc || "";
  if (panel) panel.classList.add("expanded");

  if (_collapseTimer) clearTimeout(_collapseTimer);
  _collapseTimer = setTimeout(function () {
    if (panel) panel.classList.remove("expanded");
  }, 2600);
}

function updateConnBadge(state) {
  var badge = document.getElementById("connBadge");
  var text = document.getElementById("connBadgeText");
  if (badge) {
    badge.classList.remove("connected", "disconnected");
    if (state === 1) badge.classList.add("connected");
    else if (state === 0) badge.classList.add("disconnected");
  }
  if (text) {
    var labels = [
      t("status_conn_disconnected"),
      t("status_conn_connected"),
      t("status_conn_error"),
    ];
    text.textContent = labels[state] || "";
  }
}

function connStateChange(state, animate) {
  if (_badgeInst) _badgeInst.setState(state, false);
  updateConnBadge(state);

  if (animate) {
    var titleKey = STATUS_STATE_KEYS.conn[state];
    showConnPanel(t(titleKey), t("status_icons_conn"));

    if (_panelInst) {
      _panelInst.setState(_panelInst.currentFrame, false);
      setTimeout(function () {
        if (_panelInst) _panelInst.setState(state, true);
      }, 400);
    }
  } else {
    if (_panelInst) _panelInst.setState(state, false);
  }
}

function createBotStatusIcon(botCard) {
  var container = document.createElement("div");
  container.className = "bot-card-status";
  botCard.appendChild(container);
  return createStatusIcon(container, {
    group: "conn",
    size: "bot",
    showLabel: false,
  });
}

function detectLang() {
  const saved = localStorage.getItem("ep_lang");
  if (saved) return saved;
  const bl = (
    navigator.language ||
    (navigator.languages && navigator.languages[0]) ||
    ""
  ).toLowerCase();
  if (
    bl.startsWith("zh-tw") ||
    bl.startsWith("zh-hk") ||
    bl.startsWith("zh-hant")
  )
    return "zh-TW";
  if (bl.startsWith("zh")) return "zh";
  if (bl.startsWith("ja")) return "ja";
  if (bl.startsWith("ru")) return "ru";
  return "en";
}
function getLocale() {
  const m = { zh: "zh-CN", "zh-TW": "zh-TW", ja: "ja-JP", ru: "ru-RU" };
  return m[lang] || "en-US";
}
let lang = detectLang();
function t(k) {
  return I18N[lang]?.[k] || k;
}
function cmpVer(a, b) {
  const pa = a.replace(/^v/, "").split(/[-.]/),
    pb = b.replace(/^v/, "").split(/[-.]/);
  const num = (s) => (/^\d+$/.test(s) ? parseInt(s, 10) : -1);
  const pre = (s) => {
    if (s === "dev" || s === "alpha" || s === "a") return -4;
    if (s === "beta" || s === "b") return -3;
    if (s === "rc" || s === "c") return -2;
    return 0;
  };
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    let va = i < pa.length ? pa[i] : "",
      vb = i < pb.length ? pb[i] : "";
    const na = num(va),
      nb = num(vb);
    if (na >= 0 && nb >= 0) {
      if (na !== nb) return na > nb ? 1 : -1;
      continue;
    }
    if (na >= 0) return 1;
    if (nb >= 0) return -1;
    const la = va.toLowerCase(),
      lb = vb.toLowerCase();
    if (la === lb) continue;
    return la > lb ? 1 : -1;
  }
  return 0;
}
function toggleLang() {
  const langs = ["en", "zh", "zh-TW", "ja", "ru"];
  lang = langs[(langs.indexOf(lang) + 1) % langs.length];
  localStorage.setItem("ep_lang", lang);
  applyI18n();
  loadAll();
  var activePage = document.querySelector(".page.active");
  if (activePage) {
    var pageId = activePage.id.replace("p-", "");
    var loaders = {
      dashboard: refreshDashboard,
      bots: loadBots,
      "event-stream": loadEvents,
      "module-mgmt": loadModules,
      adapter: loadAdapterConfigPage,
      store: function () {
        loadStore();
        loadPackages();
        loadPackageUpdates();
      },
      logs: loadLogs,
      "api-routes": loadApiRoutes,
      commands: loadCommands,
      files: function () {
        fmBrowse(".");
      },
      config: loadConfig,
      settings: loadSettings,
      cluster: loadClusterPage,
      about: loadAbout,
    };
    if (loaders[pageId]) loaders[pageId]();
    else if (_moduleViewLoaders && _moduleViewLoaders[pageId])
      _moduleViewLoaders[pageId]();
  }
  updateNodeSelectorUI();
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (I18N[lang][k]) el.textContent = I18N[lang][k];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const k = el.getAttribute("data-i18n-placeholder");
    if (I18N[lang][k]) el.placeholder = I18N[lang][k];
  });
  document.querySelectorAll("[data-i18n-option]").forEach((el) => {
    const k = el.getAttribute("data-i18n-option");
    if (I18N[lang][k]) el.textContent = I18N[lang][k];
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const k = el.getAttribute("data-i18n-title");
    if (I18N[lang][k]) el.title = I18N[lang][k];
  });
  const ah = document.getElementById("authHint");
  if (ah && I18N[lang].auth_hint) ah.innerHTML = I18N[lang].auth_hint;
  const titles = {
    zh: "ErisPulse 仪表盘",
    "zh-TW": "ErisPulse 儀表盤",
    ja: "ErisPulse ダッシュボード",
    ru: "ErisPulse Панель управления",
  };
  document.title = titles[lang] || "ErisPulse Dashboard";
  const htmlLangMap = { zh: "zh-CN", "zh-TW": "zh-TW", ja: "ja", ru: "ru" };
  document.documentElement.lang = htmlLangMap[lang] || "en";
  refreshConnBadgeText();
}

function refreshConnBadgeText() {
  var badge = document.getElementById("connBadge");
  var text = document.getElementById("connBadgeText");
  if (!badge || !text) return;
  var state = 0;
  if (badge.classList.contains("connected")) state = 1;
  else if (badge.classList.contains("disconnected")) state = 0;
  text.textContent = t(STATUS_STATE_KEYS.conn[state]);
}

function getTheme() {
  const s = localStorage.getItem("ep_theme");
  if (s) return s;
  return window.matchMedia("(prefers-color-scheme:dark)").matches
    ? "dark"
    : "light";
}
function applyTheme(th) {
  document.documentElement.setAttribute("data-theme", th);
  // 切换主题时重算背景遮罩与自动取色
  onThemeChanged();
}

function onThemeChanged() {
  var img = getSetting("bg_image", "");
  if (img) {
    applyBgImage(img); // 更新深/浅遮罩
    if (bgAutoThemeEnabled()) {
      extractImageColor(img, function (hex) {
        applyAccentColor(hex);
      });
    }
  } else if (bgAutoThemeEnabled()) {
    var col = getSetting("bg_color", "");
    if (col) applyAccentColor(deriveAccentFromBg(col));
  }
}
function toggleTheme() {
  const th = getTheme() === "dark" ? "light" : "dark";
  localStorage.setItem("ep_theme", th);
  applyTheme(th);
}

function getUiStyle() {
  return localStorage.getItem("ep_ui_style") || "eris";
}
function applyUiStyle(style) {
  document.documentElement.setAttribute("data-ui-style", style);
}
function applySettingUiStyle(val) {
  localStorage.setItem("ep_ui_style", val);
  applyUiStyle(val);
  if (_settingsAppearanceScope) saveGlobalAppearance();
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let _remoteAuthToastTs = 0;
var _lastErrorToast = 0;
function api(path, opts) {
  const tk = localStorage.getItem(TK);
  const headers = {
    ...(opts?.headers || {}),
    ...(tk ? { Authorization: "Bearer " + tk } : {}),
  };
  if (opts?.body && !(opts.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  return fetch(API + path, { ...opts, headers })
    .then((r) => {
      if (r.status === 401) {
        authed = false;
        localStorage.removeItem(TK);
        document.querySelector(".app").classList.remove("authed");
        showLogin();
        return null;
      }
      if (r.status === 502) {
        return r.json().then((d) => {
          if (
            d &&
            d.error === "remote_unauthorized" &&
            currentNode !== "local"
          ) {
            var now = Date.now();
            if (now - _remoteAuthToastTs > 5000) {
              _remoteAuthToastTs = now;
              toast(t("remote_unauthorized"), "er");
            }
          }
          return d;
        });
      }
      if (r.status >= 500) {
        var now = Date.now();
        if (now - _lastErrorToast > 5000) {
          _lastErrorToast = now;
          toast(t("server_error") + " (" + r.status + ")", "er");
        }
        return null;
      }
      return r.json();
    })
    .catch((e) => {
      var now = Date.now();
      if (now - _lastErrorToast > 5000) {
        _lastErrorToast = now;
        toast(t("connection_error"), "er");
      }
      return null;
    });
}

async function fetchAdapterLogos() {
  const d = await api("/api/adapter-logos");
  if (d && d.logos) _adapterLogos = d.logos;
}

function getAdapterLogo(name) {
  if (!name) return null;
  var low = name.toLowerCase(),
    best = null,
    bestLen = 0;
  for (var k in _adapterLogos) {
    if (low.indexOf(k.toLowerCase()) !== -1 && k.length > bestLen) {
      best = _adapterLogos[k];
      bestLen = k.length;
    }
  }
  return best;
}

function adapterLogoImg(name, size) {
  var s = size || 20;
  var src = getAdapterLogo(name);
  if (!src) return "";
  return (
    '<img src="' +
    esc(src) +
    '" style="width:' +
    s +
    "px;height:" +
    s +
    'px;border-radius:4px;object-fit:contain;flex-shrink:0" onerror="this.remove()">'
  );
}

function _botAvatarFallback(el) {
  var logo = el.getAttribute("data-logo");
  if (logo && el.src !== logo) {
    el.removeAttribute("data-logo");
    el.src = logo;
    var container = el.parentElement;
    if (container) {
      container.classList.add("has-logo");
      container.classList.remove("bot-avatar");
      container.classList.add("bot-avatar");
    }
    return;
  }
  var container = el.parentElement;
  if (container) {
    container.classList.remove("has-logo");
  }
  el.outerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>';
}

// 页面重定向：合并后的页面，旧 ID 重定向到宿主页 + 指定 tab
var PAGE_REDIRECTS = {
  "framework-config": { page: "config", tab: "cfg-framework" },
  "adapter-config": { page: "adapter", tab: "cfg-adapter" },
  "module-config": { page: "adapter", tab: "cfg-module" },
  "event-builder": { page: "event-stream", tab: "ev-builder" },
  modules: { page: "module-mgmt", tab: "mm-adapters" },
  "ext-modules": { page: "module-mgmt", tab: "mm-adapters" },
  "ext-store": { page: "store", tab: "st-browse" },
  "ext-packages": { page: "store", tab: "st-packages" },
  packages: { page: "store", tab: "st-packages" },
  lifecycle: { page: "logs", tab: "mon-lifecycle" },
  audit: { page: "logs", tab: "mon-audit" },
};

function go(name, el) {
  if (!authed) {
    showLogin();
    return;
  }
  // 处理重定向（合并后的页面）
  var redirect = PAGE_REDIRECTS[name];
  if (redirect) {
    var targetEl = el;
    // 如果传入的 el 是旧页面的 nav-item，找到宿主页的 nav-item
    if (el) {
      var hostNav = document.querySelector(
        '.nav-item[data-page="' + redirect.page + '"]',
      );
      if (hostNav) targetEl = hostNav;
    }
    go(redirect.page, targetEl);
    // 激活对应 tab
    var tabBtn = document.querySelector(
      "#" +
        redirect.page.replace(/-/g, "") +
        'TabBar [data-tab="' +
        redirect.tab +
        '"]',
    );
    if (!tabBtn) {
      // 通用查找：在任何 tab bar 中找 data-tab
      tabBtn = document.querySelector('[data-tab="' + redirect.tab + '"]');
    }
    if (tabBtn) tabBtn.click();
    return;
  }
  var requiredCap = _PAGE_CAPABILITY_MAP[name];
  if (requiredCap && !isCapabilitySupported(requiredCap)) {
    toast(t("unsupported_on_node") + ": " + t(name), "wr");
    return;
  }
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".page-loader-strip")
    .forEach((o) => o.remove());
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  const page = document.getElementById("p-" + name);
  if (page) {
    page.classList.add("active");
    page.classList.add("anim-enter");
    setTimeout(() => page.classList.remove("anim-enter"), 600);
  }
  if (el) {
    el.classList.add("active");
  } else {
    const navMatch = document.querySelector(
      '.nav-item[data-page="' + name + '"]',
    );
    if (navMatch) navMatch.classList.add("active");
  }
  closeSidebar();

  // 加载指示条
  if (page) {
    var strip = document.createElement("div");
    strip.className = "page-loader-strip";
    var navItem = el || document.querySelector('.nav-item[data-page="' + name + '"]');
    var iconTitle = "";
    if (navItem) {
      var spanEl = navItem.querySelector("span");
      if (spanEl) iconTitle = spanEl.textContent;
    }
    strip.innerHTML = '<span class="pl-label">' + (iconTitle || name) + "</span>";
    page.appendChild(strip);
  }
  var minDelay = new Promise(function (r) { setTimeout(r, 800); });

  const loaders = {
    dashboard: refreshDashboard,
    bots: loadBots,
    "event-stream": function () {
      loadEvents();
    },
    "module-mgmt": loadModules,
    adapter: loadAdapterConfigPage,
    store: function () {
      loadStore();
      loadPackages();
      loadPackageUpdates();
    },
    logs: loadLogs,
    "api-routes": loadApiRoutes,
    commands: loadCommands,
    files: function () {
      fmBrowse(".");
    },
    config: loadConfig,
    settings: loadSettings,
    cluster: loadClusterPage,
    about: loadAbout,
  };
  if (loaders[name]) {
    var result = loaders[name]();
    Promise.resolve(result).then(function () {
      return minDelay;
    }).then(function () {
      if (strip) { strip.classList.add("hide"); setTimeout(function () { strip.remove(); }, 350); }
    });
  } else if (_moduleViewLoaders && _moduleViewLoaders[name]) {
    var result2 = _moduleViewLoaders[name]();
    Promise.resolve(result2).then(function () {
      return minDelay;
    }).then(function () {
      if (strip) { strip.classList.add("hide"); setTimeout(function () { strip.remove(); }, 350); }
    });
  } else {
    minDelay.then(function () {
      if (strip) { strip.classList.add("hide"); setTimeout(function () { strip.remove(); }, 350); }
    });
  }

  if (name !== "logs" && _logAutoRefreshTimer) {
    clearInterval(_logAutoRefreshTimer);
    _logAutoRefreshTimer = null;
    const btn = document.getElementById("logAutoRefreshBtn");
    if (btn) btn.style.opacity = "0.5";
  }
}

let _moduleViewLoaders = {};
let _moduleViewsLoaded = false;

async function loadModuleViews() {
  try {
    const d = await api("/api/views");
    if (!d || !d.views) return;
    _renderModuleViews(d.views);
  } catch (e) {
    console.error("loadModuleViews error", e);
  }
}

function _renderModuleViews(views) {
  const sidebarNav = document.querySelector(".sidebar-nav");
  if (!sidebarNav) return;
  const contentDiv = document.querySelector(".content");
  if (!contentDiv) return;

  document
    .querySelectorAll(".nav-item[data-module-view]")
    .forEach((el) => el.remove());
  document
    .querySelectorAll(".page[data-module-view]")
    .forEach((el) => el.remove());
  document.querySelectorAll(".module-view-style").forEach((el) => el.remove());
  document.querySelectorAll(".module-view-script").forEach((el) => el.remove());
  document
    .querySelectorAll(".nav-group.module-view-group")
    .forEach((el) => el.remove());

  _moduleViewLoaders = {};

  const groups = {};
  views.forEach(function (v) {
    const g = v.group || "group_extensions";
    if (!groups[g]) groups[g] = [];
    groups[g].push(v);
  });

  views.forEach(function (v) {
    if (v.css_content) {
      const style = document.createElement("style");
      style.className = "module-view-style";
      style.setAttribute("data-view-id", v.id);
      style.textContent = v.css_content;
      document.head.appendChild(style);
    }
  });

  views.forEach(function (v) {
    if (v.js_content) {
      const script = document.createElement("script");
      script.className = "module-view-script";
      script.setAttribute("data-view-id", v.id);
      script.textContent = v.js_content;
      document.body.appendChild(script);
    }
  });

  views.forEach(function (v) {
    const pageId = "ext-" + v.id;
    const pageDiv = document.createElement("div");
    pageDiv.className = "page";
    pageDiv.id = "p-" + pageId;
    pageDiv.setAttribute("data-module-view", v.id);

    if (v.iframe_url) {
      var iframeSrc = v.iframe_url;
      if (currentNode !== "local" && iframeSrc.charAt(0) === "/") {
        var nInfo = nodeRuntimeInfo[currentNode] || {};
        if (nInfo.url) iframeSrc = nInfo.url + iframeSrc;
      }
      const sep = iframeSrc.indexOf("?") === -1 ? "?" : "&";
      pageDiv.innerHTML =
        '<iframe src="' +
        esc(iframeSrc) +
        sep +
        "token=" +
        encodeURIComponent(
          currentNode !== "local"
            ? (nodeRuntimeInfo[currentNode] || {}).token || ""
            : localStorage.getItem(TK) || "",
        ) +
        '" class="module-view-iframe" frameborder="0"></iframe>';
    } else if (v.html_content) {
      pageDiv.innerHTML = v.html_content;
    }

    contentDiv.appendChild(pageDiv);

    if (v.loader && typeof window[v.loader] === "function") {
      _moduleViewLoaders[pageId] = window[v.loader];
    }
  });

  Object.keys(groups).forEach(function (groupKey) {
    const firstView = groups[groupKey][0];

    let navGroup;
    if (groupKey.startsWith("group_")) {
      const existingTitle = sidebarNav.querySelector(
        '.nav-group-title[data-i18n="' + groupKey + '"]',
      );
      if (existingTitle) {
        navGroup = existingTitle.closest(".nav-group");
      }
    }

    if (!navGroup) {
      navGroup = document.createElement("div");
      navGroup.className = "nav-group module-view-group";
      const groupTitle = document.createElement("div");
      groupTitle.className = "nav-group-title";
      if (groupKey.startsWith("group_") && firstView.group_title) {
        // Use multi-language group_titles if available
        var gtText =
          (firstView.group_titles && firstView.group_titles[lang]) ||
          firstView.group_title;
        groupTitle.textContent = gtText;
        groupTitle.setAttribute("data-i18n", groupKey);
      } else if (groupKey.startsWith("group_")) {
        groupTitle.setAttribute("data-i18n", groupKey);
      } else {
        // Use multi-language group_titles if available
        if (firstView.group_titles && firstView.group_titles[lang]) {
          groupTitle.textContent = firstView.group_titles[lang];
        } else {
          const locale = lang;
          if (locale === "zh" || locale === "zh-TW") {
            groupTitle.textContent =
              firstView.group_title || firstView.group_title_en || groupKey;
          } else {
            groupTitle.textContent =
              firstView.group_title_en || firstView.group_title || groupKey;
          }
        }
      }
      navGroup.appendChild(groupTitle);
      sidebarNav.insertBefore(
        navGroup,
        sidebarNav.querySelector(".sidebar-footer"),
      );
    }

    groups[groupKey].forEach(function (v) {
      const pageId = "ext-" + v.id;
      const navItem = document.createElement("a");
      navItem.className = "nav-item";
      navItem.setAttribute("data-page", pageId);
      navItem.setAttribute("data-module-view", v.id);
      navItem.onclick = function () {
        go(pageId, this);
      };

      const iconSvg =
        v.icon_svg ||
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';
      navItem.innerHTML = iconSvg;

      const span = document.createElement("span");
      // Use multi-language titles dict if available
      if (v.titles && v.titles[lang]) {
        span.textContent = v.titles[lang];
      } else {
        const locale = lang;
        if (locale === "zh" || locale === "zh-TW") {
          span.textContent = v.title || v.title_en || v.id;
        } else {
          span.textContent = v.title_en || v.title || v.id;
        }
      }
      navItem.appendChild(span);
      navGroup.appendChild(navItem);
    });
  });

  _moduleViewsLoaded = true;

  // 动态视图加载后，刷新主页 pin（已 pin 的动态视图会自动出现）
  renderHomePins();
}

function _removeModuleView(viewId) {
  const pageId = "ext-" + viewId;
  const page = document.getElementById("p-" + pageId);
  if (page) page.remove();
  const navItem = document.querySelector(
    '.nav-item[data-module-view="' + viewId + '"]',
  );
  if (navItem) {
    const group = navItem.closest(".nav-group");
    navItem.remove();
    if (
      group &&
      group.classList.contains("module-view-group") &&
      group.querySelectorAll(".nav-item").length === 0
    ) {
      group.remove();
    }
  }
  document
    .querySelectorAll('.module-view-style[data-view-id="' + viewId + '"]')
    .forEach(function (el) {
      el.remove();
    });
  document
    .querySelectorAll('.module-view-script[data-view-id="' + viewId + '"]')
    .forEach(function (el) {
      el.remove();
    });
  delete _moduleViewLoaders[pageId];

  renderHomePins();
}

function showModal(title, text, actions) {
  return new Promise((r) => {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalText").innerHTML = text;
    const ac = document.getElementById("modalActions");
    ac.innerHTML = "";
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn " + (a.primary ? "btn-primary" : "btn-secondary");
      b.textContent = a.label;
      b.onclick = () => {
        document.getElementById("modalOv").classList.remove("show");
        r(a.value);
      };
      ac.appendChild(b);
    });
    document.getElementById("modalOv").classList.add("show");
  });
}
function confirm2(title, text) {
  return showModal(title, text, [
    { label: t("cancel"), value: false },
    { label: t("ok"), value: true, primary: true },
  ]);
}
function prompt2(title, text, defaultValue) {
  return new Promise(function (r) {
    var input = document.createElement("input");
    input.className = "fw-input modal-input";
    input.type = "text";
    input.value = defaultValue || "";
    input.placeholder = text || "";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    var textEl = document.getElementById("modalText");
    textEl.innerHTML = "";
    textEl.appendChild(input);
    document.getElementById("modalTitle").textContent = title;

    var ac = document.getElementById("modalActions");
    ac.innerHTML = "";
    var cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = t("cancel");
    cancelBtn.onclick = function () {
      document.getElementById("modalOv").classList.remove("show");
      r(null);
    };
    ac.appendChild(cancelBtn);

    var okBtn = document.createElement("button");
    okBtn.className = "btn btn-primary";
    okBtn.textContent = t("ok");
    okBtn.onclick = function () {
      document.getElementById("modalOv").classList.remove("show");
      r(input.value);
    };
    ac.appendChild(okBtn);

    document.getElementById("modalOv").classList.add("show");
    setTimeout(function () {
      input.focus();
      input.select();
    }, 100);
  });
}
function toggleNavGroup(titleEl) {
  titleEl.parentElement.classList.toggle("collapsed");
  // 保存状态
  saveNavGroupStates();
}

function saveNavGroupStates() {
  var enabled = localStorage.getItem("ep_remember_groups") !== "false";
  if (!enabled) return;
  var state = {};
  document.querySelectorAll(".sidebar-nav .nav-group").forEach(function (g) {
    var title = g.querySelector(".nav-group-title");
    if (!title) return;
    var key = title.getAttribute("data-i18n") || "";
    if (key) state[key] = g.classList.contains("collapsed");
  });
  localStorage.setItem("ep_nav_group_states", JSON.stringify(state));
}

function restoreNavGroupStates() {
  var enabled = localStorage.getItem("ep_remember_groups") !== "false";
  if (!enabled) return;
  var raw = localStorage.getItem("ep_nav_group_states");
  if (!raw) return;
  try {
    var state = JSON.parse(raw);
    document.querySelectorAll(".sidebar-nav .nav-group").forEach(function (g) {
      var title = g.querySelector(".nav-group-title");
      if (!title) return;
      var key = title.getAttribute("data-i18n") || "";
      if (state[key]) g.classList.add("collapsed");
    });
  } catch (e) {}
}

function applySettingRememberGroups(enabled) {
  localStorage.setItem("ep_remember_groups", enabled);
  if (!enabled) {
    localStorage.removeItem("ep_nav_group_states");
  } else {
    saveNavGroupStates();
  }
}
function alert2(title, text) {
  return showModal(title, text, [
    { label: t("ok"), value: true, primary: true },
  ]);
}

function showOutputModal(title, lines, actions) {
  return new Promise((r) => {
    document.getElementById("outputTitle").textContent = title;
    const pre = document.getElementById("outputPre");
    pre.textContent = (lines || []).join("\n") || "(no output)";
    const ac = document.getElementById("outputActions");
    ac.innerHTML = "";
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn " + (a.primary ? "btn-primary" : "btn-secondary");
      b.textContent = a.label;
      b.onclick = () => {
        document.getElementById("outputOv").classList.remove("show");
        r(a.value);
      };
      ac.appendChild(b);
    });
    document.getElementById("outputOv").classList.add("show");
  });
}

function showAdapterReloadLog(module, displayName) {
  var overlay = document.getElementById("outputOv");
  document.getElementById("outputTitle").textContent =
    (displayName || module) + " — 重载日志";
  var pre = document.getElementById("outputPre");
  var origMaxHeight = pre.style.maxHeight;
  pre.style.maxHeight = "400px";
  pre.textContent = "正在收集日志...\n";

  var ac = document.getElementById("outputActions");
  ac.innerHTML = "";
  var closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-primary";
  closeBtn.textContent = t("ok");
  ac.appendChild(closeBtn);

  var pollTimer = null;
  var startTime = Date.now();
  var seenLogs = new Set();
  var stopped = false;

  function stopPolling() {
    stopped = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  closeBtn.onclick = function () {
    stopPolling();
    pre.style.maxHeight = origMaxHeight;
    overlay.classList.remove("show");
  };

  overlay.classList.add("show");

  async function fetchLogs() {
    if (stopped) return;
    try {
      var data = await api(
        "/api/logs?module=" + encodeURIComponent(module) + "&limit=80",
      );
      if (!data || !data.logs) return;

      var entries = data.logs.slice().reverse();
      var newLines = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var key = e.full || e.timestamp + "|" + e.message;
        if (!seenLogs.has(key)) {
          seenLogs.add(key);
          newLines.push(e.message || "");
        }
      }

      if (newLines.length > 0) {
        if (pre.textContent.indexOf("正在收集日志") === 0) {
          pre.textContent = "";
        }
        pre.textContent += newLines.join("\n") + "\n";
        pre.scrollTop = pre.scrollHeight;
      }
    } catch (e) {}

    if (Date.now() - startTime > 15000) {
      stopPolling();
      pre.textContent += "\n— 日志收集已自动停止 —";
    }
  }

  fetchLogs();
  pollTimer = setInterval(fetchLogs, 800);
}

function toast(msg, type) {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);padding:10px 24px;border-radius:8px;font-size:14px;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:9999;opacity:0;transition:opacity .25s ease,transform .25s cubic-bezier(.4,0,.2,1);pointer-events:none";
  if (type === "ok") {
    el.style.background = "var(--ok-bg)";
    el.style.color = "var(--ok-c)";
    el.style.border = "1px solid var(--ok-bd)";
  } else if (type === "er") {
    el.style.background = "var(--er-bg)";
    el.style.color = "var(--er-c)";
    el.style.border = "1px solid var(--er-bd)";
  } else {
    el.style.background = "var(--bg-t)";
    el.style.color = "var(--tx-p)";
    el.style.border = "1px solid var(--bd)";
  }
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(12px)";
    setTimeout(() => el.remove(), 250);
  }, 2500);
}

function showLogin() {
  document.querySelector(".app").classList.remove("authed");
  document.getElementById("loginOv").classList.add("show");
  const ls = document.getElementById("loginLangSelect");
  if (ls) ls.value = lang;
  preloadLoginBg();
  document.getElementById("loginInput").focus();
}
function closeLogin() {
  document.getElementById("loginOv").classList.remove("show");
}

let _loginBgLoaded = false;
function preloadLoginBg() {
  if (getUiStyle() !== "eris" || _loginBgLoaded) return;
  const overlay = document.getElementById("loginOv");
  const loader = document.getElementById("loginBgLoader");
  if (!overlay || !loader) return;
  const img = new Image();
  img.onload = function () {
    _loginBgLoaded = true;
    overlay.classList.add("bg-ready");
    loader.classList.add("loaded");
  };
  img.onerror = function () {
    loader.classList.add("loaded");
  };
  img.src = "/Dashboard/static/res/login/Login Background.png";
}
let _loginLock = false;
async function doLogin() {
  if (_loginLock) return;
  _loginLock = true;
  const inp = document.getElementById("loginInput");
  const btn = inp.closest(".login-card").querySelector(".btn-primary");
  btn.disabled = true;
  btn.style.opacity = ".5";
  const v = inp.value.trim();
  if (!v) {
    _loginLock = false;
    btn.disabled = false;
    btn.style.opacity = "";
    return;
  }
  const d = await api("/api/auth", {
    method: "POST",
    body: JSON.stringify({ token: v }),
  });
  if (d && d.success) {
    localStorage.setItem(TK, v);
    authed = true;
    closeLogin();
    document.querySelector(".app").classList.add("authed");
    // 先加载仪表盘主体，外观延迟加载（不阻塞访问）
    loadAll();
    wsConnect();
    restartRefreshTimer();
    loadClusterNodes();
    loadGlobalAppearance();
    toast(t("logged_in"), "ok");
  } else {
    if (!authed) localStorage.removeItem(TK);
    toast(t("invalid_token"), "er");
    inp.select();
  }
  btn.disabled = false;
  btn.style.opacity = "";
  _loginLock = false;
}

function doLogout() {
  localStorage.removeItem(TK);
  authed = false;
  closeSettings();
  document.querySelector(".app").classList.remove("authed");
  showLogin();
}

function evHtml(e) {
  const tm = new Date(e.time * 1000).toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    '<div class="ev-item"><span class="ev-badge ' +
    e.type +
    '">' +
    esc(e.type) +
    '</span><div style="flex:1;min-width:0"><div>' +
    esc(e.alt_message || e.detail_type || "-") +
    "</div>" +
    (e.user_id
      ? '<div style="font-size:11px;color:var(--tx-s)">user: ' +
        esc(e.user_id) +
        "</div>"
      : "") +
    '</div><span style="font-size:11px;color:var(--tx-s);flex-shrink:0">' +
    esc(e.platform) +
    '</span><span style="font-size:11px;color:var(--tx-t);flex-shrink:0">' +
    tm +
    "</span></div>"
  );
}

async function refreshDashboard() {
  const d = await api("/api/status");
  if (!d) return;
  const fw = d.framework || {};
  window._fwStatus = fw;
  // 存储服务器平台（用于判断更新行为，而非客户端浏览器平台）
  window._serverPlatform = fw.platform || "";
  window._serverIsWindows = !!fw.is_windows;
  document.getElementById("fwDesc").textContent =
    "ErisPulse v" + fw.version + " | Python " + fw.python_version;
  document.getElementById("fwInfo").textContent = "ErisPulse v" + fw.version;
  const ad = d.adapters || {},
    mo = d.modules || {};
  let ob = 0;
  Object.values(ad).forEach((a) =>
    Object.values(a.bots || {}).forEach((b) => {
      if (b.status === "online") ob++;
    }),
  );
  document.getElementById("statGrid").innerHTML =
    statCard(
      Object.keys(ad).length,
      t("adapters"),
      '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
      "adapter",
    ) +
    statCard(
      Object.keys(mo).filter((k) => mo[k]).length,
      t("modules_label"),
      '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      "module-mgmt",
    ) +
    statCard(
      ob,
      t("online_bots"),
      '<rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/><line x1="12" y1="4" x2="12" y2="8"/><circle cx="9" cy="4" r="1.5" fill="currentColor"/><circle cx="15" cy="4" r="1.5" fill="currentColor"/>',
      "bots",
    ) +
    statCard(
      _totalEventCount,
      t("total_events"),
      '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
      "event-stream",
    );

  renderHomePins();

  let aH = "";
  Object.entries(ad).forEach(([n, i]) => {
    const on = i.status === "started";
    aH +=
      '<div class="list-row">' +
      adapterLogoImg(n, 20) +
      '<span class="chip ' +
      (on ? "chip-ok" : "chip-er") +
      '" style="min-width:60px;justify-content:center">' +
      esc(i.status) +
      '</span><span style="flex:1;font-weight:500">' +
      esc(n) +
      '</span><span style="font-size:12px;color:var(--tx-s)">' +
      Object.keys(i.bots || {}).length +
      " bots</span></div>";
  });
  document.getElementById("dashAdapters").innerHTML =
    aH ||
    '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
      t("no_adapters") +
      "</div>";

  let mH = "";
  Object.entries(mo).forEach(([n, l]) => {
    mH +=
      '<div class="list-row"><span class="chip ' +
      (l ? "chip-ok" : "chip-er") +
      '" style="min-width:60px;justify-content:center">' +
      (l ? t("active") : t("inactive")) +
      '</span><span style="flex:1;font-weight:500">' +
      esc(n) +
      "</span></div>";
  });
  document.getElementById("dashModules").innerHTML =
    mH ||
    '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
      t("no_modules") +
      "</div>";

  platforms = Object.keys(ad);
}

function statCard(v, label, icon, page) {
  const tag = page
    ? '<div class="stat-card is-link" onclick="go(' + "'" + page + "'" + ')">'
    : '<div class="stat-card">';
  return (
    tag +
    (icon
      ? '<svg class="stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        icon +
        "</svg>"
      : "") +
    '<div class="stat-val">' +
    v +
    '</div><div class="stat-label">' +
    esc(label) +
    "</div></div>"
  );
}

async function loadEvents() {
  const tf = document.getElementById("eTypeFilter")?.value || "";
  const pf = document.getElementById("ePlatFilter")?.value || "";
  const limit = getSetting("event_limit", "100");
  const u = new URLSearchParams({ limit });
  if (tf) u.set("type", tf);
  if (pf) u.set("platform", pf);
  const d = await api("/api/events?" + u);
  if (!d) return;
  allEvents = d.events || [];
  if (d.total_count !== undefined) _totalEventCount = d.total_count;
  document.getElementById("eventList").innerHTML = allEvents.length
    ? allEvents.slice().reverse().map(evHtml).join("")
    : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg><p>' +
      t("no_events") +
      "</p></div>";
  document.getElementById("dashEvents").innerHTML =
    allEvents.slice(-20).reverse().map(evHtml).join("") ||
    '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
      t("waiting_events") +
      "</div>";
  const ps = document.getElementById("ePlatFilter");
  if (ps && platforms.length) {
    const ex = new Set([...ps.options].map((o) => o.value));
    platforms.forEach((p) => {
      if (!ex.has(p)) {
        const o = document.createElement("option");
        o.value = p;
        o.textContent = p;
        ps.appendChild(o);
      }
    });
  }
}

async function clearEvents() {
  if (!authed) return showLogin();
  const ok = await confirm2(t("clear_events"), t("clear_confirm"));
  if (!ok) return;
  await api("/api/events/clear", { method: "POST" });
  allEvents = [];
  _totalEventCount = 0;
  loadEvents();
}

function _relativeTime(ts) {
  if (!ts) return t("never");
  var now = Date.now() / 1000;
  var diff = Math.floor(now - ts);
  if (diff < 10) return t("just_now");
  if (diff < 60) return diff + "s " + t("time_ago");
  if (diff < 3600) return Math.floor(diff / 60) + "min " + t("time_ago");
  if (diff < 86400) return Math.floor(diff / 3600) + "h " + t("time_ago");
  if (diff < 604800) return Math.floor(diff / 86400) + "d " + t("time_ago");
  return new Date(ts * 1000).toLocaleDateString(getLocale());
}

function _capabilityBadges(caps) {
  if (!caps || !caps.length) return "";
  var popular = ["Text", "Image", "Voice", "Markdown", "Video"];
  var shown = caps.filter(function (c) {
    return popular.indexOf(c) >= 0;
  });
  var rest = caps.length - shown.length;
  var html = shown
    .map(function (c) {
      return '<span class="bot-cap-tag">' + esc(c) + "</span>";
    })
    .join("");
  if (rest > 0)
    html += '<span class="bot-cap-tag bot-cap-more">+' + rest + "</span>";
  return '<div class="bot-caps">' + html + "</div>";
}

function _adapterStatusBadge(status) {
  var map = {
    started: { cls: "chip-ok", label: "running" },
    starting: { cls: "chip-wr", label: "starting" },
    stopping: { cls: "chip-wr", label: "stopping" },
    stopped: { cls: "chip-er", label: "stopped" },
    unknown: { cls: "chip-default", label: "unknown" },
  };
  var s = map[status] || map.unknown;
  return (
    '<span class="chip ' +
    s.cls +
    ' adapter-status-chip">' +
    esc(s.label) +
    "</span>"
  );
}

async function loadBots() {
  const d = await api("/api/bots");
  if (!d) return;
  const b = d.bots || [];
  document.getElementById("botGrid").innerHTML = b.length
    ? b
        .map((x) => {
          const i = x.info || {},
            nm = i.user_name || i.nickname || x.bot_id,
            av = i.avatar;
          const la = _relativeTime(x.last_active);
          const on = x.status === "online";
          const logoSrc = getAdapterLogo(x.platform);
          const useLogo = !av && logoSrc;
          const avCls = useLogo ? "bot-avatar has-logo" : "bot-avatar";
          const capsHtml = _capabilityBadges(x.capabilities);
          const adStatusHtml = _adapterStatusBadge(x.adapter_status);
          let avatarHtml;
          if (av) {
            avatarHtml =
              '<img src="' +
              esc(av) +
              '" data-logo="' +
              (logoSrc ? esc(logoSrc) : "") +
              '" onerror="_botAvatarFallback(this)">';
          } else if (logoSrc) {
            avatarHtml =
              '<img src="' +
              esc(logoSrc) +
              '" onerror="_botAvatarFallback(this)">';
          } else {
            avatarHtml =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>';
          }
          return (
            '<div class="bot-card" data-bot-status="' +
            (on ? "online" : "offline") +
            '"><div class="' +
            avCls +
            '">' +
            avatarHtml +
            '</div><div class="bot-card-body"><div class="bot-name-row">' +
            '<span class="bot-name">' +
            esc(nm) +
            "</span>" +
            '</div><div class="bot-platform-row">' +
            esc(x.platform) +
            " / " +
            '<code class="bot-id-code">' +
            esc(x.bot_id) +
            "</code>" +
            "</div>" +
            capsHtml +
            '</div><div class="bot-card-right"><div class="bot-status-row">' +
            '<span class="dot" style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' +
            (on ? "var(--ok-c)" : "var(--tx-t)") +
            '"></span><span style="font-size:12px;font-weight:500;color:' +
            (on ? "var(--ok-c)" : "var(--tx-s)") +
            '">' +
            (on ? t("online") : t("offline")) +
            '</span></div><div class="bot-last-active">' +
            esc(la) +
            "</div>" +
            adStatusHtml +
            "</div></div>"
          );
        })
        .join("")
    : '<div class="empty-state" style="grid-column:span 3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg><h3>' +
      t("no_bots") +
      '</h3><button class="empty-action" onclick="go(\'adapter\')">' +
      t("adapter_config") +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></button></div>';
}

async function loadModules() {
  const d = await api("/api/modules");
  if (!d) return;
  const items = d.modules || [];
  const search = (
    document.getElementById("moduleSearch")?.value || ""
  ).toLowerCase();
  const status = document.getElementById("moduleStatus")?.value || "all";
  const adapters = items.filter((m) => {
    if (m.type !== "adapter") return false;
    if (search && !m.name.toLowerCase().includes(search)) return false;
    if (status === "active" && !m.loaded) return false;
    if (status === "inactive" && m.loaded) return false;
    if (status === "loaded" && !m.loaded) return false;
    if (status === "disabled" && m.enabled) return false;
    return true;
  });
  const modules = items.filter((m) => {
    if (m.type !== "module") return false;
    if (search && !m.name.toLowerCase().includes(search)) return false;
    if (status === "active" && !m.loaded) return false;
    if (status === "inactive" && m.loaded) return false;
    if (status === "loaded" && !m.loaded) return false;
    if (status === "disabled" && m.enabled) return false;
    return true;
  });
  document.getElementById("adapterCount").textContent = adapters.length;
  document.getElementById("moduleCount").textContent = modules.length;
  // Update summary stats
  var allItems = d.modules || [];
  var allAdapters = allItems.filter(function (m) {
    return m.type === "adapter";
  });
  var allModules = allItems.filter(function (m) {
    return m.type === "module";
  });
  var activeCount = allItems.filter(function (m) {
    return m.loaded;
  }).length;
  var disabledCount = allItems.filter(function (m) {
    return !m.enabled;
  }).length;
  var el;
  if ((el = document.getElementById("statAdapterTotal")))
    el.textContent = allAdapters.length;
  if ((el = document.getElementById("statModuleTotal")))
    el.textContent = allModules.length;
  if ((el = document.getElementById("statActive")))
    el.textContent = activeCount;
  if ((el = document.getElementById("statDisabled")))
    el.textContent = disabledCount;
  var mmAd = document.getElementById("mmAdaptersCount");
  if (mmAd) mmAd.textContent = allAdapters.length;
  var mmMo = document.getElementById("mmModulesCount");
  if (mmMo) mmMo.textContent = allModules.length;
  document.getElementById("adapterList").innerHTML = adapters.length
    ? adapters.map((m) => renderPluginRow(m, true)).join("")
    : '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
      t("no_adapters") +
      "</div>";
  document.getElementById("moduleList").innerHTML = modules.length
    ? modules.map((m) => renderPluginRow(m, false)).join("")
    : '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' +
      t("no_modules") +
      ' <a class="empty-action" style="margin-top:0;margin-left:6px;padding:3px 10px;font-size:12px" onclick="go(\'store\')">' +
      t("store") +
      "</a></div>";
}
function renderPluginRow(m, isAd) {
  let statusDot = "",
    statusText = "",
    statusClass = "";
  if (m.loaded) {
    statusDot = "loaded";
    statusText = t("active");
    statusClass = "chip-ok";
  } else if (m.enabled) {
    statusDot = "enabled";
    statusText = t("module_enabled_not_loaded");
    statusClass = "chip-wr";
  } else {
    statusDot = "disabled";
    statusText = t("module_disabled");
    statusClass = "chip-er";
  }

  let meta = "";
  if (m.version)
    meta += "<span>" + t("module_version") + ": " + esc(m.version) + "</span>";
  if (m.author)
    meta += "<span>" + t("module_author") + ": " + esc(m.author) + "</span>";
  if (!meta && m.description) meta = "<span>" + esc(m.description) + "</span>";
  if (!meta) meta = "<span>" + t("module_no_desc") + "</span>";

  let acts = "";
  // Expand toggle always shown
  acts +=
    '<button class="btn btn-secondary btn-xs module-expand-btn" onclick="toggleModuleDetail(this)" title="' +
    t("view_detail") +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><polyline points="6 9 12 15 18 9"/></svg></button> ';
  if (m.loaded) {
    if (!isAd)
      acts +=
        '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' +
        esc(m.name) +
        "','reload','" +
        esc(m.type) +
        "')\">" +
        t("reload") +
        "</button> ";
    acts +=
      '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' +
      esc(m.name) +
      "','unload','" +
      esc(m.type) +
      "')\">" +
      t("unload") +
      "</button> ";
  } else if (m.enabled) {
    acts +=
      '<button class="btn btn-primary btn-xs" onclick="moduleAction(\'' +
      esc(m.name) +
      "','load','" +
      esc(m.type) +
      "')\">" +
      t("load") +
      "</button> ";
  }
  if (m.enabled) {
    acts +=
      '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' +
      esc(m.name) +
      "','disable','" +
      esc(m.type) +
      "')\">" +
      t("disable_module") +
      "</button> ";
  } else {
    acts +=
      '<button class="btn btn-primary btn-xs" onclick="moduleAction(\'' +
      esc(m.name) +
      "','enable','" +
      esc(m.type) +
      "')\">" +
      t("enable_module") +
      "</button> ";
  }
  if (!isAd && m.package) {
    acts +=
      '<button class="btn btn-danger btn-xs" onclick="moduleAction(\'' +
      esc(m.name) +
      "','uninstall','" +
      esc(m.type) +
      "','" +
      esc(m.package) +
      "')\">" +
      t("uninstall_module") +
      "</button> ";
  }

  // Build detail section
  var detailHtml = "";
  var detailItems = [];
  // 详情：状态说明（适配器/模块通用）
  detailItems.push(
    '<span class="module-detail-item"><strong>' +
      t("loaded_status") +
      ":</strong> " +
      esc(statusText) +
      "</span>",
  );
  // 详情：完整描述
  if (m.description)
    detailItems.push(
      '<span class="module-detail-item">' +
        esc(m.description) +
        "</span>",
    );
  if (isAd) {
    if (m.bots_count > 0) {
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("online_bots") +
          ":</strong> " +
          m.bots_count +
          "</span>",
      );
    }
    if (m.capabilities && m.capabilities.length) {
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("capability") +
          ":</strong> " +
          m.capabilities
            .map(function (c) {
              return '<span class="module-cap-tag">' + esc(c) + "</span>";
            })
            .join(" ") +
          "</span>",
      );
    }
    if (m.has_config != null)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("config") +
          ":</strong> " +
          (m.has_config ? t("cmd_yes") : t("cmd_no")) +
          "</span>",
      );
    if (m.has_accounts != null)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("adapter_accounts") +
          ":</strong> " +
          (m.has_accounts ? t("cmd_yes") : t("cmd_no")) +
          "</span>",
      );
  } else {
    if (m.load_strategy) {
      var ls = m.load_strategy;
      if (ls.lazy_load != null)
        detailItems.push(
          '<span class="module-detail-item"><strong>' +
            t("module_load_mode") +
            ":</strong> " +
            (ls.lazy_load ? t("module_lazy") : t("module_eager")) +
            "</span>",
        );
      if (ls.priority != null)
        detailItems.push(
          '<span class="module-detail-item"><strong>' +
            t("module_priority") +
            ":</strong> " +
            ls.priority +
            "</span>",
        );
      if (ls.depends && ls.depends.length)
        detailItems.push(
          '<span class="module-detail-item"><strong>' +
            t("module_depends") +
            ":</strong> " +
            ls.depends
              .map(function (d) {
                return '<code class="dep-code">' + esc(d) + "</code>";
              })
              .join(" ") +
            "</span>",
        );
    }
    if (m.routes_count > 0)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("registered_routes") +
          ":</strong> " +
          m.routes_count +
          "</span>",
      );
    if (m.views_count > 0)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("module_views_count") +
          ":</strong> " +
          m.views_count +
          "</span>",
      );
    if (m.has_config != null)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("config") +
          ":</strong> " +
          (m.has_config ? t("cmd_yes") : t("cmd_no")) +
          "</span>",
      );
    if (m.package)
      detailItems.push(
        '<span class="module-detail-item"><strong>' +
          t("pkg_name") +
          ':</strong> <code class="dep-code">' +
          esc(m.package) +
          "</code></span>",
      );
    if (m.is_git)
      detailItems.push(
        '<span class="module-detail-item"><span class="chip chip-pr module-git-chip">Git</span></span>',
      );
  }
  if (detailItems.length) {
    detailHtml =
      '<div class="module-detail hidden"><div class="module-detail-row">' +
      detailItems.join("") +
      "</div></div>";
  }

  const adLogo = isAd ? adapterLogoImg(m.name, 20) : "";
  var html =
    '<div class="module-row-wrap">' +
    '<div class="module-row"><span class="module-status-dot ' +
    statusDot +
    '"></span>' +
    adLogo +
    '<div class="module-info"><div class="module-name">' +
    esc(m.name) +
    '</div><div class="module-meta">' +
    meta +
    '</div></div><div class="module-actions">' +
    '<span class="chip ' +
    statusClass +
    ' module-status-chip">' +
    esc(statusText) +
    "</span>" +
    acts +
    "</div></div>" +
    detailHtml +
    "</div>";
  return html;
}
function toggleModuleDetail(btn) {
  var wrap = btn.closest(".module-row-wrap");
  if (!wrap) return;
  var detail = wrap.querySelector(".module-detail");
  if (!detail) return;
  var svg = btn.querySelector("svg");
  if (detail.classList.contains("hidden")) {
    detail.classList.remove("hidden");
    wrap.classList.add("expanded");
    if (svg) svg.innerHTML = '<polyline points="6 15 12 9 18 15"/>';
  } else {
    detail.classList.add("hidden");
    wrap.classList.remove("expanded");
    if (svg) svg.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
  }
}
async function moduleAction(name, action, type, pkg) {
  if (!authed) return showLogin();
  if (action === "unload" && name === "Dashboard") {
    const ok = await confirm2(t("unload_self_title"), t("unload_self_confirm"));
    if (!ok) return;
  } else if (action === "unload") {
    const ok = await confirm2(
      t("unload_confirm_title"),
      t("unload_confirm_text"),
    );
    if (!ok) return;
  }
  if (action === "disable") {
    const ok = await confirm2(
      t("disable_confirm_title"),
      t("disable_confirm_text"),
    );
    if (!ok) return;
  }
  if (action === "uninstall") {
    const ok = await confirm2(
      t("uninstall_confirm_title"),
      t("uninstall_confirm_text") + " <strong>" + esc(name) + "</strong>",
    );
    if (!ok) return;
  }
  const body = { name, action, type };
  if (pkg) body.package = pkg;
  const d = await api("/api/modules/action", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    if (d.task_id) {
      _installTaskIds.set(d.task_id, name);
      toast(t("module_uninstalling"), "");
    } else {
      setTimeout(loadModules, 300);
      toast(t("action_completed"), "ok");
    }
  } else toast(d?.error || t("action_failed"), "er");
}

let _storeTimer;
function debounceStore() {
  clearTimeout(_storeTimer);
  _storeTimer = setTimeout(loadStore, 300);
}
const STORE_CACHE_KEY = "__ep_store__",
  STORE_CACHE_TTL = 4 * 3600 * 1000;
function mirrorOptionsHtml() {
  return (
    '<option value="">PyPI (Default)</option>' +
    '<option value="https://pypi.tuna.tsinghua.edu.cn/simple">Tsinghua</option>' +
    '<option value="https://mirrors.aliyun.com/pypi/simple/">Aliyun</option>' +
    '<option value="https://pypi.doubanio.com/simple/">Douban</option>' +
    '<option value="https://repo.huaweicloud.com/repository/pypi/simple">Huawei</option>'
  );
}
function initMirrorSelects() {
  ["uploadMirrorSelect", "detailMirrorSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.children.length) el.innerHTML = mirrorOptionsHtml();
  });
}
var _selectedStoreTags = new Set();

function toggleStoreTag(tag, el) {
  if (_selectedStoreTags.has(tag)) {
    _selectedStoreTags.delete(tag);
    el.classList.remove("active");
  } else {
    _selectedStoreTags.add(tag);
    el.classList.add("active");
  }
  loadStore();
}

function _renderStoreTags(data) {
  var tagSet = new Set();
  for (var key in data.modules || {}) {
    var tg = data.modules[key].tags;
    if (Array.isArray(tg))
      tg.forEach(function (tag) {
        tagSet.add(tag);
      });
  }
  for (var key in data.adapters || {}) {
    var tg = data.adapters[key].tags;
    if (Array.isArray(tg))
      tg.forEach(function (tag) {
        tagSet.add(tag);
      });
  }
  var container = document.getElementById("storeTags");
  if (tagSet.size === 0) {
    container.style.display = "none";
    return;
  }
  container.style.display = "flex";
  var tags = Array.from(tagSet).sort();
  var tagsHtml = tags
    .map(function (tg) {
      var active = _selectedStoreTags.has(tg) ? " active" : "";
      return (
        '<span class="store-tag-chip' +
        active +
        '" onclick="toggleStoreTag(\'' +
        esc(tg) +
        "',this)" +
        '">' +
        esc(tg) +
        "</span>"
      );
    })
    .join("");

  var collapsed = sessionStorage.getItem("_storeTagsCollapsed") === "1";
  var bodyClass = collapsed ? " store-tags-body collapsed" : "";
  var toggleLabel = collapsed ? t("expand") : t("collapse");

  container.innerHTML =
    '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' +
    '<span style="font-size:12px;color:var(--tx-s)">' +
    t("store_tag_filter") +
    ":</span>" +
    '<button class="store-tags-toggle" onclick="toggleStoreTagsCollapse()">' +
    toggleLabel +
    "</button></div>" +
    '<div class="store-tags-body' +
    bodyClass +
    '">' +
    tagsHtml +
    "</div>";
}

function toggleStoreTagsCollapse() {
  var collapsed = sessionStorage.getItem("_storeTagsCollapsed") === "1";
  sessionStorage.setItem("_storeTagsCollapsed", collapsed ? "0" : "1");
  // 重新渲染
  var d = JSON.parse(localStorage.getItem(STORE_CACHE_KEY));
  if (d && d.data && d.data.packages) {
    _renderStoreTags(d.data.packages);
  } else {
    loadStore();
  }
}

async function loadStore(forceRefresh) {
  const q = document.getElementById("storeSearch")?.value?.toLowerCase() || "";
  const typeFilter = document.getElementById("storeTypeFilter")?.value || "all";
  let d = null;
  if (!forceRefresh) {
    try {
      const c = JSON.parse(localStorage.getItem(STORE_CACHE_KEY));
      if (c && Date.now() - c.ts < STORE_CACHE_TTL) d = c.data;
    } catch (e) {}
  }
  if (!d) {
    d = await api("/api/store/remote");
    if (d && d.packages)
      localStorage.setItem(
        STORE_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), data: d }),
      );
  }
  if (!d || !d.packages) {
    document.getElementById("storeGrid").innerHTML =
      '<div class="empty-state" style="grid-column:span 3"><p>' +
      t("failed_registry") +
      "</p></div>";
    return;
  }
  const pk = d.packages;

  // 渲染标签筛选项
  _renderStoreTags(pk);

  const installedVersions = d.installed_versions || {};
  const all = [
    ...Object.entries(pk.modules || {}).map(([n, i]) => ({
      ...i,
      name: n,
      type: "module",
    })),
    ...Object.entries(pk.adapters || {}).map(([n, i]) => ({
      ...i,
      name: n,
      type: "adapter",
    })),
  ];
  // 多层筛选
  var f = all;
  if (typeFilter !== "all") {
    f = f.filter(function (i) {
      return i.type === typeFilter;
    });
  }
  if (q) {
    f = f.filter(function (i) {
      return (i.name + i.description + i.package).toLowerCase().indexOf(q) >= 0;
    });
  }
  if (_selectedStoreTags.size > 0) {
    f = f.filter(function (i) {
      var tags = i.tags;
      if (!Array.isArray(tags)) return false;
      for (var ti = 0; ti < tags.length; ti++) {
        if (_selectedStoreTags.has(tags[ti])) return true;
      }
      return false;
    });
  }
  document.getElementById("storeGrid").innerHTML = f.length
    ? f
        .map((i) => {
          const pkgLower = (i.package || "").toLowerCase();
          const installedVer = installedVersions[pkgLower] || "";
          const isInstalled = !!installedVer;
          const hasUpdate = isInstalled && cmpVer(i.version, installedVer) > 0;
          let statusBadge = "";
          let actionBtn = "";
          if (hasUpdate) {
            statusBadge =
              '<span class="chip chip-wr" style="margin-left:4px;font-size:10px">' +
              t("store_update_available") +
              "</span>";
            actionBtn =
              '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();upgradePkg(\'' +
              esc(i.package) +
              "')\">" +
              t("pkg_upgrade") +
              "</button>";
          } else if (isInstalled) {
            statusBadge =
              '<span class="chip chip-ok" style="margin-left:4px;font-size:10px">v' +
              esc(installedVer) +
              "</span>";
            actionBtn =
              '<span style="font-size:12px;color:var(--ok-c);font-weight:500">' +
              t("active") +
              "</span>";
          } else {
            actionBtn =
              '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();installPkg(\'' +
              esc(i.package) +
              "')\">" +
              t("install") +
              "</button>";
          }
          // 标签徽章
          var tagBadges = "";
          if (Array.isArray(i.tags) && i.tags.length) {
            tagBadges =
              '<div class="store-card-tags">' +
              i.tags
                .map(function (t) {
                  return '<span class="store-card-tag">' + esc(t) + "</span>";
                })
                .join("") +
              "</div>";
          }
          return (
            '<div class="store-card' +
            (hasUpdate ? " store-card-update" : "") +
            '" onclick="openPkgDetail(\'' +
            esc(i.name) +
            "','" +
            esc(i.package) +
            "','" +
            esc(i.type) +
            '\')"><div style="display:flex;align-items:center;gap:8px"><input type="checkbox" class="store-card-check" data-pkg="' +
            esc(i.package) +
            '" onclick="event.stopPropagation();updateBatchBar()"><span style="font-size:14px;font-weight:600">' +
            esc(i.name) +
            '</span><span class="chip chip-pr">' +
            esc(i.type) +
            "</span>" +
            statusBadge +
            '</div><div style="font-size:12px;color:var(--tx-t);font-family:Consolas,Monaco,monospace">' +
            esc(i.package) +
            '</div><div style="font-size:13px;color:var(--tx-s);line-height:1.4;margin-top:4px">' +
            esc(i.description || "-") +
            "</div>" +
            tagBadges +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><span style="font-size:12px;color:var(--tx-s);font-weight:500">v' +
            esc(i.version || "?") +
            (hasUpdate
              ? ' <span style="color:var(--wr-c);font-weight:600">&larr;</span> ' +
                t("store_version_current") +
                " v" +
                esc(installedVer)
              : "") +
            '</span><div style="display:flex;align-items:center;gap:6px">' +
            actionBtn +
            '<button class="store-card-detail-btn" onclick="event.stopPropagation();openPkgDetail(\'' +
            esc(i.name) +
            "','" +
            esc(i.package) +
            "','" +
            esc(i.type) +
            '\')" title="' +
            t("view_detail") +
            '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button></div></div></div>'
          );
        })
        .join("")
    : '<div class="empty-state" style="grid-column:span 3"><p>' +
      t("no_packages") +
      "</p></div>";
}
let _installTaskIds = new Map();
function showInstallConfirm(pkg, isBatch) {
  return new Promise((r) => {
    const ov = document.getElementById("modalOv");
    document.getElementById("modalTitle").textContent = t("install");
    const label = isBatch
      ? esc(pkg)
      : "Install <strong>" + esc(pkg) + "</strong>?";
    document.getElementById("modalText").innerHTML =
      label +
      '<div class="install-confirm-options">' +
      '<div class="install-confirm-option"><div><div class="install-confirm-option-label">' +
      t("force_install") +
      '</div><div style="font-size:11px;color:var(--tx-t)">' +
      t("force_install_desc") +
      '</div></div><label class="switch"><input type="checkbox" id="installConfirmForce"><span class="switch-slider"></span></label></div>' +
      '<div class="install-confirm-option"><div class="install-confirm-option-label">' +
      t("pip_mirror") +
      '</div><select class="upload-select" id="installConfirmMirror" style="width:160px">' +
      mirrorOptionsHtml() +
      "</select></div>" +
      "</div>";
    const ac = document.getElementById("modalActions");
    ac.innerHTML = "";
    const b1 = document.createElement("button");
    b1.className = "btn btn-secondary";
    b1.textContent = t("cancel");
    b1.onclick = () => {
      ov.classList.remove("show");
      r(null);
    };
    const b2 = document.createElement("button");
    b2.className = "btn btn-primary";
    b2.textContent = t("install");
    b2.onclick = () => {
      const force =
        document.getElementById("installConfirmForce")?.checked || false;
      const mirror =
        document.getElementById("installConfirmMirror")?.value || "";
      ov.classList.remove("show");
      r({ force, index_url: mirror });
    };
    ac.append(b1, b2);
    ov.classList.add("show");
  });
}
async function installPkg(pkg) {
  if (!authed) return showLogin();
  const opts = await showInstallConfirm(pkg);
  if (!opts) return;
  const body = { packages: [pkg] };
  if (opts.force) body.force = true;
  if (opts.index_url) body.index_url = opts.index_url;
  const d = await api("/api/store/install", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkg);
    toast(t("installing"), "");
  } else {
    toast(t("install_failed"), "er");
  }
}

// ========== 上传安装模态窗 ==========
let _uploadState = { file: null, taskId: null, uploaded: false };
function openUploadModal() {
  if (!authed) return showLogin();
  _uploadState = { file: null, taskId: null, uploaded: false };
  initMirrorSelects();
  const ov = document.getElementById("uploadOv");
  document.getElementById("uploadProgressSection").style.display = "none";
  document.getElementById("uploadProgressFill").style.width = "0%";
  document.getElementById("uploadProgressText").textContent = "0%";
  document.getElementById("uploadFileInfo").textContent = "";
  document.getElementById("uploadInstallBtn").disabled = true;
  document.getElementById("uploadForceInstall").checked = false;
  const ms = document.getElementById("uploadMirrorSelect");
  if (ms) ms.value = "";
  document.getElementById("uploadDropZone").classList.remove("drag-over");
  ov.classList.add("show");
}
function closeUploadModal() {
  document.getElementById("uploadOv").classList.remove("show");
}
function handleUploadDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}
function handleUploadDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}
function handleUploadDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) processUploadFile(file);
}
function handleUploadFileSelect(input) {
  const file = input.files && input.files[0];
  if (file) processUploadFile(file);
  input.value = "";
}
function processUploadFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext !== "whl" && ext !== "zip") {
    toast(t("upload_failed"), "er");
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    toast(t("upload_file_too_large"), "er");
    return;
  }
  _uploadState.file = file;
  _uploadState.uploaded = false;
  document.getElementById("uploadFileInfo").textContent =
    file.name + " (" + formatFileSize(file.size) + ")";
  doUpload(file);
}
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + u[i];
}
function doUpload(file) {
  const fd = new FormData();
  fd.append("file", file);
  const force = document.getElementById("uploadForceInstall").checked;
  const mirror = document.getElementById("uploadMirrorSelect")?.value || "";
  if (force) fd.append("force", "true");
  if (mirror) fd.append("index_url", mirror);
  const xhr = new XMLHttpRequest();
  document.getElementById("uploadProgressSection").style.display = "flex";
  document.getElementById("uploadInstallBtn").disabled = true;
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      document.getElementById("uploadProgressFill").style.width = pct + "%";
      document.getElementById("uploadProgressText").textContent = pct + "%";
    }
  };
  xhr.onload = () => {
    try {
      const d = JSON.parse(xhr.responseText);
      if (d && d.success && d.task_id) {
        _uploadState.taskId = d.task_id;
        _uploadState.uploaded = true;
        _installTaskIds.set(d.task_id, file.name);
        document.getElementById("uploadProgressFill").style.width = "100%";
        document.getElementById("uploadProgressText").textContent =
          t("upload_complete");
        document.getElementById("uploadInstallBtn").disabled = false;
      } else {
        toast(d?.error || t("upload_failed"), "er");
        closeUploadModal();
      }
    } catch (err) {
      toast(t("upload_failed"), "er");
      closeUploadModal();
    }
  };
  xhr.onerror = () => {
    toast(t("upload_failed"), "er");
    closeUploadModal();
  };
  xhr.open("POST", API + "/api/store/upload");
  xhr.setRequestHeader("Authorization", "Bearer " + localStorage.getItem(TK));
  xhr.send(fd);
}
function startUploadInstall() {
  closeUploadModal();
  toast(t("installing"), "");
}

// ========== 包详情弹窗 ==========
let _pkgDetailCache = {};
async function openPkgDetail(name, pkg, type) {
  if (!authed) return showLogin();
  initMirrorSelects();
  const ov = document.getElementById("pkgDetailOv");
  document.getElementById("pkgDetailTitle").textContent = name;
  document.getElementById("pkgDetailType").textContent = type;
  document.getElementById("pkgDetailVersion").innerHTML = "";
  document.getElementById("pkgDetailDesc").innerHTML =
    '<p style="color:var(--tx-t)">' + t("pkg_detail_loading") + "</p>";
  document.getElementById("pkgDetailInfoGrid").innerHTML = "";
  document.getElementById("pkgDetailDepsSection").style.display = "none";
  document.getElementById("pkgDetailVersionsSection").style.display = "none";
  document.getElementById("detailForceInstall").checked = false;
  const ms = document.getElementById("detailMirrorSelect");
  if (ms) ms.value = "";
  const vs = document.getElementById("detailVersionSelect");
  vs.innerHTML = '<option value="">' + t("latest_version") + "</option>";
  const ac = document.getElementById("pkgDetailActions");
  ac.innerHTML = "";
  ov.classList.add("show");

  const cacheKey = pkg.toLowerCase();
  let d = _pkgDetailCache[cacheKey];
  if (!d) {
    d = await api(
      "/api/store/package/detail?package=" + encodeURIComponent(pkg),
    );
    if (d && !d.error) _pkgDetailCache[cacheKey] = d;
  }
  if (!d || d.error) {
    document.getElementById("pkgDetailDesc").innerHTML =
      '<p style="color:var(--er-c)">' + t("pkg_detail_failed") + "</p>";
    return;
  }

  let verHtml = "";
  if (d.installed_version)
    verHtml +=
      '<span class="chip chip-ok" style="font-size:11px">v' +
      esc(d.installed_version) +
      " " +
      t("store_version_current") +
      "</span> ";
  if (d.latest_version)
    verHtml +=
      '<span class="chip chip-pr" style="font-size:11px">v' +
      esc(d.latest_version) +
      " " +
      t("store_version_latest") +
      "</span>";
  document.getElementById("pkgDetailVersion").innerHTML = verHtml;

  const descText = d.description || d.summary || "-";
  const cleanDesc = descText.replace(/<[^>]*>/g, "").substring(0, 2000);
  document.getElementById("pkgDetailDesc").innerHTML =
    '<p style="white-space:pre-wrap">' + esc(cleanDesc) + "</p>";

  let infoHtml = "";
  if (d.author)
    infoHtml +=
      '<dt style="color:var(--tx-t);font-weight:500">Author</dt><dd style="color:var(--tx-s);margin:0">' +
      esc(d.author) +
      "</dd>";
  if (d.license)
    infoHtml +=
      '<dt style="color:var(--tx-t);font-weight:500">License</dt><dd style="color:var(--tx-s);margin:0">' +
      esc(d.license) +
      "</dd>";
  if (d.home_page)
    infoHtml +=
      '<dt style="color:var(--tx-t);font-weight:500">Homepage</dt><dd style="color:var(--tx-s);margin:0"><a href="' +
      esc(d.home_page) +
      '" target="_blank" style="color:var(--accent)">' +
      esc(d.home_page) +
      "</a></dd>";
  if (infoHtml)
    document.getElementById("pkgDetailInfoGrid").innerHTML = infoHtml;

  const deps = (d.requires_dist || []).filter(
    (dep) => !dep.includes("; extra ==") && !dep.includes(":"),
  );
  if (deps.length) {
    document.getElementById("pkgDetailDepsSection").style.display = "";
    document.getElementById("pkgDetailDeps").innerHTML = deps
      .map(
        (dep) =>
          '<span class="chip" style="margin:2px;font-size:11px;padding:2px 8px">' +
          esc(dep) +
          "</span>",
      )
      .join("");
  }

  const versions = d.versions || [];
  if (versions.length) {
    document.getElementById("pkgDetailVersionsSection").style.display = "";
    document.getElementById("pkgDetailVersions").innerHTML = versions
      .slice(0, 20)
      .map(
        (v) =>
          "<span style=\"display:inline-block;margin:2px 6px;cursor:pointer;color:var(--tx-s)\" onclick=\"document.getElementById('detailVersionSelect').value='" +
          esc(v) +
          "'\">" +
          esc(v) +
          "</span>",
      )
      .join("");
    vs.innerHTML =
      '<option value="">' +
      t("latest_version") +
      " (" +
      esc(d.latest_version || "") +
      ")</option>" +
      versions
        .slice(0, 30)
        .map((v) => '<option value="' + esc(v) + '">' + esc(v) + "</option>")
        .join("");
  }

  ac.innerHTML = "";
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-secondary";
  closeBtn.textContent = t("cancel");
  closeBtn.onclick = () => ov.classList.remove("show");

  const actionBtn = document.createElement("button");
  actionBtn.className = "btn btn-primary";
  if (
    d.installed_version &&
    d.latest_version &&
    cmpVer(d.latest_version, d.installed_version) > 0
  ) {
    actionBtn.textContent = t("pkg_upgrade");
    actionBtn.onclick = () => {
      ov.classList.remove("show");
      doInstallWithOptions(pkg, false, true);
    };
  } else if (!d.installed_version) {
    actionBtn.textContent = t("install");
    actionBtn.onclick = () => {
      ov.classList.remove("show");
      doInstallWithOptions(pkg);
    };
  } else {
    actionBtn.textContent = t("force_install");
    actionBtn.onclick = () => {
      ov.classList.remove("show");
      doInstallWithOptions(pkg, true);
    };
  }
  ac.append(closeBtn, actionBtn);
}
function closePkgDetail() {
  document.getElementById("pkgDetailOv").classList.remove("show");
}
async function doInstallWithOptions(pkg, defaultForce, isUpgrade) {
  const force =
    defaultForce !== undefined
      ? defaultForce
      : document.getElementById("detailForceInstall")?.checked || false;
  const mirror = document.getElementById("detailMirrorSelect")?.value || "";
  const version = document.getElementById("detailVersionSelect")?.value || "";
  const pkgSpec = version ? pkg + "==" + version : pkg;
  const body = { packages: [pkgSpec] };
  if (force) body.force = true;
  if (mirror) body.index_url = mirror;
  if (isUpgrade) {
    const d = await api("/api/packages/upgrade", {
      method: "POST",
      body: JSON.stringify({
        packages: [pkgSpec],
        index_url: mirror || undefined,
      }),
    });
    if (d && d.success && d.task_id) {
      _installTaskIds.set(d.task_id, pkg);
      toast(t("installing"), "");
    } else toast(t("install_failed"), "er");
  } else {
    const d = await api("/api/store/install", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (d && d.success && d.task_id) {
      _installTaskIds.set(d.task_id, pkg);
      toast(t("installing"), "");
    } else toast(t("install_failed"), "er");
  }
}

// ========== 批量安装 ==========
function updateBatchBar() {
  const checked = document.querySelectorAll(".store-card-check:checked");
  const bar = document.getElementById("storeBatchBar");
  if (checked.length > 0) {
    bar.style.display = "flex";
    document.getElementById("storeBatchCount").textContent = t(
      "batch_install_count",
    ).replace("{n}", checked.length);
  } else {
    bar.style.display = "none";
  }
}
async function batchInstall() {
  if (!authed) return showLogin();
  const checked = document.querySelectorAll(".store-card-check:checked");
  const pkgs = Array.from(checked).map((c) => c.dataset.pkg);
  if (!pkgs.length) return;
  const opts = await showInstallConfirm(pkgs.join(", "), true);
  if (!opts) return;
  const body = { packages: pkgs };
  if (opts.force) body.force = true;
  if (opts.index_url) body.index_url = opts.index_url;
  const d = await api("/api/store/install", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkgs.join(", "));
    toast(t("installing"), "");
  } else {
    toast(t("install_failed"), "er");
  }
  document
    .querySelectorAll(".store-card-check")
    .forEach((c) => (c.checked = false));
  updateBatchBar();
}
async function restartFramework() {
  if (!authed) return showLogin();
  closeSettings();
  const ok = await confirm2(t("restart"), t("restart_confirm"));
  if (!ok) return;
  toast(t("restart_success"), "");
  const d = await api("/api/restart", { method: "POST" });
  if (!d || !d.success) {
    toast(t("restart_failed"), "er");
  }
}

async function loadConfig() {
  const c = await api("/api/config");
  if (c && c.config) {
    window._kvData = c.config;
    window._fwData = c.config["ErisPulse"] || {};
    // 过滤掉 ErisPulse 键，不在树形视图中显示
    const treeData = {};
    for (const [k, v] of Object.entries(c.config)) {
      if (k !== "ErisPulse") treeData[k] = v;
    }
    requestAnimationFrame(function () {
      document.getElementById("configBodyTree").innerHTML = kvTree(
        treeData,
        "config",
        "",
      );
    });
  }
  const s = await api("/api/storage");
  if (s) {
    document.getElementById("storageCount").textContent =
      (s.total || 0) + " " + t("storage_items");
    const k = s.keys || [];
    requestAnimationFrame(function () {
      document.getElementById("storageBody").innerHTML = k.length
        ? k
            .slice(0, 200)
            .map((x) => kvRow(esc(x), s.data[x], "storage", x))
            .join("")
        : '<div class="empty-state"><p>' + t("empty_storage") + "</p></div>";
    });
  }

  // 如果在源码视图，也加载源码
  if (document.getElementById("configBodySource").style.display !== "none") {
    await loadConfigSource();
  }
}

async function loadConfigSource() {
  const d = await api("/api/config/source");
  if (d && d.content) {
    const editor = document.getElementById("configSourceEditor");
    if (editor) {
      editor.value = d.content;
    }
  } else {
    toast(t("config_load_failed"), "er");
  }
}

async function saveConfigSource() {
  const editor = document.getElementById("configSourceEditor");
  if (!editor) return;

  const content = editor.value;

  const d = await api("/api/config/source", {
    method: "POST",
    body: JSON.stringify({ content }),
  });

  if (d && d.success) {
    toast(t("config_saved"), "ok");
    loadConfig();
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

function switchConfigView(view, btn) {
  // 只作用于内部的 tree/source toggle，不影响外层 tab
  var headerActions = btn.closest(".header-actions");
  if (headerActions) {
    headerActions
      .querySelectorAll(".view-btn")
      .forEach((b) => b.classList.remove("active"));
  }
  btn.classList.add("active");
  const treeView = document.getElementById("configBodyTree");
  const sourceView = document.getElementById("configBodySource");
  var searchEl = document.getElementById("configSearch");
  if (view === "tree") {
    treeView.style.display = "block";
    sourceView.style.display = "none";
    if (searchEl) searchEl.style.display = "";
  } else {
    treeView.style.display = "none";
    sourceView.style.display = "block";
    if (searchEl) searchEl.style.display = "none";
    loadConfigSource();
  }
}

var _configFilterTimer = null;
function filterConfigTree(q) {
  clearTimeout(_configFilterTimer);
  _configFilterTimer = setTimeout(function () {
    _doFilterConfigTree(q.trim().toLowerCase());
  }, 200);
}

function _doFilterConfigTree(q) {
  var tree = document.getElementById("configBodyTree");
  if (!tree) return;
  if (!q) {
    var rows = tree.querySelectorAll(".kv-row, .kv-group");
    rows.forEach(function (el) {
      el.style.display = "";
      if (el.classList.contains("kv-group")) {
        el.classList.add("collapsed");
        var body = el.querySelector(".kv-group-body");
        if (body) body.innerHTML = "";
      }
    });
    return;
  }
  var matchedGroups = new Set();
  var rows = tree.querySelectorAll(".kv-row");
  rows.forEach(function (row) {
    var keyEl = row.querySelector(".kv-key");
    var inp = row.querySelector(".kv-input");
    var keyText = keyEl ? keyEl.textContent.toLowerCase() : "";
    var valText = inp ? inp.value.toLowerCase() : "";
    if (keyText.indexOf(q) !== -1 || valText.indexOf(q) !== -1) {
      row.style.display = "";
      var parent = row.parentElement;
      while (
        parent &&
        parent !== tree &&
        !parent.classList.contains("kv-group")
      ) {
        parent = parent.parentElement;
      }
      while (
        parent &&
        parent !== tree &&
        parent.classList.contains("kv-group")
      ) {
        matchedGroups.add(parent);
        parent.classList.remove("collapsed");
        parent.style.display = "";
        parent = parent.parentElement;
      }
    } else {
      row.style.display = "none";
    }
  });
  var groups = tree.querySelectorAll(".kv-group");
  groups.forEach(function (g) {
    if (!matchedGroups.has(g)) {
      g.style.display = "none";
    }
  });
}

function getSetting(key, def) {
  const v = localStorage.getItem("ep_setting_" + key);
  return v !== null ? v : def;
}
function setSetting(key, val) {
  localStorage.setItem("ep_setting_" + key, val);
}

function showSettings() {
  go("settings");
}
function closeSettings() {}

function switchSettingsTab(tab, btn) {
  var tabs = btn.closest(".pkg-tabs").querySelectorAll(".pkg-tab");
  tabs.forEach(function (b) {
    b.classList.remove("active");
  });
  btn.classList.add("active");
  document.querySelectorAll("#p-settings .tab-section").forEach(function (s) {
    s.style.display = "none";
  });
  var target = document.getElementById(tab + "-tab");
  if (target) target.style.display = "block";
  if (tab === "settings-update") {
    loadFrameworkVersions();
    document.getElementById("settingsUpdateTab")?.classList.remove("show-update");
  }
}

var _settingsAppearanceScope = false;

async function loadSettings() {
  syncSettingsUI();
  initAccentSwatches();
  await loadGlobalAppearance();
}

async function loadGlobalAppearance() {
  try {
    var d = await api("/api/appearance");
    if (!d || !d.appearance) return;
    var app = d.appearance;
    var scopeEl = document.getElementById("settingsGlobalScope");
    if (scopeEl) scopeEl.checked = !!app._global_enabled;
    _settingsAppearanceScope = !!app._global_enabled;
    updateGlobalBanner();
    if (app._global_enabled) {
      applyGlobalAppearanceData(app);
    }
  } catch (e) {
    console.debug("Appearance API unavailable, using local settings");
  }
}

function applyDashTitle(title) {
  if (!title) title = "ErisPulse Dashboard";
  setSetting("dash_title", title);
  var el = document.getElementById("appTitle");
  if (el) el.textContent = title;
  document.title = title;
  if (_settingsAppearanceScope) saveGlobalAppearance();
}

function applyGlobalAppearanceData(app) {
  if (app.dash_title) {
    setSetting("dash_title", app.dash_title);
    applyDashTitle(app.dash_title);
  }
  if (app.theme) {
    localStorage.setItem("ep_theme", app.theme);
    applyTheme(app.theme);
    var themeEl = document.getElementById("settingsTheme");
    if (themeEl) themeEl.checked = app.theme === "dark";
  }
  if (app.ui_style) {
    localStorage.setItem("ep_ui_style", app.ui_style);
    applyUiStyle(app.ui_style);
    var uiEl = document.getElementById("settingsUiStyle");
    if (uiEl) uiEl.value = app.ui_style;
  }
  if (app.bg_color) {
    applyBgColor(app.bg_color);
  }
  if (app.bg_image) {
    setSetting("bg_image", app.bg_image);
    applyBgImage(app.bg_image);
  } else {
    clearBgImage();
  }
  if (app.accent_color) {
    applyAccentColor(app.accent_color);
  }
  if (app.bg_auto_theme !== undefined) {
    localStorage.setItem("ep_setting_bg_auto_theme", app.bg_auto_theme);
    var autoEl = document.getElementById("settingsBgAutoTheme");
    if (autoEl) autoEl.checked = app.bg_auto_theme;
  }
}

function collectAppearanceData() {
  return {
    dash_title: getSetting("dash_title", "ErisPulse Dashboard"),
    theme: getTheme(),
    ui_style: getUiStyle(),
    bg_color: getSetting("bg_color", ""),
    bg_image: getSetting("bg_image", ""),
    accent_color: getSetting("accent_color", ""),
    bg_auto_theme: bgAutoThemeEnabled(),
    _global_enabled: _settingsAppearanceScope,
  };
}

async function saveGlobalAppearance() {
  if (!_settingsAppearanceScope) return;
  var data = collectAppearanceData();
  try {
    await api("/api/appearance", { method: "PUT", body: JSON.stringify(data) });
  } catch (e) {}
}

async function onSettingsScopeChange(global) {
  _settingsAppearanceScope = global;
  updateGlobalBanner();
  // 无论开启还是关闭，都同步到服务器
  try {
    await api("/api/appearance", {
      method: "PUT",
      body: JSON.stringify({ _global_enabled: global }),
    });
  } catch (e) {}
  if (global) {
    await saveGlobalAppearance();
  }
}

function updateGlobalBanner() {
  var banner = document.getElementById("settingsGlobalBanner");
  if (banner) banner.style.display = _settingsAppearanceScope ? "flex" : "none";
}

function syncSettingsUI() {
  var themeEl = document.getElementById("settingsTheme");
  if (themeEl) themeEl.checked = getTheme() === "dark";
  var uiEl = document.getElementById("settingsUiStyle");
  if (uiEl) uiEl.value = getUiStyle();
  var langEl = document.getElementById("settingsLang");
  if (langEl) langEl.value = lang;
  var sbEl = document.getElementById("settingsSidebar");
  if (sbEl)
    sbEl.checked = document
      .getElementById("sidebar")
      .classList.contains("collapsed");
  var nsEl = document.getElementById("settingsNodeSelector");
  if (nsEl)
    nsEl.checked = localStorage.getItem("ep_show_node_selector") !== "false";
  var rgEl = document.getElementById("settingsRememberGroups");
  if (rgEl)
    rgEl.checked = localStorage.getItem("ep_remember_groups") !== "false";
  var rfEl = document.getElementById("settingsRefresh");
  if (rfEl) rfEl.value = getSetting("refresh_interval", "5000");
  var elEl = document.getElementById("settingsEventLimit");
  if (elEl) elEl.value = getSetting("event_limit", "100");
  var dtEl = document.getElementById("settingsDashTitle");
  if (dtEl) dtEl.value = getSetting("dash_title", "ErisPulse Dashboard");
  // Apply saved accent color to CSS variables (not just sync UI)
  var savedAccent = getSetting("accent_color", "");
  if (savedAccent) applyAccentColor(savedAccent);
  else syncAccentUI("#4fa6de");
  var bgInput = document.getElementById("settingsBg");
  if (bgInput) bgInput.value = getSetting("bg_color", "") || "#f4f7fb";
  var hasBgImg = !!getSetting("bg_image", "");
  showBgAutoThemeRow(hasBgImg);
  var autoChk = document.getElementById("settingsBgAutoTheme");
  if (autoChk) autoChk.checked = bgAutoThemeEnabled();
}

function applySettingTheme(dark) {
  const th = dark ? "dark" : "light";
  localStorage.setItem("ep_theme", th);
  applyTheme(th);
  if (_settingsAppearanceScope) saveGlobalAppearance();
}
function applySettingLang(v) {
  lang = v;
  localStorage.setItem("ep_lang", lang);
  applyI18n();
  loadAll();
}
function applySettingSidebar(collapsed) {
  document.getElementById("sidebar").classList.toggle("collapsed", collapsed);
  localStorage.setItem("ep_sidebar_collapsed", collapsed);
}
function applySettingRefresh(val) {
  setSetting("refresh_interval", val);
  restartRefreshTimer();
}
function applySettingEventLimit(val) {
  setSetting("event_limit", val);
}
function applySettingNodeSelector(show) {
  localStorage.setItem("ep_show_node_selector", show);
  // 重新应用显隐逻辑
  updateNodeSelectorVisibility();
}

// ========== 配色定制（主题色 / 背景） ==========

// 预设强调色（MD3 风格）
var ACCENT_PRESETS = [
  "#4fa6de", // ErisPulse 默认蓝
  "#6750a4", // MD3 紫
  "#006b3c", // 深绿
  "#e8590c", // 橙
  "#c92a2a", // 红
  "#9c36b5", // 品红
  "#2c7bb6", // 深蓝
  "#495057", // 石板灰
];

// hex -> "r, g, b"
function hexToRgbStr(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map(function (c) {
        return c + c;
      })
      .join("");
  var r = parseInt(hex.substr(0, 2), 16);
  var g = parseInt(hex.substr(2, 2), 16);
  var b = parseInt(hex.substr(4, 2), 16);
  return r + ", " + g + ", " + b;
}

// 调亮/调暗 hex，pct<0 变暗、>0 变亮
function shadeHex(hex, pct) {
  hex = hex.replace("#", "");
  var num = parseInt(hex, 16);
  var r = (num >> 16) & 255,
    g = (num >> 8) & 255,
    b = num & 255;
  var amt = Math.round(2.55 * pct);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function applyAccentColor(hex) {
  if (!hex) return;
  setSetting("accent_color", hex);
  var root = document.documentElement.style;
  root.setProperty("--accent", hex);
  root.setProperty("--accent-rgb", hexToRgbStr(hex));
  // 填充色比点缀色更深，保证白字可读
  root.setProperty("--accent-fill", shadeHex(hex, -18));
  root.setProperty("--accent-fill-h", shadeHex(hex, -28));
  root.setProperty("--accent-h", shadeHex(hex, -10));
  syncAccentUI(hex);
  if (_settingsAppearanceScope) saveGlobalAppearance();
}

function applyAccentColorManual(hex) {
  // 手动选择强调色时自动关闭自动取色，避免刷新后被覆盖
  if (bgAutoThemeEnabled()) {
    localStorage.setItem("ep_setting_bg_auto_theme", "false");
    var autoChk = document.getElementById("settingsBgAutoTheme");
    if (autoChk) autoChk.checked = false;
  }
  applyAccentColor(hex);
}

// 背景纯色
function applyBgColor(hex) {
  if (!hex) return;
  setSetting("bg_color", hex);
  document.documentElement.style.setProperty("--bg-p", hex);
  clearBgImage();
  // 默认：背景色变化时同步推导一个柔和的强调色
  if (bgAutoThemeEnabled()) {
    applyAccentColor(deriveAccentFromBg(hex));
  }
  var bgInput = document.getElementById("settingsBg");
  if (bgInput) bgInput.value = hex;
  if (_settingsAppearanceScope) saveGlobalAppearance();
}

// 背景图片：上传
function applyBgImageFile(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    var dataUrl = e.target.result;
    // 本地预览（不存 base64 到 localStorage，避免塞满本地存储）
    applyBgImage(dataUrl);
    showBgAutoThemeRow(true);
    if (bgAutoThemeEnabled()) {
      extractImageColor(dataUrl, function (hex) {
        applyAccentColor(hex);
      });
    }
    // 上传到服务器，只保存 URL（避免 base64 污染配置）
    uploadBgImage(file).then(function (url) {
      if (url) {
        setSetting("bg_image", url);
        if (_settingsAppearanceScope) saveGlobalAppearance();
      } else {
        // 上传失败时回退到本地 base64（仅本地，不同步）
        setSetting("bg_image", dataUrl);
      }
    });
  };
  reader.readAsDataURL(file);
}

// 上传背景图到服务器，返回 URL（避免 base64 污染配置）
async function uploadBgImage(file) {
  if (!file) return null;
  try {
    var fd = new FormData();
    fd.append("file", file);
    var d = await api("/api/appearance/upload", { method: "POST", body: fd });
    return d && d.success ? d.url : null;
  } catch (e) {
    console.debug("bg upload failed:", e);
    return null;
  }
}

function applyBgImage(dataUrl) {
  if (!dataUrl) return;
  // 背景图 + 半透明遮罩（保证内容可读）
  var dark = getTheme() === "dark";
  var overlay = dark
    ? "linear-gradient(rgba(8,12,18,0.9),rgba(8,12,18,0.9))"
    : "linear-gradient(rgba(244,247,251,0.82),rgba(244,247,251,0.82))";
  document.body.style.backgroundImage = overlay + ', url("' + dataUrl + '")';
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundAttachment = "fixed";
  // 纯色背景失效
  document.documentElement.style.removeProperty("--bg-p");
}

function clearBgImage() {
  document.body.style.removeProperty("background-image");
  document.body.style.removeProperty("background-size");
  document.body.style.removeProperty("background-position");
  document.body.style.removeProperty("background-attachment");
}

// 从图片提取主色调
function extractImageColor(dataUrl, cb) {
  var img = new Image();
  img.onload = function () {
    var cw = 24,
      ch = 24;
    var c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, cw, ch);
    var data;
    try {
      data = ctx.getImageData(0, 0, cw, ch).data;
    } catch (e) {
      cb("#4fa6de");
      return;
    }
    // 量化到 32 的颜色桶，统计频次并偏好饱和色
    var buckets = {};
    for (var i = 0; i < data.length; i += 4) {
      var r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      if (a < 125) continue;
      var qr = Math.round(r / 32) * 32,
        qg = Math.round(g / 32) * 32,
        qb = Math.round(b / 32) * 32;
      var key = qr + "," + qg + "," + qb;
      var mx = Math.max(r, g, b),
        mn = Math.min(r, g, b);
      var sat = mx === 0 ? 0 : (mx - mn) / mx; // 饱和度
      if (!buckets[key]) buckets[key] = { n: 0, r: 0, g: 0, b: 0, sat: 0 };
      var bk = buckets[key];
      bk.n++;
      bk.r += r;
      bk.g += g;
      bk.b += b;
      bk.sat += sat;
    }
    var best = null,
      bestScore = -1;
    Object.keys(buckets).forEach(function (k) {
      var bk = buckets[k];
      var avgSat = bk.sat / bk.n;
      // 评分：频次 × (饱和度加权)，避免选到灰白黑
      var score = bk.n * (0.4 + avgSat * 1.6);
      if (score > bestScore) {
        bestScore = score;
        best = bk;
      }
    });
    if (!best) {
      cb("#4fa6de");
      return;
    }
    var hr = Math.round(best.r / best.n),
      hg = Math.round(best.g / best.n),
      hb = Math.round(best.b / best.n);
    // 若提取色太灰，退回默认蓝
    var mx2 = Math.max(hr, hg, hb),
      mn2 = Math.min(hr, hg, hb);
    if (mx2 - mn2 < 18) cb("#4fa6de");
    else
      cb(
        themeAwareAccent(
          "#" + ((1 << 24) + (hr << 16) + (hg << 8) + hb).toString(16).slice(1),
        ),
      );
  };
  img.onerror = function () {
    cb("#4fa6de");
  };
  img.src = dataUrl;
}

// 由背景纯色推导一个柔和强调色（默认行为）
function deriveAccentFromBg(hex) {
  hex = hex.replace("#", "");
  var num = parseInt(hex, 16);
  var r = (num >> 16) & 255,
    g = (num >> 8) & 255,
    b = num & 255;
  var mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  var sat = mx === 0 ? 0 : (mx - mn) / mx;
  // 背景几乎无色彩 → 保持默认蓝，避免随灰色背景变灰
  if (sat < 0.12) return "#4fa6de";
  // 有色彩 → 取背景主色，并按当前主题压暗/提亮
  return themeAwareAccent("#" + hex);
}

// 按当前主题调整强调色亮度：深色模式提亮、浅色模式压暗
function themeAwareAccent(hex) {
  var dark = getTheme() === "dark";
  return shadeHex(hex, dark ? 14 : -18);
}

function bgAutoThemeEnabled() {
  return localStorage.getItem("ep_setting_bg_auto_theme") !== "false";
}

function showBgAutoThemeRow(show) {
  var row = document.getElementById("bgAutoThemeRow");
  if (row) row.style.display = show ? "flex" : "none";
}

function onBgAutoThemeToggle(checked) {
  localStorage.setItem("ep_setting_bg_auto_theme", checked);
  if (checked) {
    // 开启自动取色：立即按当前背景重算
    var img = getSetting("bg_image", "");
    var col = getSetting("bg_color", "");
    if (img) {
      extractImageColor(img, function (hex) {
        applyAccentColor(hex);
      });
    } else if (col) {
      applyAccentColor(deriveAccentFromBg(col));
    } else {
      resetAccent();
    }
  }
  if (_settingsAppearanceScope) saveGlobalAppearance();
}

// 重置背景（颜色 + 图片）
function resetBg() {
  localStorage.removeItem("ep_setting_bg_color");
  localStorage.removeItem("ep_setting_bg_image");
  document.documentElement.style.removeProperty("--bg-p");
  clearBgImage();
  showBgAutoThemeRow(false);
  var bgInput = document.getElementById("settingsBg");
  if (bgInput) bgInput.value = "#f4f7fb";
  var bgFile = document.getElementById("settingsBgFile");
  if (bgFile) bgFile.value = "";
  if (bgAutoThemeEnabled()) resetAccent();
  if (_settingsAppearanceScope) saveGlobalAppearance();
}

// 重置强调色为默认
function resetAccent() {
  localStorage.removeItem("ep_setting_accent_color");
  var root = document.documentElement.style;
  root.removeProperty("--accent");
  root.removeProperty("--accent-rgb");
  root.removeProperty("--accent-fill");
  root.removeProperty("--accent-fill-h");
  root.removeProperty("--accent-h");
  syncAccentUI("#4fa6de");
  if (_settingsAppearanceScope) saveGlobalAppearance();
}

function syncAccentUI(hex) {
  var swatches = document.querySelectorAll(".color-swatch");
  swatches.forEach(function (s) {
    s.classList.toggle("active", s.dataset.color === hex);
  });
  var accentInput = document.getElementById("settingsAccent");
  if (accentInput) accentInput.value = hex;
}

function initAccentSwatches() {
  var wrap = document.getElementById("accentSwatches");
  if (!wrap || wrap.childElementCount) return;
  ACCENT_PRESETS.forEach(function (c) {
    var btn = document.createElement("button");
    btn.className = "color-swatch";
    btn.style.background = c;
    btn.dataset.color = c;
    btn.title = c;
    btn.onclick = function () {
      applyAccentColorManual(c);
    };
    wrap.appendChild(btn);
  });
}

// 启动时恢复自定义配色
function applyCustomTheme() {
  var img = getSetting("bg_image", "");
  var col = getSetting("bg_color", "");
  var accent = getSetting("accent_color", "");
  var auto = bgAutoThemeEnabled();
  if (img) {
    // 有背景图：应用图，并按自动取色推导强调色
    applyBgImage(img);
    if (auto) {
      extractImageColor(img, function (hex) {
        applyAccentColor(hex);
      });
    } else if (accent) {
      applyAccentColor(accent);
    }
  } else if (col) {
    applyBgColor(col);
  } else if (accent && !auto) {
    // 无背景、手动选过强调色
    applyAccentColor(accent);
  }
}

// ========== 主页快捷导航（可自定义 pin） ==========

var HOME_PIN_DEFAULTS = ["config", "module-mgmt", "logs", "files"];
var _homePinsEditing = false;

// 合并页面的 tab 定义（用于 pin 选择器展示子 tab）
var MERGED_PAGE_TABS = {
  config: [
    { id: "cfg-editor", label: "configuration", i18n: "configuration" },
    {
      id: "cfg-framework",
      label: "framework_config",
      i18n: "framework_config",
    },
  ],
  "event-stream": [
    { id: "ev-stream", label: "event_stream", i18n: "event_stream" },
    { id: "ev-builder", label: "event_builder", i18n: "event_builder" },
  ],
  store: [
    { id: "st-browse", label: "store", i18n: "store" },
    { id: "st-packages", label: "pkg_manager", i18n: "pkg_manager" },
  ],
  logs: [
    { id: "mon-logs", label: "sys_logs", i18n: "sys_logs" },
    { id: "mon-lifecycle", label: "lifecycle", i18n: "lifecycle" },
    { id: "mon-audit", label: "audit_log", i18n: "audit_log" },
  ],
  "module-mgmt": [
    { id: "mm-adapters", label: "adapters", i18n: "adapters" },
    { id: "mm-modules", label: "modules_label", i18n: "modules_label" },
  ],
  adapter: [
    { id: "cfg-adapter", label: "adapter_config", i18n: "adapter_config" },
    { id: "cfg-module", label: "module_config", i18n: "module_config" },
  ],
};

function getHomePins() {
  var raw = localStorage.getItem("ep_home_pins");
  if (raw) {
    try {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }
  return HOME_PIN_DEFAULTS.slice();
}

function setHomePins(arr) {
  localStorage.setItem("ep_home_pins", JSON.stringify(arr));
}

// 从侧边栏导航项读取图标+标题；支持 page:tab 格式
function navItemContent(pinId) {
  var parts = pinId.split(":");
  var page = parts[0];
  var tab = parts[1];
  var item = document.querySelector('.nav-item[data-page="' + page + '"]');
  if (!item) return null;
  var svg = item.querySelector("svg");
  var span = item.querySelector("span");
  var title = span ? span.textContent : page;
  // 如果有子 tab，只显示 tab 名称（不显示父页面名）
  if (tab) {
    var tabBtn = document.querySelector('[data-tab="' + tab + '"]');
    if (tabBtn) {
      var tabText = tabBtn.textContent.trim();
      if (tabText) title = tabText;
    }
  }
  return {
    svg: svg ? svg.outerHTML : "",
    title: title,
  };
}

function renderHomePins() {
  var wrap = document.getElementById("homePins");
  if (!wrap) return;
  var pins = getHomePins();
  wrap.innerHTML = "";
  var found = 0;
  pins.forEach(function (pinId, idx) {
    var c = navItemContent(pinId);
    if (!c) return; // 该视图不存在（如动态视图已卸载），跳过
    found++;
    var card = document.createElement("div");
    card.className = "home-pin" + (_homePinsEditing ? " editing" : "");
    card.draggable = _homePinsEditing;
    card.setAttribute("data-page", pinId);
    card.setAttribute("data-idx", String(idx));
    if (!_homePinsEditing) {
      card.addEventListener("click", function () {
        var parts = pinId.split(":");
        if (parts[1]) {
          // page:tab 格式 — 先导航到页面再切换 tab
          go(parts[0]);
          var tabBtn = document.querySelector('[data-tab="' + parts[1] + '"]');
          if (tabBtn) tabBtn.click();
        } else {
          go(pinId);
        }
      });
    }

    var grip = document.createElement("span");
    grip.className = "home-pin-grip";
    grip.title = "Drag";
    grip.textContent = "⋮⋮";
    card.appendChild(grip);

    var icon = document.createElement("span");
    icon.innerHTML = c.svg;
    card.appendChild(icon.firstChild || icon);

    var label = document.createElement("span");
    label.className = "home-pin-label";
    label.textContent = c.title;
    card.appendChild(label);

    if (_homePinsEditing) {
      var rm = document.createElement("button");
      rm.className = "home-pin-remove";
      rm.textContent = "×";
      rm.addEventListener("click", function (e) {
        e.stopPropagation();
        removeHomePin(pinId);
      });
      card.appendChild(rm);
    }
    wrap.appendChild(card);
  });
  if (found === 0) {
    var empty = document.createElement("div");
    empty.className = "home-pin-empty";
    empty.style.cssText = "color:var(--tx-t);font-size:13px;padding:12px 0";
    empty.textContent = t("home_empty");
    wrap.appendChild(empty);
  }
  bindHomePinDnd();

  var addBar = document.getElementById("homePinAdd");
  if (addBar) addBar.style.display = _homePinsEditing ? "block" : "none";
}

function toggleHomePinsEdit() {
  _homePinsEditing = !_homePinsEditing;
  var btn = document.getElementById("homePinsEditBtn");
  if (btn) btn.classList.toggle("active", _homePinsEditing);
  renderHomePins();
}

function removeHomePin(page) {
  var pins = getHomePins().filter(function (p) {
    return p !== page;
  });
  setHomePins(pins);
  renderHomePins();
}

function toggleHomePinPicker() {
  var picker = document.getElementById("homePinPicker");
  if (!picker) return;
  if (picker.style.display === "none") {
    var pinned = getHomePins();
    var all = Array.prototype.map.call(
      document.querySelectorAll(".nav-item[data-page]"),
      function (a) {
        return a.getAttribute("data-page");
      },
    );
    picker.innerHTML = "";
    var count = 0;

    function addOption(label, svgHtml, onClick, isSub) {
      var opt = document.createElement("div");
      opt.className = isSub ? "home-pin-suboption" : "home-pin-option";
      opt.addEventListener("click", onClick);
      var icon = document.createElement("span");
      icon.innerHTML = svgHtml || "";
      opt.appendChild(icon.firstChild || icon);
      var span = document.createElement("span");
      span.textContent = label;
      opt.appendChild(span);
      picker.appendChild(opt);
      count++;
    }

    all.forEach(function (page) {
      var c = navItemContent(page);
      if (!c) return;

      var isPinned = pinned.indexOf(page) !== -1;

      // 整页 pin 选项（仅当该页面未被 pin 时显示）
      if (!isPinned) {
        addOption(c.title, c.svg, function () {
          addHomePin(page);
        });
      }

      // 子 tab 选项（仅当父页面未被 pin 时显示，避免孤儿选项）
      if (!isPinned) {
        var tabs = MERGED_PAGE_TABS[page];
        if (tabs) {
          tabs.forEach(function (tabInfo) {
            var pinId = page + ":" + tabInfo.id;
            if (pinned.indexOf(pinId) !== -1) return;
            addOption(
              t(tabInfo.i18n) || tabInfo.label,
              c.svg,
              function () {
                addHomePin(pinId);
              },
              true,
            );
          });
        }
      }
    });
    if (count === 0) {
      var none = document.createElement("div");
      none.style.cssText = "padding:8px;color:var(--tx-t)";
      none.textContent = "—";
      picker.appendChild(none);
    }
    picker.style.display = "block";
  } else {
    picker.style.display = "none";
  }
}

function addHomePin(page) {
  var pins = getHomePins();
  if (pins.indexOf(page) === -1) {
    pins.push(page);
    setHomePins(pins);
  }
  var picker = document.getElementById("homePinPicker");
  if (picker) picker.style.display = "none";
  renderHomePins();
}

// 原生拖拽排序
var _dragPinIdx = null;
function bindHomePinDnd() {
  var pins = document.querySelectorAll(".home-pin");
  pins.forEach(function (el) {
    el.addEventListener("dragstart", function (e) {
      _dragPinIdx = parseInt(el.dataset.idx, 10);
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragend", function () {
      el.classList.remove("dragging");
    });
    el.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.classList.add("drag-over");
    });
    el.addEventListener("dragleave", function () {
      el.classList.remove("drag-over");
    });
    el.addEventListener("drop", function (e) {
      e.preventDefault();
      el.classList.remove("drag-over");
      var targetIdx = parseInt(el.dataset.idx, 10);
      if (_dragPinIdx === null || _dragPinIdx === targetIdx) return;
      var arr = getHomePins();
      var moved = arr.splice(_dragPinIdx, 1)[0];
      arr.splice(targetIdx, 0, moved);
      setHomePins(arr);
      _dragPinIdx = null;
      renderHomePins();
    });
  });
}

function updateNodeSelectorVisibility() {
  var nodeSelector = document.getElementById("nodeSelector");
  if (!nodeSelector) return;
  var showSetting = localStorage.getItem("ep_show_node_selector") !== "false"; // 默认开启
  if (!showSetting) {
    nodeSelector.style.display = "none";
    return;
  }
  // 设置开启时：有远程节点才显示
  var hasRemote = Object.keys(nodeRuntimeInfo).some(function (id) {
    return id !== "local";
  });
  nodeSelector.style.display = hasRemote ? "" : "none";
}

let _refreshTimer = null;
function restartRefreshTimer() {
  if (_refreshTimer) clearInterval(_refreshTimer);
  const interval = parseInt(getSetting("refresh_interval", "5000"));
  if (interval > 0 && authed) {
    _refreshTimer = setInterval(refreshDashboard, interval);
  }
}

function toggleSidebarCollapse() {
  if (window.innerWidth <= 768) return; // mobile: no collapsed state
  const sb = document.getElementById("sidebar");
  sb.classList.toggle("collapsed");
  localStorage.setItem(
    "ep_sidebar_collapsed",
    sb.classList.contains("collapsed"),
  );
  document.getElementById("settingsSidebar").checked =
    sb.classList.contains("collapsed");
}

function kvRow(k, v, mode, fk) {
  const tp = v === null ? "null" : typeof v;
  const ds = tp === "object" ? JSON.stringify(v) : String(v);
  const isMultiline = ds.includes("\n") || ds.length > 100;
  const saveFn = mode === "config" ? "saveConfig(this)" : "saveStorage(this)";

  // 只允许编辑子项属性，不允许定义根值
  const isRootLevel = fk && !fk.includes(".");
  const canEdit = mode === "config" ? !isRootLevel : true;

  const inputHtml = isMultiline
    ? `<textarea class="kv-input kv-textarea" data-key="${esc(fk)}" data-type="${tp}"
                 rows="3" onfocus="this.select()"
                 onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();${saveFn}}">${esc(ds)}</textarea>`
    : `<input class="kv-input" type="text" value="${esc(ds)}" data-key="${esc(fk)}" data-type="${tp}"
                 ${canEdit ? "" : "readonly"} onfocus="this.select()"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();${saveFn}}">`;

  const delBtn =
    mode === "storage"
      ? `<button class="kv-btn kv-btn-del" onclick="delStorage('${esc(fk)}',this)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>`
      : "";

  const readOnlyIndicator = !canEdit
    ? '<span style="font-size:11px;color:var(--wr-c);margin-left:8px">' +
      t("read_only") +
      "</span>"
    : "";

  return `<div class="kv-row"><div class="kv-key">${esc(k)}</div><div class="kv-actions">${inputHtml}<button class="kv-btn kv-btn-save" onclick="${saveFn}" title="Save" ${!canEdit ? 'style="display:none"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>${delBtn}${readOnlyIndicator}</div></div>`;
}

function kvTree(obj, mode, pfx, dep) {
  dep = dep || 0;
  let h = "";
  for (const [k, v] of Object.entries(obj)) {
    const fk = pfx ? pfx + "." + k : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      h +=
        '<div class="kv-group collapsed" style="margin-left:' +
        dep * 12 +
        'px" data-pfx="' +
        esc(fk) +
        '" data-mode="' +
        mode +
        '" data-dep="' +
        (dep + 1) +
        '"><div class="kv-group-hd" onclick="toggleKvGroup(this)"><span class="kv-chevron">\u25BC</span><span style="flex:1">' +
        esc(k) +
        '</span><span class="kv-count">' +
        Object.keys(v).length +
        '</span></div><div class="kv-group-body"></div></div>';
    } else {
      h +=
        '<div style="margin-left:' +
        dep * 12 +
        'px">' +
        kvRow(k, v, mode, fk) +
        "</div>";
    }
  }
  return h;
}

const _fwDefaults = {
  server: {
    host: "0.0.0.0",
    port: 8000,
    ssl_certfile: null,
    ssl_keyfile: null,
  },
  logger: { level: "INFO", format: "rich", log_files: [], memory_limit: 1000 },
  storage: { use_global_db: false },
  modules: {},
  adapters: {},
  event: {
    message: { ignore_self: true },
    command: {
      prefix: "/",
      case_sensitive: true,
      allow_space_prefix: false,
      must_at_bot: false,
    },
  },
  framework: {
    enable_lazy_loading: true,
    uninit_timeout: 30,
    strict_mode: 1,
    strict_mode_exceptions: { modules: [], adapters: [] },
  },
  i18n: { language: "auto" },
};

const _fwFieldDescs = {
  "server.host": "监听地址",
  "server.port": "监听端口",
  "server.ssl_certfile": "SSL 证书路径，设为 null 则不使用 SSL",
  "server.ssl_keyfile": "SSL 密钥路径",
  "logger.level": "日志级别: DEBUG / INFO / WARNING / ERROR / CRITICAL",
  "logger.log_files": '日志文件列表，如 ["logs/app.log"]',
  "logger.memory_limit": "内存日志条数上限",
  "storage.use_global_db": "是否使用全局数据库（跨模块共享）",
  "event.message.ignore_self": "忽略机器人自身发出的消息",
  "event.command.prefix": "命令触发前缀",
  "event.command.case_sensitive": "命令是否区分大小写",
  "event.command.allow_space_prefix": "是否允许命令前缀前有空格",
  "event.command.must_at_bot": "是否必须 @Bot 才能触发命令",
  "framework.enable_lazy_loading": "是否启用模块懒加载（按需加载）",
  "logger.format": "日志格式: rich（彩色）/ json",
  "framework.uninit_timeout": "反初始化超时时间（秒）",
  "framework.strict_mode":
    "严格模式：0=宽松（仅警告）/1=严格-跳过不合规组件/2=严格-致命（中止启动）",
  "framework.strict_mode_exceptions.modules": "严格模式豁免的模块名列表",
  "framework.strict_mode_exceptions.adapters": "严格模式豁免的适配器名列表",
  "i18n.language": "语言设置（auto 为自动检测）",
};

const _fwFieldWidgets = {
  "logger.level": {
    widget: "select",
    options: ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
  },
  "logger.format": { widget: "select", options: ["rich", "json"] },
  "framework.strict_mode": {
    widget: "select",
    options: [0, 1, 2],
  },
  "i18n.language": {
    widget: "select",
    options: ["auto", "zh", "en", "zh-TW", "ja", "ru"],
  },
};

var _fwKnownKeys = null;

function _buildFwKnownKeys() {
  if (_fwKnownKeys) return _fwKnownKeys;
  _fwKnownKeys = {};
  (function walk(obj, prefix) {
    for (var k in obj) {
      var key = prefix ? prefix + "." + k : k;
      var v = obj[k];
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        walk(v, key);
      } else {
        _fwKnownKeys[key] = true;
      }
    }
  })(_fwDefaults, "");
  return _fwKnownKeys;
}

function fwFieldDesc(fullKey) {
  const desc = _fwFieldDescs[fullKey];
  if (desc) return desc;
  const enKey = "fw_field_" + fullKey.replace(/\./g, "_");
  const en = t(enKey);
  return en !== enKey ? en : "";
}

function deepMerge(target, source) {
  const r = {};
  for (const k of Object.keys(source)) {
    if (
      k in target &&
      target[k] !== null &&
      typeof target[k] === "object" &&
      !Array.isArray(target[k]) &&
      typeof source[k] === "object" &&
      !Array.isArray(source[k])
    ) {
      r[k] = deepMerge(target[k], source[k]);
    } else {
      r[k] = k in target ? target[k] : source[k];
    }
  }
  for (const k of Object.keys(target)) {
    if (!(k in source)) r[k] = target[k];
  }
  return r;
}

function fwSectionI18nKey(key) {
  const i18nKey = "fw_section_" + key.replace(/\./g, "_");
  const label = t(i18nKey);
  return label !== i18nKey ? label : key.replace(/\./g, " › ");
}

// ========== 适配器配置页面 ==========

var _adapterConfigPlatforms = [];
var _adapterConfigCurrent = "";

async function loadAdapterConfigPage() {
  const d = await api("/api/adapters");
  if (!d) return;
  _adapterConfigPlatforms = d.adapters || [];

  const panel = document.getElementById("adapterConfigPanel");
  const empty = document.getElementById("adapterConfigEmpty");

  if (_adapterConfigPlatforms.length === 0) {
    // 没适配器 — 显示空状态 + 引导去商店安装
    if (empty) empty.style.display = "flex";
    panel.innerHTML = "";
    panel.appendChild(empty);
    var cta = document.createElement("button");
    cta.className = "empty-action";
    cta.innerHTML =
      t("store") +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>';
    cta.onclick = function () {
      go("store");
    };
    panel.appendChild(cta);
    return;
  }

  if (empty) empty.style.display = "none";

  // 创建水平适配器选择列表
  let selectorHtml = [
    '<div class="adapter-selector-bar">',
    '<div class="adapter-chip-list" id="adapterChipList">',
  ];

  _adapterConfigPlatforms.forEach((a) => {
    const isActive = a.platform === _adapterConfigCurrent;
    const cls = isActive ? " adapter-chip active" : " adapter-chip";
    const logo = adapterLogoImg(a.platform, 22) || "";
    const dotColor = a.running ? "var(--ok-c)" : "var(--tx-t)";
    const plat = esc(a.platform);
    selectorHtml.push(
      '<div class="' +
        cls +
        '" data-platform="' +
        plat +
        '" onclick="selectAdapter(\'' +
        plat +
        "')\">",
      logo,
      '<span class="adapter-chip-name">' + plat + "</span>",
      '<span class="adapter-chip-dot" style="background:' +
        dotColor +
        '"></span>',
      "</div>",
    );
  });

  selectorHtml.push("</div></div>");
  selectorHtml = selectorHtml.join("");

  // 先放选择器
  panel.innerHTML = selectorHtml;

  // 加载第一个适配器
  if (
    !_adapterConfigCurrent ||
    !_adapterConfigPlatforms.some((a) => a.platform === _adapterConfigCurrent)
  ) {
    _adapterConfigCurrent = _adapterConfigPlatforms[0].platform;
  }
  // 高亮当前选中
  document.querySelectorAll(".adapter-chip").forEach((el) => {
    el.classList.toggle(
      "active",
      el.dataset.platform === _adapterConfigCurrent,
    );
  });
  loadAdapterConfigDetail(_adapterConfigCurrent);
}

function selectAdapter(platform) {
  _adapterConfigCurrent = platform;
  document.querySelectorAll(".adapter-chip").forEach((el) => {
    el.classList.toggle("active", el.dataset.platform === platform);
  });
  loadAdapterConfigDetail(platform);
}

async function loadAdapterConfigDetail(platform) {
  const panel = document.getElementById("adapterConfigPanel");
  if (!panel) return;

  // 保留选择器，只替换内容区
  let container = document.getElementById("adapterConfigContent");
  if (!container) {
    container = document.createElement("div");
    container.id = "adapterConfigContent";
    panel.appendChild(container);
  }
  container.innerHTML =
    '<div style="padding:40px;text-align:center;color:var(--tx-s)">' +
    t("loading") +
    "...</div>";

  const d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/config",
  );
  if (!d || d.error) {
    container.innerHTML =
      '<div class="empty-state"><p>' +
      esc(d ? d.error : t("unknown_error")) +
      "</p></div>";
    return;
  }

  var html = '<div class="adapter-config-detail">';

  if (d.has_config && d.schema) {
    html +=
      '<div class="fw-section"><div class="fw-section-title">' +
      t("adapter_global_config") +
      '</div><div class="fw-section-body">';
    html +=
      '<div id="adapterGlobalConfigFields">' +
      renderAdapterSchemaFields(d.schema.fields, d.values || {}, d.config_key) +
      "</div>";
    html +=
      '<div style="margin-top:12px;text-align:right"><button class="btn btn-primary btn-sm" onclick="saveAdapterConfigAll(\'' +
      esc(platform) +
      "')\">" +
      t("save_adapter_config") +
      "</button></div>";
    html += "</div></div>";
  }

  html += "</div>";

  container.innerHTML = html;

  if (d.has_accounts) {
    loadAdapterAccounts(platform);
  }
}

function renderAdapterSchemaFields(fields, values, keyPrefix) {
  if (!fields || Object.keys(fields).length === 0)
    return (
      '<div style="padding:12px;color:var(--tx-s)">' +
      t("no_config_schema") +
      "</div>"
    );

  var groups = {};
  var groupOrder = {};
  for (const [name, fs] of Object.entries(fields)) {
    var g = fs.group || "_default";
    if (!groups[g]) {
      groups[g] = [];
      groupOrder[g] = 100;
    }
    groups[g].push({
      name: name,
      schema: fs,
      value: values[name] !== undefined ? values[name] : fs.default,
    });
  }

  var html = "";
  var sortedGroups = Object.keys(groups).sort(function (a, b) {
    var oa = groupOrder[a] || 100,
      ob = groupOrder[b] || 100;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });

  for (const g of sortedGroups) {
    var items = groups[g].sort(function (a, b) {
      var oa = a.schema.order || 100,
        ob = b.schema.order || 100;
      return oa - ob;
    });
    for (const item of items) {
      html += renderAdapterConfigField(
        item.name,
        item.schema,
        item.value,
        keyPrefix,
      );
    }
  }
  return html;
}

var EYE_OPEN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
var EYE_CLOSED_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function toggleSecretVisibility(btn) {
  var input = btn.parentElement.querySelector("input");
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = EYE_CLOSED_SVG;
    btn.title = t("hide_secret");
  } else {
    input.type = "password";
    btn.innerHTML = EYE_OPEN_SVG;
    btn.title = t("show_secret");
  }
}

function renderAdapterConfigField(name, schema, value, keyPrefix, opts) {
  opts = opts || {};
  var fieldSave = opts.fieldSave !== false;
  var desc = schema.description || "";
  var tp = schema.type || "string";
  var widget = schema.widget || "";
  var fullKey = (keyPrefix ? keyPrefix + "." : "") + name;
  var onChg = fieldSave ? ' onchange="saveAdapterConfigField(this)"' : "";
  var saveBtn = fieldSave
    ? '<button class="kv-btn" onclick="saveAdapterConfigField(this.parentElement.querySelector(\'input,textarea\'))" title="' +
      t("save_adapter_config") +
      '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>'
    : "";

  var ctrl = "";
  if (widget === "switch" || tp === "boolean") {
    var checked = value === true || value === "true" || value === 1;
    ctrl =
      '<label class="switch"><input type="checkbox" ' +
      (checked ? "checked" : "") +
      ' data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="boolean" data-adapter-widget="switch"' +
      onChg +
      '><span class="switch-slider"></span></label>';
  } else if (widget === "password" || schema.secret) {
    var eyeBtn =
      '<button class="kv-btn" type="button" onclick="toggleSecretVisibility(this)" title="' +
      esc(t("show_secret")) +
      '">' +
      EYE_OPEN_SVG +
      "</button>";
    ctrl =
      '<div style="display:flex;gap:4px"><input class="fw-input" type="password" value="' +
      esc(String(value != null ? value : "")) +
      '" autocomplete="new-password" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="string">' +
      eyeBtn +
      saveBtn +
      "</div>";
  } else if (widget === "select" || (schema.options && schema.options.length)) {
    var options = schema.options || [];
    var optsHtml = options
      .map(function (o) {
        var optVal = typeof o === "object" ? o.value : o;
        var optLabel = typeof o === "object" ? o.label : o;
        var sel =
          String(value).toLowerCase() === String(optVal).toLowerCase()
            ? " selected"
            : "";
        return (
          '<option value="' +
          esc(optVal) +
          '"' +
          sel +
          ">" +
          esc(optLabel) +
          "</option>"
        );
      })
      .join("");
    ctrl =
      '<select class="settings-select" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="string"' +
      onChg +
      ">" +
      optsHtml +
      "</select>";
  } else if (widget === "number" || tp === "integer" || tp === "float") {
    ctrl =
      '<div style="display:flex;gap:4px"><input class="fw-input" type="number" value="' +
      esc(String(value != null ? value : "")) +
      '" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="' +
      esc(tp) +
      '">' +
      saveBtn +
      "</div>";
  } else if (
    tp === "array" ||
    Array.isArray(value) ||
    schema.widget === "textarea"
  ) {
    var strVal = Array.isArray(value)
      ? JSON.stringify(value)
      : String(value != null ? value : "");
    ctrl =
      '<div style="display:flex;gap:4px"><textarea class="fw-input fw-textarea" rows="2" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="object">' +
      esc(strVal) +
      "</textarea>" +
      saveBtn +
      "</div>";
  } else {
    ctrl =
      '<div style="display:flex;gap:4px"><input class="fw-input" type="text" value="' +
      esc(String(value != null ? value : "")) +
      '" data-ackey="' +
      esc(fullKey) +
      '" data-adapter-tp="' +
      esc(tp) +
      '">' +
      saveBtn +
      "</div>";
  }

  var descHtml = desc ? '<div class="fw-desc">' + esc(desc) + "</div>" : "";
  return (
    '<div class="fw-row"><div class="fw-label">' +
    esc(name) +
    descHtml +
    '</div><div class="fw-control">' +
    ctrl +
    "</div></div>"
  );
}

async function saveAdapterConfigField(el) {
  var ackey = el.dataset.ackey;
  var tp = el.dataset.adapterTp || "string";
  var val = el.type === "checkbox" ? el.checked : el.value;
  if (tp === "number" || tp === "integer" || tp === "float") val = Number(val);
  else if (tp === "object") {
    try {
      val = JSON.parse(val);
    } catch (e) {
      return toast(t("validation_failed"), "er");
    }
  }

  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: ackey, value: val }),
  });
  if (d && d.success) {
    el.style.border = "2px solid var(--ok-c)";
    setTimeout(function () {
      el.style.border = "";
    }, 1200);
    toast(t("adapter_config_saved"), "ok");
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

async function saveAdapterConfigAll(platform) {
  var d = await api("/api/adapter/" + encodeURIComponent(platform) + "/config");
  if (!d || !d.schema) return;

  var values = {};
  var inputs = document.querySelectorAll(
    "#adapterGlobalConfigFields [data-ackey]",
  );
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var ackey = el.dataset.ackey;
    var parts = ackey.split(".");
    var keyName = parts[parts.length - 1];
    var tp = el.dataset.adapterTp || "string";
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (tp === "number" || tp === "integer" || tp === "float")
      val = Number(val);
    else if (tp === "object") {
      try {
        val = JSON.parse(val);
      } catch (e) {
        continue;
      }
    }
    values[keyName] = val;
  }

  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/config",
    {
      method: "PUT",
      body: JSON.stringify({ values: values }),
    },
  );

  if (result && result.success) {
    toast(t("adapter_config_saved"), "ok");
    if (result.errors && result.errors.length > 0) {
      toast(
        t("config_validation_failed") + ": " + result.errors.join(", "),
        "er",
      );
    }
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
    if (result?.errors) toast(result.errors.join(", "), "er");
  }
}

async function loadAdapterAccounts(platform) {
  var panel = document.getElementById("adapterConfigPanel");
  if (!panel) return;

  var d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
  );
  if (!d || d.error) return;

  // 先清除旧账户内容
  var oldSection = document.getElementById("adapterAccountsSection");
  if (oldSection) oldSection.remove();

  var html =
    '<div id="adapterAccountsSection" class="fw-section" style="margin-top:16px"><div class="fw-section-title">' +
    t("adapter_accounts") +
    '</div><div class="fw-section-body">';
  html += '<div class="adapter-account-list">';

  var accounts = d.accounts || {};
  var schema = d.schema;
  for (var aname in accounts) {
    var adata = accounts[aname] || {};
    html += renderAdapterAccountCard(platform, aname, adata, schema);
  }

  html += "</div>";
  html +=
    '<div style="margin-top:12px"><button class="btn btn-primary btn-sm" onclick="addAdapterAccount(\'' +
    esc(platform) +
    "')\">+ " +
    t("add_account") +
    "</button></div>";
  html += "</div></div>";

  // 追加到内容区
  var container = document.getElementById("adapterConfigContent");
  if (container) {
    container.insertAdjacentHTML("beforeend", html);
  } else {
    panel.innerHTML += html;
  }
}

function renderAdapterAccountCard(platform, accountName, accountData, schema) {
  var fieldsHtml = "";
  if (schema && schema.fields) {
    var items = Object.entries(schema.fields).sort(function (a, b) {
      var oa = a[1].order || 100,
        ob = b[1].order || 100;
      return oa - ob;
    });
    for (var i = 0; i < items.length; i++) {
      var fname = items[i][0],
        fschema = items[i][1];
      if (fname === "enabled" || fname === "name") continue;
      var fval =
        accountData[fname] !== undefined ? accountData[fname] : fschema.default;
      fieldsHtml += renderAdapterConfigField(
        fname,
        fschema,
        fval,
        "accounts." + accountName + "." + platform,
        { fieldSave: false },
      );
    }
  }

  var isEnabled = accountData.enabled !== false;
  return (
    '<div class="account-card"><div class="account-card-header">' +
    '<label class="switch" style="margin-right:8px"><input type="checkbox" ' +
    (isEnabled ? "checked" : "") +
    " onchange=\"saveAdapterAccountField('" +
    esc(platform) +
    "','" +
    esc(accountName) +
    "','enabled',this.checked)\"><span class=\"switch-slider\"></span></label>" +
    '<span class="account-card-name">' +
    esc(accountName) +
    "</span>" +
    '<div style="flex:1"></div>' +
    '<button class="btn btn-danger btn-xs" onclick="removeAdapterAccount(\'' +
    esc(platform) +
    "','" +
    esc(accountName) +
    "')\">" +
    t("remove_account") +
    "</button>" +
    "</div>" +
    '<div class="account-card-body">' +
    fieldsHtml +
    "</div>" +
    '<div class="account-card-footer"><button class="btn btn-primary btn-xs" onclick="saveAdapterAccount(\'' +
    esc(platform) +
    "','" +
    esc(accountName) +
    "')\">" +
    t("save_adapter_config") +
    "</button></div>" +
    "</div>"
  );
}

async function saveAdapterAccountField(
  platform,
  accountName,
  fieldName,
  value,
) {
  var d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
  );
  if (!d || !d.accounts) return;
  var accounts = d.accounts;
  if (!accounts[accountName]) accounts[accountName] = {};
  accounts[accountName][fieldName] = value;
  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
    {
      method: "PUT",
      body: JSON.stringify({ accounts: accounts }),
    },
  );
  if (result && result.success) {
    toast(t("adapter_config_saved"), "ok");
  } else {
    toast(t("save_failed"), "er");
  }
}

async function saveAdapterAccount(platform, accountName) {
  var accountData = {};
  var inputs = document.querySelectorAll("#adapterConfigPanel [data-ackey]");
  var prefix = "accounts." + accountName + "." + platform + ".";
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var ackey = el.dataset.ackey;
    if (!ackey.startsWith(prefix)) continue;
    var keyName = ackey.substring(prefix.length);
    var tp = el.dataset.adapterTp || "string";
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (tp === "number" || tp === "integer" || tp === "float")
      val = Number(val);
    else if (tp === "object") {
      try {
        val = JSON.parse(val);
      } catch (e) {
        continue;
      }
    }
    accountData[keyName] = val;
  }

  var d = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
  );
  if (!d || !d.accounts) return;
  var accounts = d.accounts;
  accounts[accountName] = accountData;

  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts",
    {
      method: "PUT",
      body: JSON.stringify({ accounts: accounts }),
    },
  );
  if (result && result.success) {
    toast(t("adapter_config_saved"), "ok");
    if (result.message) {
      toast(result.message);
      showAdapterReloadLog(result.module || platform, platform);
    }
    if (result.errors && result.errors.length > 0) {
      toast(
        t("config_validation_failed") + ": " + result.errors.join(", "),
        "er",
      );
    }
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
    if (result?.errors) toast(result.errors.join(", "), "er");
  }
}

async function addAdapterAccount(platform) {
  var name = await prompt2(
    t("add_account"),
    t("account_name"),
    t("new_account_default_name"),
  );
  if (!name) return;
  var result = await api(
    "/api/adapter/" + encodeURIComponent(platform) + "/accounts/add",
    {
      method: "POST",
      body: JSON.stringify({ name: name }),
    },
  );
  if (result && result.success) {
    toast(t("account_added"), "ok");
    if (result.message) toast(result.message);
    loadAdapterConfigDetail(platform);
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
  }
}

async function removeAdapterAccount(platform, accountName) {
  var ok = await confirm2(
    t("confirm_remove_account"),
    t("remove_account") + ": " + esc(accountName),
  );
  if (!ok) return;
  var result = await api(
    "/api/adapter/" +
      encodeURIComponent(platform) +
      "/accounts/" +
      encodeURIComponent(accountName),
    {
      method: "DELETE",
    },
  );
  if (result && result.success) {
    toast(t("account_removed"), "ok");
    if (result.message) {
      toast(result.message);
      showAdapterReloadLog(result.module || platform, platform);
    }
    loadAdapterConfigDetail(platform);
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
  }
}

async function loadFrameworkConfig() {
  const c = await api("/api/config");
  if (!c || !c.config) return;
  const live = c.config["ErisPulse"] || {};
  const merged = deepMerge(live, _fwDefaults);
  window._fwData = merged;
  const body = document.getElementById("fwConfigBody");
  if (!body) return;
  const sections = flattenFwSections(merged);
  body.innerHTML =
    '<div class="fw-add-field-bar"><button class="btn btn-secondary btn-sm" onclick="addFwField()">+ ' +
    t("fw_add_field") +
    "</button></div>" +
    sections.map((s) => renderFwSection(s)).join("");
  loadFrameworkVersions();
}

async function addFwField() {
  var sectionKey = await prompt2(
    t("fw_add_field"),
    t("fw_add_field_section_hint"),
    "",
  );
  if (!sectionKey) return;
  sectionKey = sectionKey.trim();
  var fieldName = await prompt2(
    t("fw_add_field"),
    t("fw_add_field_name_hint"),
    "",
  );
  if (!fieldName) return;
  fieldName = fieldName.trim();
  var fullKey = "ErisPulse." + sectionKey + "." + fieldName;
  var value = await prompt2(
    t("fw_add_field"),
    t("fw_add_field_value_hint"),
    "",
  );
  if (value === null) return;
  var parsedValue = value;
  try {
    parsedValue = JSON.parse(value);
  } catch (e) {
    // keep as string
  }
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fullKey, value: parsedValue }),
  });
  if (d && d.success) {
    toast(t("config_saved"), "ok");
    loadFrameworkConfig();
  } else {
    toast(t("save_failed") + ": " + (d ? d.error : t("unknown_error")), "er");
  }
}

function flattenFwSections(obj, prefix) {
  prefix = prefix || "";
  var knownKeys = _buildFwKnownKeys();
  const sections = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === "ErisPulse") continue;
    const key = prefix ? prefix + "." + k : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const allLeaf = Object.values(v).every(
        (x) => x === null || typeof x !== "object" || Array.isArray(x),
      );
      if (allLeaf) {
        var annotated = {};
        for (var fk in v) {
          var fullKey = key + "." + fk;
          var isKnown =
            !!knownKeys[fullKey] ||
            fullKey.startsWith("adapters.") ||
            fullKey.startsWith("modules.");
          annotated[fk] = { value: v[fk], known: isKnown };
        }
        sections.push({ key, values: annotated });
      } else {
        // 混合类型：先收集原始值（boolean/number/string/array）为当前 section
        var annotated = {};
        for (var fk in v) {
          var fv = v[fk];
          if (fv === null || typeof fv !== "object" || Array.isArray(fv)) {
            var fullKey = key + "." + fk;
            var isKnown =
              !!knownKeys[fullKey] ||
              fullKey.startsWith("adapters.") ||
              fullKey.startsWith("modules.");
            annotated[fk] = { value: fv, known: isKnown };
          }
        }
        if (Object.keys(annotated).length > 0) {
          sections.push({ key, values: annotated });
        }
        // 再递归处理嵌套对象
        sections.push(...flattenFwSections(v, key));
      }
    }
  }
  return sections;
}

function renderFwSection(s) {
  const displayName = fwSectionI18nKey(s.key);
  const knownKeys = _buildFwKnownKeys();
  const rows = Object.entries(s.values)
    .map(([field, info]) => {
      var val =
        info && typeof info === "object" && "value" in info ? info.value : info;
      var keyForCheck = s.key + "." + field;
      var isKnown =
        info && typeof info === "object" && "known" in info
          ? info.known
          : !!knownKeys[keyForCheck];
      isKnown =
        isKnown ||
        keyForCheck.startsWith("adapters.") ||
        keyForCheck.startsWith("modules.");
      const fk = "ErisPulse." + s.key + "." + field;
      const descKey = s.key + "." + field;
      const desc = fwFieldDesc(descKey);
      const tp =
        val === null ? "null" : Array.isArray(val) ? "list" : typeof val;
      var rowClass = isKnown ? "fw-row" : "fw-row fw-row-unknown";
      var unknownLabel = isKnown
        ? ""
        : '<span class="fw-unknown-badge" title="' +
          esc(t("fw_unknown_field_desc")) +
          '">' +
          esc(t("fw_unknown_field")) +
          "</span>";

      var widgetDef = _fwFieldWidgets[descKey];
      var ctrl = "";
      if (widgetDef && widgetDef.widget === "select") {
        var optsHtml = widgetDef.options
          .map(function (o) {
            var sel =
              String(val).toLowerCase() === String(o).toLowerCase()
                ? " selected"
                : "";
            return (
              '<option value="' +
              esc(o) +
              '"' +
              sel +
              ">" +
              esc(o) +
              "</option>"
            );
          })
          .join("");
        ctrl =
          '<select class="settings-select" data-fk="' +
          esc(fk) +
          '" data-tp="string" onchange="saveFwConfig(this)">' +
          optsHtml +
          "</select>";
      } else if (tp === "boolean") {
        ctrl =
          '<label class="switch"><input type="checkbox" ' +
          (val ? "checked" : "") +
          ' data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '" onchange="saveFwConfig(this)"><span class="switch-slider"></span></label>';
      } else if (tp === "number") {
        ctrl =
          '<input class="fw-input" type="number" value="' +
          esc(String(val)) +
          '" data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '">';
      } else if (tp === "list") {
        ctrl = renderFwListField(fk, val);
      } else if (tp === "object") {
        ctrl =
          '<textarea class="fw-input fw-textarea" rows="2" data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '">' +
          esc(JSON.stringify(val)) +
          "</textarea>";
      } else {
        ctrl =
          '<input class="fw-input" type="text" value="' +
          esc(String(val)) +
          '" data-fk="' +
          esc(fk) +
          '" data-tp="' +
          tp +
          '">';
      }
      var saveBtn =
        tp === "boolean" || tp === "list"
          ? ""
          : '<button class="kv-btn kv-btn-save" onclick="saveFwConfig(this.previousElementSibling)" title="Save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>';
      var resetBtn =
        '<button class="kv-btn kv-btn-del" onclick="resetFwField(\'' +
        esc(fk) +
        '\')" title="' +
        esc(isKnown ? t("fw_reset_default") : t("fw_delete_field")) +
        '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></button>';
      var descHtml = desc ? '<div class="fw-desc">' + esc(desc) + "</div>" : "";
      return (
        '<div class="' +
        rowClass +
        '"><div class="fw-label">' +
        esc(field) +
        unknownLabel +
        descHtml +
        '</div><div class="fw-control">' +
        ctrl +
        saveBtn +
        resetBtn +
        "</div></div>"
      );
    })
    .join("");
  return (
    '<div class="fw-section"><div class="fw-section-title">' +
    esc(displayName) +
    '</div><div class="fw-section-body">' +
    rows +
    "</div></div>"
  );
}

function renderFwListField(fk, val) {
  if (!Array.isArray(val)) val = [val];
  var itemsHtml = val
    .map(function (item, i) {
      return (
        '<div class="fw-list-item">' +
        '<input class="fw-input fw-list-input" type="text" value="' +
        esc(String(item)) +
        '" data-fk="' +
        esc(fk) +
        '" data-idx="' +
        i +
        '">' +
        '<button class="kv-btn kv-btn-del" onclick="removeFwListItem(this)" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        "</div>"
      );
    })
    .join("");
  return (
    '<div class="fw-list-field" data-fk="' +
    esc(fk) +
    '">' +
    itemsHtml +
    '<button class="btn btn-secondary btn-xs fw-list-add-btn" onclick="addFwListItem(this)" data-fk="' +
    esc(fk) +
    '">+ Add</button>' +
    '<button class="btn btn-primary btn-xs fw-list-save-btn" onclick="saveFwListField(this)" data-fk="' +
    esc(fk) +
    '">' +
    t("save_config") +
    "</button>" +
    "</div>"
  );
}

function addFwListItem(btn) {
  var container = btn.parentElement;
  var addBtn = container.querySelector(".fw-list-add-btn");
  var newItem = document.createElement("div");
  newItem.className = "fw-list-item";
  newItem.innerHTML =
    '<input class="fw-input fw-list-input" type="text" value="" data-fk="' +
    esc(btn.dataset.fk) +
    '" data-idx="' +
    container.querySelectorAll(".fw-list-input").length +
    '">' +
    '<button class="kv-btn kv-btn-del" onclick="removeFwListItem(this)" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  container.insertBefore(newItem, addBtn);
  newItem.querySelector("input").focus();
}

function removeFwListItem(btn) {
  var item = btn.parentElement;
  item.remove();
}

async function saveFwListField(btnOrContainer) {
  var container =
    btnOrContainer.classList &&
    btnOrContainer.classList.contains("fw-list-field")
      ? btnOrContainer
      : btnOrContainer.closest(".fw-list-field");
  if (!container) return;
  var fk = container.dataset.fk;
  var inputs = container.querySelectorAll(".fw-list-input");
  var values = [];
  inputs.forEach(function (inp) {
    var v = inp.value.trim();
    if (v) values.push(v);
  });
  if (fk.startsWith("ErisPulse.server.")) {
    var ok = await confirm2(
      t("fw_server_warn_title"),
      t("fw_server_warn_text"),
    );
    if (!ok) return;
  }
  // If single value, save as string; if multiple, save as list
  var saveValue = values.length === 1 ? values[0] : values;
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: saveValue }),
  });
  if (d && d.success) {
    toast(t("config_saved"), "ok");
    loadFrameworkConfig();
  } else {
    toast(t("save_failed") + ": " + (d ? d.error : t("unknown_error")), "er");
  }
}

async function saveFwConfig(el) {
  const fk = el.dataset.fk;
  if (fk.startsWith("ErisPulse.server.")) {
    const ok = await confirm2(
      t("fw_server_warn_title"),
      t("fw_server_warn_text"),
    );
    if (!ok) return;
  }
  const tp = el.dataset.tp;
  let v = el.type === "checkbox" ? el.checked : el.value;
  if (tp === "number") v = Number(v);
  else if (tp === "object") {
    try {
      v = JSON.parse(v);
    } catch (e) {
      return toast(t("validation_failed"), "er");
    }
  }
  const d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: v }),
  });
  el.style.border =
    d && d.success ? "2px solid var(--ok-c)" : "2px solid var(--er-c)";
  setTimeout(() => (el.style.border = ""), 1200);
  if (d && d.success) toast(t("config_saved"), "ok");
  else toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
}

async function resetFwField(fk) {
  var knownKeys = _buildFwKnownKeys();
  var plainKey = fk.replace("ErisPulse.", "");
  var isKnown = !!knownKeys[plainKey];
  var msg = isKnown
    ? t("fw_reset_confirm").replace("{key}", fk)
    : t("fw_delete_confirm").replace("{key}", fk);
  var ok = await confirm2(
    isKnown ? t("fw_reset_default") : t("fw_delete_field"),
    msg,
  );
  if (!ok) return;
  var d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: null }),
  });
  if (d && d.success) {
    toast(isKnown ? t("fw_reset_done") : t("fw_delete_done"), "ok");
    loadFrameworkConfig();
  } else {
    toast(t("save_failed") + ": " + (d?.error || t("unknown_error")), "er");
  }
}

let _fwVersions = [];
let _fwCurrentVer = "";

/**
 * 判断服务器是否为 Windows（使用 /api/status 或 /api/framework/versions 返回的平台信息）。
 */
function isServerWindows() {
  if (typeof window._serverIsWindows === "boolean") return window._serverIsWindows;
  var p = (window._serverPlatform || "").toLowerCase();
  return p === "windows";
}

/**
 * 启动时检查框架是否有新版本。
 * - 有更新 → 设置按钮和框架更新 tab 显示红点，从设置按钮弹出提示气泡
 * - 无更新 → 不做处理
 */
var _fwBadgeChecked = false;
async function checkFwUpdateBadge() {
  if (_fwBadgeChecked) return;
  _fwBadgeChecked = true;
  try {
    var d = await api("/api/framework/versions");
    if (!d || !d.current) return;
    // 同步服务器平台
    if (d.platform) {
      window._serverPlatform = d.platform;
      window._serverIsWindows = /^win/i.test(d.platform);
    }
    var versions = d.versions || [];
    var latest = versions.length > 0 ? versions[0] : "";
    var hasUpdate = latest && cmpVer(latest, d.current) > 0;
    if (!hasUpdate) return;
    // 红点
    document.getElementById("settingsBtn")?.classList.add("show-update");
    document.getElementById("settingsUpdateTab")?.classList.add("show-update");
    // 弹出提示（延迟显示，避免与连接状态面板同时弹出）
    var popupText = document.getElementById("fwUpdatePopupText");
    if (popupText) {
      popupText.textContent = t("fw_popup_msg").replace("{latest}", latest);
    }
    var popup = document.getElementById("fwUpdatePopup");
    if (popup) {
      setTimeout(function () {
        popup.classList.add("expanded");
        setTimeout(function () {
          popup.classList.remove("expanded");
        }, 4000);
      }, 3000);
    }
  } catch (e) { /* 静默失败 */ }
}

async function loadFrameworkVersions() {
  const d = await api(
    "/api/framework/versions?pre=" +
      (document.getElementById("fwPreRelease")?.checked || false),
  );
  if (!d) return;

  _fwCurrentVer = d.current;
  _fwVersions = d.versions || [];
  document.getElementById("fwCurrentVer").textContent = d.current;

  // 最新版本
  var latest = _fwVersions.length > 0 ? _fwVersions[0] : "-";
  var latestEl = document.getElementById("fwLatestVer");
  if (latestEl) latestEl.textContent = latest;
  var hasUpdate = latest !== "-" && cmpVer(latest, d.current) > 0;
  if (hasUpdate) {
    latestEl.style.color = "var(--wr-c)";
    latestEl.textContent = latest + " ↑";
  } else {
    latestEl.style.color = "var(--ok-c)";
  }

  // 服务器平台提示（点击安装时弹窗确认，此处不显横幅）
  if (d.platform) {
    window._serverPlatform = d.platform;
    window._serverIsWindows = /^win/i.test(d.platform);
  }
  var isWindows = isServerWindows();
  var winWarn = document.getElementById("fwWinWarn");
  if (winWarn) winWarn.style.display = isWindows ? "" : "none";

  // 更新按钮：所选版本 > 当前版本即可启用
  var updateBtn = document.getElementById("fwUpdateBtn");
  var sel = document.getElementById("fwVersionSelect");
  function refreshBtn() {
    if (!updateBtn || !sel) return;
    var sv = sel.value;
    if (!sv || sv === _fwCurrentVer) {
      updateBtn.disabled = true;
      updateBtn.style.opacity = "0.5";
    } else {
      updateBtn.disabled = false;
      updateBtn.style.opacity = "";
    }
  }
  sel.onchange = function () {
    refreshBtn();
    loadFwReleaseNotes();
  };

  // 填充版本选择器
  var versionRow = document.getElementById("fwVersionRow");
  if (sel && versionRow && _fwVersions.length > 0) {
    versionRow.style.display = "";
    sel.innerHTML = _fwVersions
      .map(function (v) {
        var isCurrent = v === d.current;
        return (
          '<option value="' +
          esc(v) +
          '"' +
          (v === latest ? " selected" : "") +
          ">" +
          esc(v) +
          (isCurrent ? " (" + t("fw_current") + ")" : "") +
          "</option>"
        );
      })
      .join("");
  }

  refreshBtn();
  if (sel && sel.value) loadFwReleaseNotes();
}

var _changelogCache = null;
var _changelogCacheTs = 0;
var CHANGELOG_BASE = "https://raw.githubusercontent.com/ErisPulse/ErisPulse/Develop/v2/CHANGELOG.md";
var CHANGELOG_PROXIES = [
  "https://cdn.gh-proxy.org/",
  "https://ghproxy.com/",
  "https://gh-proxy.com/",
  "",
];

async function fetchChangelog() {
  if (_changelogCache && Date.now() - _changelogCacheTs < 600000) return _changelogCache;
  for (var i = 0; i < CHANGELOG_PROXIES.length; i++) {
    try {
      var url = CHANGELOG_PROXIES[i] + CHANGELOG_BASE;
      var resp = await fetch(url);
      if (resp.ok) {
        _changelogCache = await resp.text();
        _changelogCacheTs = Date.now();
        return _changelogCache;
      }
    } catch (e) {}
  }
  return null;
}

function parseChangelogSection(text, version) {
  if (!text) return null;
  // CHANGELOG 用横杠，PyPI 用点号，都要试
  var variants = [version];
  if (version.indexOf(".dev") !== -1) variants.push(version.replace(/\.dev/, "-dev."));
  if (version.indexOf("-dev.") !== -1) variants.push(version.replace(/-dev\./, ".dev"));
  if (version.indexOf("-de.") !== -1) variants.push(version.replace(/-de\./, "-dev."));
  for (var i = 0; i < variants.length; i++) {
    var re = new RegExp("## \\[" + escRegex(variants[i]) + "\\] - .*?(?=## \\[|$)", "s");
    var m = text.match(re);
    if (m) {
      var lines = m[0].split("\n");
      lines.shift();
      return lines.join("\n").trim();
    }
  }
  return null;
}

function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function loadFwReleaseNotes() {
  var sel = document.getElementById("fwVersionSelect");
  var notesEl = document.getElementById("fwReleaseNotes");
  if (!sel || !notesEl) return;
  var v = sel.value;
  if (!v) { notesEl.style.display = "none"; return; }
  notesEl.style.display = "";
  notesEl.textContent = t("loading") + "...";

  // 1. 尝试从 CHANGELOG.md 提取
  var changelog = await fetchChangelog();
  if (changelog) {
    var section = parseChangelogSection(changelog, v);
    if (section) {
      notesEl.innerHTML = typeof marked !== "undefined"
        ? marked.parse(section)
        : section.replace(/</g, "&lt;");
      return;
    }
  }

  // 2. 回退后端
  var d = await api("/api/framework/versions?notes=" + encodeURIComponent(v));
  if (d && d.notes) {
    notesEl.innerHTML = typeof marked !== "undefined"
      ? marked.parse(d.notes)
      : d.notes.replace(/</g, "&lt;");
    return;
  }

  // 3. 最后显示链接
  var releaseUrl = "https://github.com/ErisPulse/ErisPulse/releases/tag/v" + v;
  notesEl.innerHTML =
    '<div style="text-align:center;padding:12px 0;color:var(--tx-s)">' +
    '<p style="margin:0 0 8px">' + esc(t("release_notes_unavailable")) + "</p>" +
    '<a href="' + esc(releaseUrl) +
    '" target="_blank" rel="noopener" style="color:var(--accent,#4fa6de);font-size:13px">' +
    esc(releaseUrl) + "</a></div>";
}

async function doFrameworkUpdate() {
  const sel = document.getElementById("fwVersionSelect");
  const version = sel?.value;
  if (!version) return;

  if (_fwCurrentVer && cmpVer(version, _fwCurrentVer) < 0) {
    const ok = await confirm2(
      t("fw_downgrade_title"),
      t("fw_downgrade_text").replace("{v}", version),
    );
    if (!ok) return;
  }

  // Windows 特别提示（基于服务器平台而非客户端浏览器平台）
  var isWin = isServerWindows();
  if (isWin) {
    var ok = await confirm2(t("fw_win_confirm_title"), t("fw_win_confirm_text"));
    if (!ok) return;
  }

  const btn = document.getElementById("fwUpdateBtn");
  btn.disabled = true;
  btn.innerHTML = "<span>" + t("installing") + "</span>";

  const d = await api("/api/framework/update", {
    method: "POST",
    body: JSON.stringify({ version, lang }),
  });

  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, "ErisPulse==" + version);
    if (isWin) {
      toast(t("fw_win_update_started"), "ok");
    } else {
      toast(t("installing"), "");
    }
  } else {
    toast(t("install_failed"), "er");
    btn.disabled = false;
    btn.innerHTML =
      '<span data-i18n="fw_install_update">' +
      t("fw_install_update") +
      "</span>";
  }
}

function toggleKvGroup(hd) {
  const g = hd.parentElement;
  const body = g.querySelector(".kv-group-body");
  if (g.classList.contains("collapsed")) {
    if (!body.innerHTML) {
      const obj = window._kvData;
      function find(d, t) {
        const keys = t.split(".");
        let cur = d;
        for (const k of keys) {
          if (cur == null || typeof cur !== "object") return null;
          cur = cur[k];
        }
        return cur;
      }
      const data = find(obj, g.dataset.pfx);
      if (data && typeof data === "object")
        body.innerHTML = kvTree(
          data,
          g.dataset.mode,
          g.dataset.pfx,
          parseInt(g.dataset.dep),
        );
    }
    g.classList.remove("collapsed");
  } else {
    g.classList.add("collapsed");
  }
}

async function saveConfig(btn) {
  const inp = btn.previousElementSibling;
  const fk = inp.dataset.key;
  const tp = inp.dataset.type;
  let v = inp.value;
  if (tp === "boolean") v = v === "true";
  else if (tp === "number") v = Number(v);
  else if (tp === "object") {
    try {
      v = JSON.parse(v);
    } catch (e) {
      return;
    }
  }
  const d = await api("/api/config", {
    method: "PUT",
    body: JSON.stringify({ key: fk, value: v }),
  });
  inp.style.border =
    d && d.success ? "2px solid var(--ok-c)" : "2px solid var(--er-c)";
  setTimeout(() => (inp.style.border = ""), 1200);
}
async function saveStorage(btn) {
  const inp = btn.previousElementSibling;
  const k = inp.dataset.key;
  let v = inp.value;
  try {
    v = JSON.parse(v);
  } catch (e) {}
  const d = await api("/api/storage", {
    method: "POST",
    body: JSON.stringify({ key: k, value: v }),
  });
  inp.style.border =
    d && d.success ? "2px solid var(--ok-c)" : "2px solid var(--er-c)";
  setTimeout(() => (inp.style.border = ""), 1200);
}
async function delStorage(k, btn) {
  const row = btn.closest(".kv-row");
  row.style.opacity = ".3";
  const d = await api("/api/storage/delete", {
    method: "POST",
    body: JSON.stringify({ key: k }),
  });
  if (d && d.success) {
    row.style.transition = "all .2s";
    requestAnimationFrame(() => {
      row.style.maxHeight = "0";
      row.style.padding = "0";
      row.style.overflow = "hidden";
      row.style.borderWidth = "0";
      setTimeout(() => row.remove(), 200);
    });
  } else row.style.opacity = "1";
}

let _eventStreamLive = true;
let _wsEventBuffer = [];
let _wsFlushTimer = null;
function _flushEventStream() {
  if (!_wsEventBuffer.length) return;
  if (!_eventStreamLive) {
    _wsEventBuffer = [];
    return;
  }
  const el = document.getElementById("eventList");
  if (!el) {
    _wsEventBuffer = [];
    return;
  }
  const active = document.querySelector(".page.active");
  if (!active || active.id !== "p-event-stream") {
    _wsEventBuffer = [];
    return;
  }
  const em = el.querySelector(".empty-state");
  if (em) em.remove();
  _wsEventBuffer.forEach((ev) => {
    el.insertAdjacentHTML("afterbegin", evHtml(ev));
  });
  while (el.children.length > 100) el.removeChild(el.lastChild);
  _wsEventBuffer = [];
}
function toggleEventLive() {
  _eventStreamLive = !_eventStreamLive;
  const btn = document.getElementById("eventLiveBtn");
  if (btn) {
    btn.style.opacity = _eventStreamLive ? "" : "0.5";
    btn.title = _eventStreamLive
      ? t("live_events")
      : t("live_events") + " (" + t("module_disabled") + ")";
  }
}

function wsConnect() {
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    try {
      ws.close();
    } catch (e) {}
    ws = null;
  }
  var u;
  if (currentNode === "local") {
    const p = location.protocol === "https:" ? "wss:" : "ws:";
    u =
      p +
      "//" +
      location.host +
      API +
      "/ws?token=" +
      encodeURIComponent(localStorage.getItem(TK) || "");
  } else {
    var info = nodeRuntimeInfo[currentNode] || {};
    var nodeUrl = info.url || "";
    if (!nodeUrl) {
      connStateChange(0, false);
      return;
    }
    var wsProto = nodeUrl.startsWith("https") ? "wss:" : "ws:";
    var wsHost = nodeUrl.replace(/^https?:\/\//, "");
    u =
      wsProto +
      "//" +
      wsHost +
      "/Dashboard/ws?token=" +
      encodeURIComponent(info.token || "");
  }
  ws = new WebSocket(u);
  ws.onopen = () => {
    connStateChange(1, true);
  };
  ws.onclose = () => {
    connStateChange(0, true);
    setTimeout(wsConnect, 3000);
  };
  ws.onerror = () => ws.close();
  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (m.type === "event") {
        allEvents.push(m.data);
        _totalEventCount++;
        if (allEvents.length > 500) allEvents.shift();
        const sv = document.getElementById("statGrid");
        const statCards = sv?.querySelectorAll(".stat-val");
        if (statCards && statCards[3])
          statCards[3].textContent = _totalEventCount;
        if (document.querySelector(".page.active")?.id === "p-dashboard") {
          const dh = document.getElementById("dashEvents");
          const em = dh?.querySelector(".empty-state");
          if (em) em.remove();
          dh?.insertAdjacentHTML("afterbegin", evHtml(m.data));
          while (dh && dh.children.length > 20) dh.removeChild(dh.lastChild);
        }
        if (
          document.querySelector(".page.active")?.id === "p-event-stream" &&
          _eventStreamLive
        ) {
          _wsEventBuffer.push(m.data);
          if (!_wsFlushTimer) {
            _wsFlushTimer = setTimeout(() => {
              _wsFlushTimer = null;
              _flushEventStream();
            }, 500);
          }
        }
      } else if (m.type === "install_progress") {
        const pkg =
          _installTaskIds.get(m.task_id) ||
          (m.packages ? m.packages.join(", ") : "");
        if (m.status === "running") {
          addOrUpdateTask(m.task_id, pkg, "running", m.output || []);
        } else if (m.status === "success") {
          _installTaskIds.delete(m.task_id);
          addOrUpdateTask(m.task_id, pkg, "success", m.output || []);
          loadModules();
          loadPackages(true);
        } else if (m.status === "error") {
          _installTaskIds.delete(m.task_id);
          addOrUpdateTask(
            m.task_id,
            pkg,
            "error",
            m.output || [],
            m.message || t("install_failed"),
          );
        }
      } else if (m.type === "module_changed") {
        if (m.data && m.data.action === "installed") {
          toast(m.data.name + ": " + t("module_loaded_dynamic"), "ok");
        }
        if (m.data && m.data.action === "upgraded") {
          toast(t("pkg_upgrade_success"), "ok");
          loadPackages(true);
        }
        loadModules();
      } else if (m.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      } else if (m.type === "views_changed") {
        if (m.data && m.data.action === "unregister" && m.data.id) {
          _removeModuleView(m.data.id);
        } else {
          loadModuleViews();
        }
      }
    } catch (err) {}
  };
}

function loadAll() {
  initMirrorSelects();
  initHeaderStatusIcon();
  fetchAdapterLogos();
  refreshDashboard();
  checkFwUpdateBadge();
  loadEvents();
  loadBots();
  loadModules();
  loadConfig();
  loadStore();
  loadMessageStats();
  loadAuditLog();
  loadPerformance();
  loadPackages();
  loadPackageUpdates();
  loadModuleViews();
  restartRefreshTimer();
}

// ========== 模块配置页面 ==========

var _moduleConfigNames = [];
var _moduleConfigCurrent = "";

async function loadModuleConfigPage() {
  const d = await api("/api/modules");
  if (!d) return;

  // 只保留有配置 schema 的模块
  _moduleConfigNames = (d.modules || []).filter(function (m) {
    return m.type === "module" && m.has_config;
  });

  const panel = document.getElementById("moduleConfigPanel");
  const empty = document.getElementById("moduleConfigEmpty");

  if (_moduleConfigNames.length === 0) {
    if (empty) empty.style.display = "flex";
    let container = document.getElementById("moduleConfigContent");
    if (container) container.remove();
    return;
  }

  if (empty) empty.style.display = "none";

  // 构建选择器（与适配器配置一致的芯片式布局）
  var selectorHtml = [
    '<div class="adapter-selector-bar">',
    '<div class="adapter-chip-list" id="moduleChipList">',
  ];
  _moduleConfigNames.forEach(function (m) {
    var isActive = m.name === _moduleConfigCurrent;
    var cls = isActive ? " adapter-chip active" : " adapter-chip";
    var dotColor = m.loaded ? "var(--ok-c)" : m.enabled ? "var(--wr-c)" : "var(--tx-t)";
    var iconSvg =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
    selectorHtml.push(
      '<div class="' +
        cls +
        '" data-module="' +
        esc(m.name) +
        '" onclick="selectModuleConfig(\'' +
        esc(m.name) +
        '\')">',
      iconSvg,
      '<span class="adapter-chip-name">' + esc(m.name) + "</span>",
      '<span class="adapter-chip-dot" style="background:' +
        dotColor +
        '"></span>',
      "</div>",
    );
  });
  selectorHtml.push("</div></div>");

  // 保留内容区
  var existingContent = document.getElementById("moduleConfigContent");
  panel.innerHTML = selectorHtml.join("");
  if (existingContent) {
    panel.appendChild(existingContent);
  } else {
    var c = document.createElement("div");
    c.id = "moduleConfigContent";
    panel.appendChild(c);
  }

  if (
    !_moduleConfigCurrent ||
    !_moduleConfigNames.some(function (m) {
      return m.name === _moduleConfigCurrent;
    })
  ) {
    _moduleConfigCurrent = _moduleConfigNames[0].name;
  }

  // 高亮当前
  var chips = panel.querySelectorAll(".adapter-chip[data-module]");
  chips.forEach(function (el) {
    el.classList.toggle("active", el.dataset.module === _moduleConfigCurrent);
  });

  loadModuleConfigDetail(_moduleConfigCurrent);
}

function selectModuleConfig(name) {
  _moduleConfigCurrent = name;
  var panel = document.getElementById("moduleConfigPanel");
  if (panel) {
    var chips = panel.querySelectorAll(".adapter-chip[data-module]");
    chips.forEach(function (el) {
      el.classList.toggle("active", el.dataset.module === name);
    });
  }
  loadModuleConfigDetail(name);
}

async function loadModuleConfigDetail(moduleName) {
  let container = document.getElementById("moduleConfigContent");
  if (!container) {
    var panel = document.getElementById("moduleConfigPanel");
    if (!panel) return;
    container = document.createElement("div");
    container.id = "moduleConfigContent";
    panel.appendChild(container);
  }
  container.innerHTML =
    '<div style="padding:40px;text-align:center;color:var(--tx-s)">' +
    t("loading") +
    "...</div>";

  const d = await api(
    "/api/module/" + encodeURIComponent(moduleName) + "/config",
  );
  if (!d || d.error) {
    container.innerHTML =
      '<div class="empty-state"><p>' +
      esc(d ? d.error : t("unknown_error")) +
      "</p></div>";
    return;
  }

  var html = '<div class="adapter-config-detail">';

  if (d.has_config && d.schema) {
    html +=
      '<div class="fw-section"><div class="fw-section-title">' +
      esc(moduleName) +
      '</div><div class="fw-section-body">';
    html +=
      '<div id="moduleConfigFields">' +
      renderAdapterSchemaFields(d.schema.fields, d.values || {}, d.config_key) +
      "</div>";
    html +=
      '<div style="margin-top:12px;text-align:right"><button class="btn btn-primary btn-sm" onclick="saveModuleConfigAll(\'' +
      esc(moduleName) +
      '\')">' +
      t("save_module_config") +
      "</button></div>";
    html += "</div></div>";
  } else {
    html +=
      '<div class="empty-state"><p>' +
      t("no_config_schema") +
      "</p></div>";
  }

  html += "</div>";
  container.innerHTML = html;
}

async function saveModuleConfigAll(moduleName) {
  var d = await api(
    "/api/module/" + encodeURIComponent(moduleName) + "/config",
  );
  if (!d || !d.schema) return;

  var values = {};
  var inputs = document.querySelectorAll(
    "#moduleConfigFields [data-ackey]",
  );
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var ackey = el.dataset.ackey;
    var parts = ackey.split(".");
    var keyName = parts[parts.length - 1];
    var tp = el.dataset.adapterTp || "string";
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (tp === "number" || tp === "integer" || tp === "float")
      val = Number(val);
    else if (tp === "object") {
      try {
        val = JSON.parse(val);
      } catch (e) {
        continue;
      }
    }
    values[keyName] = val;
  }

  var result = await api(
    "/api/module/" + encodeURIComponent(moduleName) + "/config",
    {
      method: "PUT",
      body: JSON.stringify({ values: values }),
    },
  );

  if (result && result.success) {
    toast(t("module_config_saved"), "ok");
  } else {
    toast(
      t("save_failed") + ": " + (result?.error || t("unknown_error")),
      "er",
    );
    if (result?.errors) toast(result.errors.join(", "), "er");
  }
}

// ========== 事件构建器相关 ==========

let builderState = {
  eventType: "message",
  detailType: "",
  platform: "",
  botId: "",
  customPlatform: false,
  customBot: false,
  messageSegments: [],
  optionalFields: [],
};

const EVENT_TYPES = {
  message: {
    detail_types: ["private", "group", "channel", "guild", "thread", "user"],
    required_fields: ["message", "alt_message", "user_id"],
    optional_fields: [
      "group_id",
      "channel_id",
      "guild_id",
      "user_nickname",
      "message_id",
    ],
  },
  notice: {
    detail_types: [
      "friend_increase",
      "friend_decrease",
      "group_member_increase",
      "group_member_decrease",
    ],
    required_fields: ["user_id"],
    optional_fields: [
      "user_nickname",
      "group_id",
      "operator_id",
      "operator_nickname",
    ],
  },
  request: {
    detail_types: ["friend", "group"],
    required_fields: ["user_id", "comment"],
    optional_fields: ["user_nickname", "group_id"],
  },
  meta: {
    detail_types: ["connect", "disconnect", "heartbeat"],
    required_fields: [],
    optional_fields: [],
  },
};

async function initEventBuilder() {
  // 加载平台列表
  await loadPlatforms();
  // 设置默认详情类型
  updateDetailTypeOptions();
  // 初始化预览
  updateEventPreview();
  // 加载消息段类型
  await loadMessageSegmentTypes();
}

async function loadPlatforms() {
  const d = await api("/api/adapters");
  if (!d) return;

  const platforms = d.adapters || [];
  const select = document.getElementById("platformSelect");
  select.innerHTML = '<option value="">' + t("select_platform") + "</option>";

  platforms.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.platform;
    opt.textContent = p.platform;
    select.appendChild(opt);
  });
}

async function loadBotsForPlatform(platform) {
  const select = document.getElementById("botSelect");
  select.innerHTML = '<option value="">' + t("select_bot") + "</option>";

  if (!platform) return;

  const bots = await api("/api/bots");
  if (bots && bots.bots) {
    const platformBots = bots.bots.filter((b) => b.platform === platform);
    platformBots.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.bot_id;
      opt.textContent =
        b.bot_id +
        (b.info?.user_name ? ` (${b.info.user_name})` : "") +
        " (" +
        t("online") +
        ")";
      select.appendChild(opt);
    });
  }
}

function selectEventType(type) {
  builderState.eventType = type;

  // 更新按钮状态
  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.type === type) btn.classList.add("active");
  });

  // 更新详情类型选项
  updateDetailTypeOptions();

  // 更新必填字段显示
  updateRequiredFields();

  // 更新消息构建器显示
  const msgCard = document.getElementById("messageBuilderCard");
  if (msgCard) {
    msgCard.style.display = type === "message" ? "block" : "none";
  }

  updateEventPreview();
}

function updateDetailTypeOptions() {
  const select = document.getElementById("detailType");
  const types = EVENT_TYPES[builderState.eventType]?.detail_types || [];

  select.innerHTML =
    '<option value="">' + t("select_detail_type") + "</option>";
  types.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
}

function onDetailTypeChange() {
  builderState.detailType = document.getElementById("detailType").value;
  updateEventPreview();
}

function onPlatformChange() {
  const select = document.getElementById("platformSelect");
  builderState.platform = select.value;
  builderState.customPlatform = false;
  loadBotsForPlatform(builderState.platform);
  updateEventPreview();
}

function onBotChange() {
  const select = document.getElementById("botSelect");
  builderState.botId = select.value;
  builderState.customBot = false;
  updateEventPreview();
}

function toggleCustomPlatform() {
  const group = document.getElementById("customPlatformGroup");
  const select = document.getElementById("platformSelect");

  builderState.customPlatform = !builderState.customPlatform;
  group.style.display = builderState.customPlatform ? "block" : "none";
  select.disabled = builderState.customPlatform;

  if (builderState.customPlatform) {
    builderState.platform = "";
  }

  updateEventPreview();
}

function toggleCustomBot() {
  const group = document.getElementById("customBotGroup");
  const select = document.getElementById("botSelect");

  builderState.customBot = !builderState.customBot;
  group.style.display = builderState.customBot ? "block" : "none";
  select.disabled = builderState.customBot;

  if (builderState.customBot) {
    builderState.botId = "";
  }

  updateEventPreview();
}

function updateRequiredFields() {
  // 清空附加字段区域（user_id 和 alt_message 现在自动处理）
  const container = document.getElementById("optionalFields");
  container.innerHTML = "";
}

function addOptionalField(key = "", value = "", label = "") {
  const container = document.getElementById("optionalFields");

  const div = document.createElement("div");
  div.className = "optional-field";
  div.dataset.key = key;
  // 确定 placeholder
  var ph = t("field_value_placeholder");
  if (label) {
    ph = t(label) || label;
  }
  div.innerHTML = `
        <input type="text" placeholder="${t("field_name_placeholder")}" value="${esc(key)}" onchange="updateOptionalFieldKey(this.parentElement)">
        <input type="text" placeholder="${esc(ph)}" value="${esc(value)}" onchange="updateOptionalFieldValue(this)">
        <button class="optional-field-remove" onclick="removeOptionalField(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
        </button>
    `;

  container.appendChild(div);
  updateEventPreview();
}

function updateOptionalFieldKey(div) {
  // 更新 data-key 以便 buildEventData 正确读取
  var keyInput = div.querySelector("input:first-child");
  if (keyInput) div.dataset.key = keyInput.value;
  updateEventPreview();
}

function updateOptionalFieldValue(input) {
  updateEventPreview();
}

function removeOptionalField(btn) {
  btn.closest(".optional-field").remove();
  updateEventPreview();
}

async function loadMessageSegmentTypes() {
  const d = await api("/api/builder/segments");
  if (!d) return;

  window.messageSegmentTypes = d;
}

function addMessageSegment() {
  if (!window.messageSegmentTypes) {
    toast(t("load_segments_first"), "er");
    return;
  }

  const types = window.messageSegmentTypes.standard_segments || [];

  if (types.length === 0) return;

  const container = document.getElementById("messageSegments");
  const segment = {
    type: types[0].type,
    fields: {},
  };

  const div = document.createElement("div");
  div.className = "message-segment";

  let fieldsHtml = "";
  types[0].fields.forEach((f) => {
    fieldsHtml += `
            <input type="text" placeholder="${f.name}"
                   data-field="${f.name}"
                   oninput="updateMessageSegment(this)"
                   ${f.required ? "required" : ""}>
        `;
  });

  div.innerHTML = `
        <select class="segment-type" onchange="changeSegmentType(this)">
            ${types.map((t) => `<option value="${t.type}">${t.name}</option>`).join("")}
        </select>
        <div class="segment-fields">${fieldsHtml}</div>
        <button class="segment-remove" onclick="removeMessageSegment(this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
        </button>
    `;

  container.appendChild(div);

  builderState.messageSegments.push(segment);
  updateEventPreview();
}

function changeSegmentType(select) {
  const segmentDiv = select.closest(".message-segment");
  const index = Array.from(segmentDiv.parentElement.children).indexOf(
    segmentDiv,
  );
  const type = select.value;

  builderState.messageSegments[index].type = type;
  builderState.messageSegments[index].fields = {};

  // 更新字段输入框
  const segmentType = (window.messageSegmentTypes.standard_segments || []).find(
    (s) => s.type === type,
  );
  if (segmentType) {
    const fieldsDiv = segmentDiv.querySelector(".segment-fields");
    let fieldsHtml = "";
    segmentType.fields.forEach((f) => {
      fieldsHtml += `
                <input type="text" placeholder="${f.name}"
                       data-field="${f.name}"
                       oninput="updateMessageSegment(this)"
                       ${f.required ? "required" : ""}>
            `;
    });
    fieldsDiv.innerHTML = fieldsHtml;
  }

  updateEventPreview();
}

function updateMessageSegment(input) {
  const segmentDiv = input.closest(".message-segment");
  const index = Array.from(segmentDiv.parentElement.children).indexOf(
    segmentDiv,
  );
  const fieldName = input.dataset.field;
  const value = input.value;

  builderState.messageSegments[index].fields[fieldName] = value;
  updateEventPreview();
}

function removeMessageSegment(btn) {
  const segmentDiv = btn.closest(".message-segment");
  const index = Array.from(segmentDiv.parentElement.children).indexOf(
    segmentDiv,
  );

  segmentDiv.remove();
  builderState.messageSegments.splice(index, 1);
  updateEventPreview();
}

function buildEventData() {
  const platform = builderState.customPlatform
    ? document.getElementById("platformCustom").value
    : builderState.platform;

  const botId = builderState.customBot
    ? document.getElementById("botCustom").value
    : builderState.botId;

  const event = {
    id: "builder_" + Date.now(),
    time: Math.floor(Date.now() / 1000),
    type: builderState.eventType,
    detail_type: builderState.detailType,
    platform: platform,
    self: {
      platform: platform,
      user_id: botId,
    },
  };

  // 添加消息段
  if (builderState.eventType === "message") {
    event.message = builderState.messageSegments.map((seg) => ({
      type: seg.type,
      data: seg.fields,
    }));
  }

  // 添加附加字段（用户手动添加的）
  const optionalFields = document.querySelectorAll(".optional-field");
  optionalFields.forEach((field) => {
    const inputs = field.querySelectorAll("input");
    if (inputs.length >= 2) {
      const key = inputs[0].value.trim();
      const value = inputs[1].value.trim();
      if (key && value) {
        event[key] = value;
      }
    }
  });

  // 添加会话信息
  const sessionType = document.getElementById("sessionType").value;
  const sessionId = document.getElementById("sessionId").value;

  if (sessionType === "private") {
    event.user_id = event.user_id || sessionId;
  } else if (sessionType === "group") {
    event.group_id = event.group_id || sessionId;
  } else if (sessionType === "channel") {
    event.channel_id = event.channel_id || sessionId;
  }

  // user_id 默认使用 bot 的 ID（OneBot12 标准字段）
  if (!event.user_id) {
    event.user_id = botId || "test_user";
  }

  // alt_message 自动从消息段生成
  if (builderState.eventType === "message") {
    if (!event.alt_message) {
      event.alt_message = (event.message || [])
        .filter((seg) => seg.type === "text" && seg.data && seg.data.text)
        .map((seg) => seg.data.text)
        .join("");
      // 没有文本段时给一个占位值，避免服务端校验拒绝
      if (!event.alt_message) event.alt_message = "[test message]";
    }
  }

  return event;
}

function updateEventPreview() {
  const event = buildEventData();
  const preview = document.getElementById("eventJsonPreview");
  if (preview) {
    preview.textContent = JSON.stringify(event, null, 2);
  }
}

function copyEventJson() {
  const event = buildEventData();
  const json = JSON.stringify(event, null, 2);

  navigator.clipboard
    .writeText(json)
    .then(() => {
      toast(t("copied_to_clipboard"), "ok");
    })
    .catch(() => {
      toast(t("copy_failed"), "er");
    });
}

async function previewEvent() {
  const event = buildEventData();

  showOutputModal(
    t("event_preview"),
    [JSON.stringify(event, null, 2)],
    [{ label: t("ok"), value: true, primary: true }],
  );
}

async function submitEvent() {
  const event = buildEventData();

  const result = await api("/api/builder/submit", {
    method: "POST",
    body: JSON.stringify(event),
  });

  if (result && result.success) {
    toast(t("submit_success"), "ok");
  } else {
    var errs = result?.errors || [result?.error || t("unknown_error")];
    showOutputModal(t("submit_failed"), errs, [
      { label: t("ok"), value: true, primary: true },
    ]);
  }
}

// 添加实时预览的监听器
document.addEventListener("DOMContentLoaded", function () {
  // 监听平台自定义输入
  const platformCustom = document.getElementById("platformCustom");
  if (platformCustom) {
    platformCustom.addEventListener("input", function () {
      builderState.platform = this.value;
      updateEventPreview();
    });
  }

  // 监听 Bot 自定义输入
  const botCustom = document.getElementById("botCustom");
  if (botCustom) {
    botCustom.addEventListener("input", function () {
      builderState.botId = this.value;
      updateEventPreview();
    });
  }

  // 监听会话类型和 ID
  const sessionType = document.getElementById("sessionType");
  const sessionId = document.getElementById("sessionId");
  if (sessionType) {
    sessionType.addEventListener("change", updateEventPreview);
  }
  if (sessionId) {
    sessionId.addEventListener("input", updateEventPreview);
  }

  // 按钮涟漪效果
  initRippleEffects();
});

// 涟漪效果初始化
function initRippleEffects() {
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".btn");
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    btn.style.setProperty("--ripple-x", x + "%");
    btn.style.setProperty("--ripple-y", y + "%");
    btn.classList.remove("ripple");
    void btn.offsetWidth; // 强制重绘
    btn.classList.add("ripple");

    setTimeout(() => btn.classList.remove("ripple"), 600);
  });
}

// 贡献者头像延迟动画
function animateContributors() {
  const items = document.querySelectorAll(".about-contrib-item");
  items.forEach((item, i) => {
    item.style.animationDelay = i * 0.05 + "s";
  });
}

// ========== 日志功能 ==========

let _logAutoRefreshTimer = null;
let _logPaused = false;
let _logSortNewestBottom = true;
let _availableModules = new Set();

let _logDebounceTimer;
function debounceLogs() {
  clearTimeout(_logDebounceTimer);
  _logDebounceTimer = setTimeout(loadLogs, 300);
}

function toggleLogAutoRefresh() {
  if (_logAutoRefreshTimer) {
    clearInterval(_logAutoRefreshTimer);
    _logAutoRefreshTimer = null;
    document.getElementById("logAutoRefreshBtn").style.opacity = "0.5";
    toast(t("auto_refresh_off"), "");
  } else {
    loadLogs();
    _logAutoRefreshTimer = setInterval(loadLogs, 2000);
    document.getElementById("logAutoRefreshBtn").style.opacity = "1";
    toast(t("auto_refresh_on"), "ok");
  }
}

function toggleLogPause() {
  _logPaused = !_logPaused;
  var btn = document.getElementById("logPauseBtn");
  if (btn) {
    btn.classList.toggle("paused", _logPaused);
    btn.title = _logPaused ? t("resume_scroll") : t("pause_scroll");
  }
}

function toggleLogSortOrder() {
  _logSortNewestBottom = !_logSortNewestBottom;
  var btn = document.getElementById("logSortBtn");
  if (btn) {
    btn.classList.toggle("active", _logSortNewestBottom);
    btn.title = _logSortNewestBottom
      ? t("sort_newest_bottom")
      : t("sort_newest_top");
  }
  loadLogs();
}

async function loadLogs() {
  const moduleFilter = document.getElementById("logModuleFilter")?.value || "";
  const levelFilter = document.getElementById("logLevelFilter")?.value || "";
  const search = document.getElementById("logSearch")?.value || "";

  // 首次加载时收集所有模块
  if (_availableModules.size === 0) {
    const d = await api("/api/logs");
    if (d && d.logs) {
      d.logs.forEach((log) => {
        if (log.module) {
          _availableModules.add(log.module);
        }
      });
      updateModuleSelect();
    }
  }

  const params = new URLSearchParams();
  if (moduleFilter) params.set("module", moduleFilter);
  if (levelFilter) params.set("level", levelFilter);
  if (search) params.set("search", search);
  params.set("limit", "200");

  const d = await api("/api/logs?" + params);
  if (!d) return;

  const logs = d.logs || [];
  document.getElementById("logCount").textContent = d.total || 0;

  if (logs.length === 0) {
    document.getElementById("logList").innerHTML =
      '<div class="empty-state"><p>' + t("no_logs") + "</p></div>";
    return;
  }

  const sortedLogs = _logSortNewestBottom ? logs.slice().reverse() : logs;
  const logHtml = sortedLogs
    .map((log) => {
      const moduleEsc = esc(log.module);
      const moduleTooltip =
        log.module.length > 15 ? `title="${esc(log.module)}"` : "";
      var lvl = (log.level || "").toLowerCase();
      var lvlClass = lvl ? " log-level-" + lvl : "";
      var lvlBadge = lvl
        ? '<span class="log-level-badge ' + lvl + '">' + lvl + "</span>"
        : "";

      return `<div class="log-entry${lvlClass}" onclick="this.classList.toggle('log-expanded')">
            <span class="log-time">${esc(log.timestamp)}</span>
            <span class="log-module" ${moduleTooltip}>${lvlBadge}${moduleEsc}</span>
            <span class="log-message">${esc(log.message)}</span>
        </div>`;
    })
    .join("");

  const logList = document.getElementById("logList");
  const wasNearBottom =
    logList.scrollHeight - logList.scrollTop - logList.clientHeight < 50;

  logList.innerHTML = logHtml;

  if (!_logPaused && (_logAutoRefreshTimer || wasNearBottom)) {
    logList.scrollTop = _logSortNewestBottom ? logList.scrollHeight : 0;
  }
}

function updateModuleSelect() {
  const select = document.getElementById("logModuleFilter");
  if (!select) return;

  const currentValue = select.value;

  // 清空并重新填充
  select.innerHTML = '<option value="">' + t("all_modules") + "</option>";

  const sortedModules = Array.from(_availableModules).sort();
  sortedModules.forEach((module) => {
    const opt = document.createElement("option");
    opt.value = module;
    opt.textContent = module;
    select.appendChild(opt);
  });

  // 恢复之前的选择
  if (currentValue && _availableModules.has(currentValue)) {
    select.value = currentValue;
  }
}

function copyLogs() {
  const logList = document.getElementById("logList");
  if (!logList) return;

  const logs = Array.from(logList.querySelectorAll(".log-entry"))
    .map((el) => el.textContent)
    .join("\n");

  navigator.clipboard
    .writeText(logs)
    .then(() => {
      toast(t("copied_to_clipboard"), "ok");
    })
    .catch(() => {
      toast(t("copy_failed"), "er");
    });
}

// ========== 生命周期功能 ==========

async function loadLifecycle() {
  const d = await api("/api/lifecycle");
  if (!d) return;

  const events = d.events || [];
  const filter = document.getElementById("lifecycleFilter")?.value || "";

  const filtered = filter
    ? events.filter((e) => e.event.startsWith(filter + "."))
    : events;

  if (filtered.length === 0) {
    document.getElementById("lifecycleTimeline").innerHTML =
      '<div class="empty-state"><p>' + esc(t("no_lifecycle")) + "</p></div>";
    return;
  }

  const timelineHtml = filtered
    .map((event, idx) => {
      const eventParts = event.event.split(".");
      const eventType = eventParts[0] || "";
      const eventName = eventParts.slice(1).join(".");

      const time = new Date(event.timestamp * 1000).toLocaleTimeString();

      const hasData = event.data && Object.keys(event.data).length > 0;
      const dataJson = hasData ? JSON.stringify(event.data, null, 2) : "";

      return `<div class="lifecycle-item${hasData ? " has-data" : ""}" ${hasData ? `onclick="this.classList.toggle('expanded')"` : ""}>
            <span class="lifecycle-badge ${esc(eventType)}">${esc(eventType)}</span>
            <span class="lifecycle-event">${esc(eventName)}</span>
            <span class="lifecycle-time">${time}</span>
            ${hasData ? '<span class="lifecycle-expand-hint">▸</span>' : ""}
            ${hasData ? `<div class="lifecycle-data"><pre>${esc(dataJson)}</pre></div>` : ""}
        </div>`;
    })
    .join("");

  document.getElementById("lifecycleTimeline").innerHTML = timelineHtml;
}

async function clearLifecycle() {
  const ok = await confirm2(t("clear_events"), t("clear_confirm"));
  if (!ok) return;
  await api("/api/lifecycle/clear", { method: "POST" });
  loadLifecycle();
}

// ========== 关于页面 ==========

async function loadAbout() {
  loadAboutContributors();
}

async function loadAboutContributors() {
  const container = document.getElementById("aboutContributors");
  if (!container) return;

  try {
    const resp = await fetch(
      "https://api.github.com/repos/ErisPulse/ErisPulse/contributors?per_page=100",
    );
    if (!resp.ok) throw new Error("Failed to fetch");
    const contributors = await resp.json();

    if (!Array.isArray(contributors) || contributors.length === 0) {
      container.innerHTML = '<span class="about-contrib-empty">-</span>';
      return;
    }

    container.innerHTML = contributors
      .map(
        (c) => `
            <a href="${esc(c.html_url)}" target="_blank" rel="noopener" class="about-contrib-item" title="${esc(c.login)}">
                <img src="${esc(c.avatar_url)}" alt="${esc(c.login)}" loading="lazy" width="36" height="36">
                <span class="about-contrib-name">${esc(c.login)}</span>
            </a>
        `,
      )
      .join("");
    animateContributors();
  } catch {
    container.innerHTML =
      '<span class="about-contrib-empty" data-i18n="about_contrib_failed"></span>';
  }
}

// ========== 性能监控功能 ==========

async function loadPerformance() {
  const d = await api("/api/performance");
  if (!d) return;

  const system = d.system || {};
  const process = system.process || {};
  const memory = system.memory || {};

  const fmt = (v, unit = "") => {
    if (v === null || v === undefined) return "--" + unit;
    if (typeof v === "string") v = parseFloat(v) || 0;
    return v.toFixed(1) + unit;
  };

  var _updateCircle = function (circleId, textId, pct) {
    var circleEl = document.getElementById(circleId);
    if (circleEl) {
      circleEl.setAttribute("stroke-dashoffset", 100 - Math.min(pct, 100));
      circleEl.classList.toggle("high", pct > 60);
      circleEl.classList.toggle("critical", pct > 85);
    }
    var textEl = document.getElementById(textId);
    if (textEl) textEl.textContent = (pct || 0).toFixed(0) + "%";
  };
  var _updateBar = function (barId, pct) {
    var bar = document.getElementById(barId);
    if (bar) {
      bar.style.width = Math.min(pct, 100) + "%";
      bar.classList.toggle("high", pct > 60);
      bar.classList.toggle("critical", pct > 85);
    }
  };

  // CPU 卡片：只显示进程CPU
  var procCpu = memory.cpu_percent || 0;
  var sysCpu = memory.system_cpu_percent || 0;
  _updateCircle("cpuProgressCircle", "cpuProgressText", procCpu);

  // 内存卡片：只显示进程内存
  var rssMb = memory.rss_mb || 0;
  var totalGb = memory.system_total_gb || 0;
  var procMemPct =
    totalGb > 0 ? Math.min((rssMb / (totalGb * 1024)) * 100, 100) : 0;
  var sysPct = memory.system_percent || 0;

  _updateCircle("memProgressCircle", "memProgressText", procMemPct);
  if (document.getElementById("procMemVal"))
    document.getElementById("procMemVal").textContent = fmt(rssMb, " MB");

  // popover详情
  const setEl = (id, v, unit = "") => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(v, unit);
  };
  if (document.getElementById("cpuProcPct"))
    document.getElementById("cpuProcPct").textContent = fmt(procCpu, "%");
  if (document.getElementById("cpuSysPct"))
    document.getElementById("cpuSysPct").textContent = fmt(sysCpu, "%");
  setEl("cpuUser", process.cpu_user, " s");
  setEl("cpuSys", process.cpu_system, " s");
  if (document.getElementById("cpuThreads"))
    document.getElementById("cpuThreads").textContent = String(
      process.threads || "--",
    );

  if (document.getElementById("memRss"))
    document.getElementById("memRss").textContent = fmt(rssMb, " MB");
  if (document.getElementById("sysMemPct"))
    document.getElementById("sysMemPct").textContent = fmt(sysPct, "%");
  setEl("vmsMem", memory.vms_mb, " MB");
  setEl("sysTotal", memory.system_total_gb, " GB");
  setEl("sysAvail", memory.system_available_gb, " GB");
  setEl("swapMem", memory.swap_used_mb, " MB");
  setEl("ioRead", process.read_bytes_mb, " MB");
  setEl("ioWrite", process.write_bytes_mb, " MB");

  // 实例信息
  if (document.getElementById("instUptime"))
    document.getElementById("instUptime").textContent =
      system.uptime_human || "--";
  if (document.getElementById("instThreads"))
    document.getElementById("instThreads").textContent = String(
      process.threads || "--",
    );
  if (document.getElementById("instConnections"))
    document.getElementById("instConnections").textContent = String(
      process.connections || "--",
    );
  // 存储以便后续使用
  window._perfData = {
    vms: memory.vms_mb,
    threads: process.threads,
    connections: process.connections,
    listening: process.listening,
    readBytes: process.read_bytes_mb,
    writeBytes: process.write_bytes_mb,
    swapUsed: memory.swap_used_mb,
    swapPercent: memory.swap_percent,
    sysTotal: memory.system_total_gb,
    sysAvail: memory.system_available_gb,
  };
}

// ========== Popover 交互逻辑 ==========
function initPopovers() {
  // 定位popover
  function positionPopover(trigger, popover) {
    const rect = trigger.getBoundingClientRect();
    const gap = 12;

    // 先显示popover获取实际尺寸
    popover.style.visibility = "hidden";
    popover.style.display = "block";
    const popoverHeight = popover.offsetHeight;
    const popoverWidth = popover.offsetWidth;
    popover.style.visibility = "";
    popover.style.display = "";

    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // 优先显示在上方
    let top = rect.top - popoverHeight - gap;
    let left = rect.left + (rect.width - popoverWidth) / 2;

    // 如果上方空间不够，显示在下方
    if (top < gap) {
      top = rect.bottom + gap;
    }

    // 如果下方也不够，选择空间更大的一方
    if (top + popoverHeight > viewportH - gap) {
      const spaceAbove = rect.top - gap;
      const spaceBelow = viewportH - rect.bottom - gap;
      if (spaceAbove > spaceBelow) {
        top = rect.top - popoverHeight - gap;
      } else {
        top = rect.bottom + gap;
      }
    }

    // 确保不超出左右边界
    if (left < gap) {
      left = gap;
    }
    if (left + popoverWidth > viewportW - gap) {
      left = viewportW - popoverWidth - gap;
    }

    popover.style.top = top + "px";
    popover.style.left = left + "px";
  }

  // CPU详情popover
  const cpuSection = document.getElementById("cpuSection");
  const cpuPopover = document.getElementById("cpuDetailPopover");
  const cpuClose = document.getElementById("cpuPopoverClose");

  if (cpuSection && cpuPopover) {
    let cpuPinned = false;

    // 点击显示/隐藏
    cpuSection.addEventListener("click", function (e) {
      if (e.target.closest(".popover-close")) {
        cpuPinned = false;
        cpuPopover.classList.remove("show");
        return;
      }
      // 关闭内存popover
      if (memPopover) memPopover.classList.remove("show");

      cpuPinned = !cpuPinned;
      if (cpuPinned) {
        positionPopover(cpuSection, cpuPopover);
      }
      cpuPopover.classList.toggle("show", cpuPinned);
    });
  }

  // 内存详情popover
  const memSection = document.getElementById("memSection");
  const memPopover = document.getElementById("memDetailPopover");
  const memClose = document.getElementById("memPopoverClose");

  if (memSection && memPopover) {
    let memPinned = false;

    // 点击显示/隐藏
    memSection.addEventListener("click", function (e) {
      if (e.target.closest(".popover-close")) {
        memPinned = false;
        memPopover.classList.remove("show");
        return;
      }
      // 关闭CPUpopover
      if (cpuPopover) cpuPopover.classList.remove("show");

      memPinned = !memPinned;
      if (memPinned) {
        positionPopover(memSection, memPopover);
      }
      memPopover.classList.toggle("show", memPinned);
    });
  }

  // 点击外部关闭所有popover
  document.addEventListener("click", function (e) {
    if (
      !e.target.closest("#cpuSection") &&
      !e.target.closest("#cpuDetailPopover")
    ) {
      if (cpuPopover) cpuPopover.classList.remove("show");
    }
    if (
      !e.target.closest("#memSection") &&
      !e.target.closest("#memDetailPopover")
    ) {
      if (memPopover) memPopover.classList.remove("show");
    }
  });

  // ESC键关闭所有popover
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (cpuPopover) cpuPopover.classList.remove("show");
      if (memPopover) memPopover.classList.remove("show");
    }
  });

  // 窗口大小变化时重新定位
  window.addEventListener("resize", function () {
    if (cpuPopover && cpuPopover.classList.contains("show")) {
      positionPopover(cpuSection, cpuPopover);
    }
    if (memPopover && memPopover.classList.contains("show")) {
      positionPopover(memSection, memPopover);
    }
  });

  // 滚动时关闭popover
  window.addEventListener(
    "scroll",
    function () {
      if (cpuPopover && cpuPopover.classList.contains("show")) {
        cpuPopover.classList.remove("show");
      }
      if (memPopover && memPopover.classList.contains("show")) {
        memPopover.classList.remove("show");
      }
    },
    { passive: true },
  );
}

// 页面加载后初始化popover
document.addEventListener("DOMContentLoaded", initPopovers);

// ========== API 路由功能 ==========

async function loadApiRoutes() {
  const d = await api("/api/routes");
  if (!d) return;

  const httpRoutes = d.http_routes || [];
  const wsRoutes = d.ws_routes || [];

  document.getElementById("httpRouteCount").textContent = httpRoutes.length;
  document.getElementById("wsRouteCount").textContent = wsRoutes.length;

  var groups = {};

  httpRoutes.forEach(function (r) {
    var m = r.module || "System";
    if (!groups[m]) groups[m] = { http: [], ws: [] };
    groups[m].http.push(r);
  });

  wsRoutes.forEach(function (r) {
    var m = r.module || "System";
    if (!groups[m]) groups[m] = { http: [], ws: [] };
    groups[m].ws.push(r);
  });

  var moduleNames = Object.keys(groups).sort(function (a, b) {
    if (a === "System") return 1;
    if (b === "System") return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  var methodColor = {
    GET: "method-get",
    POST: "method-post",
    PUT: "method-put",
    DELETE: "method-delete",
    PATCH: "method-patch",
    OPTIONS: "method-options",
    HEAD: "method-head",
  };

  var html = "";

  moduleNames.forEach(function (mod, idx) {
    var g = groups[mod];
    var totalRoutes = g.http.length + g.ws.length;
    if (totalRoutes === 0) return;
    var basePath = "/" + mod;

    html +=
      '<div class="card route-group-card collapsed" style="margin-bottom:12px">';
    html +=
      '<div class="card-header" style="cursor:pointer;user-select:none" onclick="toggleRouteGroup(this)">';
    html +=
      '<svg class="route-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;transition:transform .2s">';
    html += '<polyline points="6 9 12 15 18 9"/></svg>';
    html += '<span style="flex:1;font-size:14px">' + esc(mod) + "</span>";
    html +=
      '<span class="chip chip-sc" style="margin:0">' +
      totalRoutes +
      " routes</span>";
    if (g.http.length > 0)
      html +=
        '<span class="chip chip-pr" style="margin:0;margin-left:4px">' +
        g.http.length +
        " HTTP</span>";
    if (g.ws.length > 0)
      html +=
        '<span class="chip chip-sc" style="margin:0;margin-left:4px">' +
        g.ws.length +
        " WS</span>";
    html += "</div>";
    html += '<div class="route-group-body" style="display:none">';

    g.http.forEach(function (r) {
      var mc = methodColor[r.method] || "method-get";
      html += '<div class="route-item">';
      html +=
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span class="method-badge ' + mc + '">' + r.method + "</span>";
      html +=
        '<code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">' +
        esc(r.full_path) +
        "</code>";
      html += '<div style="margin-left:auto">';
      html +=
        '<button class="btn btn-secondary btn-xs" onclick="openRouteTest(\'' +
        esc(r.method) +
        "','" +
        esc(r.full_path) +
        "')\">" +
        t("test") +
        "</button>";
      html += "</div></div></div>";
    });

    g.ws.forEach(function (r) {
      var authBadge = r.has_auth
        ? '<span class="chip chip-wr" style="margin:0">' +
          t("requires_auth") +
          "</span>"
        : "";
      html += '<div class="route-item">';
      html +=
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      html += '<span class="method-badge method-ws">WS</span>';
      html += authBadge;
      html +=
        '<code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">' +
        esc(r.full_path) +
        "</code>";
      html += "</div></div>";
    });

    html += "</div></div>";
  });

  var container = document.getElementById("routeModulesContainer");
  container.innerHTML =
    html ||
    '<div style="padding:16px;font-size:13px;color:var(--tx-s);text-align:center">' +
      t("no_data") +
      "</div>";

  var firstCard = container.querySelector(".route-group-card");
  if (firstCard) {
    firstCard.classList.remove("collapsed");
    firstCard.querySelector(".route-group-body").style.display = "block";
    var firstChevron = firstCard.querySelector(".route-group-chevron");
    if (firstChevron) firstChevron.style.transform = "rotate(180deg)";
    var firstHint = firstCard.querySelector(".route-expand-hint");
    if (firstHint) firstHint.style.display = "none";
  }
}

function toggleRouteGroup(hd) {
  var card = hd.parentElement;
  var body = card.querySelector(".route-group-body");
  var chevron = card.querySelector(".route-group-chevron");
  var hint = card.querySelector(".route-expand-hint");
  var collapsed = card.classList.contains("collapsed");

  if (collapsed) {
    body.style.display = "block";
    chevron.style.transform = "rotate(180deg)";
    card.classList.remove("collapsed");
    if (hint) hint.style.display = "none";
  } else {
    body.style.display = "none";
    chevron.style.transform = "rotate(0deg)";
    card.classList.add("collapsed");
    if (hint) hint.style.display = "";
  }
}

function expandAllRouteGroups() {
  var cards = document.querySelectorAll(".route-group-card");
  cards.forEach(function (card) {
    card.classList.remove("collapsed");
    card.querySelector(".route-group-body").style.display = "block";
    card.querySelector(".route-group-chevron").style.transform =
      "rotate(180deg)";
    var hint = card.querySelector(".route-expand-hint");
    if (hint) hint.style.display = "none";
  });
}

function collapseAllRouteGroups() {
  var cards = document.querySelectorAll(".route-group-card");
  cards.forEach(function (card) {
    card.classList.add("collapsed");
    card.querySelector(".route-group-body").style.display = "none";
    card.querySelector(".route-group-chevron").style.transform = "rotate(0deg)";
    var hint = card.querySelector(".route-expand-hint");
    if (hint) hint.style.display = "";
  });
}

// ========== 消息统计功能 ==========

async function loadMessageStats() {
  const d = await api("/api/message-stats");
  if (!d) return;

  // 消息类型分布
  const typeStats = d.by_type || {};
  var ti = 0;
  const typeHtml = Object.entries(typeStats)
    .map(([type, count]) => {
      const total = d.total_events || 1;
      const percent = ((count / total) * 100).toFixed(1);
      return (
        '<div class="stat-bar-chart">' +
        '<span class="stat-bar-label">' +
        esc(type) +
        "</span>" +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' +
        percent +
        '%"></div></div>' +
        '<span class="stat-bar-value">' +
        count +
        "</span></div>"
      );
    })
    .join("");
  document.getElementById("msgTypeStats").innerHTML =
    typeHtml ||
    '<div style="color:var(--tx-s);font-size:13px">' + t("no_data") + "</div>";

  // 平台分布
  const platformStats = d.by_platform || {};
  const platformHtml = Object.entries(platformStats)
    .map(([platform, count]) => {
      const total = d.total_events || 1;
      const percent = ((count / total) * 100).toFixed(1);
      return (
        '<div class="stat-bar-chart">' +
        '<span class="stat-bar-label">' +
        esc(platform) +
        "</span>" +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' +
        percent +
        '%"></div></div>' +
        '<span class="stat-bar-value">' +
        count +
        "</span></div>"
      );
    })
    .join("");
  document.getElementById("msgPlatformStats").innerHTML =
    platformHtml ||
    '<div style="color:var(--tx-s);font-size:13px">' + t("no_data") + "</div>";

  // 每小时趋势（最近24小时）
  const hourlyStats = d.hourly || {};
  const now = Date.now() / 1000;
  const bars = [];
  var maxCount = Math.max(...Object.values(hourlyStats), 1);

  for (let i = 23; i >= 0; i--) {
    const hourKey = Math.floor((now - i * 3600) / 3600) * 3600;
    const count = hourlyStats[hourKey] || 0;
    const height = maxCount > 0 ? Math.max((count / maxCount) * 100, 1) : 1;
    bars.push(
      '<div class="hourly-bar-wrap"><div class="hourly-bar" style="height:' +
        height +
        '%"></div></div>',
    );
  }

  // 只显示首尾和中间时间
  const firstHour = new Date((now - 23 * 3600) * 1000).getHours();
  const midHour = new Date((now - 12 * 3600) * 1000).getHours();
  const lastHour = new Date(now * 1000).getHours();

  document.getElementById("msgHourlyTrend").innerHTML =
    '<div class="hourly-chart">' +
    bars.join("") +
    "</div>" +
    '<div class="hourly-labels"><span class="hourly-label">' +
    firstHour +
    ':00</span><span class="hourly-label">' +
    midHour +
    ':00</span><span class="hourly-label">' +
    lastHour +
    ":00</span></div>";
}

// 更新 refreshDashboard 函数以包含性能监控
const _originalRefreshDashboard = refreshDashboard;
refreshDashboard = async function () {
  await _originalRefreshDashboard();
  await loadPerformance();
  await loadMessageStats();
};

// ========== API 路由测试 ==========

let _rtMethod = "",
  _rtFullPath = "";

function openRouteTest(method, fullPath) {
  _rtMethod = method;
  _rtFullPath = fullPath;
  const methodColor =
    {
      GET: "method-get",
      POST: "method-post",
      PUT: "method-put",
      DELETE: "method-delete",
      PATCH: "method-patch",
    }[method] || "method-get";
  const mb = document.getElementById("rtMethod");
  mb.textContent = method;
  mb.className = "method-badge " + methodColor;
  document.getElementById("rtPath").textContent = fullPath;
  document.getElementById("rtBodySection").style.display = [
    "POST",
    "PUT",
    "PATCH",
  ].includes(method)
    ? "block"
    : "none";
  document.getElementById("rtParams").innerHTML = "";
  document.getElementById("rtBody").value = "";
  document.getElementById("rtResponse").textContent = "";
  document.getElementById("rtResponseStatus").style.display = "none";
  document.getElementById("routeTestOverlay").style.display = "flex";
}

function closeRouteTest() {
  document.getElementById("routeTestOverlay").style.display = "none";
}

function addRouteParam(k, v) {
  const c = document.getElementById("rtParams");
  const d = document.createElement("div");
  d.style.cssText = "display:flex;gap:6px;margin-bottom:4px";
  d.innerHTML =
    '<input class="rt-pk" style="flex:1;padding:4px 8px;border:1px solid var(--bd);border-radius:4px;font-size:12px;background:var(--bg-s);color:var(--tx-p)" placeholder="Key" value="' +
    esc(k || "") +
    '">' +
    '<input class="rt-pv" style="flex:2;padding:4px 8px;border:1px solid var(--bd);border-radius:4px;font-size:12px;background:var(--bg-s);color:var(--tx-p)" placeholder="Value" value="' +
    esc(v || "") +
    '">' +
    '<button class="btn-icon" onclick="this.parentElement.remove()" style="flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  c.appendChild(d);
}

async function sendRouteTest() {
  const params = [];
  document.querySelectorAll("#rtParams > div").forEach((row) => {
    const k = row.querySelector(".rt-pk").value.trim();
    const v = row.querySelector(".rt-pv").value.trim();
    if (k) params.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
  });
  const qs = params.length ? "?" + params.join("&") : "";
  const url = _rtFullPath + qs;
  const tk = localStorage.getItem(TK);
  const headers = { Authorization: "Bearer " + tk };
  const bodyArea = document.getElementById("rtBody");
  const hasBody =
    ["POST", "PUT", "PATCH"].includes(_rtMethod) && bodyArea.value.trim();
  if (hasBody) headers["Content-Type"] = "application/json";
  document.getElementById("rtResponse").textContent = t("loading");
  document.getElementById("rtResponseStatus").style.display = "none";
  try {
    const opts = { method: _rtMethod, headers };
    if (hasBody) opts.body = bodyArea.value.trim();
    const resp = await fetch(url, opts);
    const statusEl = document.getElementById("rtResponseStatus");
    const isOk = resp.status >= 200 && resp.status < 300;
    statusEl.innerHTML =
      '<span class="chip ' +
      (isOk ? "chip-ok" : "chip-er") +
      '">' +
      resp.status +
      " " +
      esc(resp.statusText) +
      "</span>";
    statusEl.style.display = "block";
    const ct = resp.headers.get("content-type") || "";
    let text;
    if (ct.includes("json")) {
      const json = await resp.json();
      text = JSON.stringify(json, null, 2);
    } else {
      text = await resp.text();
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {}
    }
    document.getElementById("rtResponse").textContent = text;
  } catch (e) {
    document.getElementById("rtResponse").textContent = "Error: " + e.message;
  }
}

// ========== 审计日志功能 ==========

async function loadAuditLog() {
  const actionFilter =
    document.getElementById("auditActionFilter")?.value || "";
  const params = new URLSearchParams();
  if (actionFilter) params.set("action", actionFilter);
  params.set("limit", "200");
  const d = await api("/api/audit?" + params);
  if (!d) return;
  const logs = d.logs || [];
  document.getElementById("auditCount").textContent = d.total || 0;
  if (logs.length === 0) {
    document.getElementById("auditList").innerHTML =
      '<div class="empty-state"><p>' + t("no_data") + "</p></div>";
    return;
  }
  const html = logs
    .slice()
    .reverse()
    .map((log) => {
      const tm = new Date(log.timestamp * 1000).toLocaleString(getLocale());
      const actionKey = "action_" + log.action;
      const actionLabel =
        t(actionKey) !== actionKey ? t(actionKey) : esc(log.action);
      const actionClass =
        {
          restart_framework: "chip-er",
          clear_events: "chip-wr",
          package_install: "chip-ok",
          backup_import: "chip-pr",
        }[log.action] || "chip-sc";
      return (
        '<div class="list-row" style="font-size:13px;gap:12px">' +
        '<span class="chip ' +
        actionClass +
        '" style="min-width:100px;justify-content:center">' +
        esc(actionLabel) +
        "</span>" +
        '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx-s)" title="' +
        esc(log.detail) +
        '">' +
        esc(log.detail || "-") +
        "</span>" +
        '<span style="font-size:11px;color:var(--tx-t);white-space:nowrap">' +
        esc(log.ip || "") +
        "</span>" +
        '<span style="font-size:11px;color:var(--tx-t);white-space:nowrap;min-width:140px;text-align:right">' +
        esc(tm) +
        "</span>" +
        "</div>"
      );
    })
    .join("");
  document.getElementById("auditList").innerHTML = html;
}

async function clearAuditLog() {
  if (!authed) return showLogin();
  const ok = await confirm2(t("clear_events"), t("audit_clear_confirm"));
  if (!ok) return;
  await api("/api/audit/clear", { method: "POST" });
  toast(t("audit_cleared"), "ok");
  loadAuditLog();
}

// ========== 备份与恢复功能 ==========

async function exportBackup() {
  if (!authed) return showLogin();
  const d = await api("/api/backup/export");
  if (!d || d.error) {
    toast(t("backup_failed"), "er");
    return;
  }
  const blob = new Blob([JSON.stringify(d, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.download = "erispulse-backup-" + ts + ".json";
  a.click();
  URL.revokeObjectURL(url);
  toast(t("backup_export_success"), "ok");
}

async function importBackup(input) {
  if (!authed) return showLogin();
  const file = input.files && input.files[0];
  if (!file) return;
  const ok = await confirm2(t("backup_import"), t("backup_import_confirm"));
  if (!ok) {
    input.value = "";
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const result = await api("/api/backup/import", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (result && result.success) {
      toast(
        t("import_success") +
          " (" +
          result.config_restored +
          " config, " +
          result.storage_restored +
          " storage)",
        "ok",
      );
      loadConfig();
    } else {
      toast(t("import_failed") + ": " + (result?.error || ""), "er");
    }
  } catch (e) {
    toast(t("import_failed") + ": " + e.message, "er");
  }
  input.value = "";
}

// ========== 文件管理功能 ==========

let _fmCurrentPath = ".";
let _fmShowHidden = false;
let _fmEditor = null;
let _fmEditPath = "";
let _fmDirty = false;
let _fmContextMenu = null;
let _fmSearchTimer;

function debounceFmSearch() {
  clearTimeout(_fmSearchTimer);
  _fmSearchTimer = setTimeout(() => fmBrowse(_fmCurrentPath), 300);
}

function fmGetMode(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const modes = {
    js: "javascript",
    json: "javascript",
    mjs: "javascript",
    py: "python",
    pyw: "python",
    html: "htmlmixed",
    htm: "htmlmixed",
    css: "css",
    xml: "xml",
    svg: "xml",
    md: "markdown",
    markdown: "markdown",
    toml: "toml",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    txt: "text",
  };
  return modes[ext] || "text";
}

function fmFormatSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

function fmFormatTime(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString(getLocale(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmGetIcon(type, name) {
  if (type === "directory")
    return '<svg class="fm-icon folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
  return '<svg class="fm-icon file" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

function fmUpdateBreadcrumb(path, count) {
  const bc = document.getElementById("fmBreadcrumb");
  const parts = path === "." ? [] : path.split("/");
  let html =
    '<span class="fm-crumb' +
    (parts.length === 0 ? " active" : "") +
    '" onclick="fmNavigateTo(\'.\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:middle"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></span>';
  let accumulated = "";
  parts.forEach((part, i) => {
    accumulated += (accumulated ? "/" : "") + part;
    const p = accumulated;
    html +=
      '<span class="fm-crumb-sep">/</span><span class="fm-crumb' +
      (i === parts.length - 1 ? " active" : "") +
      '" onclick="fmNavigateTo(\'' +
      esc(p) +
      "')\">" +
      esc(part) +
      "</span>";
  });
  if (count !== undefined) {
    html += '<span class="fm-crumb-count">(' + count + ")</span>";
  }
  bc.innerHTML = html;
}

function fmNavigateTo(path) {
  _fmCurrentPath = path;
  fmBrowse(path);
}

function fmGoUp() {
  if (_fmCurrentPath === ".") return;
  const parts = _fmCurrentPath.split("/");
  parts.pop();
  fmNavigateTo(parts.length ? parts.join("/") : ".");
}

function fmToggleHidden() {
  _fmShowHidden = !_fmShowHidden;
  const btn = document.getElementById("fmHiddenBtn");
  btn.style.background = _fmShowHidden ? "var(--accent)" : "";
  fmBrowse(_fmCurrentPath);
}

function fmRefresh() {
  fmBrowse(_fmCurrentPath);
}

async function fmBrowse(path) {
  _fmCurrentPath = path;
  const search = document.getElementById("fmSearch")?.value || "";
  const params = new URLSearchParams({
    path,
    hidden: _fmShowHidden ? "true" : "false",
  });
  if (search) params.set("pattern", "*" + search + "*");
  const d = search
    ? await api("/api/files/search?" + params)
    : await api("/api/files/browse?" + params);
  if (!d) return;
  if (d.error) {
    toast(d.error, "er");
    return;
  }

  const entries = d.entries || d.results || [];
  fmUpdateBreadcrumb(d.path || path, entries.length);

  const fileList = document.getElementById("fmFileList");
  if (entries.length === 0) {
    fileList.innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><p>' +
      t("no_data") +
      "</p></div>";
    return;
  }

  fileList.innerHTML = entries
    .map((e) => {
      const isDir = e.type === "directory";
      const nameClass = isDir ? "fm-name folder-name" : "fm-name";
      const icon = fmGetIcon(e.type, e.name);
      const size = isDir ? "--" : fmFormatSize(e.size || 0);
      const perm = e.permissions || "";
      const mtime = fmFormatTime(e.modified);
      const rowActions = !isDir
        ? '<button class="btn-icon" onclick="event.stopPropagation();fmDownload(\'' +
          esc(e.path) +
          '\')" title="Download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>' +
          '<button class="btn-icon" onclick="event.stopPropagation();fmEditFile(\'' +
          esc(e.path) +
          '\')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
        : "";
      return (
        '<div class="fm-file-row" ondblclick="' +
        (isDir
          ? "fmNavigateTo('" + esc(e.path) + "')"
          : "fmEditFile('" + esc(e.path) + "')") +
        '" oncontextmenu="fmContextMenu(event,\'' +
        esc(e.path) +
        "','" +
        esc(e.type) +
        "')\">" +
        icon +
        '<span class="' +
        nameClass +
        '">' +
        esc(e.name) +
        "</span>" +
        '<span class="fm-size">' +
        size +
        "</span>" +
        '<span class="fm-perm">' +
        esc(perm) +
        "</span>" +
        '<span class="fm-time">' +
        mtime +
        "</span>" +
        '<div class="fm-actions-cell">' +
        rowActions +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function fmContextMenu(event, path, type) {
  event.preventDefault();
  event.stopPropagation();
  if (_fmContextMenu) _fmContextMenu.remove();

  const isDir = type === "directory";
  const menu = document.createElement("div");
  menu.className = "fm-context-menu";
  menu.style.left = event.clientX + "px";
  menu.style.top = event.clientY + "px";

  let items = "";
  if (isDir) {
    items += fmCtxItem(
      t("files"),
      '<polyline points="9 18 15 12 9 6"/>',
      "fmNavigateTo('" + esc(path) + "')",
    );
  } else {
    items += fmCtxItem(
      t("files"),
      '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      "fmEditFile('" + esc(path) + "')",
    );
    items += fmCtxItem(
      t("download"),
      '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      "fmDownload('" + esc(path) + "')",
    );
  }
  items += '<div class="fm-ctx-sep"></div>';
  items += fmCtxItem(
    t("permissions"),
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-2.82 1.18V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001-1.51 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 002.82-1.18V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.2.65.77 1.09 1.51 1.08H21a2 2 0 010 4h-.09c-.74 0-1.31.44-1.51 1.08z"/>',
    "fmChmod('" + esc(path) + "')",
  );
  items += fmCtxItem(
    t("rename_label"),
    '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/>',
    "fmRename('" + esc(path) + "')",
  );
  const fname = path.split("/").pop().toLowerCase();
  if (
    fname.endsWith(".zip") ||
    fname.endsWith(".tar.gz") ||
    fname.endsWith(".tgz") ||
    fname.endsWith(".tar.bz2") ||
    fname.endsWith(".tar.xz") ||
    fname.endsWith(".tar")
  ) {
    items += fmCtxItem(
      t("decompress"),
      '<polyline points="17 1 21 5 17 9"/><path d="M3 7V5a2 2 0 012-2h12"/><line x1="9" y1="12" x2="15" y2="12"/>',
      "fmDecompress('" + esc(path) + "')",
    );
  }
  items += '<div class="fm-ctx-sep"></div>';
  items +=
    '<div class="fm-ctx-item danger" onclick="fmDelete(\'' +
    esc(path) +
    '\');this.closest(\'.fm-context-menu\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg><span>' +
    t("delete") +
    "</span></div>";

  menu.innerHTML = items;
  document.body.appendChild(menu);
  _fmContextMenu = menu;

  const close = () => {
    menu.remove();
    _fmContextMenu = null;
    document.removeEventListener("click", close);
  };
  setTimeout(() => document.addEventListener("click", close), 0);
}

function fmCtxItem(label, svgPath, onclick) {
  return (
    '<div class="fm-ctx-item" onclick="' +
    onclick +
    ';this.closest(\'.fm-context-menu\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    svgPath +
    "</svg><span>" +
    label +
    "</span></div>"
  );
}

async function fmEditFile(path) {
  const d = await api("/api/files/read?path=" + encodeURIComponent(path));
  if (!d) return;
  if (d.error) {
    if (d.binary) toast(t("binary_file"), "er");
    else if (d.error === "File too large")
      toast(t("file_too_large") + " (" + fmFormatSize(d.size) + ")", "er");
    else toast(d.error, "er");
    return;
  }
  _fmEditPath = path;
  _fmDirty = false;
  const panel = document.getElementById("fmEditorPanel");
  panel.style.display = "block";
  document.getElementById("fmEditorTitle").textContent = path;
  document.getElementById("fmEditorStatus").textContent = "";

  const container = document.getElementById("fmEditorContainer");
  if (typeof CodeMirror !== "undefined") {
    if (_fmEditor) _fmEditor.toTextArea();
    const textarea = document.createElement("textarea");
    container.innerHTML = "";
    container.appendChild(textarea);
    textarea.value = d.content;
    _fmEditor = CodeMirror.fromTextArea(textarea, {
      mode: fmGetMode(path),
      theme:
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "dracula"
          : "default",
      lineNumbers: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      lineWrapping: true,
      tabSize: 4,
      indentUnit: 4,
    });
    _fmEditor.on("change", () => {
      _fmDirty = true;
      document.getElementById("fmEditorStatus").textContent = "●";
      document.getElementById("fmEditorStatus").style.color = "var(--wr-c)";
    });
    _fmEditor.setSize("100%", "100%");
    setTimeout(() => _fmEditor.refresh(), 100);
  } else {
    container.innerHTML =
      '<textarea id="fmFallbackEditor" class="code-editor" style="width:100%;height:500px" spellcheck="false">' +
      esc(d.content) +
      "</textarea>";
  }
  panel.scrollIntoView({ behavior: "smooth" });
}

async function fmSaveFile() {
  if (!_fmEditPath) return;
  let content;
  if (_fmEditor) {
    content = _fmEditor.getValue();
  } else {
    const ta = document.getElementById("fmFallbackEditor");
    content = ta ? ta.value : "";
  }
  const d = await api("/api/files/write", {
    method: "PUT",
    body: JSON.stringify({ path: _fmEditPath, content }),
  });
  if (d && d.success) {
    _fmDirty = false;
    document.getElementById("fmEditorStatus").textContent = t("file_saved");
    document.getElementById("fmEditorStatus").style.color = "var(--ok-c)";
    toast(t("file_saved"), "ok");
  } else {
    toast(d?.error || t("file_save_failed"), "er");
  }
}

function fmCloseEditor() {
  document.getElementById("fmEditorPanel").style.display = "none";
  if (_fmEditor) {
    _fmEditor.toTextArea();
    _fmEditor = null;
  }
  _fmEditPath = "";
  _fmDirty = false;
}

function fmDownload(path) {
  const tk = localStorage.getItem(TK);
  const url =
    API +
    "/api/files/download?path=" +
    encodeURIComponent(path) +
    (tk ? "&token=" + encodeURIComponent(tk) : "");
  window.open(url, "_blank");
}

async function fmNewFile() {
  const name = await showModal(
    t("new_file"),
    '<input type="text" id="fmNewName" class="form-input" data-i18n-placeholder="new_file_name" placeholder="' +
      esc(t("new_file_name")) +
      '" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!name) return;
  const input = document.getElementById("fmNewName");
  const fileName = input ? input.value.trim() : "";
  if (!fileName) return;
  const fullPath =
    _fmCurrentPath === "." ? fileName : _fmCurrentPath + "/" + fileName;
  const d = await api("/api/files/write", {
    method: "PUT",
    body: JSON.stringify({ path: fullPath, content: "" }),
  });
  if (d && d.success) {
    toast(t("file_saved"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("file_save_failed"), "er");
  }
}

async function fmNewFolder() {
  const name = await showModal(
    t("new_folder"),
    '<input type="text" id="fmNewName" class="form-input" data-i18n-placeholder="new_folder_name" placeholder="' +
      esc(t("new_folder_name")) +
      '" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!name) return;
  const input = document.getElementById("fmNewName");
  const folderName = input ? input.value.trim() : "";
  if (!folderName) return;
  const fullPath =
    _fmCurrentPath === "." ? folderName : _fmCurrentPath + "/" + folderName;
  const d = await api("/api/files/mkdir", {
    method: "POST",
    body: JSON.stringify({ path: fullPath, recursive: true }),
  });
  if (d && d.success) {
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

function fmUpload() {
  document.getElementById("fmUploadInput").click();
}

async function fmDoUpload(input) {
  const files = input.files;
  if (!files || files.length === 0) return;
  const fd = new FormData();
  for (let i = 0; i < files.length; i++) {
    fd.append("files", files[i]);
  }
  const d = await api(
    "/api/files/upload?path=" + encodeURIComponent(_fmCurrentPath),
    {
      method: "POST",
      body: fd,
    },
  );
  if (d && d.success) {
    toast(t("upload_success") + " (" + d.count + ")", "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("upload_failed"), "er");
  }
  input.value = "";
}

async function fmDelete(path) {
  const ok = await confirm2(t("delete"), t("delete_confirm"));
  if (!ok) return;
  const d = await api("/api/files/delete", {
    method: "POST",
    body: JSON.stringify({ paths: [path] }),
  });
  if (d && d.success) {
    toast(t("delete_success"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("delete_failed"), "er");
  }
}

async function fmRename(path) {
  const oldName = path.split("/").pop();
  const result = await showModal(
    t("rename_label"),
    '<input type="text" id="fmRenameInput" class="form-input" value="' +
      esc(oldName) +
      '" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!result) return;
  const input = document.getElementById("fmRenameInput");
  const newName = input ? input.value.trim() : "";
  if (!newName || newName === oldName) return;
  const dir = path.includes("/")
    ? path.substring(0, path.lastIndexOf("/"))
    : ".";
  const newPath = dir === "." ? newName : dir + "/" + newName;
  const d = await api("/api/files/rename", {
    method: "POST",
    body: JSON.stringify({ old_path: path, new_path: newPath }),
  });
  if (d && d.success) {
    toast(t("rename_success"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("rename_failed"), "er");
  }
}

async function fmChmod(path) {
  const result = await showModal(
    t("chmod"),
    '<input type="text" id="fmChmodInput" class="form-input" placeholder="755" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!result) return;
  const input = document.getElementById("fmChmodInput");
  const mode = input ? input.value.trim() : "";
  if (!mode || !/^[0-7]{3,4}$/.test(mode)) {
    toast("Invalid mode", "er");
    return;
  }
  const d = await api("/api/files/chmod", {
    method: "POST",
    body: JSON.stringify({ path, mode }),
  });
  if (d && d.success) {
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

document.addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.key === "s" && _fmEditPath) {
    e.preventDefault();
    fmSaveFile();
  }
});

async function fmCompress() {
  if (!authed) return showLogin();
  const allRows = document.querySelectorAll("#fmFileList .fm-file-row");
  if (allRows.length === 0) {
    toast(t("no_data"), "");
    return;
  }
  const archiveName = await showModal(
    t("compress"),
    '<input type="text" id="fmCompressName" class="form-input" value="archive.zip" style="width:100%">',
    [
      { label: t("cancel"), value: null },
      { label: t("ok"), value: "ok", primary: true },
    ],
  );
  if (!archiveName) return;
  const name =
    document.getElementById("fmCompressName")?.value?.trim() || "archive.zip";
  const paths = [];
  allRows.forEach((row) => {
    const nameEl = row.querySelector(".fm-name, .folder-name");
    if (nameEl) {
      const n = nameEl.textContent;
      paths.push(_fmCurrentPath === "." ? n : _fmCurrentPath + "/" + n);
    }
  });
  if (paths.length === 0) return;
  const resp = await fetch(API + "/api/files/compress", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + localStorage.getItem(TK),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paths, archive_name: name }),
  });
  if (resp.ok) {
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    const err = await resp.json().catch(() => ({}));
    toast(err.error || t("action_failed"), "er");
  }
}

async function fmDecompress(path) {
  if (!authed) return showLogin();
  const d = await api("/api/files/decompress", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
  if (d && d.success) {
    toast(t("action_completed"), "ok");
    fmBrowse(_fmCurrentPath);
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

// ========== 任务列表系统 ==========

let _tasks = [];
let _taskPanelOpen = false;
let _expandedTasks = new Set();

function addOrUpdateTask(id, name, status, outputLines, errorMsg) {
  let task = _tasks.find((t) => t.id === id);
  if (!task) {
    task = {
      id,
      name,
      status,
      output: [],
      startedAt: Date.now(),
      errorMsg: "",
    };
    _tasks.unshift(task);
  }
  task.status = status;
  task.output = outputLines || task.output;
  if (errorMsg) task.errorMsg = errorMsg;
  renderTaskPanel();
  renderTaskBadge();
}

function removeTask(id) {
  _tasks = _tasks.filter((t) => t.id !== id);
  _expandedTasks.delete(id);
  renderTaskPanel();
  renderTaskBadge();
}

function toggleTaskPanel() {
  _taskPanelOpen = !_taskPanelOpen;
  document.getElementById("taskPanel").classList.toggle("open", _taskPanelOpen);
  renderTaskPanel();
}

function closeTaskPanel() {
  _taskPanelOpen = false;
  document.getElementById("taskPanel").classList.remove("open");
}

// 点击面板外部自动关闭
document.addEventListener("click", function (e) {
  if (!_taskPanelOpen) return;
  var panel = document.getElementById("taskPanel");
  var badge = document.getElementById("taskBadge");
  if (panel && !panel.contains(e.target) && badge && !badge.contains(e.target)) {
    closeTaskPanel();
  }
});

function clearAllTasks() {
  var removedIds = _tasks
    .filter((t) => t.status !== "running")
    .map((t) => t.id);
  removedIds.forEach(function (id) {
    _expandedTasks.delete(id);
  });
  _tasks = _tasks.filter((t) => t.status === "running");
  renderTaskPanel();
  renderTaskBadge();
}

function renderTaskBadge() {
  const badge = document.getElementById("taskBadge");
  const count = _tasks.length;
  const hasRunning = _tasks.some((t) => t.status === "running");
  document.getElementById("taskCount").textContent = count;
  if (count > 0) {
    badge.style.display = "";
    badge.classList.toggle("pulse", hasRunning);
  } else {
    badge.style.display = "none";
    badge.classList.remove("pulse");
    _taskPanelOpen = false;
    document.getElementById("taskPanel").classList.remove("open");
  }
}

function renderTaskPanel() {
  if (!_taskPanelOpen) return;
  var container = document.getElementById("taskList");

  var items = container.querySelectorAll(".task-item.task-expanded");
  _expandedTasks.clear();
  items.forEach(function (item) {
    if (item.dataset.taskId) _expandedTasks.add(item.dataset.taskId);
  });

  if (_tasks.length === 0) {
    container.innerHTML = '<div class="task-empty">' + t("no_data") + "</div>";
    return;
  }
  container.innerHTML = _tasks
    .map((t) => {
      let statusIcon = "";
      let statusClass = "";
      if (t.status === "running") {
        statusIcon =
          '<svg class="task-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>';
        statusClass = "task-running";
      } else if (t.status === "success") {
        statusIcon =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        statusClass = "task-success";
      } else {
        statusIcon =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        statusClass = "task-error";
      }
      var output = (t.output || []).slice(-20).join("\n");
      var detail = t.status === "error" && t.errorMsg ? "\n" + t.errorMsg : "";
      var expanded = _expandedTasks.has(t.id) ? " task-expanded" : "";
      return (
        '<div class="task-item ' +
        statusClass +
        expanded +
        '" data-task-id="' +
        esc(t.id) +
        '" onclick="toggleTaskExpand(this)">' +
        '<div class="task-item-hd">' +
        '<span class="task-icon">' +
        statusIcon +
        "</span>" +
        '<span class="task-name">' +
        esc(t.name) +
        "</span>" +
        '<span class="task-time">' +
        new Date(t.startedAt).toLocaleTimeString(getLocale()) +
        "</span>" +
        '<button class="btn-icon" onclick="event.stopPropagation();removeTask(\'' +
        esc(t.id) +
        '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        "</div>" +
        '<pre class="task-output">' +
        esc(output + detail) +
        "</pre>" +
        "</div>"
      );
    })
    .join("");
}

function toggleTaskExpand(el) {
  el.classList.toggle("task-expanded");
  var taskId = el.dataset.taskId;
  if (!taskId) return;
  if (el.classList.contains("task-expanded")) {
    _expandedTasks.add(taskId);
  } else {
    _expandedTasks.delete(taskId);
  }
}

// 已完成任务不自动清理，由用户手动清除
setInterval(function () {
  // 原自动清理逻辑
  // const now = Date.now();
  // const before = _tasks.length;
  // var removed = _tasks.filter(t => t.status !== 'running' && now - t.startedAt >= 30000);
  // removed.forEach(function(t) { _expandedTasks.delete(t.id) });
  // _tasks = _tasks.filter(t => t.status === 'running' || now - t.startedAt < 30000);
  // if (_tasks.length !== before) renderTaskBadge();
  if (_taskPanelOpen) renderTaskPanel();
}, 5000);

// ========== 包管理功能 ==========

let _pkgCache = null;
let _pkgUpdateCache = null;
let _pkgDebounceTimer;

function debouncePkgs() {
  clearTimeout(_pkgDebounceTimer);
  _pkgDebounceTimer = setTimeout(renderPkgInstalled, 300);
}

function switchPkgTab(tab, btn) {
  btn
    .closest(".view-toggle")
    .querySelectorAll(".view-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("pkInstalledTab").style.display =
    tab === "pk-installed" ? "block" : "none";
  document.getElementById("pkUpdatesTab").style.display =
    tab === "pk-updates" ? "block" : "none";
  document.getElementById("pkInstallNewTab").style.display =
    tab === "pk-install-new" ? "block" : "none";
  document.getElementById("pkGitTab").style.display =
    tab === "pk-git" ? "block" : "none";
  document.getElementById("pkUploadTab").style.display =
    tab === "pk-upload" ? "block" : "none";
  if (tab === "pk-updates") loadPackageUpdates();
}

/**
 * 通用合并页 tab 切换
 * @param {string} tabPrefix - tab section ID 前缀（如 "cfg-editor"）
 * @param {Element} btn - 被点击的 tab 按钮
 * @param {function} [onSwitch] - 切换后回调（用于懒加载）
 */
function switchMergeTab(tabPrefix, btn, onSwitch) {
  // 找到最近的 tab bar
  var bar = btn.closest(".view-toggle");
  if (bar) {
    bar.querySelectorAll(".view-btn").forEach(function (b) {
      b.classList.remove("active");
    });
  }
  btn.classList.add("active");
  // 隐藏同组所有 tab section，显示目标
  var section = document.getElementById(tabPrefix + "-tab");
  if (section) {
    var parent = section.parentElement;
    parent.querySelectorAll(".tab-section").forEach(function (s) {
      s.style.display = "none";
    });
    section.style.display = "block";
  }
  if (onSwitch) onSwitch();
}

// ===== 配置中心 tab =====
function switchConfigTab(tab, btn) {
  var loaders = {
    "cfg-editor": loadConfig,
    "cfg-framework": loadFrameworkConfig,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

// ===== 事件中心 tab =====
function switchEventTab(tab, btn) {
  var loaders = {
    "ev-stream": loadEvents,
    "ev-builder": initEventBuilder,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

// ===== 商店 tab =====
function switchStoreTab(tab, btn) {
  var loaders = {
    "st-browse": loadStore,
    "st-packages": function () {
      loadPackages();
      loadPackageUpdates();
    },
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

// ===== 系统监控 tab =====
function switchMonitorTab(tab, btn) {
  var loaders = {
    "mon-logs": loadLogs,
    "mon-lifecycle": loadLifecycle,
    "mon-audit": loadAuditLog,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

// ===== 模块管理 tab（适配器 / 模块）=====
function switchModuleMgmtTab(tab, btn) {
  switchMergeTab(tab, btn, null);
}

// ===== 适配器配置 tab（适配器配置 / 模块配置）=====
function switchExtConfigTab(tab, btn) {
  var loaders = {
    "cfg-adapter": loadAdapterConfigPage,
    "cfg-module": loadModuleConfigPage,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

async function loadPackages(forceRefresh) {
  const force = forceRefresh === true;
  const params = force ? "?force=true" : "";
  const d = await api("/api/packages" + params);
  if (!d || d.error) return;
  _pkgCache = d.packages || [];
  document.getElementById("pkgInstalledCount").textContent = _pkgCache.length;
  renderPkgInstalled();
}

function renderPkgInstalled() {
  if (!_pkgCache) return;
  const search = (
    document.getElementById("pkgSearch")?.value || ""
  ).toLowerCase();
  const filtered = search
    ? _pkgCache.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          (p.summary || "").toLowerCase().includes(search),
      )
    : _pkgCache;

  if (filtered.length === 0) {
    document.getElementById("pkgInstalledList").innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><p>' +
      t("pkg_no_installed") +
      "</p></div>";
    return;
  }

  const html = filtered
    .map((p) => {
      let typeBadges = "";
      if (p.is_module)
        typeBadges +=
          '<span class="chip chip-pr" style="font-size:10px;padding:1px 6px">' +
          t("pkg_type_module") +
          "</span>";
      if (p.is_adapter)
        typeBadges +=
          '<span class="chip chip-sc" style="font-size:10px;padding:1px 6px">' +
          t("pkg_type_adapter") +
          "</span>";
      if (!p.is_module && !p.is_adapter)
        typeBadges +=
          '<span class="chip" style="font-size:10px;padding:1px 6px;background:var(--bg-s);color:var(--tx-t)">' +
          t("pkg_type_library") +
          "</span>";

      const isProtected =
        p.name.toLowerCase().replace(/[-_]/g, "") === "erispulse" ||
        p.name.toLowerCase().replace(/[-_]/g, "") === "erispulsedashboard";
      let actions = "";
      if (!isProtected) {
        actions +=
          '<button class="btn btn-secondary btn-xs" onclick="upgradePkg(\'' +
          esc(p.name) +
          "')\">" +
          t("pkg_upgrade") +
          "</button> ";
        actions +=
          '<button class="btn btn-danger btn-xs" onclick="uninstallPkg(\'' +
          esc(p.name) +
          "')\">" +
          t("uninstall_module") +
          "</button>";
      }

      return (
        '<div class="pkg-row">' +
        '<div class="pkg-info">' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
        '<span class="pkg-name">' +
        esc(p.name) +
        "</span>" +
        typeBadges +
        "</div>" +
        '<div style="font-size:12px;color:var(--tx-s);margin-top:2px">' +
        esc(p.summary || "") +
        "</div>" +
        "</div>" +
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
        '<span class="pkg-version">v' +
        esc(p.version) +
        "</span>" +
        actions +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  document.getElementById("pkgInstalledList").innerHTML = html;
}

async function loadPackageUpdates(forceRefresh) {
  const countEl = document.getElementById("pkgUpdateCount");
  const countInnerEl = document.getElementById("pkgUpdateCountInner");

  if (!_pkgUpdateCache || forceRefresh) {
    document.getElementById("pkgUpdateList").innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation:spin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg><p>' +
      t("pkg_checking_updates") +
      "</p></div>";
    const force = forceRefresh === true;
    const params = force ? "?force=true" : "";
    const d = await api("/api/packages/updates" + params);
    if (!d || d.error) {
      document.getElementById("pkgUpdateList").innerHTML =
        '<div class="empty-state"><p>' +
        (d?.error || t("action_failed")) +
        "</p></div>";
      return;
    }
    _pkgUpdateCache = d.updates || [];
  }

  const updates = _pkgUpdateCache;
  countEl.textContent = updates.length;
  countEl.style.display = updates.length > 0 ? "inline-flex" : "none";
  countInnerEl.textContent = updates.length;

  if (updates.length === 0) {
    document.getElementById("pkgUpdateList").innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg><p>' +
      t("pkg_no_updates") +
      "</p></div>";
    return;
  }

  const html = updates
    .map((u) => {
      return (
        '<div class="pkg-row pkg-row-update">' +
        '<div class="pkg-info">' +
        '<span class="pkg-name">' +
        esc(u.name) +
        "</span>" +
        "</div>" +
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
        '<span class="pkg-version-old">v' +
        esc(u.current) +
        "</span>" +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--wr-c)"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
        '<span class="pkg-version-new">v' +
        esc(u.latest) +
        "</span>" +
        '<button class="btn btn-primary btn-xs" onclick="upgradePkg(\'' +
        esc(u.name) +
        "')\">" +
        t("pkg_upgrade") +
        "</button>" +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  document.getElementById("pkgUpdateList").innerHTML = html;
}

async function upgradePkg(pkgName) {
  if (!authed) return showLogin();
  const ok = await confirm2(
    t("pkg_upgrade"),
    t("pkg_upgrade_confirm") + " <strong>" + esc(pkgName) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/upgrade", {
    method: "POST",
    body: JSON.stringify({ packages: [pkgName] }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkgName);
    toast(t("pkg_upgrading"), "");
  } else {
    toast(t("pkg_upgrade_failed") + ": " + (d?.error || ""), "er");
  }
}

async function upgradeAllPkgs() {
  if (!authed) return showLogin();
  if (!_pkgUpdateCache || _pkgUpdateCache.length === 0) {
    toast(t("pkg_no_updates"), "");
    return;
  }
  const ok = await confirm2(t("upgrade_all"), t("pkg_upgrade_all_confirm"));
  if (!ok) return;
  const packages = _pkgUpdateCache.map((u) => u.name);
  const d = await api("/api/packages/upgrade", {
    method: "POST",
    body: JSON.stringify({ packages }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, packages.join(", "));
    toast(t("pkg_upgrading"), "");
  } else {
    toast(t("pkg_upgrade_failed") + ": " + (d?.error || ""), "er");
  }
}

async function installNewPkg() {
  if (!authed) return showLogin();
  const input = document.getElementById("pkgInstallInput");
  const val = input.value.trim();
  if (!val) return;
  const packages = val.split(/\s+/).filter((s) => s.length > 0);
  const ok = await confirm2(
    t("install"),
    t("install") + " <strong>" + esc(packages.join(", ")) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/install", {
    method: "POST",
    body: JSON.stringify({ packages }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, packages.join(", "));
    toast(t("installing"), "");
    input.value = "";
  } else {
    toast(t("install_failed") + ": " + (d?.error || ""), "er");
  }
}

async function installNewGitPkg() {
  if (!authed) return showLogin();
  const input = document.getElementById("pkgGitInput");
  const val = input.value.trim();
  if (!val) return;
  if (!val.startsWith("git+")) {
    toast(t("install_failed") + ": URL must start with git+", "er");
    return;
  }
  const ok = await confirm2(
    t("install"),
    t("install") + " <strong>" + esc(val) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/install", {
    method: "POST",
    body: JSON.stringify({ packages: [val] }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, val);
    toast(t("installing"), "");
    input.value = "";
  } else {
    toast(t("install_failed") + ": " + (d?.error || ""), "er");
  }
}

async function loadGitPackages() {
  if (!authed) return;
  const d = await api("/api/packages/git");
  if (!d) return;
  const container = document.getElementById("pkgGitList");
  const pkgs = d.packages || [];
  const updates = d.updates || [];
  const updateMap = {};
  updates.forEach((u) => {
    updateMap[u.git_url] = u;
  });
  if (pkgs.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="padding:32px 20px">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;opacity:0.3;margin-bottom:8px">' +
      '<circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>' +
      "</svg>" +
      '<p style="font-size:13px;color:var(--tx-s);margin:0">' +
      t("pkg_git_no_packages") +
      "</p>" +
      "</div>";
    return;
  }
  const html = pkgs
    .map((p) => {
      const isUpdatable = updateMap[p.git_url];
      const urlEsc = esc(p.git_url);
      const label = isUpdatable
        ? `<span class="chip chip-wr">${t("pkg_git_update_available")}</span>`
        : `<span class="chip chip-ok">${t("latest_version")}</span>`;
      const btn = isUpdatable
        ? `<button class="btn btn-primary btn-xs" onclick="upgradeGitPkg('${urlEsc}')">${t("pkg_git_upgrade")}</button>`
        : "";
      return `
        <div class="kv-row" style="display:flex;align-items:center;gap:12px;padding:12px 18px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;font-family:Consolas,Monaco,monospace;word-break:break-all">${urlEsc}</div>
            <div style="font-size:11px;color:var(--tx-s);margin-top:4px">
              ${label}
            </div>
          </div>
          <div style="flex-shrink:0;display:flex;gap:4px">
            ${btn}
          </div>
        </div>`;
    })
    .join("");
  container.innerHTML = html;
}

async function upgradeGitPkg(gitUrl) {
  if (!authed) return showLogin();
  const ok = await confirm2(
    t("pkg_git_upgrade"),
    t("pkg_upgrade_confirm") + " <strong>" + esc(gitUrl) + "</strong>?",
  );
  if (!ok) return;
  const d = await api("/api/packages/git-upgrade", {
    method: "POST",
    body: JSON.stringify({ git_url: gitUrl }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, gitUrl);
    toast(t("pkg_upgrading"), "");
  } else {
    toast(t("pkg_upgrade_failed") + ": " + (d?.error || ""), "er");
  }
}

async function uninstallPkg(pkgName) {
  if (!authed) return showLogin();
  const ok = await confirm2(
    t("uninstall_module"),
    t("pkg_uninstall_confirm") + " <strong>" + esc(pkgName) + "</strong>",
  );
  if (!ok) return;
  const d = await api("/api/packages/uninstall", {
    method: "POST",
    body: JSON.stringify({ package: pkgName }),
  });
  if (d && d.success && d.task_id) {
    _installTaskIds.set(d.task_id, pkgName);
    toast(t("module_uninstalling"), "");
  } else if (d && d.error === "Cannot uninstall core package") {
    toast(t("pkg_cannot_uninstall"), "er");
  } else {
    toast(d?.error || t("action_failed"), "er");
  }
}

let _cmdData = null,
  _editCmdName = "",
  _editAliases = [],
  _editAllowed = [],
  _editBlocked = [],
  _cmdPlatforms = [];

async function loadCommands() {
  const d = await api("/api/commands");
  if (!d) return;
  _cmdData = d;
  _cmdPlatforms = d.platforms || [];
  const gs = d.global_settings || {};
  var prefixes = gs.prefixes || [gs.prefix || "/"];
  var prefixHtml = prefixes
    .map(function (p) {
      return (
        '<code style="background:var(--bg-s);padding:2px 6px;border-radius:3px;font-size:12px">' +
        esc(p) +
        "</code>"
      );
    })
    .join(" ");
  document.getElementById("cmdPrefix").innerHTML = prefixHtml;
  document.getElementById("cmdCaseSensitive").textContent = gs.case_sensitive
    ? t("cmd_yes")
    : t("cmd_no");
  document.getElementById("cmdAllowSpace").textContent = gs.allow_space_prefix
    ? t("cmd_yes")
    : t("cmd_no");
  document.getElementById("cmdMustAtBot").textContent = gs.must_at_bot
    ? t("cmd_yes")
    : t("cmd_no");
  document.getElementById("cmdCount").textContent = d.total || 0;
  const cmds = d.commands || [];
  if (!cmds.length) {
    document.getElementById("cmdListBody").innerHTML =
      '<div style="padding:32px 18px;text-align:center;color:var(--tx-t);font-size:13px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:.3;margin-bottom:8px"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg><div>' +
      t("cmd_no_commands") +
      "</div></div>";
    return;
  }
  let html = "";
  for (const c of cmds) {
    const enabled = c.enabled !== false;
    const dotClass = enabled ? "enabled" : "disabled";
    const statusText = enabled ? t("cmd_enabled") : t("cmd_disabled");
    let aliasesHtml = "";
    for (const a of c.original_aliases || []) {
      aliasesHtml +=
        '<span class="cmd-alias-chip original">' + esc(a) + "</span>";
    }
    for (const a of c.custom_aliases || []) {
      aliasesHtml +=
        '<span class="cmd-alias-chip custom">' + esc(a) + "</span>";
    }
    let metaParts = [];
    if (!aliasesHtml) aliasesHtml = "";
    if (aliasesHtml)
      metaParts.push(
        "<span>" + t("cmd_aliases_label") + ": " + aliasesHtml + "</span>",
      );
    if (c.help) metaParts.push("<span>" + esc(c.help) + "</span>");
    if (c.group)
      metaParts.push(
        "<span>" + t("cmd_group") + ": " + esc(c.group) + "</span>",
      );
    if (c.usage)
      metaParts.push(
        '<span style="font-family:Consolas,Monaco,monospace;font-size:11px">' +
          esc(c.usage) +
          "</span>",
      );
    let platformBadges = "";
    for (const p of c.allowed_platforms || []) {
      platformBadges +=
        '<span class="cmd-platform-chip allowed">' + esc(p) + "</span>";
    }
    for (const p of c.blocked_platforms || []) {
      platformBadges +=
        '<span class="cmd-platform-chip blocked">' + esc(p) + "</span>";
    }
    let transformBadge = "";
    if (c.transform_to) {
      transformBadge =
        '<span class="cmd-transform">&rarr; ' + esc(c.transform_to) + "</span>";
    }
    let badges = platformBadges + transformBadge;
    html +=
      '<div class="cmd-row">' +
      '<span class="cmd-status-dot ' +
      dotClass +
      '"></span>' +
      '<div class="cmd-info">' +
      '<div class="cmd-name-row">' +
      '<span class="cmd-name">' +
      esc(c.name) +
      "</span>" +
      (badges ? '<span class="cmd-badges">' + badges + "</span>" : "") +
      "</div>" +
      '<div class="cmd-meta">' +
      (metaParts.length
        ? metaParts.join("")
        : '<span style="color:var(--tx-t)">' +
          t("module_no_desc") +
          "</span>") +
      "</div>" +
      "</div>" +
      '<div class="cmd-actions">' +
      '<button class="btn btn-secondary btn-xs" onclick="openCmdEdit(\'' +
      esc(c.name).replace(/'/g, "\\'") +
      "')\">" +
      t("config") +
      "</button>" +
      "</div>" +
      "</div>";
  }
  document.getElementById("cmdListBody").innerHTML = html;
}

function openCmdEdit(name) {
  if (!_cmdData) return;
  const cmd = (_cmdData.commands || []).find((c) => c.name === name);
  if (!cmd) return;
  _editCmdName = name;
  _editAliases = [...(cmd.custom_aliases || [])];
  _editAllowed = [...(cmd.allowed_platforms || [])];
  _editBlocked = [...(cmd.blocked_platforms || [])];
  document.getElementById("cmdEditTitle").textContent = "/" + name;
  document.getElementById("cmdEnabled").checked = cmd.enabled !== false;
  document.getElementById("cmdTransformTo").value = cmd.transform_to || "";
  let origHtml = "";
  if ((cmd.original_aliases || []).length) {
    origHtml =
      '<span style="color:var(--tx-t);font-size:12px">' +
      t("cmd_original_aliases_label") +
      ": " +
      cmd.original_aliases.map((a) => esc(a)).join(", ") +
      "</span>";
  }
  if (cmd.help)
    origHtml +=
      '<span style="margin-left:12px;color:var(--tx-s);font-size:12px">' +
      t("cmd_help") +
      ": " +
      esc(cmd.help) +
      "</span>";
  if (cmd.group)
    origHtml +=
      '<span style="margin-left:12px;color:var(--tx-s);font-size:12px">' +
      t("cmd_group") +
      ": " +
      esc(cmd.group) +
      "</span>";
  document.getElementById("cmdOriginalAliases").innerHTML = origHtml;
  renderCmdAliasTags();
  renderCmdPlatformToggles();
  document.getElementById("cmdAliasInput").value = "";
  document.getElementById("cmdEditOverlay").style.display = "flex";
}

function renderCmdAliasTags() {
  const container = document.getElementById("cmdAliasTags");
  if (!_editAliases.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = _editAliases
    .map(
      (a, i) =>
        '<span class="cmd-tag">' +
        esc(a) +
        '<span class="cmd-tag-remove" onclick="removeCmdAlias(' +
        i +
        ')">&times;</span></span>',
    )
    .join("");
}

function addCmdAlias() {
  const input = document.getElementById("cmdAliasInput");
  const val = input.value.trim();
  if (!val || _editAliases.includes(val)) {
    input.value = "";
    return;
  }
  _editAliases.push(val);
  input.value = "";
  renderCmdAliasTags();
}

function removeCmdAlias(index) {
  _editAliases.splice(index, 1);
  renderCmdAliasTags();
}

function renderCmdPlatformToggles() {
  const allowedContainer = document.getElementById("cmdAllowedPlatforms");
  const blockedContainer = document.getElementById("cmdBlockedPlatforms");
  if (!_cmdPlatforms.length) {
    allowedContainer.innerHTML =
      '<span style="font-size:12px;color:var(--tx-t)">' +
      t("no_adapters") +
      "</span>";
    blockedContainer.innerHTML =
      '<span style="font-size:12px;color:var(--tx-t)">' +
      t("no_adapters") +
      "</span>";
    return;
  }
  allowedContainer.innerHTML = _cmdPlatforms
    .map((p) => {
      const active = _editAllowed.includes(p);
      return (
        '<span class="cmd-platform-toggle' +
        (active ? " active" : "") +
        "\" onclick=\"toggleCmdPlatform('allowed','" +
        esc(p) +
        "')\">" +
        esc(p) +
        "</span>"
      );
    })
    .join("");
  blockedContainer.innerHTML = _cmdPlatforms
    .map((p) => {
      const active = _editBlocked.includes(p);
      return (
        '<span class="cmd-platform-toggle' +
        (active ? " blocked" : "") +
        "\" onclick=\"toggleCmdPlatform('blocked','" +
        esc(p) +
        "')\">" +
        esc(p) +
        "</span>"
      );
    })
    .join("");
}

function toggleCmdPlatform(type, platform) {
  if (type === "allowed") {
    const idx = _editAllowed.indexOf(platform);
    if (idx >= 0) _editAllowed.splice(idx, 1);
    else _editAllowed.push(platform);
  } else {
    const idx = _editBlocked.indexOf(platform);
    if (idx >= 0) _editBlocked.splice(idx, 1);
    else _editBlocked.push(platform);
  }
  renderCmdPlatformToggles();
}

function closeCmdEdit() {
  document.getElementById("cmdEditOverlay").style.display = "none";
}

async function saveCmdEdit() {
  const body = {
    enabled: document.getElementById("cmdEnabled").checked,
    aliases: _editAliases,
    allowed_platforms: _editAllowed,
    blocked_platforms: _editBlocked,
    transform_to:
      document.getElementById("cmdTransformTo").value.trim() || null,
  };
  const d = await api("/api/commands/" + encodeURIComponent(_editCmdName), {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    toast(t("cmd_save_success"), "ok");
    closeCmdEdit();
    loadCommands();
  } else {
    toast(d?.error || t("cmd_save_failed"), "er");
  }
}

(function () {
  applyTheme(getTheme());
  applyUiStyle(getUiStyle());
  applyI18n();
  applyCustomTheme();
  updateNodeSelectorUI();
  const collapsedSetting = localStorage.getItem("ep_sidebar_collapsed");
  // 默认收起侧边栏（首次使用或无设置时）
  const isCollapsed =
    collapsedSetting === null ? true : collapsedSetting === "true";
  if (isCollapsed && window.innerWidth > 768)
    document.getElementById("sidebar").classList.add("collapsed");
  updateNodeSelectorVisibility();
  restoreNavGroupStates();
  // 启动画面在首次显示登录或仪表盘时消失
  var splashEl = document.getElementById("splash");
  var _splashReady = false;
  var _splashDismissed = false;
  setTimeout(function () { _splashReady = true; if (_splashDismissed) dismissSplash(); }, 1750);
  function dismissSplash() {
    _splashDismissed = true;
    if (!_splashReady || !splashEl) return;
    splashEl.classList.add("hide");
    setTimeout(function () { if (splashEl) splashEl.remove(); }, 600);
  }
  const tk = localStorage.getItem(TK);
  if (tk) {
    fetch(API + "/api/auth/status", {
      headers: { Authorization: "Bearer " + tk },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.authenticated) {
          authed = true;
          document.querySelector(".app").classList.add("authed");
          dismissSplash();
          // 先加载仪表盘主体，外观延迟加载（不阻塞访问）
          loadAll();
          wsConnect();
          restartRefreshTimer();
          loadClusterNodes();
          loadGlobalAppearance();
        } else {
          localStorage.removeItem(TK);
          dismissSplash();
          showLogin();
        }
      })
      .catch(() => {
        dismissSplash();
        showLogin();
      });
  } else {
    dismissSplash();
    showLogin();
  }
  initMirrorSelects();
  const dz = document.getElementById("uploadDropZone");
  if (dz) {
    dz.addEventListener("dragover", function (e) {
      e.preventDefault();
      this.classList.add("drag-over");
    });
    dz.addEventListener("dragleave", function (e) {
      this.classList.remove("drag-over");
    });
    dz.addEventListener("drop", function (e) {
      e.preventDefault();
      this.classList.remove("drag-over");
      if (e.dataTransfer.files[0]) processUploadFile(e.dataTransfer.files[0]);
    });
  }
})();

// ========== 集群管理 ==========

var _PAGE_CAPABILITY_MAP = {
  bots: "bots",
  "event-stream": "events",
  "event-builder": "event_builder",
  commands: "commands",
  "module-mgmt": "modules",
  adapter: "config",
  "module-config": "config",
  store: "store",
  packages: "packages",
  logs: "logs",
  lifecycle: "lifecycle",
  audit: "audit",
  "api-routes": "routes",
  config: "config",
  "framework-config": "config_source",
  "adapter-config": "config",
  files: "files",
};

function isCapabilitySupported(capId) {
  if (currentNode === "local") return true;
  var caps = nodeCapabilities[currentNode];
  if (!caps) return true;
  if (!caps[capId]) return true;
  return caps[capId].supported !== false;
}

function switchNode(nodeId) {
  if (nodeId === currentNode) return;
  currentNode = nodeId;
  allEvents = [];
  updateNodeSelectorUI();
  updateSidebarForNode();
  _clearModuleViews();
  wsConnect();
  loadModuleViews();
  var activePage = document.querySelector(".page.active");
  if (activePage) {
    var pageId = activePage.id.replace("p-", "");
    go(pageId, document.querySelector('.nav-item[data-page="' + pageId + '"]'));
  }
}

function updateSidebarForNode() {
  document.querySelectorAll(".nav-item[data-page]").forEach(function (el) {
    var page = el.getAttribute("data-page");
    var cap = _PAGE_CAPABILITY_MAP[page];
    if (!isCapabilitySupported(cap)) {
      el.classList.add("nav-disabled");
      el.title = t("unsupported_on_node");
    } else {
      el.classList.remove("nav-disabled");
      el.title = "";
    }
  });
  document
    .querySelectorAll(".nav-item[data-module-view]")
    .forEach(function (el) {
      if (!isCapabilitySupported("module_views")) {
        el.classList.add("nav-disabled");
      } else {
        el.classList.remove("nav-disabled");
      }
    });
}

function _clearModuleViews() {
  document
    .querySelectorAll(".nav-item[data-module-view]")
    .forEach(function (el) {
      el.remove();
    });
  document.querySelectorAll(".page[data-module-view]").forEach(function (el) {
    el.remove();
  });
  document.querySelectorAll(".module-view-style").forEach(function (el) {
    el.remove();
  });
  document.querySelectorAll(".module-view-script").forEach(function (el) {
    el.remove();
  });
  document
    .querySelectorAll(".nav-group.module-view-group")
    .forEach(function (el) {
      el.remove();
    });
  _moduleViewLoaders = {};
  _moduleViewsLoaded = false;
}

function toggleNodeDropdown() {
  var dd = document.getElementById("nodeDropdown");
  dd.classList.toggle("open");
}

function closeNodeDropdown() {
  document.getElementById("nodeDropdown").classList.remove("open");
}

document.addEventListener("click", function (e) {
  var sel = document.getElementById("nodeSelector");
  if (sel && !sel.contains(e.target)) closeNodeDropdown();
});

function updateNodeSelectorUI() {
  var label = document.getElementById("nodeSelectorLabel");
  var dot = document.getElementById("nodeDot");
  if (currentNode === "local") {
    label.textContent = t("node_local");
    dot.className = "node-dot node-dot-local";
  } else {
    var info = nodeRuntimeInfo[currentNode] || {};
    label.textContent = info.name || currentNode;
    dot.className =
      "node-dot " + (info.online ? "node-dot-online" : "node-dot-offline");
  }
}

async function loadClusterNodes() {
  var d = await api("/api/cluster/nodes");
  if (!d) return;
  if (d.nodes) {
    d.nodes.forEach(function (n) {
      nodeRuntimeInfo[n.id] = n;
      if (n.capabilities) {
        nodeCapabilities[n.id] = n.capabilities;
      }
    });
  }
  renderNodeDropdown(d.nodes || []);
  updateNodeSelectorVisibility();
}

function renderNodeDropdown(nodes) {
  var list = document.getElementById("nodeDropdownList");
  if (!list) return;
  var html = "";
  html +=
    '<div class="node-dropdown-item' +
    (currentNode === "local" ? " active" : "") +
    '" onclick="switchNode(\'local\'); closeNodeDropdown();">';
  html += '<span class="node-dot node-dot-local"></span>';
  html += "<span>" + esc(t("node_local")) + "</span>";
  html += "</div>";
  nodes.forEach(function (n) {
    var info = nodeRuntimeInfo[n.id] || {};
    var dotClass = info.online ? "node-dot-online" : "node-dot-offline";
    html +=
      '<div class="node-dropdown-item' +
      (currentNode === n.id ? " active" : "") +
      '" onclick="switchNode(\'' +
      esc(n.id) +
      "'); closeNodeDropdown();\">";
    html += '<span class="node-dot ' + dotClass + '"></span>';
    html +=
      '<span class="node-dropdown-label">' + esc(n.name || n.id) + "</span>";
    if (info.latency_ms >= 0) {
      html += '<span class="node-latency">' + info.latency_ms + "ms</span>";
    }
    html += "</div>";
  });
  list.innerHTML = html;
}

var _capKeys = [
  "status",
  "system",
  "adapters",
  "modules",
  "bots",
  "events",
  "config",
  "storage",
  "store",
  "packages",
  "logs",
  "lifecycle",
  "audit",
  "files",
  "commands",
  "event_builder",
  "config_source",
  "module_views",
  "performance",
  "routes",
  "message_stats",
  "framework_update",
];

function _clusterNodeCardHtml(n) {
  var info = nodeRuntimeInfo[n.id] || {};
  var online = info.online;
  var dotClass = online ? "node-dot-online" : "node-dot-offline";
  var caps = info.capabilities || {};
  var capKeys = _capKeys;
  var supportedCaps = [];
  var unsupportedCaps = [];
  capKeys.forEach(function (k) {
    var c = caps[k];
    if (c && c.supported) supportedCaps.push(k);
    else if (c && c.supported === false) unsupportedCaps.push(k);
  });

  var capsHtml = "";
  if (supportedCaps.length > 0 || unsupportedCaps.length > 0) {
    capsHtml += '<div class="cluster-card-caps">';
    supportedCaps.forEach(function (k) {
      capsHtml +=
        '<span class="cluster-cap-tag cap-supported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    });
    unsupportedCaps.forEach(function (k) {
      capsHtml +=
        '<span class="cluster-cap-tag cap-unsupported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    });
    capsHtml += "</div>";
  }

  var meta = "";
  if (info.latency_ms >= 0)
    meta += "<span>" + esc(t("latency")) + ": " + info.latency_ms + "ms</span>";
  if (info.dashboard_version)
    meta += "<span>v" + esc(info.dashboard_version) + "</span>";

  var cardId = "clusterCard-" + esc(n.id);
  var h = '<div class="cluster-node-card" id="' + cardId + '">';
  h += '<div class="cluster-card-header">';
  h +=
    '<div class="cluster-card-title"><span class="node-dot ' +
    dotClass +
    '"></span><span class="cluster-card-name">' +
    esc(n.name || n.id) +
    "</span>";
  h += online
    ? '<span class="cluster-badge badge-online">' +
      esc(t("node_online")) +
      "</span>"
    : '<span class="cluster-badge badge-offline">' +
      esc(t("node_offline")) +
      "</span>";
  h += "</div>";
  h += '<div class="cluster-node-actions">';
  h +=
    '<button class="btn-icon-sm" onclick="openClusterEditModal(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_edit")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
  h +=
    '<button class="btn-icon-sm" onclick="pingClusterNode(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_ping")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>';
  h +=
    '<button class="btn-icon-sm" onclick="probeClusterNode(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_probe")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></button>';
  h +=
    '<button class="btn-icon-sm btn-icon-danger" onclick="removeClusterNode(\'' +
    esc(n.id) +
    '\')" title="' +
    esc(t("node_delete")) +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>';
  h += "</div></div>";
  var maskedUrl = _maskUrl(n.url);
  h += '<div class="cluster-node-url-wrap">';
  h +=
    '<span class="cluster-node-url" id="' +
    cardId +
    '-url" data-full-url="' +
    esc(n.url) +
    '" data-masked-url="' +
    esc(maskedUrl) +
    '">' +
    esc(maskedUrl) +
    "</span>";
  h +=
    '<button class="btn-icon-sm cluster-url-eye" id="' +
    cardId +
    '-eye" onclick="_toggleUrlVisibility(\'' +
    cardId +
    '\')" title="' +
    esc(t("toggle_url_visibility") || "Show/Hide") +
    '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></button>';
  h += "</div>";
  if (meta) h += '<div class="cluster-node-meta">' + meta + "</div>";

  h +=
    '<button class="cluster-card-toggle" onclick="toggleClusterCardDetail(\'' +
    cardId +
    "')\">";
  h +=
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toggle-arrow"><polyline points="6 9 12 15 18 9"/></svg>';
  h += "<span>" + esc(t("cluster_card_detail") || "Details") + "</span>";
  if (supportedCaps.length > 0)
    h +=
      '<span class="cluster-cap-count">' +
      supportedCaps.length +
      "/" +
      capKeys.length +
      "</span>";
  h += "</button>";
  h += '<div class="cluster-card-detail" id="' + cardId + '-detail">';
  h +=
    '<div class="cluster-card-stats-loading"><div class="cluster-spinner"></div></div>';
  h += "</div>";

  h += "</div>";
  return h;
}

function _maskUrl(url) {
  if (!url) return "";
  try {
    var u = new URL(url);
    var host = u.host;
    if (host.length <= 6)
      return u.protocol + "//" + "*".repeat(host.length) + u.pathname;
    var visible = host.substring(0, 3);
    var masked = "*".repeat(Math.min(host.length - 6, 12));
    var end = host.substring(host.length - 3);
    return u.protocol + "//" + visible + masked + end + u.pathname;
  } catch (e) {
    return url.substring(0, 4) + "***";
  }
}

function _toggleUrlVisibility(cardId) {
  var el = document.getElementById(cardId + "-url");
  var btn = document.getElementById(cardId + "-eye");
  if (!el || !btn) return;
  var full = el.getAttribute("data-full-url");
  var masked = el.getAttribute("data-masked-url");
  if (el.textContent === masked) {
    el.textContent = full;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  } else {
    el.textContent = masked;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  }
}

function toggleClusterCardDetail(cardId) {
  var card = document.getElementById(cardId);
  if (!card) return;
  var wasExpanded = card.classList.contains("card-expanded");
  card.classList.toggle("card-expanded");
  if (!wasExpanded) {
    var nodeId = cardId.replace("clusterCard-", "");
    var od =
      _lastOverview && _lastOverview.nodes && _lastOverview.nodes[nodeId];
    if (od) _fillClusterCardDetail(nodeId, od);
  }
}

function _buildStatsHtml(overviewData) {
  if (!overviewData || overviewData._error) return "";
  var mem = overviewData.memory || {};
  var status = overviewData.status || {};
  var system = overviewData.system || {};
  var proc = system.process || {};
  var stats = [];
  if (mem.cpu_percent !== undefined)
    stats.push({
      l: "CPU",
      v:
        (typeof mem.cpu_percent === "number"
          ? mem.cpu_percent.toFixed(1)
          : "-") + "%",
      c: _colorForUsage(mem.cpu_percent, 50, 80),
    });
  if (mem.system_percent !== undefined)
    stats.push({
      l: "RAM",
      v: mem.system_percent.toFixed(1) + "%",
      c: _colorForUsage(mem.system_percent, 60, 85),
    });
  if (mem.rss_mb !== undefined)
    stats.push({ l: t("process_memory"), v: mem.rss_mb + "MB" });
  var aCount;
  if (status.adapters_count !== undefined) aCount = status.adapters_count;
  else if (
    status.adapters &&
    typeof status.adapters === "object" &&
    !status.adapters.error
  )
    aCount = Object.keys(status.adapters).length;
  if (aCount !== undefined)
    stats.push({ l: t("adapters") || "Adapters", v: aCount });
  var mCount;
  if (status.modules_count !== undefined) mCount = status.modules_count;
  else if (
    status.modules &&
    typeof status.modules === "object" &&
    !status.modules.error
  )
    mCount = Object.values(status.modules).filter(function (v) {
      return v;
    }).length;
  if (mCount !== undefined)
    stats.push({ l: t("registered") || "Modules", v: mCount });
  var eCount;
  if (status.events_count !== undefined) eCount = status.events_count;
  else if (system.total_events !== undefined) eCount = system.total_events;
  if (eCount !== undefined)
    stats.push({ l: t("events") || "Events", v: eCount });
  if (system.uptime_human)
    stats.push({
      l: t("lifecycle") || "Uptime",
      v: system.uptime_human,
      c: "var(--tx-s)",
    });
  if (proc.threads !== undefined)
    stats.push({ l: t("threads"), v: proc.threads });
  if (proc.connections !== undefined)
    stats.push({ l: t("connections"), v: proc.connections });
  if (stats.length === 0) return "";
  var h = '<div class="cluster-card-stats">';
  stats.forEach(function (s) {
    h +=
      '<div class="cluster-card-stat"><span class="cluster-stat-val"' +
      (s.c ? ' style="color:' + s.c + '"' : "") +
      ">" +
      esc(s.v) +
      '</span><span class="cluster-stat-label">' +
      esc(s.l) +
      "</span></div>";
  });
  h += "</div>";
  return h;
}

function _fillClusterCardDetail(nodeId, overviewData) {
  var el = document.getElementById("clusterCard-" + nodeId + "-detail");
  if (!el) return;
  var info = nodeRuntimeInfo[nodeId] || {};
  var caps = info.capabilities || {};
  var capKeys = _capKeys;
  var statsHtml = _buildStatsHtml(overviewData);
  var capsHtml = "";
  var supportedCaps = 0;
  capKeys.forEach(function (k) {
    var c = caps[k];
    if (c && c.supported) {
      supportedCaps++;
      capsHtml +=
        '<span class="cluster-cap-tag cap-supported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    } else if (c && c.supported === false) {
      capsHtml +=
        '<span class="cluster-cap-tag cap-unsupported" title="' +
        esc(t("cap_" + k + "_desc")) +
        '">' +
        esc(t("cap_" + k)) +
        "</span>";
    }
  });
  var h = "";
  if (capsHtml) h += '<div class="cluster-card-caps">' + capsHtml + "</div>";
  h = statsHtml + h;
  el.innerHTML =
    h || '<div style="font-size:12px;color:var(--tx-t);padding:4px 0">-</div>';
  var countEl = el.parentElement.querySelector(".cluster-cap-count");
  if (countEl && capKeys.length > 0)
    countEl.textContent = supportedCaps + "/" + capKeys.length;
}

async function loadClusterPage() {
  var container = document.getElementById("clusterContent");
  if (!container) return;

  await loadClusterNodes();
  var d = await api("/api/cluster/nodes");
  var nodes = d && d.nodes ? d.nodes : [];

  var html = "";
  html += '<div class="cluster-toolbar">';
  html +=
    '<div class="cluster-toolbar-info">' +
    nodes.length +
    " " +
    esc(
      t("cluster_node_count") ||
        (t("node_local") === "本地实例" ? "个节点" : "node(s)"),
    ) +
    "</div>";
  html +=
    '<button class="btn btn-primary btn-sm" onclick="openClusterAddModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
    esc(t("node_add")) +
    "</button>";
  html += "</div>";

  if (nodes.length === 0) {
    html +=
      '<div class="cluster-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg><div>' +
      esc(t("no_data") || "No nodes added yet") +
      "</div></div>";
  } else {
    html += '<div class="cluster-node-list">';
    nodes.forEach(function (n) {
      html += _clusterNodeCardHtml(n);
    });
    html += "</div>";
  }

  container.innerHTML = html;

  if (nodes.length > 0) {
    api("/api/cluster/overview").then(function (od) {
      if (!od || !od.nodes) return;
      _lastOverview = od;
      nodes.forEach(function (n) {
        if (od.nodes[n.id]) _fillClusterCardDetail(n.id, od.nodes[n.id]);
      });
    });
  }
}

function openClusterAddModal() {
  if (!authed) return showLogin();
  ["addNodeName", "addNodeUrl", "addNodeToken"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  applyI18n();
  document.getElementById("clusterAddOv").classList.add("show");
  var urlInput = document.getElementById("addNodeUrl");
  if (urlInput)
    setTimeout(function () {
      urlInput.focus();
    }, 100);
}

function closeClusterAddModal() {
  document.getElementById("clusterAddOv").classList.remove("show");
}

function openClusterEditModal(nodeId) {
  if (!authed) return showLogin();
  var d = nodeRuntimeInfo[nodeId] || {};
  document.getElementById("editNodeId").value = nodeId;
  document.getElementById("editNodeName").value = d.name || "";
  document.getElementById("editNodeUrl").value = d.url || "";
  document.getElementById("editNodeToken").value = "";
  document.getElementById("editNodeToken").placeholder =
    t("node_token_placeholder") + " (" + t("leave_empty_to_keep") + ")";
  applyI18n();
  document.getElementById("clusterEditOv").classList.add("show");
}

function closeClusterEditModal() {
  document.getElementById("clusterEditOv").classList.remove("show");
}

async function submitClusterNode() {
  var name = document.getElementById("addNodeName").value.trim();
  var url = document.getElementById("addNodeUrl").value.trim();
  var token = document.getElementById("addNodeToken").value.trim();
  if (!url || !token) {
    toast(t("node_add_failed") + ": URL, Token required", "er");
    return;
  }
  var d = await api("/api/cluster/nodes", {
    method: "POST",
    body: JSON.stringify({ name: name, url: url, token: token }),
  });
  if (d && d.success) {
    if (d.node) nodeRuntimeInfo[d.node.id] = d.node;
    closeClusterAddModal();
    toast(t("node_add_success"), "ok");
    loadClusterPage();
    loadClusterNodes();
  } else {
    toast(t("node_add_failed") + (d && d.error ? ": " + d.error : ""), "er");
  }
}

async function submitEditNode() {
  var nodeId = document.getElementById("editNodeId").value.trim();
  var name = document.getElementById("editNodeName").value.trim();
  var url = document.getElementById("editNodeUrl").value.trim();
  var token = document.getElementById("editNodeToken").value.trim();
  if (!nodeId) return;
  var body = { name: name, url: url };
  if (token) body.token = token;
  var d = await api("/api/cluster/nodes/" + encodeURIComponent(nodeId), {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (d && d.success) {
    if (d.node) nodeRuntimeInfo[d.node.id] = d.node;
    if (currentNode === nodeId) wsConnect();
    closeClusterEditModal();
    toast(t("node_edit") + " OK", "ok");
    loadClusterPage();
  } else {
    toast(
      t("node_edit") +
        " " +
        (t("failed") || "failed") +
        (d && d.error ? ": " + d.error : ""),
      "er",
    );
  }
}

async function removeClusterNode(nodeId) {
  if (!confirm(t("node_remove_confirm"))) return;
  var d = await api("/api/cluster/nodes/" + encodeURIComponent(nodeId), {
    method: "DELETE",
  });
  if (d && d.success) {
    toast(t("node_delete") + " OK", "ok");
    if (currentNode === nodeId) switchNode("local");
    loadClusterPage();
  } else {
    toast(t("node_not_found"), "er");
  }
}

async function pingClusterNode(nodeId) {
  var btn = document.querySelector(
    "#clusterCard-" +
      nodeId +
      " .cluster-node-actions .btn-icon-sm:nth-child(2)",
  );
  if (btn) btn.classList.add("spin");
  var d = await api(
    "/api/cluster/nodes/" + encodeURIComponent(nodeId) + "/ping",
    { method: "POST" },
  );
  if (btn) btn.classList.remove("spin");
  if (d && d.online) {
    toast(t("node_ping_success") + " (" + d.latency_ms + "ms)", "ok");
  } else {
    toast(t("node_ping_failed"), "er");
  }
  await loadClusterNodes();
  loadClusterPage();
}

async function probeClusterNode(nodeId) {
  toast(t("node_probing"), "wr");
  var d = await api(
    "/api/cluster/nodes/" + encodeURIComponent(nodeId) + "/probe",
    { method: "POST" },
  );
  if (d && d.capabilities) {
    nodeCapabilities[nodeId] = d.capabilities;
    toast(t("node_probe_complete"), "ok");
    loadClusterPage();
  } else {
    toast(t("node_probe_complete"), "er");
  }
}

function _colorForUsage(val, warn, danger) {
  if (val > (danger || 85)) return "var(--er-c)";
  if (val > (warn || 60)) return "var(--wr-c)";
  return "var(--ok-c)";
}
