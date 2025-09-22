<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

# Архитектура фронтенда DLE

## 📁 Структура сервисов

### 🎯 Принцип разделения ответственности

Каждый сервис отвечает за свою область функциональности:

```
services/
├── dleV2Service.js      - Основные функции DLE (создание, чтение, управление)
├── modulesService.js    - Управление модулями DLE
├── proposalsService.js  - Управление предложениями и голосованием
├── tokensService.js     - Работа с токенами и балансами
├── analyticsService.js  - Аналитические данные и статистика
├── multichainService.js - Мультичейн функциональность
└── index.js            - Индексный файл для удобного импорта
```

### 🔧 Использование сервисов

#### Импорт отдельных сервисов:
```javascript
import { getDLEInfo } from '@/services/dleV2Service.js';
import { createAddModuleProposal } from '@/services/modulesService.js';
import { createProposal } from '@/services/proposalsService.js';
import { getTokenBalance } from '@/services/tokensService.js';
```

#### Импорт через индексный файл:
```javascript
import { 
  getDLEInfo, 
  createAddModuleProposal, 
  createProposal, 
  getTokenBalance 
} from '@/services/index.js';
```

## 📄 Страницы управления DLE

### 🎨 Компоненты страниц:

| Страница | Файл | Используемые сервисы | Описание |
|----------|------|---------------------|----------|
| **Модули** | `ModulesView.vue` | `modulesService.js` | Управление модулями DLE |
| **Предложения** | `DleProposalsView.vue` | `proposalsService.js` | Управление предложениями |
| **Токены** | `TokensView.vue` | `tokensService.js` | Работа с токенами |
| **Кворум** | `QuorumView.vue` | `proposalsService.js` | Настройки голосования |
| **Аналитика** | `AnalyticsView.vue` | `analyticsService.js` | Аналитические данные |
| **История** | `HistoryView.vue` | `dleV2Service.js` | История операций |
| **Настройки** | `SettingsView.vue` | `dleV2Service.js` | Настройки DLE |
| **Управление DLE** | `DleManagementView.vue` | - | Добавление DLE в список |

## 🔄 Архитектурные принципы

### 1. **Разделение ответственности**
- Каждый сервис отвечает за свою область
- Функции не дублируются между сервисами
- Четкие границы между модулями

### 2. **Единообразие API**
- Все сервисы используют одинаковый формат ответов
- Единообразная обработка ошибок
- Консистентные названия функций

### 3. **Простота использования**
- Интуитивно понятные названия функций
- Подробная документация JSDoc
- Примеры использования

### 4. **Масштабируемость**
- Легко добавлять новые функции
- Простое тестирование отдельных модулей
- Возможность переиспользования

## 🛠️ Утилиты

### `dle-contract.js`
Используется только для транзакций через MetaMask:
- Создание предложений
- Голосование
- Исполнение предложений
- Деактивация DLE

### `utils/websocket.js`
Для real-time обновлений:
- Уведомления о новых предложениях
- Обновления статуса голосования
- Синхронизация данных

## 📊 Статистика кода

| Сервис | Строк | Функций | Описание |
|--------|-------|---------|----------|
| `dleV2Service.js` | 220 | 8 | Основные функции DLE |
| `modulesService.js` | 298 | 5 | Управление модулями |
| `proposalsService.js` | 264 | 12 | Управление предложениями |
| `tokensService.js` | 72 | 3 | Работа с токенами |
| `analyticsService.js` | 320 | 16 | Аналитические данные |
| `multichainService.js` | 353 | 18 | Мультичейн функциональность |

## 🚀 Преимущества новой архитектуры

1. **✅ Читаемость** - код легко понять и поддерживать
2. **✅ Тестируемость** - каждый сервис можно тестировать отдельно
3. **✅ Переиспользование** - функции можно использовать в разных компонентах
4. **✅ Масштабируемость** - легко добавлять новые функции
5. **✅ Производительность** - загрузка только нужных модулей
6. **✅ Поддержка** - простое исправление ошибок и добавление функций
