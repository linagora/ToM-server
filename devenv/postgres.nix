# devenv/postgres.nix
{
  pkgs,
  lib,
  config,
  ...
}:

let
  tw = config.twake;
in
{
  services.postgres = {
    enable = true;
    listen_addresses = "127.0.0.1";

    # initialDatabases: module handles idempotent role+DB creation internally.
    # C locale + UTF8 required by Synapse; postgres module initdb defaults match.
    initialDatabases = [
      {
        name = tw.pg.synapse.db;
        user = tw.pg.synapse.user;
        pass = tw.pg.synapse.password;
      }
      {
        name = tw.pg.tom.db;
        user = tw.pg.tom.user;
        pass = tw.pg.tom.password;
      }
      {
        name = tw.pg.fed.db;
        user = tw.pg.fed.user;
        pass = tw.pg.fed.password;
      }
    ];

    settings.log_connections = true;
  };

  env.PG_HOST = "127.0.0.1";
}
