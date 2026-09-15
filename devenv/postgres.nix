# devenv/postgres.nix
{
  config,
  ...
}:

let
  tw = config.twake;
in
{
  services.postgres = {
    enable = true;
    port = tw.pg.port;
    listen_addresses = tw.pg.listen_addresses;

    # initialDatabases: module handles idempotent role+DB creation internally.
    # C locale + UTF8 required by Synapse; postgres module initdb defaults match.
    initialDatabases = [
      {
        name = tw.pg.synapse.db;
        user = tw.pg.synapse.user;
        pass = tw.pg.synapse.password;
      }
      {
        name = tw.pg.server.db;
        user = tw.pg.server.user;
        pass = tw.pg.server.password;
      }
    ];

    settings.log_connections = true;
  };

  env.PG_HOST = tw.pg.listen_addresses;
}
