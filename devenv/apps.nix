# devenv/apps.nix
# tom and fed: config files + on-demand tasks.
# Run: devenv tasks run twake:tom
#      devenv tasks run twake:fed
{
  pkgs,
  lib,
  config,
  ...
}:

let
  tw = config.twake;
  stateDir = "${config.env.DEVENV_STATE}/tom";
  tomCfg = "${stateDir}/tom.yaml";
  fedCfg = "${stateDir}/fed.yaml";
in
{
  files = {
    "${tomCfg}".yaml = {
      server = {
        name = tw.domain;
        base_url = "https://tom.${tw.domain}";
        host = "0.0.0.0";
        port = tw.tom.port;
        trust_x_forwarded_for = true;
        trusted_proxies = [ "uniquelocal" ];
        additional_features = true;
      };

      synapse = {
        server_url = "https://matrix.${tw.domain}";
        internal_host = "http://127.0.0.1:${toString tw.synapse.port}";
        admin = {
          login = "admin";
          password = "change-me";
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
        name = tw.pg.tom.db;
        user = tw.pg.tom.user;
        password = tw.pg.tom.password;
      };

      ldap = {
        uri = "ldap://127.0.0.1:${toString tw.ldap.port}";
        base = "ou=users,${tw.ldap.base}";
        filter = "(objectClass=inetOrgPerson)";
        uid_field = "uid";
      };

      email = {
        smtp_host = "127.0.0.1";
        templates_dir = "./assets/templates";
      };

      logger = {
        level = "silly";
        pretty = true;
      };
      i18n.locales_path = "./i18n";
      landing.file_path = "./static/landing.html";
    };

    "${fedCfg}".yaml = {
      server = {
        name = tw.domain;
        base_url = "https://fed.${tw.domain}";
        host = "0.0.0.0";
        port = tw.fed.port;
        trust_x_forwarded_for = true;
        trusted_proxies = [ "uniquelocal" ];
      };

      database = {
        host = "127.0.0.1";
        name = tw.pg.fed.db;
        user = tw.pg.fed.user;
        password = tw.pg.fed.password;
      };

      email = {
        smtp_host = "127.0.0.1";
        templates_dir = "./assets/templates";
      };

      federation = {
        is_federated_identity_service = true;
        trusted_servers_addresses = [ "127.0.0.1/8" ];
      };

      logger = {
        level = "silly";
        pretty = true;
      };
      i18n.locales_path = "./i18n";
      landing.file_path = "./static/landing.html";
    };
  };

  tasks = {
    "twake:tom" = {
      description = "ToM identity server on port ${toString tw.tom.port}";
      exec = "npx nx serve tom-server --args='--config' --args='${tomCfg}'";
    };
    "twake:fed" = {
      description = "Federated identity server on port ${toString tw.fed.port}";
      exec = "npx nx serve tom-server --args='--config' --args='${fedCfg}'";
    };
  };
}
