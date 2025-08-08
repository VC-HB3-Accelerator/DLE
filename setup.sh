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
      print_green "Docker установлен. Перезапустите терминал или выполните: newgrp docker"
    else
      print_yellow "Пожалуйста, установите Docker вручную: https://docs.docker.com/get-docker/"
      print_yellow "Для Windows/Mac: скачайте и установите Docker Desktop."
      exit 1
    fi
  fi
  print_green "Docker установлен."

  print_blue "Проверка Docker Compose..."
  if ! docker compose version &> /dev/null; then
    print_yellow "Docker Compose не установлен или требуется обновление."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
      print_blue "Установка Docker Compose (входит в новые версии Docker)..."
      print_yellow "Если после установки Docker Compose не работает, обновите Docker или следуйте инструкции: https://docs.docker.com/compose/install/"
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
  print_yellow "1. Перейдите на https://github.com/DAO-HB3-Accelerator/DLE"
  print_yellow "2. Нажмите 'Code' > 'Download ZIP'"
  print_yellow "3. Распакуйте архив и перейдите в папку проекта"
  print_yellow "4. Запустите этот скрипт: ./setup.sh"
}

# Проверка и создание .env файлов
check_env_files() {
  print_blue "Проверка наличия файлов конфигурации..."
  
  # Проверяем backend/.env
  if [ ! -f backend/.env ]; then
    if [ -f backend/.env.example ]; then
      print_yellow "Файл backend/.env не найден. Создаю из примера..."
      cp backend/.env.example backend/.env
      print_green "Файл backend/.env создан. Рекомендуется настроить его вручную."
    else
      print_red "Файл backend/.env.example не найден. Невозможно создать файл конфигурации."
      exit 1
    fi
  else
    print_green "Файл backend/.env уже существует."
  fi
  
  # Проверяем frontend/.env
  if [ ! -f frontend/.env ]; then
    if [ -f frontend/.env.example ]; then
      print_yellow "Файл frontend/.env не найден. Создаю из примера..."
      cp frontend/.env.example frontend/.env
      print_green "Файл frontend/.env создан. Рекомендуется настроить его вручную."
    else
      print_red "Файл frontend/.env.example не найден. Невозможно создать файл конфигурации."
      exit 1
    fi
  else
    print_green "Файл frontend/.env уже существует."
  fi
  
  print_blue "Проверка файлов конфигурации завершена."
  print_yellow "ВАЖНО: По соображениям безопасности используйте свои значения для паролей и ключей в .env файлах."
}

# Предварительная загрузка образов
pull_images() {
  print_blue "Предварительная загрузка образов Docker..."
  
  images=("node:20-alpine" "postgres:16-alpine" "ollama/ollama:latest" "curlimages/curl:latest")
  
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
    
    print_green "----------------------------------------"
    print_green "Проект Digital_Legal_Entity(DLE) доступен по адресам:"
    print_green "Frontend: http://localhost:5173"
    print_green "Backend API: http://localhost:8000"
    print_green "Ollama API: http://localhost:11434"
    print_green "PostgreSQL: localhost:5432"
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
  check_env_files
  pull_images
  start_project
}

# Запуск основной функции
main 