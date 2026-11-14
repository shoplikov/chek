# Decisions

Record of what the spec assumed, what was found, and what was chosen. Times are +05.

## Pre-flight (2026-11-15 01:57)

| Check | Result |
|---|---|
| Node | v22.22.3, npm 10.9.8 |
| GitHub CLI | authenticated |
| AWS | credentials OK; configured region `eu-north-1` |
| Docker | 29.5.3 available |
| LLM key | No `ANTHROPIC_API_KEY`. `OPENAI_API_KEY` present and valid. |
| Stripe | No `STRIPE_SECRET_KEY` → labelled demo checkout (section 11) |

## LLM provider

- Spec prefers Claude. No Anthropic key was available. Amazon Bedrock lists Claude models
  in this account, but invoking them fails: the account has not submitted Anthropic's
  use-case form (and Opus 5.5 is "not available for this account"). Submitting that form is
  a business decision for the account owner, so it was not done here.
- Chosen: OpenAI through the official `openai` SDK with strict JSON-schema structured output
  (`zodResponseFormat`), as the spec allows when only another provider's key exists.
- The client takes an optional `OPENAI_BASE_URL`, so any OpenAI-compatible server (for
  example vLLM serving an open vision model on a GPU instance) can replace it without code
  changes.

## Deploy

- App Runner (path A): `CreateService` returned "Account can't create new App Runner
  services", and App Runner has no endpoint in `eu-north-1`. Took **path B**.
- Path B: one EC2 `t3.small` (Amazon Linux 2023) in `us-east-1`, Elastic IP, security group
  open on 80/443 only (no SSH; administration through SSM Run Command). Docker runs the app
  image (pulled from ECR) and Caddy, which serves automatic HTTPS on
  `54-163-135-214.nip.io`.
- Secrets live in SSM Parameter Store (`/chek/*`, SecureString). The instance role may read
  only `/chek/*`. Secrets are never in the image or the repository.

### AWS resources (all tagged `project=chek-hackathon`, region us-east-1)

| Resource | Name / id |
|---|---|
| ECR repository | `chek` |
| IAM role + instance profile | `chek-ec2` (ECR read-only, SSM core, read `/chek/*`) |
| Security group | `sg-01f501625ff6862f2` (`chek-web`) |
| Elastic IP | `eipalloc-061f86de899028ab7` (54.163.135.214) |
| EC2 instance | `i-037e13021410634c0` (`chek`) |
| SSM parameters | `/chek/OPENAI_API_KEY` |

Public URL: https://54-163-135-214.nip.io. Remove everything with `scripts/teardown.sh`.

## Reference data (Open Prices)

- The dumps (`prices.jsonl.gz`, `locations.jsonl.gz`, `products.jsonl.gz`) download fine.
  The price rows in the dump do **not** carry nested product or location objects (unlike the
  API), so the seed joins the three dumps by `product_code` and `location_id`.
- Demo area: every US store in Mountain View, Sunnyvale and Los Altos with at least 150
  price observations (21 stores), wider than the spec's table of 11, for more coverage.
- Observations from 2024-07-19 to 2026-11-11, almost all from Sep 2025 onwards.
- Products priced at 2+ demo-area stores, by maximum observation age: 30 d: 94, 60 d: 147,
  90 d: 228, **100 d: 387**, 120 d: 528, 180 d: 720, 365 d: 2,465.
- `MAX_OBSERVATION_AGE_DAYS = 100`: the smallest window that keeps at least 300 such products.
  The UI shows the observation date next to every price.
