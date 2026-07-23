# Xray sidecar: SOCKS :1080 ← outbound из config.json (пишет backend из BlancVPN subscription)
FROM teddysun/xray:latest

USER root
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && mkdir -p /etc/xray

ENV CONFIG_DIR=/etc/xray
VOLUME ["/etc/xray"]
EXPOSE 1080

ENTRYPOINT ["/entrypoint.sh"]
