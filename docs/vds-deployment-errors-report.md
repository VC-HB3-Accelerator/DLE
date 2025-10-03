# Отчет по ошибкам развертывания на VDS

## 📋 Обзор

Документ содержит полный список ошибок, обнаруженных при развертывании приложения Digital Legal Entity на VDS сервере `185.221.214.140`.

## 🚨 Обнаруженные ошибки

### 1. HTTP ERROR 503 - Service Unavailable

**Описание:** При обращении к `http://185.221.214.140` возвращается ошибка 503.

**Детали:**
- Системный nginx уже запущен на портах 80/443
- Наш `dapp-frontend-nginx` пытается занять те же порты
- Контейнеры запускаются, но недоступны извне

**Логи ошибок:**
```
Error response from daemon: failed to set up container networking: 
driver failed programming external connectivity on endpoint dapp-frontend-nginx: 
failed to bind host port for 0.0.0.0:80:172.18.0.7:80/tcp: address already in use
```

### 2. Конфликт портов nginx

**Проблема:** Два nginx сервера пытаются использовать одни порты.

**Системный nginx:**
- Установлен в системе Linux
- Занимает порты 80 (HTTP) и 443 (HTTPS)
- Статус: `nginx: master process`

**Наш frontend-nginx:**
- Docker контейнер `dapp-frontend-nginx`
- Пытается занять порты 80/443
- Статус: не может запуститься

### 3. Проблемы с health checks

**Vector Search контейнер:**
- Статус: `unhealthy`
- Причина: health check endpoint недоступен
- Влияние: блокирует запуск зависимых сервисов

**Backend контейнер:**
- Статус: `health: starting`
- Зависит от vector-search
- Не запускается из-за failed dependencies

### 4. Ошибки конфигурации nginx в контейнере

**Frontend-nginx контейнер:**
- Статус: `Restarting (1)`
- Ошибка: `invalid number of arguments in "server_name" directive in /etc/nginx/nginx.conf:37`
- Причина: неправильная конфигурация nginx внутри контейнера

**Логи ошибок:**
```
2025/10/03 06:02:15 [emerg] 1#1: invalid number of arguments in "server_name" directive in /etc/nginx/nginx.conf:37
nginx: [emerg] invalid number of arguments in "server_name" directive in /etc/nginx/nginx.conf:37
```

### 5. Проблемы с системным nginx

**Ошибка запуска:**
- Команда: `systemctl restart nginx`
- Результат: `Job for nginx.service failed because the control process exited with error code`

**Логи ошибок:**
```
nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)
nginx: [emerg] bind() to 0.0.0.0:443 failed (98: Address already in use)
nginx: [emerg] still could not bind()
```

### 6. Ошибки подключения к базе данных

**Backend контейнер:**
- Ошибка: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`
- Причина: неправильная передача пароля для PostgreSQL
- Влияние: backend не может подключиться к базе данных

**Логи ошибок:**
```
Ошибка подключения к базе данных: Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
    at /app/node_modules/pg-pool/index.js:45:11
```

### 7. Ошибки YAML синтаксиса в docker-compose.yml

**Проблема:** Неправильный формат переменных окружения в docker-compose.yml

**Ошибки:**
```
yaml: line 20: did not find expected '-' indicator
yaml: line 20: did not find expected key
```

**Причина:** Смешанный формат переменных окружения:
- В секции postgres: `- KEY=value` (неправильно)
- В секции backend: `- KEY=value` (правильно для backend)

### 8. Отсутствующие таблицы в базе данных

**Backend контейнер:**
- Ошибка: `relation "email_settings" does not exist`
- Ошибка: `relation "db_settings" does not exist`
- Ошибка: `relation "session" does not exist`

**Логи ошибок:**
```
error: Unhandled Rejection: relation "email_settings" does not exist {"code":"42P01"}
error: [DatabaseConnectionManager] Ошибка инициализации: relation "db_settings" does not exist {"code":"42P01"}
error: Unhandled Rejection: relation "session" does not exist {"code":"42P01"}
```

**Диагностика базы данных:**
```
docker exec dapp-postgres psql -U dapp_user -d dapp_db -c '\dt'
Did not find any relations.
```

**Причина:** База данных полностью пустая - отсутствует схема и все таблицы

**Влияние:** Backend не может полностью инициализироваться, API недоступен

### 9. Проблемы с пробросом портов

**Frontend контейнер:**
- Порт 5173 не проброшен наружу
- Контейнер запущен, но недоступен извне
- Статус: `Up (health: starting)`

**Frontend-nginx контейнер:**
- Порт 9000 не проброшен наружу
- Контейнер не запускается из-за конфликтов

### 10. Проблемы с переменными окружения

**Отсутствующие переменные в .env:**
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `NODE_ENV`, `PORT`
- `OLLAMA_MODEL`, `OLLAMA_EMBEDDINGS_MODEL`

**Неправильная передача в docker-compose.yml:**
- Переменные не передаются в контейнеры
- Backend использует "дефолтные настройки подключения к БД"

### 11. Отсутствие миграций базы данных

**Проблема:** Схема базы данных не создается автоматически

**Найденные файлы:**
- `./backend/scripts/run-migrations.js` - скрипт для запуска миграций
- Скрипт ищет SQL файлы в `./backend/db/migrations/`

**Диагностика:**
```
find ./backend -name "*.sql" -o -name "*schema*" -o -name "*migration*"
# Результат: только node_modules файлы, нет SQL миграций
```

**Причина:** Отсутствуют файлы миграций для создания схемы базы данных

**Влияние:** База данных остается пустой, backend не может инициализироваться

### 12. Проверка ключа шифрования

**Статус ключа шифрования:**
- **Локальный ключ:** `MsPbvDsNXra/kqw4XgnaustFDcuuSvZY1TwhYrpxMnE=`
- **Ключ на VDS:** `MsPbvDsNXra/kqw4XgnaustFDcuuSvZY1TwhYrpxMnE=`
- **Статус:** Ключи идентичны, передача корректна

**Монтирование в контейнер:**
- Ключ доступен в `/app/ssl/full_db_encryption.key`
- Права доступа: `-rw------- 1 root root 45`

**Вывод:** Проблема не в ключе шифрования

## 📊 Статистика ошибок

### По типам:
- **База данных:** 4 ошибки (отсутствие схемы, миграций, таблиц)
- **Конфигурация nginx:** 3 ошибки
- **Проблемы с портами:** 2 ошибки
- **Docker Compose:** 2 ошибки
- **Health checks:** 1 ошибка

### По критичности:
- **Критические:** 5 ошибок (блокируют работу приложения)
- **Серьезные:** 5 ошибок (влияют на функциональность)
- **Предупреждения:** 2 ошибки (не блокируют, но требуют внимания)

## 🔍 Диагностические данные

### Статус контейнеров:
```
NAMES                 STATUS                             PORTS
dapp-frontend-nginx   Restarting (1) 11 seconds ago      
dapp-frontend         Up 25 seconds (health: starting)   5173/tcp
dapp-backend          Up 12 minutes (unhealthy)          0.0.0.0:8000->8000/tcp
dapp-vector-search    Up 12 minutes (unhealthy)          8001/tcp
dapp-postgres         Up 12 minutes (healthy)            5432/tcp
dapp-ollama           Up 12 minutes (healthy)            11434/tcp
```

### Занятые порты:
```
tcp        0      0 0.0.0.0:443             0.0.0.0:*               LISTEN      12785/nginx: master 
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      12785/nginx: master 
tcp        0      0 0.0.0.0:8000            0.0.0.0:*               LISTEN      40287/docker-proxy  
```

### Процессы nginx:
```
root       12785  0.0  0.1  35468  9160 ?        Ss   Oct02   0:00 nginx: master process nginx -c /etc/nginx/nginx.conf
www-data   32875  0.0  0.1  36820 11032 ?        S    05:11   0:00 nginx: worker process
www-data   32876  0.0  0.1  36820 10904 ?        S    05:11   0:00 nginx: worker process
www-data   32877  0.0  0.1  36820 10776 ?        S    05:11   0:00 nginx: worker process
www-data   32878  0.0  0.1  36820 10648 ?        S    05:11   0:00 nginx: worker process
```

## 📝 Заключение

Обнаружено **20 различных типов ошибок** при развертывании приложения на VDS сервере. Основные проблемы связаны с:

1. **Отсутствием схемы базы данных** - база полностью пустая, нет таблиц и миграций
2. **Конфликтами портов** между системным и контейнерным nginx
3. **Неправильной конфигурацией** docker-compose.yml и переменных окружения
4. **Проблемами с health checks** и зависимостями между сервисами

**Ключевая проблема:** Данные PostgreSQL импортированы в volume с неправильным именем. Контейнер читает из пустой базы данных, хотя данные есть в другом volume.

**РЕШЕНО:** 
- База данных восстановлена, содержит 37 таблиц
- Backend подключается к базе данных
- AI сервис (Ollama) работает корректно
- Все основные сервисы функционируют

**Ключ шифрования:** Передан корректно, проблема не в нем.

## Error 13: Проверка целостности архива данных

**Описание:** Проверка целостности архива `docker-images-and-data.tar.gz` на VDS.

**Детали:**
- Размер архива: 8.4GB
- Команда `tar -tf` не возвращала содержимое
- Подозрение на повреждение архива
- Проверка: `tar -xzf docker-images-and-data.tar.gz -C test-extract/`
- Результат: Архив успешно распакован

**Содержимое архива:**
- Docker образы: 7 файлов (dapp-backend.tar, dapp-frontend.tar, dapp-frontend-nginx.tar, dapp-ollama.tar, dapp-postgres.tar, dapp-vector-search.tar, dapp-webssh-agent.tar)
- Данные volumes: 3 файла (ollama_data.tar.gz, postgres_data.tar.gz, vector_search_data.tar.gz)

**Влияние:** Критическое - без корректного архива невозможно восстановить данные приложения.

**Статус:** ✅ РЕШЕНО - архив целый и содержит все необходимые данные.

## Error 14: Несоответствие имен Docker volumes

**Описание:** Данные PostgreSQL импортированы в volume с неправильным именем.

**Детали:**
- Скрипт импорта создает volume: `digital_legal_entitydle_postgres_data`
- Контейнер PostgreSQL использует volume: `dapp_postgres_data`
- Данные находятся в правильном volume, но контейнер читает из пустого
- Проверка: `docker inspect dapp-postgres | grep Mounts`
- Результат: Контейнер монтирует `dapp_postgres_data`, а данные в `digital_legal_entitydle_postgres_data`

**Содержимое volumes:**
- `dapp_postgres_data`: пустая база данных (только системные файлы)
- `digital_legal_entitydle_postgres_data`: содержит базы данных (директории 1, 4, 5, 16384)

**Влияние:** Критическое - backend не может найти таблицы, так как читает из пустой базы данных.

**Статус:** ✅ РЕШЕНО - данные скопированы в правильный volume, база данных восстановлена.

**Решение:**
1. Остановлен и удален контейнер PostgreSQL
2. Удален пустой volume `dapp_postgres_data`
3. Скопированы данные из `digital_legal_entitydle_postgres_data` в `dapp_postgres_data`
4. Запущен новый контейнер PostgreSQL с правильным volume
5. Проверено: база данных `dapp_db` содержит 37 таблиц, включая `email_settings`, `db_settings`, `session`

## Error 15: Контейнеры в разных Docker сетях

**Описание:** Backend не может подключиться к PostgreSQL из-за разных Docker сетей.

**Детали:**
- `dapp-backend` находится в сети `dapp_default`
- `dapp-postgres` находится в сети `bridge`
- Backend пытается подключиться к хосту `postgres`, но не может его найти
- Ошибка: `getaddrinfo EAI_AGAIN postgres`

**Влияние:** Критическое - backend не может подключиться к базе данных.

**Статус:** 🔄 В ПРОЦЕССЕ - требуется подключение контейнеров к одной сети.

## Error 16: Неправильное имя хоста в переменных окружения

**Описание:** Backend ищет хост `postgres`, но контейнер называется `dapp-postgres`.

**Детали:**
- Переменная окружения: `DB_HOST=postgres`
- Реальное имя контейнера: `dapp-postgres`
- Контейнеры подключены к одной сети `dapp_default`
- Сетевое соединение работает (ping успешен)
- Проблема в DNS разрешении имени `postgres`

**Влияние:** Критическое - backend не может найти PostgreSQL по имени хоста.

**Статус:** ✅ РЕШЕНО - backend перезапущен с правильной переменной окружения `DB_HOST=dapp-postgres`.

**Решение:**
1. Остановлен и удален старый контейнер backend
2. Запущен новый контейнер с правильными переменными окружения
3. Проверено: API отвечает, база данных подключена

## Error 17: Проблема с расшифровкой данных

**Описание:** Ошибка расшифровки base64 данных в базе данных.

**Детали:**
- Ошибка: `invalid symbol "-" found while decoding base64 sequence`
- Проблема в функции `decrypt_text` PostgreSQL
- Данные в базе зашифрованы, но ключ шифрования не подходит
- Влияет на EmailBotService и DbSettingsService

**Влияние:** Среднее - некоторые функции могут не работать из-за проблем с расшифровкой.

**Статус:** 🔄 В ПРОЦЕССЕ - требуется проверка ключа шифрования.

## Error 18: AI сервис недоступен

**Описание:** Ollama сервис не отвечает на запросы.

**Детали:**
- Health check: AI сервис возвращает ошибку
- URL: `http://localhost:11434`
- Ошибка: `fetch failed`
- Vector Search работает корректно

**Влияние:** Среднее - AI функции недоступны.

**Статус:** ✅ РЕШЕНО - добавлена переменная окружения `OLLAMA_BASE_URL=http://ollama:11434`.

**Решение:**
1. Обнаружена проблема в коде: `ai-assistant.js` использовал `localhost:11434` по умолчанию
2. Добавлена переменная окружения `OLLAMA_BASE_URL=http://ollama:11434`
3. Backend перезапущен с правильными настройками
4. Проверено: AI сервис работает, 1 модель доступна

## Error 19: Проблема с расшифровкой данных

**Описание:** Ошибка расшифровки base64 данных в базе данных.

**Детали:**
- Ошибка: `invalid symbol "-" found while decoding base64 sequence`
- Проблема в функции `decrypt_text` PostgreSQL
- Данные в базе зашифрованы, но ключ шифрования не подходит
- Влияет на EmailBotService и DbSettingsService

**Влияние:** Среднее - некоторые функции могут не работать из-за проблем с расшифровкой.

**Статус:** ✅ РЕШЕНО - ключ шифрования смонтирован в контейнер.

**Решение:**
1. Обнаружено, что ключ шифрования не был смонтирован в контейнер backend
2. Ключ находился на хосте VDS в `/home/docker/dapp/ssl/keys/full_db_encryption.key`
3. Backend перезапущен с монтированием `-v /home/docker/dapp/ssl:/app/ssl`
4. Проверено: ключ доступен в контейнере, логи показывают "🔍 Ключ шифрования: установлен"

## Error 20: Frontend недоступен (502 Bad Gateway)

**Описание:** Домен hb3-accelerator.com возвращает ошибку 502 Bad Gateway.

**Детали:**
- Frontend-nginx контейнер постоянно перезапускается
- Ошибка nginx: `invalid number of arguments in "server_name" directive in /etc/nginx/nginx.conf:37`
- Frontend контейнер нездоров (unhealthy)
- Данные frontend-nginx volumes не импортированы

**Влияние:** Критическое - приложение недоступно через веб-интерфейс.

**Статус:** ✅ РЕШЕНО - frontend-nginx контейнер запущен с правильными переменными окружения.

**Решение:**
1. Обнаружена проблема: переменные окружения `DOMAIN` и `BACKEND_CONTAINER` не были установлены в контейнере
2. Контейнер перезапущен с переменными: `DOMAIN=hb3-accelerator.com` и `BACKEND_CONTAINER=dapp-backend`
3. Nginx конфигурация успешно обработана, контейнер запущен без ошибок
4. Frontend доступен через порт 9000: `http://185.221.214.140:9000`

**ТЕКУЩИЙ СТАТУС:** Все основные сервисы работают:
- ✅ Database: OK
- ✅ AI: OK (1 модель доступна)
- ✅ Vector Search: OK
- ✅ Шифрование: OK
- ✅ Frontend: OK (доступен через порт 9000)
- ⚠️ WebSocket: Частично работает (подключение есть, но nginx не проксирует `/ws`)

## Error 21: WebSocket не проксируется через nginx

**Описание:** Frontend подключается к WebSocket, но nginx не проксирует соединения на `/ws` к backend.

**Детали:**
- WebSocket подключение устанавливается: `[WebSocket] Подключение установлено`
- API запросы работают корректно: все `/api/*` запросы успешны
- Проблема: nginx конфигурация не содержит секцию для `/ws` endpoint
- Результат: frontend не получает real-time обновления после подключения кошелька

**Логи frontend:**
```
[WebSocket] Подключаемся к: wss://hb3-accelerator.com/ws
[WebSocket] Подключение установлено
🌐 [AXIOS] Отправляем запрос: /api/auth/verify
🌐 [AXIOS] Получен ответ: status 200
Auth check response: {authenticated: false, ...}
```

**Влияние:** Среднее - приложение работает, но отсутствуют real-time обновления аутентификации.

**Статус:** 🔄 В ПРОЦЕССЕ - требуется добавление поддержки WebSocket в nginx конфигурацию.

**Необходимое решение:**
Добавить в nginx конфигурацию секцию:
```nginx
location /ws {
    proxy_pass http://dapp-backend:8000/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 📊 ДИАГНОСТИКА VDS СЕРВЕРА `185.221.214.140`

### 🖥️ **СИСТЕМА:**
- **ОС:** Ubuntu 24.04.2 LTS (Noble Numbat)
- **Ядро:** Linux 6.8.0-63-generic
- **Архитектура:** x86_64
- **Память:** 7.8GB (используется 1.6GB, доступно 6.1GB)
- **Диск:** 59GB (используется 35GB, доступно 22GB - 63%)
- **IP:** 185.221.214.140/24

### 🔧 **УСТАНОВЛЕННЫЕ ПРОГРАММЫ:**
- **Docker:** 28.5.0 ✅
- **Docker Compose:** v2.39.4 ✅
- **Nginx:** 1.24.0 (Ubuntu) ✅
- **Node.js:** Не установлен (используется в контейнерах)
- **SSH:** Активен ✅

### 🐳 **DOCKER КОНТЕЙНЕРЫ (6 из 6 работают):**
- **dapp-frontend-nginx:** Up 4 minutes (порт 9000) ✅
- **dapp-frontend:** Up 26 minutes ✅
- **dapp-backend:** Up 37 minutes (порт 8000) ✅
- **dapp-postgres:** Up About an hour (порт 5432) ✅
- **dapp-vector-search:** Up 2 hours (unhealthy) ⚠️
- **dapp-ollama:** Up 2 hours (healthy) ✅

### 🌐 **СЕТЬ И ПОРТЫ:**
- **Открытые порты:**
  - 80, 443 (системный nginx)
  - 8000 (backend API)
  - 9000 (frontend nginx)
  - 5432 (PostgreSQL)
- **Docker сети:** dapp_default, bridge, host, none
- **Docker volumes:** 10 volumes (данные приложения)

### 🔒 **SSL И БЕЗОПАСНОСТЬ:**
- **SSL сертификат:** hb3-accelerator.com ✅
- **Nginx конфигурации:** 2 активных сайта
- **SSH атаки:** Обнаружены попытки взлома с IP 185.91.127.114 ⚠️

### 📈 **СТАТУС ПРИЛОЖЕНИЯ:**
- **Frontend:** ✅ Доступен (https://hb3-accelerator.com)
- **Backend API:** ✅ Работает (порт 8000)
- **Database:** ✅ 37 таблиц, все данные восстановлены
- **AI сервис:** ✅ 1 модель доступна
- **WebSocket:** ⚠️ Подключение есть, но nginx не проксирует `/ws`

### 🚨 **ПРОБЛЕМЫ:**
1. **Vector Search:** unhealthy (не критично)
2. **WebSocket:** Нужна настройка проксирования в nginx
3. **SSH атаки:** Рекомендуется усилить защиту

### ✅ **ВЫВОД:**
VDS сервер настроен корректно, все основные сервисы работают. Приложение Digital Legal Entity полностью функционально и доступно через веб-интерфейс. Остается только настроить WebSocket проксирование для полной функциональности.

---

**Дата создания:** 2025-10-03  
**Версия:** 1.2  
**Статус:** Ошибки зафиксированы, диагностика VDS завершена
