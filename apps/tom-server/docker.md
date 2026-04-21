# Docker deployment

## Mount points

The server resolves files from platform-aware directories (see `src/platform/paths.ts`). On Linux (Docker), the conventions are:

### Configuration

Config is loaded in priority order — later files win. Mount your config at the **first** path that applies:

| Priority | Path | Notes |
|----------|------|-------|
| 1 (lowest) | `/etc/twake/chat/tom/config.yaml` | System-wide default |
| 2 | `/usr/local/etc/twake/chat/tom/config.yaml` | Local system override |
| 3 (highest) | `$XDG_CONFIG_HOME/twake/chat/tom/config.yaml` | User-level override |

The typical Docker mount:

```sh
-v /host/path/to/config.yaml:/etc/twake/chat/tom/config.yaml:ro
```

See `.tomconfig.example.yaml` at the repo root for the full reference.

### i18n (locale messages)

Translation files are YAML files named `<locale>.yaml` (e.g., `en.yaml`, `fr.yaml`).

The server scans share directories in reverse priority order (nearest wins):

| Priority | Path |
|----------|------|
| 1 (lowest) | `/usr/share/twake/chat/tom/i18n/` |
| 2 | `/usr/local/share/twake/chat/tom/i18n/` |
| 3 (highest) | `$XDG_DATA_HOME/twake/chat/tom/i18n/` |

The image ships the bundled translations into `/usr/share/twake/chat/tom/i18n/`. To override with custom locale files:

```sh
-v /host/path/to/i18n/:/usr/local/share/twake/chat/tom/i18n/:ro
```

### Landing page (static)

The server landing page is a single HTML file. Default path:

```
/usr/share/twake/chat/tom/static/landing.html
```

Override the file path in config (`landing.file_path`), or replace the file directly:

```sh
-v /host/path/to/landing.html:/usr/share/twake/chat/tom/static/landing.html:ro
```

### Mail / SMS templates

Email and SMS templates live under the templates share directory. The image ships default templates to `/usr/share/twake/chat/tom/templates/`. To override:

```sh
-v /host/path/to/templates/:/usr/local/share/twake/chat/tom/templates/:ro
```

## Minimal compose example

```yaml
services:
  tom-server:
    image: linagora/tom-server:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/etc/twake/chat/tom/config.yaml:ro
      # optional overrides:
      # - ./i18n/:/usr/local/share/twake/chat/tom/i18n/:ro
      # - ./templates/:/usr/local/share/twake/chat/tom/templates/:ro
      # - ./landing.html:/usr/share/twake/chat/tom/static/landing.html:ro
```
