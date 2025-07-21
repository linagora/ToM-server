#!/bin/sh
set -e

DATABASE=${PG_DATABASE:-lemonldapng}
USER=${PG_USER:-lemonldap}
PASSWORD=${PG_PASSWORD:-lemonldap}
TABLE=${PG_TABLE:-users}

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DATABASE" <<-EOSQL
	CREATE TABLE IF NOT EXISTS $TABLE (
		uid VARCHAR(255) PRIMARY KEY NOT NULL,
    name VARCHAR(255) NOT NULL,
    mail VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    mobile VARCHAR(50)
	);
	GRANT ALL PRIVILEGES ON TABLE $TABLE TO $USER;

	-- User: dwho
	INSERT INTO $TABLE (uid, name, mail, password, mobile) VALUES
	('dwho', 'Doctor Who', 'doctor.who@docker.localhost', 'dwho', '+442079460123');

	-- User: rtyler
	INSERT INTO $TABLE (uid, name, mail, password, mobile) VALUES
	('rtyler', 'Rose Tyler', 'rose.tyler@docker.localhost', 'rtyler', '+15559876543');

	-- User: half
	INSERT INTO $TABLE (uid, name, mail, password, mobile) VALUES
	('half', 'Martha Jones', 'martha.jones@docker.localhost', 'half', '+33123456789');
EOSQL
