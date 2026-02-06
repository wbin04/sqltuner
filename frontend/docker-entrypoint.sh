#!/bin/sh
set -e

# Thay thế PORT trong nginx.conf bằng $PORT từ Cloud Run
if [ -n "$PORT" ]; then
    echo "Configuring Nginx to listen on port $PORT"
    sed -i "s/listen 8080;/listen $PORT;/g" /etc/nginx/conf.d/default.conf
fi

# Khởi động Nginx
echo "Starting Nginx..."
exec nginx -g 'daemon off;'
