# devenv/caddy.nix
{
  pkgs,
  lib,
  config,
  ...
}:

let
  tw = config.twake;

  tls = ''
    tls ${tw.certFile} ${tw.keyFile}
  '';

  # Proxy a specific path prefix to tom, used for .well-known Matrix delegation
  wellKnownProxy = ''
    handle /.well-known/matrix/client {
      reverse_proxy 127.0.0.1:${toString tw.tom.port}
    }
    handle /.well-known/matrix/server {
      reverse_proxy 127.0.0.1:${toString tw.tom.port}
    }
  '';
in
{
  services.caddy = {
    enable = true;

    # ca = null disables ACME — all certs come from devenv mkcert integration
    ca = null;

    virtualHosts = {

      # Apex: .well-known Matrix delegation + catch-all to tom
      "https://${tw.domain}" = {
        extraConfig = ''
          ${tls}
          ${wellKnownProxy}
          handle {
            reverse_proxy 127.0.0.1:${toString tw.tom.port}
          }
        '';
      };

      # Matrix homeserver: .well-known delegation + catch-all to Synapse
      "https://matrix.${tw.domain}" = {
        extraConfig = ''
          ${tls}
          ${wellKnownProxy}
          handle {
            reverse_proxy 127.0.0.1:${toString tw.synapse.port}
          }
        '';
      };

      "https://tom.${tw.domain}" = {
        extraConfig = ''
          ${tls}
          reverse_proxy 127.0.0.1:${toString tw.tom.port}
        '';
      };

      "https://fed.${tw.domain}" = {
        extraConfig = ''
          ${tls}
          reverse_proxy 127.0.0.1:${toString tw.fed.port}
        '';
      };
    };
  };
}
