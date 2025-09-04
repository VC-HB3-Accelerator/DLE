#!/bin/bash

# Запускаем Ollama сервер в фоне
ollama serve &

# Ждем запуска сервера
echo "Ждем запуска Ollama сервера..."
sleep 20

# Проверяем готовность сервера
echo "Проверяем готовность сервера..."
while ! curl -s http://localhost:11434/api/tags > /dev/null; do
  echo "Сервер еще не готов, ждем..."
  sleep 5
done
echo "Сервер готов!"

# Загружаем чат-модель через API с keepalive 24h
echo "Загружаем чат-модель qwen2.5:7b через API..."
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5:7b",
    "messages": [{"role": "user", "content": "hi"}],
    "keep_alive": "24h"
  }' > /dev/null 2>&1

echo "Чат-модель qwen2.5:7b загружена!"

# Скачиваем модель эмбеддингов
echo "Скачиваем модель эмбеддингов mxbai-embed-large:latest..."
ollama pull mxbai-embed-large:latest

# Загружаем модель эмбеддингов через API с keepalive 24h
echo "Загружаем модель эмбеддингов в память на 24 часа..."
curl -X POST http://localhost:11434/api/embed \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mxbai-embed-large:latest",
    "input": "test",
    "keep_alive": "24h"
  }'

echo "Все модели загружены! Система готова к работе."

# Держим контейнер запущенным
tail -f /dev/null
