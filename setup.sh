#!/bin/bash
# Copyright (c) 2024-2026 Тарабанов Александр Викторович
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

# Версия релиза для установки (обновляется при выходе нового релиза)
ARCHIVE_VERSION="v1.0.3"
ARCHIVE_BASE_URL="https://github.com/VC-HB3-Accelerator/DLE/releases/download/${ARCHIVE_VERSION}"

# Список частей архива (стандартные части для релиза v1.0.2+)
ARCHIVE_PARTS=(
  "dle-template.tar.gz.part-aa"
  "dle-template.tar.gz.part-ab"
  "dle-template.tar.gz.part-ac"
  "dle-template.tar.gz.part-ad"
  "dle-template.tar.gz.part-ae"
  "dle-template.tar.gz.part-af"
  "dle-template.tar.gz.part-ag"
  "dle-template.tar.gz.part-ah"
  "dle-template.tar.gz.part-ai"
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

# Определение IP адреса сервера
get_server_ip() {
  # Сначала пытаемся получить внешний IP
  local external_ip
  external_ip=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || curl -s --max-time 3 ifconfig.co 2>/dev/null || echo "")
  
  if [ -n "$external_ip" ] && [[ "$external_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "$external_ip"
    return
  fi
  
  # Если не получилось, пробуем получить локальный IP
  local local_ip
  local_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "")
  
  if [ -n "$local_ip" ] && [[ "$local_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "$local_ip"
    return
  fi
  
  # Если ничего не получилось, используем localhost
  echo "localhost"
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
  print_blue "📥 Загрузка docker-data из релиза ${ARCHIVE_VERSION}..."

  local tmp_dir
  tmp_dir=$(mktemp -d)

  print_blue "Используем временную директорию: $tmp_dir"

  # Загружаем части архива
  for part in "${ARCHIVE_PARTS[@]}"; do
    local url="${ARCHIVE_BASE_URL}/${part}"
    local part_file="${tmp_dir}/${part}"
    print_blue "⇣ Загрузка ${part}..."
    # Удаляем файл перед загрузкой, чтобы избежать проблем с --continue-at
    rm -f "${part_file}"
    if ! curl -fL --retry 3 --output "${part_file}" "${url}"; then
      print_red "❌ Не удалось скачать ${part}"
      print_yellow "Проверьте подключение к сети или доступность релиза ${ARCHIVE_VERSION}"
      rm -rf "${tmp_dir}"
      exit 1
    fi
    
    # Проверяем, что файл не пустой
    if [ ! -s "${part_file}" ]; then
      print_red "❌ Файл ${part} пустой или поврежден"
      rm -rf "${tmp_dir}"
      exit 1
    fi
    
    local part_size
    part_size=$(stat -c%s "${part_file}" 2>/dev/null || stat -f%z "${part_file}" 2>/dev/null || echo "0")
    if command -v numfmt &> /dev/null; then
      local part_size_human=$(numfmt --to=iec-i --suffix=B ${part_size} 2>/dev/null || echo "${part_size} bytes")
      print_blue "  ✓ ${part} загружен (${part_size_human})"
    else
      print_blue "  ✓ ${part} загружен (${part_size} bytes)"
    fi
  done

  print_blue "🧩 Сборка архива dle-template.tar.gz..."
  # Явно указываем порядок частей из массива ARCHIVE_PARTS
  local archive_file="${tmp_dir}/dle-template.tar.gz"
  
  # Очищаем целевой файл
  rm -f "${archive_file}"
  
  # Вычисляем ожидаемый размер архива как сумму размеров всех частей
  local expected_size=0
  for part in "${ARCHIVE_PARTS[@]}"; do
    local part_size
    part_size=$(stat -c%s "${tmp_dir}/${part}" 2>/dev/null || stat -f%z "${tmp_dir}/${part}" 2>/dev/null || echo "0")
    expected_size=$((expected_size + part_size))
  done
  
  # Объединяем части
  for part in "${ARCHIVE_PARTS[@]}"; do
    local part_file="${tmp_dir}/${part}"
    if [ ! -f "${part_file}" ]; then
      print_red "❌ Файл части ${part} не найден"
      rm -rf "${tmp_dir}"
      exit 1
    fi
    if ! cat "${part_file}" >> "${archive_file}"; then
      print_red "❌ Ошибка при объединении части ${part}"
      rm -rf "${tmp_dir}"
      exit 1
    fi
  done
  
  # Проверяем, что размер итогового архива совпадает с ожидаемым
  local actual_size
  actual_size=$(stat -c%s "${archive_file}" 2>/dev/null || stat -f%z "${archive_file}" 2>/dev/null || echo "0")
  if [ "${actual_size}" -ne "${expected_size}" ]; then
    print_red "❌ Размер итогового архива не совпадает с ожидаемым"
    print_red "   Ожидаемый размер: ${expected_size} bytes"
    print_red "   Фактический размер: ${actual_size} bytes"
    rm -rf "${tmp_dir}"
    exit 1
  fi

  # Проверяем размер итогового архива
  local archive_size
  archive_size=$(stat -c%s "${archive_file}" 2>/dev/null || stat -f%z "${archive_file}" 2>/dev/null || echo "0")
  if command -v numfmt &> /dev/null; then
    local archive_size_human=$(numfmt --to=iec-i --suffix=B ${archive_size} 2>/dev/null || echo "${archive_size} bytes")
    print_blue "  ✓ Архив собран: ${archive_size_human}"
  else
    print_blue "  ✓ Архив собран: ${archive_size} bytes"
  fi
  
  # Проверяем целостность gzip архива
  print_blue "🔍 Проверка целостности архива..."
  if ! gunzip -t "${archive_file}" 2>/dev/null; then
    print_red "❌ Архив поврежден или неполный (gzip проверка не пройдена)"
    print_yellow "Попробуйте запустить скрипт снова или проверьте доступность релиза ${ARCHIVE_VERSION}"
    rm -rf "${tmp_dir}"
    exit 1
  fi
  print_green "  ✓ Архив проверен и готов к распаковке"

  print_blue "🧹 Очистка предыдущих данных docker-data..."
  rm -rf docker-data

  print_blue "📦 Распаковка docker-data..."
  if tar -xzf "${archive_file}" -C .; then
    print_green "✅ docker-data успешно распакован"
  else
    print_red "❌ Ошибка распаковки docker-data"
    print_yellow "Архив может быть поврежден. Попробуйте запустить скрипт снова."
    rm -rf "${tmp_dir}"
    exit 1
  fi

  rm -rf "${tmp_dir}"
}

# Проверка наличия docker-data, загрузка при необходимости
ensure_docker_data() {
  print_blue "🔍 Проверка наличия docker-data..."
  
  # Проверяем наличие директорий
  if [ -d "docker-data/images" ] && [ -d "docker-data/volumes" ]; then
    # Проверяем наличие правильных файлов образов для новой версии v1.0.1
    if [ -f "docker-data/images/frontend-nginx.tar" ]; then
      print_green "✅ Папка docker-data найдена локально (версия v1.0.1+)"
      return
    else
      print_yellow "⚠️  Найдена старая версия docker-data (нет frontend-nginx.tar)"
      print_blue "🗑️  Удаление старой версии и загрузка релиза ${ARCHIVE_VERSION}..."
      rm -rf docker-data
    fi
  fi

  print_blue "📥 Загрузка docker-data из релиза ${ARCHIVE_VERSION}..."
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

# Определение имени проекта Docker Compose
# Docker Compose использует имя директории (в нижнем регистре, с заменой дефисов на подчеркивания) как префикс
get_compose_project_name() {
  # Используем переменную окружения COMPOSE_PROJECT_NAME, если установлена
  if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
    echo "${COMPOSE_PROJECT_NAME}"
    return
  fi
  
  # Определяем из имени текущей директории
  local dir_name
  dir_name=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | tr '-' '_' | sed 's/[^a-z0-9_]//g')
  
  # Если директория называется "dle", используем "dle"
  if [ "$dir_name" = "dle" ]; then
    echo "dle"
  else
    echo "$dir_name"
  fi
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
  
  # Определяем имя проекта динамически
  local project_name
  project_name=$(get_compose_project_name)
  print_blue "📋 Используется имя проекта: $project_name"
  
  # Обязательные тома для релиза v1.0.1
  local volumes=(
    "${project_name}_postgres_data"
    "${project_name}_ollama_data"
    "${project_name}_vector_search_data"
    "${project_name}_backend_node_modules"
  )
  
  for volume in "${volumes[@]}"; do
    if docker volume ls | grep -q "$volume"; then
      print_yellow "⚠️  Том $volume уже существует"
    else
      docker volume create "$volume"
      print_green "✅ Том $volume создан"
    fi
  done
  
  # Опциональный том frontend_node_modules (только если есть в архиве)
  if [ -f "docker-data/volumes/frontend_node_modules.tar.gz" ]; then
    local volume="${project_name}_frontend_node_modules"
    if docker volume ls | grep -q "$volume"; then
      print_yellow "⚠️  Том $volume уже существует"
    else
      docker volume create "$volume"
      print_green "✅ Том $volume создан (опциональный)"
    fi
  fi
}

# Импорт томов
import_volumes() {
  print_blue "📥 Импорт данных в тома..."
  
  # Определяем имя проекта динамически
  local project_name
  project_name=$(get_compose_project_name)
  print_blue "📋 Используется имя проекта: $project_name"
  
  # PostgreSQL
  print_blue "Импорт postgres_data..."
  docker run --rm -v "${project_name}_postgres_data:/target" -v "$(pwd)/docker-data/volumes:/backup" alpine tar xzf /backup/postgres_data.tar.gz -C /target
  print_green "✅ postgres_data импортирован"
  
  # Ollama
  print_blue "Импорт ollama_data..."
  docker run --rm -v "${project_name}_ollama_data:/target" -v "$(pwd)/docker-data/volumes:/backup" alpine tar xzf /backup/ollama_data.tar.gz -C /target
  print_green "✅ ollama_data импортирован"
  
  # Vector Search
  print_blue "Импорт vector_search_data..."
  docker run --rm -v "${project_name}_vector_search_data:/target" -v "$(pwd)/docker-data/volumes:/backup" alpine tar xzf /backup/vector_search_data.tar.gz -C /target
  print_green "✅ vector_search_data импортирован"
  
  # Backend node_modules
  print_blue "Импорт backend_node_modules..."
  docker run --rm -v "${project_name}_backend_node_modules:/target" -v "$(pwd)/docker-data/volumes:/backup" alpine tar xzf /backup/backend_node_modules.tar.gz -C /target
  print_green "✅ backend_node_modules импортирован"
  
  # Frontend node_modules (опционально, только для dev режима)
  if [ -f "docker-data/volumes/frontend_node_modules.tar.gz" ]; then
    print_blue "Импорт frontend_node_modules..."
    docker run --rm -v "${project_name}_frontend_node_modules:/target" -v "$(pwd)/docker-data/volumes:/backup" alpine tar xzf /backup/frontend_node_modules.tar.gz -C /target
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
  
  # Определяем IP адрес сервера
  SERVER_IP=$(get_server_ip)
  
  print_green "🎉 Установка завершена!"
  print_blue "=================================================="
  print_blue "🌐 Приложение доступно по адресам:"
  print_blue "   HTTP:  http://${SERVER_IP}:9000"
  print_blue "   HTTPS: https://${SERVER_IP}:9443"
  if [ "$SERVER_IP" != "localhost" ]; then
    print_blue "   Локально: http://localhost:9000"
  fi
  print_blue ""
  print_blue "🔧 Управление:"
  print_blue "   Запуск:   docker-compose up -d"
  print_blue "   Остановка: docker-compose down"
  print_blue "   Логи:     docker-compose logs"
}

# Запуск
main "$@"
