FROM debian:bullseye-slim
LABEL maintainer Linagora

ENV DEBIAN_FRONTEND=noninteractive

# Update system and install dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        apt-transport-https \
        ca-certificates \
        curl \
        gpg \
        wget && \
    curl https://ltb-project.org/documentation/_static/ltb-project-debian-keyring.gpg | gpg --dearmor > /usr/share/keyrings/ltb-project-debian-keyring.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/ltb-project-debian-keyring.gpg] https://ltb-project.org/debian/openldap25/bullseye bullseye main" > /etc/apt/sources.list.d/ltb-project.list && \
    apt-get update && \
    apt-get install -y openldap-ltb openldap-ltb-contrib-overlays openldap-ltb-mdb-utils ldap-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy configuration files
COPY ./ldif/config-20230322180123.ldif /var/backups/openldap/
COPY ./ldif/base_ldap_users.ldif /tmp
COPY ./start.sh /tmp
COPY ./ldif/update_password.ldif /tmp

# Configure LDAP
RUN rm -rf /usr/local/openldap/var/lib/ldap /usr/local/openldap/etc/openldap/slapd.d && \
    mkdir -p /usr/local/openldap/var/lib/ldap && \
    chown -R ldap:ldap /usr/local/openldap/var/lib/ldap && \
    mkdir -p /usr/local/openldap/etc/openldap/slapd.d && \
    chown -R ldap:ldap /usr/local/openldap/etc/openldap/slapd.d && \
    usr/local/openldap/sbin/slapd-cli restoreconfig -b /var/backups/openldap/config-20230322180123.ldif && \
    mkdir -p /usr/local/openldap/var/lib/ldap/data && \
    chown -R ldap:ldap /usr/local/openldap/var/lib/ldap/data && \
    /usr/local/openldap/sbin/slapadd -F /usr/local/openldap/etc/openldap/slapd.d/ -b "dc=docker,dc=localhost" -l /tmp/base_ldap_users.ldif

# Expose LDAP port
EXPOSE 389

# Define LDAP data volume
VOLUME /usr/local/openldap/var/openldap-data

# Set the entrypoint script
#CMD ["/usr/local/openldap/libexec/slapd", "-h", "ldap://*", "-u", "ldap", "-g", "ldap", "-d", "256"]
CMD ["/tmp/start.sh"]

