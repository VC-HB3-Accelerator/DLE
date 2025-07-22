# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

FROM node:20-alpine
WORKDIR /app
# Установка зависимостей
RUN npm install -g @upstash/context7-mcp@1.0.8
# Запуск сервера при старте контейнера
CMD ["context7-mcp"]