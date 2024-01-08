# Docker varibales for ToM server

 * `BASE_URL`: Base URL of the servce. Example: `https://tom.company.com`
 * `CRON_SERVICE`: Boolean (1 or 0): enable cron tasks or not
 * `CROWDSEC_URI`: optional URI of local CrowdSec server
 * `CROWDSEC_KEY`: CrowdSec API key _(required if `CROWDSEC_URI` is set)
 * `DATABASE_ENGINE`: `sqlite` or `pg`
 * `DATABASE_HOST`:
   * case `pg`: hostname
   * case `sqlite`: database path
 * `DATABASE_NAME`: [pg]
 * `DATABASE_USER`: [pg]
 * `DATABASE_PASSWORD`: [pg]
 * `LDAP_BASE`: base of LDAP where users are stored. Example: `dc=example,dc=com`
 * `LDAP_FILTER`: LDAP filter to find users. Example: `(objectClass=person)`
 * `LDAP_USER`: full LDAP `dn` used to connect
 * `LDAP_PASSWORD`: LDAP password
 * `LDAP_URI`: example: `ldaps://ldap.company.com`
 * `JITSI_BASE_URL`: example `https://jitsi.linagora.com`
 * 5 strings to set if Jitsi is strictly reserved for Twake users:
   * `JITSI_JWT_ALGORITHM`: example: `HS256`
   * `JITSI_JWT_ISSUER`: 
   * `JITSI_SECRET`: 
   * `JITSI_PREFERRED_DOMAIN`: 
   * `JITSI_USE_JWT`: 
 * `MATRIX_SERVER`: Matrix server. Example: `matrix.company.com`
 * `MATRIX_DATABASE_ENGINE`: `sqlite` or `pg`
 * `MATRIX_DATABASE_HOST`:
   * case `pg`: hostname
   * case `sqlite`: database path
 * `MATRIX_DATABASE_NAME`: [pg]
 * `MATRIX_DATABASE_PASSWORD`: [pg]
 * `MATRIX_DATABASE_USER`: [pg]
 * `OIDC_ISSUER`: Lemon URL. Example: `https://auth.company.com`
 * `SERVER_NAME`: Matrix "server name" _(ie domain)_. Example: `company.com`
 * `TEMPLATE_DIR`: Local path to templates dir (mail template).
