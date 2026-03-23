#!/bin/bash

# Number of entries to create
NUM_ENTRIES=200

# Base values
OU="users"
DC="docker.localhost"

# Loop to generate entries
for i in $(seq 1 $NUM_ENTRIES); do
    # Use a prefixed variable to avoid conflicts
    SCRIPT_UID="user$i"  # Changed from UID to SCRIPT_UID
    CN="User $i"
    SN="User$i"
    MAIL="user$i@$DC"
    MOBILE="+33671298$(printf "%05d" $i)"
    WORKPLACE_FQDN="workplace$i.$DC"

    # Output the LDAP entry
    cat <<EOL
dn: uid=$SCRIPT_UID,ou=$OU,dc=docker,dc=localhost
objectClass: inetOrgPerson
objectClass: workplaceUser
uid: $SCRIPT_UID
cn: $CN
sn: $SN
mail: $MAIL
mobile: $MOBILE
workplaceFqdn: $WORKPLACE_FQDN

EOL
done
