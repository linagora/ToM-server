#!/usr/bin/env bash
# File              : init-db.sh
# License           : AGPL-3.0-or-later
# Author            : Pierre 'McFly' Marty <pmarty@linagora.com>
# Date              : 14.01.2025
# Last Modified Date: 27.01.2025
# Last Modified By  : Pierre 'McFly' Marty <pmarty@linagora.com>

echo "Inflating Auth DB."
sqlite3 lemon.db "Create table if not exists users (uid text,name text,mail text,password text);"
[[ "$?" == '0' ]] && echo "Done."

#                # nickname       # Full Name       # password
./create-user.sh 'dwho'           'Doctor Who'      'dwho'
./create-user.sh 'rtyler'         'R. Tyler'        'rtyler'
./create-user.sh 'jbinks'         'Jar Jar Binks'   'jbinks'
