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
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем Docker CLI
RUN curl -fsSL https://get.docker.com | sh

# Создаем пользователя для безопасности
ARG WEBSSH_UID=1000
ARG WEBSSH_GID=1000
RUN if getent group ${WEBSSH_GID} >/dev/null; then \
      groupmod -n webssh "$(getent group ${WEBSSH_GID} | cut -d: -f1)"; \
    else \
      groupadd -g ${WEBSSH_GID} webssh; \
    fi && \
    if getent passwd ${WEBSSH_UID} >/dev/null; then \
      usermod -l webssh -d /home/webssh -m "$(getent passwd ${WEBSSH_UID} | cut -d: -f1)"; \
    else \
      useradd -m -u ${WEBSSH_UID} -g webssh -s /bin/bash webssh; \
    fi

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

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["yarn", "start"]
