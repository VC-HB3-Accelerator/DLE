FROM node:20-alpine
WORKDIR /app
# Установка зависимостей
RUN npm install -g @upstash/context7-mcp@1.0.8
# Запуск сервера при старте контейнера
CMD ["context7-mcp"]