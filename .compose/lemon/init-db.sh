#!/usr/bin/env bash
# vim: set filetype=sh ts=2 sw=2 sts=2 expandtab :

echo "Inflating Auth DB."
sqlite3 lemon.db "Create table if not exists users (uid text,name text,mail text,mobile text,password text);"
[[ "$?" == '0' ]] && echo "Done."

                  # nickname  # Full Name     # mail                    # mobile        # password
./create-user.sh  'dwho'      'Doctor Who'    'dwho@docker.localhost'   '+33612345678'  'dwho'
./create-user.sh  'rtyler'    'R. Tyler'      'rtyler@docker.localhost' '+11234567890'  'rtyler'
./create-user.sh  'jbinks'    'Jar Jar Binks' 'jbinks@docker.localhost' '+84123456789'  'jbinks'
