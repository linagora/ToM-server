#!/bin/sh

# LemonLDAP::NG libraries

askString () {
	_READ=''
	while [ "$_READ" = "" ]
	do
		read -p "$1: " _READ
		#if test "$_READ" != ""; then
		#	echo OK
		#	break
		#fi
	done

	echo $_READ
}

# Default values, overriden by options

COOKIEJAR=~/.cache/llng-cookies
PROMPT=no
LLNG_SERVER="auth.example.com:19876"
PKCE=0
SCOPE='openid email profile'

# CURL clients

# ERREUR ICI !
client () {
	umask 0077
	curl -sk --user-agent 'LLNG-CLient/2.20.0' --cookie "$COOKIEJAR" \
		--cookie-jar "$COOKIEJAR" -H "Accept: application/json" "$@"
}

clientWeb () {
	umask 0077
	curl -sk --user-agent 'LLNG-CLient/2.20.0' --cookie "$COOKIEJAR" \
		--cookie-jar "$COOKIEJAR" -H "Accept: test/html" "$@"
}

uri_escape () {
	perl -MURI::Escape -e '$_=uri_escape($ARGV[0]);s/(?:\s|%20)+/+/g;print' "$1"
}

_authz () {
	if test "$CLIENT_ID" = "" ; then
		CLIENT_ID=$(askString 'Client ID')
	fi
	if test "$CLIENT_SECRET" != ""; then
		echo "--basic -u $CLIENT_ID:$CLIENT_SECRET"
	fi
}

check_install () {
	for _tool in jq openssl curl base64 grep sed; do
		which $_tool >/dev/null 2>&1
		[ $? -ne 0 ] && echo "Missing dependency: $_tool)" >&2 && exit 1
	done
	echo -n ''
}

build_llng_url () {
	perl -e '$ARGV[0]=~s#/+$##;$prefix = "https://";$prefix = $1 if $ARGV[0] =~ s#^(https?://)##;print "$prefix$ARGV[0]"' "$LLNG_SERVER"
}

# 1. LLNG Connection

llng_connect () {
	LLNG_CONNECTED=0
	if client -f $LLNG_URL >/dev/null 2>&1; then
		LLNG_CONNECTED=1
	
	# else try to authenticate
	else
		if test "$LLNG_LOGIN" = ""
		then
			LLNG_LOGIN=$(askString Login)
		fi
		
		if test "$PROMPT" = yes -o "$LLNG_PASSWORD" = ""
		then
			stty -echo
			LLNG_PASSWORD=$(askString Password)
			stty echo
			echo
		fi
	
		# Test if token is required
		echo $(client $LLNG_URL)
		TMP=$(client $LLNG_URL 2>/dev/null)
		echo "TMP : $TMP"
		TOKEN=''
		if echo "$TMP" | jq -r  ".token" >/dev/null 2>&1; then
			TOKEN="--data-urlencode token="$( echo "$TMP" | jq -r  ".token" )
		fi
	
		TMP=$(client -XPOST --data-urlencode "user=$LLNG_LOGIN" --data-urlencode "password=$LLNG_PASSWORD" $TOKEN $LLNG_URL)
		ID=''
		if echo "$TMP" | jq -r ".id" >/dev/null 2>&1; then
			LLNG_CONNECTED=1
			ID=$(echo "$TMP" | jq -r ".id")
		fi
		if test "$ID" = "null" -o "$ID" = ""; then
			echo "Unable to connect:" >&2
			echo "$TMP" >&2
			exit 1
		fi
	fi
}

whoami () {
	if test "$LLNG_CONNECTED" != 1; then
		llng_connect
	fi
	client "${LLNG_URL}/mysession/?whoami" | jq -r '.result'
}

getLanguages () {
	client "${LLNG_URL}/languages" | jq -S
}

getLlngId () {
	if test "$LLNG_CONNECTED" != 1; then
		llng_connect
	fi
	client -lv "${LLNG_URL}/session/my/?whoami" 2>&1 | grep -E '> *Cookie' | sed -e 's/.*Cookie: *//'
}

# 2. OIDC

_oidcmetadata () {
	client -f "${LLNG_URL}/.well-known/openid-configuration"
}

getOidcMetadata () {
	TMP=$(client -Sf "${LLNG_URL}/.well-known/openid-configuration")
	if test "$TMP" != ''; then
		echo $TMP | jq -S
	else
		exit 1
	fi
}

getOidcEndpoints () {
	TMP=$(_oidcmetadata || true)
	if test "$TMP" = ""; then
		export AUTHZ_ENDPOINT="${LLNG_URL}/oauth2/authorize"
		export TOKEN_ENDPOINT="${LLNG_URL}/oauth2/token"
		export ENDSESSION_ENDPOINT="${LLNG_URL}/oauth2/logout"
		export USERINFO_ENDPOINT="${LLNG_URL}/oauth2/userinfo"
		export INTROSPECTION_ENDPOINT="${LLNG_URL}/oauth2/introspect"
	else
		export AUTHZ_ENDPOINT=$(echo $TMP | jq -r .authorization_endpoint)
		export TOKEN_ENDPOINT=$(echo $TMP | jq -r .token_endpoint)
		export ENDSESSION_ENDPOINT=$(echo $TMP | jq -r .end_session_endpoint)
		export USERINFO_ENDPOINT=$(echo $TMP | jq -r .userinfo_endpoint)
		export INTROSPECTION_ENDPOINT=$(echo $TMP | jq -r .introspection_endpoint)
	fi
}

# 2.2 PKCE
getCodeVerifier () {
	tr -dc A-Za-z0-9 </dev/urandom | head -c 13
}

getCodeChallenge () {
	echo -n $1 | openssl dgst -binary -sha256 | sed -e "s/ *-$//" | base64 -w 500 | sed -e 's/\//_/g' -e 's/\+/-/g' -e 's/=*$//'
}

_queryToken () {
	if test "$AUTHZ_ENDPOINT" = "" -o "$TOKEN_ENDPOINT" = ""; then
		getOidcEndpoints
	fi
	if test "$LLNG_CONNECTED" != 1; then
		llng_connect
	fi
	CODE_VERIFIER=''
	CODE_CHALLENGE=''
	if test "$PKCE" = 1; then
		CODE_VERIFIER=$(getCodeVerifier)
		CODE_CHALLENGE='&code_challenge_method=S256&code_challenge='$(getCodeChallenge $CODE_VERIFIER)
		CODE_VERIFIER="-d code_verifier="$(uri_escape $CODE_VERIFIER)
	fi
	AUTHZ=$(_authz)
	if test "$REDIRECT_URI" = ""; then
		REDIRECT_URI=$(askString 'Redirect URI')
	fi
	REDIRECT_URI=redirect_uri=$(uri_escape "$REDIRECT_URI")
	_SCOPE=scope=$(uri_escape "${SCOPE}")
	TMP="${AUTHZ_ENDPOINT}?client_id=${CLIENT_ID}&${REDIRECT_URI}&response_type=code&${_SCOPE}${CODE_CHALLENGE}"
	_CODE=$(clientWeb -i $TMP | grep -i "^Location:" | sed -e "s/^.*code=//;s/&.*$//;s/\r//g")
	if test "$_CODE" = ""; then
		echo "Unable to get OIDC CODE, check your parameters" >&2
		echo "Tried with: $TMP" >&2
		exit 2
	fi

	# Get access token
	RAWTOKENS=$(client -XPOST -SsL -d "client_id=${CLIENT_ID}" \
		-d 'grant_type=authorization_code' \
		-d "$REDIRECT_URI" \
		-d "$_SCOPE" \
		$CODE_VERIFIER \
		$AUTHZ \
		--data-urlencode "code=$_CODE" \
		"$TOKEN_ENDPOINT")
	if echo "$RAWTOKENS" | grep access_token >/dev/null 2>&1; then
		LLNG_ACCESS_TOKEN=$(echo "$RAWTOKENS" | jq -r .access_token)
	else
		echo "Bad response:" >&2
		echo $RAWTOKENS >&2
		exit 3
	fi
	if echo "$RAWTOKENS" | grep id_token >/dev/null 2>&1; then
		LLNG_ID_TOKEN=$(echo "$RAWTOKENS" | jq -r .id_token)
	fi
	if echo "$RAWTOKENS" | grep refresh_token >/dev/null 2>&1; then
		LLNG_REFRESH_TOKEN=$(echo "$RAWTOKENS" | jq -r .refresh_token)
	fi
}

getOidcTokens () {
	if test "$RAWTOKENS" = ''; then
		_queryToken
	fi
	echo $RAWTOKENS | jq -S
}

getAccessToken () {
	if test "$LLNG_ACCESS_TOKEN" = ''; then
		_queryToken
	fi
	echo $LLNG_ACCESS_TOKEN
}

getIdToken () {
	if test "$LLNG_ID_TOKEN" = ''; then
		_queryToken
	fi
	echo $LLNG_ID_TOKEN
}

getRefreshToken () {
	if test "$LLNG_REFRESH_TOKEN" = ''; then
		_queryToken
	fi
	echo $LLNG_REFRESH_TOKEN
}

getUserInfo () {
	TOKEN=${1:-$LLNG_ACCESS_TOKEN}
	if test "$TOKEN" = ''; then
		_queryToken
		TOKEN="$LLNG_ACCESS_TOKEN"
	fi
	client -H "Authorization: Bearer $TOKEN"  "$USERINFO_ENDPOINT" | jq -S
}

getIntrospection () {
	TOKEN=${1:-$LLNG_ACCESS_TOKEN}
	if test "$TOKEN" = ''; then
		_queryToken
		TOKEN="$LLNG_ACCESS_TOKEN"
	fi
	AUTHZ=$(_authz)
	client $AUTHZ -d "token=$TOKEN" "$INTROSPECTION_ENDPOINT" | jq -S
}

_getMatrixToken () {
	if test "$MATRIX_SERVER" = ""; then
		MATRIX_SERVER=$(askString 'Matrix server')
	fi
	MATRIX_URL=${MATRIX_URL:-https://$MATRIX_SERVER}/_matrix/client
	if test "$MATRIX_TOKEN" = ""; then
		PROVIDER=$(client $MATRIX_URL/v3/login | jq -r .flows[0].identity_providers[0].id)
		if test "$LLNG_CONNECTED" != 1; then
			llng_connect
		fi
		_CONTENT=$(client -i --location "$MATRIX_URL/r0/login/sso/redirect/$PROVIDER?redirectUrl=http%3A%2F%2Flocalhost%3A9876")
		_LOGIN_TOKEN=$(echo $_CONTENT|perl -ne 'print $1 if/loginToken=(.*?)"/')
		if test "$_LOGIN_TOKEN" = ""; then
			echo "Unable to get matrix login_token" >&2
			echo $_CONTENT >&2
			exit 1
		fi
		_CONTENT=$(client -XPOST -d '{"initial_device_display_name":"Shell Test Client","token":"'"$_LOGIN_TOKEN"'","type":"m.login.token"}' "$MATRIX_URL/v3/login")
		MATRIX_TOKEN=$(echo $_CONTENT | jq -r .access_token)
		if test "$MATRIX_TOKEN" = "" -o "$MATRIX_TOKEN" = "null"; then
			echo "Unable to get matrix_token" >&2
			echo $_CONTENT >&2
			exit 1
		fi
	fi
}

getMatrixToken () {
	if test "$MATRIX_TOKEN" = ""; then
		_getMatrixToken
	fi
	echo $MATRIX_TOKEN
}

_getMatrixFederationToken () {
	if test "$MATRIX_SERVER" = ""; then
		MATRIX_SERVER=$(askString 'Matrix server')
	fi
	MATRIX_URL=${MATRIX_URL:-https://$MATRIX_SERVER}/_matrix/client
	MATRIX_TOKEN=${1:-$MATRIX_TOKEN}
	if test "$MATRIX_USER" = ""; then
		if test "$LLNG_LOGIN" = ""; then
			MATRIX_USER=$(askString 'Matrix username')
		else
			MATRIX_USER=@$LLNG_LOGIN:$(echo $LLNG_SERVER | perl -pe 's/.*?\.//')
		fi
	fi
	if test "$MATRIX_TOKEN" = ""; then
		_getMatrixToken
	fi
	_CONTENT=$(client -XPOST -H "Authorization: Bearer $MATRIX_TOKEN" -d '{}' "$MATRIX_URL/v3/user/$MATRIX_USER/openid/request_token")
	MATRIX_FEDERATION_TOKEN=$(echo $_CONTENT | jq -r .access_token)
}

getMatrixFederationToken () {
	_getMatrixFederationToken "$@"
	echo $MATRIX_FEDERATION_TOKEN
}

getAccessTokenFromMatrixToken () {
	MATRIX_TOKEN="$1"
	SUBJECT_ISSUER="$2"
	AUDIENCE="$3"
	_SCOPE=scope=$(uri_escape "${SCOPE}")
	if test "$MATRIX_TOKEN" = "" -o "$SUBJECT_ISSUER" = ""; then
		echo "Missing parameter" >&2
		exit 1
	fi
	if test "$TOKEN_ENDPOINT" = ""; then
		getOidcEndpoints
	fi
	AUTHZ=$(_authz)
	client -XPOST -fSsL \
		$AUTHZ \
		-d 'grant_type=urn:ietf:params:oauth:grant-type:token-exchange' \
		-d "client_id=$CLIENT_ID" \
		--data-urlencode "subject_token=$MATRIX_TOKEN" \
		-d "$_SCOPE" \
		--data-urlencode "subject_issuer=$SUBJECT_ISSUER" \
		--data-urlencode "audience=$AUDIENCE" \
		"$TOKEN_ENDPOINT" | jq -S
}
