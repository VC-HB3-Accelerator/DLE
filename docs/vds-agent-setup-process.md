# Процесс настройки VDS агентом

## 📋 Полная последовательность настройки VDS

### **🎯 Что делает агент при настройке VDS:**

#### **1. Создание SSH ключей агентом на хосте (Этап 1-2)**
```bash
# Агент создает SSH ключи на хосте (не в контейнере!)
ssh-keygen -t rsa -b 4096 -C "email@example.com" -f ~/.ssh/id_rsa -N ""

# Автоматическое исправление прав доступа к SSH конфигу
chmod 600 /root/.ssh/config 2>/dev/null || true

# Установка правильных прав доступа к созданным ключам
chmod 600 /root/.ssh/id_rsa
chmod 644 /root/.ssh/id_rsa.pub

# Ключи автоматически доступны в контейнерах через монтирование:
# ~/.ssh:/root/.ssh:rw (в docker-compose.yml)

# Создание директории .ssh для root на VDS
sudo mkdir -p /root/.ssh
sudo chmod 700 /root/.ssh

# Добавление публичного ключа в authorized_keys на VDS
echo "ssh-rsa AAAAB3NzaC1yc2E..." | sudo tee -a /root/.ssh/authorized_keys
sudo chmod 600 /root/.ssh/authorized_keys
sudo chown root:root /root/.ssh/authorized_keys
```

**⚠️ Важно:** SSH ключи создаются на хосте и автоматически доступны в контейнерах через монтирование `~/.ssh:/root/.ssh:rw` в docker-compose.yml. Это позволяет SSH Key Server находить ключи для health check.

#### **2. Создание пользователей БЕЗ паролей (Этап 3-4)**
```bash
# Создание пользователя Ubuntu БЕЗ пароля
sudo useradd -m -s /bin/bash ubuntu
sudo usermod -aG sudo ubuntu

# Создание пользователя Docker БЕЗ пароля
sudo useradd -m -s /bin/bash docker
sudo usermod -aG sudo docker
sudo usermod -aG docker docker

# Создание директории для приложения
sudo mkdir -p /home/docker/dapp
sudo chown docker:docker /home/docker/dapp
```

#### **3. Установка Docker и Docker Compose (Этап 5-6)**
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker docker

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### **4. Настройка firewall (Этап 7)**
```bash
# Настройка UFW
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
```

#### **5. Сохранение ключа шифрования (Этап 8)**
```bash
# Создание директории для ключей
sudo mkdir -p /home/docker/dapp/ssl/keys

# Сохранение ключа шифрования
echo 'encryption-key-content' | sudo tee /home/docker/dapp/ssl/keys/full_db_encryption.key
sudo chmod 600 /home/docker/dapp/ssl/keys/full_db_encryption.key
sudo chown docker:docker /home/docker/dapp/ssl/keys/full_db_encryption.key
```

#### **6. Установка Nginx и SSL сертификатов (Этап 9)**
```bash
# Установка Nginx
sudo apt-get install -y nginx
sudo systemctl enable nginx

# Установка Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Получение SSL сертификата
sudo certbot --nginx -d example.com --email admin@example.com --agree-tos --non-interactive
```

#### **7. Создание конфигурации приложения (Этап 9.4-9.5)**
```bash
# Создание docker-compose.yml
cat > /home/docker/dapp/docker-compose.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: dapp-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=dapp_db
      - POSTGRES_USER=dapp_user
      - POSTGRES_PASSWORD=dapp_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  ollama:
    image: dapp-ollama:latest
    container_name: dapp-ollama
    restart: unless-stopped
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"

  vector-search:
    image: dapp-vector-search:latest
    container_name: dapp-vector-search
    restart: unless-stopped
    ports:
      - "8080:8080"

  backend:
    image: dapp-backend:latest
    container_name: dapp-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=8000
      - FRONTEND_URL=https://${DOMAIN}
    depends_on:
      - postgres
      - ollama
      - vector-search

  frontend-nginx:
    image: dapp-frontend-nginx:latest
    container_name: dapp-frontend-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      - DOMAIN=${DOMAIN}
      - BACKEND_CONTAINER=dapp-backend
    volumes:
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - backend

volumes:
  postgres_data:
  ollama_data:
EOF

# Создание .env файла
cat > /home/docker/dapp/.env << EOF
DOMAIN=example.com
BACKEND_CONTAINER=dapp-backend
EOF
```

#### **8. Импорт Docker образов (Этап 10)**
```bash
# Проверка наличия Docker образов
if [ -f /home/docker/dapp/docker-images.tar.gz ]; then
  echo "Импорт Docker образов..."
  cd /home/docker/dapp
  sudo chmod +x import-images.sh
  ./import-images.sh
else
  echo "Docker образы не найдены. Образы будут собираться на VDS."
fi
```

#### **9. Запуск приложения (Этап 11-12)**
```bash
# Запуск приложения
cd /home/docker/dapp
sudo docker compose up -d

# Проверка статуса контейнеров
sudo docker ps --format "table {{.Names}}\t{{.Status}}"
```

## ✅ **Результат настройки:**

### **Что получается после настройки:**
1. **✅ SSH ключи** созданы агентом автоматически
2. **✅ Пользователи Ubuntu и Docker** созданы БЕЗ паролей (только SSH ключи)
3. **✅ Docker и Docker Compose** установлены
4. **✅ Firewall** настроен (SSH, HTTP, HTTPS)
5. **✅ Ключ шифрования** передан с локальной машины
6. **✅ Nginx** установлен и настроен
7. **✅ SSL сертификат** получен от Let's Encrypt
8. **✅ Docker образы** экспортированы и переданы с локальной машины
9. **✅ Docker контейнеры** запущены и работают
10. **✅ Приложение** доступно по HTTPS

### **URL приложения:**
- **HTTP:** `http://example.com`
- **HTTPS:** `https://example.com` ✅ (основной)

## 🚨 **Важные моменты:**

### **Предварительные требования:**
1. **Домен** должен указывать на IP VDS сервера (A запись)
2. **VDS сервер** должен быть доступен по SSH
3. **Пользователь** должен иметь права sudo на VDS
4. **Порты 80 и 443** должны быть открыты

### **Что НЕ настраивается агентом:**
1. **База данных** - создается при первом запуске контейнеров
2. **Данные приложения** - нужно будет восстановить отдельно
3. **Резервное копирование** - настраивается отдельно

## 📝 **Логи настройки:**
Агент выводит подробные логи каждого этапа настройки, что позволяет отслеживать прогресс и выявлять проблемы.

## 🔧 **Исправления SSH проблем (v1.1):**

### **Проблема:**
SSH команды падали с ошибкой `Bad owner or permissions on /root/.ssh/config`, что препятствовало подключению к VDS серверам.

### **Решение:**
1. **Dockerfile:** Добавлено создание SSH конфига с правильными правами доступа (600)
2. **SSH утилиты:** Добавлена функция `fixSshPermissions()` для автоматического исправления прав
3. **Создание ключей:** Улучшена функция создания SSH ключей с установкой правильных прав доступа
4. **Предварительная проверка:** Каждая SSH/SCP команда теперь автоматически исправляет права доступа

### **Результат:**
- ✅ Устранена ошибка "Bad owner or permissions on /root/.ssh/config"
- ✅ Повышена надежность SSH подключений
- ✅ Автоматическое исправление прав доступа
- ✅ Сохранена вся существующая функциональность

### **Для применения исправлений:**
```bash
# Пересборка контейнера с исправлениями
docker compose build dapp-webssh-agent
docker compose restart dapp-webssh-agent
```
