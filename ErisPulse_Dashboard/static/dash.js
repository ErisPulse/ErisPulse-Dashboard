const API = '/Dashboard', TK = '__ep_tk__';
let ws = null, allEvents = [], platforms = [], authed = false;

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
    }
};
let lang = localStorage.getItem('ep_lang') || 'zh';
function t(k) { return I18N[lang]?.[k] || k }
function toggleLang() { lang = lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('ep_lang', lang); applyI18n(); loadAll() }
function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (I18N[lang][k]) el.textContent = I18N[lang][k] });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const k = el.getAttribute('data-i18n-placeholder'); if (I18N[lang][k]) el.placeholder = I18N[lang][k] });
    document.querySelectorAll('[data-i18n-option]').forEach(el => { const k = el.getAttribute('data-i18n-option'); if (I18N[lang][k]) el.textContent = I18N[lang][k] });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { const k = el.getAttribute('data-i18n-title'); if (I18N[lang][k]) el.title = I18N[lang][k] });
    const ah = document.getElementById('authHint'); if (ah && I18N[lang].auth_hint) ah.innerHTML = I18N[lang].auth_hint;
    document.getElementById('langBtn').textContent = lang === 'zh' ? 'EN' : '\u4e2d\u6587';
    document.title = lang === 'zh' ? 'ErisPulse \u4eea\u8868\u76d8' : 'ErisPulse Dashboard';
    const wsEl = document.getElementById('wsText');
    if (wsEl) wsEl.textContent = document.getElementById('wsBadge').classList.contains('on') ? t('live') : t('offline');
}

function getTheme() {
    const s = localStorage.getItem('ep_theme');
    if (s) return s;
    return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
}
function applyTheme(th) {
    document.documentElement.setAttribute('data-theme', th);
    const sun = document.querySelector('#themeBtn .icon-sun');
    const moon = document.querySelector('#themeBtn .icon-moon');
    if (th === 'dark') { sun.style.display = 'block'; moon.style.display = 'none' }
    else { sun.style.display = 'none'; moon.style.display = 'block' }
}
function toggleTheme() { const th = getTheme() === 'dark' ? 'light' : 'dark'; localStorage.setItem('ep_theme', th); applyTheme(th) }

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

function go(name, el) {
    if (!authed) { showLogin(); return }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('p-' + name).classList.add('active');
    if (el) el.classList.add('active');
    closeSidebar();
    if (name === 'events') {
        loadEvents();
        switchEventsTab('ev-stream', document.querySelector('[data-tab="ev-stream"]'));
    }
    if (name === 'config') loadConfig();
    if (name === 'bots') loadBots();
    if (name === 'modules') {
        loadModules();
        loadStore();
        loadPackages();
        switchModuleTab('mh-registered', document.querySelector('[data-tab="mh-registered"]'));
    }
    if (name === 'logs') {
        loadLogs();
        switchLogsTab('log-list', document.querySelector('[data-tab="log-list"]'));
    } else if (_logAutoRefreshTimer) {
        clearInterval(_logAutoRefreshTimer);
        _logAutoRefreshTimer = null;
        const btn = document.getElementById('logAutoRefreshBtn');
        if (btn) btn.style.opacity = '0.5';
    }
    if (name === 'api-routes') loadApiRoutes();
    if (name === 'files') fmBrowse('.');
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

function showLogin() { document.querySelector('.app').classList.remove('authed'); document.getElementById('loginOv').classList.add('show'); document.getElementById('loginInput').focus() }
function closeLogin() { document.getElementById('loginOv').classList.remove('show') }
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
        loadAll(); wsConnect(); setInterval(refreshDashboard, 5000);
        toast(t('logged_in'), 'ok');
    } else {
        if (!authed) localStorage.removeItem(TK);
        toast(t('invalid_token'), 'er');
        inp.select();
    }
    btn.disabled = false; btn.style.opacity = ''; _loginLock = false;
}

function evHtml(e) {
    const tm = new Date(e.time * 1000).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
        aH += '<div class="list-row"><span class="chip ' + (on ? 'chip-ok' : 'chip-er') + '" style="min-width:60px;justify-content:center">' + esc(i.status) + '</span><span style="flex:1;font-weight:500">' + esc(n) + '</span><span style="font-size:12px;color:var(--tx-s)">' + Object.keys(i.bots || {}).length + ' bots</span></div>';
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
    const u = new URLSearchParams({ limit: '100' }); if (tf) u.set('type', tf); if (pf) u.set('platform', pf);
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
        const la = x.last_active ? new Date(x.last_active * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US') : 'Never';
        const on = x.status === 'online';
        return '<div class="bot-card"><div class="bot-avatar">' + (av ? '<img src="' + esc(av) + '" onerror="this.outerHTML=\'<svg viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; style=&quot;width:24px;height:24px;opacity:.7&quot;><rect x=&quot;5&quot; y=&quot;8&quot; width=&quot;14&quot; height=&quot;10&quot; rx=&quot;2&quot;/><circle cx=&quot;9&quot; cy=&quot;13&quot; r=&quot;1&quot; fill=&quot;currentColor&quot;/><circle cx=&quot;15&quot; cy=&quot;13&quot; r=&quot;1&quot; fill=&quot;currentColor&quot;/></svg>\'">' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="2"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/></svg>') + '</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">' + esc(nm) + '</div><div style="font-size:12px;color:var(--tx-s);margin-top:2px">' + esc(x.platform) + ' / ' + esc(x.bot_id) + '</div></div><div style="text-align:right;flex-shrink:0"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><span class="dot" style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:' + (on ? 'var(--ok-c)' : 'var(--tx-t)') + '"></span><span style="font-size:12px;font-weight:500;color:' + (on ? 'var(--ok-c)' : 'var(--tx-s)') + '">' + (on ? t('online') : t('offline')) + '</span></div><div style="font-size:11px;color:var(--tx-t);margin-top:4px">' + esc(la) + '</div></div></div>';
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

    return '<div class="module-row"><span class="module-status-dot ' + statusDot + '"></span><div class="module-info"><div class="module-name">' + esc(m.name) + '</div><div class="module-meta">' + meta + '</div></div><div class="module-actions">' + acts + '</div></div>';
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
        const hasUpdate = isInstalled && installedVer !== i.version;
        let statusBadge = '';
        let actionBtn = '';
        if (hasUpdate) {
            statusBadge = '<span class="chip chip-wr" style="margin-left:4px;font-size:10px">' + t('store_update_available') + '</span>';
            actionBtn = '<button class="btn btn-primary btn-sm" onclick="upgradePkg(\'' + esc(i.package) + '\')">' + t('pkg_upgrade') + '</button>';
        } else if (isInstalled) {
            statusBadge = '<span class="chip chip-ok" style="margin-left:4px;font-size:10px">v' + esc(installedVer) + '</span>';
            actionBtn = '<span style="font-size:12px;color:var(--ok-c);font-weight:500">' + t('active') + '</span>';
        } else {
            actionBtn = '<button class="btn btn-primary btn-sm" onclick="installPkg(\'' + esc(i.package) + '\')">' + t('install') + '</button>';
        }
        return '<div class="store-card' + (hasUpdate ? ' store-card-update' : '') + '"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px;font-weight:600">' + esc(i.name) + '</span><span class="chip chip-pr">' + esc(i.type) + '</span>' + statusBadge + '</div><div style="font-size:12px;color:var(--tx-t);font-family:Consolas,Monaco,monospace">' + esc(i.package) + '</div><div style="font-size:13px;color:var(--tx-s);line-height:1.4;margin-top:4px">' + esc(i.description || '-') + '</div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><span style="font-size:12px;color:var(--tx-s);font-weight:500">v' + esc(i.version || '?') + (hasUpdate ? ' <span style="color:var(--wr-c);font-weight:600">&larr;</span> ' + t('store_version_current') + ' v' + esc(installedVer) : '') + '</span>' + actionBtn + '</div></div>';
    }).join('') : '<div class="empty-state" style="grid-column:span 3"><p>' + t('no_packages') + '</p></div>';
}
let _installTaskIds = new Map();
async function installPkg(pkg) {
    if (!authed) return showLogin();
    const ok = await confirm2(t('install'), 'Install <strong>' + esc(pkg) + '</strong>?'); if (!ok) return;
    const d = await api('/api/store/install', { method: 'POST', body: JSON.stringify({ packages: [pkg] }) });
    if (d && d.success && d.task_id) {
        _installTaskIds.set(d.task_id, pkg);
        toast(t('installing'), '');
    } else {
        toast(t('install_failed'), 'er');
    }
}
async function uploadModule(input) {
    if (!authed) return showLogin();
    const file = input.files && input.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'whl' && ext !== 'zip') { toast(t('upload_failed'), 'er'); input.value = ''; return }
    const fd = new FormData();
    fd.append('file', file);
    const ok = await confirm2(t('upload_title'), 'Upload <strong>' + esc(file.name) + '</strong>?'); if (!ok) { input.value = ''; return }
    const d = await api('/api/store/upload', { method: 'POST', body: fd });
    if (d && d.success && d.task_id) {
        _installTaskIds.set(d.task_id, file.name);
        toast(t('uploading'), '');
    } else {
        toast(t('upload_failed'), 'er');
    }
    input.value = '';
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

function switchEventsTab(tab, btn) {
    document.querySelectorAll('#p-events .view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('evStreamTab').style.display = tab === 'ev-stream' ? 'block' : 'none';
    document.getElementById('evBuilderTab').style.display = tab === 'ev-builder' ? 'block' : 'none';
    if (tab === 'ev-builder') initEventBuilder();
}

function switchLogsTab(tab, btn) {
    document.querySelectorAll('#p-logs .view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('logListTab').style.display = tab === 'log-list' ? 'block' : 'none';
    document.getElementById('logLifecycleTab').style.display = tab === 'log-lifecycle' ? 'block' : 'none';
    document.getElementById('logAuditTab').style.display = tab === 'log-audit' ? 'block' : 'none';
    if (tab === 'log-lifecycle') loadLifecycle();
    if (tab === 'log-audit') loadAuditLog();
    if (tab !== 'log-list' && _logAutoRefreshTimer) {
        clearInterval(_logAutoRefreshTimer);
        _logAutoRefreshTimer = null;
        const btn2 = document.getElementById('logAutoRefreshBtn');
        if (btn2) btn2.style.opacity = '0.5';
    }
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
    ws.onopen = () => { document.getElementById('wsBadge').classList.add('on'); document.getElementById('wsText').textContent = t('live') };
    ws.onclose = () => { document.getElementById('wsBadge').classList.remove('on'); document.getElementById('wsText').textContent = t('offline'); setTimeout(wsConnect, 3000) };
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

function loadAll() { refreshDashboard(); loadEvents(); loadBots(); loadModules(); loadConfig(); loadStore(); loadMessageStats(); loadAuditLog(); loadPerformance(); loadPackages(); loadPackageUpdates() }

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
    
    if (httpRoutes.length === 0) {
        document.getElementById('httpRouteList').innerHTML = '<div style="padding:16px;font-size:13px;color:var(--tx-s)">' + t('no_http_routes') + '</div>';
    } else {
        const httpHtml = httpRoutes.map(route => {
            const methodColor = {
                'GET': 'method-get', 'POST': 'method-post', 'PUT': 'method-put',
                'DELETE': 'method-delete', 'PATCH': 'method-patch', 'OPTIONS': 'method-options', 'HEAD': 'method-head'
            }[route.method] || 'method-get';
            const moduleBadge = route.module ? `<span class="chip chip-sc" style="margin-right:8px">${esc(route.module)}</span>` : '';
            const apiPath = route.path;
            return `<div class="route-item" style="padding:12px 16px">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="method-badge ${methodColor}">${route.method}</span>
                    ${moduleBadge}
                    <code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">${esc(apiPath)}</code>
                    <div style="margin-left:auto">
                        <button class="btn btn-secondary btn-xs" onclick="openRouteTest('${esc(route.method)}','${esc(route.full_path)}')">${t('test')}</button>
                    </div>
                </div>
            </div>`;
        }).join('');
        document.getElementById('httpRouteList').innerHTML = httpHtml;
    }
    
    if (wsRoutes.length === 0) {
        document.getElementById('wsRouteList').innerHTML = '<div style="padding:16px;font-size:13px;color:var(--tx-s)">' + t('no_ws_routes') + '</div>';
    } else {
        const wsHtml = wsRoutes.map(route => {
            const moduleBadge = route.module ? `<span class="chip chip-sc" style="margin-right:8px">${esc(route.module)}</span>` : '';
            const authBadge = route.has_auth ? `<span class="chip chip-wr" style="margin-right:8px">${t('requires_auth')}</span>` : '';
            return `<div class="route-item" style="padding:12px 16px">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="method-badge method-ws">WS</span>
                    ${moduleBadge}
                    ${authBadge}
                    <code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">${esc(route.path)}</code>
                </div>
            </div>`;
        }).join('');
        document.getElementById('wsRouteList').innerHTML = wsHtml;
    }
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
        const tm = new Date(log.timestamp * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');
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
    return new Date(ts * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
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

// ========== 模块中心 Tab 切换 ==========

function switchModuleTab(tab, btn) {
    document.querySelectorAll('#p-modules > .view-toggle .view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('mhRegisteredTab').style.display = tab === 'mh-registered' ? 'block' : 'none';
    document.getElementById('mhStoreTab').style.display = tab === 'mh-store' ? 'block' : 'none';
    document.getElementById('mhPackagesTab').style.display = tab === 'mh-packages' ? 'block' : 'none';
    if (tab === 'mh-store') loadStore();
    if (tab === 'mh-packages') { loadPackages(); switchPkgTab('pk-installed', document.querySelector('[data-tab="pk-installed"]')); }
}

// ========== 任务列表系统 ==========

let _tasks = [];
let _taskPanelOpen = false;

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
    renderTaskPanel();
    renderTaskBadge();
}

function toggleTaskPanel() {
    _taskPanelOpen = !_taskPanelOpen;
    document.getElementById('taskPanel').classList.toggle('open', _taskPanelOpen);
    renderTaskPanel();
}

function clearAllTasks() {
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
    const container = document.getElementById('taskList');
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
        const output = (t.output || []).slice(-20).join('\n');
        const detail = t.status === 'error' && t.errorMsg ? '\n' + t.errorMsg : '';
        return '<div class="task-item ' + statusClass + '" onclick="this.classList.toggle(\'task-expanded\')">' +
            '<div class="task-item-hd">' +
                '<span class="task-icon">' + statusIcon + '</span>' +
                '<span class="task-name">' + esc(t.name) + '</span>' +
                '<span class="task-time">' + new Date(t.startedAt).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US') + '</span>' +
                '<button class="btn-icon" onclick="event.stopPropagation();removeTask(\'' + esc(t.id) + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
            '</div>' +
            '<pre class="task-output">' + esc(output + detail) + '</pre>' +
        '</div>';
    }).join('');
}

// 30秒后自动清理已完成任务
setInterval(function() {
    const now = Date.now();
    const before = _tasks.length;
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
    btn.parentElement.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
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

(function () {
    applyTheme(getTheme()); applyI18n();
    const tk = localStorage.getItem(TK);
    if (tk) {
        fetch(API + '/api/auth/status', { headers: { 'Authorization': 'Bearer ' + tk } }).then(r => r.json()).then(d => {
            if (d && d.authenticated) {
                authed = true;
                document.querySelector('.app').classList.add('authed');
                loadAll(); wsConnect();
                setInterval(refreshDashboard, 5000);
            } else { localStorage.removeItem(TK); showLogin() }
        }).catch(() => { showLogin() });
    } else { showLogin() }
})();