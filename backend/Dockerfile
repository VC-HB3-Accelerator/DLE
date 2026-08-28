# Copyright (c) 2024-2026 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

# Copyright (c) 2024-2026 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

FROM node:20-slim

# Добавляем метки для авторских прав
LABEL maintainer="Тарабанов Александр Викторович <info@hb3-accelerator.com>"
LABEL copyright="Copyright (c) 2024-2026 Тарабанов Александр Викторович"
LABEL license="Proprietary"
LABEL website="https://hb3-accelerator.com"

WORKDIR /app

# Устанавливаем системные зависимости для компиляции нативных модулей Node.js
# HTTPS: на части VDS исходящий :80 к deb.debian.org таймаутится, :443 проходит.
# Базовые пакеты отдельно от компиляторов — так надёжнее при обрывах зеркала.
RUN find /etc/apt -type f \( -name '*.list' -o -name '*.sources' \) -exec \
        sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g' {} + && \
    echo 'Acquire::Retries "10";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::http::Timeout "60";' >> /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::https::Timeout "60";' >> /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::ftp::Timeout "60";' >> /etc/apt/apt.conf.d/80-retries && \
    for i in 1 2 3 4 5; do \
        apt-get update && break || sleep 15; \
    done && \
    apt-get install -y --no-install-recommends \
        python3 \
        make \
        curl \
        ca-certificates \
        openssh-client \
        sshpass && \
    (apt-get install -y --no-install-recommends gcc-12 g++-12 g++ || \
        (sleep 10 && apt-get update && apt-get install -y --no-install-recommends gcc-12 g++-12 g++)) && \
    apt-get install -f -y || true && \
    rm -rf /var/lib/apt/lists/* /etc/apt/apt.conf.d/80-retries

# Актуальный Docker CLI + Compose v2 (для update.sh / apply-here через /var/run/docker.sock).
# Пакет docker.io из Debian слишком старый (API 1.41) для Docker Engine 29 (min API 1.44).
COPY --from=docker:27-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker/compose-bin:v2.29.7 /docker-compose /usr/local/lib/docker/cli-plugins/docker-compose
RUN chmod +x /usr/local/bin/docker /usr/local/lib/docker/cli-plugins/docker-compose \
    && docker version --format 'client={{.Client.Version}}' || true

COPY package.json yarn.lock THIRD_PARTY_NOTICES.md ./
RUN yarn config set npmRegistryServer https://registry.npmjs.org \
    && yarn config set registry https://registry.npmjs.org \
    && yarn config set network-timeout 600000 \
    && yarn install --production --frozen-lockfile

COPY . .

EXPOSE 8000

CMD ["yarn", "run", "start"] 