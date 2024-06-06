#!/bin/sh
set -e

DATABASE=${PG_DATABASE:-lemonldapng}
USER=${PG_USER:-lemonldap}
PASSWORD=${PG_PASSWORD:-lemonldap}
TABLE=${PG_TABLE:-lmConfig}
PTABLE=${PG_PERSISTENT_SESSIONS_TABLE:-psessions}
STABLE=${PG_SESSIONS_TABLE:-sessions}
SAMLTABLE=${PG_SAML_TABLE:-samlsessions}
OIDCTABLE=${PG_OIDC_TABLE:-oidcsessions}
CASTABLE=${PG_CAS_TABLE:-cassessions}

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE USER $USER PASSWORD '$PASSWORD';
	CREATE DATABASE $DATABASE;
EOSQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DATABASE" <<-EOSQL
	CREATE TABLE $TABLE (
		cfgNum integer not null primary key,
		data text
	);
	GRANT ALL PRIVILEGES ON TABLE $TABLE TO $USER;

	CREATE TABLE $PTABLE (
		id varchar(64) not null primary key,
		a_session jsonb
	);
	CREATE INDEX i_p__session_kind    ON psessions ((a_session ->> '_session_kind'));
	CREATE INDEX i_p__httpSessionType ON psessions ((a_session ->> '_httpSessionType'));
	CREATE INDEX i_p__session_uid     ON psessions ((a_session ->> '_session_uid'));
	CREATE INDEX i_p_ipAddr           ON psessions ((a_session ->> 'ipAddr'));
	CREATE INDEX i_p__whatToTrace     ON psessions ((a_session ->> '_whatToTrace'));
	GRANT ALL PRIVILEGES ON TABLE $PTABLE TO $USER;

	CREATE UNLOGGED TABLE $STABLE (
		id varchar(64) not null primary key,
		a_session jsonb
	);
	CREATE INDEX i_s__whatToTrace     ON sessions ((a_session ->> '_whatToTrace'));
	CREATE INDEX i_s__session_kind    ON sessions ((a_session ->> '_session_kind'));
	CREATE INDEX i_s__utime           ON sessions ((cast (a_session ->> '_utime' as bigint)));
	CREATE INDEX i_s_ipAddr           ON sessions ((a_session ->> 'ipAddr'));
	CREATE INDEX i_s__httpSessionType ON sessions ((a_session ->> '_httpSessionType'));
	CREATE INDEX i_s_user             ON sessions ((a_session ->> 'user'));
	GRANT ALL PRIVILEGES ON TABLE $STABLE TO $USER;

	CREATE UNLOGGED TABLE $SAMLTABLE (
	    id varchar(64) not null primary key,
	    a_session jsonb
	);
	CREATE INDEX i_a__session_kind ON $SAMLTABLE ((a_session ->> '_session_kind'));
	CREATE INDEX i_a__utime        ON $SAMLTABLE ((cast(a_session ->> '_utime' as bigint)));
	CREATE INDEX i_a_ProxyID       ON $SAMLTABLE ((a_session ->> 'ProxyID'));
	CREATE INDEX i_a__nameID       ON $SAMLTABLE ((a_session ->> '_nameID'));
	CREATE INDEX i_a__assert_id    ON $SAMLTABLE ((a_session ->> '_assert_id'));
	CREATE INDEX i_a__art_id       ON $SAMLTABLE ((a_session ->> '_art_id'));
	CREATE INDEX i_a__saml_id      ON $SAMLTABLE ((a_session ->> '_saml_id'));
	GRANT ALL PRIVILEGES ON TABLE $SAMLTABLE TO $USER;

	CREATE UNLOGGED TABLE $OIDCTABLE (
	    id varchar(64) not null primary key,
	    a_session jsonb
	);
	CREATE INDEX i_o__session_kind ON $OIDCTABLE ((a_session ->> '_session_kind'));
	CREATE INDEX i_o__utime        ON $OIDCTABLE ((cast(a_session ->> '_utime' as bigint )));
	GRANT ALL PRIVILEGES ON TABLE $OIDCTABLE TO $USER;

	CREATE UNLOGGED TABLE $CASTABLE (
	    id varchar(64) not null primary key,
	    a_session jsonb
	);
	CREATE INDEX i_c__session_kind ON $CASTABLE ((a_session ->> '_session_kind'));
	CREATE INDEX i_c__utime        ON $CASTABLE ((cast(a_session ->> '_utime' as bigint)));
	CREATE INDEX i_c__cas_id       ON $CASTABLE ((a_session ->> '_cas_id'));
	CREATE INDEX i_c_pgtIou        ON $CASTABLE ((a_session ->> 'pgtIou'));
	GRANT ALL PRIVILEGES ON TABLE $CASTABLE TO $USER;
EOSQL

if test -e /llng-conf/conf.json; then
	SERIALIZED=`perl -MJSON -e '$/=undef;
		open F, "/llng-conf/conf.json" or die $!;
		$a=JSON::from_json(<F>);
		$a->{cfgNum}=1;
		$a=JSON::to_json($a);
		$a=~s/'\''/'\'\''/g;
		$a =~ s/\\\\/\\\\\\\\/g;
		print $a;'`
	echo "set val '$SERIALIZED'" >&2
	psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DATABASE" <<-EOSQL
	\\set val '$SERIALIZED'
	INSERT INTO $TABLE (cfgNum, data) VALUES (1, :'val');
	\\unset val
EOSQL
fi
