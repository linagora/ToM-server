#!/bin/sh

psql -U postgres <<-EOSQL
  CREATE USER twake PASSWORD 'twake!1';
  CREATE DATABASE federation TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='twake';
  CREATE DATABASE identity1 TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='twake';
  CREATE DATABASE identity2 TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='twake';
  CREATE DATABASE identity3 TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='twake';
EOSQL