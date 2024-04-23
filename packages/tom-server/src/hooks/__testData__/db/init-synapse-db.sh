#!/bin/sh

psql -U postgres <<-EOSQL
  CREATE USER synapse PASSWORD 'synapse!';
  CREATE DATABASE synapsedb TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='synapse';
  CREATE DATABASE synapseexternaldb TEMPLATE='template0' LOCALE='C' ENCODING='UTF8' OWNER='synapse';
EOSQL