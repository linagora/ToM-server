{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

let
  domain = "twake.localhost";
  stateDir = config.env.DEVENV_STATE;
in
{
  imports = [
    ./devenv/options.nix
    ./devenv/caddy.nix
    ./devenv/postgres.nix
    ./devenv/synapse.nix
    ./devenv/openldap.nix
    ./devenv/apps.nix
  ];

  # ─── Twake options ─────────────────────────────────────────────────────────
  twake = {
    inherit domain;
    certFile = "${stateDir}/mkcert/${domain}.pem";
    keyFile = "${stateDir}/mkcert/${domain}-key.pem";

    # Derived from domain — single source, no repetition
    ldap.base = "dc=${lib.concatStringsSep ",dc=" (lib.splitString "." domain)}";
    ldap.admin = "cn=admin,dc=${lib.concatStringsSep ",dc=" (lib.splitString "." domain)}";
  };

  # ─── mkcert ────────────────────────────────────────────────────────────────
  hosts = {
    domain = "127.0.0.1";
    "tom.${domain}" = "127.0.0.1";
    "matrix.${domain}" = "127.0.0.1";
    "fed.${domain}" = "127.0.0.1";
  };

  certificates = [
    domain
    "tom.${domain}"
    "matrix.${domain}"
    "fed.${domain}"
  ];
  certFile = "${domain}.pem";
  keyFile = "${domain}-key.pem";

  # ─── Packages ──────────────────────────────────────────────────────────────
  packages = [
    pkgs.git

    pkgs.nssTools
    pkgs.pgcli
  ];

  # ─── Languages ─────────────────────────────────────────────────────────────
  languages = {
    javascript = {
      enable = true;
      package = pkgs.nodejs-slim_24;
      npm = {
        enable = true;
        install.enable = false;
      };
    };
    typescript.enable = true;
  };

  # ─── Git hooks ─────────────────────────────────────────────────────────────
  git-hooks.hooks = {
    biome.enable = true;
    convco.enable = true;
    nixfmt.enable = true;
  };

  # ─── Helper scripts ────────────────────────────────────────────────────────
  scripts.mkcert-trust = {
    description = "Install mkcert root CA into ~/.pki/nssdb for Chrome";
    exec = ''
      set -e
      DB="sql:$HOME/.pki/nssdb"
      CA="${config.env.DEVENV_STATE}/mkcert/rootCA.pem"
      [[ -f "$CA" ]] || { echo "rootCA.pem not found at $CA — run 'devenv up' first"; exit 1; }
      mkdir -p "$HOME/.pki/nssdb"
      ${lib.getExe' pkgs.nssTools "certutil"} -d "$DB" -N --empty-password 2>/dev/null || true
      ${lib.getExe' pkgs.nssTools "certutil"} -d "$DB" -D -n "mkcert-rootCA" 2>/dev/null || true
      ${lib.getExe' pkgs.nssTools "certutil"} -d "$DB" -A -t "C,," -n "mkcert-rootCA" -i "$CA"
      echo "[mkcert] root CA trusted in $DB — restart Chrome"
    '';
  };

  # ─── Shell welcome ─────────────────────────────────────────────────────────
  enterShell = ''
    echo ""
    echo "Twake local dev environment"
    echo ""
    echo "INFRASTRUCTURE"
    echo "  devenv up                openldap, caddy, synapse, postgres"
    echo ""
    echo "APPS (run after infra is up)"
    echo "  devenv tasks run twake:tom   ToM identity server  :${toString config.twake.tom.port}"
    echo "  devenv tasks run twake:fed   Fed identity server  :${toString config.twake.fed.port}"
    echo ""
    echo "VHOSTS"
    echo "  https://${domain}              → tom"
    echo "  https://tom.${domain}          → tom"
    echo "  https://fed.${domain}           → fed"
    echo "  https://matrix.${domain}        → synapse"
    echo ""
    echo "HELPERS"
    echo "  ldap-search [filter]       search as admin"
    echo "  ldap-reload                wipe ldap state; re-seed on next devenv up"
    echo "  synapse-register <u> <p>   register a Matrix user"
    echo "  mkcert-trust               install CA into ~/.pki/nssdb (Chrome)"
    echo ""
    echo "DATABASES (pgcli, host: 127.0.0.1)"
    echo "  pgcli -U ${config.twake.pg.synapse.user} ${config.twake.pg.synapse.db}"
    echo "  pgcli -U ${config.twake.pg.tom.user} ${config.twake.pg.tom.db}"
    echo "  pgcli -U ${config.twake.pg.fed.user} ${config.twake.pg.fed.db}"
    echo ""
  '';
}
