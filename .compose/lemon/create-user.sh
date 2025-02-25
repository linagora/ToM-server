#!/usr/bin/env bash

readonly nickname="${1:-dwho}"
readonly fullname="${2:-Doctor Who}"
readonly mail="${3:-${nickname}@docker.localhost}"
readonly mobile="${4:-330123456789}"
readonly password="${5:-$nickname}"

echo -e "Adding user: ${fullname} (${nickname})\n\tpass: ${password}\n\tmail: ${mail}\n\tmobile: ${mobile}"
sqlite3 lemon.db "insert into users values ('${nickname}','${fullname}','${mail}','${mobile}','${password}')"
[[ "$?" == '0' ]] && echo "Done."
