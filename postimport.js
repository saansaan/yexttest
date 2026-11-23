#!/bin/bash
echo "=== V8: K8S API SURFACE DEEP DIVE ==="
date -u; hostname
K8S=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CA=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
NS=$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)
API="https://kubernetes.default.svc"
AUTH="Authorization: Bearer $K8S"

echo "=== 1. FULL API GROUPS ==="
curl -s -m 10 --cacert $CA -H "$AUTH" "$API/apis" 2>&1; echo

echo "=== 2. OPENAPI V3 FULL PATHS ==="
curl -s -m 10 --cacert $CA -H "$AUTH" "$API/openapi/v3" 2>&1; echo

echo "=== 3. ADMISSION WEBHOOKS ==="
echo "-- mutating --"
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/apis/admissionregistration.k8s.io/v1/mutatingwebhookconfigurations" 2>&1 | head -c 5000; echo
echo "-- validating --"
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/apis/admissionregistration.k8s.io/v1/validatingwebhookconfigurations" 2>&1 | head -c 5000; echo

echo "=== 4. API SERVICES (aggregated APIs) ==="
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/apis/apiregistration.k8s.io/v1/apiservices" 2>&1 | head -c 8000; echo

echo "=== 5. SELF SUBJECT ACCESS REVIEW ==="
for res in pods secrets configmaps services deployments daemonsets nodes namespaces events persistentvolumes persistentvolumeclaims; do
  for verb in get list watch create; do
    R=$(curl -s -m 3 --cacert $CA -H "$AUTH" -H "Content-Type: application/json" -X POST "$API/apis/authorization.k8s.io/v1/selfsubjectaccessreviews" \
      -d "{\"apiVersion\":\"authorization.k8s.io/v1\",\"kind\":\"SelfSubjectAccessReview\",\"spec\":{\"resourceAttributes\":{\"namespace\":\"$NS\",\"verb\":\"$verb\",\"resource\":\"$res\"}}}" 2>&1)
    ALLOWED=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('status',{}).get('allowed','?'))" 2>/dev/null)
    [ "$ALLOWED" = "True" ] && echo "ALLOWED: $verb $res in $NS"
  done
done
echo "-- cluster-scoped --"
for res in nodes namespaces persistentvolumes clusterroles clusterrolebindings; do
  for verb in get list; do
    R=$(curl -s -m 3 --cacert $CA -H "$AUTH" -H "Content-Type: application/json" -X POST "$API/apis/authorization.k8s.io/v1/selfsubjectaccessreviews" \
      -d "{\"apiVersion\":\"authorization.k8s.io/v1\",\"kind\":\"SelfSubjectAccessReview\",\"spec\":{\"resourceAttributes\":{\"verb\":\"$verb\",\"resource\":\"$res\"}}}" 2>&1)
    ALLOWED=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('status',{}).get('allowed','?'))" 2>/dev/null)
    [ "$ALLOWED" = "True" ] && echo "ALLOWED: $verb $res (cluster)"
  done
done

echo "=== 6. SELF SUBJECT RULES REVIEW ==="
curl -s -m 5 --cacert $CA -H "$AUTH" -H "Content-Type: application/json" -X POST "$API/apis/authorization.k8s.io/v1/selfsubjectrulesreviews" \
  -d "{\"apiVersion\":\"authorization.k8s.io/v1\",\"kind\":\"SelfSubjectRulesReview\",\"spec\":{\"namespace\":\"$NS\"}}" 2>&1 | head -c 8000; echo

echo "=== 7. STORAGE CLASSES ==="
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/apis/storage.k8s.io/v1/storageclasses" 2>&1 | head -c 3000; echo

echo "=== 8. PRIORITY CLASSES ==="
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/apis/scheduling.k8s.io/v1/priorityclasses" 2>&1 | head -c 3000; echo

echo "=== 9. NAMESPACES ==="
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/api/v1/namespaces" 2>&1 | head -c 5000; echo

echo "=== 10. NODES ==="
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/api/v1/nodes" 2>&1 | head -c 5000; echo

echo "=== 11. SERVICES IN OWN NS ==="
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/api/v1/namespaces/$NS/services" 2>&1 | head -c 3000; echo

echo "=== 12. EVENTS IN OWN NS ==="
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/api/v1/namespaces/$NS/events?limit=10" 2>&1 | head -c 5000; echo

echo "=== 13. SECRETS IN OWN NS ==="
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/api/v1/namespaces/$NS/secrets" 2>&1 | head -c 3000; echo

echo "=== 14. CONFIGMAPS IN OWN NS ==="
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/api/v1/namespaces/$NS/configmaps" 2>&1 | head -c 3000; echo

echo "=== 15. PODS ALL NAMESPACES ==="
curl -s -m 5 --cacert $CA -H "$AUTH" "$API/api/v1/pods?limit=5" 2>&1 | head -c 3000; echo

echo "=== 16. VERSION ==="
curl -sk -m 3 "$API/version" 2>&1; echo

echo "=== DONE ==="
