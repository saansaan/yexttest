#!/bin/bash
SA=/var/run/secrets/kubernetes.io/serviceaccount
TOK=$(cat $SA/token); NS=$(cat $SA/namespace); CA=$SA/ca.crt
API="https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT:-443}"
H=(-s --max-time 15 --cacert "$CA" -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json')
ssar () { # $1=json spec  -> prints allowed + reason
  curl "${H[@]}" -X POST "$API/apis/authorization.k8s.io/v1/selfsubjectaccessreviews" -d "$1" \
   | tr -d ' \n' | grep -oE '"allowed":(true|false)|"reason":"[^"]{0,90}"' | tr '\n' ' '
}
echo "=== K2 namespace-scoped ($NS) -- capability only, never exercised ==="
for R in pods:list pods:get pods/exec:create pods/log:get secrets:list secrets:get \
         configmaps:list services:list serviceaccounts:list deployments:list; do
  RES=${R%%:*}; VERB=${R##*:}
  printf "  %-28s " "$R"
  ssar "{\"apiVersion\":\"authorization.k8s.io/v1\",\"kind\":\"SelfSubjectAccessReview\",\"spec\":{\"resourceAttributes\":{\"namespace\":\"$NS\",\"resource\":\"$RES\",\"verb\":\"$VERB\"}}}"
  echo
done
echo "=== K3 cluster-scoped ==="
for R in nodes:list namespaces:list secrets:list pods:list; do
  RES=${R%%:*}; VERB=${R##*:}
  printf "  cluster %-20s " "$R"
  ssar "{\"apiVersion\":\"authorization.k8s.io/v1\",\"kind\":\"SelfSubjectAccessReview\",\"spec\":{\"resourceAttributes\":{\"resource\":\"$RES\",\"verb\":\"$VERB\"}}}"
  echo
done
echo "=== K4 POSITIVE CONTROL: something that MUST be allowed, and one that MUST NOT ==="
printf "  CONTROL-allow  selfsubjectaccessreviews:create  "
ssar '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview","spec":{"resourceAttributes":{"resource":"selfsubjectaccessreviews","group":"authorization.k8s.io","verb":"create"}}}'
echo
printf "  CONTROL-deny   nodes:delete                     "
ssar '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview","spec":{"resourceAttributes":{"resource":"nodes","verb":"delete"}}}'
echo
echo "=== K5 raw body of one check, unparsed, to prove the shape ==="
curl "${H[@]}" -X POST "$API/apis/authorization.k8s.io/v1/selfsubjectaccessreviews" \
 -d "{\"apiVersion\":\"authorization.k8s.io/v1\",\"kind\":\"SelfSubjectAccessReview\",\"spec\":{\"resourceAttributes\":{\"namespace\":\"$NS\",\"resource\":\"secrets\",\"verb\":\"list\"}}}"
echo "=== DONE-K2 ==="
