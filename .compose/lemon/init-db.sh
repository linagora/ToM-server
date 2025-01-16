#!/usr/bin/env bash
# File              : init-db.sh
# License           : AGPL-3.0-or-later
# Author            : Pierre 'McFly' Marty <pmarty@linagora.com>
# Date              : 14.01.2025
# Last Modified Date: 14.01.2025
# Last Modified By  : Pierre 'McFly' Marty <pmarty@linagora.com>

sqlite3 lemon.db "Create table if not exists users (uid text,name text,mail text,password text);"
./create-user.sh
