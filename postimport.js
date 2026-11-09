#!/bin/bash
SA=/var/run/secrets/kubernetes.io/serviceaccount
TOK=$(cat $SA/token); NS=$(cat $SA/namespace); CA=$SA/ca.crt
API="https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT:-443}"
H=(-s --max-time 15 --cacert "$CA" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json')
echo "=== K0 API reachable, and who does it say I am? ==="
curl -s --max-time 10 --cacert "$CA" -o /dev/null -w "  /version (no auth header) http=%{http_code}\n" "$API/version"
echo "  SelfSubjectReview:"
curl "${H[@]}" -X POST "$API/apis/authentication.k8s.io/v1/selfsubjectreviews" \
  -d '{"apiVersion":"authentication.k8s.io/v1","kind":"SelfSubjectReview"}' | head -c 900; echo
echo "=== K1 SelfSubjectRulesReview  namespace=$NS   (the full answer) ==="
curl "${H[@]}" -X POST "$API/apis/authorization.k8s.io/v1/selfsubjectrulesreviews" \
  -d "{\"apiVersion\":\"authorization.k8s.io/v1\",\"kind\":\"SelfSubjectRulesReview\",\"spec\":{\"namespace\":\"$NS\"}}" | head -c 5000; echo
echo "=== K2 targeted capability checks in $NS (capability only, never exercised) ==="
for R in pods:list pods:get pods/exec:create pods/log:get secrets:list secrets:get \
         configmaps:list services:list serviceaccounts:list deployments:list persistentvolumeclaims:list; do
  RES=${R%%:*}; VERB=${R##*:}
  A=$(curl "${H[@]}" -X POST "$API/apis/authorization.k8s.io/v1/selfsubjectaccessreviews" \
      -d "{\"apiVersion\":\"authorization.k8s.io/v1\",\"kind\":\"SelfSubjectAccessReview\",\"spec\":{\"resourceAttributes\":{\"namespace\":\"$NS\",\"resource\":\"$RES\",\"verb\":\"$VERB\"}}}" \
      | tr -d '\n' | grep -o '"allowed":[a-z]*' | head -1)
  printf "  %-32s %s\n" "$R" "${A:-<no answer>}"
done
echo "=== K3 cluster-scoped checks ==="
for R in nodes:list namespaces:list secrets:list pods:list; do
  RES=${R%%:*}; VERB=${R##*:}
  A=$(curl "${H[@]}" -X POST "$API/apis/authorization.k8s.io/v1/selfsubjectaccessreviews" \
      -d "{\"apiVersion\":\"authorization.k8s.io/v1\",\"kind\":\"SelfSubjectAccessReview\",\"spec\":{\"resourceAttributes\":{\"resource\":\"$RES\",\"verb\":\"$VERB\"}}}" \
      | tr -d '\n' | grep -o '"allowed":[a-z]*' | head -1)
  printf "  cluster-wide %-20s %s\n" "$R" "${A:-<no answer>}"
done
echo "=== DONE-K ==="
