# syntax=docker/dockerfile:1
FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
WORKDIR /etc/nginx
LABEL org.opencontainers.image.source="https://github.com/Thienry18/PortalAkademikGajahMada-DevOps"
COPY docker/gateway/default.conf /etc/nginx/conf.d/default.conf
USER 101
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=6 CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
