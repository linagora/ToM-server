# Base image
FROM debian:bullseye-20241223-slim
LABEL maintainer="Linagora"

ENV DEBIAN_FRONTEND=noninteractive

# Update system and install dependencies (LTB OpenLDAP + tools)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    gpg \
    wget && \
    curl -fsSL https://ltb-project.org/documentation/_static/ltb-project-debian-keyring.gpg \
    | gpg --dearmor -o /usr/share/keyrings/ltb-project-debian-keyring.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/ltb-project-debian-keyring.gpg] \
    https://ltb-project.org/debian/openldap25/bullseye bullseye main" \
    > /etc/apt/sources.list.d/ltb-project.list && \
    apt-get update && \
    apt-get install -y openldap-ltb openldap-ltb-contrib-overlays openldap-ltb-mdb-utils ldap-utils && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy configuration and LDIF files
COPY ./ldif/config-20230322180123.ldif /var/backups/openldap/
COPY ./ldif/base_ldap_users.ldif /tmp/

# Prepare LDAP directories and load configuration + base entries
RUN rm -rf /usr/local/openldap/var/lib/ldap /usr/local/openldap/etc/openldap/slapd.d && \
    mkdir -p /usr/local/openldap/var/lib/ldap /usr/local/openldap/etc/openldap/slapd.d && \
    chown -R ldap:ldap /usr/local/openldap/var/lib/ldap /usr/local/openldap/etc/openldap/slapd.d && \
    /usr/local/openldap/sbin/slapd-cli restoreconfig -b /var/backups/openldap/config-20230322180123.ldif && \
    mkdir -p /usr/local/openldap/var/lib/ldap/data && \
    chown -R ldap:ldap /usr/local/openldap/var/lib/ldap/data && \
    /usr/local/openldap/sbin/slapadd -F /usr/local/openldap/etc/openldap/slapd.d/ \
    -b "dc=example,dc=com" -l /tmp/base_ldap_users.ldif

# Expose LDAP default port
EXPOSE 389

# Persist LDAP database
VOLUME /usr/local/openldap/var/lib/ldap

# Start slapd in foreground
CMD ["/usr/local/openldap/libexec/slapd", "-h", "ldap://*", "-u", "ldap", "-g", "ldap", "-d", "256"]
