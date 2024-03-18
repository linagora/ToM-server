#!/bin/sh

psql -U postgres <<-EOSQL
  CREATE USER synapse PASSWORD 'synapse!1';
  CREATE DATABASE synapse TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='synapse';
EOSQL
psql -v ON_ERROR_STOP=1 --username "synapse" --dbname "synapse" <<-EOSQL
  CREATE TABLE users (
      name text,
      password_hash text,
      creation_ts bigint,
      admin smallint DEFAULT 0 NOT NULL,
      upgrade_ts bigint,
      is_guest smallint DEFAULT 0 NOT NULL,
      appservice_id text,
      consent_version text,
      consent_server_notice_sent text,
      user_type text,
      deactivated smallint DEFAULT 0 NOT NULL,
      shadow_banned boolean,
      consent_ts bigint
  );
EOSQL