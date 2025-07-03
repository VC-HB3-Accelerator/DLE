FROM node:20-bookworm as nodebase

FROM ubuntu:24.04

WORKDIR /app

# Устанавливаем зависимости, включая Python для node-gyp
RUN apt-get update && apt-get install -y \
    python3 make g++ cmake openssl libssl-dev \
    ca-certificates curl gnupg lsb-release \
    build-essential python3-dev libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем Node.js 20 и yarn
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g yarn

# Копируем libnode.so.109 из node:20-bookworm
COPY --from=nodebase /usr/lib/x86_64-linux-gnu/libnode.so.109 /usr/lib/x86_64-linux-gnu/libnode.so.109

# Устанавливаем node-gyp глобально
RUN npm install -g node-gyp

# Копируем package.json и yarn.lock для установки зависимостей
COPY package.json yarn.lock ./

# Устанавливаем зависимости
RUN yarn install --frozen-lockfile

# ПРИНУДИТЕЛЬНО пересобираем hnswlib-node из исходников
RUN echo "Пересобираем hnswlib-node из исходников..." && \
    cd node_modules/hnswlib-node && \
    rm -rf build/ && \
    node-gyp rebuild --verbose

# Проверяем версию libstdc++ и наличие нужного символа
RUN echo "Версия libstdc++:" && strings /lib/x86_64-linux-gnu/libstdc++.so.6 | grep GLIBCXX | tail -5
RUN echo "Проверка GLIBCXX_3.4.32:" && strings /lib/x86_64-linux-gnu/libstdc++.so.6 | grep GLIBCXX_3.4.32 || echo "GLIBCXX_3.4.32 not found"

# Копируем остальные файлы проекта
COPY . .

# Экспозим порт
EXPOSE 8000

# Команда запуска по умолчанию
CMD ["yarn", "run", "dev"] 