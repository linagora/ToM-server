#!/bin/sh
set -e

if [ -f rootCA.pem ] && [ -f both.pem ]; then
  echo "Certificates already present, skipping generation."
  exit 0
fi

mkcert -install
mkcert $DOMAINS

CERT=$(find . -maxdepth 1 -name "*.pem" ! -name "*-key.pem" ! -name "rootCA*.pem" | head -1)
KEY=$(find . -maxdepth 1 -name "*-key.pem" ! -name "rootCA*.pem" | head -1)

cat "$CERT" "$KEY" > both.pem

openssl rehash .

echo "Certificates generated successfully."
