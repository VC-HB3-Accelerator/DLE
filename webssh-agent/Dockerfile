FROM node:20-slim

# Устанавливаем необходимые пакеты
RUN apt-get update && apt-get install -y \
    openssh-client \
    sshpass \
    curl \
    wget \
    ca-certificates \
    python3 \
    make \
    g++ \
    tar \
    gzip \
    zip \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем Docker CLI
RUN curl -fsSL https://get.docker.com | sh

# Создаем пользователя для безопасности
RUN useradd -m -s /bin/bash webssh

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json
COPY package*.json ./

# Устанавливаем зависимости через yarn
RUN yarn install

# Копируем исходный код
COPY . .

# Создаем SSH директорию для пользователя
RUN mkdir -p /home/webssh/.ssh && \
    chmod 700 /home/webssh/.ssh && \
    touch /home/webssh/.ssh/config && \
    chmod 600 /home/webssh/.ssh/config && \
    chown -R webssh:webssh /home/webssh/.ssh

# Добавляем пользователя в группу docker
RUN usermod -aG docker webssh

# Переключаемся на пользователя
USER webssh

# Открываем порт
EXPOSE 3000

# Команда запуска
CMD ["yarn", "start"]
