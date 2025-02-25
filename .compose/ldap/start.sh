#!/bin/sh

set -e

/usr/local/openldap/libexec/slapd -h "ldap://*" -u ldap -g ldap -d 256 &
PID=$!
sleep 1
ldapmodify -x -D "cn=admin,dc=docker,dc=localhost" -w admin -H ldap://localhost -f /tmp/update_password.ldif

kill $!

/usr/local/openldap/libexec/slapd -h "ldap://*" -u ldap -g ldap -d 256
