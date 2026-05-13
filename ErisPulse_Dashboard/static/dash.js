const API = '/Dashboard', TK = '__ep_tk__';
let ws = null, allEvents = [], platforms = [], authed = false, _adapterLogos = {};

const I18N = {
    zh: {
        dashboard: '仪表盘', bots: '机器人', events: '事件系统', modules: '插件管理', store: '模块商店', config: '配置管理',
        sys_logs: '系统日志', logs: '日志', lifecycle: '生命周期', events_stream: '事件流', events_builder: '构建器',
        sys_logs_desc: '查看系统日志与生命周期', logs_desc: '查看和过滤系统日志', lifecycle_desc: '查看系统启动和运行过程',
        lifecycle_timeline: '生命周期时间轴', all_modules: '所有模块', search_logs: '搜索日志...', no_lifecycle: '暂无生命周期事件',
        log_list: '日志列表', api_routes: 'API 路由', api_routes_desc: '查看所有注册的 HTTP 和 WebSocket 路由',
        http_routes: 'HTTP 路由', ws_routes: 'WebSocket 路由',
        loading: '加载中...', online: '在线', offline: '离线', live: '实时',
        adapters: '适配器', modules_label: '模块', online_bots: '在线机器人', total_events: '事件总数',
        no_adapters: '暂无适配器', no_modules: '暂无模块', no_events: '暂无事件', no_bots: '暂无机器人',
        no_logs: '暂无日志', no_http_routes: '暂无 HTTP 路由', no_ws_routes: '暂无 WebSocket 路由',
        no_data: '暂无数据', requires_auth: '需认证',
        active: '活跃', inactive: '未活跃',
        enable: '启用', load: '加载', unload: '停止加载', install: '安装',
        search_packages: '搜索包...', live_events: '实时事件', waiting_events: '等待事件...',
        bots_desc: '各平台已发现的机器人', events_desc: '事件流查看/构建',
        modules_desc: '管理已注册的模块和适配器', store_desc: '浏览并安装包',
        config_desc: '查看和管理配置与存储', configuration: '配置', storage: '存储',
        auth_title: '身份验证', auth_desc_text: '请输入访问令牌以继续', auth_label: '访问令牌',
        auth_placeholder: '请输入令牌',
        auth_hint: '令牌存储在配置中的 <code>Dashboard.token</code>',
        login: '登录', cancel: '取消', ok: '确定',
        logged_in: '登录成功', invalid_token: '无效令牌', action_completed: '操作完成', action_failed: '操作失败',
        installing: '安装中...', installed: '安装成功，建议重启框架', install_failed: '安装失败',
        install_success: '安装完成', install_timeout: '安装超时', install_restart_title: '重启加载新模块', install_restart_confirm: '模块安装成功，是否立即重启框架以加载新模块？', install_restart_btn: '重启',
        install_detail: '安装详情', no_token_refresh: '服务未就绪，请稍后刷新',
        unload_self_title: '警告', unload_self_confirm: '停止加载仪表盘模块后，你将无法再通过网页访问此界面。确定要继续吗？',
        upload_title: '上传安装', upload_desc: '上传 whl 或 zip 包直接安装模块', upload_btn: '选择文件并安装', uploading: '上传安装中...', upload_failed: '上传安装失败',
        restart: '重启框架', restart_confirm: '确定要重启框架吗？这将重新加载所有模块和适配器。',
        restart_success: '框架重启中...', restart_failed: '重启失败',
        clear_events: '清除事件', clear_confirm: '确定要清除所有事件日志吗？',
        all_types: '所有类型', all_platforms: '所有平台',
        no_packages: '没有匹配的包', failed_registry: '加载注册表失败',
        event_cleared: '事件已清除', empty_storage: '存储为空',
        message: '消息', notice: '通知', request: '请求', meta: '元事件', platform: '平台',
        event_builder: '事件构建器', event_builder_desc: '构建自定义事件用于调试和测试',
        event_type: '事件类型', detail_type: '详情类型', platform_info: '平台信息',
        select_platform: '选择平台', select_bot: '选择 Bot', custom: '自定义',
        select_detail_type: '请选择详情类型...', select_platform_placeholder: '请先选择平台...',
        session_type: '会话类型', session_id: '会话 ID',
        session_private: '私聊', session_group: '群聊', session_channel: '频道',
        custom_platform_placeholder: '输入自定义平台名称', custom_bot_placeholder: '输入自定义 Bot ID',
        session_id_placeholder: '群号/频道号/用户 ID',
        message_content: '消息内容', optional_fields: '附加字段', json_preview: 'JSON 预览',
        preview: '预览', submit_event: '提交事件',
        add_segment: '添加消息段', add_field: '添加字段', copy_json: '复制 JSON',
        validate_error: '验证错误', submit_success: '事件已提交', submit_failed: '提交失败',
        view_tree: '树形', view_source: '源码', reload_config: '重新加载', save_config: '保存配置',
        config_saved: '配置已保存', config_load_failed: '加载配置源码失败',
        read_only: '只读 (根配置)',
        cpu_usage: 'CPU 使用率', process_cpu: '进程 CPU', memory_usage: '内存使用', rss_memory: 'RSS 内存',
        system_memory: '系统内存', system_total_memory: '系统总内存', available_memory: '可用内存',
        swap_memory: '交换内存', io_read: 'IO 读取', io_write: 'IO 写入',
        active_connections: '活跃连接', system_details: '系统详情',
        websocket: 'WebSocket', message_stats: '消息统计', message_types: '消息类型',
        platform_distribution: '平台分布', last_24h_trend: '最近24小时趋势',
        registered_routes: '已注册路由',
        refresh: '刷新', copy: '复制', auto_refresh: '自动刷新', copy_all_logs: '复制所有日志',
        event_preview: '事件预览', copied_to_clipboard: '已复制到剪贴板', copy_failed: '复制失败',
        save_failed: '保存失败', unknown_error: '未知错误', validation_failed: '验证失败',
        auto_refresh_off: '自动刷新已关闭', auto_refresh_on: '自动刷新已开启',
        alt_message: '备用消息', request_comment: '请求附言',
        field_name_placeholder: '字段名', field_value_placeholder: '字段值',
        load_segments_first: '请先加载消息段类型',
        test: '测试', send: '发送', query_params: 'Query 参数', request_body: '请求体', response: '响应',
        force_refresh: '强制刷新',
        audit_log: '审计日志', audit_log_desc: '查看系统操作记录', all_actions: '所有操作',
        backup_restore: '备份与恢复', backup_desc: '导出或导入系统配置和存储数据',
        backup_export: '导出备份', backup_import: '导入恢复',
        backup_export_success: '备份已导出', backup_import_confirm: '导入将覆盖当前配置和存储数据（Dashboard 配置除外）。确定要继续吗？',
        import_success: '恢复成功', import_failed: '恢复失败', backup_failed: '备份失败',
        audit_clear_confirm: '确定要清空审计日志吗？', audit_cleared: '审计日志已清空',
        last_run: '上次执行', never: '从未', run_count: '执行次数',
        action_load_module: '加载模块', action_unload_module: '卸载模块',
        action_load_adapter: '加载适配器', action_unload_adapter: '卸载适配器',
        action_config_update: '修改配置', action_config_source_save: '保存配置源码',
        action_storage_set: '设置存储', action_storage_delete: '删除存储',
        action_package_install: '安装包', action_clear_events: '清除事件',
        action_restart_framework: '重启框架', action_backup_import: '导入备份',
        files: '文件管理', files_desc: '浏览和管理项目文件',
        search_files: '搜索文件...', new_file: '新建文件', new_folder: '新建文件夹',
        upload: '上传', save: '保存', upload_success: '上传成功', upload_failed: '上传失败',
        upload_drop: '拖拽文件到此处或点击上传',
        file_saved: '文件已保存', file_save_failed: '保存失败',
        file_too_large: '文件过大，无法编辑', binary_file: '二进制文件，无法编辑',
        file_not_found: '文件未找到', folder_exists: '文件夹已存在',
        delete_confirm: '确定要删除选中的文件吗？此操作不可撤销。',
        delete_success: '删除成功', delete_failed: '删除失败',
        rename_label: '新名称', rename_success: '重命名成功', rename_failed: '重命名失败',
        new_file_name: '文件名', new_folder_name: '文件夹名',
        enable_module: '启用', disable_module: '禁用', reload_module: '重载',
        uninstall_module: '卸载', uninstall_confirm: '确定要卸载此模块吗？这将删除模块包。',
        module_uninstalling: '卸载中...', module_version: '版本',
        module_author: '作者', module_no_desc: '无描述',
        module_enabled_not_loaded: '已启用未加载',
        module_disabled: '已禁用', reload: '重载',
        action_enable_module: '启用模块', action_disable_module: '禁用模块',
        action_reload_module: '重载模块', action_uninstall_module: '卸载模块',
        search_modules: '搜索模块...',
        module_loaded_dynamic: '模块已动态加载',
        installed_no_restart: '安装完成，模块已自动加载',
        permissions: '权限', download: '下载', chmod: '修改权限',
        chmod_prompt: '输入权限值（如 755、644）',
        pkg_manager: '包管理', pkg_manager_desc: '管理已安装的 Python 包，检查更新并安装新包',
        pkg_installed: '已安装', pkg_updates: '可更新', pkg_install_new: '安装新包',
        pkg_updates_available: '可用的更新', pkg_upgrade_all: '全部更新',
        pkg_install_placeholder: '包名（如 requests 或 numpy==1.24.0）',
        pkg_install_hint: '支持输入包名、带版本号（package==version）或多个包用空格分隔',
        pkg_name: '包名', pkg_version: '版本', pkg_type: '类型', pkg_latest: '最新版本',
        pkg_type_module: '模块', pkg_type_adapter: '适配器', pkg_type_library: '库',
        pkg_no_installed: '未找到已安装的包', pkg_no_updates: '所有包均为最新版本',
        pkg_checking_updates: '正在检查更新...', pkg_upgrading: '更新中...',
        pkg_upgrade: '更新', pkg_upgrade_confirm: '确定要更新以下包吗？',
        pkg_upgrade_all_confirm: '确定要更新所有可更新的包吗？这可能需要一些时间。',
        pkg_uninstall_confirm: '确定要卸载此包吗？这可能导致依赖问题。',
        pkg_cannot_uninstall: '核心包不可卸载',
        pkg_install_success: '包安装完成', pkg_upgrade_success: '包更新完成',
        pkg_install_failed: '包安装失败', pkg_upgrade_failed: '包更新失败',
        store_version_current: '当前', store_version_latest: '最新',
        store_update_available: '有更新',
        action_package_upgrade: '更新包', action_package_uninstall: '卸载包',
        upgrade_all: '全部更新',
        module_hub: '模块中心', module_hub_desc: '管理模块、浏览商店、管理 Python 包',
        registered: '已注册', registered_desc: '管理已注册的模块和适配器',
        compress: '压缩', decompress: '解压', upload_folder: '上传文件夹',
        task_list: '任务列表',
        cmd_management: '命令管理', cmd_management_desc: '管理已注册的命令：别名、平台过滤、启用状态',
        cmd_global_settings: '全局命令设置', cmd_prefix: '命令前缀', cmd_case_sensitive: '大小写敏感',
        cmd_allow_space_prefix: '允许空前缀', cmd_must_at_bot: '必须@Bot',
        cmd_list: '命令列表', cmd_enabled: '已启用', cmd_disabled: '已禁用',
        cmd_custom_aliases: '自定义别名', cmd_alias_placeholder: '输入别名后回车添加',
        cmd_allowed_platforms: '允许的平台', cmd_allowed_platforms_hint: '留空表示允许所有平台',
        cmd_blocked_platforms: '禁止的平台', cmd_transform_to: '命令转换',
        cmd_transform_placeholder: '留空表示不转换，输入目标命令名将此命令重定向',
        cmd_original_aliases_label: '原始别名', cmd_no_commands: '暂无已注册的命令',
        cmd_help: '帮助', cmd_usage: '用法', cmd_group: '命令组',
        cmd_save_success: '命令规则已保存', cmd_save_failed: '保存失败',
        cmd_yes: '是', cmd_no: '否',
        cmd_aliases_label: '别名',
        group_overview: '概览', group_events: '事件', group_extensions: '扩展', group_system: '系统', group_tools: '工具',
        event_stream: '事件流', event_stream_desc: '实时查看系统事件流',
        event_builder_desc: '构建自定义事件用于调试和测试',
        lifecycle_desc: '查看系统启动和运行过程',
        settings_title: '仪表盘设置',
        settings_appearance: '外观', settings_behavior: '行为',
        settings_theme: '深色主题',         settings_language: '语言',
        settings_ui_style: '界面风格',
        settings_sidebar: '折叠侧边栏', settings_refresh_interval: '刷新间隔',
        settings_event_limit: '事件流数量', settings_disabled: '关闭',
        settings_restart_desc: '重新加载所有模块和适配器',
        settings_logout: '退出登录', settings_logout_desc: '清除令牌并返回登录页',
        upload_modal_title: '上传安装', upload_drop_hint: '拖拽文件到此处或点击选择',
        force_install: '强制安装', force_install_desc: '忽略版本号强制重新安装 (--force-reinstall)',
        start_install: '开始安装', pip_mirror: 'pip 镜像源',
        install_version: '安装版本', latest_version: '最新版本',
        batch_install: '批量安装', batch_install_count: '已选择 {n} 个包',
        dependencies: '依赖项', version_history: '版本历史',
        no_dependencies: '无外部依赖', pkg_detail_loading: '加载详情中...',
        pkg_detail_failed: '加载详情失败', view_detail: '详情',
        upload_complete: '上传完成', upload_file_too_large: '文件过大',
        install_with_options: '安装选项',
        status_icons_conn: '连接状态',
        status_conn_disconnected: '未连接', status_conn_connected: '已连接', status_conn_error: '连接异常',
        expand_all: '展开全部', collapse_all: '收起全部',
    },
    en: {
        dashboard: 'Dashboard', bots: 'Bots', events: 'Events', modules: 'Plugins', store: 'Module Store', config: 'Configuration',
        sys_logs: 'System Logs', logs: 'Logs', lifecycle: 'Lifecycle', events_stream: 'Stream', events_builder: 'Builder',
        sys_logs_desc: 'View system logs and lifecycle events', logs_desc: 'View and filter system logs', lifecycle_desc: 'View system startup and runtime process',
        lifecycle_timeline: 'Lifecycle Timeline', all_modules: 'All Modules', search_logs: 'Search logs...', no_lifecycle: 'No lifecycle events',
        log_list: 'Log List', api_routes: 'API Routes', api_routes_desc: 'View all registered HTTP and WebSocket routes',
        http_routes: 'HTTP Routes', ws_routes: 'WebSocket Routes',
        loading: 'Loading...', online: 'Online', offline: 'Offline', live: 'Live',
        adapters: 'Adapters', modules_label: 'Modules', online_bots: 'Online Bots', total_events: 'Total Events',
        no_adapters: 'No adapters', no_modules: 'No modules', no_events: 'No events', no_bots: 'No bots',
        no_logs: 'No logs', no_http_routes: 'No HTTP routes', no_ws_routes: 'No WebSocket routes',
        no_data: 'No data', requires_auth: 'Auth Required',
        active: 'Active', inactive: 'Inactive',
        enable: 'Enable', load: 'Load', unload: 'Unload', install: 'Install',
        search_packages: 'Search packages...', live_events: 'Live Events', waiting_events: 'Waiting for events...',
        bots_desc: 'Discovered bots across platforms', events_desc: 'Event stream view/builder',
        modules_desc: 'Manage registered modules and adapters', store_desc: 'Browse and install packages',
        config_desc: 'View and manage configuration and storage', configuration: 'Configuration', storage: 'Storage',
        auth_title: 'Authentication', auth_desc_text: 'Please enter your access token to continue', auth_label: 'Access Token',
        auth_placeholder: 'Enter your token',
        auth_hint: 'Token is stored in config at <code>Dashboard.token</code>',
        login: 'Login', cancel: 'Cancel', ok: 'OK',
        logged_in: 'Logged in successfully', invalid_token: 'Invalid token', action_completed: 'Action completed', action_failed: 'Action failed',
        installing: 'Installing...', installed: 'Installed! Restart recommended', install_failed: 'Install failed',
        install_success: 'Install complete', install_timeout: 'Install timed out', install_restart_title: 'Restart to load new module', install_restart_confirm: 'Module installed successfully. Restart framework now to load it?', install_restart_btn: 'Restart',
        install_detail: 'Install Details', no_token_refresh: 'Service not ready, please refresh later',
        unload_self_title: 'Warning', unload_self_confirm: 'After unloading the dashboard module, you will not be able to access this interface via web. Continue?',
        upload_title: 'Upload Install', upload_desc: 'Upload a whl or zip package to install module', upload_btn: 'Select File & Install', uploading: 'Uploading & Installing...', upload_failed: 'Upload install failed',
        restart: 'Restart', restart_confirm: 'Restart the framework? This will reload all modules and adapters.',
        restart_success: 'Restarting framework...', restart_failed: 'Restart failed',
        clear_events: 'Clear Events', clear_confirm: 'Clear all event logs?',
        all_types: 'All Types', all_platforms: 'All Platforms',
        no_packages: 'No matching packages', failed_registry: 'Failed to load registry',
        event_cleared: 'Events cleared', empty_storage: 'Storage is empty',
        message: 'Message', notice: 'Notice', request: 'Request', meta: 'Meta', platform: 'Platform',
        event_builder: 'Event Builder', event_builder_desc: 'Build custom events for debugging and testing',
        event_type: 'Event Type', detail_type: 'Detail Type', platform_info: 'Platform Info',
        select_platform: 'Select Platform', select_bot: 'Select Bot', custom: 'Custom',
        select_detail_type: 'Select detail type...', select_platform_placeholder: 'Select a platform first...',
        session_type: 'Session Type', session_id: 'Session ID',
        session_private: 'Private', session_group: 'Group', session_channel: 'Channel',
        custom_platform_placeholder: 'Enter custom platform name', custom_bot_placeholder: 'Enter custom Bot ID',
        session_id_placeholder: 'Group/Channel/User ID',
        message_content: 'Message Content', optional_fields: 'Optional Fields', json_preview: 'JSON Preview',
        preview: 'Preview', submit_event: 'Submit Event',
        add_segment: 'Add Segment', add_field: 'Add Field', copy_json: 'Copy JSON',
        validate_error: 'Validation error', submit_success: 'Event submitted', submit_failed: 'Submit failed',
        view_tree: 'Tree', view_source: 'Source', reload_config: 'Reload', save_config: 'Save',
        config_saved: 'Configuration saved', config_load_failed: 'Failed to load config source',
        read_only: 'Read-only (root config)',
        cpu_usage: 'CPU Usage', process_cpu: 'Process CPU', memory_usage: 'Memory Usage', rss_memory: 'RSS Memory',
        system_memory: 'System Memory', system_total_memory: 'System Total Memory', available_memory: 'Available Memory',
        swap_memory: 'Swap Memory', io_read: 'I/O Read', io_write: 'I/O Write',
        active_connections: 'Active Connections', system_details: 'System Details',
        websocket: 'WebSocket', message_stats: 'Message Statistics', message_types: 'Message Types',
        platform_distribution: 'Platform Distribution', last_24h_trend: 'Last 24 Hours',
        registered_routes: 'Registered Routes',
        refresh: 'Refresh', copy: 'Copy', auto_refresh: 'Auto Refresh', copy_all_logs: 'Copy All Logs',
        event_preview: 'Event Preview', copied_to_clipboard: 'Copied to clipboard', copy_failed: 'Copy failed',
        save_failed: 'Save failed', unknown_error: 'Unknown error', validation_failed: 'Validation failed',
        auto_refresh_off: 'Auto refresh disabled', auto_refresh_on: 'Auto refresh enabled',
        alt_message: 'Alt Message', request_comment: 'Request Comment',
        field_name_placeholder: 'Field Name', field_value_placeholder: 'Field Value',
        load_segments_first: 'Please load segment types first',
        test: 'Test', send: 'Send', query_params: 'Query Params', request_body: 'Request Body', response: 'Response',
        force_refresh: 'Force Refresh',
        audit_log: 'Audit Log', audit_log_desc: 'View system operation records', all_actions: 'All Actions',
        backup_restore: 'Backup & Restore', backup_desc: 'Export or import system configuration and storage data',
        backup_export: 'Export Backup', backup_import: 'Import Restore',
        backup_export_success: 'Backup exported', backup_import_confirm: 'Import will overwrite current config and storage (except Dashboard config). Continue?',
        import_success: 'Restore successful', import_failed: 'Restore failed', backup_failed: 'Backup failed',
        audit_clear_confirm: 'Clear all audit logs?', audit_cleared: 'Audit logs cleared',
        last_run: 'Last Run', never: 'Never', run_count: 'Run Count',
        action_load_module: 'Load Module', action_unload_module: 'Unload Module',
        action_load_adapter: 'Load Adapter', action_unload_adapter: 'Unload Adapter',
        action_config_update: 'Update Config', action_config_source_save: 'Save Config Source',
        action_storage_set: 'Set Storage', action_storage_delete: 'Delete Storage',
        action_package_install: 'Install Package', action_clear_events: 'Clear Events',
        action_restart_framework: 'Restart Framework', action_backup_import: 'Import Backup',
        files: 'Files', files_desc: 'Browse and manage project files',
        search_files: 'Search files...', new_file: 'New File', new_folder: 'New Folder',
        upload: 'Upload', save: 'Save', upload_success: 'Upload successful', upload_failed: 'Upload failed',
        upload_drop: 'Drop files here or click to upload',
        file_saved: 'File saved', file_save_failed: 'Save failed',
        file_too_large: 'File too large to edit', binary_file: 'Binary file, cannot edit',
        file_not_found: 'File not found', folder_exists: 'Folder already exists',
        delete_confirm: 'Delete selected files? This cannot be undone.',
        delete_success: 'Deleted', delete_failed: 'Delete failed',
        rename_label: 'New name', rename_success: 'Renamed', rename_failed: 'Rename failed',
        new_file_name: 'File name', new_folder_name: 'Folder name',
        enable_module: 'Enable', disable_module: 'Disable', reload_module: 'Reload',
        uninstall_module: 'Uninstall', uninstall_confirm: 'Uninstall this module? This will remove the package.',
        module_uninstalling: 'Uninstalling...', module_version: 'Version',
        module_author: 'Author', module_no_desc: 'No description',
        module_enabled_not_loaded: 'Enabled',
        module_disabled: 'Disabled', reload: 'Reload',
        action_enable_module: 'Enable Module', action_disable_module: 'Disable Module',
        action_reload_module: 'Reload Module', action_uninstall_module: 'Uninstall Module',
        search_modules: 'Search modules...',
        module_loaded_dynamic: 'Module loaded dynamically',
        installed_no_restart: 'Installed, module auto-loaded',
        permissions: 'Permissions', download: 'Download', chmod: 'Change Permissions',
        chmod_prompt: 'Enter permission (e.g. 755, 644)',
        pkg_manager: 'Packages', pkg_manager_desc: 'Manage installed Python packages, check updates and install new ones',
        pkg_installed: 'Installed', pkg_updates: 'Updates', pkg_install_new: 'Install New',
        pkg_updates_available: 'Updates Available', pkg_upgrade_all: 'Upgrade All',
        pkg_install_placeholder: 'Package name (e.g. requests or numpy==1.24.0)',
        pkg_install_hint: 'Supports package name, with version (package==version), or multiple packages separated by spaces',
        pkg_name: 'Package', pkg_version: 'Version', pkg_type: 'Type', pkg_latest: 'Latest',
        pkg_type_module: 'Module', pkg_type_adapter: 'Adapter', pkg_type_library: 'Library',
        pkg_no_installed: 'No installed packages found', pkg_no_updates: 'All packages are up to date',
        pkg_checking_updates: 'Checking for updates...', pkg_upgrading: 'Upgrading...',
        pkg_upgrade: 'Upgrade', pkg_upgrade_confirm: 'Are you sure you want to upgrade the following packages?',
        pkg_upgrade_all_confirm: 'Are you sure you want to upgrade all outdated packages? This may take a while.',
        pkg_uninstall_confirm: 'Are you sure you want to uninstall this package? This may cause dependency issues.',
        pkg_cannot_uninstall: 'Cannot uninstall core package',
        pkg_install_success: 'Package installed', pkg_upgrade_success: 'Package upgraded',
        pkg_install_failed: 'Package install failed', pkg_upgrade_failed: 'Package upgrade failed',
        store_version_current: 'Current', store_version_latest: 'Latest',
        store_update_available: 'Update available',
        action_package_upgrade: 'Upgrade Package', action_package_uninstall: 'Uninstall Package',
        upgrade_all: 'Upgrade All',
        module_hub: 'Module Hub', module_hub_desc: 'Manage modules, browse store, manage Python packages',
        registered: 'Registered', registered_desc: 'Manage registered modules and adapters',
        compress: 'Compress', decompress: 'Decompress', upload_folder: 'Upload Folder',
        task_list: 'Task List',
        cmd_management: 'Commands', cmd_management_desc: 'Manage registered commands: aliases, platform filters, enable/disable',
        cmd_global_settings: 'Global Command Settings', cmd_prefix: 'Command Prefix', cmd_case_sensitive: 'Case Sensitive',
        cmd_allow_space_prefix: 'Allow Space Prefix', cmd_must_at_bot: 'Must @Bot',
        cmd_list: 'Command List', cmd_enabled: 'Enabled', cmd_disabled: 'Disabled',
        cmd_custom_aliases: 'Custom Aliases', cmd_alias_placeholder: 'Enter alias and press Enter',
        cmd_allowed_platforms: 'Allowed Platforms', cmd_allowed_platforms_hint: 'Leave empty to allow all platforms',
        cmd_blocked_platforms: 'Blocked Platforms', cmd_transform_to: 'Command Transform',
        cmd_transform_placeholder: 'Leave empty for no transform, enter target command name to redirect',
        cmd_original_aliases_label: 'Original Aliases', cmd_no_commands: 'No registered commands',
        cmd_help: 'Help', cmd_usage: 'Usage', cmd_group: 'Group',
        cmd_save_success: 'Command rule saved', cmd_save_failed: 'Save failed',
        cmd_yes: 'Yes', cmd_no: 'No',
        cmd_aliases_label: 'Aliases',
        group_overview: 'Overview', group_events: 'Events', group_extensions: 'Extensions', group_system: 'System', group_tools: 'Tools',
        event_stream: 'Event Stream', event_stream_desc: 'View real-time event stream',
        event_builder_desc: 'Build custom events for debugging and testing',
        lifecycle_desc: 'View system startup and runtime process',
        settings_title: 'Dashboard Settings',
        settings_appearance: 'Appearance', settings_behavior: 'Behavior',
        settings_theme: 'Dark Theme',         settings_language: 'Language',
        settings_ui_style: 'UI Style',
        settings_sidebar: 'Collapse Sidebar', settings_refresh_interval: 'Refresh Interval',
        settings_event_limit: 'Event Limit', settings_disabled: 'Disabled',
        settings_restart_desc: 'Reload all modules and adapters',
        settings_logout: 'Sign Out', settings_logout_desc: 'Clear token and return to login',
        upload_modal_title: 'Upload & Install', upload_drop_hint: 'Drop file here or click to select',
        force_install: 'Force Install', force_install_desc: 'Force reinstall regardless of version (--force-reinstall)',
        start_install: 'Start Install', pip_mirror: 'pip Mirror',
        install_version: 'Install Version', latest_version: 'Latest',
        batch_install: 'Batch Install', batch_install_count: '{n} packages selected',
        dependencies: 'Dependencies', version_history: 'Version History',
        no_dependencies: 'No external dependencies', pkg_detail_loading: 'Loading details...',
        pkg_detail_failed: 'Failed to load details', view_detail: 'Details',
        upload_complete: 'Upload Complete', upload_file_too_large: 'File too large',
        install_with_options: 'Install Options',
        status_icons_conn: 'Connection',
        status_conn_disconnected: 'Disconnected', status_conn_connected: 'Connected', status_conn_error: 'Connection Error',
        expand_all: 'Expand All', collapse_all: 'Collapse All',
    },
    'zh-TW': {
        dashboard: '儀表盤', bots: '機器人', events: '事件系統', modules: '插件管理', store: '模組商店', config: '配置管理',
        sys_logs: '系統日誌', logs: '日誌', lifecycle: '生命週期', events_stream: '事件流', events_builder: '構建器',
        sys_logs_desc: '查看系統日誌與生命週期', logs_desc: '查看和過濾系統日誌', lifecycle_desc: '查看系統啟動和運行過程',
        lifecycle_timeline: '生命週期時間軸', all_modules: '所有模組', search_logs: '搜尋日誌...', no_lifecycle: '暫無生命週期事件',
        log_list: '日誌列表', api_routes: 'API 路由', api_routes_desc: '查看所有已註冊的 HTTP 和 WebSocket 路由',
        http_routes: 'HTTP 路由', ws_routes: 'WebSocket 路由',
        loading: '載入中...', online: '線上', offline: '離線', live: '即時',
        adapters: '適配器', modules_label: '模組', online_bots: '線上機器人', total_events: '事件總數',
        no_adapters: '暫無適配器', no_modules: '暫無模組', no_events: '暫無事件', no_bots: '暫無機器人',
        no_logs: '暫無日誌', no_http_routes: '暫無 HTTP 路由', no_ws_routes: '暫無 WebSocket 路由',
        no_data: '暫無資料', requires_auth: '需認證',
        active: '活躍', inactive: '未活躍',
        enable: '啟用', load: '載入', unload: '停止載入', install: '安裝',
        search_packages: '搜尋套件...', live_events: '即時事件', waiting_events: '等待事件...',
        bots_desc: '各平台已發現的機器人', events_desc: '事件流查看/構建',
        modules_desc: '管理已註冊的模組和適配器', store_desc: '瀏覽並安裝套件',
        config_desc: '查看和管理配置與儲存', configuration: '配置', storage: '儲存',
        auth_title: '身份驗證', auth_desc_text: '請輸入訪問令牌以繼續', auth_label: '訪問令牌',
        auth_placeholder: '請輸入令牌',
        auth_hint: '令牌儲存在配置中的 <code>Dashboard.token</code>',
        login: '登入', cancel: '取消', ok: '確定',
        logged_in: '登入成功', invalid_token: '無效令牌', action_completed: '操作完成', action_failed: '操作失敗',
        installing: '安裝中...', installed: '安裝成功，建議重啟框架', install_failed: '安裝失敗',
        install_success: '安裝完成', install_timeout: '安裝超時', install_restart_title: '重啟載入新模組', install_restart_confirm: '模組安裝成功，是否立即重啟框架以載入新模組？', install_restart_btn: '重啟',
        install_detail: '安裝詳情', no_token_refresh: '服務未就緒，請稍後重新整理',
        unload_self_title: '警告', unload_self_confirm: '停止載入儀表盤模組後，你將無法再透過網頁訪問此介面。確定要繼續嗎？',
        upload_title: '上傳安裝', upload_desc: '上傳 whl 或 zip 包直接安裝模組', upload_btn: '選擇檔案並安裝', uploading: '上傳安裝中...', upload_failed: '上傳安裝失敗',
        restart: '重啟框架', restart_confirm: '確定要重啟框架嗎？這將重新載入所有模組和適配器。',
        restart_success: '框架重啟中...', restart_failed: '重啟失敗',
        clear_events: '清除事件', clear_confirm: '確定要清除所有事件日誌嗎？',
        all_types: '所有類型', all_platforms: '所有平台',
        no_packages: '沒有符合的套件', failed_registry: '載入註冊表失敗',
        event_cleared: '事件已清除', empty_storage: '儲存為空',
        message: '訊息', notice: '通知', request: '請求', meta: '元事件', platform: '平台',
        event_builder: '事件構建器', event_builder_desc: '構建自定義事件用於除錯和測試',
        event_type: '事件類型', detail_type: '詳情類型', platform_info: '平台資訊',
        select_platform: '選擇平台', select_bot: '選擇 Bot', custom: '自定義',
        select_detail_type: '請選擇詳情類型...', select_platform_placeholder: '請先選擇平台...',
        session_type: '會話類型', session_id: '會話 ID',
        session_private: '私聊', session_group: '群聊', session_channel: '頻道',
        custom_platform_placeholder: '輸入自定義平台名稱', custom_bot_placeholder: '輸入自定義 Bot ID',
        session_id_placeholder: '群號/頻道號/使用者 ID',
        message_content: '訊息內容', optional_fields: '附加欄位', json_preview: 'JSON 預覽',
        preview: '預覽', submit_event: '提交事件',
        add_segment: '添加訊息段', add_field: '添加欄位', copy_json: '複製 JSON',
        validate_error: '驗證錯誤', submit_success: '事件已提交', submit_failed: '提交失敗',
        view_tree: '樹形', view_source: '原始碼', reload_config: '重新載入', save_config: '儲存配置',
        config_saved: '配置已儲存', config_load_failed: '載入配置原始碼失敗',
        read_only: '唯讀 (根配置)',
        cpu_usage: 'CPU 使用率', process_cpu: '處理程序 CPU', memory_usage: '記憶體使用', rss_memory: 'RSS 記憶體',
        system_memory: '系統記憶體', system_total_memory: '系統總記憶體', available_memory: '可用記憶體',
        swap_memory: '交換記憶體', io_read: 'IO 讀取', io_write: 'IO 寫入',
        active_connections: '活躍連線', system_details: '系統詳情',
        websocket: 'WebSocket', message_stats: '訊息統計', message_types: '訊息類型',
        platform_distribution: '平台分佈', last_24h_trend: '最近24小時趨勢',
        registered_routes: '已註冊路由',
        refresh: '重新整理', copy: '複製', auto_refresh: '自動重新整理', copy_all_logs: '複製所有日誌',
        event_preview: '事件預覽', copied_to_clipboard: '已複製到剪貼簿', copy_failed: '複製失敗',
        save_failed: '儲存失敗', unknown_error: '未知錯誤', validation_failed: '驗證失敗',
        auto_refresh_off: '自動重新整理已關閉', auto_refresh_on: '自動重新整理已開啟',
        alt_message: '備用訊息', request_comment: '請求附言',
        field_name_placeholder: '欄位名', field_value_placeholder: '欄位值',
        load_segments_first: '請先載入訊息段類型',
        test: '測試', send: '傳送', query_params: 'Query 參數', request_body: '請求體', response: '回應',
        force_refresh: '強制重新整理',
        audit_log: '審計日誌', audit_log_desc: '查看系統操作記錄', all_actions: '所有操作',
        backup_restore: '備份與還原', backup_desc: '匯出或匯入系統配置和儲存資料',
        backup_export: '匯出備份', backup_import: '匯入還原',
        backup_export_success: '備份已匯出', backup_import_confirm: '匯入將覆蓋當前配置和儲存資料（Dashboard 配置除外）。確定要繼續嗎？',
        import_success: '還原成功', import_failed: '還原失敗', backup_failed: '備份失敗',
        audit_clear_confirm: '確定要清空審計日誌嗎？', audit_cleared: '審計日誌已清空',
        last_run: '上次執行', never: '從未', run_count: '執行次數',
        action_load_module: '載入模組', action_unload_module: '卸載模組',
        action_load_adapter: '載入適配器', action_unload_adapter: '卸載適配器',
        action_config_update: '修改配置', action_config_source_save: '儲存配置原始碼',
        action_storage_set: '設定儲存', action_storage_delete: '刪除儲存',
        action_package_install: '安裝套件', action_clear_events: '清除事件',
        action_restart_framework: '重啟框架', action_backup_import: '匯入備份',
        files: '檔案管理', files_desc: '瀏覽和管理專案檔案',
        search_files: '搜尋檔案...', new_file: '新建檔案', new_folder: '新建資料夾',
        upload: '上傳', save: '儲存', upload_success: '上傳成功', upload_failed: '上傳失敗',
        upload_drop: '拖拽檔案到此處或點擊上傳',
        file_saved: '檔案已儲存', file_save_failed: '儲存失敗',
        file_too_large: '檔案過大，無法編輯', binary_file: '二進制檔案，無法編輯',
        file_not_found: '檔案未找到', folder_exists: '資料夾已存在',
        delete_confirm: '確定要刪除選中的檔案嗎？此操作不可撤銷。',
        delete_success: '刪除成功', delete_failed: '刪除失敗',
        rename_label: '新名稱', rename_success: '重新命名成功', rename_failed: '重新命名失敗',
        new_file_name: '檔案名', new_folder_name: '資料夾名',
        enable_module: '啟用', disable_module: '禁用', reload_module: '重新載入',
        uninstall_module: '卸載', uninstall_confirm: '確定要卸載此模組嗎？這將刪除模組包。',
        module_uninstalling: '卸載中...', module_version: '版本',
        module_author: '作者', module_no_desc: '無描述',
        module_enabled_not_loaded: '已啟用未載入',
        module_disabled: '已禁用', reload: '重新載入',
        action_enable_module: '啟用模組', action_disable_module: '禁用模組',
        action_reload_module: '重新載入模組', action_uninstall_module: '卸載模組',
        search_modules: '搜尋模組...',
        module_loaded_dynamic: '模組已動態載入',
        installed_no_restart: '安裝完成，模組已自動載入',
        permissions: '權限', download: '下載', chmod: '修改權限',
        chmod_prompt: '輸入權限值（如 755、644）',
        pkg_manager: '套件管理', pkg_manager_desc: '管理已安裝的 Python 套件，檢查更新並安裝新套件',
        pkg_installed: '已安裝', pkg_updates: '可更新', pkg_install_new: '安裝新套件',
        pkg_updates_available: '可用的更新', pkg_upgrade_all: '全部更新',
        pkg_install_placeholder: '套件名（如 requests 或 numpy==1.24.0）',
        pkg_install_hint: '支援輸入套件名、帶版本號（package==version）或多個套件用空格分隔',
        pkg_name: '套件名', pkg_version: '版本', pkg_type: '類型', pkg_latest: '最新版本',
        pkg_type_module: '模組', pkg_type_adapter: '適配器', pkg_type_library: '庫',
        pkg_no_installed: '未找到已安裝的套件', pkg_no_updates: '所有套件均為最新版本',
        pkg_checking_updates: '正在檢查更新...', pkg_upgrading: '更新中...',
        pkg_upgrade: '更新', pkg_upgrade_confirm: '確定要更新以下套件嗎？',
        pkg_upgrade_all_confirm: '確定要更新所有可更新的套件嗎？這可能需要一些時間。',
        pkg_uninstall_confirm: '確定要卸載此套件嗎？這可能導致依賴問題。',
        pkg_cannot_uninstall: '核心套件不可卸載',
        pkg_install_success: '套件安裝完成', pkg_upgrade_success: '套件更新完成',
        pkg_install_failed: '套件安裝失敗', pkg_upgrade_failed: '套件更新失敗',
        store_version_current: '當前', store_version_latest: '最新',
        store_update_available: '有更新',
        action_package_upgrade: '更新套件', action_package_uninstall: '卸載套件',
        upgrade_all: '全部更新',
        module_hub: '模組中心', module_hub_desc: '管理模組、瀏覽商店、管理 Python 套件',
        registered: '已註冊', registered_desc: '管理已註冊的模組和適配器',
        compress: '壓縮', decompress: '解壓', upload_folder: '上傳資料夾',
        task_list: '任務列表',
        cmd_management: '命令管理', cmd_management_desc: '管理已註冊的命令：別名、平台過濾、啟用狀態',
        cmd_global_settings: '全局命令設定', cmd_prefix: '命令前綴', cmd_case_sensitive: '大小寫敏感',
        cmd_allow_space_prefix: '允許空前綴', cmd_must_at_bot: '必須@Bot',
        cmd_list: '命令列表', cmd_enabled: '已啟用', cmd_disabled: '已禁用',
        cmd_custom_aliases: '自定義別名', cmd_alias_placeholder: '輸入別名後回車添加',
        cmd_allowed_platforms: '允許的平台', cmd_allowed_platforms_hint: '留空表示允許所有平台',
        cmd_blocked_platforms: '禁止的平台', cmd_transform_to: '命令轉換',
        cmd_transform_placeholder: '留空表示不轉換，輸入目標命令名將此命令重定向',
        cmd_original_aliases_label: '原始別名', cmd_no_commands: '暫無已註冊的命令',
        cmd_help: '幫助', cmd_usage: '用法', cmd_group: '命令組',
        cmd_save_success: '命令規則已儲存', cmd_save_failed: '儲存失敗',
        cmd_yes: '是', cmd_no: '否',
        cmd_aliases_label: '別名',
        group_overview: '概覽', group_events: '事件', group_extensions: '擴展', group_system: '系統', group_tools: '工具',
        event_stream: '事件流', event_stream_desc: '即時查看系統事件流',
        event_builder_desc: '構建自定義事件用於除錯和測試',
        lifecycle_desc: '查看系統啟動和運行過程',
        settings_title: '儀表盤設定',
        settings_appearance: '外觀', settings_behavior: '行為',
        settings_theme: '深色主題', settings_language: '語言',
        settings_ui_style: '介面風格',
        settings_sidebar: '摺疊側邊欄', settings_refresh_interval: '重新整理間隔',
        settings_event_limit: '事件流數量', settings_disabled: '關閉',
        settings_restart_desc: '重新載入所有模組和適配器',
        settings_logout: '登出', settings_logout_desc: '清除令牌並返回登入頁',
        upload_modal_title: '上傳安裝', upload_drop_hint: '拖拽檔案到此處或點擊選擇',
        force_install: '強制安裝', force_install_desc: '忽略版本號強制重新安裝 (--force-reinstall)',
        start_install: '開始安裝', pip_mirror: 'pip 鏡像源',
        install_version: '安裝版本', latest_version: '最新版本',
        batch_install: '批量安裝', batch_install_count: '已選擇 {n} 個套件',
        dependencies: '依賴項', version_history: '版本歷史',
        no_dependencies: '無外部依賴', pkg_detail_loading: '載入詳情中...',
        pkg_detail_failed: '載入詳情失敗', view_detail: '詳情',
        upload_complete: '上傳完成', upload_file_too_large: '檔案過大',
        install_with_options: '安裝選項',
        status_icons_conn: '連線狀態',
        status_conn_disconnected: '未連線', status_conn_connected: '已連線', status_conn_error: '連線異常',
        expand_all: '展開全部', collapse_all: '收起全部',
    },
    ja: {
        sys_logs: 'システムログ', logs: 'ログ', lifecycle: 'ライフサイクル', events_stream: 'ストリーム', events_builder: 'ビルダー',
        sys_logs_desc: 'システムログとライフサイクルイベントを表示', logs_desc: 'システムログの表示とフィルタリング', lifecycle_desc: 'システムの起動と実行プロセスを表示',
        lifecycle_timeline: 'ライフサイクルタイムライン', all_modules: 'すべてのモジュール', search_logs: 'ログを検索...', no_lifecycle: 'ライフサイクルイベントなし',
        log_list: 'ログリスト', api_routes: 'APIルート', api_routes_desc: '登録済みのHTTPおよびWebSocketルートを表示',
        http_routes: 'HTTPルート', ws_routes: 'WebSocketルート',
        loading: '読み込み中...', online: 'オンライン', offline: 'オフライン', live: 'ライブ',
        adapters: 'アダプタ', modules_label: 'モジュール', online_bots: 'オンラインボット', total_events: 'イベント総数',
        no_adapters: 'アダプタなし', no_modules: 'モジュールなし', no_events: 'イベントなし', no_bots: 'ボットなし',
        no_logs: 'ログなし', no_http_routes: 'HTTPルートなし', no_ws_routes: 'WebSocketルートなし',
        no_data: 'データなし', requires_auth: '認証が必要',
        active: 'アクティブ', inactive: '非アクティブ',
        enable: '有効化', load: 'ロード', unload: 'アンロード', install: 'インストール',
        search_packages: 'パッケージを検索...', live_events: 'ライブイベント', waiting_events: 'イベントを待機中...',
        bots_desc: '各プラットフォームで検出されたボット', events_desc: 'イベントストリームの表示/ビルド',
        modules_desc: '登録済みモジュールとアダプタの管理', store_desc: 'パッケージの閲覧とインストール',
        config_desc: '設定とストレージの表示・管理', configuration: '設定', storage: 'ストレージ',
        auth_title: '認証', auth_desc_text: 'アクセストークンを入力して続行してください', auth_label: 'アクセストークン',
        auth_placeholder: 'トークンを入力',
        auth_hint: 'トークンは設定の <code>Dashboard.token</code> に保存されています',
        login: 'ログイン', cancel: 'キャンセル', ok: 'OK',
        logged_in: 'ログイン成功', invalid_token: '無効なトークン', action_completed: '操作完了', action_failed: '操作失敗',
        installing: 'インストール中...', installed: 'インストール完了！再起動を推奨', install_failed: 'インストール失敗',
        install_success: 'インストール完了', install_timeout: 'インストールがタイムアウト', install_restart_title: '新モジュールを読み込むために再起動', install_restart_confirm: 'モジュールのインストールに成功しました。フレームワークを再起動して読み込みますか？', install_restart_btn: '再起動',
        install_detail: 'インストール詳細', no_token_refresh: 'サービスの準備ができていません。後で更新してください',
        unload_self_title: '警告', unload_self_confirm: 'ダッシュボードモジュールをアンロードすると、Webからこのインターフェースにアクセスできなくなります。続行しますか？',
        upload_title: 'アップロードインストール', upload_desc: 'whlまたはzipパッケージをアップロードしてモジュールをインストール', upload_btn: 'ファイルを選択してインストール', uploading: 'アップロード＆インストール中...', upload_failed: 'アップロードインストール失敗',
        restart: 'フレームワーク再起動', restart_confirm: 'フレームワークを再起動しますか？すべてのモジュールとアダプタが再読み込みされます。',
        restart_success: 'フレームワークを再起動中...', restart_failed: '再起動失敗',
        clear_events: 'イベントをクリア', clear_confirm: 'すべてのイベントログをクリアしますか？',
        all_types: 'すべてのタイプ', all_platforms: 'すべてのプラットフォーム',
        no_packages: '一致するパッケージなし', failed_registry: 'レジストリの読み込みに失敗',
        event_cleared: 'イベントをクリアしました', empty_storage: 'ストレージは空です',
        message: 'メッセージ', notice: '通知', request: 'リクエスト', meta: 'メタ', platform: 'プラットフォーム',
        event_builder: 'イベントビルダー', event_builder_desc: 'デバッグとテスト用のカスタムイベントを構築',
        event_type: 'イベントタイプ', detail_type: '詳細タイプ', platform_info: 'プラットフォーム情報',
        select_platform: 'プラットフォームを選択', select_bot: 'Botを選択', custom: 'カスタム',
        select_detail_type: '詳細タイプを選択...', select_platform_placeholder: '先にプラットフォームを選択...',
        session_type: 'セッションタイプ', session_id: 'セッションID',
        session_private: 'プライベート', session_group: 'グループ', session_channel: 'チャンネル',
        custom_platform_placeholder: 'カスタムプラットフォーム名を入力', custom_bot_placeholder: 'カスタムBot IDを入力',
        session_id_placeholder: 'グループ/チャンネル/ユーザーID',
        message_content: 'メッセージ内容', optional_fields: 'オプションフィールド', json_preview: 'JSONプレビュー',
        preview: 'プレビュー', submit_event: 'イベントを送信',
        add_segment: 'セグメントを追加', add_field: 'フィールドを追加', copy_json: 'JSONをコピー',
        validate_error: '検証エラー', submit_success: 'イベントを送信しました', submit_failed: '送信失敗',
        view_tree: 'ツリー', view_source: 'ソース', reload_config: '再読込', save_config: '保存',
        config_saved: '設定を保存しました', config_load_failed: '設定ソースの読み込みに失敗',
        read_only: '読み取り専用（ルート設定）',
        cpu_usage: 'CPU使用率', process_cpu: 'プロセスCPU', memory_usage: 'メモリ使用量', rss_memory: 'RSSメモリ',
        system_memory: 'システムメモリ', system_total_memory: 'システム合計メモリ', available_memory: '利用可能メモリ',
        swap_memory: 'スワップメモリ', io_read: 'IO読み取り', io_write: 'IO書き込み',
        active_connections: 'アクティブ接続', system_details: 'システム詳細',
        websocket: 'WebSocket', message_stats: 'メッセージ統計', message_types: 'メッセージタイプ',
        platform_distribution: 'プラットフォーム分布', last_24h_trend: '過去24時間の傾向',
        registered_routes: '登録済みルート',
        refresh: '更新', copy: 'コピー', auto_refresh: '自動更新', copy_all_logs: 'すべてのログをコピー',
        event_preview: 'イベントプレビュー', copied_to_clipboard: 'クリップボードにコピーしました', copy_failed: 'コピー失敗',
        save_failed: '保存失敗', unknown_error: '不明なエラー', validation_failed: '検証失敗',
        auto_refresh_off: '自動更新をオフにしました', auto_refresh_on: '自動更新をオンにしました',
        alt_message: '代替メッセージ', request_comment: 'リクエストコメント',
        field_name_placeholder: 'フィールド名', field_value_placeholder: 'フィールド値',
        load_segments_first: '先にセグメントタイプを読み込んでください',
        test: 'テスト', send: '送信', query_params: 'クエリパラメータ', request_body: 'リクエストボディ', response: 'レスポンス',
        force_refresh: '強制更新',
        audit_log: '監査ログ', audit_log_desc: 'システム操作記録を表示', all_actions: 'すべての操作',
        backup_restore: 'バックアップと復元', backup_desc: 'システム設定とストレージデータのエクスポート/インポート',
        backup_export: 'バックアップをエクスポート', backup_import: 'インポートで復元',
        backup_export_success: 'バックアップをエクスポートしました', backup_import_confirm: 'インポートすると現在の設定とストレージが上書きされます（Dashboard設定を除く）。続行しますか？',
        import_success: '復元成功', import_failed: '復元失敗', backup_failed: 'バックアップ失敗',
        audit_clear_confirm: '監査ログをすべてクリアしますか？', audit_cleared: '監査ログをクリアしました',
        last_run: '最終実行', never: '未実行', run_count: '実行回数',
        action_load_module: 'モジュールをロード', action_unload_module: 'モジュールをアンロード',
        action_load_adapter: 'アダプタをロード', action_unload_adapter: 'アダプタをアンロード',
        action_config_update: '設定を更新', action_config_source_save: '設定ソースを保存',
        action_storage_set: 'ストレージを設定', action_storage_delete: 'ストレージを削除',
        action_package_install: 'パッケージをインストール', action_clear_events: 'イベントをクリア',
        action_restart_framework: 'フレームワークを再起動', action_backup_import: 'バックアップをインポート',
        files: 'ファイル', files_desc: 'プロジェクトファイルの閲覧と管理',
        search_files: 'ファイルを検索...', new_file: '新規ファイル', new_folder: '新規フォルダ',
        upload: 'アップロード', save: '保存', upload_success: 'アップロード成功', upload_failed: 'アップロード失敗',
        upload_drop: 'ファイルをここにドラッグまたはクリックしてアップロード',
        file_saved: 'ファイルを保存しました', file_save_failed: '保存失敗',
        file_too_large: 'ファイルが大きすぎて編集できません', binary_file: 'バイナリファイル、編集不可',
        file_not_found: 'ファイルが見つかりません', folder_exists: 'フォルダは既に存在します',
        delete_confirm: '選択したファイルを削除しますか？この操作は取り消せません。',
        delete_success: '削除しました', delete_failed: '削除失敗',
        rename_label: '新しい名前', rename_success: '名前を変更しました', rename_failed: '名前変更失敗',
        new_file_name: 'ファイル名', new_folder_name: 'フォルダ名',
        enable_module: '有効化', disable_module: '無効化', reload_module: 'リロード',
        uninstall_module: 'アンインストール', uninstall_confirm: 'このモジュールをアンインストールしますか？パッケージが削除されます。',
        module_uninstalling: 'アンインストール中...', module_version: 'バージョン',
        module_author: '作者', module_no_desc: '説明なし',
        module_enabled_not_loaded: '有効化済み（未ロード）',
        module_disabled: '無効', reload: 'リロード',
        action_enable_module: 'モジュールを有効化', action_disable_module: 'モジュールを無効化',
        action_reload_module: 'モジュールをリロード', action_uninstall_module: 'モジュールをアンインストール',
        search_modules: 'モジュールを検索...',
        module_loaded_dynamic: 'モジュールが動的にロードされました',
        installed_no_restart: 'インストール完了、モジュールは自動ロードされました',
        permissions: '権限', download: 'ダウンロード', chmod: '権限変更',
        chmod_prompt: '権限値を入力（例: 755, 644）',
        pkg_manager: 'パッケージ', pkg_manager_desc: 'インストール済みPythonパッケージの管理、更新確認、新規インストール',
        pkg_installed: 'インストール済み', pkg_updates: '更新', pkg_install_new: '新規インストール',
        pkg_updates_available: '利用可能な更新', pkg_upgrade_all: 'すべて更新',
        pkg_install_placeholder: 'パッケージ名（例: requests や numpy==1.24.0）',
        pkg_install_hint: 'パッケージ名、バージョン指定（package==version）、またはスペース区切りで複数パッケージに対応',
        pkg_name: 'パッケージ', pkg_version: 'バージョン', pkg_type: 'タイプ', pkg_latest: '最新バージョン',
        pkg_type_module: 'モジュール', pkg_type_adapter: 'アダプタ', pkg_type_library: 'ライブラリ',
        pkg_no_installed: 'インストール済みパッケージなし', pkg_no_updates: 'すべてのパッケージが最新です',
        pkg_checking_updates: '更新を確認中...', pkg_upgrading: '更新中...',
        pkg_upgrade: '更新', pkg_upgrade_confirm: '以下のパッケージを更新しますか？',
        pkg_upgrade_all_confirm: 'すべての古いパッケージを更新しますか？時間がかかる場合があります。',
        pkg_uninstall_confirm: 'このパッケージをアンインストールしますか？依存関係に問題が生じる可能性があります。',
        pkg_cannot_uninstall: 'コアパッケージはアンインストールできません',
        pkg_install_success: 'パッケージをインストールしました', pkg_upgrade_success: 'パッケージを更新しました',
        pkg_install_failed: 'パッケージのインストールに失敗', pkg_upgrade_failed: 'パッケージの更新に失敗',
        store_version_current: '現在', store_version_latest: '最新',
        store_update_available: '更新あり',
        action_package_upgrade: 'パッケージを更新', action_package_uninstall: 'パッケージをアンインストール',
        upgrade_all: 'すべて更新',
        module_hub: 'モジュールハブ', module_hub_desc: 'モジュール管理、ストア閲覧、Pythonパッケージ管理',
        registered: '登録済み', registered_desc: '登録済みモジュールとアダプタの管理',
        compress: '圧縮', decompress: '解凍', upload_folder: 'フォルダをアップロード',
        task_list: 'タスクリスト',
        cmd_management: 'コマンド管理', cmd_management_desc: '登録済みコマンドの管理：エイリアス、プラットフォームフィルタ、有効/無効',
        cmd_global_settings: 'グローバルコマンド設定', cmd_prefix: 'コマンドプレフィックス', cmd_case_sensitive: '大文字小文字を区別',
        cmd_allow_space_prefix: 'スペースプレフィックスを許可', cmd_must_at_bot: 'Botへのメンション必須',
        cmd_list: 'コマンドリスト', cmd_enabled: '有効', cmd_disabled: '無効',
        cmd_custom_aliases: 'カスタムエイリアス', cmd_alias_placeholder: 'エイリアスを入力してEnter',
        cmd_allowed_platforms: '許可プラットフォーム', cmd_allowed_platforms_hint: '空欄で全プラットフォームを許可',
        cmd_blocked_platforms: 'ブロックプラットフォーム', cmd_transform_to: 'コマンド変換',
        cmd_transform_placeholder: '空欄で変換なし、対象コマンド名を入力でリダイレクト',
        cmd_original_aliases_label: 'オリジナルエイリアス', cmd_no_commands: '登録済みコマンドなし',
        cmd_help: 'ヘルプ', cmd_usage: '使用法', cmd_group: 'コマンドグループ',
        cmd_save_success: 'コマンドルールを保存しました', cmd_save_failed: '保存失敗',
        cmd_yes: 'はい', cmd_no: 'いいえ',
        cmd_aliases_label: 'エイリアス',
        group_overview: '概要', group_events: 'イベント', group_extensions: '拡張', group_system: 'システム', group_tools: 'ツール',
        event_stream: 'イベントストリーム', event_stream_desc: 'リアルタイムイベントストリームを表示',
        event_builder_desc: 'デバッグとテスト用のカスタムイベントを構築',
        lifecycle_desc: 'システムの起動と実行プロセスを表示',
        settings_title: 'ダッシュボード設定',
        settings_appearance: '外観', settings_behavior: '動作',
        settings_theme: 'ダークテーマ', settings_language: '言語',
        settings_ui_style: 'UIスタイル',
        settings_sidebar: 'サイドバーを折りたたむ', settings_refresh_interval: '更新間隔',
        settings_event_limit: 'イベント数制限', settings_disabled: '無効',
        settings_restart_desc: 'すべてのモジュールとアダプタを再読込',
        settings_logout: 'ログアウト', settings_logout_desc: 'トークンを消去してログインページに戻る',
        upload_modal_title: 'アップロードインストール', upload_drop_hint: 'ファイルをここにドラッグまたはクリックして選択',
        force_install: '強制インストール', force_install_desc: 'バージョンを無視して強制再インストール (--force-reinstall)',
        start_install: 'インストール開始', pip_mirror: 'pip ミラー',
        install_version: 'インストールバージョン', latest_version: '最新',
        batch_install: '一括インストール', batch_install_count: '{n}個選択中',
        dependencies: '依存関係', version_history: 'バージョン履歴',
        no_dependencies: '外部依存なし', pkg_detail_loading: '詳細を読み込み中...',
        pkg_detail_failed: '詳細の読み込みに失敗', view_detail: '詳細',
        upload_complete: 'アップロード完了', upload_file_too_large: 'ファイルが大きすぎます',
        install_with_options: 'インストールオプション',
        status_icons_conn: '接続状態',
        status_conn_disconnected: '未接続', status_conn_connected: '接続済み', status_conn_error: '接続エラー',
        expand_all: 'すべて展開', collapse_all: 'すべて折り畳む',
    },
    
    ru: {
        dashboard: 'Панель управления', bots: 'Боты', events: 'События', modules: 'Плагины', store: 'Магазин модулей', config: 'Конфигурация',
        sys_logs: 'Системные журналы', logs: 'Журналы', lifecycle: 'Жизненный цикл', events_stream: 'Поток', events_builder: 'Конструктор',
        sys_logs_desc: 'Просмотр системных журналов и событий жизненного цикла', logs_desc: 'Просмотр и фильтрация системных журналов', lifecycle_desc: 'Просмотр процесса запуска и работы системы',
        lifecycle_timeline: 'Шкала жизненного цикла', all_modules: 'Все модули', search_logs: 'Поиск в журналах...', no_lifecycle: 'Нет событий жизненного цикла',
        log_list: 'Список журналов', api_routes: 'API маршруты', api_routes_desc: 'Просмотр всех зарегистрированных HTTP и WebSocket маршрутов',
        http_routes: 'HTTP маршруты', ws_routes: 'WebSocket маршруты',
        loading: 'Загрузка...', online: 'В сети', offline: 'Не в сети', live: 'В реальном времени',
        adapters: 'Адаптеры', modules_label: 'Модули', online_bots: 'Боты в сети', total_events: 'Всего событий',
        no_adapters: 'Нет адаптеров', no_modules: 'Нет модулей', no_events: 'Нет событий', no_bots: 'Нет ботов',
        no_logs: 'Нет журналов', no_http_routes: 'Нет HTTP маршрутов', no_ws_routes: 'Нет WebSocket маршрутов',
        no_data: 'Нет данных', requires_auth: 'Требуется авторизация',
        active: 'Активен', inactive: 'Неактивен',
        enable: 'Включить', load: 'Загрузить', unload: 'Выгрузить', install: 'Установить',
        search_packages: 'Поиск пакетов...', live_events: 'События в реальном времени', waiting_events: 'Ожидание событий...',
        bots_desc: 'Обнаруженные боты на платформах', events_desc: 'Просмотр/создание потока событий',
        modules_desc: 'Управление зарегистрированными модулями и адаптерами', store_desc: 'Просмотр и установка пакетов',
        config_desc: 'Просмотр и управление конфигурацией и хранилищем', configuration: 'Конфигурация', storage: 'Хранилище',
        auth_title: 'Аутентификация', auth_desc_text: 'Введите токен доступа для продолжения', auth_label: 'Токен доступа',
        auth_placeholder: 'Введите токен',
        auth_hint: 'Токен хранится в конфигурации <code>Dashboard.token</code>',
        login: 'Войти', cancel: 'Отмена', ok: 'OK',
        logged_in: 'Вход выполнен', invalid_token: 'Неверный токен', action_completed: 'Действие выполнено', action_failed: 'Действие не удалось',
        installing: 'Установка...', installed: 'Установлено! Рекомендуется перезапуск', install_failed: 'Установка не удалась',
        install_success: 'Установка завершена', install_timeout: 'Таймаут установки', install_restart_title: 'Перезапуск для загрузки нового модуля', install_restart_confirm: 'Модуль успешно установлен. Перезапустить фреймворк для его загрузки?', install_restart_btn: 'Перезапуск',
        install_detail: 'Детали установки', no_token_refresh: 'Сервис не готов, обновите позже',
        unload_self_title: 'Предупреждение', unload_self_confirm: 'После выгрузки модуля панели управления вы не сможете получить доступ к этому интерфейсу через веб. Продолжить?',
        upload_title: 'Установка из файла', upload_desc: 'Загрузите whl или zip пакет для установки модуля', upload_btn: 'Выбрать файл и установить', uploading: 'Загрузка и установка...', upload_failed: 'Ошибка загрузки и установки',
        restart: 'Перезапуск фреймворка', restart_confirm: 'Перезапустить фреймворк? Все модули и адаптеры будут перезагружены.',
        restart_success: 'Перезапуск фреймворка...', restart_failed: 'Ошибка перезапуска',
        clear_events: 'Очистить события', clear_confirm: 'Очистить все журналы событий?',
        all_types: 'Все типы', all_platforms: 'Все платформы',
        no_packages: 'Нет подходящих пакетов', failed_registry: 'Не удалось загрузить реестр',
        event_cleared: 'События очищены', empty_storage: 'Хранилище пусто',
        message: 'Сообщение', notice: 'Уведомление', request: 'Запрос', meta: 'Мета', platform: 'Платформа',
        event_builder: 'Конструктор событий', event_builder_desc: 'Создание пользовательских событий для отладки и тестирования',
        event_type: 'Тип события', detail_type: 'Тип детали', platform_info: 'Информация о платформе',
        select_platform: 'Выбрать платформу', select_bot: 'Выбрать бота', custom: 'Пользовательский',
        select_detail_type: 'Выберите тип детали...', select_platform_placeholder: 'Сначала выберите платформу...',
        session_type: 'Тип сессии', session_id: 'ID сессии',
        session_private: 'Личный', session_group: 'Групповой', session_channel: 'Канал',
        custom_platform_placeholder: 'Введите название платформы', custom_bot_placeholder: 'Введите пользовательский Bot ID',
        session_id_placeholder: 'ID группы/канала/пользователя',
        message_content: 'Содержание сообщения', optional_fields: 'Дополнительные поля', json_preview: 'Предпросмотр JSON',
        preview: 'Предпросмотр', submit_event: 'Отправить событие',
        add_segment: 'Добавить сегмент', add_field: 'Добавить поле', copy_json: 'Копировать JSON',
        validate_error: 'Ошибка валидации', submit_success: 'Событие отправлено', submit_failed: 'Ошибка отправки',
        view_tree: 'Дерево', view_source: 'Исходный код', reload_config: 'Обновить', save_config: 'Сохранить',
        config_saved: 'Конфигурация сохранена', config_load_failed: 'Не удалось загрузить исходный код конфигурации',
        read_only: 'Только чтение (корневая конфигурация)',
        cpu_usage: 'Использование CPU', process_cpu: 'CPU процесса', memory_usage: 'Использование памяти', rss_memory: 'RSS память',
        system_memory: 'Системная память', system_total_memory: 'Общая системная память', available_memory: 'Доступная память',
        swap_memory: 'Swap память', io_read: 'IO чтение', io_write: 'IO запись',
        active_connections: 'Активные соединения', system_details: 'Детали системы',
        websocket: 'WebSocket', message_stats: 'Статистика сообщений', message_types: 'Типы сообщений',
        platform_distribution: 'Распределение по платформам', last_24h_trend: 'Тренд за 24 часа',
        registered_routes: 'Зарегистрированные маршруты',
        refresh: 'Обновить', copy: 'Копировать', auto_refresh: 'Автообновление', copy_all_logs: 'Копировать все журналы',
        event_preview: 'Предпросмотр события', copied_to_clipboard: 'Скопировано в буфер обмена', copy_failed: 'Ошибка копирования',
        save_failed: 'Ошибка сохранения', unknown_error: 'Неизвестная ошибка', validation_failed: 'Ошибка валидации',
        auto_refresh_off: 'Автообновление отключено', auto_refresh_on: 'Автообновление включено',
        alt_message: 'Альт. сообщение', request_comment: 'Комментарий к запросу',
        field_name_placeholder: 'Имя поля', field_value_placeholder: 'Значение поля',
        load_segments_first: 'Сначала загрузите типы сегментов',
        test: 'Тест', send: 'Отправить', query_params: 'Параметры запроса', request_body: 'Тело запроса', response: 'Ответ',
        force_refresh: 'Принудительное обновление',
        audit_log: 'Журнал аудита', audit_log_desc: 'Просмотр записей системных операций', all_actions: 'Все действия',
        backup_restore: 'Резервное копирование', backup_desc: 'Экспорт или импорт конфигурации системы и данных хранилища',
        backup_export: 'Экспортировать', backup_import: 'Импортировать',
        backup_export_success: 'Резервная копия экспортирована', backup_import_confirm: 'Импорт перезапишет текущую конфигурацию и хранилище (кроме конфигурации Dashboard). Продолжить?',
        import_success: 'Восстановление выполнено', import_failed: 'Ошибка восстановления', backup_failed: 'Ошибка резервного копирования',
        audit_clear_confirm: 'Очистить все записи аудита?', audit_cleared: 'Журнал аудита очищен',
        last_run: 'Последний запуск', never: 'Никогда', run_count: 'Количество запусков',
        action_load_module: 'Загрузить модуль', action_unload_module: 'Выгрузить модуль',
        action_load_adapter: 'Загрузить адаптер', action_unload_adapter: 'Выгрузить адаптер',
        action_config_update: 'Обновить конфигурацию', action_config_source_save: 'Сохранить исходный код',
        action_storage_set: 'Установить хранилище', action_storage_delete: 'Удалить хранилище',
        action_package_install: 'Установить пакет', action_clear_events: 'Очистить события',
        action_restart_framework: 'Перезапустить фреймворк', action_backup_import: 'Импортировать backup',
        files: 'Файлы', files_desc: 'Просмотр и управление файлами проекта',
        search_files: 'Поиск файлов...', new_file: 'Новый файл', new_folder: 'Новая папка',
        upload: 'Загрузить', save: 'Сохранить', upload_success: 'Загрузка успешна', upload_failed: 'Ошибка загрузки',
        upload_drop: 'Перетащите файлы сюда или нажмите для загрузки',
        file_saved: 'Файл сохранён', file_save_failed: 'Ошибка сохранения',
        file_too_large: 'Файл слишком большой для редактирования', binary_file: 'Бинарный файл, нельзя редактировать',
        file_not_found: 'Файл не найден', folder_exists: 'Папка уже существует',
        delete_confirm: 'Удалить выбранные файлы? Это действие нельзя отменить.',
        delete_success: 'Удалено', delete_failed: 'Ошибка удаления',
        rename_label: 'Новое имя', rename_success: 'Переименовано', rename_failed: 'Ошибка переименования',
        new_file_name: 'Имя файла', new_folder_name: 'Имя папки',
        enable_module: 'Включить', disable_module: 'Отключить', reload_module: 'Перезагрузить',
        uninstall_module: 'Удалить', uninstall_confirm: 'Удалить этот модуль? Пакет будет удалён.',
        module_uninstalling: 'Удаление...', module_version: 'Версия',
        module_author: 'Автор', module_no_desc: 'Без описания',
        module_enabled_not_loaded: 'Включён, не загружен',
        module_disabled: 'Отключён', reload: 'Перезагрузить',
        action_enable_module: 'Включить модуль', action_disable_module: 'Отключить модуль',
        action_reload_module: 'Перезагрузить модуль', action_uninstall_module: 'Удалить модуль',
        search_modules: 'Поиск модулей...',
        module_loaded_dynamic: 'Модуль загружен динамически',
        installed_no_restart: 'Установлено, модуль загружен автоматически',
        permissions: 'Права доступа', download: 'Скачать', chmod: 'Изменить права',
        chmod_prompt: 'Введите права (например, 755, 644)',
        pkg_manager: 'Пакеты', pkg_manager_desc: 'Управление установленными Python пакетами, проверка обновлений и установка новых',
        pkg_installed: 'Установленные', pkg_updates: 'Обновления', pkg_install_new: 'Установить новый',
        pkg_updates_available: 'Доступные обновления', pkg_upgrade_all: 'Обновить все',
        pkg_install_placeholder: 'Имя пакета (например, requests или numpy==1.24.0)',
        pkg_install_hint: 'Поддерживается имя пакета, с версией (package==version) или несколько пакетов через пробел',
        pkg_name: 'Пакет', pkg_version: 'Версия', pkg_type: 'Тип', pkg_latest: 'Последняя',
        pkg_type_module: 'Модуль', pkg_type_adapter: 'Адаптер', pkg_type_library: 'Библиотека',
        pkg_no_installed: 'Установленные пакеты не найдены', pkg_no_updates: 'Все пакеты актуальны',
        pkg_checking_updates: 'Проверка обновлений...', pkg_upgrading: 'Обновление...',
        pkg_upgrade: 'Обновить', pkg_upgrade_confirm: 'Обновить следующие пакеты?',
        pkg_upgrade_all_confirm: 'Обновить все устаревшие пакеты? Это может занять некоторое время.',
        pkg_uninstall_confirm: 'Удалить этот пакет? Это может вызвать проблемы с зависимостями.',
        pkg_cannot_uninstall: 'Нельзя удалить базовый пакет',
        pkg_install_success: 'Пакет установлен', pkg_upgrade_success: 'Пакет обновлён',
        pkg_install_failed: 'Ошибка установки пакета', pkg_upgrade_failed: 'Ошибка обновления пакета',
        store_version_current: 'Текущая', store_version_latest: 'Последняя',
        store_update_available: 'Доступно обновление',
        action_package_upgrade: 'Обновить пакет', action_package_uninstall: 'Удалить пакет',
        upgrade_all: 'Обновить все',
        module_hub: 'Центр модулей', module_hub_desc: 'Управление модулями, магазин, управление Python пакетами',
        registered: 'Зарегистрированные', registered_desc: 'Управление зарегистрированными модулями и адаптерами',
        compress: 'Сжать', decompress: 'Распаковать', upload_folder: 'Загрузить папку',
        task_list: 'Список задач',
        cmd_management: 'Управление командами', cmd_management_desc: 'Управление командами: псевдонимы, фильтры платформ, вкл/выкл',
        cmd_global_settings: 'Глобальные настройки команд', cmd_prefix: 'Префикс команд', cmd_case_sensitive: 'Чувствительность к регистру',
        cmd_allow_space_prefix: 'Разрешить пробел как префикс', cmd_must_at_bot: 'Обязательно @Bot',
        cmd_list: 'Список команд', cmd_enabled: 'Включена', cmd_disabled: 'Отключена',
        cmd_custom_aliases: 'Пользовательские псевдонимы', cmd_alias_placeholder: 'Введите псевдоним и нажмите Enter',
        cmd_allowed_platforms: 'Разрешённые платформы', cmd_allowed_platforms_hint: 'Оставьте пустым для всех платформ',
        cmd_blocked_platforms: 'Заблокированные платформы', cmd_transform_to: 'Преобразование команды',
        cmd_transform_placeholder: 'Оставьте пустым для отсутствия преобразования, введите имя целевой команды для перенаправления',
        cmd_original_aliases_label: 'Оригинальные псевдонимы', cmd_no_commands: 'Нет зарегистрированных команд',
        cmd_help: 'Справка', cmd_usage: 'Использование', cmd_group: 'Группа команд',
        cmd_save_success: 'Правило команды сохранено', cmd_save_failed: 'Ошибка сохранения',
        cmd_yes: 'Да', cmd_no: 'Нет',
        cmd_aliases_label: 'Псевдонимы',
        group_overview: 'Обзор', group_events: 'События', group_extensions: 'Расширения', group_system: 'Система', group_tools: 'Инструменты',
        event_stream: 'Поток событий', event_stream_desc: 'Просмотр потока событий в реальном времени',
        event_builder_desc: 'Создание пользовательских событий для отладки и тестирования',
        lifecycle_desc: 'Просмотр процесса запуска и работы системы',
        settings_title: 'Настройки панели',
        settings_appearance: 'Внешний вид', settings_behavior: 'Поведение',
        settings_theme: 'Тёмная тема', settings_language: 'Язык',
        settings_ui_style: 'Стиль интерфейса',
        settings_sidebar: 'Свернуть боковую панель', settings_refresh_interval: 'Интервал обновления',
        settings_event_limit: 'Лимит событий', settings_disabled: 'Отключено',
        settings_restart_desc: 'Перезагрузить все модули и адаптеры',
        settings_logout: 'Выйти', settings_logout_desc: 'Очистить токен и вернуться к входу',
        upload_modal_title: 'Загрузка и установка', upload_drop_hint: 'Перетащите файл или нажмите для выбора',
        force_install: 'Принудительная установка', force_install_desc: 'Принудительная переустановка независимо от версии (--force-reinstall)',
        start_install: 'Начать установку', pip_mirror: 'pip зеркало',
        install_version: 'Версия установки', latest_version: 'Последняя',
        batch_install: 'Пакетная установка', batch_install_count: 'Выбрано: {n}',
        dependencies: 'Зависимости', version_history: 'История версий',
        no_dependencies: 'Нет внешних зависимостей', pkg_detail_loading: 'Загрузка деталей...',
        pkg_detail_failed: 'Не удалось загрузить детали', view_detail: 'Детали',
        upload_complete: 'Загрузка завершена', upload_file_too_large: 'Файл слишком большой',
        install_with_options: 'Параметры установки',
        status_icons_conn: 'Соединение',
        status_conn_disconnected: 'Отключено', status_conn_connected: 'Подключено', status_conn_error: 'Ошибка соединения',
        expand_all: 'Развернуть всё', collapse_all: 'Свернуть всё',
    }
};

const STATUS_FRAMES = {
    conn: [
        'Disconnected.png',
        'Connected.png',
        'Connection Error  Broken.png'
    ]
};

const STATUS_STATE_KEYS = {
    conn: ['status_conn_disconnected', 'status_conn_connected', 'status_conn_error']
};

const _statusRegistry = {};

function createStatusIcon(container, config) {
    const group = config.group;
    const size = config.size || 'lg';
    const showLabel = config.showLabel !== false;
    const frames = STATUS_FRAMES[group];
    if (!frames) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'status-icon-container';

    const framesDiv = document.createElement('div');
    framesDiv.className = 'status-icon-frames size-' + size;

    frames.forEach(function(src, i) {
        var img = document.createElement('img');
        img.src = '/Dashboard/static/res/' + group + '/' + encodeURIComponent(src);
        img.alt = src.replace(/\.png$/, '');
        img.dataset.frame = String(i);
        if (i === 0) img.classList.add('active');
        framesDiv.appendChild(img);
    });

    wrapper.appendChild(framesDiv);

    var labelEl = null, stateEl = null;
    if (showLabel) {
        labelEl = document.createElement('div');
        labelEl.className = 'status-icon-label';
        labelEl.textContent = t('status_icons_' + group) || group;
        wrapper.appendChild(labelEl);

        stateEl = document.createElement('div');
        stateEl.className = 'status-icon-state';
        stateEl.textContent = t(STATUS_STATE_KEYS[group][0]) || '';
        wrapper.appendChild(stateEl);
    }

    container.appendChild(wrapper);

    var instance = {
        id: 'si_' + group + '_' + Math.random().toString(36).substr(2, 6),
        group: group,
        container: container,
        wrapper: wrapper,
        framesDiv: framesDiv,
        stateEl: stateEl,
        currentFrame: 0,
        animating: false,
        _timers: [],
        destroy: function() {
            instance._timers.forEach(clearTimeout);
            instance._timers = [];
            if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
            delete _statusRegistry[instance.id];
        },
        setState: function(frameIndex, animate) {
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
        }
    };

    _statusRegistry[instance.id] = instance;
    return instance;
}

function _setFrameDirect(inst, frameIndex) {
    var imgs = inst.framesDiv.querySelectorAll('img');
    imgs.forEach(function(img) {
        img.classList.remove('active', 'crt-out', 'crt-in');
        img.style.clipPath = '';
    });
    if (imgs[frameIndex]) imgs[frameIndex].classList.add('active');

    var beam = inst.framesDiv.querySelector('.scanline-beam');
    if (beam) beam.remove();
    inst.framesDiv.classList.remove('scanning');

    inst.currentFrame = frameIndex;
    if (inst.stateEl) {
        var key = STATUS_STATE_KEYS[inst.group] && STATUS_STATE_KEYS[inst.group][frameIndex];
        if (key) inst.stateEl.textContent = t(key) || '';
    }
}

function _crtTransition(inst, newFrame) {
    if (inst.animating) {
        inst._timers.forEach(clearTimeout);
        inst._timers = [];
        var oldImgs = inst.framesDiv.querySelectorAll('img');
        oldImgs.forEach(function(img) {
            img.classList.remove('active', 'crt-out', 'crt-in');
            img.style.clipPath = '';
        });
        var oldBeam = inst.framesDiv.querySelector('.scanline-beam');
        if (oldBeam) oldBeam.remove();
        inst.framesDiv.classList.remove('scanning');
    }

    inst.animating = true;
    inst.framesDiv.classList.add('scanning');

    var imgs = inst.framesDiv.querySelectorAll('img');
    var oldFrame = inst.currentFrame;
    var oldImg = imgs[oldFrame];
    var newImg = imgs[newFrame];

    var sameFrame = (oldImg === newImg);

    if (oldImg && !sameFrame) {
        oldImg.classList.remove('active', 'crt-in');
        oldImg.classList.add('crt-out');
    }

    var beamOut = document.createElement('div');
    beamOut.className = 'scanline-beam sweep-up';
    inst.framesDiv.appendChild(beamOut);

    inst._timers.push(setTimeout(function() {
        if (oldImg && !sameFrame) {
            oldImg.classList.remove('crt-out');
            oldImg.style.clipPath = 'inset(100% 0 0 0)';
        }
        beamOut.remove();

        if (newImg) {
            newImg.classList.remove('crt-out');
            newImg.style.clipPath = '';
            newImg.classList.add('crt-in');
        }

        var beamIn = document.createElement('div');
        beamIn.className = 'scanline-beam sweep-down';
        inst.framesDiv.appendChild(beamIn);

        inst._timers.push(setTimeout(function() {
            imgs.forEach(function(img) {
                img.classList.remove('crt-out', 'crt-in', 'active');
                img.style.clipPath = '';
            });
            if (imgs[newFrame]) imgs[newFrame].classList.add('active');

            beamIn.remove();
            inst.framesDiv.classList.remove('scanning');
            inst.currentFrame = newFrame;
            inst.animating = false;

            if (inst.stateEl) {
                var key = STATUS_STATE_KEYS[inst.group] && STATUS_STATE_KEYS[inst.group][newFrame];
                if (key) inst.stateEl.textContent = t(key) || '';
            }
        }, 280));
    }, 280));
}

function updateStatusGroup(group, frameIndex, animate) {
    Object.keys(_statusRegistry).forEach(function(id) {
        var inst = _statusRegistry[id];
        if (inst.group === group) {
            inst.setState(frameIndex, animate !== false);
        }
    });
}

var _badgeInst = null, _panelInst = null, _collapseTimer = null;

function initHeaderStatusIcon() {
    var badgeContainer = document.getElementById('status-badge-icon');
    var panelContainer = document.getElementById('status-panel-icon');
    if (!badgeContainer || !panelContainer || badgeContainer.dataset.init === '1') return;
    badgeContainer.dataset.init = '1';

    _badgeInst = createStatusIcon(badgeContainer, { group: 'conn', size: 'custom', showLabel: false });
    _panelInst = createStatusIcon(panelContainer, { group: 'conn', size: 'custom', showLabel: false });

    _badgeInst.setState(0, false);
    _panelInst.setState(0, false);
}

function showConnPanel(title, desc) {
    var panel = document.getElementById('connPanel');
    var titleEl = document.getElementById('connPanelTitle');
    var descEl = document.getElementById('connPanelDesc');
    if (titleEl) titleEl.textContent = title || '';
    if (descEl) descEl.textContent = desc || '';
    if (panel) panel.classList.add('expanded');

    if (_collapseTimer) clearTimeout(_collapseTimer);
    _collapseTimer = setTimeout(function() {
        if (panel) panel.classList.remove('expanded');
    }, 2600);
}

function updateConnBadge(state) {
    var badge = document.getElementById('connBadge');
    var text = document.getElementById('connBadgeText');
    if (badge) {
        badge.classList.remove('connected', 'disconnected');
        if (state === 1) badge.classList.add('connected');
        else if (state === 0) badge.classList.add('disconnected');
    }
    if (text) {
        var labels = [
            t('status_conn_disconnected'),
            t('status_conn_connected'),
            t('status_conn_error')
        ];
        text.textContent = labels[state] || '';
    }
}

function connStateChange(state, animate) {
    if (_badgeInst) _badgeInst.setState(state, false);
    updateConnBadge(state);

    if (animate) {
        var titleKey = STATUS_STATE_KEYS.conn[state];
        showConnPanel(t(titleKey), t('status_icons_conn'));

        if (_panelInst) {
            _panelInst.setState(_panelInst.currentFrame, false);
            setTimeout(function() {
                if (_panelInst) _panelInst.setState(state, true);
            }, 400);
        }
    } else {
        if (_panelInst) _panelInst.setState(state, false);
    }
}

function createBotStatusIcon(botCard) {
    var container = document.createElement('div');
    container.className = 'bot-card-status';
    botCard.appendChild(container);
    return createStatusIcon(container, { group: 'conn', size: 'bot', showLabel: false });
}

function detectLang() {
    const saved = localStorage.getItem('ep_lang');
    if (saved) return saved;
    const bl = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
    if (bl.startsWith('zh-tw') || bl.startsWith('zh-hk') || bl.startsWith('zh-hant')) return 'zh-TW';
    if (bl.startsWith('zh')) return 'zh';
    if (bl.startsWith('ja')) return 'ja';
    if (bl.startsWith('ru')) return 'ru';
    return 'en';
}
function getLocale() {
    const m = { 'zh': 'zh-CN', 'zh-TW': 'zh-TW', 'ja': 'ja-JP', 'ru': 'ru-RU' };
    return m[lang] || 'en-US';
}
let lang = detectLang();
function t(k) { return I18N[lang]?.[k] || k }
function cmpVer(a, b) {
    const pa = a.replace(/^v/, '').split(/[-.]/), pb = b.replace(/^v/, '').split(/[-.]/);
    const num = s => /^\d+$/.test(s) ? parseInt(s, 10) : -1;
    const pre = s => { if (s === 'dev' || s === 'alpha' || s === 'a') return -4; if (s === 'beta' || s === 'b') return -3; if (s === 'rc' || s === 'c') return -2; return 0 };
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        let va = i < pa.length ? pa[i] : '', vb = i < pb.length ? pb[i] : '';
        const na = num(va), nb = num(vb);
        if (na >= 0 && nb >= 0) { if (na !== nb) return na > nb ? 1 : -1; continue }
        if (na >= 0) return 1; if (nb >= 0) return -1;
        const la = va.toLowerCase(), lb = vb.toLowerCase();
        if (la === lb) continue;
        return la > lb ? 1 : -1;
    }
    return 0;
}
function toggleLang() {
    const langs = ['en', 'zh', 'zh-TW', 'ja', 'ru'];
    lang = langs[(langs.indexOf(lang) + 1) % langs.length];
    localStorage.setItem('ep_lang', lang); applyI18n(); loadAll();
}
function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (I18N[lang][k]) el.textContent = I18N[lang][k] });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const k = el.getAttribute('data-i18n-placeholder'); if (I18N[lang][k]) el.placeholder = I18N[lang][k] });
    document.querySelectorAll('[data-i18n-option]').forEach(el => { const k = el.getAttribute('data-i18n-option'); if (I18N[lang][k]) el.textContent = I18N[lang][k] });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { const k = el.getAttribute('data-i18n-title'); if (I18N[lang][k]) el.title = I18N[lang][k] });
    const ah = document.getElementById('authHint'); if (ah && I18N[lang].auth_hint) ah.innerHTML = I18N[lang].auth_hint;
    const titles = { 'zh': 'ErisPulse 仪表盘', 'zh-TW': 'ErisPulse 儀表盤', 'ja': 'ErisPulse ダッシュボード', 'ru': 'ErisPulse Панель управления' };
    document.title = titles[lang] || 'ErisPulse Dashboard';
    const htmlLangMap = { 'zh': 'zh-CN', 'zh-TW': 'zh-TW', 'ja': 'ja', 'ru': 'ru' };
    document.documentElement.lang = htmlLangMap[lang] || 'en';
    refreshConnBadgeText();
}

function refreshConnBadgeText() {
    var badge = document.getElementById('connBadge');
    var text = document.getElementById('connBadgeText');
    if (!badge || !text) return;
    var state = 0;
    if (badge.classList.contains('connected')) state = 1;
    else if (badge.classList.contains('disconnected')) state = 0;
    text.textContent = t(STATUS_STATE_KEYS.conn[state]);
}

function getTheme() {
    const s = localStorage.getItem('ep_theme');
    if (s) return s;
    return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
}
function applyTheme(th) {
    document.documentElement.setAttribute('data-theme', th);
}
function toggleTheme() { const th = getTheme() === 'dark' ? 'light' : 'dark'; localStorage.setItem('ep_theme', th); applyTheme(th) }

function getUiStyle() {
    return localStorage.getItem('ep_ui_style') || 'eris';
}
function applyUiStyle(style) {
    document.documentElement.setAttribute('data-ui-style', style);
}
function applySettingUiStyle(val) {
    localStorage.setItem('ep_ui_style', val);
    applyUiStyle(val);
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('show') }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('show') }

function esc(s) { if (s == null) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

function api(path, opts) {
    const tk = localStorage.getItem(TK);
    const headers = { ...(opts?.headers || {}), ...(tk ? { 'Authorization': 'Bearer ' + tk } : {}) };
    if (opts?.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    return fetch(API + path, { ...opts, headers }).then(r => {
        if (r.status === 401) { authed = false; localStorage.removeItem(TK); document.querySelector('.app').classList.remove('authed'); showLogin(); return null }
        return r.json()
    }).catch(() => null);
}

async function fetchAdapterLogos() {
    const d = await api('/api/adapter-logos');
    if (d && d.logos) _adapterLogos = d.logos;
}

function getAdapterLogo(name) {
    if (!name) return null;
    var low = name.toLowerCase(), best = null, bestLen = 0;
    for (var k in _adapterLogos) {
        if (low.indexOf(k.toLowerCase()) !== -1 && k.length > bestLen) {
            best = _adapterLogos[k]; bestLen = k.length;
        }
    }
    return best;
}

function adapterLogoImg(name, size) {
    var s = size || 20;
    var src = getAdapterLogo(name);
    if (!src) return '';
    return '<img src="' + esc(src) + '" style="width:' + s + 'px;height:' + s + 'px;border-radius:4px;object-fit:contain;flex-shrink:0" onerror="this.remove()">';
}

function _botAvatarFallback(el) {
    var logo = el.getAttribute('data-logo');
    if (logo && el.src !== logo) {
        el.removeAttribute('data-logo');
        el.src = logo;
        var container = el.parentElement;
        if (container) { container.classList.add('has-logo'); container.classList.remove('bot-avatar'); container.classList.add('bot-avatar'); }
        return;
    }
    var container = el.parentElement;
    if (container) { container.classList.remove('has-logo'); }
    el.outerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>';
}

function go(name, el) {
    if (!authed) { showLogin(); return }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('p-' + name);
    if (page) page.classList.add('active');
    if (el) el.classList.add('active');
    closeSidebar();

    const loaders = {
        'dashboard': refreshDashboard,
        'bots': loadBots,
        'event-stream': loadEvents,
        'event-builder': initEventBuilder,
        'modules': loadModules,
        'store': loadStore,
        'packages': function() { loadPackages(); loadPackageUpdates(); },
        'logs': loadLogs,
        'lifecycle': loadLifecycle,
        'audit': loadAuditLog,
        'api-routes': loadApiRoutes,
        'commands': loadCommands,
        'files': function() { fmBrowse('.'); },
        'config': loadConfig,
    };
    if (loaders[name]) loaders[name]();

    if (name !== 'logs' && _logAutoRefreshTimer) {
        clearInterval(_logAutoRefreshTimer);
        _logAutoRefreshTimer = null;
        const btn = document.getElementById('logAutoRefreshBtn');
        if (btn) btn.style.opacity = '0.5';
    }
}

function showModal(title, text, actions) {
    return new Promise(r => {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalText').innerHTML = text;
        const ac = document.getElementById('modalActions'); ac.innerHTML = '';
        actions.forEach(a => {
            const b = document.createElement('button');
            b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-secondary');
            b.textContent = a.label;
            b.onclick = () => { document.getElementById('modalOv').classList.remove('show'); r(a.value) };
            ac.appendChild(b);
        });
        document.getElementById('modalOv').classList.add('show');
    });
}
function confirm2(title, text) { return showModal(title, text, [{ label: t('cancel'), value: false }, { label: t('ok'), value: true, primary: true }]) }
function alert2(title, text) { return showModal(title, text, [{ label: t('ok'), value: true, primary: true }]) }

function showOutputModal(title, lines, actions) {
    return new Promise(r => {
        document.getElementById('outputTitle').textContent = title;
        const pre = document.getElementById('outputPre');
        pre.textContent = (lines || []).join('\n') || '(no output)';
        const ac = document.getElementById('outputActions'); ac.innerHTML = '';
        actions.forEach(a => {
            const b = document.createElement('button');
            b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-secondary');
            b.textContent = a.label;
            b.onclick = () => { document.getElementById('outputOv').classList.remove('show'); r(a.value) };
            ac.appendChild(b);
        });
        document.getElementById('outputOv').classList.add('show');
    });
}

function toast(msg, type) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:8px;font-size:14px;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:9999;opacity:0;transition:opacity .2s;pointer-events:none';
    if (type === 'ok') { el.style.background = 'var(--ok-bg)'; el.style.color = 'var(--ok-c)'; el.style.border = '1px solid var(--ok-bd)' }
    else if (type === 'er') { el.style.background = 'var(--er-bg)'; el.style.color = 'var(--er-c)'; el.style.border = '1px solid var(--er-bd)' }
    else { el.style.background = 'var(--bg-t)'; el.style.color = 'var(--tx-p)'; el.style.border = '1px solid var(--bd)' }
    el.textContent = msg; document.body.appendChild(el);
    requestAnimationFrame(() => el.style.opacity = '1');
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200) }, 2500);
}

function showLogin() {
    document.querySelector('.app').classList.remove('authed');
    document.getElementById('loginOv').classList.add('show');
    const ls = document.getElementById('loginLangSelect'); if (ls) ls.value = lang;
    preloadLoginBg();
    document.getElementById('loginInput').focus()
}
function closeLogin() { document.getElementById('loginOv').classList.remove('show') }

let _loginBgLoaded = false;
function preloadLoginBg() {
    if (getUiStyle() !== 'eris' || _loginBgLoaded) return;
    const overlay = document.getElementById('loginOv');
    const loader = document.getElementById('loginBgLoader');
    if (!overlay || !loader) return;
    const img = new Image();
    img.onload = function () {
        _loginBgLoaded = true;
        overlay.classList.add('bg-ready');
        loader.classList.add('loaded');
    };
    img.onerror = function () {
        loader.classList.add('loaded');
    };
    img.src = '/Dashboard/static/res/login/Login Background.png';
}
let _loginLock = false;
async function doLogin() {
    if (_loginLock) return; _loginLock = true;
    const inp = document.getElementById('loginInput');
    const btn = inp.closest('.login-card').querySelector('.btn-primary');
    btn.disabled = true; btn.style.opacity = '.5';
    const v = inp.value.trim(); if (!v) { _loginLock = false; btn.disabled = false; btn.style.opacity = ''; return }
    const d = await api('/api/auth', { method: 'POST', body: JSON.stringify({ token: v }) });
    if (d && d.success) {
        localStorage.setItem(TK, v); authed = true; closeLogin();
        document.querySelector('.app').classList.add('authed');
        loadAll(); wsConnect(); restartRefreshTimer();
        toast(t('logged_in'), 'ok');
    } else {
        if (!authed) localStorage.removeItem(TK);
        toast(t('invalid_token'), 'er');
        inp.select();
    }
    btn.disabled = false; btn.style.opacity = ''; _loginLock = false;
}

function doLogout() {
    localStorage.removeItem(TK);
    authed = false;
    closeSettings();
    document.querySelector('.app').classList.remove('authed');
    showLogin();
}

function evHtml(e) {
    const tm = new Date(e.time * 1000).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return '<div class="ev-item"><span class="ev-badge ' + e.type + '">' + esc(e.type) + '</span><div style="flex:1;min-width:0"><div>' + esc(e.alt_message || e.detail_type || '-') + '</div>' + (e.user_id ? '<div style="font-size:11px;color:var(--tx-s)">user: ' + esc(e.user_id) + '</div>' : '') + '</div><span style="font-size:11px;color:var(--tx-s);flex-shrink:0">' + esc(e.platform) + '</span><span style="font-size:11px;color:var(--tx-t);flex-shrink:0">' + tm + '</span></div>';
}

async function refreshDashboard() {
    const d = await api('/api/status'); if (!d) return;
    const fw = d.framework || {};
    document.getElementById('fwDesc').textContent = 'ErisPulse v' + fw.version + ' | Python ' + fw.python_version;
    document.getElementById('fwInfo').textContent = 'ErisPulse v' + fw.version;
    const ad = d.adapters || {}, mo = d.modules || {};
    let ob = 0; Object.values(ad).forEach(a => Object.values(a.bots || {}).forEach(b => { if (b.status === 'online') ob++ }));
    document.getElementById('statGrid').innerHTML =
        '<div class="card"><div class="card-body" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center">' +
        statCard(Object.keys(ad).length, t('adapters')) +
        statCard(Object.keys(mo).filter(k => mo[k]).length, t('modules_label')) +
        statCard(ob, t('online_bots')) +
        statCard(allEvents.length, t('total_events')) +
        '</div></div>';

    let aH = ''; Object.entries(ad).forEach(([n, i]) => {
        const on = i.status === 'started';
        aH += '<div class="list-row">' + adapterLogoImg(n, 20) + '<span class="chip ' + (on ? 'chip-ok' : 'chip-er') + '" style="min-width:60px;justify-content:center">' + esc(i.status) + '</span><span style="flex:1;font-weight:500">' + esc(n) + '</span><span style="font-size:12px;color:var(--tx-s)">' + Object.keys(i.bots || {}).length + ' bots</span></div>';
    });
    document.getElementById('dashAdapters').innerHTML = aH || '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' + t('no_adapters') + '</div>';

    let mH = ''; Object.entries(mo).forEach(([n, l]) => {
        mH += '<div class="list-row"><span class="chip ' + (l ? 'chip-ok' : 'chip-er') + '" style="min-width:60px;justify-content:center">' + (l ? t('active') : t('inactive')) + '</span><span style="flex:1;font-weight:500">' + esc(n) + '</span></div>';
    });
    document.getElementById('dashModules').innerHTML = mH || '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' + t('no_modules') + '</div>';

    platforms = Object.keys(ad);
}

function statCard(v, label) {
    return '<div class="stat-card"><div class="stat-val">' + v + '</div><div class="stat-label">' + esc(label) + '</div></div>';
}

async function loadEvents() {
    const tf = document.getElementById('eTypeFilter')?.value || '';
    const pf = document.getElementById('ePlatFilter')?.value || '';
    const limit = getSetting('event_limit', '100');
    const u = new URLSearchParams({ limit }); if (tf) u.set('type', tf); if (pf) u.set('platform', pf);
    const d = await api('/api/events?' + u); if (!d) return;
    allEvents = d.events || [];
    document.getElementById('eventList').innerHTML = allEvents.length ? allEvents.slice().reverse().map(evHtml).join('') : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg><p>' + t('no_events') + '</p></div>';
    document.getElementById('dashEvents').innerHTML = allEvents.slice(-20).reverse().map(evHtml).join('') || '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' + t('waiting_events') + '</div>';
    const ps = document.getElementById('ePlatFilter');
    if (ps && platforms.length) {
        const ex = new Set([...ps.options].map(o => o.value));
        platforms.forEach(p => { if (!ex.has(p)) { const o = document.createElement('option'); o.value = p; o.textContent = p; ps.appendChild(o) } });
    }
}

async function clearEvents() {
    if (!authed) return showLogin();
    const ok = await confirm2(t('clear_events'), t('clear_confirm')); if (!ok) return;
    await api('/api/events/clear', { method: 'POST' });
    allEvents = []; loadEvents();
}

async function loadBots() {
    const d = await api('/api/bots'); if (!d) return;
    const b = d.bots || [];
    document.getElementById('botGrid').innerHTML = b.length ? b.map(x => {
        const i = x.info || {}, nm = i.user_name || i.nickname || x.bot_id, av = i.avatar;
        const la = x.last_active ? new Date(x.last_active * 1000).toLocaleString(getLocale()) : 'Never';
        const on = x.status === 'online';
        const logoSrc = getAdapterLogo(x.platform);
        const useLogo = !av && logoSrc;
        const avCls = useLogo ? 'bot-avatar has-logo' : 'bot-avatar';
        let avatarHtml;
        if (av) {
            avatarHtml = '<img src="' + esc(av) + '" data-logo="' + (logoSrc ? esc(logoSrc) : '') + '" onerror="_botAvatarFallback(this)">';
        } else if (logoSrc) {
            avatarHtml = '<img src="' + esc(logoSrc) + '" onerror="_botAvatarFallback(this)">';
        } else {
            avatarHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>';
        }
        return '<div class="bot-card" data-bot-status="' + (on ? 'online' : 'offline') + '"><div class="' + avCls + '">' + avatarHtml + '</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">' + esc(nm) + '</div><div style="font-size:12px;color:var(--tx-s);margin-top:2px">' + esc(x.platform) + ' / ' + esc(x.bot_id) + '</div></div><div style="text-align:right;flex-shrink:0"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><span class="dot" style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:' + (on ? 'var(--ok-c)' : 'var(--tx-t)') + '"></span><span style="font-size:12px;font-weight:500;color:' + (on ? 'var(--ok-c)' : 'var(--tx-s)') + '">' + (on ? t('online') : t('offline')) + '</span></div><div style="font-size:11px;color:var(--tx-t);margin-top:4px">' + esc(la) + '</div></div></div>';
    }).join('') : '<div class="empty-state" style="grid-column:span 3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg><h3>' + t('no_bots') + '</h3></div>';
}

async function loadModules() {
    const d = await api('/api/modules'); if (!d) return;
    const items = d.modules || [];
    const adapters = items.filter(m => m.type === 'adapter');
    const modules = items.filter(m => m.type === 'module');
    document.getElementById('adapterCount').textContent = adapters.length;
    document.getElementById('moduleCount').textContent = modules.length;
    document.getElementById('adapterList').innerHTML = adapters.length ? adapters.map(m => renderPluginRow(m, true)).join('') : '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' + t('no_adapters') + '</div>';
    document.getElementById('moduleList').innerHTML = modules.length ? modules.map(m => renderPluginRow(m, false)).join('') : '<div style="padding:16px 18px;font-size:13px;color:var(--tx-s)">' + t('no_modules') + '</div>';
}
function renderPluginRow(m, isAd) {
    let statusDot = '', statusText = '', statusClass = '';
    if (m.loaded) { statusDot = 'loaded'; statusText = t('active'); statusClass = 'chip-ok'; }
    else if (m.enabled) { statusDot = 'enabled'; statusText = t('module_enabled_not_loaded'); statusClass = 'chip-wr'; }
    else { statusDot = 'disabled'; statusText = t('module_disabled'); statusClass = 'chip-er'; }

    let meta = '';
    if (m.version) meta += '<span>' + t('module_version') + ': ' + esc(m.version) + '</span>';
    if (m.author) meta += '<span>' + t('module_author') + ': ' + esc(m.author) + '</span>';
    if (!meta && m.description) meta = '<span>' + esc(m.description) + '</span>';
    if (!meta) meta = '<span>' + t('module_no_desc') + '</span>';

    let acts = '';
    if (m.loaded) {
        if (!isAd) acts += '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'reload\',\'' + esc(m.type) + '\')">' + t('reload') + '</button> ';
        acts += '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'unload\',\'' + esc(m.type) + '\')">' + t('unload') + '</button> ';
    } else if (m.enabled) {
        acts += '<button class="btn btn-primary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'load\',\'' + esc(m.type) + '\')">' + t('load') + '</button> ';
    }
    if (m.enabled) {
        acts += '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'disable\',\'' + esc(m.type) + '\')">' + t('disable_module') + '</button> ';
    } else {
        acts += '<button class="btn btn-primary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'enable\',\'' + esc(m.type) + '\')">' + t('enable_module') + '</button> ';
    }
    if (!isAd && m.package) {
        acts += '<button class="btn btn-danger btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'uninstall\',\'' + esc(m.type) + '\',\'' + esc(m.package) + '\')">' + t('uninstall_module') + '</button> ';
    }

    const adLogo = isAd ? adapterLogoImg(m.name, 20) : '';
    return '<div class="module-row"><span class="module-status-dot ' + statusDot + '"></span>' + adLogo + '<div class="module-info"><div class="module-name">' + esc(m.name) + '</div><div class="module-meta">' + meta + '</div></div><div class="module-actions">' + acts + '</div></div>';
}
async function moduleAction(name, action, type, pkg) {
    if (!authed) return showLogin();
    if (action === 'unload' && name === 'Dashboard') {
        const ok = await confirm2(t('unload_self_title'), t('unload_self_confirm')); if (!ok) return;
    }
    if (action === 'uninstall') {
        const ok = await confirm2(t('uninstall_module'), t('uninstall_confirm') + ' <strong>' + esc(name) + '</strong>'); if (!ok) return;
    }
    const body = { name, action, type };
    if (pkg) body.package = pkg;
    const d = await api('/api/modules/action', { method: 'POST', body: JSON.stringify(body) });
    if (d && d.success) {
        if (d.task_id) {
            _installTaskIds.set(d.task_id, name);
            toast(t('module_uninstalling'), '');
        } else {
            setTimeout(loadModules, 300); toast(t('action_completed'), 'ok');
        }
    } else toast(d?.error || t('action_failed'), 'er');
}

let _storeTimer;
function debounceStore() { clearTimeout(_storeTimer); _storeTimer = setTimeout(loadStore, 300) }
const STORE_CACHE_KEY = '__ep_store__', STORE_CACHE_TTL = 4 * 3600 * 1000;
function mirrorOptionsHtml() {
    return '<option value="">PyPI (Default)</option>' +
        '<option value="https://pypi.tuna.tsinghua.edu.cn/simple">Tsinghua</option>' +
        '<option value="https://mirrors.aliyun.com/pypi/simple/">Aliyun</option>' +
        '<option value="https://pypi.doubanio.com/simple/">Douban</option>' +
        '<option value="https://repo.huaweicloud.com/repository/pypi/simple">Huawei</option>';
}
function initMirrorSelects() {
    ['uploadMirrorSelect', 'detailMirrorSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.children.length) el.innerHTML = mirrorOptionsHtml();
    });
}
async function loadStore(forceRefresh) {
    const q = document.getElementById('storeSearch')?.value?.toLowerCase() || '';
    let d = null;
    if (!forceRefresh) {
        try { const c = JSON.parse(localStorage.getItem(STORE_CACHE_KEY)); if (c && Date.now() - c.ts < STORE_CACHE_TTL) d = c.data; } catch (e) {}
    }
    if (!d) {
        d = await api('/api/store/remote');
        if (d && d.packages) localStorage.setItem(STORE_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: d }));
    }
    if (!d || !d.packages) { document.getElementById('storeGrid').innerHTML = '<div class="empty-state" style="grid-column:span 3"><p>' + t('failed_registry') + '</p></div>'; return }
    const pk = d.packages;
    const installedVersions = d.installed_versions || {};
    const all = [...Object.entries(pk.modules || {}).map(([n, i]) => ({ ...i, name: n, type: 'module' })), ...Object.entries(pk.adapters || {}).map(([n, i]) => ({ ...i, name: n, type: 'adapter' }))];
    const f = q ? all.filter(i => (i.name + i.description + i.package).toLowerCase().includes(q)) : all;
    document.getElementById('storeGrid').innerHTML = f.length ? f.map(i => {
        const pkgLower = (i.package || '').toLowerCase();
        const installedVer = installedVersions[pkgLower] || '';
        const isInstalled = !!installedVer;
        const hasUpdate = isInstalled && cmpVer(i.version, installedVer) > 0;
        let statusBadge = '';
        let actionBtn = '';
        if (hasUpdate) {
            statusBadge = '<span class="chip chip-wr" style="margin-left:4px;font-size:10px">' + t('store_update_available') + '</span>';
            actionBtn = '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();upgradePkg(\'' + esc(i.package) + '\')">' + t('pkg_upgrade') + '</button>';
        } else if (isInstalled) {
            statusBadge = '<span class="chip chip-ok" style="margin-left:4px;font-size:10px">v' + esc(installedVer) + '</span>';
            actionBtn = '<span style="font-size:12px;color:var(--ok-c);font-weight:500">' + t('active') + '</span>';
        } else {
            actionBtn = '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();installPkg(\'' + esc(i.package) + '\')">' + t('install') + '</button>';
        }
        return '<div class="store-card' + (hasUpdate ? ' store-card-update' : '') + '" onclick="openPkgDetail(\'' + esc(i.name) + '\',\'' + esc(i.package) + '\',\'' + esc(i.type) + '\')"><div style="display:flex;align-items:center;gap:8px"><input type="checkbox" class="store-card-check" data-pkg="' + esc(i.package) + '" onclick="event.stopPropagation();updateBatchBar()"><span style="font-size:14px;font-weight:600">' + esc(i.name) + '</span><span class="chip chip-pr">' + esc(i.type) + '</span>' + statusBadge + '</div><div style="font-size:12px;color:var(--tx-t);font-family:Consolas,Monaco,monospace">' + esc(i.package) + '</div><div style="font-size:13px;color:var(--tx-s);line-height:1.4;margin-top:4px">' + esc(i.description || '-') + '</div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><span style="font-size:12px;color:var(--tx-s);font-weight:500">v' + esc(i.version || '?') + (hasUpdate ? ' <span style="color:var(--wr-c);font-weight:600">&larr;</span> ' + t('store_version_current') + ' v' + esc(installedVer) : '') + '</span><div style="display:flex;align-items:center;gap:6px">' + actionBtn + '<button class="store-card-detail-btn" onclick="event.stopPropagation();openPkgDetail(\'' + esc(i.name) + '\',\'' + esc(i.package) + '\',\'' + esc(i.type) + '\')" title="' + t('view_detail') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button></div></div></div>';
    }).join('') : '<div class="empty-state" style="grid-column:span 3"><p>' + t('no_packages') + '</p></div>';
}
let _installTaskIds = new Map();
function showInstallConfirm(pkg, isBatch) {
    return new Promise(r => {
        const ov = document.getElementById('modalOv');
        document.getElementById('modalTitle').textContent = t('install');
        const label = isBatch ? esc(pkg) : 'Install <strong>' + esc(pkg) + '</strong>?';
        document.getElementById('modalText').innerHTML = label +
            '<div class="install-confirm-options">' +
            '<div class="install-confirm-option"><div><div class="install-confirm-option-label">' + t('force_install') + '</div><div style="font-size:11px;color:var(--tx-t)">' + t('force_install_desc') + '</div></div><label class="switch"><input type="checkbox" id="installConfirmForce"><span class="switch-slider"></span></label></div>' +
            '<div class="install-confirm-option"><div class="install-confirm-option-label">' + t('pip_mirror') + '</div><select class="upload-select" id="installConfirmMirror" style="width:160px">' + mirrorOptionsHtml() + '</select></div>' +
            '</div>';
        const ac = document.getElementById('modalActions'); ac.innerHTML = '';
        const b1 = document.createElement('button'); b1.className = 'btn btn-secondary'; b1.textContent = t('cancel'); b1.onclick = () => { ov.classList.remove('show'); r(null) };
        const b2 = document.createElement('button'); b2.className = 'btn btn-primary'; b2.textContent = t('install'); b2.onclick = () => {
            const force = document.getElementById('installConfirmForce')?.checked || false;
            const mirror = document.getElementById('installConfirmMirror')?.value || '';
            ov.classList.remove('show'); r({ force, index_url: mirror });
        };
        ac.append(b1, b2);
        ov.classList.add('show');
    });
}
async function installPkg(pkg) {
    if (!authed) return showLogin();
    const opts = await showInstallConfirm(pkg); if (!opts) return;
    const body = { packages: [pkg] };
    if (opts.force) body.force = true;
    if (opts.index_url) body.index_url = opts.index_url;
    const d = await api('/api/store/install', { method: 'POST', body: JSON.stringify(body) });
    if (d && d.success && d.task_id) {
        _installTaskIds.set(d.task_id, pkg);
        toast(t('installing'), '');
    } else {
        toast(t('install_failed'), 'er');
    }
}

// ========== 上传安装模态窗 ==========
let _uploadState = { file: null, taskId: null, uploaded: false };
function openUploadModal() {
    if (!authed) return showLogin();
    _uploadState = { file: null, taskId: null, uploaded: false };
    initMirrorSelects();
    const ov = document.getElementById('uploadOv');
    document.getElementById('uploadProgressSection').style.display = 'none';
    document.getElementById('uploadProgressFill').style.width = '0%';
    document.getElementById('uploadProgressText').textContent = '0%';
    document.getElementById('uploadFileInfo').textContent = '';
    document.getElementById('uploadInstallBtn').disabled = true;
    document.getElementById('uploadForceInstall').checked = false;
    const ms = document.getElementById('uploadMirrorSelect');
    if (ms) ms.value = '';
    document.getElementById('uploadDropZone').classList.remove('drag-over');
    ov.classList.add('show');
}
function closeUploadModal() { document.getElementById('uploadOv').classList.remove('show') }
function handleUploadDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over') }
function handleUploadDragLeave(e) { e.currentTarget.classList.remove('drag-over') }
function handleUploadDrop(e) {
    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processUploadFile(file);
}
function handleUploadFileSelect(input) {
    const file = input.files && input.files[0];
    if (file) processUploadFile(file);
    input.value = '';
}
function processUploadFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'whl' && ext !== 'zip') { toast(t('upload_failed'), 'er'); return }
    if (file.size > 50 * 1024 * 1024) { toast(t('upload_file_too_large'), 'er'); return }
    _uploadState.file = file;
    _uploadState.uploaded = false;
    document.getElementById('uploadFileInfo').textContent = file.name + ' (' + formatFileSize(file.size) + ')';
    doUpload(file);
}
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
}
function doUpload(file) {
    const fd = new FormData();
    fd.append('file', file);
    const force = document.getElementById('uploadForceInstall').checked;
    const mirror = document.getElementById('uploadMirrorSelect')?.value || '';
    if (force) fd.append('force', 'true');
    if (mirror) fd.append('index_url', mirror);
    const xhr = new XMLHttpRequest();
    document.getElementById('uploadProgressSection').style.display = 'flex';
    document.getElementById('uploadInstallBtn').disabled = true;
    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const pct = Math.round(e.loaded / e.total * 100);
            document.getElementById('uploadProgressFill').style.width = pct + '%';
            document.getElementById('uploadProgressText').textContent = pct + '%';
        }
    };
    xhr.onload = () => {
        try {
            const d = JSON.parse(xhr.responseText);
            if (d && d.success && d.task_id) {
                _uploadState.taskId = d.task_id;
                _uploadState.uploaded = true;
                _installTaskIds.set(d.task_id, file.name);
                document.getElementById('uploadProgressFill').style.width = '100%';
                document.getElementById('uploadProgressText').textContent = t('upload_complete');
                document.getElementById('uploadInstallBtn').disabled = false;
            } else {
                toast(d?.error || t('upload_failed'), 'er'); closeUploadModal();
            }
        } catch (err) { toast(t('upload_failed'), 'er'); closeUploadModal(); }
    };
    xhr.onerror = () => { toast(t('upload_failed'), 'er'); closeUploadModal() };
    xhr.open('POST', API + '/api/store/upload');
    xhr.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem(TK));
    xhr.send(fd);
}
function startUploadInstall() { closeUploadModal(); toast(t('installing'), '') }

// ========== 包详情弹窗 ==========
let _pkgDetailCache = {};
async function openPkgDetail(name, pkg, type) {
    if (!authed) return showLogin();
    initMirrorSelects();
    const ov = document.getElementById('pkgDetailOv');
    document.getElementById('pkgDetailTitle').textContent = name;
    document.getElementById('pkgDetailType').textContent = type;
    document.getElementById('pkgDetailVersion').innerHTML = '';
    document.getElementById('pkgDetailDesc').innerHTML = '<p style="color:var(--tx-t)">' + t('pkg_detail_loading') + '</p>';
    document.getElementById('pkgDetailInfoGrid').innerHTML = '';
    document.getElementById('pkgDetailDepsSection').style.display = 'none';
    document.getElementById('pkgDetailVersionsSection').style.display = 'none';
    document.getElementById('detailForceInstall').checked = false;
    const ms = document.getElementById('detailMirrorSelect');
    if (ms) ms.value = '';
    const vs = document.getElementById('detailVersionSelect');
    vs.innerHTML = '<option value="">' + t('latest_version') + '</option>';
    const ac = document.getElementById('pkgDetailActions'); ac.innerHTML = '';
    ov.classList.add('show');

    const cacheKey = pkg.toLowerCase();
    let d = _pkgDetailCache[cacheKey];
    if (!d) {
        d = await api('/api/store/package/detail?package=' + encodeURIComponent(pkg));
        if (d && !d.error) _pkgDetailCache[cacheKey] = d;
    }
    if (!d || d.error) {
        document.getElementById('pkgDetailDesc').innerHTML = '<p style="color:var(--er-c)">' + t('pkg_detail_failed') + '</p>';
        return;
    }

    let verHtml = '';
    if (d.installed_version) verHtml += '<span class="chip chip-ok" style="font-size:11px">v' + esc(d.installed_version) + ' ' + t('store_version_current') + '</span> ';
    if (d.latest_version) verHtml += '<span class="chip chip-pr" style="font-size:11px">v' + esc(d.latest_version) + ' ' + t('store_version_latest') + '</span>';
    document.getElementById('pkgDetailVersion').innerHTML = verHtml;

    const descText = d.description || d.summary || '-';
    const cleanDesc = descText.replace(/<[^>]*>/g, '').substring(0, 2000);
    document.getElementById('pkgDetailDesc').innerHTML = '<p style="white-space:pre-wrap">' + esc(cleanDesc) + '</p>';

    let infoHtml = '';
    if (d.author) infoHtml += '<dt style="color:var(--tx-t);font-weight:500">Author</dt><dd style="color:var(--tx-s);margin:0">' + esc(d.author) + '</dd>';
    if (d.license) infoHtml += '<dt style="color:var(--tx-t);font-weight:500">License</dt><dd style="color:var(--tx-s);margin:0">' + esc(d.license) + '</dd>';
    if (d.home_page) infoHtml += '<dt style="color:var(--tx-t);font-weight:500">Homepage</dt><dd style="color:var(--tx-s);margin:0"><a href="' + esc(d.home_page) + '" target="_blank" style="color:var(--accent)">' + esc(d.home_page) + '</a></dd>';
    if (infoHtml) document.getElementById('pkgDetailInfoGrid').innerHTML = infoHtml;

    const deps = (d.requires_dist || []).filter(dep => !dep.includes('; extra ==') && !dep.includes(':'));
    if (deps.length) {
        document.getElementById('pkgDetailDepsSection').style.display = '';
        document.getElementById('pkgDetailDeps').innerHTML = deps.map(dep => '<span class="chip" style="margin:2px;font-size:11px;padding:2px 8px">' + esc(dep) + '</span>').join('');
    }

    const versions = d.versions || [];
    if (versions.length) {
        document.getElementById('pkgDetailVersionsSection').style.display = '';
        document.getElementById('pkgDetailVersions').innerHTML = versions.slice(0, 20).map(v =>
            '<span style="display:inline-block;margin:2px 6px;cursor:pointer;color:var(--tx-s)" onclick="document.getElementById(\'detailVersionSelect\').value=\'' + esc(v) + '\'">' + esc(v) + '</span>'
        ).join('');
        vs.innerHTML = '<option value="">' + t('latest_version') + ' (' + esc(d.latest_version || '') + ')</option>' +
            versions.slice(0, 30).map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
    }

    ac.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-secondary'; closeBtn.textContent = t('cancel');
    closeBtn.onclick = () => ov.classList.remove('show');

    const actionBtn = document.createElement('button');
    actionBtn.className = 'btn btn-primary';
    if (d.installed_version && d.latest_version && cmpVer(d.latest_version, d.installed_version) > 0) {
        actionBtn.textContent = t('pkg_upgrade');
        actionBtn.onclick = () => { ov.classList.remove('show'); doInstallWithOptions(pkg, false, true) };
    } else if (!d.installed_version) {
        actionBtn.textContent = t('install');
        actionBtn.onclick = () => { ov.classList.remove('show'); doInstallWithOptions(pkg) };
    } else {
        actionBtn.textContent = t('force_install');
        actionBtn.onclick = () => { ov.classList.remove('show'); doInstallWithOptions(pkg, true) };
    }
    ac.append(closeBtn, actionBtn);
}
function closePkgDetail() { document.getElementById('pkgDetailOv').classList.remove('show') }
async function doInstallWithOptions(pkg, defaultForce, isUpgrade) {
    const force = defaultForce !== undefined ? defaultForce : document.getElementById('detailForceInstall')?.checked || false;
    const mirror = document.getElementById('detailMirrorSelect')?.value || '';
    const version = document.getElementById('detailVersionSelect')?.value || '';
    const pkgSpec = version ? pkg + '==' + version : pkg;
    const body = { packages: [pkgSpec] };
    if (force) body.force = true;
    if (mirror) body.index_url = mirror;
    if (isUpgrade) {
        const d = await api('/api/packages/upgrade', { method: 'POST', body: JSON.stringify({ packages: [pkgSpec], index_url: mirror || undefined }) });
        if (d && d.success && d.task_id) { _installTaskIds.set(d.task_id, pkg); toast(t('installing'), '') }
        else toast(t('install_failed'), 'er');
    } else {
        const d = await api('/api/store/install', { method: 'POST', body: JSON.stringify(body) });
        if (d && d.success && d.task_id) { _installTaskIds.set(d.task_id, pkg); toast(t('installing'), '') }
        else toast(t('install_failed'), 'er');
    }
}

// ========== 批量安装 ==========
function updateBatchBar() {
    const checked = document.querySelectorAll('.store-card-check:checked');
    const bar = document.getElementById('storeBatchBar');
    if (checked.length > 0) {
        bar.style.display = 'flex';
        document.getElementById('storeBatchCount').textContent = t('batch_install_count').replace('{n}', checked.length);
    } else {
        bar.style.display = 'none';
    }
}
async function batchInstall() {
    if (!authed) return showLogin();
    const checked = document.querySelectorAll('.store-card-check:checked');
    const pkgs = Array.from(checked).map(c => c.dataset.pkg);
    if (!pkgs.length) return;
    const opts = await showInstallConfirm(pkgs.join(', '), true);
    if (!opts) return;
    const body = { packages: pkgs };
    if (opts.force) body.force = true;
    if (opts.index_url) body.index_url = opts.index_url;
    const d = await api('/api/store/install', { method: 'POST', body: JSON.stringify(body) });
    if (d && d.success && d.task_id) {
        _installTaskIds.set(d.task_id, pkgs.join(', '));
        toast(t('installing'), '');
    } else {
        toast(t('install_failed'), 'er');
    }
    document.querySelectorAll('.store-card-check').forEach(c => c.checked = false);
    updateBatchBar();
}
async function restartFramework() {
    if (!authed) return showLogin();
    const ok = await confirm2(t('restart'), t('restart_confirm')); if (!ok) return;
    toast(t('restart_success'), '');
    const d = await api('/api/restart', { method: 'POST' });
    if (!d || !d.success) { toast(t('restart_failed'), 'er') }
}

async function loadConfig() {
    const c = await api('/api/config');
    if (c && c.config) { 
        window._kvData = c.config; 
        document.getElementById('configBodyTree').innerHTML = kvTree(c.config, 'config', ''); 
    }
    const s = await api('/api/storage');
    if (s) {
        document.getElementById('storageCount').textContent = (s.total || 0) + ' ' + t('store');
        const k = s.keys || [];
        document.getElementById('storageBody').innerHTML = k.length ? k.slice(0, 200).map(x => kvRow(esc(x), s.data[x], 'storage', x)).join('') : '<div class="empty-state"><p>' + t('empty_storage') + '</p></div>';
    }
    
    // 如果在源码视图，也加载源码
    if (document.getElementById('configBodySource').style.display !== 'none') {
        await loadConfigSource();
    }
}

async function loadConfigSource() {
    const d = await api('/api/config/source');
    if (d && d.content) {
        const editor = document.getElementById('configSourceEditor');
        if (editor) {
            editor.value = d.content;
        }
    } else {
        toast(t('config_load_failed'), 'er');
    }
}

async function saveConfigSource() {
    const editor = document.getElementById('configSourceEditor');
    if (!editor) return;
    
    const content = editor.value;
    
    const d = await api('/api/config/source', {
        method: 'POST',
        body: JSON.stringify({ content })
    });
    
    if (d && d.success) {
        toast(t('config_saved'), 'ok');
        loadConfig();
    } else {
        toast(t('save_failed') + ': ' + (d?.error || t('unknown_error')), 'er');
    }
}

function switchConfigView(view, btn) {
    document.querySelectorAll('#p-config .view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const treeView = document.getElementById('configBodyTree');
    const sourceView = document.getElementById('configBodySource');
    if (view === 'tree') {
        treeView.style.display = 'block';
        sourceView.style.display = 'none';
    } else {
        treeView.style.display = 'none';
        sourceView.style.display = 'block';
        loadConfigSource();
    }
}

function getSetting(key, def) {
    const v = localStorage.getItem('ep_setting_' + key);
    return v !== null ? v : def;
}
function setSetting(key, val) {
    localStorage.setItem('ep_setting_' + key, val);
}

function showSettings() {
    closeSidebar();
    document.getElementById('settingsTheme').checked = getTheme() === 'dark';
    document.getElementById('settingsUiStyle').value = getUiStyle();
    document.getElementById('settingsLang').value = lang;
    document.getElementById('settingsSidebar').checked = document.getElementById('sidebar').classList.contains('collapsed');
    document.getElementById('settingsRefresh').value = getSetting('refresh_interval', '5000');
    document.getElementById('settingsEventLimit').value = getSetting('event_limit', '100');
    document.getElementById('settingsPanel').classList.add('open');
    document.getElementById('settingsBackdrop').classList.add('show');
}
function closeSettings() {
    document.getElementById('settingsPanel').classList.remove('open');
    document.getElementById('settingsBackdrop').classList.remove('show');
}

function applySettingTheme(dark) {
    const th = dark ? 'dark' : 'light';
    localStorage.setItem('ep_theme', th);
    applyTheme(th);
}
function applySettingLang(v) {
    lang = v;
    localStorage.setItem('ep_lang', lang);
    applyI18n(); loadAll();
}
function applySettingSidebar(collapsed) {
    document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
    localStorage.setItem('ep_sidebar_collapsed', collapsed);
}
function applySettingRefresh(val) {
    setSetting('refresh_interval', val);
    restartRefreshTimer();
}
function applySettingEventLimit(val) {
    setSetting('event_limit', val);
}

let _refreshTimer = null;
function restartRefreshTimer() {
    if (_refreshTimer) clearInterval(_refreshTimer);
    const interval = parseInt(getSetting('refresh_interval', '5000'));
    if (interval > 0 && authed) {
        _refreshTimer = setInterval(refreshDashboard, interval);
    }
}

function toggleSidebarCollapse() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    localStorage.setItem('ep_sidebar_collapsed', sb.classList.contains('collapsed'));
    document.getElementById('settingsSidebar').checked = sb.classList.contains('collapsed');
}

function kvRow(k, v, mode, fk) {
    const tp = v === null ? 'null' : typeof v;
    const ds = tp === 'object' ? JSON.stringify(v) : String(v);
    const isMultiline = ds.includes('\n') || ds.length > 100;
    const saveFn = mode === 'config' ? 'saveConfig(this)' : 'saveStorage(this)';
    
    // 只允许编辑子项属性，不允许定义根值
    const isRootLevel = fk && !fk.includes('.');
    const canEdit = mode === 'config' ? !isRootLevel : true;
    
    const inputHtml = isMultiline 
        ? `<textarea class="kv-input kv-textarea" data-key="${esc(fk)}" data-type="${tp}" 
                 rows="3" onfocus="this.select()" 
                 onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();${saveFn}}">${esc(ds)}</textarea>`
        : `<input class="kv-input" type="text" value="${esc(ds)}" data-key="${esc(fk)}" data-type="${tp}" 
                 ${canEdit ? '' : 'readonly'} onfocus="this.select()" 
                 onkeydown="if(event.key==='Enter'){event.preventDefault();${saveFn}}">`;
    
    const delBtn = mode === 'storage' ? `<button class="kv-btn kv-btn-del" onclick="delStorage('${esc(fk)}',this)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>` : '';
    
    const readOnlyIndicator = !canEdit ? '<span style="font-size:11px;color:var(--wr-c);margin-left:8px">' + t('read_only') + '</span>' : '';
    
    return `<div class="kv-row"><div class="kv-key">${esc(k)}</div><div class="kv-actions">${inputHtml}<button class="kv-btn kv-btn-save" onclick="${saveFn}" title="Save" ${!canEdit ? 'style="display:none"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>${delBtn}${readOnlyIndicator}</div></div>`;
}

function kvTree(obj, mode, pfx, dep) {
    dep = dep || 0; let h = '';
    for (const [k, v] of Object.entries(obj)) {
        const fk = pfx ? pfx + '.' + k : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            h += '<div class="kv-group collapsed" style="margin-left:' + dep * 12 + 'px" data-pfx="' + esc(fk) + '" data-mode="' + mode + '" data-dep="' + (dep + 1) + '"><div class="kv-group-hd" onclick="toggleKvGroup(this)"><span class="kv-chevron">\u25BC</span><span style="flex:1">' + esc(k) + '</span><span class="kv-count">' + Object.keys(v).length + '</span></div><div class="kv-group-body"></div></div>';
        } else {
            h += '<div style="margin-left:' + dep * 12 + 'px">' + kvRow(k, v, mode, fk) + '</div>';
        }
    }
    return h;
}

function toggleKvGroup(hd) {
    const g = hd.parentElement;
    const body = g.querySelector('.kv-group-body');
    if (g.classList.contains('collapsed')) {
        if (!body.innerHTML) {
            const obj = window._kvData;
            function find(d, t) { const keys = t.split('.'); let cur = d; for (const k of keys) { if (cur == null || typeof cur !== 'object') return null; cur = cur[k] } return cur }
            const data = find(obj, g.dataset.pfx);
            if (data && typeof data === 'object') body.innerHTML = kvTree(data, g.dataset.mode, g.dataset.pfx, parseInt(g.dataset.dep));
        }
        g.classList.remove('collapsed');
    } else {
        g.classList.add('collapsed');
    }
}

async function saveConfig(btn) {
    const inp = btn.previousElementSibling; const fk = inp.dataset.key; const tp = inp.dataset.type;
    let v = inp.value;
    if (tp === 'boolean') v = v === 'true'; else if (tp === 'number') v = Number(v); else if (tp === 'object') { try { v = JSON.parse(v) } catch (e) { return } }
    const d = await api('/api/config', { method: 'PUT', body: JSON.stringify({ key: fk, value: v }) });
    inp.style.border = d && d.success ? '2px solid var(--ok-c)' : '2px solid var(--er-c)';
    setTimeout(() => inp.style.border = '', 1200);
}
async function saveStorage(btn) {
    const inp = btn.previousElementSibling; const k = inp.dataset.key; let v = inp.value;
    try { v = JSON.parse(v) } catch (e) { }
    const d = await api('/api/storage', { method: 'POST', body: JSON.stringify({ key: k, value: v }) });
    inp.style.border = d && d.success ? '2px solid var(--ok-c)' : '2px solid var(--er-c)';
    setTimeout(() => inp.style.border = '', 1200);
}
async function delStorage(k, btn) {
    const row = btn.closest('.kv-row'); row.style.opacity = '.3';
    const d = await api('/api/storage/delete', { method: 'POST', body: JSON.stringify({ key: k }) });
    if (d && d.success) { row.style.transition = 'all .2s'; requestAnimationFrame(() => { row.style.maxHeight = '0'; row.style.padding = '0'; row.style.overflow = 'hidden'; row.style.borderWidth = '0'; setTimeout(() => row.remove(), 200) }) }
    else row.style.opacity = '1';
}

function wsConnect() {
    const p = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const u = p + '//' + location.host + API + '/ws?token=' + encodeURIComponent(localStorage.getItem(TK) || '');
    ws = new WebSocket(u);
    ws.onopen = () => { connStateChange(1, true) };
    ws.onclose = () => { connStateChange(0, true); setTimeout(wsConnect, 3000) };
    ws.onerror = () => ws.close();
    ws.onmessage = e => {
        try {
            const m = JSON.parse(e.data);
            if (m.type === 'event') {
                allEvents.push(m.data); if (allEvents.length > 500) allEvents.shift();
                const sv = document.getElementById('statGrid');
                const statCards = sv?.querySelectorAll('.stat-val');
                if (statCards && statCards[3]) statCards[3].textContent = allEvents.length;
                if (document.querySelector('.page.active')?.id === 'p-dashboard') {
                    const dh = document.getElementById('dashEvents'); const em = dh?.querySelector('.empty-state');
                    if (em) em.remove(); dh?.insertAdjacentHTML('afterbegin', evHtml(m.data));
                    while (dh && dh.children.length > 20) dh.removeChild(dh.lastChild);
                }
            } else if (m.type === 'install_progress') {
                const pkg = _installTaskIds.get(m.task_id) || (m.packages ? m.packages.join(', ') : '');
                if (m.status === 'running') {
                    addOrUpdateTask(m.task_id, pkg, 'running', m.output || []);
                } else if (m.status === 'success') {
                    _installTaskIds.delete(m.task_id);
                    addOrUpdateTask(m.task_id, pkg, 'success', m.output || []);
                    loadModules();
                    loadPackages(true);
                } else if (m.status === 'error') {
                    _installTaskIds.delete(m.task_id);
                    addOrUpdateTask(m.task_id, pkg, 'error', m.output || [], m.message || t('install_failed'));
                }
            } else if (m.type === 'module_changed') {
                if (m.data && m.data.action === 'installed') {
                    toast(m.data.name + ': ' + t('module_loaded_dynamic'), 'ok');
                }
                if (m.data && m.data.action === 'upgraded') {
                    toast(t('pkg_upgrade_success'), 'ok');
                    loadPackages(true);
                }
                loadModules();
            }
        } catch (err) { }
    };
}

function loadAll() { initMirrorSelects(); initHeaderStatusIcon(); fetchAdapterLogos(); refreshDashboard(); loadEvents(); loadBots(); loadModules(); loadConfig(); loadStore(); loadMessageStats(); loadAuditLog(); loadPerformance(); loadPackages(); loadPackageUpdates(); restartRefreshTimer() }

// ========== 事件构建器相关 ==========

let builderState = {
    eventType: 'message',
    detailType: '',
    platform: '',
    botId: '',
    customPlatform: false,
    customBot: false,
    messageSegments: [],
    optionalFields: []
};

const EVENT_TYPES = {
    message: {
        detail_types: ['private', 'group', 'channel', 'guild', 'thread', 'user'],
        required_fields: ['message', 'alt_message', 'user_id'],
        optional_fields: ['group_id', 'channel_id', 'guild_id', 'user_nickname', 'message_id']
    },
    notice: {
        detail_types: ['friend_increase', 'friend_decrease', 'group_member_increase', 'group_member_decrease'],
        required_fields: ['user_id'],
        optional_fields: ['user_nickname', 'group_id', 'operator_id', 'operator_nickname']
    },
    request: {
        detail_types: ['friend', 'group'],
        required_fields: ['user_id', 'comment'],
        optional_fields: ['user_nickname', 'group_id']
    },
    meta: {
        detail_types: ['connect', 'disconnect', 'heartbeat'],
        required_fields: [],
        optional_fields: []
    }
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
    const d = await api('/api/adapters');
    if (!d) return;
    
    const platforms = d.adapters || [];
    const select = document.getElementById('platformSelect');
    select.innerHTML = '<option value="">' + t('select_platform') + '</option>';
    
    platforms.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.platform;
        opt.textContent = p.platform;
        select.appendChild(opt);
    });
}

async function loadBotsForPlatform(platform) {
    const select = document.getElementById('botSelect');
    select.innerHTML = '<option value="">' + t('select_bot') + '</option>';
    
    if (!platform) return;
    
    const bots = await api('/api/bots');
    if (bots && bots.bots) {
        const platformBots = bots.bots.filter(b => b.platform === platform);
        platformBots.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.bot_id;
            opt.textContent = b.bot_id + (b.info?.user_name ? ` (${b.info.user_name})` : '') + ' (' + t('online') + ')';
            select.appendChild(opt);
        });
    }
}

function selectEventType(type) {
    builderState.eventType = type;
    
    // 更新按钮状态
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) btn.classList.add('active');
    });
    
    // 更新详情类型选项
    updateDetailTypeOptions();
    
    // 更新必填字段显示
    updateRequiredFields();
    
    // 更新消息构建器显示
    const msgCard = document.getElementById('messageBuilderCard');
    if (msgCard) {
        msgCard.style.display = type === 'message' ? 'block' : 'none';
    }
    
    updateEventPreview();
}

function updateDetailTypeOptions() {
    const select = document.getElementById('detailType');
    const types = EVENT_TYPES[builderState.eventType]?.detail_types || [];
    
    select.innerHTML = '<option value="">' + t('select_detail_type') + '</option>';
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        select.appendChild(opt);
    });
}

function onDetailTypeChange() {
    builderState.detailType = document.getElementById('detailType').value;
    updateEventPreview();
}

function onPlatformChange() {
    const select = document.getElementById('platformSelect');
    builderState.platform = select.value;
    builderState.customPlatform = false;
    loadBotsForPlatform(builderState.platform);
    updateEventPreview();
}

function onBotChange() {
    const select = document.getElementById('botSelect');
    builderState.botId = select.value;
    builderState.customBot = false;
    updateEventPreview();
}

function toggleCustomPlatform() {
    const group = document.getElementById('customPlatformGroup');
    const select = document.getElementById('platformSelect');
    
    builderState.customPlatform = !builderState.customPlatform;
    group.style.display = builderState.customPlatform ? 'block' : 'none';
    select.disabled = builderState.customPlatform;
    
    if (builderState.customPlatform) {
        builderState.platform = '';
    }
    
    updateEventPreview();
}

function toggleCustomBot() {
    const group = document.getElementById('customBotGroup');
    const select = document.getElementById('botSelect');
    
    builderState.customBot = !builderState.customBot;
    group.style.display = builderState.customBot ? 'block' : 'none';
    select.disabled = builderState.customBot;
    
    if (builderState.customBot) {
        builderState.botId = '';
    }
    
    updateEventPreview();
}

function updateRequiredFields() {
    // 根据事件类型显示不同的必填字段
    const container = document.getElementById('optionalFields');
    container.innerHTML = '';
    
    if (builderState.eventType === 'message') {
        addOptionalField('user_id', 'User ID', '');
        addOptionalField('alt_message', '', t('alt_message'));
    } else if (builderState.eventType === 'notice') {
        addOptionalField('user_id', 'User ID', '');
    } else if (builderState.eventType === 'request') {
        addOptionalField('user_id', 'User ID', '');
        addOptionalField('comment', '', t('request_comment'));
    }
}

function addOptionalField(key = '', value = '', label = '') {
    const container = document.getElementById('optionalFields');
    
    const div = document.createElement('div');
    div.className = 'optional-field';
    div.innerHTML = `
        <input type="text" placeholder="${t('field_name_placeholder')}" value="${esc(key)}" onchange="updateOptionalFieldKey(this)">
        <input type="text" placeholder="${t('field_value_placeholder')}" value="${esc(value)}" onchange="updateOptionalFieldValue(this)"${label ? ' data-label="' + esc(label) + '"' : ''}>
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

function updateOptionalFieldKey(input) {
    updateEventPreview();
}

function updateOptionalFieldValue(input) {
    updateEventPreview();
}

function removeOptionalField(btn) {
    btn.closest('.optional-field').remove();
    updateEventPreview();
}

async function loadMessageSegmentTypes() {
    const d = await api('/api/builder/segments');
    if (!d) return;
    
    window.messageSegmentTypes = d;
}

function addMessageSegment() {
    if (!window.messageSegmentTypes) {
        toast(t('load_segments_first'), 'er');
        return;
    }
    
    const types = window.messageSegmentTypes.standard_segments || [];
    
    if (types.length === 0) return;
    
    const container = document.getElementById('messageSegments');
    const segment = {
        type: types[0].type,
        fields: {}
    };
    
    const div = document.createElement('div');
    div.className = 'message-segment';
    
    let fieldsHtml = '';
    types[0].fields.forEach(f => {
        fieldsHtml += `
            <input type="text" placeholder="${f.name}" 
                   data-field="${f.name}" 
                   oninput="updateMessageSegment(this)"
                   ${f.required ? 'required' : ''}>
        `;
    });
    
    div.innerHTML = `
        <select class="segment-type" onchange="changeSegmentType(this)">
            ${types.map(t => `<option value="${t.type}">${t.name}</option>`).join('')}
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
    const segmentDiv = select.closest('.message-segment');
    const index = Array.from(segmentDiv.parentElement.children).indexOf(segmentDiv);
    const type = select.value;
    
    builderState.messageSegments[index].type = type;
    builderState.messageSegments[index].fields = {};
    
    // 更新字段输入框
    const segmentType = (window.messageSegmentTypes.standard_segments || []).find(s => s.type === type);
    if (segmentType) {
        const fieldsDiv = segmentDiv.querySelector('.segment-fields');
        let fieldsHtml = '';
        segmentType.fields.forEach(f => {
            fieldsHtml += `
                <input type="text" placeholder="${f.name}" 
                       data-field="${f.name}" 
                       oninput="updateMessageSegment(this)"
                       ${f.required ? 'required' : ''}>
            `;
        });
        fieldsDiv.innerHTML = fieldsHtml;
    }
    
    updateEventPreview();
}

function updateMessageSegment(input) {
    const segmentDiv = input.closest('.message-segment');
    const index = Array.from(segmentDiv.parentElement.children).indexOf(segmentDiv);
    const fieldName = input.dataset.field;
    const value = input.value;
    
    builderState.messageSegments[index].fields[fieldName] = value;
    updateEventPreview();
}

function removeMessageSegment(btn) {
    const segmentDiv = btn.closest('.message-segment');
    const index = Array.from(segmentDiv.parentElement.children).indexOf(segmentDiv);
    
    segmentDiv.remove();
    builderState.messageSegments.splice(index, 1);
    updateEventPreview();
}

function buildEventData() {
    const platform = builderState.customPlatform 
        ? document.getElementById('platformCustom').value 
        : builderState.platform;
    
    const botId = builderState.customBot 
        ? document.getElementById('botCustom').value 
        : builderState.botId;
    
    const event = {
        id: 'builder_' + Date.now(),
        time: Math.floor(Date.now() / 1000),
        type: builderState.eventType,
        detail_type: builderState.detailType,
        platform: platform,
        self: {
            platform: platform,
            user_id: botId
        }
    };
    
    // 添加消息段
    if (builderState.eventType === 'message') {
        event.message = builderState.messageSegments.map(seg => ({
            type: seg.type,
            data: seg.fields
        }));
        
        // 从 alt_message 字段获取
        const altMsgField = document.querySelector('.optional-field input[data-label="alt_message"]');
        event.alt_message = altMsgField ? altMsgField.value : '';
    }
    
    // 添加附加字段
    const optionalFields = document.querySelectorAll('.optional-field');
    optionalFields.forEach(field => {
        const inputs = field.querySelectorAll('input');
        if (inputs.length >= 2) {
            const key = inputs[0].value.trim();
            const value = inputs[1].value.trim();
            if (key && value) {
                event[key] = value;
            }
        }
    });
    
    // 添加会话信息
    const sessionType = document.getElementById('sessionType').value;
    const sessionId = document.getElementById('sessionId').value;
    
    if (sessionType === 'private') {
        event.user_id = event.user_id || sessionId;
    } else if (sessionType === 'group') {
        event.group_id = sessionId;
    } else if (sessionType === 'channel') {
        event.channel_id = sessionId;
    }
    
    return event;
}

function updateEventPreview() {
    const event = buildEventData();
    const preview = document.getElementById('eventJsonPreview');
    if (preview) {
        preview.textContent = JSON.stringify(event, null, 2);
    }
}

function copyEventJson() {
    const event = buildEventData();
    const json = JSON.stringify(event, null, 2);
    
    navigator.clipboard.writeText(json).then(() => {
        toast(t('copied_to_clipboard'), 'ok');
    }).catch(() => {
        toast(t('copy_failed'), 'er');
    });
}

async function previewEvent() {
    const event = buildEventData();
    
    showOutputModal(t('event_preview'), [JSON.stringify(event, null, 2)], [
        { label: t('ok'), value: true, primary: true }
    ]);
}

async function submitEvent() {
    const event = buildEventData();
    
    const validation = await api('/api/builder/validate', {
        method: 'POST',
        body: JSON.stringify(event)
    });
    
    if (!validation || !validation.valid) {
        const errors = validation?.errors || [t('validation_failed')];
        showOutputModal(t('validate_error'), errors, [{ label: t('ok'), value: true, primary: true }]);
        return;
    }
    
    const result = await api('/api/builder/submit', {
        method: 'POST',
        body: JSON.stringify(event)
    });
    
    if (result && result.success) {
        toast(t('submit_success'), 'ok');
    } else {
        toast(t('submit_failed') + ': ' + (result?.error || t('unknown_error')), 'er');
    }
}

// 添加实时预览的监听器
document.addEventListener('DOMContentLoaded', function() {
    // 监听平台自定义输入
    const platformCustom = document.getElementById('platformCustom');
    if (platformCustom) {
        platformCustom.addEventListener('input', function() {
            builderState.platform = this.value;
            updateEventPreview();
        });
    }
    
    // 监听 Bot 自定义输入
    const botCustom = document.getElementById('botCustom');
    if (botCustom) {
        botCustom.addEventListener('input', function() {
            builderState.botId = this.value;
            updateEventPreview();
        });
    }
    
    // 监听会话类型和 ID
    const sessionType = document.getElementById('sessionType');
    const sessionId = document.getElementById('sessionId');
    if (sessionType) {
        sessionType.addEventListener('change', updateEventPreview);
    }
    if (sessionId) {
        sessionId.addEventListener('input', updateEventPreview);
    }
});

// ========== 日志功能 ==========

let _logAutoRefreshTimer = null;
let _availableModules = new Set();

let _logDebounceTimer;
function debounceLogs() { clearTimeout(_logDebounceTimer); _logDebounceTimer = setTimeout(loadLogs, 300) }

function toggleLogAutoRefresh() {
    if (_logAutoRefreshTimer) {
        clearInterval(_logAutoRefreshTimer);
        _logAutoRefreshTimer = null;
        document.getElementById('logAutoRefreshBtn').style.opacity = '0.5';
        toast(t('auto_refresh_off'), '');
    } else {
        loadLogs();
        _logAutoRefreshTimer = setInterval(loadLogs, 2000);
        document.getElementById('logAutoRefreshBtn').style.opacity = '1';
        toast(t('auto_refresh_on'), 'ok');
    }
}

async function loadLogs() {
    const moduleFilter = document.getElementById('logModuleFilter')?.value || '';
    const search = document.getElementById('logSearch')?.value || '';
    
    // 首次加载时收集所有模块
    if (_availableModules.size === 0) {
        const d = await api('/api/logs');
        if (d && d.logs) {
            d.logs.forEach(log => {
                if (log.module) {
                    _availableModules.add(log.module);
                }
            });
            // 更新模块下拉框
            updateModuleSelect();
        }
    }
    
    const params = new URLSearchParams();
    if (moduleFilter) params.set('module', moduleFilter);
    if (search) params.set('search', search);
    params.set('limit', '200');
    
    const d = await api('/api/logs?' + params);
    if (!d) return;
    
    const logs = d.logs || [];
    document.getElementById('logCount').textContent = d.total || 0;
    
    if (logs.length === 0) {
        document.getElementById('logList').innerHTML = '<div class="empty-state"><p>' + t('no_logs') + '</p></div>';
        return;
    }
    
    const logHtml = logs.map(log => {
        const moduleEsc = esc(log.module);
        const moduleTooltip = log.module.length > 15 ? `title="${esc(log.module)}"` : '';
        
        return `<div class="log-entry">
            <span class="log-time">${esc(log.timestamp)}</span>
            <span class="log-module" ${moduleTooltip}>${moduleEsc}</span>
            <span class="log-message">${esc(log.message)}</span>
        </div>`;
    }).join('');
    
    const logList = document.getElementById('logList');
    
    // 检查是否在底部附近（距离底部小于50px）
    const wasNearBottom = logList.scrollHeight - logList.scrollTop - logList.clientHeight < 50;
    
    logList.innerHTML = logHtml;
    
    // 只有当用户之前在底部附近，或者启用了自动刷新时才滚动到底部
    if (_logAutoRefreshTimer || wasNearBottom) {
        logList.scrollTop = logList.scrollHeight;
    }
}

function updateModuleSelect() {
    const select = document.getElementById('logModuleFilter');
    if (!select) return;
    
    const currentValue = select.value;
    
    // 清空并重新填充
    select.innerHTML = '<option value="">' + t('all_modules') + '</option>';
    
    const sortedModules = Array.from(_availableModules).sort();
    sortedModules.forEach(module => {
        const opt = document.createElement('option');
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
    const logList = document.getElementById('logList');
    if (!logList) return;
    
    const logs = Array.from(logList.querySelectorAll('.log-entry')).map(el => el.textContent).join('\n');
    
    navigator.clipboard.writeText(logs).then(() => {
        toast(t('copied_to_clipboard'), 'ok');
    }).catch(() => {
        toast(t('copy_failed'), 'er');
    });
}

// ========== 生命周期功能 ==========

async function loadLifecycle() {
    const d = await api('/api/lifecycle');
    if (!d) return;
    
    const events = d.events || [];
    
    if (events.length === 0) {
        document.getElementById('lifecycleTimeline').innerHTML = '<div class="empty-state"><p>' + esc(t('no_lifecycle')) + '</p></div>';
        return;
    }
    
    const timelineHtml = events.map((event) => {
        const eventParts = event.event.split('.');
        const eventType = eventParts[0] || '';
        const eventName = eventParts.slice(1).join('.');
        
        const time = new Date(event.timestamp * 1000).toLocaleTimeString();
        
        let duration = '';
        if (event.data && event.data.duration) {
            const dur = event.data.duration;
            duration = `<span class="lifecycle-duration">${dur.toFixed(2)}s</span>`;
        }
        
        return `<div class="lifecycle-item">
            <span class="lifecycle-badge ${esc(eventType)}">${esc(eventType)}</span>
            <div class="lifecycle-content">
                <div class="lifecycle-header">
                    <span class="lifecycle-event">${esc(event.event)}</span>
                    <span class="lifecycle-time">${time}</span>
                </div>
                <div class="lifecycle-details">
                    <span class="lifecycle-desc">${esc(event.msg || eventName)}</span>
                    ${duration}
                </div>
            </div>
        </div>`;
    }).join('');
    
    document.getElementById('lifecycleTimeline').innerHTML = timelineHtml;
}

// ========== 性能监控功能 ==========

async function loadPerformance() {
    const d = await api('/api/performance');
    if (!d) return;
    
    const system = d.system || {};
    const ws = d.websocket || {};
    const process = system.process || {};
    
    // 确保 memory 对象存在
    const memory = system.memory || {};
    
    // 格式化函数
    const fmt = (v, unit = '') => {
        if (v === null || v === undefined) return '--' + unit;
        if (typeof v === 'string') v = parseFloat(v) || 0;
        return v.toFixed(1) + unit;
    };
    
    // CPU
    const cpuPercent = memory.cpu_percent || 0;
    
    // 更新仪表盘上的性能卡片
    if (document.getElementById('cpuUsage')) {
        document.getElementById('cpuUsage').textContent = fmt(cpuPercent, '%');
    }
    if (document.getElementById('memUsage')) {
        document.getElementById('memUsage').textContent = fmt(memory.rss_mb, ' MB');
    }
    if (document.getElementById('sysMemUsage')) {
        document.getElementById('sysMemUsage').textContent = fmt(memory.system_percent, '%');
    }
    if (document.getElementById('rssMemVal')) {
        document.getElementById('rssMemVal').textContent = fmt(memory.rss_mb, ' MB');
    }
    
    // 更新系统详情卡片
    const setEl = (id, v, unit = '') => {
        const el = document.getElementById(id);
        if (el) el.textContent = fmt(v, unit);
    };
    
    setEl('sysTotalMem', memory.system_total_gb, ' GB');
    setEl('sysAvailMem', memory.system_available_gb, ' GB');
    setEl('swapMem', memory.swap_used_mb, ' MB');
    setEl('ioRead', process.read_bytes_mb, ' MB');
    setEl('ioWrite', process.write_bytes_mb, ' MB');
    
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

// ========== API 路由功能 ==========

async function loadApiRoutes() {
    const d = await api('/api/routes');
    if (!d) return;
    
    const httpRoutes = d.http_routes || [];
    const wsRoutes = d.ws_routes || [];
    
    document.getElementById('httpRouteCount').textContent = httpRoutes.length;
    document.getElementById('wsRouteCount').textContent = wsRoutes.length;
    
    var groups = {};
    
    httpRoutes.forEach(function(r) {
        var m = r.module || 'System';
        if (!groups[m]) groups[m] = { http: [], ws: [] };
        groups[m].http.push(r);
    });
    
    wsRoutes.forEach(function(r) {
        var m = r.module || 'System';
        if (!groups[m]) groups[m] = { http: [], ws: [] };
        groups[m].ws.push(r);
    });
    
    var moduleNames = Object.keys(groups).sort(function(a, b) {
        if (a === 'System') return 1;
        if (b === 'System') return -1;
        return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    
    var methodColor = {
        'GET': 'method-get', 'POST': 'method-post', 'PUT': 'method-put',
        'DELETE': 'method-delete', 'PATCH': 'method-patch', 'OPTIONS': 'method-options', 'HEAD': 'method-head'
    };
    
    var html = '';
    
    moduleNames.forEach(function(mod) {
        var g = groups[mod];
        var totalRoutes = g.http.length + g.ws.length;
        if (totalRoutes === 0) return;
        
        html += '<div class="card route-group-card collapsed" style="margin-bottom:12px">';
        html += '<div class="card-header" style="cursor:pointer;user-select:none" onclick="toggleRouteGroup(this)">';
        html += '<svg class="route-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;transition:transform .2s">';
        html += '<polyline points="6 9 12 15 18 9"/></svg>';
        html += '<span style="flex:1;font-size:14px">' + esc(mod) + '</span>';
        html += '<span class="chip chip-sc" style="margin:0">' + totalRoutes + ' routes</span>';
        if (g.http.length > 0) html += '<span class="chip chip-pr" style="margin:0;margin-left:4px">' + g.http.length + ' HTTP</span>';
        if (g.ws.length > 0) html += '<span class="chip chip-sc" style="margin:0;margin-left:4px">' + g.ws.length + ' WS</span>';
        html += '</div>';
        html += '<div class="route-group-body" style="display:none">';
        
        g.http.forEach(function(r) {
            var mc = methodColor[r.method] || 'method-get';
            html += '<div class="route-item">';
            html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
            html += '<span class="method-badge ' + mc + '">' + r.method + '</span>';
            html += '<code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">' + esc(r.path) + '</code>';
            html += '<div style="margin-left:auto">';
            html += '<button class="btn btn-secondary btn-xs" onclick="openRouteTest(\'' + esc(r.method) + '\',\'' + esc(r.full_path) + '\')">' + t('test') + '</button>';
            html += '</div></div></div>';
        });
        
        g.ws.forEach(function(r) {
            var authBadge = r.has_auth ? '<span class="chip chip-wr" style="margin:0">' + t('requires_auth') + '</span>' : '';
            html += '<div class="route-item">';
            html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
            html += '<span class="method-badge method-ws">WS</span>';
            html += authBadge;
            html += '<code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">' + esc(r.path) + '</code>';
            html += '</div></div>';
        });
        
        html += '</div></div>';
    });
    
    document.getElementById('routeModulesContainer').innerHTML = html || '<div style="padding:16px;font-size:13px;color:var(--tx-s);text-align:center">' + t('no_data') + '</div>';
}

function toggleRouteGroup(hd) {
    var card = hd.parentElement;
    var body = card.querySelector('.route-group-body');
    var chevron = card.querySelector('.route-group-chevron');
    var collapsed = card.classList.contains('collapsed');
    
    if (collapsed) {
        body.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
        card.classList.remove('collapsed');
    } else {
        body.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
        card.classList.add('collapsed');
    }
}

function expandAllRouteGroups() {
    var cards = document.querySelectorAll('.route-group-card');
    cards.forEach(function(card) {
        card.classList.remove('collapsed');
        card.querySelector('.route-group-body').style.display = 'block';
        card.querySelector('.route-group-chevron').style.transform = 'rotate(180deg)';
    });
}

function collapseAllRouteGroups() {
    var cards = document.querySelectorAll('.route-group-card');
    cards.forEach(function(card) {
        card.classList.add('collapsed');
        card.querySelector('.route-group-body').style.display = 'none';
        card.querySelector('.route-group-chevron').style.transform = 'rotate(0deg)';
    });
}

// ========== 消息统计功能 ==========

async function loadMessageStats() {
    const d = await api('/api/message-stats');
    if (!d) return;
    
    // 消息类型分布
    const typeStats = d.by_type || {};
    const typeHtml = Object.entries(typeStats).map(([type, count]) => {
        const total = d.total_events || 1;
        const percent = ((count / total) * 100).toFixed(1);
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="min-width:80px;font-weight:500">${esc(type)}</span>
            <div style="flex:1;height:8px;background:var(--bg-s);border-radius:4px;overflow:hidden">
                <div style="width:${percent}%;height:100%;background:var(--accent)"></div>
            </div>
            <span style="min-width:60px;text-align:right;font-size:12px;color:var(--tx-s)">${count} (${percent}%)</span>
        </div>`;
    }).join('');
    document.getElementById('msgTypeStats').innerHTML = typeHtml || '<div style="color:var(--tx-s);font-size:13px">' + t('no_data') + '</div>';
    
    // 平台分布
    const platformStats = d.by_platform || {};
    const platformHtml = Object.entries(platformStats).map(([platform, count]) => {
        const total = d.total_events || 1;
        const percent = ((count / total) * 100).toFixed(1);
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="min-width:80px;font-weight:500">${esc(platform)}</span>
            <div style="flex:1;height:8px;background:var(--bg-s);border-radius:4px;overflow:hidden">
                <div style="width:${percent}%;height:100%;background:var(--ok-c)"></div>
            </div>
            <span style="min-width:60px;text-align:right;font-size:12px;color:var(--tx-s)">${count} (${percent}%)</span>
        </div>`;
    }).join('');
    document.getElementById('msgPlatformStats').innerHTML = platformHtml || '<div style="color:var(--tx-s);font-size:13px">' + t('no_data') + '</div>';
    
    // 每小时趋势（最近24小时）
    const hourlyStats = d.hourly || {};
    const now = Date.now() / 1000;
    const hourlyHtml = [];
    
    for (let i = 23; i >= 0; i--) {
        const hourKey = Math.floor((now - i * 3600) / 3600) * 3600;
        const count = hourlyStats[hourKey] || 0;
        const maxCount = Math.max(...Object.values(hourlyStats), 1);
        const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
        
        const hourLabel = new Date(hourKey * 1000).getHours() + ':00';
        
        hourlyHtml.push(`<div style="flex:1;min-width:28px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px">
            <div style="width:100%;max-width:16px;height:${height}%;background:var(--accent);border-radius:2px;min-height:2px;transition:height 0.3s"></div>
            <span style="font-size:9px;color:var(--tx-t);white-space:nowrap">${hourLabel}</span>
        </div>`);
    }
    
    document.getElementById('msgHourlyTrend').innerHTML = hourlyHtml.join('');
}

// 更新 refreshDashboard 函数以包含性能监控
const _originalRefreshDashboard = refreshDashboard;
refreshDashboard = async function() {
    await _originalRefreshDashboard();
    await loadPerformance();
    await loadMessageStats();
};







// ========== API 路由测试 ==========

let _rtMethod = '', _rtFullPath = '';

function openRouteTest(method, fullPath) {
    _rtMethod = method;
    _rtFullPath = fullPath;
    const methodColor = { 'GET': 'method-get', 'POST': 'method-post', 'PUT': 'method-put', 'DELETE': 'method-delete', 'PATCH': 'method-patch' }[method] || 'method-get';
    const mb = document.getElementById('rtMethod');
    mb.textContent = method;
    mb.className = 'method-badge ' + methodColor;
    document.getElementById('rtPath').textContent = fullPath;
    document.getElementById('rtBodySection').style.display = ['POST', 'PUT', 'PATCH'].includes(method) ? 'block' : 'none';
    document.getElementById('rtParams').innerHTML = '';
    document.getElementById('rtBody').value = '';
    document.getElementById('rtResponse').textContent = '';
    document.getElementById('rtResponseStatus').style.display = 'none';
    document.getElementById('routeTestOverlay').style.display = 'flex';
}

function closeRouteTest() {
    document.getElementById('routeTestOverlay').style.display = 'none';
}

function addRouteParam(k, v) {
    const c = document.getElementById('rtParams');
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;gap:6px;margin-bottom:4px';
    d.innerHTML = '<input class="rt-pk" style="flex:1;padding:4px 8px;border:1px solid var(--bd);border-radius:4px;font-size:12px;background:var(--bg-s);color:var(--tx-p)" placeholder="Key" value="' + esc(k || '') + '">' +
        '<input class="rt-pv" style="flex:2;padding:4px 8px;border:1px solid var(--bd);border-radius:4px;font-size:12px;background:var(--bg-s);color:var(--tx-p)" placeholder="Value" value="' + esc(v || '') + '">' +
        '<button class="btn-icon" onclick="this.parentElement.remove()" style="flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    c.appendChild(d);
}

async function sendRouteTest() {
    const params = [];
    document.querySelectorAll('#rtParams > div').forEach(row => {
        const k = row.querySelector('.rt-pk').value.trim();
        const v = row.querySelector('.rt-pv').value.trim();
        if (k) params.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    const qs = params.length ? '?' + params.join('&') : '';
    const url = _rtFullPath + qs;
    const tk = localStorage.getItem(TK);
    const headers = { 'Authorization': 'Bearer ' + tk };
    const bodyArea = document.getElementById('rtBody');
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(_rtMethod) && bodyArea.value.trim();
    if (hasBody) headers['Content-Type'] = 'application/json';
    document.getElementById('rtResponse').textContent = t('loading');
    document.getElementById('rtResponseStatus').style.display = 'none';
    try {
        const opts = { method: _rtMethod, headers };
        if (hasBody) opts.body = bodyArea.value.trim();
        const resp = await fetch(url, opts);
        const statusEl = document.getElementById('rtResponseStatus');
        const isOk = resp.status >= 200 && resp.status < 300;
        statusEl.innerHTML = '<span class="chip ' + (isOk ? 'chip-ok' : 'chip-er') + '">' + resp.status + ' ' + esc(resp.statusText) + '</span>';
        statusEl.style.display = 'block';
        const ct = resp.headers.get('content-type') || '';
        let text;
        if (ct.includes('json')) {
            const json = await resp.json();
            text = JSON.stringify(json, null, 2);
        } else {
            text = await resp.text();
            try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (e) {}
        }
        document.getElementById('rtResponse').textContent = text;
    } catch (e) {
        document.getElementById('rtResponse').textContent = 'Error: ' + e.message;
    }
}

// ========== 审计日志功能 ==========

async function loadAuditLog() {
    const actionFilter = document.getElementById('auditActionFilter')?.value || '';
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    params.set('limit', '200');
    const d = await api('/api/audit?' + params);
    if (!d) return;
    const logs = d.logs || [];
    document.getElementById('auditCount').textContent = d.total || 0;
    if (logs.length === 0) {
        document.getElementById('auditList').innerHTML = '<div class="empty-state"><p>' + t('no_data') + '</p></div>';
        return;
    }
    const html = logs.slice().reverse().map(log => {
        const tm = new Date(log.timestamp * 1000).toLocaleString(getLocale());
        const actionKey = 'action_' + log.action;
        const actionLabel = t(actionKey) !== actionKey ? t(actionKey) : esc(log.action);
        const actionClass = {
            'restart_framework': 'chip-er',
            'clear_events': 'chip-wr',
            'package_install': 'chip-ok',
            'backup_import': 'chip-pr',
        }[log.action] || 'chip-sc';
        return '<div class="list-row" style="font-size:13px;gap:12px">' +
            '<span class="chip ' + actionClass + '" style="min-width:100px;justify-content:center">' + esc(actionLabel) + '</span>' +
            '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx-s)" title="' + esc(log.detail) + '">' + esc(log.detail || '-') + '</span>' +
            '<span style="font-size:11px;color:var(--tx-t);white-space:nowrap">' + esc(log.ip || '') + '</span>' +
            '<span style="font-size:11px;color:var(--tx-t);white-space:nowrap;min-width:140px;text-align:right">' + esc(tm) + '</span>' +
            '</div>';
    }).join('');
    document.getElementById('auditList').innerHTML = html;
}

async function clearAuditLog() {
    if (!authed) return showLogin();
    const ok = await confirm2(t('clear_events'), t('audit_clear_confirm'));
    if (!ok) return;
    await api('/api/audit/clear', { method: 'POST' });
    toast(t('audit_cleared'), 'ok');
    loadAuditLog();
}

// ========== 备份与恢复功能 ==========

async function exportBackup() {
    if (!authed) return showLogin();
    const d = await api('/api/backup/export');
    if (!d || d.error) {
        toast(t('backup_failed'), 'er');
        return;
    }
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = 'erispulse-backup-' + ts + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast(t('backup_export_success'), 'ok');
}

async function importBackup(input) {
    if (!authed) return showLogin();
    const file = input.files && input.files[0];
    if (!file) return;
    const ok = await confirm2(t('backup_import'), t('backup_import_confirm'));
    if (!ok) { input.value = ''; return }
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = await api('/api/backup/import', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        if (result && result.success) {
            toast(t('import_success') + ' (' + result.config_restored + ' config, ' + result.storage_restored + ' storage)', 'ok');
            loadConfig();
        } else {
            toast(t('import_failed') + ': ' + (result?.error || ''), 'er');
        }
    } catch (e) {
        toast(t('import_failed') + ': ' + e.message, 'er');
    }
    input.value = '';
}

// ========== 文件管理功能 ==========

let _fmCurrentPath = '.';
let _fmShowHidden = false;
let _fmEditor = null;
let _fmEditPath = '';
let _fmDirty = false;
let _fmContextMenu = null;
let _fmSearchTimer;

function debounceFmSearch() { clearTimeout(_fmSearchTimer); _fmSearchTimer = setTimeout(() => fmBrowse(_fmCurrentPath), 300) }

function fmGetMode(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const modes = {
        js: 'javascript', json: 'javascript', mjs: 'javascript',
        py: 'python', pyw: 'python',
        html: 'htmlmixed', htm: 'htmlmixed',
        css: 'css', xml: 'xml', svg: 'xml',
        md: 'markdown', markdown: 'markdown',
        toml: 'toml', yaml: 'yaml', yml: 'yaml',
        sh: 'shell', bash: 'shell', zsh: 'shell',
        txt: 'text',
    };
    return modes[ext] || 'text';
}

function fmFormatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function fmFormatTime(ts) {
    if (!ts) return '';
    return new Date(ts * 1000).toLocaleString(getLocale(), {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
}

function fmGetIcon(type, name) {
    if (type === 'directory') return '<svg class="fm-icon folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
    return '<svg class="fm-icon file" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

function fmUpdateBreadcrumb(path) {
    const bc = document.getElementById('fmBreadcrumb');
    const parts = path === '.' ? [] : path.split('/');
    let html = '<span class="fm-crumb' + (parts.length === 0 ? ' active' : '') + '" onclick="fmNavigateTo(\'.\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:middle"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg></span>';
    let accumulated = '';
    parts.forEach((part, i) => {
        accumulated += (accumulated ? '/' : '') + part;
        const p = accumulated;
        html += '<span class="fm-crumb-sep">/</span><span class="fm-crumb' + (i === parts.length - 1 ? ' active' : '') + '" onclick="fmNavigateTo(\'' + esc(p) + '\')">' + esc(part) + '</span>';
    });
    bc.innerHTML = html;
}

function fmNavigateTo(path) {
    _fmCurrentPath = path;
    fmBrowse(path);
}

function fmGoUp() {
    if (_fmCurrentPath === '.') return;
    const parts = _fmCurrentPath.split('/');
    parts.pop();
    fmNavigateTo(parts.length ? parts.join('/') : '.');
}

function fmToggleHidden() {
    _fmShowHidden = !_fmShowHidden;
    const btn = document.getElementById('fmHiddenBtn');
    btn.style.background = _fmShowHidden ? 'var(--accent)' : '';
    fmBrowse(_fmCurrentPath);
}

function fmRefresh() { fmBrowse(_fmCurrentPath); }

async function fmBrowse(path) {
    _fmCurrentPath = path;
    const search = document.getElementById('fmSearch')?.value || '';
    const params = new URLSearchParams({ path, hidden: _fmShowHidden ? 'true' : 'false' });
    if (search) params.set('pattern', '*' + search + '*');
    const d = search ? await api('/api/files/search?' + params) : await api('/api/files/browse?' + params);
    if (!d) return;
    if (d.error) { toast(d.error, 'er'); return; }

    const entries = d.entries || d.results || [];
    document.getElementById('fmCurrentPath').textContent = d.path || path;
    document.getElementById('fmItemCount').textContent = entries.length;
    fmUpdateBreadcrumb(d.path || path);

    const fileList = document.getElementById('fmFileList');
    if (entries.length === 0) {
        fileList.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><p>' + t('no_data') + '</p></div>';
        return;
    }

    fileList.innerHTML = entries.map(e => {
        const isDir = e.type === 'directory';
        const nameClass = isDir ? 'fm-name folder-name' : 'fm-name';
        const icon = fmGetIcon(e.type, e.name);
        const size = isDir ? '--' : fmFormatSize(e.size || 0);
        const perm = e.permissions || '';
        const mtime = fmFormatTime(e.modified);
        const rowActions = !isDir ?
            '<button class="btn-icon" onclick="event.stopPropagation();fmDownload(\'' + esc(e.path) + '\')" title="Download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>' +
            '<button class="btn-icon" onclick="event.stopPropagation();fmEditFile(\'' + esc(e.path) + '\')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
            : '';
        return '<div class="fm-file-row" ondblclick="' + (isDir ? 'fmNavigateTo(\'' + esc(e.path) + '\')' : 'fmEditFile(\'' + esc(e.path) + '\')') + '" oncontextmenu="fmContextMenu(event,\'' + esc(e.path) + '\',\'' + esc(e.type) + '\')">' +
            icon +
            '<span class="' + nameClass + '">' + esc(e.name) + '</span>' +
            '<span class="fm-size">' + size + '</span>' +
            '<span class="fm-perm">' + esc(perm) + '</span>' +
            '<span class="fm-time">' + mtime + '</span>' +
            '<div class="fm-actions-cell">' + rowActions + '</div>' +
            '</div>';
    }).join('');
}

function fmContextMenu(event, path, type) {
    event.preventDefault();
    event.stopPropagation();
    if (_fmContextMenu) _fmContextMenu.remove();

    const isDir = type === 'directory';
    const menu = document.createElement('div');
    menu.className = 'fm-context-menu';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';

    let items = '';
    if (isDir) {
        items += fmCtxItem(t('files'), '<polyline points="9 18 15 12 9 6"/>', 'fmNavigateTo(\'' + esc(path) + '\')');
    } else {
        items += fmCtxItem(t('files'), '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>', 'fmEditFile(\'' + esc(path) + '\')');
        items += fmCtxItem(t('download'), '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', 'fmDownload(\'' + esc(path) + '\')');
    }
    items += '<div class="fm-ctx-sep"></div>';
    items += fmCtxItem(t('permissions'), '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-2.82 1.18V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001-1.51 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 002.82-1.18V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.2.65.77 1.09 1.51 1.08H21a2 2 0 010 4h-.09c-.74 0-1.31.44-1.51 1.08z"/>', 'fmChmod(\'' + esc(path) + '\')');
    items += fmCtxItem(t('rename_label'), '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/>', 'fmRename(\'' + esc(path) + '\')');
    const fname = path.split('/').pop().toLowerCase();
    if (fname.endsWith('.zip') || fname.endsWith('.tar.gz') || fname.endsWith('.tgz') || fname.endsWith('.tar.bz2') || fname.endsWith('.tar.xz') || fname.endsWith('.tar')) {
        items += fmCtxItem(t('decompress'), '<polyline points="17 1 21 5 17 9"/><path d="M3 7V5a2 2 0 012-2h12"/><line x1="9" y1="12" x2="15" y2="12"/>', 'fmDecompress(\'' + esc(path) + '\')');
    }
    items += '<div class="fm-ctx-sep"></div>';
    items += '<div class="fm-ctx-item danger" onclick="fmDelete(\'' + esc(path) + '\');this.closest(\'.fm-context-menu\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg><span>' + t('delete') + '</span></div>';

    menu.innerHTML = items;
    document.body.appendChild(menu);
    _fmContextMenu = menu;

    const close = () => { menu.remove(); _fmContextMenu = null; document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);
}

function fmCtxItem(label, svgPath, onclick) {
    return '<div class="fm-ctx-item" onclick="' + onclick + ';this.closest(\'.fm-context-menu\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + svgPath + '</svg><span>' + label + '</span></div>';
}

async function fmEditFile(path) {
    const d = await api('/api/files/read?path=' + encodeURIComponent(path));
    if (!d) return;
    if (d.error) {
        if (d.binary) toast(t('binary_file'), 'er');
        else if (d.error === 'File too large') toast(t('file_too_large') + ' (' + fmFormatSize(d.size) + ')', 'er');
        else toast(d.error, 'er');
        return;
    }
    _fmEditPath = path;
    _fmDirty = false;
    const panel = document.getElementById('fmEditorPanel');
    panel.style.display = 'block';
    document.getElementById('fmEditorTitle').textContent = path;
    document.getElementById('fmEditorStatus').textContent = '';

    const container = document.getElementById('fmEditorContainer');
    if (typeof CodeMirror !== 'undefined') {
        if (_fmEditor) _fmEditor.toTextArea();
        const textarea = document.createElement('textarea');
        container.innerHTML = '';
        container.appendChild(textarea);
        textarea.value = d.content;
        _fmEditor = CodeMirror.fromTextArea(textarea, {
            mode: fmGetMode(path),
            theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dracula' : 'default',
            lineNumbers: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            lineWrapping: true,
            tabSize: 4,
            indentUnit: 4,
        });
        _fmEditor.on('change', () => {
            _fmDirty = true;
            document.getElementById('fmEditorStatus').textContent = '●';
            document.getElementById('fmEditorStatus').style.color = 'var(--wr-c)';
        });
        _fmEditor.setSize('100%', '100%');
        setTimeout(() => _fmEditor.refresh(), 100);
    } else {
        container.innerHTML = '<textarea id="fmFallbackEditor" class="code-editor" style="width:100%;height:500px" spellcheck="false">' + esc(d.content) + '</textarea>';
    }
    panel.scrollIntoView({ behavior: 'smooth' });
}

async function fmSaveFile() {
    if (!_fmEditPath) return;
    let content;
    if (_fmEditor) {
        content = _fmEditor.getValue();
    } else {
        const ta = document.getElementById('fmFallbackEditor');
        content = ta ? ta.value : '';
    }
    const d = await api('/api/files/write', {
        method: 'PUT',
        body: JSON.stringify({ path: _fmEditPath, content })
    });
    if (d && d.success) {
        _fmDirty = false;
        document.getElementById('fmEditorStatus').textContent = t('file_saved');
        document.getElementById('fmEditorStatus').style.color = 'var(--ok-c)';
        toast(t('file_saved'), 'ok');
    } else {
        toast(d?.error || t('file_save_failed'), 'er');
    }
}

function fmCloseEditor() {
    document.getElementById('fmEditorPanel').style.display = 'none';
    if (_fmEditor) { _fmEditor.toTextArea(); _fmEditor = null; }
    _fmEditPath = '';
    _fmDirty = false;
}

function fmDownload(path) {
    const tk = localStorage.getItem(TK);
    const url = API + '/api/files/download?path=' + encodeURIComponent(path) + (tk ? '&token=' + encodeURIComponent(tk) : '');
    window.open(url, '_blank');
}

async function fmNewFile() {
    const name = await showModal(t('new_file'), '<input type="text" id="fmNewName" class="form-input" data-i18n-placeholder="new_file_name" placeholder="' + esc(t('new_file_name')) + '" style="width:100%">', [
        { label: t('cancel'), value: null },
        { label: t('ok'), value: 'ok', primary: true }
    ]);
    if (!name) return;
    const input = document.getElementById('fmNewName');
    const fileName = input ? input.value.trim() : '';
    if (!fileName) return;
    const fullPath = _fmCurrentPath === '.' ? fileName : _fmCurrentPath + '/' + fileName;
    const d = await api('/api/files/write', {
        method: 'PUT',
        body: JSON.stringify({ path: fullPath, content: '' })
    });
    if (d && d.success) {
        toast(t('file_saved'), 'ok');
        fmBrowse(_fmCurrentPath);
    } else {
        toast(d?.error || t('file_save_failed'), 'er');
    }
}

async function fmNewFolder() {
    const name = await showModal(t('new_folder'), '<input type="text" id="fmNewName" class="form-input" data-i18n-placeholder="new_folder_name" placeholder="' + esc(t('new_folder_name')) + '" style="width:100%">', [
        { label: t('cancel'), value: null },
        { label: t('ok'), value: 'ok', primary: true }
    ]);
    if (!name) return;
    const input = document.getElementById('fmNewName');
    const folderName = input ? input.value.trim() : '';
    if (!folderName) return;
    const fullPath = _fmCurrentPath === '.' ? folderName : _fmCurrentPath + '/' + folderName;
    const d = await api('/api/files/mkdir', {
        method: 'POST',
        body: JSON.stringify({ path: fullPath, recursive: true })
    });
    if (d && d.success) {
        toast(t('action_completed'), 'ok');
        fmBrowse(_fmCurrentPath);
    } else {
        toast(d?.error || t('action_failed'), 'er');
    }
}

function fmUpload() {
    document.getElementById('fmUploadInput').click();
}

async function fmDoUpload(input) {
    const files = input.files;
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (let i = 0; i < files.length; i++) {
        fd.append('files', files[i]);
    }
    const d = await api('/api/files/upload?path=' + encodeURIComponent(_fmCurrentPath), {
        method: 'POST',
        body: fd
    });
    if (d && d.success) {
        toast(t('upload_success') + ' (' + d.count + ')', 'ok');
        fmBrowse(_fmCurrentPath);
    } else {
        toast(d?.error || t('upload_failed'), 'er');
    }
    input.value = '';
}

async function fmDelete(path) {
    const ok = await confirm2(t('delete'), t('delete_confirm'));
    if (!ok) return;
    const d = await api('/api/files/delete', {
        method: 'POST',
        body: JSON.stringify({ paths: [path] })
    });
    if (d && d.success) {
        toast(t('delete_success'), 'ok');
        fmBrowse(_fmCurrentPath);
    } else {
        toast(d?.error || t('delete_failed'), 'er');
    }
}

async function fmRename(path) {
    const oldName = path.split('/').pop();
    const result = await showModal(t('rename_label'), '<input type="text" id="fmRenameInput" class="form-input" value="' + esc(oldName) + '" style="width:100%">', [
        { label: t('cancel'), value: null },
        { label: t('ok'), value: 'ok', primary: true }
    ]);
    if (!result) return;
    const input = document.getElementById('fmRenameInput');
    const newName = input ? input.value.trim() : '';
    if (!newName || newName === oldName) return;
    const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.';
    const newPath = dir === '.' ? newName : dir + '/' + newName;
    const d = await api('/api/files/rename', {
        method: 'POST',
        body: JSON.stringify({ old_path: path, new_path: newPath })
    });
    if (d && d.success) {
        toast(t('rename_success'), 'ok');
        fmBrowse(_fmCurrentPath);
    } else {
        toast(d?.error || t('rename_failed'), 'er');
    }
}

async function fmChmod(path) {
    const result = await showModal(t('chmod'), '<input type="text" id="fmChmodInput" class="form-input" placeholder="755" style="width:100%">', [
        { label: t('cancel'), value: null },
        { label: t('ok'), value: 'ok', primary: true }
    ]);
    if (!result) return;
    const input = document.getElementById('fmChmodInput');
    const mode = input ? input.value.trim() : '';
    if (!mode || !/^[0-7]{3,4}$/.test(mode)) { toast('Invalid mode', 'er'); return; }
    const d = await api('/api/files/chmod', {
        method: 'POST',
        body: JSON.stringify({ path, mode })
    });
    if (d && d.success) {
        toast(t('action_completed'), 'ok');
        fmBrowse(_fmCurrentPath);
    } else {
        toast(d?.error || t('action_failed'), 'er');
    }
}

document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 's' && _fmEditPath) {
        e.preventDefault();
        fmSaveFile();
    }
});

async function fmCompress() {
    if (!authed) return showLogin();
    const allRows = document.querySelectorAll('#fmFileList .fm-file-row');
    if (allRows.length === 0) { toast(t('no_data'), ''); return }
    const archiveName = await showModal(t('compress'), '<input type="text" id="fmCompressName" class="form-input" value="archive.zip" style="width:100%">', [
        { label: t('cancel'), value: null },
        { label: t('ok'), value: 'ok', primary: true }
    ]);
    if (!archiveName) return;
    const name = document.getElementById('fmCompressName')?.value?.trim() || 'archive.zip';
    const paths = [];
    allRows.forEach(row => {
        const nameEl = row.querySelector('.fm-name, .folder-name');
        if (nameEl) {
            const n = nameEl.textContent;
            paths.push(_fmCurrentPath === '.' ? n : _fmCurrentPath + '/' + n);
        }
    });
    if (paths.length === 0) return;
    const resp = await fetch(API + '/api/files/compress', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem(TK), 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths, archive_name: name })
    });
    if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
        toast(t('action_completed'), 'ok');
        fmBrowse(_fmCurrentPath);
    } else {
        const err = await resp.json().catch(() => ({}));
        toast(err.error || t('action_failed'), 'er');
    }
}

async function fmDecompress(path) {
    if (!authed) return showLogin();
    const d = await api('/api/files/decompress', { method: 'POST', body: JSON.stringify({ path }) });
    if (d && d.success) {
        toast(t('action_completed'), 'ok');
        fmBrowse(_fmCurrentPath);
    } else {
        toast(d?.error || t('action_failed'), 'er');
    }
}

// ========== 任务列表系统 ==========

let _tasks = [];
let _taskPanelOpen = false;
let _expandedTasks = new Set();

function addOrUpdateTask(id, name, status, outputLines, errorMsg) {
    let task = _tasks.find(t => t.id === id);
    if (!task) {
        task = { id, name, status, output: [], startedAt: Date.now(), errorMsg: '' };
        _tasks.unshift(task);
    }
    task.status = status;
    task.output = outputLines || task.output;
    if (errorMsg) task.errorMsg = errorMsg;
    renderTaskPanel();
    renderTaskBadge();
}

function removeTask(id) {
    _tasks = _tasks.filter(t => t.id !== id);
    _expandedTasks.delete(id);
    renderTaskPanel();
    renderTaskBadge();
}

function toggleTaskPanel() {
    _taskPanelOpen = !_taskPanelOpen;
    document.getElementById('taskPanel').classList.toggle('open', _taskPanelOpen);
    renderTaskPanel();
}

function clearAllTasks() {
    var removedIds = _tasks.filter(t => t.status !== 'running').map(t => t.id);
    removedIds.forEach(function(id) { _expandedTasks.delete(id) });
    _tasks = _tasks.filter(t => t.status === 'running');
    renderTaskPanel();
    renderTaskBadge();
}

function renderTaskBadge() {
    const badge = document.getElementById('taskBadge');
    const count = _tasks.length;
    const hasRunning = _tasks.some(t => t.status === 'running');
    document.getElementById('taskCount').textContent = count;
    if (count > 0) {
        badge.style.display = '';
        badge.classList.toggle('pulse', hasRunning);
    } else {
        badge.style.display = 'none';
        badge.classList.remove('pulse');
        _taskPanelOpen = false;
        document.getElementById('taskPanel').classList.remove('open');
    }
}

function renderTaskPanel() {
    if (!_taskPanelOpen) return;
    var container = document.getElementById('taskList');

    var items = container.querySelectorAll('.task-item.task-expanded');
    _expandedTasks.clear();
    items.forEach(function(item) {
        if (item.dataset.taskId) _expandedTasks.add(item.dataset.taskId);
    });

    if (_tasks.length === 0) {
        container.innerHTML = '<div class="task-empty">' + t('no_data') + '</div>';
        return;
    }
    container.innerHTML = _tasks.map(t => {
        let statusIcon = '';
        let statusClass = '';
        if (t.status === 'running') {
            statusIcon = '<svg class="task-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>';
            statusClass = 'task-running';
        } else if (t.status === 'success') {
            statusIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
            statusClass = 'task-success';
        } else {
            statusIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            statusClass = 'task-error';
        }
        var output = (t.output || []).slice(-20).join('\n');
        var detail = t.status === 'error' && t.errorMsg ? '\n' + t.errorMsg : '';
        var expanded = _expandedTasks.has(t.id) ? ' task-expanded' : '';
        return '<div class="task-item ' + statusClass + expanded + '" data-task-id="' + esc(t.id) + '" onclick="toggleTaskExpand(this)">' +
            '<div class="task-item-hd">' +
                '<span class="task-icon">' + statusIcon + '</span>' +
                '<span class="task-name">' + esc(t.name) + '</span>' +
                '<span class="task-time">' + new Date(t.startedAt).toLocaleTimeString(getLocale()) + '</span>' +
                '<button class="btn-icon" onclick="event.stopPropagation();removeTask(\'' + esc(t.id) + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
            '</div>' +
            '<pre class="task-output">' + esc(output + detail) + '</pre>' +
        '</div>';
    }).join('');
}

function toggleTaskExpand(el) {
    el.classList.toggle('task-expanded');
    var taskId = el.dataset.taskId;
    if (!taskId) return;
    if (el.classList.contains('task-expanded')) {
        _expandedTasks.add(taskId);
    } else {
        _expandedTasks.delete(taskId);
    }
}

// 30秒后自动清理已完成任务
setInterval(function() {
    const now = Date.now();
    const before = _tasks.length;
    var removed = _tasks.filter(t => t.status !== 'running' && now - t.startedAt >= 30000);
    removed.forEach(function(t) { _expandedTasks.delete(t.id) });
    _tasks = _tasks.filter(t => t.status === 'running' || now - t.startedAt < 30000);
    if (_tasks.length !== before) renderTaskBadge();
    if (_taskPanelOpen) renderTaskPanel();
}, 5000);

// ========== 包管理功能 ==========

let _pkgCache = null;
let _pkgUpdateCache = null;
let _pkgDebounceTimer;

function debouncePkgs() { clearTimeout(_pkgDebounceTimer); _pkgDebounceTimer = setTimeout(renderPkgInstalled, 300) }

function switchPkgTab(tab, btn) {
    btn.closest('.view-toggle').querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('pkInstalledTab').style.display = tab === 'pk-installed' ? 'block' : 'none';
    document.getElementById('pkUpdatesTab').style.display = tab === 'pk-updates' ? 'block' : 'none';
    document.getElementById('pkInstallNewTab').style.display = tab === 'pk-install-new' ? 'block' : 'none';
    if (tab === 'pk-updates') loadPackageUpdates();
}

async function loadPackages(forceRefresh) {
    const force = forceRefresh === true;
    const params = force ? '?force=true' : '';
    const d = await api('/api/packages' + params);
    if (!d || d.error) return;
    _pkgCache = d.packages || [];
    document.getElementById('pkgInstalledCount').textContent = _pkgCache.length;
    renderPkgInstalled();
}

function renderPkgInstalled() {
    if (!_pkgCache) return;
    const search = (document.getElementById('pkgSearch')?.value || '').toLowerCase();
    const filtered = search
        ? _pkgCache.filter(p => p.name.toLowerCase().includes(search) || (p.summary || '').toLowerCase().includes(search))
        : _pkgCache;

    if (filtered.length === 0) {
        document.getElementById('pkgInstalledList').innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><p>' + t('pkg_no_installed') + '</p></div>';
        return;
    }

    const html = filtered.map(p => {
        let typeBadges = '';
        if (p.is_module) typeBadges += '<span class="chip chip-pr" style="font-size:10px;padding:1px 6px">' + t('pkg_type_module') + '</span>';
        if (p.is_adapter) typeBadges += '<span class="chip chip-sc" style="font-size:10px;padding:1px 6px">' + t('pkg_type_adapter') + '</span>';
        if (!p.is_module && !p.is_adapter) typeBadges += '<span class="chip" style="font-size:10px;padding:1px 6px;background:var(--bg-s);color:var(--tx-t)">' + t('pkg_type_library') + '</span>';

        const isProtected = p.name.toLowerCase().replace(/[-_]/g, '') === 'erispulse' || p.name.toLowerCase().replace(/[-_]/g, '') === 'erispulsedashboard';
        let actions = '';
        if (!isProtected) {
            actions += '<button class="btn btn-secondary btn-xs" onclick="upgradePkg(\'' + esc(p.name) + '\')">' + t('pkg_upgrade') + '</button> ';
            actions += '<button class="btn btn-danger btn-xs" onclick="uninstallPkg(\'' + esc(p.name) + '\')">' + t('uninstall_module') + '</button>';
        }

        return '<div class="pkg-row">' +
            '<div class="pkg-info">' +
                '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
                    '<span class="pkg-name">' + esc(p.name) + '</span>' +
                    typeBadges +
                '</div>' +
                '<div style="font-size:12px;color:var(--tx-s);margin-top:2px">' + esc(p.summary || '') + '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
                '<span class="pkg-version">v' + esc(p.version) + '</span>' +
                actions +
            '</div>' +
        '</div>';
    }).join('');

    document.getElementById('pkgInstalledList').innerHTML = html;
}

async function loadPackageUpdates(forceRefresh) {
    const countEl = document.getElementById('pkgUpdateCount');
    const countInnerEl = document.getElementById('pkgUpdateCountInner');
    
    if (!_pkgUpdateCache || forceRefresh) {
        document.getElementById('pkgUpdateList').innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation:spin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg><p>' + t('pkg_checking_updates') + '</p></div>';
        const force = forceRefresh === true;
        const params = force ? '?force=true' : '';
        const d = await api('/api/packages/updates' + params);
        if (!d || d.error) {
            document.getElementById('pkgUpdateList').innerHTML = '<div class="empty-state"><p>' + (d?.error || t('action_failed')) + '</p></div>';
            return;
        }
        _pkgUpdateCache = d.updates || [];
    }

    const updates = _pkgUpdateCache;
    countEl.textContent = updates.length;
    countEl.style.display = updates.length > 0 ? 'inline-flex' : 'none';
    countInnerEl.textContent = updates.length;

    if (updates.length === 0) {
        document.getElementById('pkgUpdateList').innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg><p>' + t('pkg_no_updates') + '</p></div>';
        return;
    }

    const html = updates.map(u => {
        return '<div class="pkg-row pkg-row-update">' +
            '<div class="pkg-info">' +
                '<span class="pkg-name">' + esc(u.name) + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
                '<span class="pkg-version-old">v' + esc(u.current) + '</span>' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--wr-c)"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
                '<span class="pkg-version-new">v' + esc(u.latest) + '</span>' +
                '<button class="btn btn-primary btn-xs" onclick="upgradePkg(\'' + esc(u.name) + '\')">' + t('pkg_upgrade') + '</button>' +
            '</div>' +
        '</div>';
    }).join('');

    document.getElementById('pkgUpdateList').innerHTML = html;
}

async function upgradePkg(pkgName) {
    if (!authed) return showLogin();
    const ok = await confirm2(t('pkg_upgrade'), t('pkg_upgrade_confirm') + ' <strong>' + esc(pkgName) + '</strong>?');
    if (!ok) return;
    const d = await api('/api/packages/upgrade', { method: 'POST', body: JSON.stringify({ packages: [pkgName] }) });
    if (d && d.success && d.task_id) {
        _installTaskIds.set(d.task_id, pkgName);
        toast(t('pkg_upgrading'), '');
    } else {
        toast(t('pkg_upgrade_failed') + ': ' + (d?.error || ''), 'er');
    }
}

async function upgradeAllPkgs() {
    if (!authed) return showLogin();
    if (!_pkgUpdateCache || _pkgUpdateCache.length === 0) {
        toast(t('pkg_no_updates'), '');
        return;
    }
    const ok = await confirm2(t('upgrade_all'), t('pkg_upgrade_all_confirm'));
    if (!ok) return;
    const packages = _pkgUpdateCache.map(u => u.name);
    const d = await api('/api/packages/upgrade', { method: 'POST', body: JSON.stringify({ packages }) });
    if (d && d.success && d.task_id) {
        _installTaskIds.set(d.task_id, packages.join(', '));
        toast(t('pkg_upgrading'), '');
    } else {
        toast(t('pkg_upgrade_failed') + ': ' + (d?.error || ''), 'er');
    }
}

async function installNewPkg() {
    if (!authed) return showLogin();
    const input = document.getElementById('pkgInstallInput');
    const val = input.value.trim();
    if (!val) return;
    const packages = val.split(/\s+/).filter(s => s.length > 0);
    const ok = await confirm2(t('install'), t('install') + ' <strong>' + esc(packages.join(', ')) + '</strong>?');
    if (!ok) return;
    const d = await api('/api/packages/install', { method: 'POST', body: JSON.stringify({ packages }) });
    if (d && d.success && d.task_id) {
        _installTaskIds.set(d.task_id, packages.join(', '));
        toast(t('installing'), '');
        input.value = '';
    } else {
        toast(t('install_failed') + ': ' + (d?.error || ''), 'er');
    }
}

async function uninstallPkg(pkgName) {
    if (!authed) return showLogin();
    const ok = await confirm2(t('uninstall_module'), t('pkg_uninstall_confirm') + ' <strong>' + esc(pkgName) + '</strong>');
    if (!ok) return;
    const d = await api('/api/packages/uninstall', { method: 'POST', body: JSON.stringify({ package: pkgName }) });
    if (d && d.success && d.task_id) {
        _installTaskIds.set(d.task_id, pkgName);
        toast(t('module_uninstalling'), '');
    } else if (d && d.error === 'Cannot uninstall core package') {
        toast(t('pkg_cannot_uninstall'), 'er');
    } else {
        toast(d?.error || t('action_failed'), 'er');
    }
}

let _cmdData = null, _editCmdName = '', _editAliases = [], _editAllowed = [], _editBlocked = [], _cmdPlatforms = [];

async function loadCommands() {
    const d = await api('/api/commands'); if (!d) return;
    _cmdData = d;
    _cmdPlatforms = d.platforms || [];
    const gs = d.global_settings || {};
    document.getElementById('cmdPrefix').textContent = gs.prefix || '/';
    document.getElementById('cmdCaseSensitive').textContent = gs.case_sensitive ? t('cmd_yes') : t('cmd_no');
    document.getElementById('cmdAllowSpace').textContent = gs.allow_space_prefix ? t('cmd_yes') : t('cmd_no');
    document.getElementById('cmdMustAtBot').textContent = gs.must_at_bot ? t('cmd_yes') : t('cmd_no');
    document.getElementById('cmdCount').textContent = d.total || 0;
    const cmds = d.commands || [];
    if (!cmds.length) {
        document.getElementById('cmdListBody').innerHTML = '<div style="padding:32px 18px;text-align:center;color:var(--tx-t);font-size:13px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:.3;margin-bottom:8px"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg><div>' + t('cmd_no_commands') + '</div></div>';
        return;
    }
    let html = '';
    for (const c of cmds) {
        const enabled = c.enabled !== false;
        const dotClass = enabled ? 'enabled' : 'disabled';
        const statusText = enabled ? t('cmd_enabled') : t('cmd_disabled');
        let aliasesHtml = '';
        for (const a of (c.original_aliases || [])) {
            aliasesHtml += '<span class="cmd-alias-chip original">' + esc(a) + '</span>';
        }
        for (const a of (c.custom_aliases || [])) {
            aliasesHtml += '<span class="cmd-alias-chip custom">' + esc(a) + '</span>';
        }
        let metaParts = [];
        if (!aliasesHtml) aliasesHtml = '';
        if (aliasesHtml) metaParts.push('<span>' + t('cmd_aliases_label') + ': ' + aliasesHtml + '</span>');
        if (c.help) metaParts.push('<span>' + esc(c.help) + '</span>');
        if (c.group) metaParts.push('<span>' + t('cmd_group') + ': ' + esc(c.group) + '</span>');
        if (c.usage) metaParts.push('<span style="font-family:Consolas,Monaco,monospace;font-size:11px">' + esc(c.usage) + '</span>');
        let platformBadges = '';
        for (const p of (c.allowed_platforms || [])) {
            platformBadges += '<span class="cmd-platform-chip allowed">' + esc(p) + '</span>';
        }
        for (const p of (c.blocked_platforms || [])) {
            platformBadges += '<span class="cmd-platform-chip blocked">' + esc(p) + '</span>';
        }
        let transformBadge = '';
        if (c.transform_to) {
            transformBadge = '<span class="cmd-transform">&rarr; ' + esc(c.transform_to) + '</span>';
        }
        let badges = platformBadges + transformBadge;
        html += '<div class="cmd-row">' +
            '<span class="cmd-status-dot ' + dotClass + '"></span>' +
            '<div class="cmd-info">' +
                '<div class="cmd-name-row">' +
                    '<span class="cmd-name">' + esc(c.name) + '</span>' +
                    (badges ? '<span class="cmd-badges">' + badges + '</span>' : '') +
                '</div>' +
                '<div class="cmd-meta">' + (metaParts.length ? metaParts.join('') : '<span style="color:var(--tx-t)">' + t('module_no_desc') + '</span>') + '</div>' +
            '</div>' +
            '<div class="cmd-actions">' +
                '<button class="btn btn-secondary btn-xs" onclick="openCmdEdit(\'' + esc(c.name).replace(/'/g, "\\'") + '\')">' + t('config') + '</button>' +
            '</div>' +
            '</div>';
    }
    document.getElementById('cmdListBody').innerHTML = html;
}

function openCmdEdit(name) {
    if (!_cmdData) return;
    const cmd = (_cmdData.commands || []).find(c => c.name === name);
    if (!cmd) return;
    _editCmdName = name;
    _editAliases = [...(cmd.custom_aliases || [])];
    _editAllowed = [...(cmd.allowed_platforms || [])];
    _editBlocked = [...(cmd.blocked_platforms || [])];
    document.getElementById('cmdEditTitle').textContent = '/' + name;
    document.getElementById('cmdEnabled').checked = cmd.enabled !== false;
    document.getElementById('cmdTransformTo').value = cmd.transform_to || '';
    let origHtml = '';
    if ((cmd.original_aliases || []).length) {
        origHtml = '<span style="color:var(--tx-t);font-size:12px">' + t('cmd_original_aliases_label') + ': ' + cmd.original_aliases.map(a => esc(a)).join(', ') + '</span>';
    }
    if (cmd.help) origHtml += '<span style="margin-left:12px;color:var(--tx-s);font-size:12px">' + t('cmd_help') + ': ' + esc(cmd.help) + '</span>';
    if (cmd.group) origHtml += '<span style="margin-left:12px;color:var(--tx-s);font-size:12px">' + t('cmd_group') + ': ' + esc(cmd.group) + '</span>';
    document.getElementById('cmdOriginalAliases').innerHTML = origHtml;
    renderCmdAliasTags();
    renderCmdPlatformToggles();
    document.getElementById('cmdAliasInput').value = '';
    document.getElementById('cmdEditOverlay').style.display = 'flex';
}

function renderCmdAliasTags() {
    const container = document.getElementById('cmdAliasTags');
    if (!_editAliases.length) { container.innerHTML = ''; return; }
    container.innerHTML = _editAliases.map((a, i) =>
        '<span class="cmd-tag">' + esc(a) + '<span class="cmd-tag-remove" onclick="removeCmdAlias(' + i + ')">&times;</span></span>'
    ).join('');
}

function addCmdAlias() {
    const input = document.getElementById('cmdAliasInput');
    const val = input.value.trim();
    if (!val || _editAliases.includes(val)) { input.value = ''; return; }
    _editAliases.push(val);
    input.value = '';
    renderCmdAliasTags();
}

function removeCmdAlias(index) {
    _editAliases.splice(index, 1);
    renderCmdAliasTags();
}

function renderCmdPlatformToggles() {
    const allowedContainer = document.getElementById('cmdAllowedPlatforms');
    const blockedContainer = document.getElementById('cmdBlockedPlatforms');
    if (!_cmdPlatforms.length) {
        allowedContainer.innerHTML = '<span style="font-size:12px;color:var(--tx-t)">' + t('no_adapters') + '</span>';
        blockedContainer.innerHTML = '<span style="font-size:12px;color:var(--tx-t)">' + t('no_adapters') + '</span>';
        return;
    }
    allowedContainer.innerHTML = _cmdPlatforms.map(p => {
        const active = _editAllowed.includes(p);
        return '<span class="cmd-platform-toggle' + (active ? ' active' : '') + '" onclick="toggleCmdPlatform(\'allowed\',\'' + esc(p) + '\')">' + esc(p) + '</span>';
    }).join('');
    blockedContainer.innerHTML = _cmdPlatforms.map(p => {
        const active = _editBlocked.includes(p);
        return '<span class="cmd-platform-toggle' + (active ? ' blocked' : '') + '" onclick="toggleCmdPlatform(\'blocked\',\'' + esc(p) + '\')">' + esc(p) + '</span>';
    }).join('');
}

function toggleCmdPlatform(type, platform) {
    if (type === 'allowed') {
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
    document.getElementById('cmdEditOverlay').style.display = 'none';
}

async function saveCmdEdit() {
    const body = {
        enabled: document.getElementById('cmdEnabled').checked,
        aliases: _editAliases,
        allowed_platforms: _editAllowed,
        blocked_platforms: _editBlocked,
        transform_to: document.getElementById('cmdTransformTo').value.trim() || null,
    };
    const d = await api('/api/commands/' + encodeURIComponent(_editCmdName), {
        method: 'PUT',
        body: JSON.stringify(body),
    });
    if (d && d.success) {
        toast(t('cmd_save_success'), 'ok');
        closeCmdEdit();
        loadCommands();
    } else {
        toast(d?.error || t('cmd_save_failed'), 'er');
    }
}

(function () {
    applyTheme(getTheme()); applyUiStyle(getUiStyle()); applyI18n();
    const collapsed = localStorage.getItem('ep_sidebar_collapsed') === 'true';
    if (collapsed) document.getElementById('sidebar').classList.add('collapsed');
    const tk = localStorage.getItem(TK);
    if (tk) {
        fetch(API + '/api/auth/status', { headers: { 'Authorization': 'Bearer ' + tk } }).then(r => r.json()).then(d => {
            if (d && d.authenticated) {
                authed = true;
                document.querySelector('.app').classList.add('authed');
                loadAll(); wsConnect(); restartRefreshTimer();
            } else { localStorage.removeItem(TK); showLogin() }
        }).catch(() => { showLogin() });
    } else { showLogin() }
    initMirrorSelects();
    const dz = document.getElementById('uploadDropZone');
    if (dz) {
        dz.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-over') });
        dz.addEventListener('dragleave', function(e) { this.classList.remove('drag-over') });
        dz.addEventListener('drop', function(e) { e.preventDefault(); this.classList.remove('drag-over'); if (e.dataTransfer.files[0]) processUploadFile(e.dataTransfer.files[0]) });
    }
})();