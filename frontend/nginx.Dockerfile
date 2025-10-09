# Этап 1: Сборка frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app

# Копируем файлы зависимостей
COPY package.json yarn.lock ./

# Устанавливаем зависимости
RUN yarn install --frozen-lockfile

# Копируем исходный код
COPY . .

# Собираем frontend
RUN yarn build

# Этап 2: Nginx с готовым frontend
FROM nginx:alpine

# Устанавливаем curl для healthcheck
RUN apk add --no-cache curl

# Копируем собранный frontend из первого этапа
COPY --from=frontend-builder /app/dist/ /usr/share/nginx/html/

# Копируем конфигурацию nginx
COPY nginx-simple.conf /etc/nginx/nginx-ssl.conf.template
COPY nginx-local.conf /etc/nginx/nginx-local.conf.template

# Копируем скрипт запуска
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]