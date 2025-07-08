# Руководство по настройке WEB SSH

## Обзор

Система WEB SSH позволяет автоматически публиковать локальное Vue.js приложение в интернете через SSH-туннель и NGINX на удаленном сервере.

## Архитектура

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  Vue.js Frontend    │───▶│  WebSSH Agent       │───▶│  VPS Server         │
│  (localhost:5173)   │    │  (localhost:12345)  │    │  (ваш сервер)       │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                      │                           │
                                      │                           ▼
                                      │              ┌─────────────────────┐
                                      │              │  NGINX + SSL        │
                                      │              │  (порт 80/443)      │
                                      │              └─────────────────────┘
                                      │                           │
                                      │                           ▼
                                      │              ┌─────────────────────┐
                                      └─────────────▶│  SSH Reverse Tunnel │
                                                     │  (порт 9000)        │
                                                     └─────────────────────┘
```

## Требования

### Локальная машина
- ✅ Node.js 16+
- ✅ SSH клиент
- ✅ Docker и Docker Compose
- ✅ Yarn

### Удаленный сервер (VPS)
- ✅ Ubuntu/Debian или CentOS/RHEL
- ✅ SSH доступ с правами sudo/root
- ✅ Открытые порты 80, 443, 22
- ✅ Домен, указывающий на IP сервера

## Установка и настройка

### 1. Запуск основного приложения

```bash
# Клонируйте проект
git clone <your-repo-url>
cd DApp-for-Business

# Запустите приложение
docker-compose up -d

# Убедитесь, что фронтенд доступен
curl http://localhost:5173
```

### 2. Установка WebSSH Agent

```bash
# Перейдите в директорию агента
cd webssh-agent

# Установите зависимости
npm install

# Запустите агент
npm start
# или в фоновом режиме:
nohup node agent.js > agent.log 2>&1 &
```

### 3. Проверка работы агента

```bash
# Проверьте статус агента
curl http://localhost:12345/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"2025-07-06T18:08:57.789Z","version":"1.0.0","tunnelConnected":false}
```

## Использование

### 1. Подготовка SSH ключей

```bash
# Создайте SSH ключ (если еще нет)
ssh-keygen -t rsa -b 4096 -C "webssh@yourdomain.com"

# Скопируйте публичный ключ на сервер
ssh-copy-id -i ~/.ssh/id_rsa.pub user@your-server.com

# Проверьте подключение
ssh -i ~/.ssh/id_rsa user@your-server.com
```

### 2. Настройка через веб-интерфейс

1. Откройте приложение: `http://localhost:5173`
2. Перейдите в **Настройки** → **WEB SSH**
3. Заполните форму:

#### Обязательные поля:
- **Домен**: `example.com` (ваш домен)
- **Email для SSL**: `admin@example.com` (для Let's Encrypt)
- **SSH Host/IP**: `192.168.1.100` или `server.example.com`
- **SSH Пользователь**: `root` или ваш пользователь
- **SSH Приватный ключ**: содержимое файла `~/.ssh/id_rsa`

#### Дополнительные настройки (заполняются автоматически):
- **Локальный порт**: `5173` (порт Vue.js приложения)
- **Порт сервера**: `9000` (порт для SSH туннеля)
- **SSH порт**: `22` (стандартный SSH порт)

4. Нажмите **"Опубликовать"**

### 3. Процесс публикации

После нажатия "Опубликовать" агент автоматически:

1. ✅ Подключается к вашему серверу по SSH
2. ✅ Устанавливает NGINX и certbot (если не установлены)
3. ✅ Создает конфигурацию NGINX для вашего домена
4. ✅ Перезапускает NGINX
5. ✅ Получает SSL сертификат через Let's Encrypt
6. ✅ Создает SSH reverse-туннель
7. ✅ Ваше приложение становится доступным по адресу `https://yourdomain.com`

## Управление туннелем

### Через веб-интерфейс
- **Статус**: отображается в верхней части страницы
- **Отключить**: кнопка "Отключить" при активном туннеле
- **Логи**: отображаются в нижней части страницы

### Через API
```bash
# Статус туннеля
curl http://localhost:12345/tunnel/status

# Создание туннеля
curl -X POST http://localhost:12345/tunnel/create \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "email": "admin@example.com",
    "sshHost": "192.168.1.100",
    "sshUser": "root",
    "sshKey": "-----BEGIN OPENSSH PRIVATE KEY-----\n...",
    "localPort": 5173,
    "serverPort": 9000,
    "sshPort": 22
  }'

# Отключение туннеля
curl -X POST http://localhost:12345/tunnel/disconnect
```

## Безопасность

### Локальная безопасность
- ✅ Агент принимает соединения только с localhost
- ✅ SSH ключи хранятся временно и удаляются после отключения
- ✅ Все операции логируются

### Серверная безопасность
- ✅ Используется HTTPS с автоматическими SSL сертификатами
- ✅ NGINX настроен с безопасными заголовками
- ✅ SSH туннель использует приватные ключи

## Устранение неполадок

### Агент не запускается
```bash
# Проверьте порт
netstat -tulpn | grep 12345

# Проверьте логи
tail -f webssh-agent/agent.log

# Убейте процесс и перезапустите
pkill -f "node agent.js"
nohup node agent.js > agent.log 2>&1 &
```

### SSH соединение не устанавливается
```bash
# Проверьте SSH ключ
ssh -i ~/.ssh/id_rsa user@server

# Проверьте доступность сервера
ping your-server.com

# Проверьте SSH порт
telnet your-server.com 22
```

### NGINX не настраивается
```bash
# На сервере проверьте NGINX
sudo nginx -t
sudo systemctl status nginx

# Проверьте логи
sudo tail -f /var/log/nginx/error.log
```

### SSL сертификат не получается
```bash
# Проверьте DNS
nslookup your-domain.com

# Проверьте доступность домена
curl -I http://your-domain.com

# На сервере проверьте certbot
sudo certbot certificates
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### Туннель не работает
```bash
# Проверьте процесс SSH
ps aux | grep ssh

# Проверьте порты на сервере
sudo netstat -tulpn | grep 9000

# Проверьте логи агента
tail -f webssh-agent/agent.log
```

## Примеры использования

### Разработка
```bash
# Запустите локальное приложение
docker-compose up -d

# Запустите агент
cd webssh-agent && npm start

# Настройте туннель через веб-интерфейс
# Ваше приложение доступно по https://yourdomain.com
```

### Демонстрация клиентам
```bash
# Быстрая публикация для демо
# 1. Заполните форму в веб-интерфейсе
# 2. Нажмите "Опубликовать"
# 3. Отправьте клиенту ссылку https://yourdomain.com
```

### Тестирование на мобильных устройствах
```bash
# Опубликуйте приложение
# Теперь можете тестировать на любых устройствах
# через https://yourdomain.com
```

## Файловая структура

```
DApp-for-Business/
├── webssh-agent/                 # Локальный агент
│   ├── agent.js                 # Основной файл агента
│   ├── package.json             # Зависимости
│   ├── install.sh              # Установочный скрипт
│   └── README.md               # Документация агента
├── frontend/                    # Vue.js приложение
│   ├── src/
│   │   ├── views/settings/
│   │   │   └── WebSshSettingsView.vue  # Страница настроек
│   │   └── services/
│   │       └── webSshService.js        # Сервис для работы с агентом
│   └── ...
└── docker-compose.yml          # Конфигурация Docker
```

## Поддержка

Если у вас возникли проблемы:

1. Проверьте этот документ
2. Посмотрите логи агента: `tail -f webssh-agent/agent.log`
3. Проверьте статус: `curl http://localhost:12345/health`
4. Создайте Issue в репозитории проекта

## Лицензия

MIT License 