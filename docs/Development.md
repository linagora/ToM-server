# Development

This page gathers details for developers working on the bridge beyond the
quick start found in the root [README](../README.md#development).

## Helper Scripts

A few convenience scripts are exposed inside the devenv shell to help you
tinker:

* `_twp_synapse_register_user <user> <pass> [--admin]` - register a Matrix
  user on the local Synapse.
* `_twp_bridge_run` - run the bridge manually (`bun dev`) against the
  generated dev config; useful instead of, or in addition to, `devenv up`.
* `_twp_rabbitmq_update_common_settings` - send a RabbitMQ common-settings
  payload to the bridge (interactive).

<!-- vim: set ft=markdown fenc=utf-8 spell spl=en tw=80 cc=80 et ts=2: -->
