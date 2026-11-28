"""命令 ACL 用户候选弹窗（node 冒烟）。

openUserCandidates 为主人卡片与命令 ACL 共用的「从最近消息选择用户」组件：
数据 /api/master/candidates 与 ACL 的 platform:uid 同构，选中直接写入
allow/deny（去重），主人卡片保持回填表单的旧交互。
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tests" / "js" / "acl_candidates.mjs"
STATIC_JS = ROOT / "ErisPulse_Dashboard" / "static" / "js"


@pytest.mark.skipif(shutil.which("node") is None, reason="node 不可用")
class TestAclCandidates:
    def test_candidate_picker_flow(self):
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
