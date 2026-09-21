"""ApiClusterMixin：拓扑与集群节点管理 API"""

import secrets

from fastapi import Request
from fastapi.responses import JSONResponse

from .Helpers import _CoreHelpers


class ApiClusterMixin:
    """拓扑图、集群节点管理与事件同步 API。"""


    async def _api_topology(self, request: Request) -> JSONResponse:
        try:
            topology = self.sdk.get_topology()
        except AttributeError:
            return JSONResponse({"supported": False})
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

        # 补充模块依赖声明（module.get_topology 未含 depends）
        modules_tree = topology.get("modules") or {}
        for name, info in modules_tree.items():
            depends = []
            try:
                meta = (info.get("info") or {}) if isinstance(info, dict) else {}
                raw = meta.get("depends")
                if not raw:
                    module_class = self.sdk.module._module_classes.get(name)
                    if module_class is not None and hasattr(module_class, "get_load_strategy"):
                        raw = getattr(module_class.get_load_strategy(), "depends", None)
                if isinstance(raw, str):
                    raw = [raw]
                if isinstance(raw, (list, tuple, set)):
                    depends = [str(d) for d in raw if str(d).strip()]
            except Exception:
                depends = []
            if isinstance(info, dict):
                info["depends"] = depends
        return JSONResponse(
            {"supported": True, "topology": _CoreHelpers._json_safe(topology)}
        )

    async def _api_views(self, request: Request) -> JSONResponse:
        return JSONResponse({"views": self.get_registered_views()})

    async def _api_cluster_nodes_list(self, request: Request) -> JSONResponse:
        if not self._cluster:
            return JSONResponse(
                {"nodes": [], "local": {"id": "local", "name": "本地实例"}}
            )
        nodes = self._cluster.list_nodes()
        return JSONResponse(
            {
                "nodes": nodes,
                "local": {"id": "local", "name": "本地实例"},
            }
        )

    async def _api_cluster_nodes_add(self, request: Request) -> JSONResponse:
        if not self._cluster:
            return JSONResponse({"error": "cluster_not_initialized"}, status_code=503)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        node_id = str(body.get("id", "")).strip()
        name = str(body.get("name", "")).strip()
        url = str(body.get("url", "")).strip()
        token = str(body.get("token", "")).strip()
        # 节点ID自动生成，简化用户操作
        if not node_id:
            node_id = "node_" + secrets.token_urlsafe(6)
        if not url or not token:
            return JSONResponse({"error": "url, token are required"}, status_code=400)
        if node_id == "local":
            return JSONResponse({"error": "reserved_id"}, status_code=400)
        if node_id in self._cluster._nodes:
            return JSONResponse({"error": "node_already_exists"}, status_code=409)
        ok = await self._cluster.add_node(node_id, name, url, token)
        if not ok:
            return JSONResponse({"error": "add_failed"}, status_code=400)
        self._add_audit_log("cluster_node_add", f"node={node_id} url={url}", request)
        return JSONResponse({"success": True, "node": self._cluster.get_node(node_id)})

    async def _api_cluster_nodes_update(self, request: Request) -> JSONResponse:
        if not self._cluster:
            return JSONResponse({"error": "cluster_not_initialized"}, status_code=503)
        node_id = request.path_params.get("node_id", "")
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        kwargs = {}
        for key in ("name", "url", "token", "enabled"):
            if key in body:
                kwargs[key] = body[key]
        ok = await self._cluster.update_node(node_id, **kwargs)
        if not ok:
            return JSONResponse({"error": "node_not_found"}, status_code=404)
        self._add_audit_log("cluster_node_update", f"node={node_id}", request)
        return JSONResponse({"success": True, "node": self._cluster.get_node(node_id)})

    async def _api_cluster_nodes_delete(self, request: Request) -> JSONResponse:
        if not self._cluster:
            return JSONResponse({"error": "cluster_not_initialized"}, status_code=503)
        node_id = request.path_params.get("node_id", "")
        ok = await self._cluster.remove_node(node_id)
        if not ok:
            return JSONResponse({"error": "node_not_found"}, status_code=404)
        self._add_audit_log("cluster_node_delete", f"node={node_id}", request)
        return JSONResponse({"success": True})

    async def _api_cluster_ping(self, request: Request) -> JSONResponse:
        if not self._cluster:
            return JSONResponse({"error": "cluster_not_initialized"}, status_code=503)
        node_id = request.path_params.get("node_id", "")
        proxy = self._cluster.get_proxy(node_id)
        if not proxy:
            return JSONResponse({"error": "node_not_found"}, status_code=404)
        online = await proxy.ping()
        self._add_audit_log(
            "cluster_node_ping", f"node={node_id} online={online}", request
        )
        return JSONResponse(
            {
                "online": online,
                "latency_ms": proxy._latency_ms,
            }
        )

    async def _api_cluster_probe(self, request: Request) -> JSONResponse:
        if not self._cluster:
            return JSONResponse({"error": "cluster_not_initialized"}, status_code=503)
        node_id = request.path_params.get("node_id", "")
        result = await self._cluster.probe_node(node_id)
        if result is None:
            return JSONResponse({"error": "node_not_found"}, status_code=404)
        self._add_audit_log("cluster_node_probe", f"node={node_id}", request)
        return JSONResponse(result)

    async def _api_cluster_node_status(self, request: Request) -> JSONResponse:
        if not self._cluster:
            return JSONResponse({"error": "cluster_not_initialized"}, status_code=503)
        node_id = request.path_params.get("node_id", "")
        proxy = self._cluster.get_proxy(node_id)
        if not proxy:
            return JSONResponse({"error": "node_not_found"}, status_code=404)
        status = await proxy.get_status()
        system = await proxy.get_system()
        return JSONResponse(
            {
                "online": proxy._online,
                "latency_ms": proxy._latency_ms,
                "dashboard_version": proxy._dashboard_version,
                "status": status,
                "system": system,
                "capabilities": dict(proxy._capabilities),
            }
        )

    async def _api_cluster_proxy(self, request: Request) -> JSONResponse:
        node_id = request.path_params.get("node_id", "")
        path = request.path_params.get("path", "")
        proxy = self._cluster.get_proxy(node_id) if self._cluster else None
        if not proxy:
            return JSONResponse({"error": "node_not_found"}, status_code=404)
        method = request.method
        kwargs: dict = {}
        if method in ("POST", "PUT", "DELETE"):
            try:
                kwargs["json"] = await request.json()
            except Exception:
                pass
        params = dict(request.query_params)
        if params:
            kwargs["params"] = params
        try:
            result = await proxy.request_raw(method, f"/{path}", **kwargs)
            if result is None:
                return JSONResponse({"error": "proxy_no_response"}, status_code=502)
            if result.get("error") == "unauthorized":
                return JSONResponse({"error": "remote_unauthorized"}, status_code=502)
            return JSONResponse(result)
        except Exception as e:
            return JSONResponse(
                {"error": "proxy_error", "message": str(e)}, status_code=502
            )

    async def _api_cluster_overview(self, request: Request) -> JSONResponse:
        nodes = {}
        if self._cluster:
            nodes = await self._cluster.get_all_status()
        fw = self._get_framework_info()
        adapters_summary = self.sdk.adapter.get_status_summary().get("adapters", {})
        adapter_count = sum(1 for v in adapters_summary.values() if v.get("running"))
        modules = {
            n: self.sdk.module.is_loaded(n) for n in self.sdk.module.list_registered()
        }
        nodes["local"] = {
            "online": True,
            "name": "本地实例",
            "latency_ms": 0,
            "dashboard_version": fw.get("version", ""),
            "status": {
                "framework": fw,
                "adapters": adapters_summary,
                "modules": modules,
                "adapters_count": adapter_count,
                "modules_count": sum(1 for v in modules.values() if v),
                "events_count": self._total_event_count,
            },
            "system": await self._get_system_status(),
        }
        return JSONResponse({"nodes": nodes})

    async def _api_cluster_sync_events(self, request: Request) -> JSONResponse:
        if not self._cluster:
            return JSONResponse({"error": "cluster_not_initialized"}, status_code=503)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "invalid_body"}, status_code=400)
        source_node = body.get("source_node", "")
        target_nodes = body.get("target_nodes", [])
        event_types = body.get("event_types", [])
        if not source_node or not target_nodes:
            return JSONResponse(
                {"error": "source_node and target_nodes required"}, status_code=400
            )
        source_proxy = self._cluster.get_proxy(source_node)
        if not source_proxy:
            return JSONResponse({"error": "source_node_not_found"}, status_code=404)
        events_result = await source_proxy.get_events()
        if not events_result or "error" in (events_result or {}):
            return JSONResponse({"error": "failed_to_fetch_events"}, status_code=502)
        events = events_result.get("events", [])
        if event_types:
            events = [e for e in events if e.get("type") in event_types]
        results: dict[str, dict] = {}
        for target_id in target_nodes:
            target_proxy = self._cluster.get_proxy(target_id)
            if not target_proxy:
                results[target_id] = {"success": False, "error": "node_not_found"}
                continue
            fwd_result = await target_proxy.request(
                "POST", "/api/builder/submit", json={"events": events}
            )
            results[target_id] = {
                "success": not (fwd_result and fwd_result.get("error"))
            }
        self._add_audit_log(
            "cluster_sync_events", f"from={source_node} to={target_nodes}", request
        )
        return JSONResponse({"results": results})
