#!/bin/sh

psql -U postgres <<-EOSQL
  CREATE USER synapse PASSWORD 'synapse!1';
  CREATE DATABASE synapse TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='synapse';
EOSQL