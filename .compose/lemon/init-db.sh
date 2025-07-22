#!/usr/bin/env bash
# vim: set filetype=sh ts=2 sw=2 sts=2 expandtab :

echo "Inflating Authentication Database (lemon.db)."

# Create the users table if it doesn't already exist
sqlite3 lemon.db "CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT,
    sn TEXT,
    mail TEXT,
    givenname TEXT,
    mobile TEXT,
    isadmin INTEGER DEFAULT 0,
    isblocked INTEGER DEFAULT 0
);"
[[ "$?" == '0' ]] && echo "Table 'users' created or already exists." || { echo "Error creating table 'users'. Exiting."; exit 1; }

# Create unique indexes for frequently searched fields
# Note: The UNIQUE constraint on 'mail' above handles its uniqueness.
sqlite3 lemon.db "CREATE UNIQUE INDEX IF NOT EXISTS u__username ON users (username);"
[[ "$?" == '0' ]] && echo "Index 'u__username' created or already exists." || { echo "Error creating index 'u__username'. Exiting."; exit 1; }

sqlite3 lemon.db "CREATE UNIQUE INDEX IF NOT EXISTS u__mail ON users (mail);"
[[ "$?" == '0' ]] && echo "Index 'u__mail' created or already exists." || { echo "Error creating index 'u__mail'. Exiting."; exit 1; }

sqlite3 lemon.db "CREATE UNIQUE INDEX IF NOT EXISTS u__mobile ON users (mobile);"
[[ "$?" == '0' ]] && echo "Index 'u__mobile' created or already exists." || { echo "Error creating index 'u__mobile'. Exiting."; exit 1; }

echo "Inserting user data..."

# Insert user data matching the PostgreSQL schema
# Using INSERT OR IGNORE to skip rows that would violate unique constraints (e.g., duplicate emails)
# Derivation Logic:
#   givenname: Use 'givenName' from LDIF if present. Otherwise, use the first word of 'cn'.
#   sn: If 'cn' has multiple words, use the last word of 'cn'. Otherwise, use 'sn' from LDIF if present, else NULL.
sqlite3 lemon.db "INSERT OR IGNORE INTO users (username, password, givenname, sn, mail, mobile) VALUES
('dwho', 'dwho', 'Doctor', 'Who', 'dwho@docker.localhost', '+33612345678'),
('rtyler', 'rtyler', 'R.', 'Tyler', 'rtyler@docker.localhost', '+11234567890'),
('jbinks', 'jbinks', 'Jar Jar', 'Binks', 'jbinks@docker.localhost', '+84123456789'),
('msmith', 'msmith', 'Mr', 'Smith', 'msmith@docker.localhost', NULL),
('okenobi', 'okenobi', 'Obi-Wan', 'Kenobi', 'okenobi@docker.localhost', NULL),
('qjinn', 'qjinn', 'Qui-Gon', 'Jinn', 'qjinn@docker.localhost', NULL),
('chewbacca', 'chewbacca', 'Chewbacca', 'Chewbacca', 'chewbacca@docker.localhost', NULL),
('lorgana', 'lorgana', 'Leia', 'Organa', 'lorgana@docker.localhost', NULL),
('pamidala', 'pamidala', 'Padme', 'Amidala', 'pamidala@docker.localhost', NULL),
('cdooku', 'cdooku', 'Comte', 'Dooku', 'cdooku@docker.localhost', NULL),
('kren', 'kren', 'Kylo', 'Ren', 'kren@docker.localhost', NULL),
('dmaul', 'dmaul', 'Dark', 'Maul', 'dmaul@docker.localhost', NULL),
('askywalker', 'askywalker', 'Anakin', 'Skywalker', 'askywalker@docker.localhost', NULL),
('bfett', 'bfett', 'Boba', 'Fett', 'bfett@docker.localhost', NULL),
('jfett', 'jfett', 'Jango', 'Ffett', 'jfett@docker.localhost', NULL),
('lskywalker', 'lskywalker', 'Luc', 'Skywalker', 'lskywalker@docker.localhost', NULL),
('myoda', 'myoda', 'Master', 'Yoda', 'myoda@docker.localhost', NULL),
('hsolo', 'hsolo', 'Han', 'Solo', 'hsolo@docker.localhost', NULL),
('r2d2', 'r2d2', 'R2D2', 'R2D2', 'r2d2@docker.localhost', NULL),
('c3po', 'c3po', 'C3PO', 'C3po', 'c3po@docker.localhost', NULL),
('synapseadmin', 'synapseadmin', 'Synapse', 'Syadmin', 'synapseadmin@docker.localhost', NULL),
('annasmith', 'annasmith', 'Anna', 'Smith', 'annasmith@docker.localhost', NULL),
('johnjohnson', 'johnjohnson', 'John', 'Johnson', 'johnjohnson@docker.localhost', NULL),
('emilybrown', 'emilybrown', 'Emily', 'Brown', 'emilybrown@docker.localhost', NULL),
('daviddavis', 'daviddavis', 'David', 'Davis', 'daviddavis@docker.localhost', NULL),
('sarahwilson', 'sarahwilson', 'Sarah', 'Wilson', 'sarahwilson@docker.localhost', NULL),
('miketaylor', 'miketaylor', 'Mike', 'Taylor', 'miketaylor@docker.localhost', NULL),
('graceadams', 'graceadams', 'Grace', 'Adams', 'graceadams@docker.localhost', NULL),
('mattmoore', 'mattmoore', 'Matt', 'Moore', 'mattmoore@docker.localhost', NULL),
('lilyparker', 'lilyparker', 'Lily', 'Parker', 'lilyparker@docker.localhost', NULL),
('danieldixon', 'danieldixon', 'Daniel', 'Dixon', 'danieldixon@docker.localhost', NULL),
('mialopez', 'mialopez', 'Mia', 'Lopez', 'mialopez@docker.localhost', NULL),
('ethanjackson', 'ethanjackson', 'Ethan', 'Jackson', 'ethanjackson@docker.localhost', NULL),
('oliviaroberts', 'oliviaroberts', 'Olivia', 'Roberts', 'oliviaroberts@docker.localhost', NULL),
('jamessmith', 'jamessmith', 'James', 'Smith', 'jamessmith@docker.localhost', NULL),
('sophiathomas', 'sophiathomas', 'Sophia', 'Thomas', 'sophiathomas@docker.localhost', NULL),
('benjaminclark', 'benjaminclark', 'Benjamin', 'Clark', 'benjaminclark@docker.localhost', NULL),
('avamartin', 'avamartin', 'Ava', 'Martin', 'avamartin@docker.localhost', NULL),
('williamrogers', 'williamrogers', 'William', 'Rogers', 'williamrogers@docker.localhost', NULL),
('emmawright', 'emmawright', 'Emma', 'Wright', 'emmawright@docker.localhost', NULL),
('chloescott', 'chloescott', 'Chloe', 'Scott', 'chloescott@docker.localhost', NULL),
('danieltaylor', 'danieltaylor', 'Daniel', 'Taylor', 'danieltaylor@docker.localhost', NULL),
('sophiarichardson', 'sophiarichardson', 'Sophia', 'Richardson', 'sophiarichardson@docker.localhost', NULL),
('henryjones', 'henryjones', 'Henry', 'Jones', 'henryjones@docker.localhost', NULL),
('gracelewis', 'gracelewis', 'Lewis', 'gracelewis@docker.localhost', 'Grace', NULL),
('samuelharris', 'samuelharris', 'Harris', 'samuelharris@docker.localhost', 'Samuel', NULL),
('ameliahall', 'ameliahall', 'Amelia', 'Hall', 'ameliahall@docker.localhost', NULL),
('lucyedwards', 'lucyedwards', 'Edwards', 'lucyedwards@docker.localhost', 'Lucy', NULL),
('christophermiller', 'christophermiller', 'Miller', 'christophermiller@docker.localhost', 'Christopher', NULL),
('emilyperez', 'emilyperez', 'Perez', 'emilyperez@docker.localhost', 'Emily', NULL),
('andrewcook', 'andrewcook', 'Andrew', 'Cook', 'andrewcook@docker.localhost', NULL),
('oliviaparker', 'oliviaparker', 'Parker', 'oliviaparker@docker.localhost', 'Olivia', NULL),
('josephmartin', 'josephmartin', 'Joseph', 'Martin', 'josephmartin@docker.localhost', NULL),
('lilybrown', 'lilybrown', 'Brown', 'lilybrown@docker.localhost', 'Lily', NULL),
('elizabethlee', 'elizabethlee', 'Lee', 'elizabethlee@docker.localhost', 'Elizabeth', NULL),
('ethangreen', 'ethangreen', 'Green', 'ethangreen@docker.localhost', 'Ethan', NULL),
('noahroberts', 'noahroberts', 'Noah', 'Roberts', 'noahroberts@docker.localhost', NULL),
('gracegarcia', 'gracegarcia', 'Garcia', 'gracegarcia@docker.localhost', 'Grace', NULL),
('avaclark', 'avaclark', 'Clark', 'avaclark@docker.localhost', 'Ava', NULL),
('sophiedavis', 'sophiedavis', 'Davis', 'sophiedavis@docker.localhost', 'Sophie', NULL),
('benjaminharrison', 'benjaminharrison', 'Harrison', 'benjaminharrison@docker.localhost', 'Benjamin', NULL);
"
[[ "$?" == '0' ]] && echo "All user data inserted successfully (or ignored if duplicates existed)." || { echo "Error inserting user data. Exiting."; exit 1; }

echo "Database setup complete: lemon.db"
