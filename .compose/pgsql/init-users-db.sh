#!/bin/sh
set -e

DATABASE=${PG_DATABASE:-lemonldapng}
USER=${PG_USER:-lemonldap}
PASSWORD=${PG_PASSWORD:-lemonldap}
TABLE=${PG_TABLE:-users}

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DATABASE" <<-EOSQL
CREATE TABLE IF NOT EXISTS $TABLE (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64),
    password VARCHAR(64),
    sn VARCHAR(64),
    mail VARCHAR(64),
    givenname VARCHAR(64),
    mobile VARCHAR(20),
    isadmin BOOLEAN DEFAULT FALSE,
    isblocked BOOLEAN DEFAULT FALSE
);

-- Create unique indexes for frequently searched fields
CREATE UNIQUE INDEX u__username ON $TABLE USING btree(username);
CREATE UNIQUE INDEX u__mail ON $TABLE USING btree(mail);
CREATE UNIQUE INDEX u__mobile ON $TABLE USING btree(mobile);

-- Grant privileges to the specified user (replace $TABLE and $USER with actual values)
GRANT ALL PRIVILEGES ON TABLE $TABLE TO $USER;

-- Insert user data based on LDIF reference with international phone number format
-- Derivation Logic:
--   givenname: Use 'givenName' from LDIF if present. Otherwise, use the first word of 'cn'.
--   sn: If 'cn' has multiple words, use the last word of 'cn'. Otherwise, use 'sn' from LDIF if present, else NULL.
INSERT INTO $TABLE (username, password, sn, mail, givenname, mobile) VALUES
('dwho', 'dwho', 'Who', NULL, 'Dr', '+33671298765'),
('rtyler', 'rtyler', 'Tyler', 'rtyler@docker.localhost', 'Rose', '+33671298767'),
('msmith', 'msmith', 'Smith', 'msmith@docker.localhost', 'Mr', NULL),
('okenobi', 'okenobi', 'Kenobi', 'okenobi@docker.localhost', 'Obi-Wan', NULL),
('qjinn', 'qjinn', 'Jinn', 'qjinn@docker.localhost', 'Qui-Gon', NULL),
('chewbacca', 'chewbacca', 'Chewbacca', 'chewbacca@docker.localhost', 'Chewbacca', NULL),
('lorgana', 'lorgana', 'Organa', 'lorgana@docker.localhost', 'Leia', NULL),
('pamidala', 'pamidala', 'Amidala', 'pamidala@docker.localhost', 'Padme', NULL),
('cdooku', 'cdooku', 'Dooku', 'cdooku@docker.localhost', 'Comte', NULL),
('kren', 'kren', 'Ren', 'kren@docker.localhost', 'Kylo', NULL),
('dmaul', 'dmaul', 'Maul', 'dmaul@docker.localhost', 'Dark', NULL),
('askywalker', 'askywalker', 'Skywalker', 'askywalker@docker.localhost', 'Anakin', NULL),
('jbinks', 'jbinks', 'Binks', 'jbinks@docker.localhost', 'Jar Jar', NULL),
('bfett', 'bfett', 'Fett', 'bfett@docker.localhost', 'Boba', NULL),
('jfett', 'jfett', 'Ffett', 'jfett@docker.localhost', 'Jango', NULL),
('lskywalker', 'lskywalker', 'Skywalker', 'lskywalker@docker.localhost', 'Luc', NULL),
('myoda', 'myoda', 'Yoda', 'myoda@docker.localhost', 'Master', NULL),
('hsolo', 'hsolo', 'Solo', 'hsolo@docker.localhost', 'Han', NULL),
('r2d2', 'r2d2', 'R2D2', 'r2d2@docker.localhost', 'R2D2', NULL),
('c3po', 'c3po', 'C3po', 'c3po@docker.localhost', 'C3PO', NULL),
('synapseadmin', 'synapseadmin', 'Syadmin', 'synapseadmin@docker.localhost', 'Synapse', NULL),
('annasmith', 'annasmith', 'Smith', 'annasmith@docker.localhost', 'Anna', NULL),
('johnjohnson', 'johnjohnson', 'Johnson', 'johnjohnson@docker.localhost', 'John', NULL),
('emilybrown', 'emilybrown', 'Brown', 'emilybrown@docker.localhost', 'Emily', NULL),
('daviddavis', 'daviddavis', 'Davis', 'daviddavis@docker.localhost', 'David', NULL),
('sarahwilson', 'sarahwilson', 'Wilson', 'sarahwilson@docker.localhost', 'Sarah', NULL),
('miketaylor', 'miketaylor', 'Taylor', 'miketaylor@docker.localhost', 'Mike', NULL),
('graceadams', 'graceadams', 'Adams', 'graceadams@docker.localhost', 'Grace', NULL),
('mattmoore', 'mattmoore', 'Moore', 'mattmoore@docker.localhost', 'Matt', NULL),
('lilyparker', 'lilyparker', 'Parker', 'lilyparker@docker.localhost', 'Lily', NULL),
('danieldixon', 'danieldixon', 'Dixon', 'danieldixon@docker.localhost', 'Daniel', NULL),
('mialopez', 'mialopez', 'Lopez', 'mialopez@docker.localhost', 'Mia', NULL),
('ethanjackson', 'ethanjackson', 'Jackson', 'ethanjackson@docker.localhost', 'Ethan', NULL),
('oliviaroberts', 'oliviaroberts', 'Roberts', 'oliviaroberts@docker.localhost', 'Olivia', NULL),
('jamessmith', 'jamessmith', 'Smith', 'jamessmith@docker.localhost', 'James', NULL),
('sophiathomas', 'sophiathomas', 'Thomas', 'sophiathomas@docker.localhost', 'Sophia', NULL),
('benjaminclark', 'benjaminclark', 'Clark', 'benjaminclark@docker.localhost', 'Benjamin', NULL),
('avamartin', 'avamartin', 'Martin', 'avamartin@docker.localhost', 'Ava', NULL),
('williamrogers', 'williamrogers', 'Rogers', 'williamrogers@docker.localhost', 'William', NULL),
('emmawright', 'emmawright', 'Wright', 'emmawright@docker.localhost', 'Emma', NULL),
('chloescott', 'chloescott', 'Scott', 'chloescott@docker.localhost', 'Chloe', NULL),
('danieltaylor', 'danieltaylor', 'Taylor', 'danieltaylor@docker.localhost', 'Daniel', NULL),
('sophiarichardson', 'sophiarichardson', 'Richardson', 'sophiarichardson@docker.localhost', 'Sophia', NULL),
('henryjones', 'henryjones', 'Jones', 'henryjones@docker.localhost', 'Henry', NULL),
('gracelewis', 'gracelewis', 'Lewis', 'gracelewis@docker.localhost', 'Grace', NULL),
('samuelharris', 'samuelharris', 'Harris', 'samuelharris@docker.localhost', 'Samuel', NULL),
('ameliahall', 'ameliahall', 'Hall', 'ameliahall@docker.localhost', 'Amelia', NULL),
('lucyedwards', 'lucyedwards', 'Edwards', 'lucyedwards@docker.localhost', 'Lucy', NULL),
('christophermiller', 'christophermiller', 'Miller', 'christophermiller@docker.localhost', 'Christopher', NULL),
('emilyperez', 'emilyperez', 'Perez', 'emilyperez@docker.localhost', 'Emily', NULL),
('andrewcook', 'andrewcook', 'Cook', 'andrewcook@docker.localhost', 'Andrew', NULL),
('oliviaparker', 'oliviaparker', 'Parker', 'oliviaparker@docker.localhost', 'Olivia', NULL),
('josephmartin', 'josephmartin', 'Martin', 'josephmartin@docker.localhost', 'Joseph', NULL),
('lilybrown', 'lilybrown', 'Brown', 'lilybrown@docker.localhost', 'Lily', NULL),
('elizabethlee', 'elizabethlee', 'Lee', 'elizabethlee@docker.localhost', 'Elizabeth', NULL),
('ethangreen', 'ethangreen', 'Green', 'ethangreen@docker.localhost', 'Ethan', NULL),
('noahroberts', 'noahroberts', 'Roberts', 'noahroberts@docker.localhost', 'Noah', NULL),
('gracegarcia', 'gracegarcia', 'Garcia', 'gracegarcia@docker.localhost', 'Grace', NULL),
('avaclark', 'avaclark', 'Clark', 'avaclark@docker.localhost', 'Ava', NULL),
('sophiedavis', 'sophiedavis', 'Davis', 'sophiedavis@docker.localhost', 'Sophie', NULL),
('benjaminharrison', 'benjaminharrison', 'Harrison', 'benjaminharrison@docker.localhost', 'Benjamin', NULL);
EOSQL
