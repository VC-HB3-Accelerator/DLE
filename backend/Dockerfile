FROM node:20-bullseye

WORKDIR /app

# Устанавливаем зависимости, включая Python для node-gyp
RUN apt-get update && apt-get install -y \
    python3 make g++ cmake openssl libssl-dev \
    ca-certificates curl gnupg lsb-release

RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

RUN echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

RUN apt-get update && apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

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