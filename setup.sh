#!/bin/bash
# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

# Скрипт для автоматической установки шаблона приложения DLE
# Скачивает репозиторий, проверяет Docker, импортирует образы и тома, запускает приложение

# Цветной вывод
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

ARCHIVE_VERSION="v1.0.1"
ARCHIVE_BASE_URL="https://github.com/VC-HB3-Accelerator/DLE/releases/download/${ARCHIVE_VERSION}"
ARCHIVE_PARTS=(
  "dle-template.tar.gz.part-aa"
  "dle-template.tar.gz.part-ab"
  "dle-template.tar.gz.part-ac"
  "dle-template.tar.gz.part-ad"
)

# Проверка curl
check_curl() {
  print_blue "🔍 Проверка наличия curl..."
  if ! command -v curl &> /dev/null; then
    print_red "❌ Утилита curl не найдена!"
    print_yellow "Установите curl: https://curl.se/download.html"
    exit 1
  fi
  print_green "✅ curl установлен"
}

# Установка Docker
install_docker() {
  print_blue "📦 Установка Docker..."
  if curl -fsSL https://get.docker.com | bash; then
    print_green "✅ Docker установлен"
    systemctl enable docker 2>/dev/null || true
    systemctl start docker 2>/dev/null || true
    sleep 2
  else
    print_red "❌ Ошибка установки Docker"
    exit 1
  fi
}

# Проверка Docker
check_docker() {
  print_blue "🔍 Проверка Docker..."
  if ! command -v docker &> /dev/null; then
    print_yellow "⚠️  Docker не установлен. Начинаем установку..."
    install_docker
  fi
  
  if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_yellow "⚠️  Docker Compose не найден, но это нормально - используется встроенный docker compose"
  fi
  
  print_green "✅ Docker установлен и готов к работе"
}

# Проверка Docker запущен
check_docker_running() {
  print_blue "🔍 Проверка запуска Docker..."
  if ! docker info &> /dev/null; then
    print_red "❌ Docker не запущен!"
    print_yellow "Запустите Docker и повторите попытку"
    exit 1
  fi
  print_green "✅ Docker запущен"
}

# Скачивание репозитория
download_repo() {
  print_blue "📥 Скачивание репозитория..."
  if [ -d "DLE" ]; then
    print_yellow "⚠️  Папка DLE уже существует"
    read -p "Удалить существующую папку? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      rm -rf DLE
    else
      print_blue "Используем существующую папку"
      cd DLE
      return
    fi
  fi
  
  git clone https://github.com/VC-HB3-Accelerator/DLE.git
  cd DLE
  print_green "✅ Репозиторий скачан"
}

# Загрузка частей архива docker-data
download_archive_parts() {
  print_blue "📥 Загрузка docker-data из релиза..."

  local tmp_dir
  tmp_dir=$(mktemp -d)

  print_blue "Используем временную директорию: $tmp_dir"

  for part in "${ARCHIVE_PARTS[@]}"; do
    local url="${ARCHIVE_BASE_URL}/${part}"
    print_blue "⇣ Загрузка ${part}..."
    if ! curl -fL --retry 3 --continue-at - --output "${tmp_dir}/${part}" "${url}"; then
      print_red "❌ Не удалось скачать ${part}"
      print_yellow "Проверьте подключение к сети или доступность релиза ${ARCHIVE_VERSION}"
      rm -rf "${tmp_dir}"
      exit 1
    fi
  done

  print_blue "🧩 Сборка архива dle-template.tar.gz..."
  cat "${tmp_dir}"/dle-template.tar.gz.part-* > "${tmp_dir}/dle-template.tar.gz"

  print_blue "🧹 Очистка предыдущих данных docker-data..."
  rm -rf docker-data

  print_blue "📦 Распаковка docker-data..."
  if tar -xzf "${tmp_dir}/dle-template.tar.gz" -C .; then
    print_green "✅ docker-data успешно распакован"
  else
    print_red "❌ Ошибка распаковки docker-data"
    rm -rf "${tmp_dir}"
    exit 1
  fi

  rm -rf "${tmp_dir}"
}

# Проверка наличия docker-data, загрузка при необходимости
ensure_docker_data() {
  print_blue "🔍 Проверка наличия docker-data..."
  if [ -d "docker-data/images" ] && [ -d "docker-data/volumes" ]; then
    print_green "✅ Папка docker-data найдена локально"
    return
  fi

  print_yellow "⚠️  Папка docker-data отсутствует. Будет выполнена загрузка частей архива."
  check_curl
  download_archive_parts
}

# Проверка файлов образов
check_images() {
  print_blue "🔍 Проверка файлов образов..."
  if [ ! -d "docker-data/images" ]; then
    print_red "❌ Папка docker-data/images не найдена!"
    print_yellow "Убедитесь, что репозиторий содержит экспортированные образы"
    exit 1
  fi
  
  local images=("backend.tar" "frontend-nginx.tar" "vector-search.tar" "ollama.tar" "webssh-agent.tar")
  for image in "${images[@]}"; do
    if [ ! -f "docker-data/images/$image" ]; then
      print_red "❌ Файл образа $image не найден!"
      exit 1
    fi
  done
  
  print_green "✅ Все файлы образов найдены"
}

# Проверка файлов томов
check_volumes() {
  print_blue "🔍 Проверка файлов томов..."
  if [ ! -d "docker-data/volumes" ]; then
    print_red "❌ Папка docker-data/volumes не найдена!"
    print_yellow "Убедитесь, что репозиторий содержит экспортированные тома"
    exit 1
  fi
  
  local volumes=("postgres_data.tar.gz" "ollama_data.tar.gz" "vector_search_data.tar.gz" "backend_node_modules.tar.gz")
  for volume in "${volumes[@]}"; do
    if [ ! -f "docker-data/volumes/$volume" ]; then
      print_red "❌ Файл тома $volume не найден!"
      exit 1
    fi
  done
  
  # frontend_node_modules опционален (только для dev)
  if [ -f "docker-data/volumes/frontend_node_modules.tar.gz" ]; then
    print_blue "ℹ️  frontend_node_modules.tar.gz найден (для dev режима)"
  fi
  
  print_green "✅ Все файлы томов найдены"
}

# Импорт образов
import_images() {
  print_blue "📦 Импорт образов..."
  
  local images=("backend.tar" "frontend-nginx.tar" "vector-search.tar" "ollama.tar" "webssh-agent.tar")
  for image in "${images[@]}"; do
    print_blue "Импорт $image..."
    if docker load -i "docker-data/images/$image"; then
      print_green "✅ $image импортирован"
    else
      print_red "❌ Ошибка импорта $image"
      exit 1
    fi
  done
  
  print_green "✅ Все образы импортированы"
}

# Создание томов
create_volumes() {
  print_blue "💾 Создание томов..."
  
  local volumes=("digital_legal_entitydle_postgres_data" "digital_legal_entitydle_ollama_data" "digital_legal_entitydle_vector_search_data" "digital_legal_entitydle_backend_node_modules" "digital_legal_entitydle_frontend_node_modules")
  
  for volume in "${volumes[@]}"; do
    if docker volume ls | grep -q "$volume"; then
      print_yellow "⚠️  Том $volume уже существует"
    else
      docker volume create "$volume"
      print_green "✅ Том $volume создан"
    fi
  done
}

# Импорт томов
import_volumes() {
  print_blue "📥 Импорт данных в тома..."
  
  # PostgreSQL
  print_blue "Импорт postgres_data..."
  docker run --rm -v digital_legal_entitydle_postgres_data:/target -v "$(pwd)/docker-data/volumes:/backup" alpine tar xzf /backup/postgres_data.tar.gz -C /target
  print_green "✅ postgres_data импортирован"
  
  # Ollama
  print_blue "Импорт ollama_data..."
  docker run --rm -v digital_legal_entitydle_ollama_data:/target -v "$(pwd)/docker-data/volumes:/backup" alpine tar xzf /backup/ollama_data.tar.gz -C /target
  print_green "✅ ollama_data импортирован"
  
  # Vector Search
  print_blue "Импорт vector_search_data..."
  docker run --rm -v digital_legal_entitydle_vector_search_data:/target -v "$(pwd)/docker-data/volumes:/backup" alpine tar xzf /backup/vector_search_data.tar.gz -C /target
  print_green "✅ vector_search_data импортирован"
  
  # Backend node_modules
  print_blue "Импорт backend_node_modules..."
  docker run --rm -v digital_legal_entitydle_backend_node_modules:/target -v "$(pwd)/docker-data/volumes:/backup" alpine tar xzf /backup/backend_node_modules.tar.gz -C /target
  print_green "✅ backend_node_modules импортирован"
  
  # Frontend node_modules (опционально, только для dev режима)
  if [ -f "docker-data/volumes/frontend_node_modules.tar.gz" ]; then
    print_blue "Импорт frontend_node_modules..."
    docker run --rm -v digital_legal_entitydle_frontend_node_modules:/target -v "$(pwd)/docker-data/volumes:/backup" alpine tar xzf /backup/frontend_node_modules.tar.gz -C /target
    print_green "✅ frontend_node_modules импортирован"
  else
    print_yellow "⚠️  frontend_node_modules.tar.gz не найден (не требуется для production)"
  fi
  
  print_green "✅ Все тома импортированы"
}

# Копирование ключа шифрования из архива
copy_encryption_key() {
  print_blue "🔐 Копирование ключа шифрования..."
  
  # Проверяем наличие ключа в архиве
  if [ -f "docker-data/ssl/keys/full_db_encryption.key" ]; then
    # Создаем директорию для ключа
    mkdir -p ssl/keys
    
    # Копируем ключ
    cp docker-data/ssl/keys/full_db_encryption.key ssl/keys/full_db_encryption.key
    chmod 600 ssl/keys/full_db_encryption.key
    
    print_green "✅ Ключ шифрования скопирован из архива"
    print_yellow "⚠️  Примечание: Это дефолтный ключ, замените его на свой!"
  else
    print_yellow "⚠️  Ключ шифрования не найден в архиве"
    print_blue "Создайте новый ключ или он будет создан автоматически"
    
    # Создаем директорию для ключа на всякий случай
    mkdir -p ssl/keys
  fi
}

# Запуск приложения
start_application() {
  print_blue "🚀 Запуск приложения..."
  
  if docker-compose up -d; then
    print_green "✅ Приложение запущено"
    print_blue "🌐 Доступ к приложению: http://localhost:5173"
  else
    print_red "❌ Ошибка запуска приложения"
    print_yellow "Проверьте логи: docker-compose logs"
    exit 1
  fi
}

# Проверка статуса
check_status() {
  print_blue "🔍 Проверка статуса контейнеров..."
  sleep 10
  
  if docker-compose ps | grep -q "Up"; then
    print_green "✅ Контейнеры запущены"
    print_blue "🌐 Приложение доступно по адресу: http://localhost:5173"
  else
    print_yellow "⚠️  Некоторые контейнеры могут быть не готовы"
    print_blue "Проверьте статус: docker-compose ps"
    print_blue "Просмотрите логи: docker-compose logs"
  fi
}

# Основная функция
main() {
  print_blue "🚀 Установка шаблона приложения Digital Legal Entity"
  print_blue "=================================================="
  
  # Проверки
  check_docker
  check_docker_running
  
  # Скачивание
  download_repo
  ensure_docker_data
  
  # Проверка файлов
  check_images
  check_volumes
  
  # Импорт
  import_images
  create_volumes
  import_volumes
  
  # Копирование ключа шифрования
  copy_encryption_key
  
  # Запуск
  start_application
  check_status
  
  print_green "🎉 Установка завершена!"
  print_blue "=================================================="
  print_blue "🌐 Приложение доступно: http://localhost:5173"
  print_blue "🔧 Управление:"
  print_blue "   Запуск:   docker-compose up -d"
  print_blue "   Остановка: docker-compose down"
  print_blue "   Логи:     docker-compose logs"
}

# Запуск
main "$@"
