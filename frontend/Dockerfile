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

# python3/make/g++ не нужны: у frontend нет native-модулей (node-gyp).
# apt-get к http://deb.debian.org:80 на VDS часто таймаутится.

# Копируем package.json и yarn.lock для установки зависимостей
COPY package.json yarn.lock ./

# Устанавливаем зависимости (длинный timeout — нестабильная сеть на VDS)
RUN yarn config set registry https://registry.npmjs.org \
    && yarn config set network-timeout 600000 \
    && yarn install --frozen-lockfile

# Копируем остальные файлы проекта
COPY . .

# Экспозим порт
EXPOSE 5173

# Команда запуска по умолчанию
CMD ["yarn", "run", "dev"] 