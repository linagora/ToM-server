#!/usr/bin/env sh
echo "TZ=$(timedatectl show | grep -Poh '(?<=^Timezone=).*')" | tee ./.compose/.env
echo "UID=$(id -u)" | tee -a ./.compose/.env
echo "GID=$(id -g)" | tee -a ./.compose/.env
