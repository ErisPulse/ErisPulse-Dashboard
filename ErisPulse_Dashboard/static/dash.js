const API = '/Dashboard', TK = '__ep_tk__';
let ws = null, allEvents = [], platforms = [], authed = false;

const I18N = {
    zh: {
        dashboard: '仪表盘', bots: '机器人', events: '事件流', modules: '插件', store: '模块商店', config: '配置管理',
        loading: '加载中...', online: '在线', offline: '离线', live: '实时',
        adapters: '适配器', modules_label: '模块', online_bots: '在线机器人', total_events: '事件总数',
        no_adapters: '暂无适配器', no_modules: '暂无模块', no_events: '暂无事件', no_bots: '暂无机器人',
        active: '活跃', inactive: '未活跃',
        enable: '启用', load: '加载', unload: '停止加载', install: '安装',
        search_packages: '搜索包...', live_events: '实时事件', waiting_events: '等待事件...',
        bots_desc: '各平台已发现的机器人', events_desc: '实时事件流',
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
        // 新增翻译
        event_builder: '事件构建器', event_builder_desc: '构建自定义事件用于调试和测试',
        select_platform: '选择平台', select_bot: '选择 Bot', custom: '自定义',
        session_type: '会话类型', session_id: '会话 ID', message_content: '消息内容',
        optional_fields: '附加字段', json_preview: 'JSON 预览',
        preview: '预览', submit_event: '提交事件',
        add_segment: '添加消息段', add_field: '添加字段', copy_json: '复制 JSON',
        validate_error: '验证错误', submit_success: '事件已提交', submit_failed: '提交失败',
        view_tree: '树形', view_source: '源码', reload_config: '重新加载', save_config: '保存配置',
        config_saved: '配置已保存', config_load_failed: '加载配置源码失败',
        read_only: '只读 (根配置)',
        event_type: '事件类型', detail_type: '详情类型', platform_info: '平台信息',
        message_content: '消息内容', select_detail_type: '请选择详情类型...', loading: '加载中...',
    },
    en: {
        dashboard: 'Dashboard', bots: 'Bots', events: 'Events', modules: 'Plugins', store: 'Module Store', config: 'Configuration',
        loading: 'Loading...', online: 'Online', offline: 'Offline', live: 'Live',
        adapters: 'Adapters', modules_label: 'Modules', online_bots: 'Online Bots', total_events: 'Total Events',
        no_adapters: 'No adapters', no_modules: 'No modules', no_events: 'No events', no_bots: 'No bots',
        active: 'Active', inactive: 'Inactive',
        enable: 'Enable', load: 'Load', unload: 'Unload', install: 'Install',
        search_packages: 'Search packages...', live_events: 'Live Events', waiting_events: 'Waiting for events...',
        bots_desc: 'Discovered bots across platforms', events_desc: 'Real-time event stream',
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
        // 新增翻译
        validate_error: 'Validation error', submit_success: 'Event submitted', submit_failed: 'Submit failed',
        view_tree: 'Tree', view_source: 'Source', reload_config: 'Reload', save_config: 'Save',
        config_saved: 'Configuration saved', config_load_failed: 'Failed to load config source',
        read_only: 'Read-only (root config)',
        event_type: 'Event Type', detail_type: 'Detail Type', platform_info: 'Platform Info',
        message_content: 'Message Content', select_detail_type: 'Select detail type...', loading: 'Loading...',
    }
};
let lang = localStorage.getItem('ep_lang') || 'zh';
function t(k) { return I18N[lang]?.[k] || k }
function toggleLang() { lang = lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('ep_lang', lang); applyI18n(); loadAll() }
function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (I18N[lang][k]) el.textContent = I18N[lang][k] });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const k = el.getAttribute('data-i18n-placeholder'); if (I18N[lang][k]) el.placeholder = I18N[lang][k] });
    const ah = document.getElementById('authHint'); if (ah && I18N[lang].auth_hint) ah.innerHTML = I18N[lang].auth_hint;
    document.getElementById('langBtn').textContent = lang === 'zh' ? 'EN' : '中文';
    document.title = lang === 'zh' ? 'ErisPulse 仪表盘' : 'ErisPulse Dashboard';
    const tf = document.getElementById('eTypeFilter');
    if (tf) { tf.options[0].textContent = lang === 'zh' ? '所有类型' : 'All Types' }
    const pf = document.getElementById('ePlatFilter');
    if (pf) { pf.options[0].textContent = lang === 'zh' ? '所有平台' : 'All Platforms' }
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
    if (name === 'events') loadEvents();
    if (name === 'config') loadConfig();
    if (name === 'bots') loadBots();
    if (name === 'modules') loadModules();
    if (name === 'store') loadStore();
    if (name === 'event-builder') {
        initEventBuilder();
    }
    if (name === 'logs') {
        loadLogs();
    } else {
        // 离开日志页面时关闭自动刷新
        if (_logAutoRefreshTimer) {
            clearInterval(_logAutoRefreshTimer);
            _logAutoRefreshTimer = null;
            const btn = document.getElementById('logAutoRefreshBtn');
            if (btn) btn.style.opacity = '0.5';
        }
    }
    if (name === 'lifecycle') loadLifecycle();
    if (name === 'api-routes') loadApiRoutes();
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
        statCard(Object.keys(ad).length, t('adapters')) +
        statCard(Object.keys(mo).filter(k => mo[k]).length, t('modules_label')) +
        statCard(ob, t('online_bots')) +
        statCard(allEvents.length, t('total_events'));

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
    const cl = m.loaded ? 'chip-ok' : 'chip-er';
    let acts = '';
    if (!isAd) {
        if (!m.loaded) acts += '<button class="btn btn-primary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'load\',\'' + esc(m.type) + '\')">' + t('load') + '</button> ';
        if (m.loaded) acts += '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'unload\',\'' + esc(m.type) + '\')">' + t('unload') + '</button> ';
    } else {
        if (!m.loaded) acts += '<button class="btn btn-primary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'load\',\'' + esc(m.type) + '\')">' + t('load') + '</button> ';
        if (m.loaded) acts += '<button class="btn btn-secondary btn-xs" onclick="moduleAction(\'' + esc(m.name) + '\',\'unload\',\'' + esc(m.type) + '\')">' + t('unload') + '</button> ';
    }
    return '<div class="list-row"><span class="chip ' + cl + '" style="min-width:64px;justify-content:center">' + (m.loaded ? t('active') : t('inactive')) + '</span><span style="flex:1;font-weight:500">' + esc(m.name) + '</span><div style="display:flex;gap:4px">' + acts + '</div></div>';
}
async function moduleAction(name, action, type) {
    if (!authed) return showLogin();
    if (action === 'unload' && name === 'Dashboard') {
        const ok = await confirm2(t('unload_self_title'), t('unload_self_confirm')); if (!ok) return;
    }
    const d = await api('/api/modules/action', { method: 'POST', body: JSON.stringify({ name, action, type }) });
    if (d && d.success) {
        setTimeout(loadModules, 300); toast(t('action_completed'), 'ok');
    } else toast(t('action_failed'), 'er');
}

let _storeTimer;
function debounceStore() { clearTimeout(_storeTimer); _storeTimer = setTimeout(loadStore, 300) }
async function loadStore() {
    const q = document.getElementById('storeSearch')?.value?.toLowerCase() || '';
    const d = await api('/api/store/remote');
    if (!d || !d.packages) { document.getElementById('storeGrid').innerHTML = '<div class="empty-state" style="grid-column:span 3"><p>' + t('failed_registry') + '</p></div>'; return }
    const pk = d.packages;
    const all = [...Object.entries(pk.modules || {}).map(([n, i]) => ({ ...i, name: n, type: 'module' })), ...Object.entries(pk.adapters || {}).map(([n, i]) => ({ ...i, name: n, type: 'adapter' }))];
    const f = q ? all.filter(i => (i.name + i.description + i.package).toLowerCase().includes(q)) : all;
    document.getElementById('storeGrid').innerHTML = f.length ? f.map(i => '<div class="store-card"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px;font-weight:600">' + esc(i.name) + '</span><span class="chip chip-pr">' + esc(i.type) + '</span></div><div style="font-size:12px;color:var(--tx-t);font-family:Consolas,Monaco,monospace">' + esc(i.package) + '</div><div style="font-size:13px;color:var(--tx-s);line-height:1.4;margin-top:4px">' + esc(i.description || '-') + '</div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><span style="font-size:12px;color:var(--tx-s);font-weight:500">v' + esc(i.version || '?') + '</span><button class="btn btn-primary btn-sm" onclick="installPkg(\'' + esc(i.package) + '\')">' + t('install') + '</button></div></div>').join('') : '<div class="empty-state" style="grid-column:span 3"><p>' + t('no_packages') + '</p></div>';
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
        document.getElementById('storageCount').textContent = (s.total || 0) + ' ' + t('total_events').replace('事件', '');
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
        toast('加载配置源码失败', 'er');
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
        toast('配置已保存', 'ok');
        // 重新加载树形视图
        loadConfig();
    } else {
        toast('保存失败: ' + (d?.error || '未知错误'), 'er');
    }
}

function switchConfigView(view, btn) {
    // 更新按钮状态
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // 切换视图
    const treeView = document.getElementById('configBodyTree');
    const sourceView = document.getElementById('configBodySource');
    
    if (view === 'tree') {
        treeView.style.display = 'block';
        sourceView.style.display = 'none';
    } else {
        treeView.style.display = 'none';
        sourceView.style.display = 'block';
        // 加载源码
        loadConfigSource();
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
    
    const readOnlyIndicator = !canEdit ? '<span style="font-size:11px;color:var(--wr-c);margin-left:8px">只读 (根配置)</span>' : '';
    
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
                if (sv && sv.children[3]) sv.children[3].querySelector('.stat-val').textContent = allEvents.length;
                if (document.querySelector('.page.active')?.id === 'p-dashboard') {
                    const dh = document.getElementById('dashEvents'); const em = dh?.querySelector('.empty-state');
                    if (em) em.remove(); dh?.insertAdjacentHTML('afterbegin', evHtml(m.data));
                    while (dh && dh.children.length > 20) dh.removeChild(dh.lastChild);
                }
            } else if (m.type === 'install_progress') {
                const pkg = _installTaskIds.get(m.task_id) || '';
                if (m.status === 'success') {
                    _installTaskIds.delete(m.task_id);
                    const title = pkg + ': ' + t('install_success');
                    showOutputModal(title + ' - ' + t('install_detail'), m.output || [], [{ label: t('install_restart_btn'), value: 'restart', primary: true }, { label: t('ok'), value: true }]).then(v => {
                        if (v === 'restart') restartFramework();
                    });
                    loadModules();
                } else if (m.status === 'error') {
                    _installTaskIds.delete(m.task_id);
                    showOutputModal(pkg + ': ' + t('install_failed'), m.output || [], [{ label: t('ok'), value: true }]);
                }
            }
        } catch (err) { }
    };
}

function loadAll() { refreshDashboard(); loadEvents(); loadBots(); loadModules(); loadConfig(); loadStore(); loadMessageStats() }

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
    select.innerHTML = '<option value="">选择平台...</option>';
    
    platforms.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.platform;
        opt.textContent = p.platform;
        select.appendChild(opt);
    });
}

async function loadBotsForPlatform(platform) {
    const select = document.getElementById('botSelect');
    select.innerHTML = '<option value="">选择 Bot...</option>';
    
    if (!platform) return;
    
    // 从当前在线的 Bot 中获取
    const bots = await api('/api/bots');
    if (bots && bots.bots) {
        const platformBots = bots.bots.filter(b => b.platform === platform);
        platformBots.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.bot_id;
            opt.textContent = b.bot_id + (b.info?.user_name ? ` (${b.info.user_name})` : '') + ' (在线)';
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
    
    select.innerHTML = '<option value="">请选择详情类型...</option>';
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
        addOptionalField('alt_message', '备用消息', '');
    } else if (builderState.eventType === 'notice') {
        addOptionalField('user_id', 'User ID', '');
    } else if (builderState.eventType === 'request') {
        addOptionalField('user_id', 'User ID', '');
        addOptionalField('comment', '请求附言', '');
    }
}

function addOptionalField(key = '', value = '', label = '') {
    const container = document.getElementById('optionalFields');
    
    const div = document.createElement('div');
    div.className = 'optional-field';
    div.innerHTML = `
        <input type="text" placeholder="字段名" value="${esc(key)}" onchange="updateOptionalFieldKey(this)">
        <input type="text" placeholder="字段值" value="${esc(value)}" onchange="updateOptionalFieldValue(this)">
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
        toast('请先加载消息段类型', 'er');
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
        const altMsgField = document.querySelector('.optional-field input[placeholder="备用消息"]');
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
        toast('已复制到剪贴板', 'ok');
    }).catch(() => {
        toast('复制失败', 'er');
    });
}

async function previewEvent() {
    const event = buildEventData();
    
    showOutputModal('事件预览', [JSON.stringify(event, null, 2)], [
        { label: '确定', value: true, primary: true }
    ]);
}

async function submitEvent() {
    const event = buildEventData();
    
    // 验证
    const validation = await api('/api/builder/validate', {
        method: 'POST',
        body: JSON.stringify(event)
    });
    
    if (!validation || !validation.valid) {
        const errors = validation?.errors || ['验证失败'];
        showOutputModal('验证错误', errors, [{ label: '确定', value: true, primary: true }]);
        return;
    }
    
    // 提交
    const result = await api('/api/builder/submit', {
        method: 'POST',
        body: JSON.stringify(event)
    });
    
    if (result && result.success) {
        toast('事件已提交', 'ok');
    } else {
        toast('提交失败: ' + (result?.error || '未知错误'), 'er');
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
        toast('自动刷新已关闭', '');
    } else {
        loadLogs();
        _logAutoRefreshTimer = setInterval(loadLogs, 2000);
        document.getElementById('logAutoRefreshBtn').style.opacity = '1';
        toast('自动刷新已开启', 'ok');
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
        document.getElementById('logList').innerHTML = '<div class="empty-state"><p>暂无日志</p></div>';
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
    select.innerHTML = '<option value="">所有模块</option>';
    
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
        toast('已复制到剪贴板', 'ok');
    }).catch(() => {
        toast('复制失败', 'er');
    });
}

// ========== 生命周期功能 ==========

async function loadLifecycle() {
    const d = await api('/api/lifecycle');
    if (!d) return;
    
    const events = d.events || [];
    
    if (events.length === 0) {
        document.getElementById('lifecycleTimeline').innerHTML = '<div class="empty-state"><p>暂无生命周期事件</p></div>';
        return;
    }
    
    const timelineHtml = events.map((event, index) => {
        const eventParts = event.event.split('.');
        const eventType = eventParts[0] || '';
        const eventName = eventParts.slice(1).join('.');
        
        const time = new Date(event.timestamp * 1000).toLocaleTimeString();
        
        // 计算持续时间（如果有计时器数据）
        let duration = '';
        if (event.data && event.data.duration) {
            const dur = event.data.duration;
            duration = `<span class="lifecycle-duration">${dur.toFixed(2)}s</span>`;
        }
        
        // 判断事件类型
        let icon = '⚪';
        let statusClass = 'lifecycle-pending';
        
        if (eventType === 'core') {
            icon = '🔵';
            statusClass = 'lifecycle-core';
        } else if (eventType === 'module') {
            icon = '🟢';
            statusClass = 'lifecycle-module';
        } else if (eventType === 'adapter') {
            icon = '🟡';
            statusClass = 'lifecycle-adapter';
        } else if (eventType === 'server') {
            icon = '🟣';
            statusClass = 'lifecycle-server';
        }
        
        return `<div class="lifecycle-item ${statusClass}">
            <div class="lifecycle-icon">${icon}</div>
            <div class="lifecycle-content">
                <div class="lifecycle-header">
                    <span class="lifecycle-event">${esc(event.event)}</span>
                    <span class="lifecycle-time">${time}</span>
                </div>
                <div class="lifecycle-details">
                    <div class="lifecycle-desc">${esc(event.msg || eventName)}</div>
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
    
    // 确保 memory 对象存在
    const memory = system.memory || {};
    
    // 获取值，如果是 N/A 或字符串类型，尝试转换为数字
    let cpuPercent = memory.cpu_percent;
    if (typeof cpuPercent === 'string') {
        cpuPercent = parseFloat(cpuPercent) || 0;
    } else if (cpuPercent === null || cpuPercent === undefined) {
        cpuPercent = 0;
    }
    
    let rssMb = memory.rss_mb;
    if (typeof rssMb === 'string') {
        rssMb = parseFloat(rssMb) || 0;
    } else if (rssMb === null || rssMb === undefined) {
        rssMb = 0;
    }
    
    let sysPercent = memory.system_percent;
    if (typeof sysPercent === 'string') {
        sysPercent = parseFloat(sysPercent) || 0;
    } else if (sysPercent === null || sysPercent === undefined) {
        sysPercent = 0;
    }
    
    // 更新仪表盘上的性能卡片
    if (document.getElementById('cpuUsage')) {
        document.getElementById('cpuUsage').textContent = cpuPercent + '%';
    }
    if (document.getElementById('memUsage')) {
        document.getElementById('memUsage').textContent = rssMb + ' MB';
    }
    if (document.getElementById('sysMemUsage')) {
        document.getElementById('sysMemUsage').textContent = sysPercent + '%';
    }
    if (document.getElementById('wsConnections')) {
        document.getElementById('wsConnections').textContent = ws.active_connections || 0;
    }
}

// ========== API 路由功能 ==========

async function loadApiRoutes() {
    const d = await api('/api/routes');
    if (!d) return;
    
    const httpRoutes = d.http_routes || [];
    const wsRoutes = d.ws_routes || [];
    
    document.getElementById('httpRouteCount').textContent = httpRoutes.length;
    document.getElementById('wsRouteCount').textContent = wsRoutes.length;
    
    // HTTP 路由列表
    if (httpRoutes.length === 0) {
        document.getElementById('httpRouteList').innerHTML = '<div style="padding:16px;font-size:13px;color:var(--tx-s)">暂无 HTTP 路由</div>';
    } else {
        const httpHtml = httpRoutes.map(route => {
            const methodColor = {
                'GET': 'method-get',
                'POST': 'method-post',
                'PUT': 'method-put',
                'DELETE': 'method-delete',
                'PATCH': 'method-patch',
                'OPTIONS': 'method-options',
                'HEAD': 'method-head'
            }[route.method] || 'method-get';
            
            const handler = route.handler || {};
            const moduleBadge = route.module ? `<span class="chip chip-sc" style="margin-right:8px">${esc(route.module)}</span>` : '';
            const handlerInfo = handler.file !== 'unknown' 
                ? `<div style="font-size:11px;color:var(--tx-t);margin-top:2px">
                    <span style="font-family:monospace">${handler.name}()</span>
                    <br>
                    <span style="color:var(--tx-s)">${handler.file}:${handler.line}</span>
                   </div>` 
                : '';
            
            // 使用相对路径（去掉模块前缀）
            const apiPath = route.path;
            
            return `<div class="route-item" style="padding:12px 16px">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                    <span class="method-badge ${methodColor}">${route.method}</span>
                    ${moduleBadge}
                    <code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">${esc(apiPath)}</code>
                </div>
                ${handlerInfo}
            </div>`;
        }).join('');
        document.getElementById('httpRouteList').innerHTML = httpHtml;
    }
    
    // WebSocket 路由列表
    if (wsRoutes.length === 0) {
        document.getElementById('wsRouteList').innerHTML = '<div style="padding:16px;font-size:13px;color:var(--tx-s)">暂无 WebSocket 路由</div>';
    } else {
        const wsHtml = wsRoutes.map(route => {
            const moduleBadge = route.module ? `<span class="chip chip-sc" style="margin-right:8px">${esc(route.module)}</span>` : '';
            const handler = route.handler || {};
            const authBadge = route.has_auth ? `<span class="chip chip-wr" style="margin-right:8px">需认证</span>` : '';
            const handlerInfo = handler.file !== 'unknown'
                ? `<div style="font-size:11px;color:var(--tx-t);margin-top:2px">
                    <span style="font-family:monospace">${handler.name}()</span>
                    <br>
                    <span style="color:var(--tx-s)">${handler.file}:${handler.line}</span>
                   </div>`
                : '';
            
            // 使用相对路径（去掉模块前缀）
            const wsPath = route.path;
            
            return `<div class="route-item" style="padding:12px 16px">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                    <span class="method-badge method-ws">WS</span>
                    ${moduleBadge}
                    ${authBadge}
                    <code style="font-size:13px;font-weight:500;background:var(--bg-s);padding:2px 6px;border-radius:4px">${esc(wsPath)}</code>
                </div>
                ${handlerInfo}
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
    document.getElementById('msgTypeStats').innerHTML = typeHtml || '<div style="color:var(--tx-s);font-size:13px">暂无数据</div>';
    
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
    document.getElementById('msgPlatformStats').innerHTML = platformHtml || '<div style="color:var(--tx-s);font-size:13px">暂无数据</div>';
    
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
        
        hourlyHtml.push(`<div style="flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px">
            <div style="width:12px;height:${height}%;background:var(--accent);border-radius:2px;min-height:2px;transition:height 0.3s"></div>
            <span style="font-size:10px;color:var(--tx-t)">${hourLabel}</span>
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