# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

FROM node:20-slim

# Добавляем метки для авторских прав
LABEL maintainer="Тарабанов Александр Викторович <info@hb3-accelerator.com>"
LABEL copyright="Copyright (c) 2024-2025 Тарабанов Александр Викторович"
LABEL license="Proprietary"
LABEL website="https://hb3-accelerator.com"

WORKDIR /app

# Устанавливаем системные зависимости для компиляции нативных модулей Node.js
# Устанавливаем базовые пакеты отдельно от компиляторов для большей надежности
RUN echo 'Acquire::Retries "10";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::http::Timeout "60";' >> /etc/apt/apt.conf.d/80-retries && \
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

# Docker CLI НЕ устанавливаем - используем Docker Socket + dockerode SDK

COPY package.json yarn.lock ./
RUN yarn config set npmRegistryServer https://registry.npmjs.org \
    && yarn config set registry https://registry.npmjs.org \
    && yarn config set network-timeout 600000 \
    && yarn install

COPY . .

EXPOSE 8000

CMD ["yarn", "run", "start"] 