#!/bin/sh

psql -U postgres <<-EOSQL
  CREATE USER twake PASSWORD 'twake!1';
  CREATE DATABASE fed TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='twake';
  CREATE DATABASE tom TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='twake';
EOSQL