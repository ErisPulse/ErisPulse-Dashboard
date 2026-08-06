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

    var ADAPTERS = ['Yunhu', 'OneBot11', 'Telegram', 'Discord', 'Kook'];
    var BOT_NAMES = { Yunhu: 'YunhuBot', OneBot11: 'OneBot11', Telegram: 'ErisPulseBot', Discord: 'ErisPulse#0001', Kook: 'ErisBot' };
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
    var LOG_MODULES = ['Dashboard', 'Core', 'HelpModule', 'Cron', 'Weather', 'OpenAI', 'Server', 'Adapter.onebot11', 'Adapter.telegram'];
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

var STORE_DATA = {"last_updated":"2026-08-05T05:18:07Z","modules":{"Dashboard":{"package":"ErisPulse-Dashboard","version":"1.9.1","author":"ErisPulse","description":"Web admin panel — system monitor, module management, config editor & event stream | Web 管理面板 — 系统监控、模块管理、配置编辑、事件流查看","min_sdk_version":"2.4.0","repository":"https://github.com/ErisPulse/ErisPulse-Dashboard","official":true,"tags":["dashboard","webui","admin","management","monitor"],"submitted_at":"2026-04-06T07:05:21Z"},"HelpModule":{"package":"ErisPulse-HelpModule","version":"2.1.2","author":"wsu2059q","description":"为统一的命令系统提供一个help命令，用来在平台查看现有命令","min_sdk_version":"2.2.0","repository":"https://github.com/wsu2059q/ErisPulse-HelpModule","official":false,"tags":["help","command","命令列表"],"submitted_at":"2026-01-25T12:57:42Z"},"Cron":{"package":"ErisPulse-Cron","version":"1.0.1","author":"wsu2059q","description":"ErisPulse 定时任务调度模块 - 支持一次性/间隔/Cron定时，回调传参，SQLite持久化","min_sdk_version":"2.4.3","repository":"https://github.com/wsu2059q/ErisPulse-Cron","official":false,"tags":["cron","定时任务","调度","scheduler"],"submitted_at":"2026-05-13T08:52:32Z"},"UmaMusume":{"package":"ErisPulse-UmaMusume","version":"1.0.0","author":"CyanTea","description":"ErisPulse的赛马娘主题机器人模块","min_sdk_version":"2.3.8","repository":"https://codeberg.org/ybr/ErisPulse-UmaMusume","official":false,"tags":["赛马娘","娱乐","塔罗牌"],"submitted_at":"2026-05-04T14:14:42Z"},"Feedback":{"package":"ErisPulse-Feedback","version":"1.1.2","author":"wsu2059","description":"ErisPulse 反馈系统模块，支持反馈提交、状态管理、多群聊反馈组和数据导入导出","min_sdk_version":"2.3.0","repository":"https://github.com/wsu2059q/ErisPulse-Feedback","official":false,"tags":["反馈","feedback","群组管理","权限控制"],"submitted_at":"2026-03-16T13:11:57Z"},"EditVideoPlayer":{"package":"ErisPulse-EditVideoPlayer","version":"1.0.1","author":"wsu2059q","description":"一个通用的视频播放器模块，可将视频转换为点阵字符并在支持消息编辑的平台上播放","min_sdk_version":"2.1.14-alpha.1","repository":"https://github.com/wsu2059q/ErisPulse-EditVideoPlayer","official":false,"tags":["player","视频播放","编辑消息","editor"],"submitted_at":"2026-01-25T12:57:42Z"},"InfoQuery":{"package":"ErisPulse-InfoQuery","version":"1.0.0","author":"wsu2059q","description":"信息统计查询模块，用于查询InfoStats收集的统计数据","min_sdk_version":"2.1.14-alpha.1","repository":"https://github.com/wsu2059q/ErisPulse-InfoQuery","official":false,"tags":["信息查询","InfoStats"],"submitted_at":"2026-01-25T12:57:42Z"},"XiaomiMarathon":{"package":"ErisPulse-XiaomiMarathon","version":"1.0.1","author":"wsu2059q","description":"小米马拉松模拟器","min_sdk_version":"2.1.10","repository":"https://github.com/wsu2059q/ErisPulse-XiaomiMarathon","official":false,"tags":["小米马拉松","小米"],"submitted_at":"2025-07-29T04:01:30Z"},"InfoStats":{"package":"ErisPulse-InfoStats","version":"1.0.0","author":"wsu2059q","description":"Event listener & statistics module for analytics | 信息统计模块 — 监听事件并统计分析","min_sdk_version":"2.1.14-alpha.1","repository":"https://github.com/wsu2059q/ErisPulse-InfoStats","official":true,"tags":["统计","monitoring","analytics","事件跟踪","data-analysis"],"submitted_at":"2026-01-25T12:57:42Z"},"GitHubParser":{"package":"ErisPulse-GitHubParser","version":"3.0.0","author":"wsu2059q","description":"GitHub链接解析模块，自动解析消息中的仓库/Issue/PR信息并以最佳格式展示","min_sdk_version":"2.1.10","repository":"https://github.com/wsu2059q/ErisPulse-GitHubParser","official":false,"tags":["github","解析"],"submitted_at":"2025-07-23T01:40:06Z"},"Weather":{"package":"ErisPulse-Weather","version":"1.2.0","author":"ShanFish","description":"天气查询，支持绑定城市、今日天气、五日天气","min_sdk_version":"2.0.0","repository":"https://github.com/shanfishapp/ErisPulse-Weather","official":false,"tags":["天气","Weather"],"submitted_at":"2025-07-20T18:05:38Z"},"QvQChat":{"package":"ErisPulse-QvQChat","version":"2.7.0","author":"wsu2059q","description":"一个基于多AI协同的智能对话模块，让AI像真人一样自然参与聊天","min_sdk_version":"2.3.0","repository":"https://github.com/wsu2059q/ErisPulse-QvQChat","official":false,"tags":["QvQChat","AI"],"submitted_at":"2026-01-25T12:57:42Z"},"OpenAI":{"package":"ErisPulse-OpenAI","version":"2.1.3","author":"wsu2059q","description":"A unified OpenAI API wrapper module for ErisPulse | OpenAI 通用接口封装模块","min_sdk_version":"2.0.0","repository":"https://github.com/ErisPulse/ErisPulse-OpenAI","official":true,"tags":["OpenAI","AI"],"submitted_at":"2025-07-15T08:58:41Z"},"AIChat":{"package":"ErisPulse-AIChat","version":"3.0.4","author":"wsu2059q","description":"AIChat 聊天机器人模块（停更）","min_sdk_version":"2.0.0","repository":"https://github.com/wsu2059q/ErisPulse-AIChat","official":false,"tags":["AIChat","AI"],"submitted_at":"2025-07-15T14:11:20Z"},"SeTu":{"package":"ErisPulse-SeTu","version":"1.2.0","author":"ShanFish","description":"简单的色图模块","min_sdk_version":"2.0.0","repository":"https://github.com/shanfishapp/ErisPulse-GetSeTu","official":false,"tags":["色图","SeTu"],"submitted_at":"2025-07-15T08:31:44Z"},"SystemStatus":{"package":"ErisPulse-SystemStatus","version":"1.0.3","author":"ShanFish","description":"提供获取系统内存、CPU、硬盘占用的接口","min_sdk_version":"2.0.0","repository":"https://github.com/shanfishapp/ErisPulse-SystemStatus","official":false,"tags":["system-info","api"],"submitted_at":"2025-07-14T10:40:27Z"},"ServerStatusMonitor":{"package":"ErisPulse-ServerStatusMonitor","version":"1.1.1","author":"wsu2059q","description":"系统信息查询模块-平台模块","repository":"https://github.com/wsu2059q/ErisPulse-ServerStatusMonitor","official":false,"tags":[],"submitted_at":"2025-07-14T10:40:27Z"},"AdminControl":{"package":"ErisPulse-AdminControl","version":"2.0.0","author":"wsu2059q","description":"ErisPulse 管理控制模块 - 提供框架管理和命令执行功能","min_sdk_version":"2.3.4-dev.3","repository":"https://github.com/wsu2059q/ErisPulse-AdminControl","official":false,"tags":["admin","management","控制","framework"],"submitted_at":"2026-02-08T17:48:01Z"},"EmailForwarder":{"package":"ErisPulse-EmailForwarder","version":"1.0.1","author":"wsu2059q","description":"监听邮件适配器并将邮件转发到其他平台的 ErisPulse 模块","min_sdk_version":"2.3.0","repository":"https://github.com/wsu2059q/ErisPulse-EmailForwarder","official":false,"tags":["email","forwarder","邮件转发"],"submitted_at":"2026-02-12T21:37:45Z"},"DFAFilter":{"package":"ErisPulse-DFAFilter","version":"2.0.0","author":"wsu2059q","description":"基于DFA算法的敏感词过滤模块，支持实时检测、自动替换和动态更新词库","min_sdk_version":"2.1.14-alpha.1","repository":"https://github.com/wsu2059q/ErisPulse-DFAFilter","official":false,"tags":["敏感词过滤","DFA","过滤","filter"],"submitted_at":"2026-02-25T16:03:32Z"},"GitHubWebhook":{"package":"ErisPulse-GitHubWebhook","version":"1.2.1","author":"wsu2059","description":"GitHub Webhook 聚合器模块，支持将 GitHub 事件转发到聊天平台","min_sdk_version":"2.3.0","repository":"https://github.com/wsu2059/ErisPulse-GitHubWebhook","official":false,"tags":["github","webhook","事件转发"],"submitted_at":"2026-02-26T09:19:25Z"},"NekoCare":{"package":"ErisPulse-NekoCare","version":"2.2.1","author":"wsu2059q, lin","description":"NekoCare - 虚拟猫猫养成模块","min_sdk_version":"2.2.0","repository":"https://github.com/wsu2059q/ErisPulse-NekoCare","official":false,"tags":["neko","virtual-pet","猫猫养成"],"submitted_at":"2026-04-11T17:42:22Z"},"InteractiveTest":{"package":"ErisPulse-InteractiveTest","version":"1.0.0","author":"wsu2059q","description":"ErisPulse 交互式对话与 OneBot12 消息构建器功能测试模块，类似echo模块但功能更强大","min_sdk_version":"2.3.0","repository":"https://github.com/wsu2059q/ErisPulse-InteractiveTest","official":false,"tags":["测试","交互","echo","诊断"],"submitted_at":"2026-04-14T06:32:31Z"},"ChatSonar":{"package":"ErisPulse-ChatSonar","version":"1.2.5","author":"wsu2059q","description":"消息声呐 - 可视化群聊社交距离与岛屿群落","min_sdk_version":"2.4.0","repository":"https://github.com/wsu2059q/ErisPulse-ChatSonar","official":false,"tags":["social-graph","chat-analysis","visualization","group-chat"],"submitted_at":"2026-04-27T01:19:51Z"},"UniBind":{"package":"ErisPulse-UniBind","version":"1.0.0","author":"wsu2059q","description":"跨平台用户身份绑定模块，通过验证码关联不同平台的同一用户","min_sdk_version":"2.4.3","repository":"https://github.com/ErisPulse/ErisPulse-UniBind","official":false,"tags":["身份绑定","跨平台","unibind","identity"],"submitted_at":"2026-05-04T14:14:42Z"},"BiliParser":{"package":"ErisPulse-BiliParser","version":"1.1.1","author":"wsu2059q","description":"B站视频解析模块，自动解析消息中的B站视频链接并展示详细信息","min_sdk_version":"2.4.0","repository":"https://github.com/wsu2059q/ErisPulse-BiliParser","official":false,"tags":["bilibili","解析","视频","parser"],"submitted_at":"2026-05-02T13:31:13Z"},"RssReader":{"package":"ErisPulse-RssReader","version":"1.1.2","author":"wsu2059q","description":"RSS订阅器模块——在聊天中订阅任意RSS/Atom源，自动推送更新","min_sdk_version":"2.0.0","repository":"https://github.com/ErisPulse/ErisPulse-RssReader","official":false,"tags":["rss","atom","订阅","news"],"submitted_at":"2026-05-07T14:57:57Z"},"Raffle":{"package":"ErisPulse-Raffle","version":"1.0.1","author":"ErisPulse","description":"General raffle module with Dashboard visualization, keyword signup & draw animation | 通用抽奖模块 — Dashboard 可视化管理、群聊关键词报名、开奖动画、广播通知","min_sdk_version":"2.4.0","repository":"https://github.com/ErisPulse/ErisPulse-Raffle","official":true,"tags":["抽奖","raffle","lottery","dashboard","通知"],"submitted_at":"2026-05-17T16:01:16Z"},"AdapterConfig":{"package":"ErisPulse-AdapterConfig","version":"1.0.0","author":"ErisPulse","description":"Dashboard extension for visually configuring adapter parameters | Dashboard 适配器配置扩展 — 可视化界面快速配置适配器参数","min_sdk_version":"2.0.0","repository":"https://github.com/ErisPulse/ErisPulse-Dash-AdapterConfig","official":true,"tags":["dashboard","适配器配置","adapter","config"],"submitted_at":"2026-05-20T12:35:28Z"},"DashChat":{"package":"ErisPulse-DashChat","version":"1.0.0","author":"樱城の心","description":"跨平台实时消息收发模块，提供一个类即时通讯的聊天界面，支持用户在仪表盘内与各个平台进行对话","repository":"https://github.com/wsu2059q/ErisPulse-DashChat","official":false,"verified":true,"submitted_by":"YingXinche","submitted_by_uid":"yunhu:5197892","oauth_provider":"yunhu","tags":["dashboard","chat"],"hidden":true,"submitted_at":"2026-05-25T15:17:20Z","min_sdk_version":"2.5.0"},"Echo":{"package":"ErisPulse-Echo","version":"1.0.0","author":"樱城の心","description":"Echo - 回显消息内容，支持文本、图片等多种类型，支持引用回显","repository":"https://github.com/wsu2059q/ErisPulse-Echo","official":false,"verified":true,"submitted_by":"YingXinche","submitted_by_uid":"yunhu:5197892","oauth_provider":"yunhu","tags":["Echo","回显"],"min_sdk_version":"2.4.0","submitted_at":"2026-05-26T07:15:56Z"},"MyServer":{"package":"ErisPulse-MyServer","version":"1.0.0","author":"樱城の心","description":"服务器管理模块 - 支持远程监控、WebSocket终端、Dashboard管理","repository":"https://github.com/wsu2059q/ErisPulse-MyServer","official":false,"verified":true,"submitted_by":"樱城の心","submitted_by_uid":"yunhu:5197892","oauth_provider":"yunhu","tags":["工具"],"min_sdk_version":"2.4.5","submitted_at":"2026-05-30T07:07:41Z"},"CopyCat":{"package":"ErisPulse-CopyCat","version":"1.0.1","author":"樱城の心","description":"复读机模块 - 检测群聊/私聊中连续重复消息并自动复读","repository":"https://github.com/wsu2059q/ErisPulse-CopyCat","official":false,"verified":true,"submitted_by":"樱城の心","submitted_by_uid":"yunhu:5197892","oauth_provider":"yunhu","submitted_at":"2026-07-09T06:40:54Z","tags":["复读机"],"min_sdk_version":"2.4.6"},"RateLimiter":{"package":"ErisPulse-RateLimiter","version":"1.0.0","author":"樱城の心","description":"ErisPulse message rate limiting module to prevent spam, supports fixed/sliding window, multi-dimensional limiting, and whitelist immunity | ErisPulse 消息速率限制模块，防止刷屏，支持固定/滑动窗口、多维度限流、白名单免疫","repository":"https://github.com/wsu2059q/ErisPulse-RateLimiter","official":false,"verified":true,"submitted_by":"樱城の心","submitted_by_uid":"yunhu:5197892","oauth_provider":"yunhu","submitted_at":"2026-07-09T06:42:29Z","tags":["限流","反刷屏","熔断","保护","窗口","滑动窗口","固定窗口","白名单","多维","消息","拦截","流控","rate","limiter","spam","guard","window","whitelist","throttle","protect","filter"],"min_sdk_version":"2.5.3"},"MsgCounter":{"package":"ErisPulse-MsgCounter","version":"1.1.0","author":"Future Tasks","description":"一个用于统计消息的模块，末日水系列机器人同款","repository":"https://github.com/Teddyxiongtdx/YBot-Ep-MsgCounter","official":false,"verified":true,"submitted_by":"Future Tasks","submitted_by_uid":"yunhu:7384288","oauth_provider":"yunhu","submitted_at":"2026-07-13T03:22:31Z","tags":[],"min_sdk_version":">=2.4.6"},"Takumi":{"package":"ErisPulse-Takumi","version":"1.2.0","author":"ccd2s","description":"Use takumi-py to quickly render images.","min_sdk_version":"2.7.0-dev.0","repository":"https://github.com/ccd2s/ErisPulse-Takumi","official":false,"verified":true,"tags":["图片渲染","render","html","svg","font","字体"],"submitted_at":"2026-08-04T00:00:00Z"}},"adapters":{"Yunhu":{"package":"ErisPulse-YunhuAdapter","author":"wsu2059q","version":"4.2.0","description":"ErisPulse Yunhu adapter — enterprise IM over WebSocket/Webhook | ErisPulse 云湖适配器 — 企业 IM，WebSocket / Webhook 双模式","repository":"https://github.com/ErisPulse/ErisPulse-YunhuAdapter","official":true,"tags":["adapter","yunhu"],"min_sdk_version":"2.4.6","submitted_at":"2025-07-14T10:40:27Z"},"OneBot11":{"package":"ErisPulse-OneBot11Adapter","author":"wsu2059q","version":"4.1.2","description":"ErisPulse OneBot11 adapter — compatible with any OneBot v11 implementation | ErisPulse OneBot11 适配器 — 兼容任意 OneBot V11 协议实现","repository":"https://github.com/ErisPulse/ErisPulse-OneBot11Adapter","official":true,"tags":["adapter","onebot11"],"submitted_at":"2025-07-14T10:40:27Z"},"OneBot12":{"package":"ErisPulse-OneBot12Adapter","author":"wsu2059q","version":"4.0.1","description":"ErisPulse OneBot12 adapter — baseline protocol, multi-account & dual-mode | ErisPulse OneBot12 适配器 — 基线协议，多账户 / Server·Client 双模式","repository":"https://github.com/ErisPulse/ErisPulse-OneBot12Adapter","official":true,"tags":["adapter","onebot12"],"min_sdk_version":"2.4.6","submitted_at":"2026-01-25T12:57:42Z"},"Telegram":{"package":"ErisPulse-TelegramAdapter","author":"wsu2059q","version":"4.1.0","description":"ErisPulse Telegram adapter — Bot API with multi-account & rich media | ErisPulse Telegram 适配器 — Bot API，多账户 + 富媒体","repository":"https://github.com/ErisPulse/ErisPulse-TelegramAdapter","official":true,"tags":["adapter","telegram"],"min_sdk_version":"2.4.6","submitted_at":"2025-07-17T01:54:15Z"},"Email":{"package":"ErisPulse-EmailAdapter","author":"wsu2059q","version":"4.1.0","description":"ErisPulse Email adapter — turn any mailbox into a Bot | ErisPulse 邮箱适配器 — 把任意邮箱变成机器人","repository":"https://github.com/ErisPulse/ErisPulse-EmailAdapter","official":true,"tags":["adapter","mail","email"],"submitted_at":"2025-07-21T08:56:52Z"},"YunhuUser":{"package":"ErisPulse-YunhuUserAdapter","author":"wsu2059q","version":"4.0.0","description":"ErisPulse Yunhu-User adapter — driven by user-account protocol | ErisPulse 云湖用户适配器 — 用户账户协议驱动","repository":"https://github.com/wsu2059q/ErisPulse-YunhuUserAdapter","official":true,"tags":["adapter","yunhu","user"],"min_sdk_version":"2.4.6","submitted_at":"2026-02-14T18:05:15Z"},"sandbox":{"package":"ErisPulse-SandboxAdapter","author":"ErisPulse","version":"4.0.2","description":"ErisPulse Sandbox adapter — test your Bot in a web UI, zero setup | ErisPulse 沙箱适配器 — 网页 UI 调试，零平台接入即测即用","repository":"https://github.com/ErisPulse/ErisPulse-SandboxAdapter","official":true,"tags":["adapter","sandbox","调试"],"min_sdk_version":"2.4.6","submitted_at":"2026-01-25T18:24:18Z"},"Kook":{"package":"ErisPulse-KookAdapter","author":"ShanFish","version":"4.0.0","description":"ErisPulse Kook adapter — messages, KMarkdown & cards | ErisPulse Kook 适配器 — 消息收发，KMarkdown / 卡片","repository":"https://github.com/shanfishapp/ErisPulse-KookAdapter","official":true,"tags":["adapter","kook"],"submitted_at":"2026-04-12T04:42:32Z"},"Discord":{"package":"ErisPulse-DiscordAdapter","author":"ErisPulse","version":"4.1.0","description":"ErisPulse Discord adapter — Gateway WS + REST API v10 | ErisPulse Discord 适配器 — Gateway WebSocket + REST API v10","repository":"https://github.com/ErisPulse/ErisPulse-DiscordAdapter","official":true,"tags":["adapter","Discord"],"submitted_at":"2026-06-16T05:38:05Z"},"WechatMp":{"package":"ErisPulse-WechatMpAdapter","author":"ErisPulse","version":"4.0.0","description":"ErisPulse WeChat MP adapter — webhook callback + customer/template messages | ErisPulse 微信公众号适配器 — Webhook 回调 + 客服 / 模板消息","repository":"https://github.com/ErisPulse/ErisPulse-WechatMpAdapter","official":true,"tags":["adapter","wechat","微信","公众号"],"submitted_at":"2026-06-16T07:32:08Z"},"Matrix":{"package":"ErisPulse-MatrixAdapter","author":"wsu2059","version":"4.1.0","description":"ErisPulse Matrix adapter — decentralized chat via long-polling sync | ErisPulse Matrix 适配器 — 去中心化协议，Long Polling 同步","repository":"https://github.com/ErisPulse/ErisPulse-MatrixAdapter","official":true,"tags":["adapter","matrix"],"submitted_at":"2026-04-25T14:54:50Z"},"QQBot":{"package":"ErisPulse-QQBotAdapter","author":"wsu2059","version":"4.0.2","description":"ErisPulse QQ Official Bot adapter — groups, DMs & channels | ErisPulse QQ 官方机器人适配器 — 群聊 / 私聊 / 频道","repository":"https://github.com/ErisPulse/ErisPulse-QQBotAdapter","official":true,"tags":["bot","adapter","qq","qbot"],"min_sdk_version":"2.4.6","submitted_at":"2026-04-25T14:54:50Z"},"Ideaura":{"package":"ErisPulse-Ideaura","author":"ErisPulse","version":"4.0.1","description":"ErisPulse Ideaura (Allons) adapter — multi-scenario chat platform | ErisPulse 花枫咖啡馆(Allons)适配器 — 多场景聊天平台","repository":"https://github.com/ErisPulse/ErisPulse-Ideaura","official":true,"tags":["adapter","ideaura","allons"],"submitted_at":"2026-05-09T16:23:30Z"},"Webhook":{"package":"ErisPulse-WebhookAdapter","author":"ErisPulse","version":"4.0.1","description":"ErisPulse Webhook adapter — a low-code HTTP bridge to any system | ErisPulse Webhook 适配器 — 通用 HTTP 桥接，低代码接任意系统","repository":"https://github.com/ErisPulse/ErisPulse-WebhookAdapter","official":true,"tags":["adapter","webhook"],"submitted_at":"2026-06-16T03:37:55Z"},"Terminal":{"package":"ErisPulse-TerminalAdapter","author":"ErisPulse","version":"1.0.0","description":"ErisPulse Terminal adapter — the terminal is the chat, zero-config | ErisPulse 终端适配器 — 命令行即聊天，零配置开发调试","repository":"https://github.com/ErisPulse/ErisPulse-TerminalAdapter","official":true,"tags":["adapter","terminal","cli","debug"],"min_sdk_version":"2.7.0","submitted_at":"2026-08-03T00:00:00Z"}},"cli_extensions":{}};

    var _installedVersions = {
        'erispulse': '2.7.0',
        'erispulse-dashboard': '1.9.1'
    };

var _MODULES_LIST = [{"name":"Dashboard","type":"module","enabled":true,"loaded":true,"version":"1.9.1","author":"ErisPulse","description":"Web admin panel — system monitor, module management, config editor & event stream","package":"ErisPulse-Dashboard","has_config":false},{"name":"HelpModule","type":"module","enabled":true,"loaded":true,"version":"2.1.2","author":"wsu2059q","description":"为统一的命令系统提供一个help命令，用来在平台查看现有命令","package":"ErisPulse-HelpModule","has_config":false},{"name":"Cron","type":"module","enabled":true,"loaded":true,"version":"1.0.1","author":"wsu2059q","description":"ErisPulse 定时任务调度模块 - 支持一次性/间隔/Cron定时，回调传参，SQLite持久化","package":"ErisPulse-Cron","has_config":false},{"name":"UmaMusume","type":"module","enabled":true,"loaded":true,"version":"1.0.0","author":"CyanTea","description":"ErisPulse的赛马娘主题机器人模块","package":"ErisPulse-UmaMusume","has_config":false},{"name":"Feedback","type":"module","enabled":true,"loaded":true,"version":"1.1.2","author":"wsu2059","description":"ErisPulse 反馈系统模块，支持反馈提交、状态管理、多群聊反馈组和数据导入导出","package":"ErisPulse-Feedback","has_config":false},{"name":"EditVideoPlayer","type":"module","enabled":true,"loaded":true,"version":"1.0.1","author":"wsu2059q","description":"一个通用的视频播放器模块，可将视频转换为点阵字符并在支持消息编辑的平台上播放","package":"ErisPulse-EditVideoPlayer","has_config":false},{"name":"InfoQuery","type":"module","enabled":true,"loaded":true,"version":"1.0.0","author":"wsu2059q","description":"信息统计查询模块，用于查询InfoStats收集的统计数据","package":"ErisPulse-InfoQuery","has_config":false},{"name":"XiaomiMarathon","type":"module","enabled":true,"loaded":true,"version":"1.0.1","author":"wsu2059q","description":"小米马拉松模拟器","package":"ErisPulse-XiaomiMarathon","has_config":false},{"name":"InfoStats","type":"module","enabled":true,"loaded":true,"version":"1.0.0","author":"wsu2059q","description":"Event listener & statistics module for analytics","package":"ErisPulse-InfoStats","has_config":false},{"name":"GitHubParser","type":"module","enabled":true,"loaded":true,"version":"3.0.0","author":"wsu2059q","description":"GitHub链接解析模块，自动解析消息中的仓库/Issue/PR信息并以最佳格式展示","package":"ErisPulse-GitHubParser","has_config":false},{"name":"Weather","type":"module","enabled":true,"loaded":true,"version":"1.2.0","author":"ShanFish","description":"天气查询，支持绑定城市、今日天气、五日天气","package":"ErisPulse-Weather","has_config":false},{"name":"QvQChat","type":"module","enabled":true,"loaded":true,"version":"2.7.0","author":"wsu2059q","description":"一个基于多AI协同的智能对话模块，让AI像真人一样自然参与聊天","package":"ErisPulse-QvQChat","has_config":false},{"name":"OpenAI","type":"module","enabled":true,"loaded":true,"version":"2.1.3","author":"wsu2059q","description":"A unified OpenAI API wrapper module for ErisPulse","package":"ErisPulse-OpenAI","has_config":false},{"name":"AIChat","type":"module","enabled":true,"loaded":true,"version":"3.0.4","author":"wsu2059q","description":"AIChat 聊天机器人模块（停更）","package":"ErisPulse-AIChat","has_config":false},{"name":"SeTu","type":"module","enabled":true,"loaded":true,"version":"1.2.0","author":"ShanFish","description":"简单的色图模块","package":"ErisPulse-SeTu","has_config":false},{"name":"SystemStatus","type":"module","enabled":true,"loaded":true,"version":"1.0.3","author":"ShanFish","description":"提供获取系统内存、CPU、硬盘占用的接口","package":"ErisPulse-SystemStatus","has_config":false},{"name":"ServerStatusMonitor","type":"module","enabled":true,"loaded":true,"version":"1.1.1","author":"wsu2059q","description":"系统信息查询模块-平台模块","package":"ErisPulse-ServerStatusMonitor","has_config":false},{"name":"AdminControl","type":"module","enabled":true,"loaded":true,"version":"2.0.0","author":"wsu2059q","description":"ErisPulse 管理控制模块 - 提供框架管理和命令执行功能","package":"ErisPulse-AdminControl","has_config":false},{"name":"EmailForwarder","type":"module","enabled":true,"loaded":true,"version":"1.0.1","author":"wsu2059q","description":"监听邮件适配器并将邮件转发到其他平台的 ErisPulse 模块","package":"ErisPulse-EmailForwarder","has_config":false},{"name":"DFAFilter","type":"module","enabled":true,"loaded":true,"version":"2.0.0","author":"wsu2059q","description":"基于DFA算法的敏感词过滤模块，支持实时检测、自动替换和动态更新词库","package":"ErisPulse-DFAFilter","has_config":false},{"name":"GitHubWebhook","type":"module","enabled":true,"loaded":true,"version":"1.2.1","author":"wsu2059","description":"GitHub Webhook 聚合器模块，支持将 GitHub 事件转发到聊天平台","package":"ErisPulse-GitHubWebhook","has_config":false},{"name":"NekoCare","type":"module","enabled":true,"loaded":true,"version":"2.2.1","author":"wsu2059q, lin","description":"NekoCare - 虚拟猫猫养成模块","package":"ErisPulse-NekoCare","has_config":false},{"name":"InteractiveTest","type":"module","enabled":true,"loaded":true,"version":"1.0.0","author":"wsu2059q","description":"ErisPulse 交互式对话与 OneBot12 消息构建器功能测试模块，类似echo模块但功能更强大","package":"ErisPulse-InteractiveTest","has_config":false},{"name":"ChatSonar","type":"module","enabled":true,"loaded":true,"version":"1.2.5","author":"wsu2059q","description":"消息声呐 - 可视化群聊社交距离与岛屿群落","package":"ErisPulse-ChatSonar","has_config":false},{"name":"UniBind","type":"module","enabled":true,"loaded":true,"version":"1.0.0","author":"wsu2059q","description":"跨平台用户身份绑定模块，通过验证码关联不同平台的同一用户","package":"ErisPulse-UniBind","has_config":false},{"name":"BiliParser","type":"module","enabled":true,"loaded":true,"version":"1.1.1","author":"wsu2059q","description":"B站视频解析模块，自动解析消息中的B站视频链接并展示详细信息","package":"ErisPulse-BiliParser","has_config":false},{"name":"RssReader","type":"module","enabled":true,"loaded":true,"version":"1.1.2","author":"wsu2059q","description":"RSS订阅器模块——在聊天中订阅任意RSS/Atom源，自动推送更新","package":"ErisPulse-RssReader","has_config":false},{"name":"Raffle","type":"module","enabled":true,"loaded":true,"version":"1.0.1","author":"ErisPulse","description":"General raffle module with Dashboard visualization, keyword signup & draw animation","package":"ErisPulse-Raffle","has_config":false},{"name":"AdapterConfig","type":"module","enabled":true,"loaded":true,"version":"1.0.0","author":"ErisPulse","description":"Dashboard extension for visually configuring adapter parameters","package":"ErisPulse-AdapterConfig","has_config":false},{"name":"DashChat","type":"module","enabled":true,"loaded":true,"version":"1.0.0","author":"樱城の心","description":"跨平台实时消息收发模块，提供一个类即时通讯的聊天界面，支持用户在仪表盘内与各个平台进行对话","package":"ErisPulse-DashChat","has_config":false},{"name":"Echo","type":"module","enabled":true,"loaded":true,"version":"1.0.0","author":"樱城の心","description":"Echo - 回显消息内容，支持文本、图片等多种类型，支持引用回显","package":"ErisPulse-Echo","has_config":false},{"name":"MyServer","type":"module","enabled":true,"loaded":true,"version":"1.0.0","author":"樱城の心","description":"服务器管理模块 - 支持远程监控、WebSocket终端、Dashboard管理","package":"ErisPulse-MyServer","has_config":false},{"name":"CopyCat","type":"module","enabled":true,"loaded":true,"version":"1.0.1","author":"樱城の心","description":"复读机模块 - 检测群聊/私聊中连续重复消息并自动复读","package":"ErisPulse-CopyCat","has_config":false},{"name":"RateLimiter","type":"module","enabled":true,"loaded":true,"version":"1.0.0","author":"樱城の心","description":"ErisPulse message rate limiting module to prevent spam, supports fixed/sliding window, multi-dimensional limiting, and whitelist immunity","package":"ErisPulse-RateLimiter","has_config":false},{"name":"MsgCounter","type":"module","enabled":true,"loaded":true,"version":"1.1.0","author":"Future Tasks","description":"一个用于统计消息的模块，末日水系列机器人同款","package":"ErisPulse-MsgCounter","has_config":false},{"name":"Takumi","type":"module","enabled":true,"loaded":true,"version":"1.2.0","author":"ccd2s","description":"Use takumi-py to quickly render images.","package":"ErisPulse-Takumi","has_config":false}];
var _ADAPTERS_LIST = [{"name":"Yunhu","type":"adapter","enabled":true,"loaded":true,"version":"4.2.0","author":"wsu2059q","description":"ErisPulse Yunhu adapter — enterprise IM over WebSocket/Webhook","package":"ErisPulse-YunhuAdapter"},{"name":"OneBot11","type":"adapter","enabled":true,"loaded":true,"version":"4.1.2","author":"wsu2059q","description":"ErisPulse OneBot11 adapter — compatible with any OneBot v11 implementation","package":"ErisPulse-OneBot11Adapter"},{"name":"OneBot12","type":"adapter","enabled":true,"loaded":true,"version":"4.0.1","author":"wsu2059q","description":"ErisPulse OneBot12 adapter — baseline protocol, multi-account & dual-mode","package":"ErisPulse-OneBot12Adapter"},{"name":"Telegram","type":"adapter","enabled":true,"loaded":true,"version":"4.1.0","author":"wsu2059q","description":"ErisPulse Telegram adapter — Bot API with multi-account & rich media","package":"ErisPulse-TelegramAdapter"},{"name":"Email","type":"adapter","enabled":true,"loaded":true,"version":"4.1.0","author":"wsu2059q","description":"ErisPulse Email adapter — turn any mailbox into a Bot","package":"ErisPulse-EmailAdapter"},{"name":"YunhuUser","type":"adapter","enabled":true,"loaded":true,"version":"4.0.0","author":"wsu2059q","description":"ErisPulse Yunhu-User adapter — driven by user-account protocol","package":"ErisPulse-YunhuUserAdapter"},{"name":"sandbox","type":"adapter","enabled":true,"loaded":true,"version":"4.0.2","author":"ErisPulse","description":"ErisPulse Sandbox adapter — test your Bot in a web UI, zero setup","package":"ErisPulse-SandboxAdapter"},{"name":"Kook","type":"adapter","enabled":true,"loaded":true,"version":"4.0.0","author":"ShanFish","description":"ErisPulse Kook adapter — messages, KMarkdown & cards","package":"ErisPulse-KookAdapter"},{"name":"Discord","type":"adapter","enabled":true,"loaded":true,"version":"4.1.0","author":"ErisPulse","description":"ErisPulse Discord adapter — Gateway WS + REST API v10","package":"ErisPulse-DiscordAdapter"},{"name":"WechatMp","type":"adapter","enabled":true,"loaded":true,"version":"4.0.0","author":"ErisPulse","description":"ErisPulse WeChat MP adapter — webhook callback + customer/template messages","package":"ErisPulse-WechatMpAdapter"},{"name":"Matrix","type":"adapter","enabled":true,"loaded":true,"version":"4.1.0","author":"wsu2059","description":"ErisPulse Matrix adapter — decentralized chat via long-polling sync","package":"ErisPulse-MatrixAdapter"},{"name":"QQBot","type":"adapter","enabled":true,"loaded":true,"version":"4.0.2","author":"wsu2059","description":"ErisPulse QQ Official Bot adapter — groups, DMs & channels","package":"ErisPulse-QQBotAdapter"},{"name":"Ideaura","type":"adapter","enabled":true,"loaded":true,"version":"4.0.1","author":"ErisPulse","description":"ErisPulse Ideaura (Allons) adapter — multi-scenario chat platform","package":"ErisPulse-Ideaura"},{"name":"Webhook","type":"adapter","enabled":true,"loaded":true,"version":"4.0.1","author":"ErisPulse","description":"ErisPulse Webhook adapter — a low-code HTTP bridge to any system","package":"ErisPulse-WebhookAdapter"},{"name":"Terminal","type":"adapter","enabled":true,"loaded":true,"version":"1.0.0","author":"ErisPulse","description":"ErisPulse Terminal adapter — the terminal is the chat, zero-config","package":"ErisPulse-TerminalAdapter"}];
var _FRAMEWORK_VERSIONS = ["2.7.0.dev5", "2.7.0.dev3", "2.7.0.dev0", "2.7.0", "2.6.3.dev0", "2.6.3", "2.6.2.dev1", "2.6.2", "2.6.1.dev0", "2.6.1", "2.6.0.dev1", "2.6.0.dev0", "2.6.0", "2.5.5", "2.5.4", "2.5.3", "2.5.2.dev4", "2.5.2.dev3", "2.5.2.dev2", "2.5.2.dev1", "2.5.2.dev0", "2.5.2", "2.5.1", "2.5.0.dev2", "2.5.0.dev1", "2.5.0.dev0", "2.5.0", "2.4.8", "2.4.7", "2.4.6.dev6", "2.4.6.dev5", "2.4.6.dev4", "2.4.6.dev3", "2.4.6.dev2", "2.4.6.dev1", "2.4.6.dev0", "2.4.6", "2.4.5.dev3", "2.4.5.dev2", "2.4.5.dev1", "2.4.5.dev0", "2.4.5", "2.4.4", "2.4.3.dev1", "2.4.3.dev0", "2.4.3", "2.4.2.dev1", "2.4.2.dev0", "2.4.2", "2.4.1"];

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
            framework: { version: '2.7.0', python_version: '3.13.0' },
            adapters: {
                Yunhu: { status: 'started', bots: { bot_001: { status: 'online', last_active: NOW - 10, info: { user_name: 'YunhuBot', nickname: 'YunhuBot' } } } },
                OneBot11: { status: 'started', bots: { bot_001: { status: 'online', last_active: NOW - 120, info: { user_name: 'OneBot11', nickname: 'OneBot11' } } } },
                Telegram: { status: 'started', bots: { bot_001: { status: 'online', last_active: NOW - 30, info: { user_name: 'ErisPulseBot', nickname: 'ErisPulseBot' } } } },
                Discord: { status: 'started', bots: { bot_001: { status: 'online', last_active: NOW - 60, info: { user_name: 'ErisPulse#0001', nickname: 'ErisPulse' } } } },
                Kook: { status: 'stopped', bots: {} }
            },
            modules: { Dashboard: true, HelpModule: true, Cron: true, Weather: false, Takumi: true, OpenAI: false }
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
                { platform: 'Yunhu', enabled: true, running: true, bots: [{ bot_id: 'bot_001', status: 'online', last_active: NOW - 10, info: { user_name: 'YunhuBot' } }] },
                { platform: 'OneBot11', enabled: true, running: true, bots: [{ bot_id: 'bot_001', status: 'online', last_active: NOW - 120, info: { user_name: 'OneBot11' } }] },
                { platform: 'Telegram', enabled: true, running: true, bots: [{ bot_id: 'bot_001', status: 'online', last_active: NOW - 30, info: { user_name: 'ErisPulseBot' } }] },
                { platform: 'Discord', enabled: true, running: true, bots: [{ bot_id: 'bot_001', status: 'online', last_active: NOW - 60, info: { user_name: 'ErisPulse#0001' } }] },
                { platform: 'Kook', enabled: false, running: false, bots: [] }
            ]
        });
    };

    API_MAP['/api/adapter-logos'] = function () {
        var logos = {
            Yunhu: 'res/adapter_logo/yunhu.png',
            OneBot11: 'res/adapter_logo/onebot.png',
            Telegram: 'res/adapter_logo/telegram.png',
            Discord: 'res/adapter_logo/discord.png',
            Kook: 'res/adapter_logo/kook.png',
            qq: 'res/adapter_logo/qq.png',
            websocket: 'res/adapter_logo/websocket.png',
            matrix: 'res/adapter_logo/matrix.png',
            mail: 'res/adapter_logo/mail.png',
            http: 'res/adapter_logo/http.png',
            github: 'res/adapter_logo/github.png',
            slack: 'res/adapter_logo/slack.png'
        };
        return _json({ logos: logos });
    };

    API_MAP['/api/modules'] = function () {
        return _json({ modules: _MODULES_LIST.concat(_ADAPTERS_LIST) });
    };

    API_MAP['/api/bots'] = function () {
        return _json({
            bots: [
                { bot_id: 'bot_001', platform: 'Yunhu', status: 'online', last_active: NOW - 10, info: { user_name: 'YunhuBot', nickname: 'YunhuBot' } },
                { bot_id: 'bot_002', platform: 'Yunhu', status: 'online', last_active: NOW - 120, info: { user_name: 'YunhuBot2', nickname: 'YunhuBot2' } },
                { bot_id: 'bot_001', platform: 'OneBot11', status: 'online', last_active: NOW - 120, info: { user_name: 'OneBot11', nickname: 'OneBot11' } },
                { bot_id: 'bot_001', platform: 'Telegram', status: 'online', last_active: NOW - 30, info: { user_name: 'ErisPulseBot', nickname: 'ErisPulseBot' } },
                { bot_id: 'bot_001', platform: 'Discord', status: 'online', last_active: NOW - 60, info: { user_name: 'ErisPulse#0001', nickname: 'ErisPulse' } },
                { bot_id: 'bot_001', platform: 'Kook', status: 'online', last_active: NOW - 300, info: { user_name: 'ErisBot', nickname: 'ErisBot' } }
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
        var levels = params.get('levels') || '';
        var level = params.get('level') || '';
        var search = params.get('search') || '';
        var limit = parseInt(params.get('limit') || '200');
        var logs = _genLogs(80);
        if (module) logs = logs.filter(function (l) { return l.module === module; });
        if (levels) {
            var levelSet = {};
            levels.split(',').forEach(function (lv) { levelSet[lv.trim().toUpperCase()] = true; });
            logs = logs.filter(function (l) { return levelSet[(l.level || '').toUpperCase()]; });
        }
        if (level) logs = logs.filter(function (l) { return l.level === level; });
        if (search) logs = logs.filter(function (l) { return l.message.toLowerCase().indexOf(search.toLowerCase()) !== -1; });
        return _json({ logs: logs.slice(0, limit), total: logs.length });
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

    function _mockConfig() {
        return {
            config: {
                Dashboard: { title: 'ErisPulse Dashboard', max_event_log: 500, token: '***' },
                ErisPulse: {
                    server: { host: '0.0.0.0', port: 8000, auto_start: true, ssl_certfile: null, ssl_keyfile: null },
                    logger: { level: 'INFO', format: 'rich', log_files: [], memory_limit: 1000 },
                    storage: { use_global_db: false },
                    event: { message: { ignore_self: true }, command: { prefix: '/', case_sensitive: true, allow_space_prefix: false, must_at_bot: false } },
                    master: { users: {} },
                    framework: { enable_lazy_loading: true, uninit_timeout: 30, strict_mode: 0 },
                    i18n: { language: 'auto' }
                }
            }
        };
    }
    API_MAP['/api/config'] = function (opts) {
        if (opts && opts.method === 'PUT') return _json({ success: true });
        return _json(_mockConfig());
    };

    API_MAP['/api/config/source'] = function () {
        return _json({ content: '# ErisPulse Configuration\n[ErisPulse.server]\nhost = "0.0.0.0"\nport = 8000\nauto_start = true\n\n[ErisPulse.logger]\nlevel = "INFO"\nformat = "rich"\nmemory_limit = 1000\n\n[ErisPulse.event.command]\nprefix = "/"\ncase_sensitive = true\nallow_space_prefix = false\nmust_at_bot = false\n\n[Dashboard]\ntitle = "ErisPulse Dashboard"\nmax_event_log = 500\n' });
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
                { name: 'erispulse', version: '2.7.0', summary: 'ErisPulse framework core', type: 'library', package: 'erispulse' },
                { name: 'ErisPulse-Dashboard', version: '1.9.1', summary: 'Web admin dashboard', type: 'module', package: 'ErisPulse-Dashboard' }
            ]
        });
    };

    API_MAP['/api/packages/updates'] = function () {
        return _json({
            updates: []
        });
    };

    API_MAP['/api/packages/upgrade'] = function () { return _json({ success: true, task_id: 'mock_upgrade_' + _r(1000, 9999) }); };
    API_MAP['/api/packages/install'] = function () { return _json({ success: true, task_id: 'mock_install_' + _r(1000, 9999) }); };
    API_MAP['/api/packages/uninstall'] = function () { return _json({ success: true }); };

    API_MAP['/api/framework/versions'] = function () {
        return _json({ current: '2.7.0', latest: '2.7.0', versions: _FRAMEWORK_VERSIONS });
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
            platform_stats: { Yunhu: 156, OneBot11: 120, Telegram: 89, Discord: 67, Kook: 55 },
            hourly_trend: hourly
        });
    };

    API_MAP['/api/commands/settings'] = function () { return _json({ success: true, command: { prefix: '/', case_sensitive: true, allow_space_prefix: false, must_at_bot: false } }); };

    API_MAP['/api/commands'] = function () {
        return _json({
            global_settings: { prefix: '/', prefixes: ['/'], case_sensitive: true, allow_space_prefix: false, must_at_bot: false },
            commands: [
                { name: 'help', help: '显示帮助信息', usage: '/help [命令名]', group: '通用', hidden: false, original_aliases: ['帮助'], custom_aliases: [], enabled: true, allowed_platforms: [], blocked_platforms: [], transform_to: null },
                { name: 'echo', help: '回显消息', usage: '/echo <内容>', group: '测试', hidden: false, original_aliases: [], custom_aliases: ['say'], enabled: true, allowed_platforms: [], blocked_platforms: [], transform_to: null },
                { name: 'weather', help: '查询天气', usage: '/weather <城市>', group: '工具', hidden: false, original_aliases: ['天气'], custom_aliases: [], enabled: true, allowed_platforms: [], blocked_platforms: [], transform_to: null },
                { name: 'status', help: '查看系统状态', usage: '/status', group: '管理', hidden: false, original_aliases: ['状态'], custom_aliases: [], enabled: true, allowed_platforms: [], blocked_platforms: [], transform_to: null },
                { name: 'admin', help: '管理命令', usage: '/admin <操作>', group: '管理', hidden: true, original_aliases: [], custom_aliases: [], enabled: false, allowed_platforms: ['qq', 'telegram'], blocked_platforms: [], transform_to: null }
            ]
        });
    };

    API_MAP['/api/master'] = function (opts) {
        if (opts && opts.method === 'PUT') return _json({ success: true, master: { users: { Yunhu: ['user_001'], Telegram: ['user_002'] } } });
        return _json({
            master: { users: { Yunhu: ['user_001'], Telegram: ['user_002'], Discord: ['user_555'] } },
            platforms: ['Yunhu', 'OneBot11', 'Telegram', 'Discord', 'Kook']
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
        var fw = { version: '2.7.0', python_version: '3.13.0' };
        var adaptersSummary = {
            Yunhu: { running: true, bot_count: 1 },
            OneBot11: { running: true, bot_count: 1 },
            Telegram: { running: true, bot_count: 1 },
            Discord: { running: true, bot_count: 1 },
            Kook: { running: false, bot_count: 0 }
        };
        var modules = { Dashboard: true, HelpModule: true, Cron: true, Weather: false, Takumi: true, OpenAI: false };
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
                        adapters: { Yunhu: { running: true, bot_count: 1 }, Telegram: { running: true, bot_count: 1 } },
                        modules: { Dashboard: true, HelpModule: true },
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

    var _mockAdapterConfigs = {
        Yunhu: {
            config_key: 'qq', has_config: true, has_accounts: true,
            schema: { fields: {
                appid: { type: 'string', description: 'QQ 开放平台 AppID', group: 'connection', order: 1 },
                secret: { type: 'string', secret: true, description: 'QQ 开放平台 AppSecret', group: 'connection', order: 2 },
                token: { type: 'string', secret: true, description: 'WebSocket 鉴权 Token', group: 'connection', order: 3 },
                sandbox: { type: 'boolean', widget: 'switch', description: '是否使用沙箱环境', group: 'advanced', order: 10 },
            }},
            values: { appid: '102045273', secret: 'aB3xK9mP2qR7sV4w', token: 'wss_token_demo_value_123', sandbox: false },
            account_schema: { fields: {
                enabled: { type: 'boolean', widget: 'switch', order: 1 },
                name: { type: 'string', order: 2 },
                appid: { type: 'string', description: '机器人 AppID', order: 3 },
                secret: { type: 'string', secret: true, description: '机器人 Secret', order: 4 },
                token: { type: 'string', secret: true, description: '回调鉴权 Token', order: 5 },
            }},
            accounts: { default: { enabled: true, name: 'default', appid: '102045273', secret: 'bot_secret_abc123', token: 'callback_token_xyz' } }
        },
        Telegram: {
            config_key: 'Telegram', has_config: true, has_accounts: false,
            schema: { fields: {
                token: { type: 'string', secret: true, description: 'Telegram Bot Token', order: 1 },
                proxy: { type: 'string', description: 'HTTP 代理地址（可选）', order: 2 },
            }},
            values: { token: '7842139046:AAEhBO9xK_demo_token_FkMzqW', proxy: '' }
        },
        Discord: {
            config_key: 'Discord', has_config: true, has_accounts: true,
            schema: { fields: {
                application_id: { type: 'string', description: 'Discord Application ID', order: 1 },
                public_key: { type: 'string', description: 'Discord Public Key', order: 2 },
            }},
            values: { application_id: '1234567890123456789', public_key: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' },
            account_schema: { fields: {
                enabled: { type: 'boolean', widget: 'switch', order: 1 },
                name: { type: 'string', order: 2 },
                token: { type: 'string', secret: true, description: 'Bot Token', order: 3 },
            }},
            accounts: { 'main-bot': { enabled: true, name: 'main-bot', token: 'MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GabcDE.demo_token_hash_FkMzqW' } }
        },
        OneBot11: {
            config_key: 'OneBot11', has_config: true, has_accounts: true,
            schema: { fields: {
                host: { type: 'string', description: 'WebSocket 监听地址', order: 1 },
                port: { type: 'integer', description: 'WebSocket 监听端口', order: 2 },
                access_token: { type: 'string', secret: true, description: '访问令牌', order: 3 },
            }},
            values: { host: '0.0.0.0', port: 8080, access_token: 'onebot_access_token_demo' },
            account_schema: { fields: {
                enabled: { type: 'boolean', widget: 'switch', order: 1 },
                name: { type: 'string', order: 2 },
                host: { type: 'string', description: '连接地址', order: 3 },
                port: { type: 'integer', description: '连接端口', order: 4 },
                token: { type: 'string', secret: true, description: '鉴权 Token', order: 5 },
                client_token: { type: 'string', secret: true, description: '客户端 Token', order: 6 },
            }},
            accounts: { default: { enabled: false, name: 'default', host: '127.0.0.1', port: 6700, token: '', client_token: 'ob12_client_token_demo' } }
        },
        Kook: {
            config_key: 'Kook', has_config: true, has_accounts: false,
            schema: { fields: {
                token: { type: 'string', secret: true, description: 'KOOK Bot Token', order: 1 },
                verify_token: { type: 'string', secret: true, description: 'Webhook 验证 Token', order: 2 },
            }},
            values: { token: '1/MTIzNDU=/demo-kook-token-abc', verify_token: 'verify_token_demo_kook' }
        }
    };

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
            var adapterMatch = matchPath.match(/^\/api\/adapter\/([^/]+)\/(config|accounts)(\/.*)?$/);
            if (adapterMatch) {
                var aPlatform = adapterMatch[1];
                var aAction = adapterMatch[2];
                var aSub = adapterMatch[3] || '';
                var aCfg = _mockAdapterConfigs[aPlatform];
                if (!aCfg) return _json({ error: 'Adapter not found' }, 50);
                if (aAction === 'config') {
                    if (init && init.method === 'PUT') return _json({ success: true });
                    return _json({
                        platform: aPlatform, config_key: aCfg.config_key,
                        has_config: aCfg.has_config, has_accounts: aCfg.has_accounts,
                        schema: aCfg.schema, values: aCfg.values,
                        account_schema: aCfg.account_schema, accounts: aCfg.accounts,
                        accounts_key: aCfg.config_key + '.accounts',
                    });
                }
                if (aAction === 'accounts') {
                    if (aSub === '/add') return _json({ success: true });
                    if (aSub && init && init.method === 'DELETE') return _json({ success: true });
                    if (init && init.method === 'PUT') return _json({ success: true });
                    return _json({
                        schema: aCfg.account_schema,
                        accounts: aCfg.accounts || {},
                        accounts_key: aCfg.config_key + '.accounts',
                    });
                }
            }
            var moduleMatch = matchPath.match(/^\/api\/module\/([^/]+)\/config$/);
            if (moduleMatch) {
                var mName = moduleMatch[1];
                var _mockModuleConfigs = {
                    'HelpModule': {
                        config_key: 'HelpModule', has_config: true,
                        schema: { fields: {
                            response_prefix: { type: 'string', description: '回显前缀', order: 1 },
                            max_length: { type: 'integer', description: '最大字符数', order: 2 },
                            random_reply: { type: 'boolean', widget: 'switch', description: '随机回复', order: 3 },
                        }},
                        values: { response_prefix: '你说：', max_length: 200, random_reply: false }
                    },
                    'Cron': {
                        config_key: 'Cron', has_config: true,
                        schema: { fields: {
                            rules_file: { type: 'string', description: '规则文件路径', order: 1 },
                            match_mode: { type: 'string', widget: 'select', options: ['exact', 'fuzzy', 'regex'], description: '匹配模式', order: 2 },
                            cooldown: { type: 'integer', description: '冷却时间（秒）', order: 3 },
                            ignore_case: { type: 'boolean', widget: 'switch', description: '忽略大小写', order: 4 },
                        }},
                        values: { rules_file: 'rules.yaml', match_mode: 'exact', cooldown: 5, ignore_case: true }
                    },
                    'Weather': {
                        config_key: 'Weather', has_config: true,
                        schema: { fields: {
                            max_tasks: { type: 'integer', description: '最大任务数', order: 1 },
                            default_interval: { type: 'integer', description: '默认执行间隔（秒）', order: 2 },
                            persist_tasks: { type: 'boolean', widget: 'switch', description: '持久化任务', order: 3 },
                        }},
                        values: { max_tasks: 50, default_interval: 3600, persist_tasks: true }
                    }
                };
                var mCfg = _mockModuleConfigs[mName];
                if (!mCfg) return _json({ error: 'Module config not found' }, 50);
                if (init && init.method === 'PUT') return _json({ success: true });
                return _json(mCfg);
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
            if (typeRoll < 0.55) {
                var ev = { id: 'evt_' + _r(10000, 99999), time: Date.now() / 1000, type: 'message', detail_type: _pick(['private', 'group']), platform: _pick(['qq', 'telegram', 'discord', 'kook']), sub_type: '', self_id: 'bot_001', user_id: _pick(USERS), group_id: '', alt_message: _pick(MSGS) };
                self.onmessage({ data: JSON.stringify({ type: 'event', data: ev }) });
            } else if (typeRoll < 0.7) {
                var ev2 = { id: 'evt_' + _r(10000, 99999), time: Date.now() / 1000, type: 'notice', detail_type: _pick(NOTICE_TYPES), platform: _pick(ADAPTERS), sub_type: '', self_id: 'bot_001', user_id: '', group_id: '', alt_message: '' };
                self.onmessage({ data: JSON.stringify({ type: 'event', data: ev2 }) });
            } else if (typeRoll < 0.85) {
                // Simulate real-time log streaming
                var logLevels = [
                    { level: 'TRACE', level_num: 5 },
                    { level: 'DEBUG', level_num: 10 },
                    { level: 'INFO', level_num: 20 },
                    { level: 'INFO', level_num: 20 },
                    { level: 'EVENT', level_num: 21 },
                    { level: 'WARNING', level_num: 30 },
                    { level: 'ERROR', level_num: 40 }
                ];
                var lvl = _pick(logLevels);
                var now = new Date();
                var ts = now.toISOString().slice(0, 19).replace('T', ' ');
                var logEntry = {
                    timestamp: ts,
                    level: lvl.level,
                    level_num: lvl.level_num,
                    module: _pick(LOG_MODULES),
                    message: _pick(LOG_MSGS)
                };
                self.onmessage({ data: JSON.stringify({ type: 'log_entry', data: logEntry }) });
            } else {
                var ev3 = { id: 'evt_' + _r(10000, 99999), time: Date.now() / 1000, type: 'meta', detail_type: 'heartbeat', platform: '', sub_type: '', self_id: '', user_id: '', group_id: '', alt_message: '' };
                self.onmessage({ data: JSON.stringify({ type: 'event', data: ev3 }) });
            }
        }, _r(2000, 6000));

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

    // Demo 登录页提示 token
    function _showDemoTokenHint() {
        var hint = document.getElementById('authHint');
        if (!hint) {
            setTimeout(_showDemoTokenHint, 200);
            return;
        }
        var app = document.querySelector('.app');
        var isAuthed = app && app.classList.contains('authed');
        if (isAuthed) return;
        hint.innerHTML = '<div style="padding:8px 12px;border-radius:8px;background:color-mix(in srgb,#f59e0b 12%,transparent);border:1px solid color-mix(in srgb,#f59e0b 30%,transparent);font-size:12px;color:#f59e0b;margin-top:4px">Demo Token: <code style="font-weight:700;user-select:all;cursor:pointer" onclick="document.getElementById(\'loginInput\').value=\'demo\'">demo</code> — 点击填入</div>';
        var input = document.getElementById('loginInput');
        if (input && !input.value) input.placeholder = 'demo';
    }
    setTimeout(_showDemoTokenHint, 500);

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
