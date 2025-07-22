# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

FROM node:20-alpine

# Добавляем метки для авторских прав
LABEL maintainer="Тарабанов Александр Викторович <info@hb3-accelerator.com>"
LABEL copyright="Copyright (c) 2024-2025 Тарабанов Александр Викторович"
LABEL license="Proprietary"
LABEL website="https://hb3-accelerator.com"

WORKDIR /app

# Устанавливаем дополнительные зависимости
RUN apk add --no-cache python3 make g++

# Копируем package.json и yarn.lock для установки зависимостей
COPY package.json yarn.lock ./

# Устанавливаем зависимости
RUN yarn install --frozen-lockfile

# Копируем остальные файлы проекта
COPY . .

# Экспозим порт
EXPOSE 5173

# Команда запуска по умолчанию
CMD ["yarn", "run", "dev"] 