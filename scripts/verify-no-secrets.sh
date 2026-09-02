#!/usr/bin/env bash
set -euo pipefail

patterns='sb_secret_[A-Za-z0-9_-]{12,}|sbp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{12,}|ghp_[A-Za-z0-9]{20,}|cfut_[A-Za-z0-9_-]{20,}|service_role[^[:space:]]*[=:][^[:space:]]{16,}|SUPABASE_DB_PASSWORD[[:space:]]*=[[:space:]]*[^$[:space:]][^[:space:]]{7,}|SUPABASE_ACCESS_TOKEN[[:space:]]*=[[:space:]]*[^$[:space:]][^[:space:]]{15,}|CLOUDFLARE_API_TOKEN[[:space:]]*=[[:space:]]*[^$[:space:]][^[:space:]]{15,}'

mapfile -d '' candidates < <(git ls-files --cached --others --exclude-standard -z)
filtered=()
for file in "${candidates[@]}"; do
  [[ "$file" == "scripts/verify-no-secrets.sh" ]] || filtered+=("$file")
done

if ((${#filtered[@]} > 0)) && grep -nEIH "$patterns" "${filtered[@]}"; then
  echo 'Potential secret found in repository candidate files.' >&2
  exit 1
fi

if [[ -d dist ]] && grep -RInE "$patterns" dist; then
  echo 'Potential secret found in built assets.' >&2
  exit 1
fi

echo 'Secret scan passed.'
