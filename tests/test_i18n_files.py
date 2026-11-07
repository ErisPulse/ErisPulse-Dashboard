"""前端 i18n 资源完整性检查。

防止两类回归：
1. 语言文件语法/运行时错误导致整个语言字典无法读取（界面显示原始键名）；
2. 各语言文件键集漂移（部分语言缺失字段），以及重复键堆积。

同时校验 dash.html 的静态资源缓存版本（?v=）一致性——静态文件变更后
未递增该版本时，浏览器会沿用旧缓存，新增文案同样表现为「缺失字段」。
"""

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
I18N_DIR = ROOT / "ErisPulse_Dashboard" / "static" / "res" / "i18n"
LANGS = ("zh", "zh-TW", "en", "ja", "ru")

KEY_LINE_RE = re.compile(r'^\s{4}([A-Za-z_][A-Za-z0-9_]*):', re.M)

# node 执行器：VM 加载语言文件，输出 JSON {ok, count, error}
NODE_RUNNER = (
    "const fs=require('fs');"
    "const sandbox={};"
    "try{"
    "new Function('window',fs.readFileSync(process.argv[1],'utf8'))(sandbox);"
    "const d=(sandbox.__EP_I18N__||{})[process.argv[2]];"
    "console.log(JSON.stringify({ok:!!d,count:d?Object.keys(d).length:0}))"
    "}catch(e){console.log(JSON.stringify({ok:false,error:e.message,count:0}))}"
)


def _extract_keys(lang: str) -> "list[str]":
    text = (I18N_DIR / f"{lang}.js").read_text(encoding="utf-8")
    return KEY_LINE_RE.findall(text)


class TestLocaleParity:
    """五个语言文件键集完全对齐（缺失即界面出现原始键名）"""

    def test_all_locales_have_identical_key_sets(self):
        key_sets = {lang: set(_extract_keys(lang)) for lang in LANGS}
        reference = key_sets["en"]
        assert reference, "en.js 未解析到任何键"
        for lang in LANGS:
            missing = sorted(reference - key_sets[lang])
            extra = sorted(key_sets[lang] - reference)
            assert not missing, f"{lang}.js 缺失键: {missing}"
            assert not extra, f"{lang}.js 多出键: {extra}"

    def test_no_duplicate_keys(self):
        for lang in LANGS:
            keys = _extract_keys(lang)
            dups = sorted({k for k in keys if keys.count(k) > 1})
            assert not dups, f"{lang}.js 存在重复键: {dups}"


@pytest.mark.skipif(shutil.which("node") is None, reason="node 不可用")
class TestLocaleRuntimeLoad:
    """node VM 实际执行语言文件：语法或运行时错误会让整个字典无法读取"""

    def test_each_locale_executes_and_exposes_dict(self):
        counts = {}
        for lang in LANGS:
            path = I18N_DIR / f"{lang}.js"
            result = subprocess.run(
                ["node", "-e", NODE_RUNNER, str(path), lang],
                capture_output=True,
                text=True,
                timeout=30,
            )
            payload = json.loads(result.stdout)
            assert payload["ok"], f"{lang}.js 无法加载: {payload.get('error')}"
            counts[lang] = payload["count"]
        assert len(set(counts.values())) == 1, f"各语言键数不一致: {counts}"
        assert counts["en"] > 1000


class TestDashHtmlAssetVersion:
    """缓存版本一致性：所有静态资源引用同一个 ?v=，避免部分资源新旧混用"""

    def test_all_asset_refs_share_one_version(self):
        html = (ROOT / "ErisPulse_Dashboard" / "static" / "dash.html").read_text(
            encoding="utf-8"
        )
        versions = set(re.findall(r'\?v=(\d+)', html))
        assert versions, "dash.html 未找到任何 ?v= 缓存版本引用"
        assert len(versions) == 1, f"缓存版本不一致: {sorted(versions)}"

    def test_i18n_script_tags_present_for_all_locales(self):
        html = (ROOT / "ErisPulse_Dashboard" / "static" / "dash.html").read_text(
            encoding="utf-8"
        )
        for lang in LANGS:
            assert f'res/i18n/{lang}.js' in html, f"dash.html 缺少 {lang}.js 引用"
