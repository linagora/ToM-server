# devenv/openldap.nix
{
  pkgs,
  lib,
  config,
  ...
}:

let
  tw = config.twake;
  ldap = tw.ldap;

  ouUsers = "ou=users,${ldap.base}";
  createdAt = "2024-01-01T00:00:00Z";

  users = [
    {
      uid = "dwho";
      cn = "Dr Who";
      sn = "Dwho";
      mobile = "+33671298765";
      workspaceUrl = "https://tardis.${tw.domain}";
    }
    {
      uid = "rtyler";
      cn = "Rose Tyler";
      sn = "Rtyler";
      mail = "rtyler@${tw.domain}";
      mobile = "+33671298767";
      workspaceUrl = "https://badwolf.${tw.domain}";
    }
    {
      uid = "okenobi";
      cn = "Obi-Wan Kenobi";
      sn = "Okenobi";
      mail = "okenobi@${tw.domain}";
      workspaceUrl = "https://jedi-temple.${tw.domain}";
    }
    {
      uid = "msmith";
      cn = "Mr Smith";
      sn = "Msmith";
      mail = "msmith@${tw.domain}";
      active = false;
    }
    {
      uid = "synapseadmin";
      cn = "Synapse Admin";
      sn = "Syadmin";
      mail = "synapseadmin@${tw.domain}";
      isTechnical = true;
    }
  ];

  twakeEmails = mail: ''[{"value":"${mail}","type":"work","primary":true}]'';
  twakePhones = mobile: ''[{"value":"${mobile}","type":"mobile","primary":true}]'';

  optAttr = name: val: lib.optionalString (val != null && val != "") "${name}: ${val}\n";

  mkUserEntry = user: ''
    dn: uid=${user.uid},${ouUsers}
    objectClass: top
    objectClass: person
    objectClass: organizationalPerson
    objectClass: inetOrgPerson
    objectClass: twakeAccount
    objectClass: twakeWhitePages
    uid: ${user.uid}
    cn: ${user.cn}
    sn: ${user.sn}
    ${optAttr "twakeDisplayName" user.cn}${optAttr "twakeFullname" user.cn}${optAttr "twakeEmails" (lib.optionalString (user ? mail && user.mail != null && user.mail != "") (twakeEmails user.mail))}${optAttr "twakePhones" (lib.optionalString (user ? mobile && user.mobile != null && user.mobile != "") (twakePhones user.mobile))}${optAttr "twakeWorkspaceUrl" (user.workspaceUrl or "")}twakeAccountStatus: ${if (user.active or true) then "active" else "disabled"}
    twakeCreatedAt: ${createdAt}
    ${optAttr "twakeIsTechnical" (if (user.isTechnical or false) then "TRUE" else "")}userPassword: ${user.uid}

  '';

  ldifUsers = lib.concatMapStrings mkUserEntry users;

  dataDir = "${config.env.DEVENV_STATE}/openldap";
in
{
  packages = [ pkgs.openldap ];

  files = {
    "${dataDir}/slapd.conf".text = ''
      include    ${pkgs.openldap}/etc/schema/core.schema
      include    ${pkgs.openldap}/etc/schema/cosine.schema
      include    ${pkgs.openldap}/etc/schema/inetorgperson.schema
      include    ${dataDir}/twake.schema

      pidfile    ${dataDir}/slapd.pid
      argsfile   ${dataDir}/slapd.args
      loglevel   conns filter config ACL stats

      database   mdb
      maxsize    1073741824
      suffix     "${ldap.base}"
      rootdn     "${ldap.admin}"
      rootpw     ${ldap.pass}
      directory  ${dataDir}/data

      access to *
        by dn.exact=gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth manage
        by * break

      access to attrs=userPassword
        by self write
        by anonymous auth
        by * none

      access to *
        by self read
        by * read
    '';

    "${dataDir}/twake.schema".text = ''
      attributetype ( 1.3.6.1.4.1.99999.1.1.1
        NAME 'twakeAdditionalName'
        DESC 'Additional name (middle name) for Twake user'
        EQUALITY caseIgnoreMatch
        SUBSTR caseIgnoreSubstringsMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.2
        NAME 'twakeNamePrefix'
        DESC 'Name prefix (honorific) for Twake user'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{64}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.3
        NAME 'twakeEmails'
        DESC 'JSON array of email addresses with type and primary flag'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.4
        NAME 'twakePhones'
        DESC 'JSON array of phone numbers with type and primary flag'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.5
        NAME 'twakeAddresses'
        DESC 'JSON array of postal addresses with extended fields'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.6
        NAME 'twakeImpp'
        DESC 'JSON array of IMPP URIs (SIP, XMPP, etc.)'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.7
        NAME 'twakeOrganizationRole'
        DESC 'User role in organization: admin, moderator, or member'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{32}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.8
        NAME 'twakeOrganizationLink'
        DESC 'DN of the organization this user belongs to'
        EQUALITY distinguishedNameMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.12
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.10
        NAME 'twakeDomain'
        DESC 'Domain name of the Twake organization'
        EQUALITY caseIgnoreMatch
        SUBSTR caseIgnoreSubstringsMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.11
        NAME 'twakeOrgStatus'
        DESC 'Organization status: active or suspended'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{32}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.12
        NAME 'twakeCreatedAt'
        DESC 'Creation timestamp in ISO 8601 format'
        EQUALITY caseIgnoreMatch
        ORDERING caseIgnoreOrderingMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{32}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.13
        NAME 'twakeOrgMetadata'
        DESC 'JSON metadata for organization (plan, industry, etc.)'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.20
        NAME 'twakeDisplayName'
        DESC 'Display name for Twake user'
        EQUALITY caseIgnoreMatch
        SUBSTR caseIgnoreSubstringsMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.21
        NAME 'twakeFullname'
        DESC 'Full name for Twake user'
        EQUALITY caseIgnoreMatch
        SUBSTR caseIgnoreSubstringsMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.22
        NAME 'twakeBirthday'
        DESC 'Birthday in YYYY-MM-DD format'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{10}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.23
        NAME 'twakeGender'
        DESC 'Gender of the user'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{32}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.24
        NAME 'twakeBirthplace'
        DESC 'Birthplace of the user'
        EQUALITY caseIgnoreMatch
        SUBSTR caseIgnoreSubstringsMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.25
        NAME 'twakeJobTitle'
        DESC 'Job title of the user'
        EQUALITY caseIgnoreMatch
        SUBSTR caseIgnoreSubstringsMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.26
        NAME 'twakeCompany'
        DESC 'Company name of the user'
        EQUALITY caseIgnoreMatch
        SUBSTR caseIgnoreSubstringsMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.27
        NAME 'twakeNote'
        DESC 'Note or description for the user'
        EQUALITY caseIgnoreMatch
        SUBSTR caseIgnoreSubstringsMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{4096}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.30
        NAME 'twakeScryptR'
        DESC 'Scrypt R parameter'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{16}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.31
        NAME 'twakeScryptN'
        DESC 'Scrypt N parameter'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{16}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.32
        NAME 'twakeScryptP'
        DESC 'Scrypt P parameter'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{16}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.33
        NAME 'twakeScryptSalt'
        DESC 'Scrypt salt (base64 encoded)'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.34
        NAME 'twakeScryptDKLength'
        DESC 'Scrypt derived key length'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{16}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.35
        NAME 'twakeIterations'
        DESC 'PBKDF2 iterations count'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{16}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.36
        NAME 'twakePublicKey'
        DESC 'Public key in PEM format'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.37
        NAME 'twakePrivateKey'
        DESC 'Encrypted private key in PEM format'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.38
        NAME 'twakeProtectedKey'
        DESC 'Protected encryption key'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.39
        NAME 'twakeTwoFactorEnabled'
        DESC 'Two-factor authentication enabled flag'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{8}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.40
        NAME 'twakeRecoveryEmail'
        DESC 'Recovery email address'
        EQUALITY caseIgnoreMatch
        SUBSTR caseIgnoreSubstringsMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.41
        NAME 'twakeWorkspaceUrl'
        DESC 'User workspace URL'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{1024}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.42
        NAME 'twakeUserDomain'
        DESC 'Domain associated with the user'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.43
        NAME 'twakeAccountStatus'
        DESC 'User account status: active or disabled'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{32}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.44
        NAME 'twakeOrganizationOwner'
        DESC 'DN of the organization owner user'
        EQUALITY distinguishedNameMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.12
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.45
        NAME 'twakeOrganizationId'
        DESC 'Organization ID for B2B users'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{64}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.46
        NAME 'twakeIsTechnical'
        DESC 'Technical user flag: TRUE if technical user, absent if normal user'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{8}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.47
        NAME 'twakeInvited'
        DESC 'Invitation status: TRUE if user is invited, FALSE or absent if not'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{8}
        SINGLE-VALUE )

      attributetype ( 1.3.6.1.4.1.99999.1.1.48
        NAME 'twakeIsDeleted'
        DESC 'Soft delete flag: TRUE if user is deleted, absent if not'
        EQUALITY caseIgnoreMatch
        SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{8}
        SINGLE-VALUE )

      objectclass ( 1.3.6.1.4.1.99999.1.2.1
        NAME 'twakeAccount'
        DESC 'Twake user account'
        SUP top
        AUXILIARY
        MAY ( twakeOrganizationRole $ twakeOrganizationLink $ twakeOrganizationId $
              twakeScryptR $ twakeScryptN $ twakeScryptP $
              twakeScryptSalt $ twakeScryptDKLength $ twakeIterations $
              twakePublicKey $ twakePrivateKey $ twakeProtectedKey $
              twakeTwoFactorEnabled $ twakeRecoveryEmail $ twakeWorkspaceUrl $
              twakeUserDomain $ twakeCreatedAt $ twakeAccountStatus $
              twakeIsTechnical $ twakeInvited $ twakeIsDeleted ) )

      objectclass ( 1.3.6.1.4.1.99999.1.2.2
        NAME 'twakeWhitePages'
        DESC 'Twake user white pages profile with complex fields'
        SUP top
        AUXILIARY
        MAY ( twakeAdditionalName $ twakeNamePrefix $ twakeEmails $ twakePhones $
              twakeAddresses $ twakeImpp $ twakeDisplayName $ twakeFullname $
              twakeBirthday $ twakeGender $ twakeBirthplace $ twakeJobTitle $
              twakeCompany $ twakeNote ) )

      objectclass ( 1.3.6.1.4.1.99999.1.2.3
        NAME 'twakeOrganization'
        DESC 'Twake organization attributes'
        SUP top
        AUXILIARY
        MAY ( twakeDomain $ twakeOrgStatus $ twakeCreatedAt $ twakeOrgMetadata $
              twakeOrganizationOwner ) )
    '';

    "${dataDir}/02-base-structure.ldif".text = ''
      dn: ${ldap.base}
      objectClass: top
      objectClass: dcObject
      objectClass: organization
      dc: twake
      o: Twake

      dn: ${ouUsers}
      objectClass: top
      objectClass: organizationalUnit
      ou: users

      dn: cn=readers,${ouUsers}
      objectClass: groupOfNames
      cn: readers
      member: uid=dwho,${ouUsers}
      member: uid=rtyler,${ouUsers}
    '';

    "${dataDir}/03-users.ldif".text = ldifUsers;
  };

  tasks."twake:openldap:bootstrap" = {
    description = "Seed OpenLDAP with base structure and users (runs once)";
    exec = ''
      set -e
      SENTINEL="${dataDir}/.bootstrapped"

      [[ -e $SENTINEL ]] && exit 0

      echo "Creating default data folder"
      [[ -d ${dataDir}/data ]] || mkdir -pv ${dataDir}/data
      echo "done"

      echo "Starting temporary bootstrap slapd..."
      ${pkgs.openldap}/libexec/slapd -f "${dataDir}/slapd.conf" -h "ldap://127.0.0.1:${toString ldap.port}" -d 256 > "${dataDir}/bootstrap.log" 2>&1 &
      BOOT_PID=$!

      # Catch Ctrl+C and script exit to prevent orphaned processes
      cleanup() {
        echo "Cleaning up bootstrap slapd ($BOOT_PID)..."
        kill -9 "$BOOT_PID" 2>/dev/null || true
        wait "$BOOT_PID" 2>/dev/null || true
      }
      trap cleanup EXIT INT TERM

      echo "Waiting for bootstrap slapd to start..."
      while true; do
        # Fail fast if slapd crashes
        if ! kill -0 "$BOOT_PID" 2>/dev/null; then
          echo "ERROR: Bootstrap slapd died unexpectedly!"
          cat "${dataDir}/bootstrap.log"
          exit 1
        fi

        # Check if slapd is ready using ldapwhoami
        if ${lib.getExe' pkgs.openldap "ldapwhoami"} -o nettimeout=1 -x -H "ldap://127.0.0.1:${toString ldap.port}" -D "${ldap.admin}" -w "${ldap.pass}" >/dev/null 2>&1; then
          echo "slapd is up and accepting connections!"
          break
        fi

        sleep 1
      done

      echo "Seeding base structure..."
      ${lib.getExe' pkgs.openldap "ldapadd"} -x -H "ldap://127.0.0.1:${toString ldap.port}" \
        -D "${ldap.admin}" -w "${ldap.pass}" \
        -f "${dataDir}/02-base-structure.ldif"

      echo "Seeding users..."
      ${lib.getExe' pkgs.openldap "ldapadd"} -x -H "ldap://127.0.0.1:${toString ldap.port}" \
        -D "${ldap.admin}" -w "${ldap.pass}" \
        -f "${dataDir}/03-users.ldif"

      touch "$SENTINEL"
      echo "[openldap] bootstrap done"
    '';
    before = [ "devenv:processes:openldap@started" ];
  };

  processes.openldap = {
    exec = ''
      exec ${pkgs.openldap}/libexec/slapd \
        -f "${dataDir}/slapd.conf" \
        -h "ldap://127.0.0.1:${toString ldap.port}" \
        -d 256
    '';
  };

  scripts = {
    ldap-search = {
      description = "ldapsearch bound as admin against local slapd. Args forwarded.";
      exec = ''
        ${lib.getExe' pkgs.openldap "ldapsearch"} \
          -x -H "ldap://127.0.0.1:${toString ldap.port}" \
          -b "${ldap.base}" \
          -D "${ldap.admin}" -w "${ldap.pass}" \
          "$@"
      '';
    };
    ldap-reload = {
      description = "Wipe OpenLDAP state and re-seed on next devenv up";
      exec = ''
        rm -f "${dataDir}/.bootstrapped"
        rm -rf "${dataDir}/data"
        echo "[openldap] state cleared — run 'devenv up' to re-seed"
      '';
    };
  };

  env = {
    LDAP_URI = "ldap://127.0.0.1:${toString ldap.port}";
    LDAP_BASE = ldap.base;
  };
}
