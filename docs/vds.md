# Задача: Простая настройка VDS с автоматической установкой Ubuntu

## 🎯 **Описание задачи:**

### **Цель:**
Создать простую форму для автоматической настройки VDS сервера с установкой Ubuntu и деплоем DLE приложения.

### **Проблема:**
Нужно вручную настраивать VDS сервер, устанавливать Ubuntu и необходимые компоненты для работы DLE приложения.

### **Решение:**
Автоматическая очистка VDS, установка Ubuntu, создание пользователя и деплой DLE приложения через локальную форму.

## 📋 **Требования:**

### **1. Входные данные (8 полей):**
- **Домен** - например `example.com` (IP адрес определяется автоматически из DNS)
- **Email** - для SSL сертификата
- **Логин Ubuntu** - пользователь для VDS (по умолчанию `ubuntu`, создается БЕЗ пароля)
- **Логин Docker** - пользователь для Docker (по умолчанию `docker`, создается БЕЗ пароля)
- **SSH хост** - SSH хост сервера (может отличаться от домена)
- **SSH порт** - SSH порт сервера (обычно 22)
- **SSH пользователь** - пользователь для SSH подключения (обычно `root`)
- **SSH пароль** - пароль для SSH подключения к VDS

### **1.1. Требования к домену:**
- **A запись** `example.com` → IP VDS сервера
- **CNAME запись** `www.example.com` → `example.com` (опционально)
- **Домен должен быть активен** и доступен
- **DNS записи должны распространиться** (проверка перед настройкой)

### **2. Что должно происходить:**
1. **Проверка DNS** - валидация A записи домена
2. **Подключение** к VDS по SSH (root + пароль)
3. **Создание SSH ключей на хосте** агентом автоматически (доступны в контейнерах через монтирование)
4. **Очистка** всего содержимого на VDS
5. **Создание пользователя Ubuntu** БЕЗ пароля (только SSH ключи)
6. **Создание пользователя Docker** БЕЗ пароля (только SSH ключи)
7. **Установка** Docker, Docker Compose, nginx
8. **Настройка безопасности** (UFW, отключение парольной аутентификации)
9. **Настройка** nginx для продакшн приложения
10. **Получение** SSL сертификата
11. **Экспорт и передача** Docker образов с локальной машины
12. **Передача ключа шифрования** на VDS
13. **Запуск** DLE приложения в Docker

### **3. Результат:**
- **VDS полностью очищена** и настроена
- **Пользователи Ubuntu и Docker** созданы БЕЗ паролей (только SSH ключи)
- **Базовый софт установлен** (Docker, nginx, SSL)
- **Безопасность настроена** (UFW, отключение парольной аутентификации)
- **Docker образы** экспортированы и переданы с локальной машины
- **Ключ шифрования** передан с локальной машины на VDS
- **SSH ключи** настроены для безопасного доступа
- **DLE приложение** работает в Docker на VDS
- **Домен работает** с SSL
- **Приложение работает** автономно на VDS

## 🏗️ **Архитектура:**

```
Продакшн режим:
Интернет → VDS nginx (домен) → VDS Docker приложение (автономно)

Настройка:
Локальная машина → WebSSH Agent (Docker) → SSH → VDS сервер → Очистка + Ubuntu + Docker миграция
```

## 🤖 **WebSSH Agent - Автоматизация развертывания:**

### 🚀 **Возможности агента:**

WebSSH Agent - это мощный инструмент для автоматического развертывания приложения на VDS серверах. 

**Архитектура:**
- Агент работает в Docker контейнере `dapp-webssh-agent`
- Порт 3000 проброшен с контейнера на хост (`0.0.0.0:3000->3000/tcp`)
- Доступен локально через `http://localhost:3000`
- Имеет расширенные права для автоматизации развертывания

#### 🔐 **Права доступа:**
- **SSH ключи:** Полный доступ к локальным SSH ключам (`~/.ssh/`)
- **Docker API:** Полный доступ к Docker socket для управления контейнерами
- **Файловая система:** Доступ к временным файлам и SSL сертификатам
- **Сетевые операции:** Выполнение SSH/SCP команд на удаленных серверах

#### 🛠️ **Функциональность:**
- **Автоматическая настройка VDS:** Установка Docker, Nginx, SSL сертификатов
- **Передача Docker образов:** Экспорт локальных образов и импорт на VDS
- **Управление пользователями:** Создание системных пользователей с SSH доступом
- **Безопасность:** Настройка firewall, отключение парольной аутентификации
- **Мониторинг:** Проверка системных требований и состояния серверов

#### 🔒 **Безопасность:**
- Агент работает в Docker контейнере, порт 3000 проброшен на хост
- SSH ключи монтируются в режиме только чтения
- Docker socket доступен только для управления контейнерами
- Все операции логируются для аудита
- Доступен локально через `http://localhost:3000`

#### 📡 **API Endpoints:**
- `GET /health` - Проверка состояния агента
- `POST /vds/check-requirements` - Проверка системных требований VDS
- `POST /vds/setup` - Полная настройка VDS сервера
- `POST /vds/transfer-encryption-key` - Передача ключей шифрования

### 🚨 **Важно:**
Агент имеет расширенные права для автоматизации развертывания. Используйте только на доверенных серверах и в защищенных сетях.

### 🔍 **Проверка работы агента:**

```bash
# Проверка состояния агента
curl http://localhost:3000/health

# Просмотр логов агента
docker logs dapp-webssh-agent

# Проверка статуса контейнера
docker ps | grep webssh-agent
```

**Ожидаемый ответ от /health:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-02T16:33:16.477Z",
  "version": "1.0.0",
  "vdsConfigured": false,
  "vdsDomain": null
}
```

## 🔑 **Логика SSH ключей:**

### **Автоматическое создание SSH ключей агентом:**

#### **📍 На локальной машине (в агенте):**
- ✅ **id_rsa** (приватный ключ) - создается агентом автоматически
- ✅ **id_rsa.pub** (публичный ключ) - создается агентом автоматически

#### **📍 На VDS сервере:**
- ✅ **id_rsa.pub** (публичный ключ) - добавляется в `/root/.ssh/authorized_keys`
- ✅ **id_rsa.pub** (публичный ключ) - добавляется в `/home/ubuntu/.ssh/authorized_keys`
- ✅ **id_rsa.pub** (публичный ключ) - добавляется в `/home/docker/.ssh/authorized_keys`
- ❌ **id_rsa** (приватный ключ) - НЕ передается на VDS

### **Процесс аутентификации:**
```
1. Агент создает SSH ключи на хосте: ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa
2. Агент добавляет публичный ключ в authorized_keys на VDS
3. Агент подключается: ssh -i ~/.ssh/id_rsa root@VDS_IP
4. VDS проверяет подпись с помощью публичного ключа
5. Доступ разрешен для всех пользователей (root, ubuntu, docker)
```

## 🔧 **Важные особенности архитектуры:**

#### **На локальной машине (разработка):**
- ✅ Git репозиторий с историей изменений
- ✅ Возможность отката к предыдущим версиям
- ✅ Разработка и тестирование
- ✅ Создание архивов для продакшн

#### **На VDS сервере (продакшн):**
- ❌ Git НЕ устанавливается и НЕ нужен
- ❌ История изменений НЕ хранится
- ❌ Откат происходит через архивы с локальной машины
- ✅ Только работающая версия приложения
- ✅ Полная автономность без внешних зависимостей

### **Компоненты:**
1. **Веб-форма** - настройка VDS (8 полей, без лишних настроек портов)
2. **WebSSH сервис** - SSH команды к VDS с автоматическим определением IP
3. **SSH агент** - подключение к VDS
4. **VDS сервер** - Ubuntu + Docker + nginx + SSL + Node.js
5. **Docker образы** - мигрированы с локальной машины
6. **База данных** - с зашифрованными настройками в таблицах

## 🚀 **Процесс работы:**

### **1. Первоначальная настройка:**
- Заходит на `http://localhost:5173/settings/interface/webssh`
- Заполняет форму с данными VDS (8 полей: домен, email, логины, SSH хост/порт/пользователь/пароль)
- Нажимает "Опубликовать" (настроить VDS)

### **2. Система настраивает VDS:**
- **Получает IP адрес** из DNS записей домена автоматически
- **Проверяет доступность** домена и IP
- **Предупреждает** если домен не готов
- Подключается к VDS по SSH (root + пароль)
- **Создает SSH ключи** агентом автоматически
- **Очищает** все содержимое на VDS
- **Создает пользователя Ubuntu** БЕЗ пароля (только SSH ключи)
- **Создает пользователя Docker** БЕЗ пароля (только SSH ключи)
- **Устанавливает** Docker, Docker Compose, nginx
- **Настраивает безопасность** (UFW, отключение парольной аутентификации)
- Настраивает nginx для продакшн
- Получает SSL сертификат
- **Экспортирует и передает** Docker образы с локальной машины
- **Передает ключ шифрования** на VDS
- **Запускает** DLE приложение в Docker

### **3. Результат:**
- **VDS полностью готова** для работы
- **Пользователи Ubuntu и Docker** созданы БЕЗ паролей (только SSH ключи)
- **Базовый софт установлен** (Docker, nginx, SSL)
- **Безопасность настроена** (UFW, отключение парольной аутентификации)
- **Docker образы** экспортированы и переданы с локальной машины
- **Ключ шифрования** передан с локальной машины на VDS
- **SSH ключи** настроены для безопасного доступа
- **DLE приложение** работает автономно в Docker
- **Домен доступен** с SSL
- **Полная автономность** - никаких внешних зависимостей

## 🔧 **Детальная логика установки софта на VDS:**

### **Этап 1: Проверка и подготовка**
```bash
# 1. Получение IP адреса из DNS записей домена
VDS_IP=$(dig +short $DOMAIN | head -1)
echo "IP адрес VDS сервера: $VDS_IP"

# 2. Проверка подключения к VDS
ssh -o ConnectTimeout=10 -o BatchMode=yes $SSH_USER@$VDS_IP "echo 'Connection OK'"
```

### **Этап 2: Очистка VDS**
```bash
# 1. Подключение к VDS
ssh $SSH_USER@$VDS_IP

# 2. Остановка всех сервисов
systemctl stop nginx || true
systemctl stop docker || true
systemctl stop postgresql || true

# 3. Очистка системы
apt-get autoremove -y
apt-get autoclean
rm -rf /var/log/*.log
rm -rf /tmp/*
rm -rf /var/tmp/*
```

### **Этап 3: Установка Ubuntu и базовых пакетов**
```bash
# 1. Обновление системы
apt-get update && apt-get upgrade -y

# 2. Установка базовых пакетов
# ВАЖНО: Git НЕ устанавливается - все обновления идут с локальной машины через архивы
apt-get install -y \
    curl wget nginx certbot python3-certbot-nginx \
    ufw fail2ban nano htop unzip tar gzip \
    openssh-server ca-certificates gnupg lsb-release \
    software-properties-common apt-transport-https

# 3. Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# 4. Установка Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 5. Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### **Этап 4: Создание пользователей**
```bash
# 1. Создание пользователя Ubuntu
useradd -m -s /bin/bash $UBUNTU_USER
echo "$UBUNTU_USER:$UBUNTU_PASSWORD" | chpasswd
usermod -aG sudo $UBUNTU_USER

# 2. Создание пользователя Docker
useradd -m -s /bin/bash $DOCKER_USER
echo "$DOCKER_USER:$DOCKER_PASSWORD" | chpasswd
usermod -aG docker $DOCKER_USER
usermod -aG sudo $DOCKER_USER
```

### **Этап 5: Настройка безопасности**
```bash
# 1. Настройка UFW Firewall
ufw --force enable
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 8000
ufw allow 5173

# 2. Настройка Fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# 3. Настройка SSH
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd
```

### **Этап 6: Настройка Nginx**
```bash
# 1. Создание конфигурации для домена
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Основной location для фронтенда
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # API проксирование к backend
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 2. Активация конфигурации
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### **Этап 7: Получение SSL сертификата**
```bash
# 1. Получение SSL сертификата
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL

# 2. Настройка автообновления
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

### **Этап 8: Миграция Docker образов**
```bash
# 1. Создание директории для приложения
mkdir -p /home/$DOCKER_USER/dapp
cd /home/$DOCKER_USER/dapp

# 2. Создание бэкапа на локальной машине
docker compose down
docker compose up -d postgres
sleep 10
docker compose exec -T postgres pg_dump -U dapp_user dapp_db > postgres-backup.sql
docker compose exec -T ollama ollama list > ollama-models.txt

# 3. Создание архива приложения
tar -czf app-migration-$(date +%Y%m%d-%H%M%S).tar.gz \
    . \
    postgres-backup.sql \
    ollama-models.txt \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='temp' \
    --exclude='sessions'

# 4. Копирование архива на VDS
scp app-migration-*.tar.gz $DOCKER_USER@$VDS_IP:/home/$DOCKER_USER/dapp/

# 5. Распаковка на VDS
ssh $DOCKER_USER@$VDS_IP "cd /home/$DOCKER_USER/dapp && tar -xzf app-migration-*.tar.gz"
```

### **Этап 9: Передача ключей**
```bash
# 1. Создание директории для ключей на VDS
ssh root@$VDS_IP "mkdir -p /home/$DOCKER_USER/dapp/ssl/keys"

# 2. Копирование ключа шифрования БД
scp ./ssl/keys/full_db_encryption.key root@$VDS_IP:/home/$DOCKER_USER/dapp/ssl/keys/

# 3. Настройка SSH ключей (выполняется автоматически агентом)
# Публичный ключ (id_rsa.pub) добавляется в /root/.ssh/authorized_keys
# Приватный ключ (id_rsa) остается на локальной машине
```

### **Этап 10: Восстановление базы данных с настройками**
```bash
# 1. Запуск PostgreSQL на VDS
ssh $DOCKER_USER@$VDS_IP "cd /home/$DOCKER_USER/dapp && docker compose up -d postgres"
sleep 10

# 2. Восстановление базы данных (включая все таблицы настроек)
ssh $DOCKER_USER@$VDS_IP "cd /home/$DOCKER_USER/dapp && docker compose exec -T postgres psql -U dapp_user -d dapp_db < postgres-backup.sql"
```

### **Этап 11: Запуск приложения**
```bash
# 1. Запуск всех сервисов
ssh $DOCKER_USER@$VDS_IP "cd /home/$DOCKER_USER/dapp && docker compose up -d"

# 2. Проверка статуса
ssh $DOCKER_USER@$VDS_IP "cd /home/$DOCKER_USER/dapp && docker compose ps"

# 3. Проверка логов
ssh $DOCKER_USER@$VDS_IP "cd /home/$DOCKER_USER/dapp && docker compose logs --tail=20"
```

### **Этап 12: Проверка работоспособности**
```bash
# 1. Проверка доступности домена
curl -I https://$DOMAIN

# 2. Проверка API
curl -I https://$DOMAIN/api/health

# 3. Проверка SSL сертификата
openssl s_client -connect $DOMAIN:443 -servername $DOMAIN
```

## 🔄 **Процесс обновлений приложения:**

### **Обновление с локальной машины:**
```bash
# 1. На локальной машине - разработка
git add .
git commit -m "Новая функция"
git tag v1.2.0

# 2. Создание архива для продакшн
tar -czf app-update-v1.2.0-$(date +%Y%m%d-%H%M%S).tar.gz \
    . \
    postgres-backup.sql \
    ollama-models.txt \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='temp' \
    --exclude='sessions'

# 3. Деплой на VDS
scp app-update-v1.2.0-*.tar.gz $DOCKER_USER@$VDS_IP:/home/$DOCKER_USER/dapp/
ssh $DOCKER_USER@$VDS_IP "cd /home/$DOCKER_USER/dapp && tar -xzf app-update-v1.2.0-*.tar.gz && docker compose restart"
```

### **Откат к предыдущей версии:**
```bash
# 1. На локальной машине - переход к предыдущей версии
git checkout v1.1.0

# 2. Создание архива предыдущей версии
tar -czf app-rollback-v1.1.0-$(date +%Y%m%d-%H%M%S).tar.gz \
    . \
    postgres-backup.sql \
    ollama-models.txt \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='temp' \
    --exclude='sessions'

# 3. Деплой предыдущей версии на VDS
scp app-rollback-v1.1.0-*.tar.gz $DOCKER_USER@$VDS_IP:/home/$DOCKER_USER/dapp/
ssh $DOCKER_USER@$VDS_IP "cd /home/$DOCKER_USER/dapp && tar -xzf app-rollback-v1.1.0-*.tar.gz && docker compose restart"
```

### **Ключевые принципы:**
- **Все обновления** идут с локальной машины через архивы
- **Все откаты** происходят с локальной машины через архивы
- **VDS** никогда не работает с Git - только с архивами
- **Полная автономность** - VDS работает без внешних зависимостей

## 📁 **Файлы проекта:**

### **Frontend:**
- `frontend/src/components/WebSshForm.vue` - форма управления
- `frontend/src/services/webSshService.js` - SSH команды к VDS

### **Backend:**
- `backend/routes/vds-management.js` - API для управления VDS
- `backend/services/sshManager.js` - SSH команды
- `backend/services/encryptionManager.js` - управление шифрованием

### **Scripts:**
- `scripts/setup-vds.sh` - очистка VDS и установка Ubuntu
- `scripts/migrate-docker.sh` - миграция Docker образов на VDS
- `scripts/configure-vds.sh` - настройка nginx и SSL
- `scripts/transfer-keys.sh` - передача ключей на VDS
- `scripts/restore-database.sh` - восстановление БД с настройками
- `scripts/install-ubuntu.sh` - автоматическая установка Ubuntu

## ✅ **Статус:**

### **Готово:**
- ✅ Форма WebSSH упрощена
- ✅ WebSSH сервис обновлен
- ✅ DNS проверка добавлена
- ✅ Инструкции по настройке DNS созданы
- ✅ Поле VDS IP добавлено в форму

### **Нужно доработать:**
- 🔄 SSH агент для очистки и установки Ubuntu
- 🔄 API для управления VDS
- 🔄 Миграция Docker образов на VDS
- 🔄 Передача ключей (шифрования и RSA) на VDS
- 🔄 Восстановление БД с зашифрованными настройками
- 🔄 Автоматическая загрузка ключа шифрования в форму

## 🎯 **Следующие шаги:**

1. **Создать SSH агент** для очистки и установки Ubuntu
2. **Добавить API** для управления VDS
3. **Реализовать миграцию** Docker образов на VDS
4. **Создать скрипты** для передачи ключей на VDS
5. **Реализовать восстановление** БД с зашифрованными настройками
6. **Добавить автоматическую загрузку** ключа шифрования в форму
7. **Протестировать** на реальной VDS