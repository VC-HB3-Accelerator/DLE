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
RUN apt-get update && \
    apt-get install -y --fix-missing \
        python3 \
        make \
        curl \
        ca-certificates \
        openssh-client \
        sshpass && \
    apt-get install -y --fix-missing g++ || \
    (sleep 10 && apt-get update && apt-get install -y --fix-missing g++) && \
    rm -rf /var/lib/apt/lists/*

# Docker CLI НЕ устанавливаем - используем Docker Socket + dockerode SDK

COPY package.json yarn.lock ./
RUN yarn config set npmRegistryServer https://registry.npmjs.org \
    && yarn config set registry https://registry.npmjs.org \
    && yarn config set network-timeout 600000 \
    && yarn install --frozen-lockfile

COPY . .

EXPOSE 8000

CMD ["yarn", "run", "dev"] 