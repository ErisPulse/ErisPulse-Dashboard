from __future__ import annotations

import asyncio
import time

import aiohttp

# 后备 API 探测列表（当自动发现失败时使用）
FALLBACK_CAPABILITY_PROBES: dict[str, str] = {
    "auth_status": "/api/auth/status",
    "status": "/api/status",
    "system": "/api/system",
    "adapter_logos": "/api/adapter-logos",
    "adapters": "/api/adapters",
    "modules": "/api/modules",
    "bots": "/api/bots",
    "events": "/api/events",
    "config": "/api/config",
    "storage": "/api/storage",
    "store": "/api/store/remote",
    "store_install_status": "/api/store/install/status",
    "store_package_detail": "/api/store/package/detail",
    "packages": "/api/packages",
    "packages_updates": "/api/packages/updates",
    "packages_git": "/api/packages/git",
    "framework_versions": "/api/framework/versions",
    "event_builder": "/api/builder/segments",
    "config_source": "/api/config/source",
    "logs": "/api/logs",
    "lifecycle": "/api/lifecycle",
    "performance": "/api/performance",
    "routes": "/api/routes",
    "message_stats": "/api/message-stats",
    "audit": "/api/audit",
    "backup": "/api/backup/export",
    "files": "/api/files/browse",
    "files_read": "/api/files/read",
    "files_download": "/api/files/download",
    "files_stat": "/api/files/stat",
    "files_search": "/api/files/search",
    "commands": "/api/commands",
    "module_views": "/api/views",
    "cluster_nodes": "/api/cluster/nodes",
    "cluster_overview": "/api/cluster/overview",
}

# 跳过探测的 API 端点（动态路径或不需要探测的端点）
SKIP_CAPABILITY_PROBES = {
    "/api/auth",
    "/api/cluster/nodes",
    "/api/cluster/proxy",
    "/api/adapter",
    "/api/commands/{name}",
    "/ws",
}

# API 路径到 capability ID 的映射表
API_TO_CAPABILITY_MAP = {
    "/api/auth/status": "auth_status",
    "/api/status": "status",
    "/api/system": "system",
    "/api/adapter-logos": "adapter_logos",
    "/api/adapters": "adapters",
    "/api/modules": "modules",
    "/api/bots": "bots",
    "/api/events": "events",
    "/api/config": "config",
    "/api/storage": "storage",
    "/api/store/remote": "store",
    "/api/store/install/status": "store_install_status",
    "/api/store/package/detail": "store_package_detail",
    "/api/packages": "packages",
    "/api/packages/updates": "packages_updates",
    "/api/packages/git": "packages_git",
    "/api/framework/versions": "framework_versions",
    "/api/builder/segments": "event_builder",
    "/api/config/source": "config_source",
    "/api/logs": "logs",
    "/api/lifecycle": "lifecycle",
    "/api/performance": "performance",
    "/api/routes": "routes",
    "/api/message-stats": "message_stats",
    "/api/audit": "audit",
    "/api/backup/export": "backup",
    "/api/files/browse": "files",
    "/api/files/read": "files_read",
    "/api/files/download": "files_download",
    "/api/files/stat": "files_stat",
    "/api/files/search": "files_search",
    "/api/commands": "commands",
    "/api/views": "module_views",
    "/api/cluster/nodes": "cluster_nodes",
    "/api/cluster/overview": "cluster_overview",
}

PAGE_CAPABILITY_MAP: dict[str, str | None] = {
    "dashboard": None,
    "bots": "bots",
    "event-stream": "events",
    "event-builder": "event_builder",
    "commands": "commands",
    "modules": "modules",
    "store": "store",
    "packages": "packages",
    "logs": "logs",
    "lifecycle": "lifecycle",
    "audit": "audit",
    "api-routes": "routes",
    "config": "config",
    "framework-config": "config_source",
    "files": "files",
}


class NodeProxy:
    """
    集群节点代理类，用于与远程 ErisPulse Dashboard 节点通信

    该类提供了节点连接、API 请求、能力探测等核心功能。

    {!--< tips >!--}
    此类会自动管理 HTTP 会话的生命周期，无需手动处理会话关闭。
    {!--< /tips >!--}
    """

    def __init__(self, node_id: str, url: str, token: str):
        """
        初始化节点代理

        :param node_id: [str] 节点唯一标识符
        :param url: [str] 节点 Dashboard 地址 (如: http://localhost:8000)
        :param token: [str] 认证令牌
        """
        self.node_id = node_id
        self.url = url.rstrip("/")
        self.token = token
        self._session: aiohttp.ClientSession | None = None
        self._connector: aiohttp.TCPConnector | None = None
        self._online = False
        self._latency_ms: int = -1
        self._last_ping: float = 0.0
        self._capabilities: dict[str, dict] = {}
        self._dashboard_version: str = ""
        self._unsupported_pages: list[str] = []

    async def get_session(self) -> aiohttp.ClientSession:
        """
        获取或创建 HTTP 会话

        如果会话不存在或已关闭，将创建新的会话。
        每个会话限制 4 个并发连接。

        :return: [aiohttp.ClientSession] HTTP 会话对象
        """
        if self._session is None or self._session.closed:
            self._connector = aiohttp.TCPConnector(limit=4, force_close=False)
            timeout = aiohttp.ClientTimeout(total=10)
            self._session = aiohttp.ClientSession(
                connector=self._connector,
                timeout=timeout,
                headers={"Authorization": f"Bearer {self.token}"},
            )
        return self._session

    async def request(self, method: str, path: str, **kwargs) -> dict | None:
        """
        向远程节点发送 HTTP 请求

        此方法会自动处理认证、错误响应和异常情况。
        请求路径会自动添加 /Dashboard 前缀。

        :param method: [str] HTTP 方法 (GET, POST, PUT, DELETE)
        :param path: [str] API 路径 (如: /api/status)
        :param kwargs: 传递给 aiohttp 的额外参数

        :return: [dict | None] 响应数据或错误信息
            - 成功时返回解析后的 JSON 数据
            - 失败时返回包含 error 键的错误字典
        """
        session = await self.get_session()
        url = f"{self.url}/Dashboard{path}"
        try:
            async with session.request(method, url, **kwargs) as resp:
                if resp.status == 401:
                    return {"error": "unauthorized", "status": 401}
                if resp.status == 404:
                    return {"error": "not_found", "status": 404}
                try:
                    return await resp.json()
                except Exception:
                    return {"error": "invalid_json", "status": resp.status}
        except asyncio.TimeoutError:
            return {"error": "timeout"}
        except aiohttp.ClientError:
            return {"error": "connection_error"}
        except Exception:
            return {"error": "unknown_error"}

    async def request_raw(self, method: str, path: str, **kwargs) -> dict | None:
        """
        向远程节点发送原始 HTTP 请求（不添加 /Dashboard 前缀）

        {!--< internal-use >!--}
        此方法用于特殊场景，普通请求请使用 request() 方法
        {!--< /internal-use >!--}

        :param method: [str] HTTP 方法
        :param path: [str] 完整 URL 路径
        :param kwargs: 传递给 aiohttp 的额外参数

        :return: [dict | None] 响应数据或错误信息
        """
        session = await self.get_session()
        url = f"{self.url}{path}"
        try:
            async with session.request(method, url, **kwargs) as resp:
                if resp.status == 401:
                    return {"error": "unauthorized", "status": 401}
                if resp.status == 404:
                    return {"error": "not_found", "status": 404}
                try:
                    return await resp.json()
                except Exception:
                    return {"error": "invalid_json", "status": resp.status}
        except asyncio.TimeoutError:
            return {"error": "timeout"}
        except aiohttp.ClientError:
            return {"error": "connection_error"}
        except Exception:
            return {"error": "unknown_error"}

    async def ping(self) -> bool:
        """
        检测节点是否在线

        通过请求 /api/auth/status 端点来检测节点连通性，
        并记录延迟时间。

        :return: [bool] 节点是否在线
            - True: 节点在线且响应正常
            - False: 节点离线或连接失败
        """
        start = time.monotonic()
        result = await self.request("GET", "/api/auth/status")
        elapsed = time.monotonic() - start
        if result and result.get("error") not in (
            "connection_error",
            "timeout",
            "unknown_error",
        ):
            self._online = True
            self._latency_ms = int(elapsed * 1000)
            self._last_ping = time.time()
            return True
        self._online = False
        self._latency_ms = -1
        return False

    async def _fetch_api_routes(self) -> list[str] | None:
        """
        从服务器获取所有 API 路由

        通过请求 /api/routes 端点获取所有注册的 API 路由信息，
        并筛选出 GET 方法的 API 端点。

        {!--< internal-use >!--}
        此方法仅用于 probe_capabilities() 内部
        {!--< /internal-use >!--}

        :return: [list[str] | None] API 路径列表
            - 成功: 返回排序后的 API 路径列表
            - 失败: 返回 None (将使用后备列表)
        """
        routes_data = await self.request("GET", "/api/routes")
        if not routes_data or routes_data.get("error"):
            return None

        http_routes = routes_data.get("http_routes", [])
        api_paths = set()

        for route in http_routes:
            path = route.get("path", "")
            method = route.get("method", "")
            # 只收集 GET 方法的 API 端点
            if method == "GET" and path.startswith("/api/"):
                api_paths.add(path)

        return sorted(list(api_paths))

    async def probe_capabilities(self) -> dict[str, dict]:
        """
        探测节点的 API 能力

        此方法会尝试从远程节点获取所有可用的 API 端点，
        并逐个测试其可用性。支持自动发现和后备机制。

        :return: [dict[str, dict]] 能力探测结果
            返回一个字典，键为 capability ID，值为探测结果：
            - supported: [bool] 是否支持
            - reason: [str] 不支持的原因 (当 supported=False 时)

        {!--< tips >!--}
        探测结果会自动更新到 self._capabilities 和 self._unsupported_pages
        {!--< /tips >!--}
        """
        results: dict[str, dict] = {}

        # 尝试从 /api/routes 自动发现 API 端点
        api_paths = await self._fetch_api_routes()

        if api_paths is None:
            # 自动发现失败，使用后备列表
            api_paths = list(FALLBACK_CAPABILITY_PROBES.values())

        # 过滤掉不需要探测的端点
        probe_paths = [
            path
            for path in api_paths
            if not any(skip in path for skip in SKIP_CAPABILITY_PROBES)
        ]

        # 探测每个 API 端点
        for api_path in probe_paths:
            # 使用映射表获取 capability ID，如果没有则生成默认 ID
            cap_id = API_TO_CAPABILITY_MAP.get(api_path)
            if cap_id is None:
                # 默认生成方式：去掉 /api/ 前缀，用下划线替换斜杠
                cap_id = api_path.replace("/api/", "").replace("/", "_")

            result = await self.request("GET", api_path)
            if result is None:
                results[cap_id] = {"supported": False, "reason": "no_response"}
            elif result.get("error") == "not_found":
                results[cap_id] = {"supported": False, "reason": "api_not_found"}
            elif result.get("error") in ("connection_error", "timeout"):
                results[cap_id] = {"supported": False, "reason": "connection_error"}
            elif result.get("error") == "unauthorized":
                results[cap_id] = {"supported": False, "reason": "unauthorized"}
            else:
                results[cap_id] = {"supported": True}

        self._capabilities = results
        self._unsupported_pages = [
            page
            for page, cap in PAGE_CAPABILITY_MAP.items()
            if cap and not results.get(cap, {}).get("supported", False)
        ]
        return results

    async def get_status(self) -> dict | None:
        """
        获取节点状态信息

        :return: [dict | None] 节点状态数据
        """
        return await self.request("GET", "/api/status")

    async def get_system(self) -> dict | None:
        """
        获取节点系统信息

        :return: [dict | None] 系统信息数据
        """
        return await self.request("GET", "/api/system")

    async def get_adapters(self) -> dict | None:
        """
        获取节点适配器列表

        :return: [dict | None] 适配器列表数据
        """
        return await self.request("GET", "/api/adapters")

    async def get_modules(self) -> dict | None:
        """
        获取节点模块列表

        :return: [dict | None] 模块列表数据
        """
        return await self.request("GET", "/api/modules")

    async def get_bots(self) -> dict | None:
        """
        获取节点机器人列表

        :return: [dict | None] 机器人列表数据
        """
        return await self.request("GET", "/api/bots")

    async def get_events(self, **params) -> dict | None:
        """
        获取节点事件列表

        :param params: [dict] 查询参数 (如 limit, offset 等)

        :return: [dict | None] 事件列表数据
        """
        kwargs = {}
        if params:
            kwargs["params"] = params
        return await self.request("GET", "/api/events", **kwargs)

    async def get_views(self) -> dict | None:
        """
        获取节点注册的视图列表

        :return: [dict | None] 视图列表数据
        """
        return await self.request("GET", "/api/views")

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
        if self._connector and not self._connector.closed:
            await self._connector.close()
        self._session = None
        self._connector = None


class ClusterManager:
    NODES_STORAGE_KEY = "__ep_cluster_nodes__"

    def __init__(self, storage, logger):
        self.storage = storage
        self.logger = logger
        self._nodes: dict[str, dict] = {}
        self._proxies: dict[str, NodeProxy] = {}
        self._loop: asyncio.AbstractEventLoop | None = None
        self._heartbeat_task: asyncio.Task | None = None
        self._load_nodes()

    def _load_nodes(self):
        """
        从存储中加载节点配置

        {!--< internal-use >!--}
        此方法在 __init__ 中自动调用
        {!--< /internal-use >!--}
        """
        try:
            data = self.storage.get(self.NODES_STORAGE_KEY)
            if isinstance(data, dict):
                for nid, cfg in data.items():
                    if isinstance(cfg, dict) and all(
                        k in cfg for k in ("id", "url", "token")
                    ):
                        self._nodes[nid] = cfg
                        self._proxies[nid] = NodeProxy(
                            cfg["id"], cfg["url"], cfg["token"]
                        )
        except Exception:
            self._nodes = {}
            self._proxies = {}

    def _save_nodes(self):
        """
        保存节点配置到存储

        {!--< internal-use >!--}
        此方法在节点配置变更时自动调用
        {!--< /internal-use >!--}
        """
        try:
            self.storage.set(self.NODES_STORAGE_KEY, self._nodes)
        except Exception:
            self.logger.error("Failed to save cluster nodes config")

    async def add_node(self, node_id: str, name: str, url: str, token: str) -> bool:
        """
        添加集群节点

        添加成功后会自动尝试连接节点、获取版本信息并探测能力。

        :param node_id: [str] 节点唯一标识符
        :param name: [str] 节点显示名称
        :param url: [str] 节点 Dashboard 地址
        :param token: [str] 认证令牌

        :return: [bool] 是否添加成功
            - True: 添加成功
            - False: 节点 ID 已存在或 URL 格式错误
        """
        if node_id in self._nodes:
            return False
        if not url.startswith(("http://", "https://")):
            return False
        cfg = {
            "id": node_id,
            "name": name or node_id,
            "url": url.rstrip("/"),
            "token": token,
            "enabled": True,
            "added_at": time.time(),
        }
        self._nodes[node_id] = cfg
        proxy = NodeProxy(node_id, url, token)
        self._proxies[node_id] = proxy
        self._save_nodes()
        try:
            await proxy.ping()
            if proxy._online:
                status = await proxy.get_status()
                if status and isinstance(status, dict) and not status.get("error"):
                    fw = status.get("framework", {})
                    proxy._dashboard_version = fw.get("version", "")
                await proxy.probe_capabilities()
        except Exception:
            pass
        return True

    async def remove_node(self, node_id: str) -> bool:
        """
        移除集群节点

        :param node_id: [str] 节点唯一标识符

        :return: [bool] 是否移除成功
        """
        if node_id not in self._nodes:
            return False
        proxy = self._proxies.pop(node_id, None)
        if proxy:
            await proxy.close()
        del self._nodes[node_id]
        self._save_nodes()
        return True

    async def update_node(self, node_id: str, **kwargs) -> bool:
        """
        更新集群节点配置

        支持更新的字段: name, url, token, enabled
        当 url 或 token 变化时，会重新创建节点代理。

        :param node_id: [str] 节点唯一标识符
        :param kwargs: 要更新的字段

        :return: [bool] 是否更新成功
        """
        if node_id not in self._nodes:
            return False
        cfg = self._nodes[node_id]
        changed_proxy = False
        for key in ("name", "url", "token"):
            if key in kwargs and kwargs[key] != cfg.get(key):
                cfg[key] = kwargs[key]
                changed_proxy = True
        if "enabled" in kwargs:
            cfg["enabled"] = kwargs["enabled"]
        self._nodes[node_id] = cfg
        if changed_proxy:
            old = self._proxies.pop(node_id, None)
            if old:
                await old.close()
            self._proxies[node_id] = NodeProxy(cfg["id"], cfg["url"], cfg["token"])
        self._save_nodes()
        return True

    def get_node(self, node_id: str) -> dict | None:
        """
        获取单个节点的详细信息

        :param node_id: [str] 节点唯一标识符

        :return: [dict | None] 节点信息字典，包含:
            - id: 节点 ID
            - name: 节点名称
            - url: 节点地址
            - enabled: 是否启用
            - online: 是否在线
            - latency_ms: 延迟(毫秒)
            - last_ping: 最后 ping 时间戳
            - capabilities: 能力字典
            - dashboard_version: Dashboard 版本
            - unsupported_pages: 不支持的页面列表
        """
        if node_id not in self._nodes:
            return None
        cfg = dict(self._nodes[node_id])
        proxy = self._proxies.get(node_id)
        if proxy:
            cfg["online"] = proxy._online
            cfg["latency_ms"] = proxy._latency_ms
            cfg["last_ping"] = proxy._last_ping
            cfg["capabilities"] = dict(proxy._capabilities)
            cfg["dashboard_version"] = proxy._dashboard_version
            cfg["unsupported_pages"] = list(proxy._unsupported_pages)
        else:
            cfg["online"] = False
            cfg["latency_ms"] = -1
            cfg["capabilities"] = {}
            cfg["dashboard_version"] = ""
            cfg["unsupported_pages"] = []
        return cfg

    def list_nodes(self) -> list[dict]:
        """
        获取所有节点的详细信息

        :return: [list[dict]] 节点信息列表
        """
        return [
            self.get_node(nid) for nid in self._nodes if self.get_node(nid) is not None
        ]

    def get_proxy(self, node_id: str) -> NodeProxy | None:
        """
        获取节点的代理对象

        {!--< internal-use >!--}
        用于直接操作节点代理，如调用自定义 API
        {!--< /internal-use >!--}

        :param node_id: [str] 节点唯一标识符

        :return: [NodeProxy | None] 节点代理对象
        """
        return self._proxies.get(node_id)

    async def ping_all(self) -> dict[str, bool]:
        """
        检测所有节点的在线状态

        :return: [dict[str, bool]] 节点 ID 到在线状态的映射
        """
        if not self._proxies:
            return {}

        async def _ping_one(nid: str, proxy: NodeProxy) -> tuple[str, bool]:
            try:
                return nid, await proxy.ping()
            except Exception:
                return nid, False

        results = await asyncio.gather(
            *[_ping_one(nid, proxy) for nid, proxy in self._proxies.items()]
        )
        return dict(results)

    async def probe_node(self, node_id: str) -> dict | None:
        """
        探测指定节点的能力

        :param node_id: [str] 节点唯一标识符

        :return: [dict | None] 探测结果，包含:
            - capabilities: 能力字典
            - dashboard_version: Dashboard 版本
            - unsupported_pages: 不支持的页面列表
        """
        proxy = self._proxies.get(node_id)
        if not proxy:
            return None
        caps = await proxy.probe_capabilities()
        status = await proxy.get_status()
        ver = ""
        if status and isinstance(status, dict) and not status.get("error"):
            ver = status.get("framework", {}).get("version", "")
        proxy._dashboard_version = ver
        return {
            "capabilities": caps,
            "dashboard_version": ver,
            "unsupported_pages": list(proxy._unsupported_pages),
        }

    async def _fetch_node_overview(self, nid: str, proxy: NodeProxy) -> dict:
        """
        获取节点概览信息

        {!--< internal-use >!--}
        此方法仅用于 get_all_status() 内部
        {!--< /internal-use >!--}

        :param nid: [str] 节点 ID
        :param proxy: [NodeProxy] 节点代理

        :return: [dict] 节点概览信息
        """
        if not proxy._online:
            return nid, {
                "online": False,
                "name": self._nodes[nid].get("name", nid),
                "latency_ms": -1,
            }
        status = None
        system = None
        try:
            status, system = await asyncio.gather(
                proxy.get_status(), proxy.get_system()
            )
        except Exception:
            pass
        result = {
            "online": True,
            "name": self._nodes[nid].get("name", nid),
            "latency_ms": proxy._latency_ms,
            "dashboard_version": proxy._dashboard_version,
        }
        if status and isinstance(status, dict) and not status.get("error"):
            result["status"] = status
        else:
            result["status"] = None
        if system and isinstance(system, dict) and not system.get("error"):
            result["system"] = system
        else:
            result["system"] = None
        return nid, result

    async def get_all_status(self) -> dict[str, dict]:
        """
        获取所有节点的状态概览

        :return: [dict[str, dict]] 节点 ID 到概览信息的映射
        """
        if not self._proxies:
            return {}
        pairs = await asyncio.gather(
            *[
                self._fetch_node_overview(nid, proxy)
                for nid, proxy in self._proxies.items()
            ]
        )
        return dict(pairs)

    async def start_heartbeat(self, interval: int = 30):
        """
        启动心跳检测任务

        会定期检测所有节点的在线状态，更新节点信息。

        :param interval: [int] 心跳间隔(秒) (默认: 30)
        """
        self._loop = asyncio.get_running_loop()

        async def _loop():
            while True:
                try:
                    await self.ping_all()
                except Exception:
                    pass
                await asyncio.sleep(interval)

        self._heartbeat_task = asyncio.create_task(_loop())

    async def close(self):
        """
        关闭集群管理器，释放所有资源

        会停止心跳任务并关闭所有节点代理。
        """
        if self._heartbeat_task and not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        for proxy in self._proxies.values():
            try:
                await proxy.close()
            except Exception:
                pass
        self._proxies.clear()
