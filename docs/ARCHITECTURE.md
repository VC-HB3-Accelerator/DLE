# Архитектура проекта DLE

## 🎯 Общий принцип

**Backend** - только для чтения данных из блокчейна
**Frontend** - для выполнения транзакций через MetaMask

---

## 📋 Что у нас есть:

### 1. ✅ **Смарт контракт DLE.sol**
- Находится в `backend/contracts/DLE.sol`
- Содержит все функции для управления DLE
- Деплоится в сеть Sepolia (Chain ID: 11155111)

### 2. ✅ **Backend API (модульная архитектура)**
- **Порт:** 8000
- **Принцип:** Разделение по функциональности
- **Функции только для чтения данных из блокчейна**

### 3. ✅ **Frontend (выполнение транзакций)**
- Файл: `frontend/src/utils/dle-contract.js`
- Порт: 5173
- **Функции для выполнения транзакций через MetaMask**

---

## 🔄 Как это работает:

### **Чтение данных:**
```
Frontend → Backend API → Blockchain
```

### **Выполнение транзакций:**
```
Frontend → MetaMask → Blockchain
```

---

## 📚 Backend API (модульная архитектура):

### 🏗️ Структура модулей:

```
backend/routes/
├── dleCore.js        # Основные функции DLE
├── dleProposals.js   # Функции предложений
├── dleModules.js     # Функции модулей
├── dleTokens.js      # Функции токенов
├── dleAnalytics.js   # Аналитика и история
├── dleMultichain.js  # Мультичейн функции
└── blockchain.js     # Устаревший монолитный файл
```

### 🔧 Модули и их функции:

#### **dleCore.js** - Основные функции DLE:
- `POST /dle-core/read-dle-info` - информация о DLE
- `POST /dle-core/get-governance-params` - параметры управления
- `POST /dle-core/is-active` - проверка активности DLE
- `POST /dle-core/deactivate-dle` - проверка возможности деактивации

#### **dleProposals.js** - Функции предложений:
- `POST /dle-proposals/get-proposals` - список предложений
- `POST /dle-proposals/get-proposal-info` - информация о предложении
- `POST /dle-proposals/get-proposal-state` - состояние предложения
- `POST /dle-proposals/get-proposal-votes` - голоса по предложению
- `POST /dle-proposals/get-proposals-count` - количество предложений
- `POST /dle-proposals/list-proposals` - список с пагинацией
- `POST /dle-proposals/get-voting-power-at` - голосующая сила
- `POST /dle-proposals/get-quorum-at` - требуемый кворум

#### **dleModules.js** - Функции модулей:
- `POST /dle-modules/is-module-active` - активность модуля
- `POST /dle-modules/get-module-address` - адрес модуля
- `POST /dle-modules/get-all-modules` - все модули
- `POST /dle-modules/create-add-module-proposal` - предложение добавления
- `POST /dle-modules/create-remove-module-proposal` - предложение удаления

#### **dleTokens.js** - Функции токенов:
- `POST /dle-tokens/get-token-balance` - баланс токенов
- `POST /dle-tokens/get-total-supply` - общее предложение
- `POST /dle-tokens/get-token-holders` - держатели токенов

#### **dleAnalytics.js** - Аналитика и история:
- `POST /dle-analytics/get-dle-analytics` - аналитика DLE
- `POST /dle-analytics/get-dle-history` - история событий

#### **dleMultichain.js** - Мультичейн функции:
- `POST /dle-multichain/get-supported-chains` - поддерживаемые сети
- `POST /dle-multichain/is-chain-supported` - проверка поддержки сети
- `POST /dle-multichain/get-supported-chain-count` - количество сетей
- `POST /dle-multichain/get-supported-chain-id` - ID сети по индексу
- `POST /dle-multichain/check-chain-connection` - подключение к сети
- `POST /dle-multichain/check-sync-readiness` - готовность синхронизации
- `POST /dle-multichain/sync-to-all-chains` - синхронизация
- `POST /dle-multichain/execute-proposal-by-signatures` - исполнение по подписям

### Что НЕ делает backend:
- ❌ Не создает предложения
- ❌ Не голосует
- ❌ Не исполняет предложения
- ❌ Не требует приватные ключи

---

## 🔐 Frontend (транзакции через MetaMask):

### Основные функции в `dle-contract.js`:
```javascript
// Создание предложения
createProposal(dleAddress, proposalData)

// Голосование
voteForProposal(dleAddress, proposalId, support)

// Исполнение предложения
executeProposal(dleAddress, proposalId)

// Подключение к кошельку
checkWalletConnection()
```

### Как использовать:
```javascript
import { createProposal } from '@/utils/dle-contract.js';

// Создаем предложение через MetaMask
const result = await createProposal(dleAddress, {
  description: "Новое предложение",
  duration: 86400,
  operation: "0x...",
  governanceChainId: 11155111,
  targetChains: [11155111, 137]
});
```

---

## 🔄 Frontend сервисы (модульная архитектура):

### 📁 Структура сервисов:
```
frontend/src/services/
├── dleV2Service.js      # Основные функции DLE
├── proposalsService.js  # Функции предложений
├── modulesService.js    # Функции модулей
├── tokensService.js     # Функции токенов
├── analyticsService.js  # Аналитические данные
├── multichainService.js # Мультичейн функциональность
└── index.js            # Индексный файл для импорта
```

### 🔗 Соответствие backend модулям:

| Backend модуль | Frontend сервис | Описание |
|----------------|-----------------|----------|
| `dleCore.js` | `dleV2Service.js` | Основные функции DLE |
| `dleProposals.js` | `proposalsService.js` | Управление предложениями |
| `dleModules.js` | `modulesService.js` | Управление модулями |
| `dleTokens.js` | `tokensService.js` | Работа с токенами |
| `dleAnalytics.js` | `analyticsService.js` | Аналитика и история |
| `dleMultichain.js` | `multichainService.js` | Мультичейн функции |

---

## 🚀 Пример полного цикла:

### 1. Чтение данных DLE:
```javascript
// Frontend → Backend API (новые модульные endpoints)
const response = await fetch('/api/dle-core/read-dle-info', {
  method: 'POST',
  body: JSON.stringify({ dleAddress: '0x...' })
});
const dleInfo = response.data;
```

### 2. Создание предложения:
```javascript
// Frontend → MetaMask → Blockchain
import { createProposal } from '@/utils/dle-contract.js';

const result = await createProposal(dleAddress, proposalData);
console.log('Предложение создано:', result.txHash);
```

### 3. Голосование:
```javascript
// Frontend → MetaMask → Blockchain
import { voteForProposal } from '@/utils/dle-contract.js';

const result = await voteForProposal(dleAddress, proposalId, true);
console.log('Голосование выполнено:', result.txHash);
```

---

## 🔧 Порты и URL:

- **Frontend:** `http://localhost:5173`
- **Backend:** `http://localhost:8000`
- **API через proxy:** `http://localhost:5173/api`

---

## ✅ Преимущества модульной архитектуры:

### 🔒 Безопасность:
- Нет приватных ключей на сервере
- Транзакции подписываются пользователем через MetaMask

### 🏗️ Модульность:
- Четкое разделение ответственности
- Легко поддерживать и тестировать
- Простое добавление новых функций

### 📈 Масштабируемость:
- Каждый модуль можно развивать независимо
- Возможность переиспользования кода
- Простое развертывание отдельных компонентов

### 🎯 Читаемость:
- Понятная структура файлов
- Логическое группирование функций
- Удобная навигация по коду

---

## 🎯 Итог:

### 📊 Статистика рефакторинга:

| Модуль | Endpoints | Строк кода | Описание |
|--------|-----------|------------|----------|
| `dleCore.js` | 4 | ~200 | Основные функции DLE |
| `dleProposals.js` | 10 | ~400 | Управление предложениями |
| `dleModules.js` | 5 | ~150 | Управление модулями |
| `dleTokens.js` | 3 | ~100 | Работа с токенами |
| `dleAnalytics.js` | 2 | ~150 | Аналитика и история |
| `dleMultichain.js` | 8 | ~300 | Мультичейн функции |

### ✅ Результат:

**Backend** = модульная архитектура для чтения данных из блокчейна
**Frontend** = модульные сервисы + выполнение транзакций через MetaMask

**Преимущества новой архитектуры:**
- 🏗️ **Модульность** - четкое разделение ответственности
- 🔒 **Безопасность** - нет приватных ключей на сервере  
- 📈 **Масштабируемость** - легко добавлять новые функции
- 🎯 **Читаемость** - понятная структура и навигация

Это современная, безопасная и масштабируемая архитектура! 🚀
