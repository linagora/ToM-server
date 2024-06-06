#!/bin/sh
SCRIPT_PARENT_PATH=$( cd "$(dirname "$0")" ; pwd -P )
ADDITIONAL_PARAMS=""
COMMON_NAME=$1
if [ "$1" = "-ip" ]; then
	COMMON_NAME=$2
	echo "subjectAltName = IP:$COMMON_NAME" > $SCRIPT_PARENT_PATH/openssl-ext.cnf
	ADDITIONAL_PARAMS="-extfile $SCRIPT_PARENT_PATH/openssl-ext.cnf"
fi

CERTIFICATE_KEY=$COMMON_NAME.key
CERTIFICATE_CRT=$COMMON_NAME.crt
CA_CRT_PATH=$SCRIPT_PARENT_PATH/nginx/ssl/ca.pem
CA_KEY_PATH=$SCRIPT_PARENT_PATH/nginx/ssl/ca.key

cd $SCRIPT_PARENT_PATH
openssl genrsa -out $CERTIFICATE_KEY 4096
openssl req \
	-new \
	-key $CERTIFICATE_KEY  \
	-nodes \
	-out server.csr \
	-subj "/C=FR/ST=Centre/L=Paris/O=Linagora/OU=IT/CN=$COMMON_NAME"
if [ ! -f "$CA_CRT_PATH" ]; then
  openssl genrsa -out ca.key 4096
	openssl req \
		-new \
		-x509 \
		-nodes \
		-days 36500 \
		-key ca.key \
		-out ca.pem \
		-subj "/C=AU/ST=Some-State/O=Internet Widgits Pty Ltd"
	mv ca.pem ca.key $SCRIPT_PARENT_PATH/nginx/ssl
fi
openssl x509 \
	-req \
	-in server.csr \
	-CAkey $CA_KEY_PATH \
	-CA $CA_CRT_PATH \
	-set_serial -01 \
	-out $CERTIFICATE_CRT \
	-days 36500 \
	-sha256 $ADDITIONAL_PARAMS
openssl verify -CAfile $CA_CRT_PATH $CERTIFICATE_CRT
mv $CERTIFICATE_KEY $CERTIFICATE_CRT $SCRIPT_PARENT_PATH/nginx/ssl
rm server.csr
if [ -f "openssl-ext.cnf" ]; then
	rm openssl-ext.cnf
fi