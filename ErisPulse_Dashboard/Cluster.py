from __future__ import annotations

import asyncio
import time
import aiohttp

CAPABILITY_PROBES: dict[str, str] = {
    "auth_status":       "/api/auth/status",
    "status":            "/api/status",
    "system":            "/api/system",
    "adapters":          "/api/adapters",
    "modules":           "/api/modules",
    "bots":              "/api/bots",
    "events":            "/api/events",
    "config":            "/api/config",
    "storage":           "/api/storage",
    "store":             "/api/store/remote",
    "packages":          "/api/packages",
    "logs":              "/api/logs",
    "lifecycle":         "/api/lifecycle",
    "audit":             "/api/audit",
    "backup":            "/api/backup/export",
    "files":             "/api/files/browse",
    "commands":          "/api/commands",
    "event_builder":     "/api/builder/segments",
    "config_source":     "/api/config/source",
    "framework_update":  "/api/framework/versions",
    "module_views":      "/api/views",
    "performance":       "/api/performance",
    "routes":            "/api/routes",
    "adapter_logos":     "/api/adapter-logos",
    "message_stats":     "/api/message-stats",
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

    def __init__(self, node_id: str, url: str, token: str):
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
        start = time.monotonic()
        result = await self.request("GET", "/api/auth/status")
        elapsed = time.monotonic() - start
        if result and result.get("error") not in ("connection_error", "timeout", "unknown_error"):
            self._online = True
            self._latency_ms = int(elapsed * 1000)
            self._last_ping = time.time()
            return True
        self._online = False
        self._latency_ms = -1
        return False

    async def probe_capabilities(self) -> dict[str, dict]:
        results: dict[str, dict] = {}
        for cap_id, api_path in CAPABILITY_PROBES.items():
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
            page for page, cap in PAGE_CAPABILITY_MAP.items()
            if cap and not results.get(cap, {}).get("supported", False)
        ]
        return results

    async def get_status(self) -> dict | None:
        return await self.request("GET", "/api/status")

    async def get_system(self) -> dict | None:
        return await self.request("GET", "/api/system")

    async def get_adapters(self) -> dict | None:
        return await self.request("GET", "/api/adapters")

    async def get_modules(self) -> dict | None:
        return await self.request("GET", "/api/modules")

    async def get_bots(self) -> dict | None:
        return await self.request("GET", "/api/bots")

    async def get_events(self, **params) -> dict | None:
        kwargs = {}
        if params:
            kwargs["params"] = params
        return await self.request("GET", "/api/events", **kwargs)

    async def get_views(self) -> dict | None:
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
        try:
            data = self.storage.get(self.NODES_STORAGE_KEY)
            if isinstance(data, dict):
                for nid, cfg in data.items():
                    if isinstance(cfg, dict) and all(k in cfg for k in ("id", "url", "token")):
                        self._nodes[nid] = cfg
                        self._proxies[nid] = NodeProxy(cfg["id"], cfg["url"], cfg["token"])
        except Exception:
            self._nodes = {}
            self._proxies = {}

    def _save_nodes(self):
        try:
            self.storage.set(self.NODES_STORAGE_KEY, self._nodes)
        except Exception:
            self.logger.error("Failed to save cluster nodes config")

    async def add_node(self, node_id: str, name: str, url: str, token: str) -> bool:
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
        if node_id not in self._nodes:
            return False
        proxy = self._proxies.pop(node_id, None)
        if proxy:
            await proxy.close()
        del self._nodes[node_id]
        self._save_nodes()
        return True

    async def update_node(self, node_id: str, **kwargs) -> bool:
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
        return [self.get_node(nid) for nid in self._nodes if self.get_node(nid) is not None]

    def get_proxy(self, node_id: str) -> NodeProxy | None:
        return self._proxies.get(node_id)

    async def ping_all(self) -> dict[str, bool]:
        if not self._proxies:
            return {}
        async def _ping_one(nid: str, proxy: NodeProxy) -> tuple[str, bool]:
            try:
                return nid, await proxy.ping()
            except Exception:
                return nid, False
        results = await asyncio.gather(*[
            _ping_one(nid, proxy) for nid, proxy in self._proxies.items()
        ])
        return dict(results)

    async def probe_node(self, node_id: str) -> dict | None:
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
        if not self._proxies:
            return {}
        pairs = await asyncio.gather(*[
            self._fetch_node_overview(nid, proxy)
            for nid, proxy in self._proxies.items()
        ])
        return dict(pairs)

    async def start_heartbeat(self, interval: int = 30):
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
