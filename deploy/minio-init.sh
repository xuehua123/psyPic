#!/bin/sh
set -eu

until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  sleep 2
done

mc mb -p "local/$ASSET_STORAGE_BUCKET" || true

cat > /tmp/psypic-policy.json <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket"],"Resource":["arn:aws:s3:::$ASSET_STORAGE_BUCKET","arn:aws:s3:::$ASSET_STORAGE_BUCKET/*"]}]}
EOF

mc admin user add local "$ASSET_STORAGE_ACCESS_KEY_ID" "$ASSET_STORAGE_SECRET_ACCESS_KEY" || true
mc admin policy create local psypic-app /tmp/psypic-policy.json || true
mc admin policy attach local psypic-app --user "$ASSET_STORAGE_ACCESS_KEY_ID" || true
