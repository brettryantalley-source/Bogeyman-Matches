#!/usr/bin/env bash
# Rebuild index.html from src/app.jsx.
# Requires: esbuild (brew install esbuild), curl, python3 + PIL.
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p build

# 1. Fetch React UMD builds if missing.
[ -f build/react.min.js ]     || curl -sSLo build/react.min.js     https://unpkg.com/react@18.3.1/umd/react.production.min.js
[ -f build/react-dom.min.js ] || curl -sSLo build/react-dom.min.js https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js

# 2. Bundle app.
esbuild src/app.jsx \
  --loader:.jsx=jsx --jsx=transform \
  --bundle --minify --format=iife --target=es2018 \
  --outfile=build/app.min.js

# 3. Assemble index.html.
python3 - <<'PY'
from pathlib import Path
def safe(js): return js.replace("</script>", "<\\/script>")
react     = safe(Path("build/react.min.js").read_text())
react_dom = safe(Path("build/react-dom.min.js").read_text())
app       = safe(Path("build/app.min.js").read_text())
html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#000000" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Bogeyman" />
<meta name="mobile-web-app-capable" content="yes" />
<link rel="manifest" href="./manifest.webmanifest" />
<link rel="apple-touch-icon" href="./icon-512.png" />
<link rel="icon" type="image/png" sizes="512x512" href="./icon-512.png" />
<title>Bogeyman Matches</title>
<style>
html,body{{margin:0;background:#000;color:#fff;overscroll-behavior:none}}
body{{font-family:-apple-system,ui-sans-serif,'SF Pro Text',system-ui,sans-serif}}
#root{{min-height:100dvh;background:#000}}
</style>
</head>
<body>
<div id="root"></div>
<script>/* React 18 UMD (production) */
{react}
</script>
<script>/* ReactDOM 18 UMD (production) */
{react_dom}
</script>
<script>/* Bogeyman Matches app bundle */
{app}
</script>
<script>
if ('serviceWorker' in navigator) {{
  window.addEventListener('load', function () {{
    navigator.serviceWorker.register('./sw.js').catch(function (e) {{ console.warn('sw register failed', e); }});
  }});
}}
</script>
</body>
</html>
"""
Path("index.html").write_text(html)
print(f"index.html {len(html)} bytes")
PY

echo "Build complete."
