FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY src/ /srv/

EXPOSE 8080 8443
