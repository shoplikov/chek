#!/usr/bin/env bash
# Build the image, push it to ECR, and restart the container on the EC2 host via SSM.
set -euo pipefail
R=us-east-1
REG=424592695710.dkr.ecr.us-east-1.amazonaws.com
INSTANCE=i-037e13021410634c0
docker build --platform linux/amd64 -t chek:latest .
aws ecr get-login-password --region $R | docker login --username AWS --password-stdin $REG >/dev/null
docker tag chek:latest $REG/chek:latest
docker push $REG/chek:latest | tail -1
CMD=$(aws ssm send-command --region $R --instance-ids $INSTANCE --document-name AWS-RunShellScript \
  --parameters 'commands=["/opt/chek/deploy.sh"]' --query Command.CommandId --output text)
aws ssm wait command-executed --region $R --command-id "$CMD" --instance-id $INSTANCE || true
aws ssm get-command-invocation --region $R --command-id "$CMD" --instance-id $INSTANCE --query Status --output text
for i in $(seq 1 30); do
  if curl -fsS https://54-163-135-214.nip.io/api/health; then echo; exit 0; fi
  sleep 2
done
echo "health check failed" >&2; exit 1
