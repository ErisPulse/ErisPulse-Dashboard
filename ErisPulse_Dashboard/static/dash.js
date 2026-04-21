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
    if (c && c.config) { window._kvData = c.config; document.getElementById('configBody').innerHTML = kvTree(c.config, 'config', '') };
    const s = await api('/api/storage');
    if (s) {
        document.getElementById('storageCount').textContent = (s.total || 0) + ' ' + t('total_events').replace('事件', '');
        const k = s.keys || [];
        document.getElementById('storageBody').innerHTML = k.length ? k.slice(0, 200).map(x => kvRow(esc(x), s.data[x], 'storage', x)).join('') : '<div class="empty-state"><p>' + t('empty_storage') + '</p></div>';
    }
}

function kvRow(k, v, mode, fk) {
    const tp = v === null ? 'null' : typeof v;
    const ds = tp === 'object' ? JSON.stringify(v) : String(v);
    const saveFn = mode === 'config' ? 'saveConfig(this)' : 'saveStorage(this)';
    const delBtn = mode === 'storage' ? '<button class="kv-btn kv-btn-del" onclick="delStorage(\'' + esc(fk) + '\',this)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>' : '';
    return '<div class="kv-row"><div class="kv-key">' + esc(k) + '</div><div class="kv-actions"><input class="kv-input" type="text" value="' + esc(ds) + '" data-key="' + esc(fk) + '" data-type="' + tp + '" onfocus="this.select()" onkeydown="if(event.key===\'Enter\'){event.preventDefault();' + saveFn + '}"><button class="kv-btn kv-btn-save" onclick="' + saveFn + '" title="Save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></button>' + delBtn + '</div></div>';
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

function loadAll() { refreshDashboard(); loadEvents(); loadBots(); loadModules(); loadConfig(); loadStore() }

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