# devenv/synapse.nix
{
  pkgs,
  config,
  ...
}:

let
  tw = config.twake;
  pg = tw.pg.synapse;
  stateDir = "${config.env.DEVENV_STATE}/synapse";
  cfgPath = "${stateDir}/homeserver.yaml";
in
{
  packages = [
    pkgs.matrix-synapse
  ];

  files = {
    "${cfgPath}".yaml = {
      server_name = tw.domain;
      public_baseurl = "https://matrix.${tw.domain}:${toString tw.caddy.port}";
      pid_file = "${stateDir}/homeserver.pid";

      listeners = [
        {
          port = tw.synapse.port;
          bind_addresses = [ "127.0.0.1" ];
          type = "http";
          tls = false;
          x_forwarded = true;
          resources = [
            {
              names = [
                "client"
                "federation"
              ];
              compress = false;
            }
          ];
        }
      ];

      database = {
        name = "psycopg2";
        args = {
          user = pg.user;
          password = pg.password;
          database = pg.db;
          host = "127.0.0.1";
          cp_min = 5;
          cp_max = 10;
        };
      };

      log_config = "${stateDir}/log.config";
      media_store_path = "${stateDir}/media_store";
      signing_key_path = "${stateDir}/signing.key";

      enable_registration = true;
      enable_registration_without_verification = true;
      registration_shared_secret = "shared_registration_token";

      trusted_key_servers = [ ];
      report_stats = false;
    };

    "${stateDir}/log.config".yaml = {
      version = 1;
      formatters.precise.format = "%(asctime)s - %(name)s - %(lineno)d - %(levelname)s - %(request)s - %(message)s";
      handlers.console = {
        "class" = "logging.StreamHandler";
        formatter = "precise";
      };
      loggers."synapse.storage.SQL".level = "WARNING";
      root = {
        level = "INFO";
        handlers = [ "console" ];
      };
      disable_existing_loggers = false;
    };
  };

  tasks."twake:synapse:bootstrap" = {
    description = "Generate Synapse signing key if absent";
    exec = ''
      mkdir -p "${stateDir}/media_store"
      if [ ! -f "${stateDir}/signing.key" ]; then
        echo "[synapse] generating signing key..."
        ${pkgs.matrix-synapse}/bin/generate_signing_key \
          -o "${stateDir}/signing.key"
      fi
    '';
    after = [ "devenv:processes:postgres@ready" ];
    before = [ "devenv:processes:synapse@started" ];
  };

  processes.synapse = {
    exec = ''
      exec ${pkgs.matrix-synapse}/bin/synapse_homeserver \
        --config-path "${cfgPath}"
    '';
    process-compose.depends_on.postgres.condition = "process_healthy";
  };

  scripts._twp_synapse_register_user = {
    description = "Register a Matrix user: _twp_synapse_register_user <user> <pass> [--admin]";
    exec = ''
      ${pkgs.matrix-synapse}/bin/register_new_matrix_user \
        --config "${cfgPath}" \
        --user "$1" --password "$2" ''${3:+--admin} \
        http://127.0.0.1:${toString tw.synapse.port}
    '';
  };

  env.MATRIX_URL = "http://127.0.0.1:${toString tw.synapse.port}";
}
