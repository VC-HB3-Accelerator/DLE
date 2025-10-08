#!/bin/bash
# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

# Вывод цветного текста
print_green() {
  echo -e "\e[32m$1\e[0m"
}

print_blue() {
  echo -e "\e[34m$1\e[0m"
}

print_yellow() {
  echo -e "\e[33m$1\e[0m"
}

print_red() {
  echo -e "\e[31m$1\e[0m"
}

# Проверка и установка Docker и Docker Compose
check_docker() {
  print_blue "Проверка наличия Docker..."
  if ! command -v docker &> /dev/null; then
    print_yellow "Docker не установлен."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
      print_blue "Автоматическая установка Docker для Linux..."
      curl -fsSL https://get.docker.com -o get-docker.sh
      sudo sh get-docker.sh
      rm get-docker.sh
      
      # Добавляем текущего пользователя в группу docker
      print_blue "Добавление пользователя в группу docker..."
      sudo usermod -aG docker $USER
      
      print_green "Docker установлен!"
      print_yellow "⚠️  ВАЖНО: Для применения изменений выполните одну из команд:"
      print_yellow "   1. newgrp docker  (применить в текущем терминале)"
      print_yellow "   2. Перезапустите терминал"
      print_yellow "   3. Перезайдите в систему"
      print_blue "Нажмите Enter для продолжения после выполнения команды..."
      read
    else
      print_yellow "Пожалуйста, установите Docker вручную: https://docs.docker.com/get-docker/"
      print_yellow "Для Windows/Mac: скачайте и установите Docker Desktop."
      exit 1
    fi
  fi
  
  # Проверка прав доступа к Docker
  if ! docker ps &> /dev/null; then
    print_yellow "⚠️  Нет прав для запуска Docker команд."
    print_blue "Добавление пользователя в группу docker..."
    
    # Проверяем, есть ли пользователь в группе docker
    if ! groups $USER | grep -q docker; then
      sudo usermod -aG docker $USER
      print_yellow "Пользователь добавлен в группу docker."
      print_yellow "Выполните команду для применения изменений: newgrp docker"
      print_yellow "Или перезапустите терминал и запустите скрипт снова."
      exit 0
    else
      print_red "Пользователь уже в группе docker, но права не работают."
      print_yellow "Попробуйте:"
      print_yellow "  1. newgrp docker"
      print_yellow "  2. Перезайдите в систему"
      print_yellow "  3. Перезапустите Docker: sudo systemctl restart docker"
      exit 1
    fi
  fi
  
  print_green "Docker установлен и доступен."

  print_blue "Проверка Docker Compose..."
  if ! docker compose version &> /dev/null; then
    print_yellow "Docker Compose не установлен или требуется обновление."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
      print_blue "Установка Docker Compose плагина..."
      sudo apt-get update
      sudo apt-get install -y docker-compose-plugin
      
      if ! docker compose version &> /dev/null; then
        print_red "Не удалось установить Docker Compose плагин."
        print_yellow "Попробуйте обновить Docker: https://docs.docker.com/compose/install/"
        exit 1
      fi
    else
      print_yellow "Пожалуйста, установите Docker Compose вручную: https://docs.docker.com/compose/install/"
      exit 1
    fi
  fi
  print_green "Docker Compose установлен."
}

# Инструкция для пользователей без git
print_no_git_instructions() {
  print_blue "Если у вас нет git, скачайте архив проекта с GitHub:"
  print_yellow "1. Перейдите на https://github.com/VC-HB3-Accelerator/DLE"
  print_yellow "2. Нажмите 'Code' > 'Download ZIP'"
  print_yellow "3. Распакуйте архив и перейдите в папку проекта"
  print_yellow "4. Запустите этот скрипт: ./setup.sh"
}

# Все настройки хранятся в зашифрованной базе данных

# Создание ключа шифрования
create_encryption_key() {
  print_blue "Проверка ключа шифрования..."
  
  # Проверяем наличие OpenSSL
  if ! command -v openssl &> /dev/null; then
    print_yellow "OpenSSL не установлен. Установка..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
      sudo apt-get update && sudo apt-get install -y openssl
    else
      print_red "Пожалуйста, установите OpenSSL вручную: https://www.openssl.org/"
      exit 1
    fi
  fi
  
  # Создаём папку для ключей
  mkdir -p ./ssl/keys
  
  # Генерируем ключ шифрования (если его нет)
  if [ ! -f "./ssl/keys/full_db_encryption.key" ]; then
    print_blue "🔑 Генерация ключа шифрования..."
    openssl rand -base64 32 > ./ssl/keys/full_db_encryption.key
    chmod 600 ./ssl/keys/full_db_encryption.key
    print_green "✅ Ключ создан: ./ssl/keys/full_db_encryption.key"
  else
    print_green "✅ Ключ шифрования уже существует."
  fi
}

# Предварительная загрузка образов
pull_images() {
  print_blue "Предварительная загрузка образов Docker..."
  
  images=("node:20-slim" "postgres:16" "ollama/ollama:latest")
  
  for img in "${images[@]}"; do
    print_blue "Загрузка образа: $img"
    docker pull $img
    if [ $? -ne 0 ]; then
      print_yellow "Предупреждение: Не удалось загрузить образ $img, но продолжаем работу..."
    else
      print_green "Образ $img успешно загружен."
    fi
  done
}





# Запуск проекта
start_project() {
  print_blue "Запуск проекта..."
  
  # Сначала убедимся, что предыдущие контейнеры остановлены
  print_blue "Остановка существующих контейнеров..."
  docker compose down
  
  # Запуск сервисов в Docker Compose
  print_blue "Запуск сервисов (PostgreSQL, Ollama, Backend, Frontend)..."
  docker compose up -d
  
  # Проверяем, что сервисы запустились
  if [ $? -eq 0 ]; then
    print_green "Сервисы успешно запущены!"
    
    # Предзагрузка моделей Ollama
    print_blue "Предзагрузка моделей Ollama..."
    print_yellow "Это может занять несколько минут..."
    
    # Ждем, пока Ollama запустится
    print_blue "Ожидание запуска Ollama..."
    for i in {1..30}; do
      if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        print_green "Ollama готов!"
        break
      fi
      if [ $i -eq 30 ]; then
        print_yellow "Ollama не ответил за 60 секунд, продолжаем без предзагрузки..."
        break
      fi
      sleep 2
    done
    
    # Предзагружаем модели
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
      print_blue "Предзагрузка qwen2.5:7b..."
      curl -X POST http://localhost:11434/api/generate -d '{"model": "qwen2.5:7b", "prompt": "test", "stream": false}' > /dev/null 2>&1
      
      print_blue "Предзагрузка mxbai-embed-large:latest..."
      curl -X POST http://localhost:11434/api/generate -d '{"model": "mxbai-embed-large:latest", "prompt": "test", "stream": false}' > /dev/null 2>&1
      
      print_green "✅ Модели предзагружены и останутся в памяти!"
    fi
    
    # Добавляем токены аутентификации
    print_blue "🔑 Добавление токенов аутентификации..."
    ./scripts/internal/db/db_init_helper.sh 2>/dev/null || print_yellow "Токены уже добавлены или скрипт недоступен"
    
    # Создаём функции шифрования в PostgreSQL
    print_blue "📝 Создание функций шифрования в PostgreSQL..."
    docker exec dapp-postgres psql -U dapp_user -d dapp_db << 'EOF' 2>/dev/null || print_yellow "Функции шифрования уже существуют или БД не готова"
-- Создаём расширение для шифрования
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Функция для шифрования текста
CREATE OR REPLACE FUNCTION encrypt_text(data text, key text)
RETURNS text AS $$
BEGIN
    IF data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN encode(encrypt_iv(data::bytea, decode(key, 'base64'), decode('000102030405060708090A0B0C0D0E0F', 'hex'), 'aes-cbc'), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Функция для расшифровки текста
CREATE OR REPLACE FUNCTION decrypt_text(encrypted_data text, key text)
RETURNS text AS $$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN convert_from(decrypt_iv(decode(encrypted_data, 'base64'), decode(key, 'base64'), decode('000102030405060708090A0B0C0D0E0F', 'hex'), 'aes-cbc'), 'utf8');
END;
$$ LANGUAGE plpgsql;

-- Функция для шифрования JSON
CREATE OR REPLACE FUNCTION encrypt_json(data jsonb, key text)
RETURNS text AS $$
BEGIN
    IF data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN encode(encrypt_iv(data::text::bytea, decode(key, 'base64'), decode('000102030405060708090A0B0C0D0E0F', 'hex'), 'aes-cbc'), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Функция для расшифровки JSON
CREATE OR REPLACE FUNCTION decrypt_json(encrypted_data text, key text)
RETURNS jsonb AS $$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN convert_from(decrypt_iv(decode(encrypted_data, 'base64'), decode(key, 'base64'), decode('000102030405060708090A0B0C0D0E0F', 'hex'), 'aes-cbc'), 'utf8')::jsonb;
END;
$$ LANGUAGE plpgsql;
EOF
    
    print_green "----------------------------------------"
    print_green "Проект Digital_Legal_Entity(DLE) доступен по адресам:"
    print_green "Frontend: http://localhost:5173"
    print_green "Backend API: http://localhost:8000"
    print_green "Ollama API: http://localhost:11434"
    print_green "PostgreSQL: localhost:5432"
    print_green "----------------------------------------"
    print_green "🔐 Ключ шифрования: ./ssl/keys/full_db_encryption.key"
    print_green "📋 Все настройки хранятся в зашифрованной базе данных"
    print_green "----------------------------------------"
    print_green "ИИ-ассистент готов к работе!"
    print_green "----------------------------------------"
  else
    print_red "Произошла ошибка при запуске сервисов."
    print_yellow "Проверьте логи командой: docker compose logs"
    print_yellow "Для просмотра логов конкретного сервиса: docker compose logs [service]"
    print_yellow "Например: docker compose logs backend"
  fi
}

# Основная функция
main() {
  print_blue "==============================================="
  print_blue "   Установка и запуск Digital_Legal_Entity(DLE)"
  print_blue "==============================================="

  print_yellow "\nЕсли у вас нет git, скачайте проект архивом с GitHub!"
  print_no_git_instructions

  check_docker
  create_encryption_key
  pull_images
  start_project
}

# Запуск основной функции
main 