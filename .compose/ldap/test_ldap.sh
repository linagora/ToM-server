#!/bin/bash

# Set LDAP server and credentials
ldap_server="ldap://localhost:389"
admin_dn="cn=admin,dc=docker,dc=localhost"
admin_password="admin"

# Function to check the result of a test
check_result() {
  if [ $? -eq 0 ]; then
    echo "Test PASSED"
  else
    echo "Test FAILED"
    exit 1
  fi
}

# Test slapd configuration
echo "Testing slapd configuration..."
docker exec maxs-deployment-ldap-1 /usr/local/openldap/sbin/slaptest -F /usr/local/openldap/etc/openldap/slapd.d -u
check_result

# Test LDAP server connection
echo "Testing LDAP server connection..."
ldapsearch -x -H "$ldap_server" -b '' -s base '(objectclass=*)' namingContexts
check_result

# Test LDAP server authentication
echo "Testing LDAP server authentication..."
ldapwhoami -x -H "$ldap_server" -D "$admin_dn" -w "$admin_password"
check_result

# Test searching for users
echo "Testing search for users..."
ldapsearch -x -H "$ldap_server" -D "$admin_dn" -w "$admin_password" -b "dc=docker,dc=localhost" -s sub "(objectClass=inetOrgPerson)"
check_result

# Test adding and deleting entries
cat > test_user.ldif << EOL
dn: uid=testuser,ou=users,dc=docker,dc=localhost
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
uid: testuser
cn: Test User
sn: User
givenName: Test
mail: testuser@docker.localhost
userPassword: {CLEARTEXT}testpassword
EOL

echo "Adding test user..."
ldapadd -x -H "$ldap_server" -D "$admin_dn" -w "$admin_password" -f test_user.ldif
check_result

echo "Searching for test user..."
ldapsearch -x -H "$ldap_server" -D "$admin_dn" -w "$admin_password" -b "dc=docker,dc=localhost" -s sub "(&(objectClass=inetOrgPerson)(uid=testuser))"
check_result

echo "Deleting test user..."
ldapdelete -x -H "$ldap_server" -D "$admin_dn" -w "$admin_password" "uid=testuser,ou=users,dc=docker,dc=localhost"
check_result

echo "Searching for test user again to confirm deletion..."
ldapsearch -x -H "$ldap_server" -D "$admin_dn" -w "$admin_password" -b "dc=docker,dc=localhost" -s sub "(&(objectClass=inetOrgPerson)(uid=testuser))"
check_result

# Clean up
rm test_user.ldif

echo "All tests passed!"
