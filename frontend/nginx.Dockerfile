# Этап 1: Сборка frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app

# Копируем файлы зависимостей
COPY frontend/package.json frontend/yarn.lock ./

# Устанавливаем зависимости
RUN yarn install

# Копируем исходный код frontend и общий shared-модуль (SIWE statement)
COPY frontend/ .
COPY shared/ /shared/

# Собираем frontend
RUN yarn build

# Этап 2: Nginx с готовым frontend
FROM nginx:alpine

# Устанавливаем curl для healthcheck
RUN apk add --no-cache curl

# Копируем собранный frontend из первого этапа
COPY --from=frontend-builder /app/dist/ /usr/share/nginx/html/

# Копируем конфигурацию nginx
COPY frontend/nginx-simple.conf /etc/nginx/nginx-ssl.conf.template
COPY frontend/nginx-local.conf /etc/nginx/nginx-local.conf.template

# Копируем скрипт запуска
COPY frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]