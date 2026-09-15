# devenv/caddy.nix
{
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
      header Content-Type application/json
      header Access-Control-Allow-Origin *
      respond `{"m.homeserver":{"base_url":"https://matrix.${tw.domain}:${toString tw.caddy.port}/"}}` 200
    }
    handle /.well-known/matrix/server {
        header Content-Type application/json
        respond `{"m.server":"matrix.${tw.domain}:${toString tw.synapse.port}"}` 200
    }
  '';
in
{
  services.caddy = {
    enable = true;

    # ca = null disables ACME — all certs come from devenv mkcert integration
    ca = null;

    # Global options must live in a top-level `{ }` block: devenv's caddy
    # module concatenates `config` verbatim, then appends each virtualHost.
    config = ''
      {
        auto_https disable_redirects
      }
    '';

    virtualHosts = {

      # Apex: .well-known Matrix delegation + catch-all to tom
      "https://${tw.domain}:${toString tw.caddy.port}" = {
        extraConfig = ''
          ${tls}
          ${wellKnownProxy}
        '';
      };

      # Matrix homeserver: .well-known delegation + catch-all to Synapse
      "https://matrix.${tw.domain}:${toString tw.caddy.port}" = {
        extraConfig = ''
          ${tls}
          ${wellKnownProxy}
          handle {
            reverse_proxy 127.0.0.1:${toString tw.synapse.port}
          }
        '';
      };

      # ToM Server
      "https://tom.${tw.domain}:${toString tw.caddy.port}" = {
        extraConfig = ''
          ${tls}
          handle {
            reverse_proxy 127.0.0.1:3000
          }
        '';
      };
    };
  };
}
