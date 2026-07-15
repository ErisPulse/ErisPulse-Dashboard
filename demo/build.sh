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

echo "==> Copying static files..."
cp "$STATIC_DIR/dash.css" "$DEMO_DIR/dash.css"
cp "$STATIC_DIR/dash.js" "$DEMO_DIR/dash.js"

echo "==> Generating index.html from dash.html..."
STATIC_DIR="$STATIC_DIR" DEMO_DIR="$DEMO_DIR" python3 - <<'PYEOF'
import re, os

static = os.environ["STATIC_DIR"]
demo = os.environ["DEMO_DIR"]

with open(os.path.join(static, "dash.html"), "r", encoding="utf-8") as f:
    html = f.read()

html = html.replace("/Dashboard/static/dash.css", "dash.css")
html = html.replace("/Dashboard/static/dash.js", "dash.js")
# Replace ALL remaining /Dashboard/static/ references (res/, icons, images, etc.)
html = html.replace("/Dashboard/static/", "")

mock = '<script src="mock.js"></script>\n'
m = re.search(r'(<script[^>]*src="[^"]*dash\.js[^"]*"[^>]*>\s*</script>)', html)
if m:
    html = html[:m.start()] + mock + html[m.start():]
else:
    html = html.replace("</body>", mock + "</body>")

banner = (
    '<div id="demoBanner" style="display:none;position:fixed;top:0;left:0;right:0;'
    "z-index:9999;background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;"
    'text-align:center;padding:6px 12px;font-size:12px;font-weight:600;'
    'box-shadow:0 1px 4px rgba(0,0,0,.15)">'
    '⚠ Demo Mode — All data is simulated. '
    '<a href="https://github.com/ErisPulse/ErisPulse-Dashboard" target="_blank" '
    'style="color:#fff;text-decoration:underline">View Source</a></div>\n'
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
