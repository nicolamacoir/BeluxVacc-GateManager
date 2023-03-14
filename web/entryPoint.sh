#!/bin/bash
set -e
read -r firstline < /usr/share/nginx/html/scripts.js
if [[ ! "$firstline" =~ .*hostname.* ]]; then
    echo "let hostname = \""${API_BASE_URL:='http://localhost:3000'}"\";" | cat - /usr/share/nginx/html/scripts.js > temp && mv temp /usr/share/nginx/html/scripts.js
fi
exec "$@"