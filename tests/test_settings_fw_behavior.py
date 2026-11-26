"""设置页「框架行为」与配置页共用同一份定义。

两页是同一份配置的两个入口：选项与默认值只在 framework.js 维护，设置页经
fwFieldOptions / fwFieldDefault 取用。node 侧脚本打桩渲染设置页，把渲染出的
选项、默认值与配置页的定义逐项比对。

两处各写一份曾漂移过：日志等级一边缺 TRACE / EVENT、多出不存在的 SUCCESS，
选项文字空白，数字被当字符串写进配置。
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tests" / "js" / "fw_behavior_sync.mjs"
STATIC_JS = ROOT / "ErisPulse_Dashboard" / "static" / "js"


@pytest.mark.skipif(shutil.which("node") is None, reason="node 不可用")
class TestSettingsFwBehaviorSync:
    def test_settings_shares_config_page_definitions(self):
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
        assert payload["checks"] > 100
