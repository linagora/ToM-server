#!/usr/bin/env bash
# File              : create-user.sh
# License           : AGPL-3.0-or-later
# Author            : Pierre 'McFly' Marty <pmarty@linagora.com>
# Date              : 14.01.2025
# Last Modified Date: 27.01.2025
# Last Modified By  : Pierre 'McFly' Marty <pmarty@linagora.com>

readonly nickname="${1:-dwho}"
readonly givenname="${2:-Doctor Who}"
readonly mobile="${3:-330123456789}"
readonly password="${4:-$nickname}"
readonly active="${5:-0}"

echo -e "Adding user: ${givenname} (${nickname})\n\tpass: ${password}"
sqlite3 lemon.db "insert into users values ('${nickname}','${givenname}','${nickname}@docker.localhost','${mobile}','${password}','${active}')"
[[ "$?" == '0' ]] && echo "Done."
