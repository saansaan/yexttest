#!/bin/bash
echo "=== Z1 COMPLETE FILE INVENTORY (tight prune) ==="
find / -xdev \
  \( -path /proc -o -path /sys -o -path /dev -o -path /usr -o -path /lib -o -path /lib64 \
     -o -path /var/lib -o -path /var/cache -o -path /repo-vol/node_modules \
     -o -path /opt/buildhome/.nvm -o -path /opt/buildhome/.npm -o -path /opt/buildhome/.rbenv \
     -o -path /opt/buildhome/go -o -path /opt/buildhome/.yarn -o -path /repo-vol/.git/objects \
     -o -path /repo-vol/themes -o -path /repo-vol/src -o -path /repo-vol/public \) -prune \
  -o -type f -print 2>/dev/null | head -500
echo "=== Z2 .gnupg ==="; ls -laR /opt/buildhome/.gnupg 2>&1 | head -40
echo "=== Z3 .local ==="; ls -laR /opt/buildhome/.local 2>/dev/null | head -30
echo "=== Z4 /home ==="; ls -laR /home 2>&1 | head -30
echo "=== Z5 /var/log ==="; ls -laR /var/log 2>/dev/null | head -40
echo "=== Z6 /tmp ==="; ls -la /tmp 2>/dev/null | head -25
echo "=== Z7 /repo-vol + config ==="; ls -la /repo-vol /repo-vol/config 2>/dev/null | head -45
echo "=== Z8 .initializationdata (first 4KB) ==="; head -c 4000 /repo-vol/.initializationdata 2>/dev/null; echo
echo "=== Z9 site config ==="; for f in /repo-vol/config.yaml /repo-vol/components.json; do echo "--- $f"; head -c 1200 "$f" 2>/dev/null; echo; done
echo "=== Z10 .git metadata ==="; ls -la /repo-vol/.git 2>/dev/null|head -22
echo "--packed-refs--"; head -5 /repo-vol/.git/packed-refs 2>/dev/null
echo "--logs/HEAD--";   head -5 /repo-vol/.git/logs/HEAD 2>/dev/null
echo "--FETCH_HEAD--";  head -5 /repo-vol/.git/FETCH_HEAD 2>/dev/null
echo "=== Z11 /etc/ssl/private ==="; ls -la /etc/ssl/private 2>&1 | head -8
echo "=== Z12 /dev/termination-log ==="; head -c 400 /dev/termination-log 2>/dev/null; echo
echo "=== Z13 /proc/net/arp (neighbour cache) ==="; head -20 /proc/net/arp 2>/dev/null
echo "=== DONE3 ==="
