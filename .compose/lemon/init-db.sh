#!/usr/bin/env bash

echo "Inflating Auth DB."
sqlite3 lemon.db "Create table if not exists users (uid text,name text,mail text,phone text,password text);"
[[ "$?" == '0' ]] && echo "Done."

                    # nickname  # Full Name     # mail  # mobile        # password
./create-user.sh    'dwho'      'Doctor Who'    ''      '33745718646'   'dwho'
./create-user.sh    'rtyler'    'R. Tyler'      ''      '17759865200'   'rtyler'
./create-user.sh    'jbinks'    'Jar Jar Binks' ''      '4915510829025' 'jbinks'
