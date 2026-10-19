#!/usr/bin/env bash
# Copies the production environment from .env.local into the linked Vercel project without printing
# any value. Secrets are stored as sensitive variables; NEXT_PUBLIC_* identifiers as plain config.
# Usage (in frontend/, after `vercel link`): ./scripts/push-vercel-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SECRET_VARS=(HEDERA_OPERATOR_KEY SUPABASE_SERVICE_ROLE_KEY OPENAI_API_KEY PINATA_JWT INTERNAL_API_SECRET)
CONFIG_VARS=(HEDERA_NETWORK HEDERA_OPERATOR_ID OPENAI_MODEL OPENAI_EXTRACTION_MODEL
  NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_HEDERA_NETWORK NEXT_PUBLIC_TREASURY_ACCOUNT_ID
  NEXT_PUBLIC_HCS_TOPIC_ID NEXT_PUBLIC_CO2E_TOKEN_ID NEXT_PUBLIC_CERTIFICATE_TOKEN_ID
  NEXT_PUBLIC_EXCHANGE_CONTRACT_ID NEXT_PUBLIC_EXCHANGE_CONTRACT_ADDRESS)

value_of() { grep -m1 "^$1=" .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

push() {
  local name=$1 kind=$2 value
  value=$(value_of "$name")
  if [ -z "$value" ]; then echo "  skip  $name (empty in .env.local)"; return; fi
  if printf '%s' "$value" | vercel env add "$name" production --force "--$kind" --yes >/dev/null 2>&1; then
    echo "  ok    $name"
  else
    echo "  FAIL  $name"
  fi
}

for name in "${SECRET_VARS[@]}"; do push "$name" sensitive; done
for name in "${CONFIG_VARS[@]}"; do push "$name" no-sensitive; done
