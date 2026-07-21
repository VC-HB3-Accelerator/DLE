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

PRELOAD_FILE="/preload-shared/ollama_preload_model.txt"
if [ -f "$PRELOAD_FILE" ]; then
  CHAT_MODEL=$(tr -d '\n\r' < "$PRELOAD_FILE")
else
  CHAT_MODEL="${OLLAMA_MODEL:-qwen2.5:1.5b}"
fi

# Сначала эмбеддинги (при OLLAMA_MAX_LOADED_MODELS=1 в RAM останется последняя загруженная — чат)
EMBED_MODEL="${OLLAMA_EMBEDDINGS_MODEL:-mxbai-embed-large:latest}"
echo "Скачиваем модель эмбеддингов ${EMBED_MODEL}..."
ollama pull "${EMBED_MODEL}"

echo "Загружаем модель эмбеддингов в память на 24 часа..."
curl -sS -X POST http://localhost:11434/api/embed \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"${EMBED_MODEL}\",
    \"input\": \"test\",
    \"keep_alive\": \"24h\"
  }" > /dev/null 2>&1

if [ -n "$CHAT_MODEL" ] && echo "$CHAT_MODEL" | grep -Eq '^[a-zA-Z0-9._:-]+$'; then
  echo "Загружаем чат-модель ${CHAT_MODEL} через API (keep_alive 24h)..."
  curl -sS -X POST http://localhost:11434/api/chat \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"${CHAT_MODEL}\",
      \"messages\": [{\"role\": \"user\", \"content\": \".\"}],
      \"keep_alive\": \"24h\",
      \"stream\": false,
      \"options\": { \"num_predict\": 1 }
    }" > /dev/null 2>&1 || echo "Предупреждение: не удалось загрузить ${CHAT_MODEL} в память"
  echo "Чат-модель ${CHAT_MODEL}: запрос предзагрузки отправлен"
else
  echo "Пропуск предзагрузки чат-модели: некорректное или пустое имя (${CHAT_MODEL})"
fi

echo "Все модели загружены! Система готова к работе."

# Держим контейнер запущенным
tail -f /dev/null
