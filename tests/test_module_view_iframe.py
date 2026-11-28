"""模块外链视窗的 iframe 地址构建（node 冒烟）。

框架注册路由时剥掉结尾斜杠，带斜杠请求会 307 到绝对地址；反代未透传协议头时
Location 是 http://，被 HTTPS 页面当混合内容拦截。Dashboard 侧修正：框架相对
路径去尾斜杠绕开重定向，绝对 http:// 在 HTTPS 页面改写为 https 并告警。
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tests" / "js" / "module_view_iframe.mjs"
STATIC_JS = ROOT / "ErisPulse_Dashboard" / "static" / "js"


@pytest.mark.skipif(shutil.which("node") is None, reason="node 不可用")
class TestModuleViewIframe:
    def test_iframe_urls_are_redirect_safe(self):
        result = subprocess.run(
            ["node", str(SCRIPT), str(STATIC_JS)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        payload = json.loads(result.stdout.strip().splitlines()[-1])
        assert payload["ok"], payload["failures"]
