FROM node:20-alpine

# Устанавливаем необходимые пакеты
RUN apk update && apk add --no-cache \
    openssh-client \
    sshpass \
    curl \
    wget \
    docker-cli \
    ca-certificates

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Создаем SSH директорию для root с правильными правами
RUN mkdir -p /root/.ssh && \
    chmod 700 /root/.ssh && \
    touch /root/.ssh/config && \
    chmod 600 /root/.ssh/config

# Оставляем root для доступа к Docker socket
# USER webssh

# Открываем порт
EXPOSE 3000

# Команда запуска
CMD ["npm", "start"]
