#!/usr/bin/env bash
# Deletes every AWS resource created for this project (all tagged project=chek-hackathon).
set -uo pipefail
R=us-east-1
aws ec2 terminate-instances --region $R --instance-ids i-037e13021410634c0
aws ec2 wait instance-terminated --region $R --instance-ids i-037e13021410634c0
aws ec2 release-address --region $R --allocation-id eipalloc-061f86de899028ab7
aws ec2 delete-security-group --region $R --group-id sg-01f501625ff6862f2
aws ecr delete-repository --region $R --repository-name chek --force
aws ssm delete-parameters --region $R --names /chek/OPENAI_API_KEY /chek/STRIPE_SECRET_KEY
aws iam remove-role-from-instance-profile --instance-profile-name chek-ec2 --role-name chek-ec2
aws iam delete-instance-profile --instance-profile-name chek-ec2
aws iam detach-role-policy --role-name chek-ec2 --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
aws iam detach-role-policy --role-name chek-ec2 --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam delete-role-policy --role-name chek-ec2 --policy-name chek-ssm-params
aws iam delete-role --role-name chek-ec2
echo "teardown complete"
