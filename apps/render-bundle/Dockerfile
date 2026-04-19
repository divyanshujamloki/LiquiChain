# Minimal hosted chain for Render (extend with bot + R2 per BLUEPRINT §14)
FROM ghcr.io/foundry-rs/foundry:latest

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends supervisor nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/render-bundle/supervisord.conf /etc/supervisord.conf
COPY apps/render-bundle/scripts /app/apps/render-bundle/scripts

ENV HOSTED_CHAIN_ID=1337421
ENV PORT=10000

EXPOSE 10000

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
