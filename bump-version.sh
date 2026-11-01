#!/bin/sh
# Stamps a new ?v= on the shared code so phones load the latest version
# straight after an update instead of a cached copy. Run before each commit.
V=$(date -u +%Y%m%d%H%M)
sed -i -E "s#\"\./core\.js(\?v=[0-9]+)?\"#\"./core.js?v=$V\"#g" grain.html chemicals.html workshop.html
sed -i -E "s#\"\./firebase-config\.js(\?v=[0-9]+)?\"#\"./firebase-config.js?v=$V\"#g" app.js core.js
sed -i -E "s#src=\"app\.js(\?v=[0-9]+)?\"#src=\"app.js?v=$V\"#g" index.html
echo "version $V"
