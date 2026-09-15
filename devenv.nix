{
  config,
  pkgs,
  ...
}:

let
  domain = "twake.internal";
  stateDir = config.env.DEVENV_STATE;
in
{
  imports = [
    ./devenv/options.nix
    ./devenv/apps.nix
    ./devenv/caddy.nix
    ./devenv/openldap.nix
    ./devenv/postgres.nix
    ./devenv/synapse.nix
  ];

  twake = {
    inherit domain;
    certFile = "${stateDir}/mkcert/${domain}.pem";
    keyFile = "${stateDir}/mkcert/${domain}-key.pem";
    ldap = {
      base = "dc=twake,dc=internal";
      admin = "cn=admin,dc=twake,dc=internal";
    };
  };

  hosts = {
    domain = "127.0.0.1";
    "matrix.${domain}" = "127.0.0.1";
    "tom.${domain}" = "127.0.0.1";
  };

  certificates = [
    domain
    "matrix.${domain}"
  ];
  certFile = "${domain}.pem";
  keyFile = "${domain}-key.pem";

  packages = [
    pkgs.curl
    pkgs.git
    pkgs.jq
    pkgs.mkcert
  ];

  # C++ runtime needed by native node addons (e.g. sqlite3 prebuilt binaries)
  env.LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ];

  opencode = {
    enable = true;
    mcp = {
      devenv = {
        type = "local";
        command = [
          "devenv"
          "mcp"
        ];
        environment = {
          DEVENV_ROOT = "{env:DEVENV_ROOT}";
        };
      };
      "tree-sitter" = {
        type = "local";
        command = [
          "bunx"
          "@nendo/tree-sitter-mcp"
          "--mcp"
        ];
      };
      zod = {
        type = "remote";
        url = "https://mcp.inkeep.com/zod/mcp";
      };
    };
  };

  languages = {
    javascript = {
      enable = true;
      bun.enable = true;
      bun.install.enable = false;
      lsp.enable = true;
    };
    nix = {
      enable = true;
      lsp.enable = true;
    };
    shell = {
      enable = true;
      lsp.enable = true;
    };
    typescript = {
      enable = true;
      lsp.enable = true;
    };
  };

  git-hooks = {
    enable = true;
    hooks = {
      biome.enable = true;
      convco.enable = true;
      markdownlint.enable = true;
      nixfmt.enable = true;
      shfmt.enable = true;
      yamllint.enable = true;
    };
  };

  scripts._twp_release = {
    description = "Create a release commit, tag, and changelog. Usage: _twp_release [--major|--minor|--patch]";
    exec = ''
      set -euo pipefail

      # Resolve bump flag (default: auto-detect from commits)
      BUMP_FLAG=""
      for arg in "$@"; do
        case "$arg" in
          --major|--minor|--patch) BUMP_FLAG="$arg" ;;
          *) echo "Unknown argument: $arg"; exit 1 ;;
        esac
      done

      # Ensure clean working tree
      if ! git diff --quiet || ! git diff --cached --quiet; then
        echo "Error: working tree is dirty. Commit or stash changes first."
        exit 1
      fi

      # Compute next version
      NEXT_VERSION=$(convco version --bump $BUMP_FLAG)
      TAG="v''${NEXT_VERSION}"
      echo "Releasing ''${TAG}..."

      # Update package.json version (strip leading v)
      jq --arg ver "''${NEXT_VERSION}" '.version = $ver' package.json > package.json.tmp
      mv package.json.tmp package.json

      # Generate changelog
      convco changelog -u ''${TAG} | sed 's/\\n/\n/g' > CHANGELOG.md
      echo -e '\n<!-- markdownlint-disable-file MD024 -->' >> CHANGELOG.md
      markdownlint -f CHANGELOG.md

      # Commit and tag
      git add package.json CHANGELOG.md
      git commit -m "chore(release): ''${TAG}"
      git tag -a "''${TAG}" -m "''${TAG}"

      echo "Release ''${TAG} created. Review, then push with: git push && git push --tags"
    '';
  };

  enterShell = ''
    echo
    echo "..:: Twake Chat local dev environment ::.."
    echo
    echo "INCLUDED SERVICES"
    echo
    echo -e "\t- Caddy       https://${domain}:${toString config.twake.caddy.port}"
    echo -e "\t- Synapse     https://matrix.${domain}:${toString config.twake.caddy.port}"
    echo -e "\t- Postgres    127.0.0.1:${toString config.twake.pg.port}"
    echo -e "\t- LDAP        ${config.twake.ldap.base}"
    echo -e "\t- ToM Server  (bun dev with watch mode)"
    echo
    echo "DATABASES"
    echo
    echo -e "\t- pgcli -U ${config.twake.pg.synapse.user} ${config.twake.pg.synapse.db}"
    echo -e "\t- pgcli -U ${config.twake.pg.server.user} ${config.twake.pg.server.db}"
    echo
    echo "NEXT STEPS"
    echo
    echo -e "\t# 1. Enter the devenv shell"
    echo -e "\tdevenv shell          # or: devenv allow"
    echo
    echo -e "\t# 2. Trust the local mkcert CA (so Chrome/Firefox accept the certs)"
    echo -e "\tmkcert -install"
    echo
    echo -e "\t# 3. Start everything (Caddy, Synapse, Postgres, LDAP and the ToM Server)"
    echo -e "\tdevenv up"
    echo
    echo "HELPER SCRIPTS"
    echo
    echo -e "\t # Register a Matrix user"
    echo -e "\t _twp_synapse_register_user <user> <pass> [--admin]"
    echo
    echo -e "\t # Search LDAP as admin"
    echo -e "\t ldap-search <args>"
    echo
    echo -e "\t # Wipe LDAP state and re-seed on next devenv up"
    echo -e "\t ldap-reload"
    echo
    echo -e "\t # Create a release commit, tag, and changelog"
    echo -e "\t _twp_release [--major|--minor|--patch]"
  '';

  # See full reference at https://devenv.sh/reference/options/
}
