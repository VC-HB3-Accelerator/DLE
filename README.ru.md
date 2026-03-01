[English](README.md) | **Русский**

---

# Digital Legal Entity (DLE) — шаблон приложения

## Определение продукта

**Digital Legal Entity (DLE)** — микросервисная платформа с веб-приложением для локальной установки на серверах компании.

**Включает:**
- Инструменты настройки ИИ-агентов
- Систему смарт-контрактов с поддержкой:
  - Налоговых, бухгалтерских, банковских и иных идентификаторов, установленных регулятором

**Преимущества:**
- Управление и автоматизация бизнес-процессов
- Замена разрозненных SaaS-сервисов с ежемесячными подписками
- Соответствие требованиям регуляторов к хранению и обработке данных


## Доступные документы

| Файл | Краткое описание |
| --- | --- |
| [application-description.md](docs.ru/application-description.md) | Обзор назначения платформы, ключевых преимуществ и экономического эффекта. |
| [ai-assistant.md](docs.ru/ai-assistant.md) | ИИ-агенты: архитектура, создание агентов под бизнес-процессы, примеры и экономический эффект. |
| [blockchain-for-business.md](docs.ru/blockchain-for-business.md) | Бизнес-обоснование и кейсы использования блокчейна в DLE. |
| [security.md](docs.ru/security.md) | Модель безопасности, контроль доступа и защитные механизмы. |
| [service-terms.md](docs.ru/service-terms.md) | Подробные условия приобретения и обслуживания лицензии. |
| [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/ru/FAQ.md) | Часто задаваемые вопросы. |

### Смежные материалы

- [Юридические документы](legal.ru/README.md) — лицензия, авторские права, требования к атрибуции
- [Документация на английском](README.md) — [docs.en](docs.en/) (в т.ч. [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md))


## Полный шаблон приложения Digital Legal Entity для развертывания на собственной инфраструктуре.

## Требования
- Docker и Docker Compose

## Быстрый запуск

### Автоматическая установка (рекомендуется)

**Для Linux/macOS/WSL:**
```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh | bash
```
Скрипт автоматически скачивает последние артефакты из релиза и разворачивает `docker-data`.

### Релизы и артефакты
- [Релиз v1.0.3](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.3) (Latest) — содержит полный шаблон приложения с Docker образами, томами и ключом шифрования. Архив разделен на части (`dle-template.tar.gz.part-*`) для удобства загрузки.
- [Релиз v1.0.2](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.2) — предыдущая версия.
- [Релиз v1.0.1](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.1) — предыдущая версия.
- [Релиз v1.0.0](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) — предыдущая версия.

### Запуск приложения
```bash
docker-compose up -d
```

### Доступ к приложению

#### Продакшн (production)
- **Frontend**: http://localhost:9000 (HTTP)

### Остановка
```bash
docker-compose-down
```

### Контакты
- **Email:** info@hb3-accelerator.com
- **Поддержка:** https://hb3-accelerator.com/

---
*Тест пуша в Gitea (можно удалить после проверки).*