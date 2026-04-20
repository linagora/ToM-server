-- Initialize databases and users for ToM-Server
CREATE USER twake WITH PASSWORD 'twake_password';

-- Create tom_db database and grant permissions to twake user
CREATE DATABASE tom_db
    OWNER twake
    ENCODING 'UTF8'
    LC_COLLATE = 'C'
    LC_CTYPE = 'C'
    TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE tom_db TO twake;

-- Create fed_db database and grant permissions to twake user
CREATE DATABASE fed_db
    OWNER twake
    ENCODING 'UTF8'
    LC_COLLATE = 'C'
    LC_CTYPE = 'C'
    TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE fed_db TO twake;

-- Create synapse database and synapse_user with C collation (required by Synapse)
CREATE USER synapse_user WITH PASSWORD 'secretpassword';
CREATE DATABASE synapse
  OWNER synapse_user
  ENCODING 'UTF8'
  LC_COLLATE = 'C'
  LC_CTYPE = 'C'
  TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE synapse TO synapse_user;
