(function () {
    'use strict';

    (function () {
        var _store = {};
        try { localStorage.setItem('__ep_test__', '1'); localStorage.removeItem('__ep_test__'); }
        catch (e) {
            var _ls = {
                getItem: function (k) { return _store.hasOwnProperty(k) ? _store[k] : null; },
                setItem: function (k, v) { _store[k] = String(v); },
                removeItem: function (k) { delete _store[k]; },
                clear: function () { _store = {}; }
            };
            Object.defineProperty(window, 'localStorage', { value: _ls, configurable: true });
        }
    })();

    var DEMO_TOKEN = 'demo';
    var _DEMO_MODE = true;
    var _mockEvents = [];
    var _wsTimer = null;

    var NOW = Date.now() / 1000;
    var START_TIME = NOW - (3 * 86400 + 7 * 3600 + 42 * 60);

    function _r(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function _pick(arr) { return arr[_r(0, arr.length - 1)]; }
    function _delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    var ADAPTERS = ['qq', 'telegram', 'discord', 'onebot', 'kook'];
    var BOT_NAMES = { qq: '小Q酱', telegram: 'EP_Bot', discord: 'ErisPulse#0001', kook: 'ErisBot' };
    var USERS = ['user_001', 'user_002', 'user_101', 'user_202', 'user_303', 'user_404', 'user_555'];
    var GROUPS = ['group_1001', 'group_1002', 'group_2001', 'group_3001'];
    var MSGS = [
        '你好呀！', '/help', '今天天气怎么样？', '/weather 北京', '哈哈哈太好笑了',
        '有人在线吗？', '/status', '晚安~', '早上好！', '这是什么功能？',
        '帮我查一下天气', '/echo Hello World', '今天吃什么好呢？', '测试消息',
        '收到！', '好的好的', '了解一下', '看看这个', '666', '牛啊'
    ];
    var NOTICE_TYPES = ['group_increase', 'group_decrease', 'friend_add', 'group_ban', 'group_admin'];
    var REQUEST_TYPES = ['friend', 'group_invite'];
    var META_TYPES = ['heartbeat', 'lifecycle'];
    var LOG_MODULES = ['Dashboard', 'Core', 'EchoTest', 'AutoReply', 'Scheduler', 'Server', 'Adapter.qq', 'Adapter.telegram'];
    var LOG_LEVELS = ['DEBUG', 'INFO', 'INFO', 'INFO', 'WARNING', 'ERROR'];
    var LOG_MSGS = [
        'Module loaded successfully', 'Event dispatched: message/private',
        'Bot online: qq/bot_001', 'Command executed: /help',
        'Configuration updated', 'Adapter started: telegram',
        'Connection established', 'Processing message from user_001',
        'Heartbeat received', 'Cache cleared',
        'Rate limit approaching', 'Retry connection in 5s',
        'Token verified', 'WebSocket client connected',
        'Module unloaded: test_module', 'Response sent to group_1001',
        'Scheduled task executed', 'Storage cleanup completed',
        'Failed to parse message segment', 'Timeout waiting for response',
        'Package installed: ErisPulse-Weather', 'Lifecycle event: module.load'
    ];

    function _genEvents(count) {
        var events = [];
        for (var i = 0; i < count; i++) {
            var typeRoll = Math.random();
            var type, detailType, platform, altMessage;
            if (typeRoll < 0.7) {
                type = 'message';
                detailType = _pick(['private', 'group', 'group', 'private', 'channel']);
                platform = _pick(ADAPTERS.filter(function (a) { return a !== 'onebot'; }));
                altMessage = _pick(MSGS);
            } else if (typeRoll < 0.85) {
                type = 'notice';
                detailType = _pick(NOTICE_TYPES);
                platform = _pick(ADAPTERS);
                altMessage = detailType;
            } else if (typeRoll < 0.93) {
                type = 'request';
                detailType = _pick(REQUEST_TYPES);
                platform = _pick(ADAPTERS);
                altMessage = detailType;
            } else {
                type = 'meta';
                detailType = _pick(META_TYPES);
                platform = _pick(ADAPTERS);
                altMessage = detailType;
            }
            events.push({
                id: 'evt_' + _r(10000, 99999),
                time: NOW - _r(0, 3600 * 24),
                type: type,
                detail_type: detailType,
                platform: platform,
                sub_type: '',
                self_id: 'bot_' + _r(1, 5),
                user_id: _pick(USERS),
                group_id: detailType === 'group' || detailType === 'group_increase' ? _pick(GROUPS) : '',
                alt_message: altMessage
            });
        }
        events.sort(function (a, b) { return a.time - b.time; });
        return events;
    }

    function _genLogs(count) {
        var logs = [];
        for (var i = 0; i < count; i++) {
            logs.push({
                timestamp: NOW - _r(0, 3600 * 6),
                level: _pick(LOG_LEVELS),
                module: _pick(LOG_MODULES),
                message: _pick(LOG_MSGS)
            });
        }
        logs.sort(function (a, b) { return a.timestamp - b.timestamp; });
        return logs;
    }

    function _genLifecycle(count) {
        var eventTypes = [
            'core.init.start', 'core.init.complete', 'module.register', 'module.load',
            'module.init', 'adapter.load', 'adapter.start', 'adapter.status.change',
            'server.start', 'server.request', 'adapter.bot.online', 'command.matched',
            'command.executed', 'message.sending', 'message.sent'
        ];
        var items = [];
        for (var i = 0; i < count; i++) {
            var ev = _pick(eventTypes);
            items.push({
                event: ev,
                timestamp: START_TIME + i * _r(30, 600),
                data: { module: ev.split('.')[0] || '' },
                source: ev.split('.')[0] || '',
                msg: ev
            });
        }
        return items;
    }

    function _genAudit(count) {
        var actions = [
            'load_module', 'load_adapter', 'config_update', 'storage_set',
            'package_install', 'clear_events', 'restart_framework'
        ];
        var items = [];
        for (var i = 0; i < count; i++) {
            items.push({
                timestamp: NOW - _r(0, 3600 * 48),
                action: _pick(actions),
                detail: 'Demo audit entry #' + (i + 1),
                ip: '192.168.' + _r(1, 255) + '.' + _r(1, 255)
            });
        }
        items.sort(function (a, b) { return a.timestamp - b.timestamp; });
        return items;
    }

    _mockEvents = _genEvents(50);

    var STORE_DATA = {"last_updated":"2026-06-03T06:43:40Z","modules":{"Dashboard":{"package":"ErisPulse-Dashboard","version":"1.5.8","author":"ErisPulse","description":"ErisPulse 框架官方 Web 管理面板，提供系统监控、模块管理、配置编辑、事件流查看等功能","min_sdk_version":"2.4.0","repository":"https://github.com/ErisPulse/ErisPulse-Dashboard","official":true,"tags":["dashboard","webui","admin"]},"HelpModule":{"package":"ErisPulse-HelpModule","version":"2.1.0","author":"wsu2059q","description":"为统一的命令系统提供一个help命令，用来在平台查看现有命令","min_sdk_version":"2.2.0","repository":"https://github.com/wsu2059q/ErisPulse-HelpModule","official":false,"tags":["help","command"]},"Cron":{"package":"ErisPulse-Cron","version":"1.0.1","author":"wsu2059q","description":"ErisPulse 定时任务调度模块 - 支持一次性/间隔/Cron定时，回调传参，SQLite持久化","min_sdk_version":"2.4.3","repository":"https://github.com/wsu2059q/ErisPulse-Cron","official":false,"tags":["cron","scheduler"]},"OpenAI":{"package":"ErisPulse-OpenAI","version":"2.1.3","author":"wsu2059q","description":"ErisPulse OpenAI 通用接口封装模块","min_sdk_version":"2.0.0","repository":"https://github.com/ErisPulse/ErisPulse-OpenAI","official":true,"tags":["OpenAI","AI"]},"Weather":{"package":"ErisPulse-Weather","version":"1.2.0","author":"ShanFish","description":"天气查询，支持绑定城市、今日天气、五日天气","min_sdk_version":"2.0.0","repository":"https://github.com/shanfishapp/ErisPulse-Weather","official":false,"tags":["天气","Weather"]},"QvQChat":{"package":"ErisPulse-QvQChat","version":"2.3.1","author":"wsu2059q","description":"一个基于多AI协同的智能对话模块，让AI像真人一样自然参与聊天","min_sdk_version":"2.3.0","repository":"https://github.com/wsu2059q/ErisPulse-QvQChat","official":false,"tags":["AI"]},"GitHubParser":{"package":"ErisPulse-GitHubParser","version":"2.0.1","author":"wsu2059q","description":"GitHub链接解析模块，自动解析消息中的仓库/Issue/PR信息并以最佳格式展示","min_sdk_version":"2.1.10","repository":"https://github.com/wsu2059q/ErisPulse-GitHubParser","official":false,"tags":["github","解析"]},"Feedback":{"package":"ErisPulse-Feedback","version":"1.1.2","author":"wsu2059","description":"ErisPulse 反馈系统模块，支持反馈提交、状态管理、多群聊反馈组和数据导入导出","min_sdk_version":"2.3.0","repository":"https://github.com/wsu2059q/ErisPulse-Feedback","official":false,"tags":["反馈","feedback"]},"NekoCare":{"package":"ErisPulse-NekoCare","version":"2.2.1","author":"wsu2059q, lin","description":"NekoCare - 虚拟猫猫养成模块","min_sdk_version":"2.2.0","repository":"https://github.com/wsu2059q/ErisPulse-NekoCare","official":false,"tags":["neko","virtual-pet"]},"DFAFilter":{"package":"ErisPulse-DFAFilter","version":"2.0.0","author":"wsu2059q","description":"基于DFA算法的敏感词过滤模块，支持实时检测、自动替换和动态更新词库","min_sdk_version":"2.1.14-alpha.1","repository":"https://github.com/wsu2059q/ErisPulse-DFAFilter","official":false,"tags":["敏感词过滤","DFA"]},"RssReader":{"package":"ErisPulse-RssReader","version":"1.1.1","author":"wsu2059q","description":"RSS订阅器模块——在聊天中订阅任意RSS/Atom源，自动推送更新","min_sdk_version":"2.0.0","repository":"https://github.com/ErisPulse/ErisPulse-RssReader","official":false,"tags":["rss","atom","订阅"]},"BiliParser":{"package":"ErisPulse-BiliParser","version":"1.0.4","author":"wsu2059q","description":"B站视频解析模块，自动解析消息中的B站视频链接并展示详细信息","min_sdk_version":"2.4.0","repository":"https://github.com/wsu2059q/ErisPulse-BiliParser","official":false,"tags":["bilibili","解析"]},"Raffle":{"package":"ErisPulse-Raffle","version":"1.0.1","author":"ErisPulse","description":"通用抽奖模块 - Dashboard可视化管理、群聊关键词报名、开奖动画、广播通知","min_sdk_version":"2.4.0","repository":"https://github.com/ErisPulse/ErisPulse-Raffle","official":true,"tags":["抽奖","raffle"]}},"adapters":{"Yunhu":{"package":"ErisPulse-YunhuAdapter","author":"wsu2059q","version":"3.10.5","description":"云湖协议适配模块","repository":"https://github.com/ErisPulse/ErisPulse-YunhuAdapter","official":true,"tags":["adapter","yunhu"]},"OneBot11":{"package":"ErisPulse-OneBot11Adapter","author":"wsu2059q","version":"3.7.0","description":"OneBot11协议适配模块","repository":"https://github.com/ErisPulse/ErisPulse-OneBot11Adapter","official":true,"tags":["adapter","onebot11"]},"Telegram":{"package":"ErisPulse-TelegramAdapter","author":"wsu2059q","version":"3.6.12","description":"Telegram协议适配模块","repository":"https://github.com/ErisPulse/ErisPulse-TelegramAdapter","official":true,"tags":["adapter","telegram"]},"Kook":{"package":"ErisPulse-KookAdapter","author":"ShanFish","version":"0.2.1","description":"基于开源机器人框架 ErisPulse 的 Kook(开黑啦) 机器人适配器","repository":"https://github.com/shanfishapp/ErisPulse-KookAdapter","official":true,"tags":["adapter","kook"]},"Matrix":{"package":"ErisPulse-MatrixAdapter","author":"wsu2059","version":"1.0.0","description":"ErisPulse的Matrix协议适配模块","repository":"https://github.com/ErisPulse/ErisPulse-MatrixAdapter","official":true,"tags":["adapter","matrix"]}}};

    var _installedVersions = {
        'erispulse-dashboard': '1.5.8',
        'erispulse-echotest': '1.0.0',
        'erispulse-autoreply': '2.1.0',
        'erispulse-scheduler': '0.9.2'
    };

    var API_MAP = {};

    function _json(data, delay) {
        delay = delay || _r(20, 80);
        return new Promise(function (resolve) {
            setTimeout(function () {
                var resp = new Response(JSON.stringify(data), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
                resolve(resp);
            }, delay);
        });
    }

    API_MAP['/api/auth/status'] = function () {
        var tk = localStorage.getItem('__ep_tk__');
        return _json({ authenticated: tk === DEMO_TOKEN });
    };

    API_MAP['/api/auth'] = function (opts) {
        try {
            var body = JSON.parse(opts.body);
            if (body.token === DEMO_TOKEN) {
                return _json({ success: true });
            }
        } catch (e) { }
        return new Promise(function (resolve) {
            resolve(new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
        });
    };

    API_MAP['/api/status'] = function () {
        return _json({
            framework: { version: '2.4.6', python_version: '3.13.0' },
            adapters: {
                qq: { status: 'started', bots: { bot_001: { status: 'online', last_active: NOW - 10, info: { user_name: '小Q酱', nickname: '小Q酱' } }, bot_002: { status: 'online', last_active: NOW - 120, info: { user_name: 'Q助手', nickname: 'Q助手' } } } },
                telegram: { status: 'started', bots: { bot_001: { status: 'online', last_active: NOW - 30, info: { user_name: 'EP_Bot', nickname: 'EP_Bot' } } } },
                discord: { status: 'started', bots: { bot_001: { status: 'online', last_active: NOW - 60, info: { user_name: 'ErisPulse#0001', nickname: 'ErisPulse' } } } },
                onebot: { status: 'stopped', bots: {} },
                kook: { status: 'started', bots: { bot_001: { status: 'online', last_active: NOW - 300, info: { user_name: 'ErisBot', nickname: 'ErisBot' } } } }
            },
            modules: { Dashboard: true, EchoTest: true, AutoReply: true, AdminTools: false, Scheduler: true, WebhookRelay: false }
        });
    };

    API_MAP['/api/system'] = function () {
        return _json({
            uptime_seconds: Math.floor(NOW - START_TIME),
            uptime_human: '3d 7h 42m',
            platform: 'Linux',
            platform_release: '6.1.0',
            platform_machine: 'x86_64',
            pid: 12345,
            memory: { rss_mb: 156.3, vms_mb: 412.8, cpu_percent: 23.5, system_percent: 42.1, system_total_gb: 16.0, system_available_gb: 9.3, system_cpu_percent: 15.2, swap_percent: 8.3, swap_used_mb: 328.5 },
            process: { threads: 12, open_files: 42, cpu_user: 145.23, cpu_system: 38.67, read_bytes_mb: 89.2, write_bytes_mb: 34.7, connections: 8, listening: 2, created: START_TIME },
            event_counts: { message: 347, notice: 89, request: 23, meta: 156 },
            total_events: 615
        });
    };

    API_MAP['/api/adapters'] = function () {
        return _json({
            adapters: [
                { platform: 'qq', enabled: true, running: true, bots: [{ bot_id: 'bot_001', status: 'online', last_active: NOW - 10, info: { user_name: '小Q酱' } }, { bot_id: 'bot_002', status: 'online', last_active: NOW - 120, info: { user_name: 'Q助手' } }] },
                { platform: 'telegram', enabled: true, running: true, bots: [{ bot_id: 'bot_001', status: 'online', last_active: NOW - 30, info: { user_name: 'EP_Bot' } }] },
                { platform: 'discord', enabled: true, running: true, bots: [{ bot_id: 'bot_001', status: 'online', last_active: NOW - 60, info: { user_name: 'ErisPulse#0001' } }] },
                { platform: 'onebot', enabled: false, running: false, bots: [] },
                { platform: 'kook', enabled: true, running: true, bots: [{ bot_id: 'bot_001', status: 'online', last_active: NOW - 300, info: { user_name: 'ErisBot' } }] }
            ]
        });
    };

    API_MAP['/api/adapter-logos'] = function () {
        var logos = {};
        var names = ['qq', 'telegram', 'discord', 'onebot', 'kook', 'yunhu', 'websocket', 'matrix', 'mail', 'http', 'github', 'slack'];
        names.forEach(function (n) { logos[n] = 'res/adapter_logo/' + n + '.png'; });
        return _json({ logos: logos });
    };

    API_MAP['/api/modules'] = function () {
        return _json({
            modules: [
                { name: 'Dashboard', type: 'module', enabled: true, loaded: true, version: '1.5.8', author: 'ErisPulse', description: 'Web 管理面板', package: 'ErisPulse-Dashboard' },
                { name: 'EchoTest', type: 'module', enabled: true, loaded: true, version: '1.0.0', author: 'ErisPulse', description: '消息回显测试模块', package: 'ErisPulse-EchoTest' },
                { name: 'AutoReply', type: 'module', enabled: true, loaded: true, version: '2.1.0', author: 'wsu2059q', description: '自动回复模块', package: 'ErisPulse-AutoReply' },
                { name: 'AdminTools', type: 'module', enabled: true, loaded: false, version: '1.3.0', author: 'ErisPulse', description: '管理工具集', package: 'ErisPulse-AdminTools' },
                { name: 'Scheduler', type: 'module', enabled: true, loaded: true, version: '0.9.2', author: 'wsu2059q', description: '定时任务调度', package: 'ErisPulse-Scheduler' },
                { name: 'WebhookRelay', type: 'module', enabled: false, loaded: false, version: '1.0.0', author: 'ErisPulse', description: 'Webhook 转发模块', package: 'ErisPulse-WebhookRelay' },
                { name: 'qq', type: 'adapter', enabled: true, loaded: true, version: '3.5.0', author: 'ErisPulse', description: 'QQ 适配器' },
                { name: 'telegram', type: 'adapter', enabled: true, loaded: true, version: '3.6.12', author: 'ErisPulse', description: 'Telegram 适配器' },
                { name: 'discord', type: 'adapter', enabled: true, loaded: true, version: '1.2.0', author: 'ErisPulse', description: 'Discord 适配器' },
                { name: 'onebot', type: 'adapter', enabled: false, loaded: false, version: '1.0.0', author: 'ErisPulse', description: 'OneBot 适配器' },
                { name: 'kook', type: 'adapter', enabled: true, loaded: true, version: '0.2.1', author: 'ShanFish', description: 'Kook 适配器' }
            ]
        });
    };

    API_MAP['/api/bots'] = function () {
        return _json({
            bots: [
                { bot_id: 'bot_001', platform: 'qq', status: 'online', last_active: NOW - 10, info: { user_name: '小Q酱', nickname: '小Q酱' } },
                { bot_id: 'bot_002', platform: 'qq', status: 'online', last_active: NOW - 120, info: { user_name: 'Q助手', nickname: 'Q助手' } },
                { bot_id: 'bot_001', platform: 'telegram', status: 'online', last_active: NOW - 30, info: { user_name: 'EP_Bot', nickname: 'EP_Bot' } },
                { bot_id: 'bot_001', platform: 'discord', status: 'online', last_active: NOW - 60, info: { user_name: 'ErisPulse#0001', nickname: 'ErisPulse' } },
                { bot_id: 'bot_001', platform: 'kook', status: 'online', last_active: NOW - 300, info: { user_name: 'ErisBot', nickname: 'ErisBot' } }
            ]
        });
    };

    API_MAP['/api/events'] = function (opts, url) {
        var params = new URLSearchParams(url.split('?')[1] || '');
        var type = params.get('type') || '';
        var platform = params.get('platform') || '';
        var limit = parseInt(params.get('limit') || '100');
        var filtered = _mockEvents;
        if (type) filtered = filtered.filter(function (e) { return e.type === type; });
        if (platform) filtered = filtered.filter(function (e) { return e.platform === platform; });
        return _json({ events: filtered.slice(-limit), total_count: _mockEvents.length + 565 });
    };

    API_MAP['/api/events/clear'] = function () {
        _mockEvents = [];
        return _json({ success: true });
    };

    API_MAP['/api/logs'] = function (opts, url) {
        var params = new URLSearchParams(url.split('?')[1] || '');
        var module = params.get('module') || '';
        var level = params.get('level') || '';
        var search = params.get('search') || '';
        var logs = _genLogs(80);
        if (module) logs = logs.filter(function (l) { return l.module === module; });
        if (level) logs = logs.filter(function (l) { return l.level === level; });
        if (search) logs = logs.filter(function (l) { return l.message.toLowerCase().indexOf(search.toLowerCase()) !== -1; });
        return _json({ logs: logs, total: logs.length });
    };

    API_MAP['/api/logs/clear'] = function () { return _json({ success: true }); };

    API_MAP['/api/lifecycle'] = function (opts, url) {
        var params = new URLSearchParams(url.split('?')[1] || '');
        var source = params.get('source') || '';
        var items = _genLifecycle(30);
        if (source) items = items.filter(function (l) { return (l.source || '').indexOf(source) !== -1 || (l.event || '').indexOf(source) !== -1; });
        return _json({ events: items });
    };

    API_MAP['/api/lifecycle/clear'] = function () { return _json({ success: true }); };

    API_MAP['/api/performance'] = function () {
        return _json({
            cpu_percent: 23.5,
            memory: { rss_mb: 156.3, vms_mb: 412.8, system_percent: 42.1, system_total_gb: 16.0, system_available_gb: 9.3, system_cpu_percent: 15.2, swap_percent: 8.3, swap_used_mb: 328.5 },
            process: { threads: 12, connections: 8, cpu_user: 145.23, cpu_system: 38.67, read_bytes_mb: 89.2, write_bytes_mb: 34.7 },
            uptime_seconds: Math.floor(NOW - START_TIME),
            uptime_human: '3d 7h 42m'
        });
    };

    API_MAP['/api/audit'] = function () { return _json({ logs: _genAudit(20) }); };
    API_MAP['/api/audit/clear'] = function () { return _json({ success: true }); };

    API_MAP['/api/config'] = function () {
        return _json({
            config: {
                Dashboard: { title: 'ErisPulse Dashboard', max_event_log: 500, token: '***' },
                EchoTest: { enabled: true },
                AutoReply: { enabled: true, rules_file: 'rules.yaml' },
                Scheduler: { enabled: true, max_tasks: 50 },
                AdminTools: { enabled: true, admin_users: ['user_001'] },
                WebhookRelay: { enabled: false }
            }
        });
    };

    API_MAP['/api/config'] = function (opts) {
        if (opts && opts.method === 'PUT') return _json({ success: true });
        return _json({
            config: {
                Dashboard: { title: 'ErisPulse Dashboard', max_event_log: 500, token: '***' },
                EchoTest: { enabled: true },
                AutoReply: { enabled: true, rules_file: 'rules.yaml' },
                Scheduler: { enabled: true, max_tasks: 50 },
                AdminTools: { enabled: true, admin_users: ['user_001'] },
                WebhookRelay: { enabled: false }
            }
        });
    };

    API_MAP['/api/config/source'] = function () {
        return _json({ source: '# ErisPulse Configuration\nserver:\n  host: "0.0.0.0"\n  port: 8000\n\nlogger:\n  level: "INFO"\n  log_files: []\n\nstorage:\n  use_global_db: false\n\nDashboard:\n  title: "ErisPulse Dashboard"\n  max_event_log: 500\n' });
    };

    API_MAP['/api/storage'] = function () {
        return _json({
            storage: {
                '__ep_events__': '[{"type":"message","platform":"qq"}]',
                '__ep_audit__': '[]',
                '__ep_command_rules__': '{}',
                'custom_data': '{"key":"value"}'
            }
        });
    };

    API_MAP['/api/storage'] = function (opts) {
        if (opts && opts.method === 'POST') return _json({ success: true });
        return _json({
            storage: {
                '__ep_events__': '[{"type":"message","platform":"qq"}]',
                '__ep_audit__': '[]',
                '__ep_command_rules__': '{}',
                'custom_data': '{"key":"value"}'
            }
        });
    };

    API_MAP['/api/storage/delete'] = function () { return _json({ success: true }); };

    API_MAP['/api/store/remote'] = function () {
        return _json({
            packages: {
                modules: STORE_DATA.modules,
                adapters: STORE_DATA.adapters
            },
            installed_versions: _installedVersions
        });
    };

    API_MAP['/api/store/install'] = function () { return _json({ success: true, task_id: 'mock_task_' + _r(1000, 9999) }); };
    API_MAP['/api/store/upload'] = function () { return _json({ success: true, task_id: 'mock_upload_' + _r(1000, 9999) }); };
    API_MAP['/api/store/install/status'] = function () { return _json({ status: 'success' }); };
    API_MAP['/api/store/package/detail'] = function () { return _json({ name: 'Demo Package', version: '1.0.0', description: 'Demo package detail', dependencies: [], versions: ['1.0.0', '0.9.0'] }); };

    API_MAP['/api/packages'] = function () {
        return _json({
            packages: [
                { name: 'ErisPulse-Dashboard', version: '1.5.8', summary: 'Web dashboard', type: 'module', package: 'ErisPulse-Dashboard' },
                { name: 'ErisPulse-EchoTest', version: '1.0.0', summary: 'Echo test module', type: 'module', package: 'ErisPulse-EchoTest' },
                { name: 'ErisPulse-AutoReply', version: '2.1.0', summary: 'Auto reply module', type: 'module', package: 'ErisPulse-AutoReply' },
                { name: 'ErisPulse-Scheduler', version: '0.9.2', summary: 'Task scheduler', type: 'module', package: 'ErisPulse-Scheduler' },
                { name: 'ErisPulse-QQAdapter', version: '3.5.0', summary: 'QQ adapter', type: 'adapter', package: 'ErisPulse-QQAdapter' },
                { name: 'ErisPulse-TelegramAdapter', version: '3.6.12', summary: 'Telegram adapter', type: 'adapter', package: 'ErisPulse-TelegramAdapter' },
                { name: 'requests', version: '2.31.0', summary: 'HTTP library', type: 'library', package: 'requests' },
                { name: 'psutil', version: '5.9.5', summary: 'System utilities', type: 'library', package: 'psutil' },
                { name: 'fastapi', version: '0.104.1', summary: 'Web framework', type: 'library', package: 'fastapi' },
                { name: 'uvicorn', version: '0.24.0', summary: 'ASGI server', type: 'library', package: 'uvicorn' }
            ]
        });
    };

    API_MAP['/api/packages/updates'] = function () {
        return _json({
            updates: [
                { package: 'ErisPulse-AutoReply', current: '2.1.0', latest: '2.2.0', type: 'module' },
                { package: 'fastapi', current: '0.104.1', latest: '0.105.0', type: 'library' }
            ]
        });
    };

    API_MAP['/api/packages/upgrade'] = function () { return _json({ success: true, task_id: 'mock_upgrade_' + _r(1000, 9999) }); };
    API_MAP['/api/packages/install'] = function () { return _json({ success: true, task_id: 'mock_install_' + _r(1000, 9999) }); };
    API_MAP['/api/packages/uninstall'] = function () { return _json({ success: true }); };

    API_MAP['/api/framework/versions'] = function () {
        return _json({ current: '2.4.6', latest: '2.4.6', versions: ['2.4.6', '2.4.5', '2.4.4', '2.4.3'] });
    };

    API_MAP['/api/framework/update'] = function () { return _json({ success: true, task_id: 'mock_fw_update' }); };
    API_MAP['/api/restart'] = function () { return _json({ success: true }); };
    API_MAP['/api/modules/action'] = function () { return _json({ success: true }); };

    API_MAP['/api/builder/validate'] = function () { return _json({ valid: true }); };
    API_MAP['/api/builder/submit'] = function () { return _json({ success: true }); };
    API_MAP['/api/builder/segments'] = function () {
        return _json({
            segments: [
                { type: 'text', name: '文本', fields: [{ key: 'text', label: '文本内容', type: 'string' }] },
                { type: 'image', name: '图片', fields: [{ key: 'file', label: '图片URL', type: 'string' }] },
                { type: 'at', name: '@', fields: [{ key: 'user_id', label: '用户ID', type: 'string' }] },
                { type: 'reply', name: '回复', fields: [{ key: 'message_id', label: '消息ID', type: 'string' }] },
                { type: 'face', name: '表情', fields: [{ key: 'id', label: '表情ID', type: 'string' }] }
            ]
        });
    };

    API_MAP['/api/routes'] = function () {
        return _json({
            http_routes: [
                { path: '/', full_path: '/Dashboard/', method: 'GET', module: 'Dashboard', handler: { name: '_serve_index', file: 'Core.py', line: 1 } },
                { path: '/api/status', full_path: '/Dashboard/api/status', method: 'GET', module: 'Dashboard', handler: { name: '_api_status', file: 'Core.py', line: 800 } },
                { path: '/api/system', full_path: '/Dashboard/api/system', method: 'GET', module: 'Dashboard', handler: { name: '_api_system', file: 'Core.py', line: 850 } },
                { path: '/api/adapters', full_path: '/Dashboard/api/adapters', method: 'GET', module: 'Dashboard', handler: { name: '_api_adapters', file: 'Core.py', line: 870 } },
                { path: '/api/modules', full_path: '/Dashboard/api/modules', method: 'GET', module: 'Dashboard', handler: { name: '_api_modules', file: 'Core.py', line: 900 } },
                { path: '/api/events', full_path: '/Dashboard/api/events', method: 'GET', module: 'Dashboard', handler: { name: '_api_events', file: 'Core.py', line: 920 } },
                { path: '/api/config', full_path: '/Dashboard/api/config', method: 'GET', module: 'Dashboard', handler: { name: '_api_config_get', file: 'Core.py', line: 940 } },
                { path: '/api/config', full_path: '/Dashboard/api/config', method: 'PUT', module: 'Dashboard', handler: { name: '_api_config_set', file: 'Core.py', line: 960 } },
                { path: '/api/routes', full_path: '/Dashboard/api/routes', method: 'GET', module: 'Dashboard', handler: { name: '_api_routes', file: 'Core.py', line: 980 } },
                { path: '/api/cluster/nodes', full_path: '/Dashboard/api/cluster/nodes', method: 'GET', module: 'Dashboard', handler: { name: '_api_cluster_nodes_list', file: 'Core.py', line: 1011 } },
                { path: '/api/cluster/nodes', full_path: '/Dashboard/api/cluster/nodes', method: 'POST', module: 'Dashboard', handler: { name: '_api_cluster_nodes_add', file: 'Core.py', line: 1012 } },
                { path: '/api/cluster/overview', full_path: '/Dashboard/api/cluster/overview', method: 'GET', module: 'Dashboard', handler: { name: '_api_cluster_overview', file: 'Core.py', line: 1019 } },
                { path: '/api/store/remote', full_path: '/Dashboard/api/store/remote', method: 'GET', module: 'Dashboard', handler: { name: '_api_store_remote', file: 'Core.py', line: 1035 } },
                { path: '/api/restart', full_path: '/Dashboard/api/restart', method: 'POST', module: 'Dashboard', handler: { name: '_api_restart', file: 'Core.py', line: 1050 } },
                { path: '/api/health', full_path: '/api/health', method: 'GET', module: 'Core', handler: { name: '_health_check', file: 'server.py', line: 100 } }
            ],
            ws_routes: [
                { path: '/ws', full_path: '/Dashboard/ws', module: 'Dashboard', has_auth: true, handler: { name: '_ws_handler', file: 'Core.py', line: 780 } }
            ]
        });
    };

    API_MAP['/api/message-stats'] = function () {
        var hourly = [];
        for (var i = 0; i < 24; i++) hourly.push(_r(5, 80));
        return _json({
            type_stats: { text: 287, image: 42, at: 18, reply: 12, face: 8 },
            platform_stats: { qq: 156, telegram: 89, discord: 67, kook: 55 },
            hourly_trend: hourly
        });
    };

    API_MAP['/api/commands'] = function () {
        return _json({
            global_settings: { prefix: '/', case_sensitive: true, allow_space_prefix: false, must_at_bot: false },
            commands: [
                { name: 'help', help: '显示帮助信息', usage: '/help [命令名]', group: '通用', hidden: false, original_aliases: ['帮助'], custom_aliases: [], enabled: true, allowed_platforms: [], blocked_platforms: [], transform_to: null },
                { name: 'echo', help: '回显消息', usage: '/echo <内容>', group: '测试', hidden: false, original_aliases: [], custom_aliases: ['say'], enabled: true, allowed_platforms: [], blocked_platforms: [], transform_to: null },
                { name: 'weather', help: '查询天气', usage: '/weather <城市>', group: '工具', hidden: false, original_aliases: ['天气'], custom_aliases: [], enabled: true, allowed_platforms: [], blocked_platforms: [], transform_to: null },
                { name: 'status', help: '查看系统状态', usage: '/status', group: '管理', hidden: false, original_aliases: ['状态'], custom_aliases: [], enabled: true, allowed_platforms: [], blocked_platforms: [], transform_to: null },
                { name: 'admin', help: '管理命令', usage: '/admin <操作>', group: '管理', hidden: true, original_aliases: [], custom_aliases: [], enabled: false, allowed_platforms: ['qq', 'telegram'], blocked_platforms: [], transform_to: null }
            ]
        });
    };

    API_MAP['/api/views'] = function () { return _json({ views: [] }); };

    var _mockClusterNodes = [
        {
            id: 'node_a',
            name: '生产节点 A',
            url: 'http://192.168.1.100:8000/Dashboard',
            enabled: true,
            online: true,
            latency_ms: 12,
            dashboard_version: '1.5.8',
            capabilities: { status: { supported: true }, system: { supported: true }, adapters: { supported: true }, modules: { supported: true }, bots: { supported: true }, events: { supported: true }, config: { supported: true }, storage: { supported: true }, store: { supported: true }, packages: { supported: true }, logs: { supported: true }, lifecycle: { supported: true }, audit: { supported: true }, files: { supported: true }, commands: { supported: true }, event_builder: { supported: false }, config_source: { supported: true }, module_views: { supported: false }, performance: { supported: true }, routes: { supported: true }, message_stats: { supported: true }, framework_update: { supported: true } }
        },
        {
            id: 'node_b',
            name: '测试节点 B',
            url: 'http://10.0.0.50:8000/Dashboard',
            enabled: true,
            online: false,
            latency_ms: -1,
            dashboard_version: '1.5.6',
            capabilities: { status: { supported: true }, system: { supported: true }, adapters: { supported: true }, modules: { supported: true } }
        }
    ];

    API_MAP['/api/cluster/nodes'] = function (opts) {
        if (opts && opts.method === 'POST') {
            return _json({ success: true, node: { id: 'new_node', name: 'New Node', url: 'http://example.com:8000/Dashboard', enabled: true, online: false, latency_ms: -1 } });
        }
        return _json({
            nodes: _mockClusterNodes,
            local: { id: 'local', name: '本地实例' }
        });
    };

    API_MAP['/api/cluster/overview'] = function () {
        var fw = { version: '2.4.3', python_version: '3.13.0' };
        var adaptersSummary = {
            qq: { running: true, bot_count: 2 },
            telegram: { running: true, bot_count: 1 },
            discord: { running: true, bot_count: 1 },
            onebot: { running: false, bot_count: 0 },
            kook: { running: true, bot_count: 1 }
        };
        var modules = { Dashboard: true, EchoTest: true, AutoReply: true, AdminTools: false, Scheduler: true, WebhookRelay: false };
        return _json({
            nodes: {
                local: {
                    online: true,
                    name: '本地实例',
                    latency_ms: 0,
                    dashboard_version: '1.5.8',
                    status: {
                        framework: fw,
                        adapters: adaptersSummary,
                        modules: modules,
                        adapters_count: 4,
                        modules_count: 4,
                        events_count: 615
                    },
                    system: {
                        uptime_seconds: Math.floor(NOW - START_TIME),
                        uptime_human: '3d 7h 42m',
                        memory: { rss_mb: 156.3, vms_mb: 412.8, cpu_percent: 23.5, system_percent: 42.1, system_total_gb: 16.0, system_available_gb: 9.3 },
                        process: { threads: 12, connections: 8 },
                        total_events: 615
                    }
                },
                node_a: {
                    online: true,
                    name: '生产节点 A',
                    latency_ms: 12,
                    dashboard_version: '1.5.8',
                    status: {
                        framework: { version: '2.4.2', python_version: '3.12.0' },
                        adapters: { qq: { running: true, bot_count: 1 }, telegram: { running: true, bot_count: 1 } },
                        modules: { Dashboard: true, EchoTest: true },
                        adapters_count: 2,
                        modules_count: 2,
                        events_count: 340
                    },
                    system: {
                        uptime_seconds: 180000,
                        uptime_human: '2d 2h 0m',
                        memory: { rss_mb: 98.5, vms_mb: 310.2, cpu_percent: 18.3, system_percent: 35.6, system_total_gb: 8.0, system_available_gb: 5.1 },
                        process: { threads: 8, connections: 5 },
                        total_events: 340
                    }
                },
                node_b: {
                    online: false,
                    name: '测试节点 B',
                    _error: true
                }
            }
        });
    };

    API_MAP['/api/cluster/sync/events'] = function () { return _json({ success: true }); };

    API_MAP['/api/backup/export'] = function () {
        return _json({ config: { Dashboard: { title: 'ErisPulse Dashboard' } }, storage: {} });
    };
    API_MAP['/api/backup/import'] = function () { return _json({ success: true }); };

    API_MAP['/api/files/browse'] = function (opts, url) {
        var params = new URLSearchParams(url.split('?')[1] || '');
        var path = params.get('path') || '.';
        var entries = [
            { name: '..', type: 'dir', size: 0, modified: NOW - 86400, permissions: 'drwxr-xr-x' },
            { name: 'config', type: 'dir', size: 0, modified: NOW - 3600, permissions: 'drwxr-xr-x' },
            { name: 'data', type: 'dir', size: 0, modified: NOW - 7200, permissions: 'drwxr-xr-x' },
            { name: 'logs', type: 'dir', size: 0, modified: NOW - 1800, permissions: 'drwxr-xr-x' },
            { name: 'modules', type: 'dir', size: 0, modified: NOW - 600, permissions: 'drwxr-xr-x' },
            { name: 'pyproject.toml', type: 'file', size: 1024, modified: NOW - 86400, permissions: '-rw-r--r--' },
            { name: 'main.py', type: 'file', size: 512, modified: NOW - 43200, permissions: '-rw-r--r--' },
            { name: 'README.md', type: 'file', size: 2048, modified: NOW - 172800, permissions: '-rw-r--r--' },
            { name: '.env', type: 'file', size: 128, modified: NOW - 259200, permissions: '-rw-------' }
        ];
        return _json({ path: path, entries: entries });
    };

    API_MAP['/api/files/read'] = function () {
        return _json({ content: '# ErisPulse Project\nimport ErisPulse\n\nprint("Hello from ErisPulse!")\n', path: 'main.py', language: 'python' });
    };
    API_MAP['/api/files/write'] = function () { return _json({ success: true }); };
    API_MAP['/api/files/upload'] = function () { return _json({ success: true }); };
    API_MAP['/api/files/download'] = function () { return _json({ content: 'demo file content' }); };
    API_MAP['/api/files/mkdir'] = function () { return _json({ success: true }); };
    API_MAP['/api/files/delete'] = function () { return _json({ success: true }); };
    API_MAP['/api/files/rename'] = function () { return _json({ success: true }); };
    API_MAP['/api/files/copy'] = function () { return _json({ success: true }); };
    API_MAP['/api/files/chmod'] = function () { return _json({ success: true }); };
    API_MAP['/api/files/stat'] = function () { return _json({ size: 1024, modified: NOW - 3600, permissions: '-rw-r--r--' }); };
    API_MAP['/api/files/search'] = function () { return _json({ results: [] }); };
    API_MAP['/api/files/compress'] = function () { return _json({ success: true }); };
    API_MAP['/api/files/decompress'] = function () { return _json({ success: true }); };

    var _realFetch = window.fetch;
    window.fetch = function (input, init) {
        if (typeof input === 'string' && input.indexOf('/api/') !== -1) {
            var url = input.replace(/^.*\/Dashboard/, '');
            var matchPath = url.split('?')[0];
            if (url.indexOf('/api/cluster/proxy/') === 0) {
                return _json({ error: 'node_not_found' }, 50);
            }
            if (matchPath.match(/\/api\/cluster\/nodes\/[^/]+\/ping$/)) {
                return _json({ online: Math.random() > 0.3, latency_ms: _r(5, 120) });
            }
            if (matchPath.match(/\/api\/cluster\/nodes\/[^/]+\/probe$/)) {
                return _json({ online: true, latency_ms: _r(5, 50), dashboard_version: '1.5.8', capabilities: {} });
            }
            if (matchPath.match(/\/api\/cluster\/nodes\/[^/]+\/status$/)) {
                return _json({ online: true, latency_ms: 12, dashboard_version: '1.5.8', status: {}, system: {}, capabilities: {} });
            }
            if (init && init.method === 'PUT' && matchPath.match(/\/api\/cluster\/nodes\//)) {
                return _json({ success: true, node: { id: matchPath.split('/').pop(), name: 'Updated Node', url: 'http://updated:8000/Dashboard', enabled: true } });
            }
            if (init && init.method === 'DELETE' && matchPath.match(/\/api\/cluster\/nodes\//)) {
                return _json({ success: true });
            }
            var handler = null;
            for (var key in API_MAP) {
                if (matchPath === key || matchPath.indexOf(key + '/') === 0) {
                    handler = API_MAP[key];
                    break;
                }
            }
            if (handler) {
                return handler(init || {}, input);
            }
            return _json({ error: 'not_found' }, 50);
        }
        return _realFetch.call(this, input, init);
    };

    window._mockWebSocket = function (url) {
        var self = this;
        this.url = url;
        this.readyState = 1;
        this.onopen = null;
        this.onclose = null;
        this.onerror = null;
        this.onmessage = null;

        setTimeout(function () {
            if (self.onopen) self.onopen({ type: 'open' });
        }, 100);

        this._interval = setInterval(function () {
            if (self.readyState !== 1 || !self.onmessage) return;
            var typeRoll = Math.random();
            var ev;
            if (typeRoll < 0.7) {
                ev = { id: 'evt_' + _r(10000, 99999), time: Date.now() / 1000, type: 'message', detail_type: _pick(['private', 'group']), platform: _pick(['qq', 'telegram', 'discord', 'kook']), sub_type: '', self_id: 'bot_001', user_id: _pick(USERS), group_id: '', alt_message: _pick(MSGS) };
            } else if (typeRoll < 0.85) {
                ev = { id: 'evt_' + _r(10000, 99999), time: Date.now() / 1000, type: 'notice', detail_type: _pick(NOTICE_TYPES), platform: _pick(ADAPTERS), sub_type: '', self_id: 'bot_001', user_id: '', group_id: '', alt_message: '' };
            } else {
                ev = { id: 'evt_' + _r(10000, 99999), time: Date.now() / 1000, type: 'meta', detail_type: 'heartbeat', platform: '', sub_type: '', self_id: '', user_id: '', group_id: '', alt_message: '' };
            }
            self.onmessage({ data: JSON.stringify({ type: 'event', data: ev }) });
        }, _r(3000, 8000));

        this.send = function (data) {
            try {
                var msg = JSON.parse(data);
                if (msg.type === 'pong') return;
            } catch (e) { }
        };

        this.close = function () {
            this.readyState = 3;
            clearInterval(this._interval);
            if (this.onclose) this.onclose({ type: 'close' });
        };
    };

    var _RealWebSocket = window.WebSocket;
    window.WebSocket = function (url) {
        if (url.indexOf('/ws') !== -1 || url.indexOf('/Dashboard/ws') !== -1) {
            return new window._mockWebSocket(url);
        }
        return new _RealWebSocket(url);
    };
    window.WebSocket.CONNECTING = 0;
    window.WebSocket.OPEN = 1;
    window.WebSocket.CLOSING = 2;
    window.WebSocket.CLOSED = 3;

    var _origXHR = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url) {
        if (typeof url === 'string' && url.indexOf('/api/store/upload') !== -1) {
            var self = this;
            this._isMockUpload = true;
            setTimeout(function () {
                Object.defineProperty(self, 'readyState', { value: 4, writable: false });
                Object.defineProperty(self, 'status', { value: 200, writable: false });
                Object.defineProperty(self, 'responseText', { value: JSON.stringify({ success: true, task_id: 'mock_upload_' + _r(1000, 9999) }), writable: false });
                if (self.onload) self.onload();
            }, 500);
            return;
        }
        return _origXHR.apply(this, arguments);
    };

    window.__DEMO_MODE__ = true;
    window.__DEMO_TOKEN__ = DEMO_TOKEN;

    (function () {
        function _toggleDemoBanner() {
            var app = document.querySelector('.app');
            var banner = document.getElementById('demoBanner');
            var header = document.querySelector('.header');
            if (!app || !banner) return;
            var show = app.classList.contains('authed');
            banner.style.display = show ? 'block' : 'none';
            if (header) header.style.marginTop = show ? '30px' : '';
            if (show && typeof applyI18n === 'function') applyI18n();
        }
        var _appEl = document.querySelector('.app');
        if (_appEl) {
            new MutationObserver(_toggleDemoBanner).observe(_appEl, { attributes: true, attributeFilter: ['class'] });
        } else {
            document.addEventListener('DOMContentLoaded', function () {
                var el = document.querySelector('.app');
                if (el) new MutationObserver(_toggleDemoBanner).observe(el, { attributes: true, attributeFilter: ['class'] });
            });
        }
    })();
})();
