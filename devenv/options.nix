# devenv/options.nix
# Declares the `twake` option namespace.
# Set values in devenv.nix. Read via config.twake.* in all modules.
{ lib, ... }:

let
  t = lib.types;
in
{
  options.twake = {
    domain = lib.mkOption {
      type = t.str;
      default = "twake.internal";
      description = "Base domain for all Twake local services.";
    };

    certFile = lib.mkOption {
      type = t.str;
      description = "Absolute path to the TLS certificate (covers apex + wildcard).";
    };

    keyFile = lib.mkOption {
      type = t.str;
      description = "Absolute path to the TLS private key.";
    };

    synapse = {
      port = lib.mkOption {
        type = t.port;
        default = 8008;
        description = "Synapse HTTP listener port.";
      };
    };

    ldap = {
      port = lib.mkOption {
        type = t.port;
        default = 3890;
        description = "OpenLDAP slapd listener port.";
      };
      base = lib.mkOption {
        type = t.str;
        description = "OpenLDAP base DN (derived from domain).";
      };
      admin = lib.mkOption {
        type = t.str;
        description = "OpenLDAP admin DN (derived from domain).";
      };
      pass = lib.mkOption {
        type = t.str;
        default = "admin_password";
        description = "OpenLDAP admin password.";
      };
    };

    caddy = {
      # Caddy binds as the current (non-root) devenv user, so it cannot use
      # the privileged HTTPS port 443. Use an unprivileged high port instead.
      port = lib.mkOption {
        type = t.port;
        default = 8443;
        description = "Public HTTPS port Caddy listens on (unprivileged).";
      };
    };

    pg = {
      listen_addresses = lib.mkOption {
        type = t.str;
        default = "127.0.0.1";
        description = "PostgreSQL listener port.";
      };
      port = lib.mkOption {
        type = t.port;
        default = 5432;
        description = "PostgreSQL listener port.";
      };
      synapse = lib.mkOption {
        type = t.attrsOf t.str;
        default = {
          db = "synapse";
          user = "synapse_user";
          password = "synapse_password";
        };
        description = "PostgreSQL credentials for Synapse.";
      };
      server = lib.mkOption {
        type = t.attrsOf t.str;
        default = {
          db = "bridge";
          user = "bridge_user";
          password = "bridge_password";
        };
        description = "PostgreSQL credentials for ToM Server.";
      };
    };
  };
}
