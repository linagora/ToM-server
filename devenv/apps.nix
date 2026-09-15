# devenv/appservice.nix
# Runs the ToM Server in watch mode.
{
  config,
  ...
}:

let
  tw = config.twake;
in
{
  files = {
    ".env".text = ''
      # This env file is reserved for node related variables only

      NODE_OPTIONS=--inspect=0
      NODE_TLS_REJECT_UNAUTHORIZED=0
      NODE_EXTRA_CA_CERTS=.devenv/state/mkcert/rootCA.pem
    '';
    ".tomconfig.yaml".yaml = {
      server = {
        name = tw.domain;
        host = "0.0.0.0";
        port = 3000;
        trust_x_forwarded_for = true;
        additional_features = true;
        enable_cron_jobs = true;
      };

      synapse = {
        server_url = "https://matrix.${tw.domain}:${toString tw.caddy.port}";

        admin = {
          login = "synapseadmin";
          password = "synapseadmin";
        };

        database = {
          host = "127.0.0.1";
          name = tw.pg.synapse.db;
          user = tw.pg.synapse.user;
          password = tw.pg.synapse.password;
        };
      };

      database = {
        host = "127.0.0.1";
        name = tw.pg.server.db;
        user = tw.pg.server.user;
        password = tw.pg.server.password;
      };

      email = {
        smtp_host = "localhost";
        tls = false;
        sender = "noreply@${tw.domain}";
        templates_dir = "./assets/templates";
      };

      ldap = {
        uri = "ldap://127.0.0.1:${toString tw.ldap.port}";
        base = tw.ldap.base;
        user = tw.ldap.admin;
        password = tw.ldap.pass;
        uid_field = "uid";
      };

      logger = {
        level = "debug";
        pretty = true;
      };

      i18n = {
        locale = "en";
        locales_path = "./assets/i18n";
      };

      landing = {
        file_path = "./assets/static/landing.html";
      };

      features = {
        matrix_profile_updates_allowed = true;
        user_directory = {
          enabled = true;
        };
      };
    };
  };

  processes.tom = {
    exec = ''
      bun dev
    '';
    process-compose.depends_on.postgres.condition = "process_healthy";
    process-compose.depends_on.synapse.condition = "process_started";
  };
}
