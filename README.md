# Digital_Legal_Entity(DLE)

Веб3 приложение для бизнеса с ИИ ассистентом

## Авторство и лицензия

**Автор:** Тарабанов Александр Викторович  
**Организация:** HB3 Accelerator  
**Email:** info@hb3-accelerator.com  
**Сайт:** [hb3-accelerator.com](https://hb3-accelerator.com)  
**GitHub:** [@HB3-ACCELERATOR](https://github.com/HB3-ACCELERATOR)

### Лицензия

Этот проект распространяется под **Proprietary Software License**. 

- ✅ **Разрешено:** Использование в бизнесе для внутренних операций
- ✅ **Разрешено:** Предоставление услуг клиентам с использованием софта
- ❌ **Запрещено:** Перепродажа софта без разрешения
- ❌ **Запрещено:** Модификации кода без разрешения автора

**Для коммерческого использования требуется разрешение автора.**  
**Контакты:** info@hb3-accelerator.com

**Подробная информация:** [legal/LICENSE.md](legal/LICENSE.md)

## Требования

- Docker и Docker Compose
- Git (или возможность скачать архив с GitHub)

## Быстрый запуск

### Вариант 1: через git (рекомендуется)

1. Клонируйте репозиторий:
```bash
git clone https://github.com/DAO-HB3-Accelerator/DLE.git
cd Digital_Legal_Entity(DLE)
```
2. Запустите скрипт установки:
```bash
./setup.sh
```
3. После запуска контейнеров выполните миграции изнутри контейнера backend:
```bash
docker exec -e NODE_ENV=migration dapp-backend yarn migrate
```

### Вариант 2: без git (через архив)

1. Перейдите на страницу проекта: https://github.com/DAO-HB3-Accelerator/DLE
2. Нажмите кнопку **Code** → **Download ZIP**
3. Распакуйте архив и перейдите в папку проекта:
```bash
cd Digital_Legal_Entity(DLE)
```
4. Запустите скрипт установки:
```bash
./setup.sh
```
5. После запуска контейнеров выполните миграции:
```bash
docker exec -e NODE_ENV=migration dapp-backend yarn migrate
```

---

**setup.sh** автоматически:
- Проверит наличие Docker и Docker Compose
- На Linux — предложит автоматическую установку Docker, если он не установлен
- Для Windows/Mac — выведет ссылку на официальный установщик Docker Desktop
- Запустит PostgreSQL, Ollama, backend и frontend сервисы
- Выведет адреса для доступа к сервисам

## Доступные сервисы

После успешного запуска вы получите доступ:

- Frontend: http://localhost:5173

## Ручной запуск

Если вы хотите запустить проект вручную:

```bash
# Запуск в фоновом режиме
docker compose up -d

# Запуск с логами
docker compose up

# Перезапуск контейнеров
docker-compose restart

# Остановка сервисов
docker compose down

# Остановка сервисов и удаление томов
docker compose down -v
```

## Контакты и поддержка

### Для вопросов по разработке:
- **GitHub Issues:** [Создать issue](https://github.com/DAO-HB3-Accelerator/DLE/issues)
- **Email:** info@hb3-accelerator.com

### Для коммерческого лицензирования:
- **Email:** info@hb3-accelerator.com
- **Тема:** "Commercial License Request - DLE"
- **Шаблон запроса:** [legal/COMMERCIAL_LICENSE_REQUEST.md](legal/COMMERCIAL_LICENSE_REQUEST.md)

### Юридические документы:
- **Лицензия:** [LICENSE](LICENSE) | [Подробно](legal/LICENSE.md)
- **Авторы:** [legal/AUTHORS.md](legal/AUTHORS.md)
- **Для контрибьюторов:** [legal/CONTRIBUTING.md](legal/CONTRIBUTING.md)
- **Уведомления об авторских правах:** [legal/COPYRIGHT_NOTICE.md](legal/COPYRIGHT_NOTICE.md)

---

**© 2024-2025 Тарабанов Александр Викторович. Все права защищены.**