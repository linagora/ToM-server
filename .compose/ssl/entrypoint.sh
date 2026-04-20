#!/bin/sh
set -e

if [ -f rootCA.pem ] && [ -f both.pem ]; then
  echo "Certificates already present, skipping generation."
  exit 0
fi

mkcert -install

# shellcheck disable=SC2086 # intentional word-splitting: $DOMAINS is a space-separated hostname list
mkcert $DOMAINS

CERT=$(find . -maxdepth 1 -name "*.pem" ! -name "*-key.pem" ! -name "rootCA*.pem" | sort | head -1)
KEY=$(find . -maxdepth 1 -name "*-key.pem" ! -name "rootCA*.pem" | sort | head -1)

if [ -z "$CERT" ] || [ -z "$KEY" ]; then
  echo "mkcert produced no cert/key for DOMAINS='$DOMAINS'" >&2
  exit 1
fi

cat "$CERT" "$KEY" > both.pem

openssl rehash .

echo "Certificates generated successfully."
