#!/bin/bash

set -e

# 1. 根目录 = /（仓库根）: PWD = repo, demo = repo/demo, static = repo/ErisPulse_Dashboard/static
# 2. 根目录 = /demo: PWD = repo/demo, demo = PWD, static = repo/ErisPulse_Dashboard/static
if [ -d "$PWD/ErisPulse_Dashboard" ]; then
  # 根目录是仓库根 /，直接使用
  REPO_ROOT="$PWD"
  DEMO_DIR="$REPO_ROOT/demo"
else
  # 根目录是 /demo，需上溯一级
  REPO_ROOT="$(cd .. && pwd)"
  DEMO_DIR="$PWD"
fi
STATIC_DIR="$REPO_ROOT/ErisPulse_Dashboard/static"

# 2.0 起前端拆分为 js/ 与 css/ 目录，构建同步整个目录树
echo "==> Syncing split frontend assets (js/ css/)..."
rm -rf "$DEMO_DIR/js" "$DEMO_DIR/css"
rm -f "$DEMO_DIR/dash.js" "$DEMO_DIR/dash.css"  # 1.x 单文件遗留
cp -r "$STATIC_DIR/js" "$DEMO_DIR/js"
cp -r "$STATIC_DIR/css" "$DEMO_DIR/css"

echo "==> Stripping /Dashboard/static/ prefixes in js/css..."
find "$DEMO_DIR/js" "$DEMO_DIR/css" -type f \( -name "*.js" -o -name "*.css" \) -print0 |
  xargs -0 sed -i 's|/Dashboard/static/||g'

echo "==> Generating index.html from dash.html..."
if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
elif command -v python.exe >/dev/null 2>&1; then PY=python.exe
elif command -v py >/dev/null 2>&1; then PY=py
else echo "!! python not found in PATH"; exit 1; fi
STATIC_DIR="$STATIC_DIR" DEMO_DIR="$DEMO_DIR" $PY - <<'PYEOF'
import os

static = os.environ["STATIC_DIR"]
demo = os.environ["DEMO_DIR"]

with open(os.path.join(static, "dash.html"), "r", encoding="utf-8") as f:
    html = f.read()

# 所有静态引用改为相对路径（css/*.css、js/main.js、res/i18n/*.js 等）
html = html.replace("/Dashboard/static/", "")

# mock.js 需在应用模块执行前加载：经典脚本先于 deferred module 运行，
# 注入到 </body> 前即可
mock = '<script src="mock.js"></script>\n'
html = html.replace("</body>", mock + "</body>", 1)

banner = (
    '<div id="demoBanner" style="display:none;position:fixed;left:12px;bottom:12px;'
    "z-index:9000;max-width:min(92vw,360px);padding:7px 8px 7px 14px;"
    "background:linear-gradient(90deg,rgba(245,158,11,.95),rgba(239,68,68,.95));"
    "color:#fff;border-radius:14px;font-size:12px;font-weight:600;line-height:1.5;"
    "box-shadow:0 4px 14px rgba(0,0,0,.22);align-items:center;gap:8px;"
    'backdrop-filter:blur(4px)">'
    '<span style="flex:1">⚠ Demo Mode — All data is simulated. '
    '<a href="https://github.com/ErisPulse/ErisPulse-Dashboard" target="_blank" rel="noopener" '
    'style="color:#fff;text-decoration:underline;white-space:nowrap">View Source</a></span>'
    '<button onclick="(function(b){try{sessionStorage.setItem(\'ep_demo_banner_dismissed\',\'1\')}catch(e){}b.parentElement.style.display=\'none\'})(this)" '
    'aria-label="Dismiss" style="cursor:pointer;flex:none;width:20px;height:20px;border:none;'
    "border-radius:50%;background:rgba(255,255,255,.25);color:#fff;font-size:11px;font-weight:700;"
    'font-family:inherit;padding:0;display:flex;align-items:center;justify-content:center">✕</button>'
    "</div>\n"
)
html = html.replace("<body>", "<body>" + banner, 1)

with open(os.path.join(demo, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

print("✓ index.html generated")
PYEOF

echo "==> Copying resources..."
if [ -d "$STATIC_DIR/res" ]; then
    mkdir -p "$DEMO_DIR/res"
    cp -r "$STATIC_DIR/res/"* "$DEMO_DIR/res/" 2>/dev/null || true
fi

echo "==> Build complete!"
