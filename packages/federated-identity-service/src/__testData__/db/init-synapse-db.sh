#!/bin/sh

psql -U postgres <<-EOSQL
  CREATE USER synapse PASSWORD 'synapse!1';
  CREATE DATABASE synapsefederatedidentity TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='synapse';
  CREATE DATABASE synapse1 TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='synapse';
  CREATE DATABASE synapse2 TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='synapse';
  CREATE DATABASE synapse3 TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='synapse';
EOSQL