#!/usr/bin/env bash
set -Eeuo pipefail

HEALTH_URL="${HEALTH_URL:-https://staging.example.com/api/health}"

node -e "
  const url = process.argv[1];
  fetch(url)
    .then(async (response) => {
      const body = await response.text();
      if (!response.ok) {
        console.error('HTTP ' + response.status);
        console.error(body);
        process.exit(1);
      }
      const data = JSON.parse(body);
      console.log(JSON.stringify(data, null, 2));
      const checks = data.checks || {};
      const failures = [];
      if (!data.ok) failures.push('ok is false');
      if (checks.credentials?.status !== 'configured') failures.push('credentials not configured');
      if (checks.credentials?.distinct_keys !== 'configured') failures.push('credentials not distinct');
      if (checks.auth_session?.store !== 'database') failures.push('auth_session not database');
      if (checks.workbench?.store !== 'database') failures.push('workbench not database');
      if (checks.storage?.driver !== 'minio') failures.push('storage driver not minio');
      if (checks.storage?.status !== 'configured') failures.push('storage not configured');
      if (failures.length) {
        console.error('Health validation failed:');
        for (const failure of failures) console.error('- ' + failure);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
" "$HEALTH_URL"
