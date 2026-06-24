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
      default = "twake.localhost";
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

    synapse.port = lib.mkOption {
      type = t.port;
      default = 8008;
      description = "Synapse HTTP listener port.";
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

    tom.port = lib.mkOption {
      type = t.port;
      default = 3000;
      description = "ToM identity server port.";
    };

    fed.port = lib.mkOption {
      type = t.port;
      default = 3001;
      description = "Federated identity server port.";
    };

    pg = {
      synapse = lib.mkOption {
        type = t.attrsOf t.str;
        default = {
          db = "syn";
          user = "syn";
          password = "syn_password";
        };
        description = "PostgreSQL credentials for Synapse.";
      };
      tom = lib.mkOption {
        type = t.attrsOf t.str;
        default = {
          db = "tom";
          user = "tom";
          password = "tom_password";
        };
        description = "PostgreSQL credentials for ToM.";
      };
      fed = lib.mkOption {
        type = t.attrsOf t.str;
        default = {
          db = "fed";
          user = "fed";
          password = "fed_password";
        };
        description = "PostgreSQL credentials for Fed.";
      };
    };
  };
}
