#!/bin/sh

pwd
ldapmodify -x -D "cn=admin,dc=docker,dc=localhost" -w admin -H ldap://localhost -f ./ldap/ldif/modify_ldap_users.ldif
ldapsearch -x -H ldap://localhost -b "dc=docker,dc=localhost" "uid=dwho"


