FROM node:20-bullseye

WORKDIR /app

# Устанавливаем зависимости, включая Python для node-gyp
RUN apt-get update && apt-get install -y python3 make g++ cmake openssl libssl-dev

# Копируем package.json и yarn.lock для установки зависимостей
COPY package.json yarn.lock ./

# Устанавливаем зависимости
RUN yarn install --frozen-lockfile

# Копируем остальные файлы проекта
COPY . .

# Экспозим порт
EXPOSE 8000

# Команда запуска по умолчанию
CMD ["yarn", "run", "dev"] 