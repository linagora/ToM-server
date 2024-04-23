#!/bin/sh

psql -U postgres <<-EOSQL
  CREATE USER twake PASSWORD 'twake!';
  CREATE DATABASE twakedb TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='twake';
EOSQL