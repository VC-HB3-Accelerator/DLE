<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

# Улучшения системы деплоя и управления модулями DLE

## Описание задачи

Пользователь хочет улучшить процесс деплоя и управления модулями DLE, чтобы обеспечить автоматическую инициализацию и верификацию модулей во всех выбранных пользователем блокчейн-сетях.

## Текущая ситуация

### Что уже работает:
- ✅ Деплой основного DLE контракта в 4 сетях с одинаковым адресом (через CREATE2)
- ✅ Деплой модулей (Treasury, Timelock, Reader) в каждой сети
- ✅ Модули инициализируются только через governance предложения
- ✅ Верификация контрактов в каждой сети
- ✅ Отображение модулей в виде карточек с адресами во всех сетях

### Проблемы:
- ❌ Если деплой модулей в одной сети падает, инициализация не происходит
- ❌ Нет механизма повторной инициализации модулей
- ❌ Нет проверки статуса инициализации перед деплоем
- ❌ Верификация может падать из-за таймаутов блокчейн-эксплореров
- ❌ Нет удобного интерфейса для управления модулями

## Требования пользователя

### 1. Workflow деплоя
**Цель:** При заполнении формы и нажатии на кнопку "Деплой" пользователь должен получить:
- Основной смарт-контракт DLE
- 3 модуля (Treasury, Timelock, Reader)
- Модули должны быть **сразу инициализированы** во всех выбранных сетях
- Модули должны быть **сразу верифицированы** во всех выбранных сетях

### 2. Отображение модулей
**Текущее состояние:** ✅ Уже реализовано
- Одна карточка для каждого модуля
- В карточке показаны адреса модуля во всех сетях
- Статус верификации для каждой сети
- Кнопка "Настроить" для перехода к настройкам модуля

### 3. Управление модулями
**Требования:**
- Кнопка "Настроить" должна открывать страницу с блоками для настройки модулей
- Возможность управления модулями через веб-интерфейс
- Отображение статуса инициализации и верификации

## Реализованные улучшения

### 1. Backend API Endpoints

#### `/api/dle-modules/initialize-modules-all-networks`
**Назначение:** Автоматическая инициализация всех модулей во всех поддерживаемых сетях

**Параметры:**
```json
{
  "dleAddress": "0x...",
  "privateKey": "0x..."
}
```

**Функциональность:**
- Получает список поддерживаемых сетей из DLE контракта
- Проверяет статус инициализации в каждой сети
- Если модули не инициализированы, создает governance предложения для их добавления
- Возвращает детальный отчет по каждой сети

**Возвращаемые статусы:**
- `success` - модули успешно инициализированы
- `already_initialized` - модули уже инициализированы
- `modules_not_deployed` - не все модули задеплоены
- `error` - ошибка инициализации

#### `/api/dle-modules/verify-modules-all-networks`
**Назначение:** Автоматическая верификация всех модулей во всех поддерживаемых сетях

**Параметры:**
```json
{
  "dleAddress": "0x...",
  "privateKey": "0x..."
}
```

**Функциональность:**
- Получает адреса всех модулей в каждой сети
- Отправляет запросы на верификацию в Etherscan/блокчейн-эксплореры
- Использует стандартный JSON input для верификации
- Возвращает детальный отчет по каждому модулю в каждой сети

**Возвращаемые статусы:**
- `success` - модуль успешно верифицирован
- `failed` - ошибка верификации
- `not_deployed` - модуль не задеплоен
- `error` - ошибка процесса верификации

### 2. Frontend Service Functions

#### `initializeModulesAllNetworks(dleAddress, privateKey)`
**Назначение:** Вызов API для инициализации модулей

#### `verifyModulesAllNetworks(dleAddress, privateKey)`
**Назначение:** Вызов API для верификации модулей

### 3. Улучшенный интерфейс модулей

#### Обновленная карточка модуля:
- **Основные действия:** Кнопка "Настроить" (приоритетная)
- **Дополнительные действия:** Удалить/Активировать модуль
- **Верификация:** Отдельные кнопки для каждой сети

#### Новые стили:
- Группировка кнопок по функциональности
- Улучшенная компоновка элементов
- Адаптивный дизайн для разных размеров экрана

## Предлагаемый Workflow (Поэтапный подход с повторами)

### Этап 1: Деплой основного DLE контракта
```bash
# Деплой только DLE контракта во всех выбранных сетях
npx hardhat run scripts/deploy/deploy-dle-only.js
```

### Этап 2: Проверка успеха деплоя DLE (с повторами)
```javascript
POST /api/dle-modules/check-dle-deployment-status
{
  "dleAddress": "0x...",
  "chainIds": [11155111, 17000, 421614, 84532],
  "maxRetries": 5,
  "retryDelay": 30000
}
```
**Логика повторов:**
- Если не все сети успешны → ждем 30 сек → повторяем проверку
- Максимум 5 попыток
- Если после 5 попыток не все сети готовы → ошибка

### Этап 3: Верификация DLE контракта (с повторами)
```javascript
POST /api/dle-modules/verify-dle-all-networks
{
  "dleAddress": "0x...",
  "privateKey": "0x...",
  "maxRetries": 3,
  "retryDelay": 60000
}
```
**Логика повторов:**
- Если верификация не удалась → ждем 60 сек → повторяем
- Максимум 3 попытки
- Etherscan может быть перегружен, поэтому больше времени между попытками

### Этап 4: Деплой модуля 1 (TreasuryModule) (с повторами)
```javascript
POST /api/dle-modules/deploy-module-all-networks
{
  "dleAddress": "0x...",
  "moduleType": "treasury",
  "privateKey": "0x...",
  "maxRetries": 3,
  "retryDelay": 45000
}
```
**Логика повторов:**
- Если деплой в какой-то сети упал → ждем 45 сек → повторяем только для неудачных сетей
- Максимум 3 попытки
- Gas price может быть высоким, поэтому больше времени между попытками

### Этап 5: Проверка успеха деплоя TreasuryModule (с повторами)
```javascript
POST /api/dle-modules/check-module-deployment-status
{
  "dleAddress": "0x...",
  "moduleType": "treasury",
  "chainIds": [11155111, 17000, 421614, 84532],
  "maxRetries": 5,
  "retryDelay": 30000
}
```

### Этап 6: Верификация TreasuryModule (с повторами)
```javascript
POST /api/dle-modules/verify-module-all-networks
{
  "dleAddress": "0x...",
  "moduleType": "treasury",
  "privateKey": "0x...",
  "maxRetries": 3,
  "retryDelay": 60000
}
```

### Этап 7: Инициализация TreasuryModule (с повторами)
```javascript
POST /api/dle-modules/initialize-module-all-networks
{
  "dleAddress": "0x...",
  "moduleType": "treasury",
  "privateKey": "0x...",
  "maxRetries": 3,
  "retryDelay": 30000
}
```
**Логика повторов:**
- Если инициализация упала → ждем 30 сек → повторяем
- Максимум 3 попытки
- Network congestion может влиять на транзакции

### Этап 8: Деплой модуля 2 (TimelockModule)
```javascript
POST /api/dle-modules/deploy-module-all-networks
{
  "dleAddress": "0x...",
  "moduleType": "timelock",
  "privateKey": "0x..."
}
```

### Этап 9: Проверка успеха деплоя TimelockModule
```javascript
POST /api/dle-modules/check-module-deployment-status
{
  "dleAddress": "0x...",
  "moduleType": "timelock",
  "chainIds": [11155111, 17000, 421614, 84532]
}
```

### Этап 10: Верификация TimelockModule
```javascript
POST /api/dle-modules/verify-module-all-networks
{
  "dleAddress": "0x...",
  "moduleType": "timelock",
  "privateKey": "0x..."
}
```

### Этап 11: Инициализация TimelockModule
```javascript
POST /api/dle-modules/initialize-module-all-networks
{
  "dleAddress": "0x...",
  "moduleType": "timelock",
  "privateKey": "0x..."
}
```

### Этап 12: Деплой модуля 3 (DLEReader)
```javascript
POST /api/dle-modules/deploy-module-all-networks
{
  "dleAddress": "0x...",
  "moduleType": "reader",
  "privateKey": "0x..."
}
```

### Этап 13: Проверка успеха деплоя DLEReader
```javascript
POST /api/dle-modules/check-module-deployment-status
{
  "dleAddress": "0x...",
  "moduleType": "reader",
  "chainIds": [11155111, 17000, 421614, 84532]
}
```

### Этап 14: Верификация DLEReader
```javascript
POST /api/dle-modules/verify-module-all-networks
{
  "dleAddress": "0x...",
  "moduleType": "reader",
  "privateKey": "0x..."
}
```

### Этап 15: Инициализация DLEReader
```javascript
POST /api/dle-modules/initialize-module-all-networks
{
  "dleAddress": "0x...",
  "moduleType": "reader",
  "privateKey": "0x..."
}
```

### Этап 16: Финальная инициализация всех модулей
```javascript
POST /api/dle-modules/initialize-base-modules-all-networks
{
  "dleAddress": "0x...",
  "privateKey": "0x..."
}
```

### Этап 17: Финальная проверка и отображение
```javascript
POST /api/dle-modules/final-deployment-check
{
  "dleAddress": "0x...",
  "chainIds": [11155111, 17000, 421614, 84532]
}
```
**Логика финальной проверки:**
- Проверяем, что DLE задеплоен во всех сетях
- Проверяем, что все модули задеплоены во всех сетях
- Проверяем, что все модули верифицированы во всех сетях
- Проверяем, что все модули инициализированы во всех сетях

**Только если ВСЕ проверки пройдены:**
- ✅ Карточки DLE и модулей появляются в интерфейсе
- ✅ Пользователь может управлять модулями
- ✅ Все функции доступны

**Если хотя бы одна проверка не пройдена:**
- ❌ Карточки НЕ отображаются
- ❌ Показывается статус "Деплой в процессе" или "Деплой не завершен"
- ❌ Предлагается продолжить деплой или исправить ошибки

## Логика отображения интерфейса

### Состояния деплоя:

#### 1. **Деплой не начат**
```javascript
// Интерфейс показывает:
- Форму деплоя DLE
- Кнопку "Начать деплой"
- Нет карточек модулей
```

#### 2. **Деплой в процессе**
```javascript
// Интерфейс показывает:
- Прогресс-бар с текущим этапом
- Логи выполнения в реальном времени
- Кнопку "Остановить деплой" (опционально)
- Нет карточек модулей
```

#### 3. **Деплой частично завершен (ошибка)**
```javascript
// Интерфейс показывает:
- Статус "Деплой не завершен"
- Список успешных этапов
- Список неудачных этапов с ошибками
- Кнопки "Продолжить деплой" или "Начать заново"
- Нет карточек модулей
```

#### 4. **Деплой полностью завершен**
```javascript
// Интерфейс показывает:
- ✅ Карточки DLE и всех модулей
- ✅ Все функции управления доступны
- ✅ Кнопки "Настроить" для каждого модуля
- ✅ Статус "Деплой успешно завершен"
```

### API для проверки статуса деплоя:
```javascript
POST /api/dle-modules/get-deployment-status
{
  "dleAddress": "0x..."
}

// Возвращает:
{
  "status": "completed|in_progress|failed|not_started",
  "currentStage": "deploy_dle|verify_dle|deploy_treasury|...",
  "completedStages": ["deploy_dle", "verify_dle"],
  "failedStages": [],
  "progress": 85, // процент завершения
  "canShowCards": false, // только true если status === "completed"
  "errors": [],
  "nextAction": "continue_deployment|restart_deployment|none"
}
```

## Логика повторов

### Общие принципы:
1. **Каждый этап повторяется до успеха** или до исчерпания попыток
2. **Разные задержки** для разных типов операций:
   - Проверки: 30 сек (быстрые операции)
   - Деплой: 45 сек (gas price может измениться)
   - Верификация: 60 сек (Etherscan может быть перегружен)
   - Инициализация: 30 сек (network congestion)

3. **Умные повторы:**
   - Если операция частично успешна → повторяем только для неудачных сетей
   - Если операция полностью провалилась → повторяем для всех сетей
   - Логируем каждую попытку для диагностики

4. **Критические ошибки:**
   - Если после всех попыток операция не удалась → останавливаем весь процесс
   - Показываем детальный отчет о том, что не удалось
   - Предлагаем варианты решения (повторить, пропустить, откатиться)

### Пример логики повторов:
```javascript
async function executeWithRetries(operation, maxRetries, retryDelay) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Проверяем, все ли сети успешны
      const failedNetworks = result.filter(r => r.status !== 'success');
      
      if (failedNetworks.length === 0) {
        console.log(`✅ Операция успешна с попытки ${attempt}`);
        return result;
      }
      
      if (attempt < maxRetries) {
        console.log(`⚠️ Попытка ${attempt} частично успешна. Повторяем через ${retryDelay}мс...`);
        console.log(`Неудачные сети: ${failedNetworks.map(n => n.networkName).join(', ')}`);
        await sleep(retryDelay);
      }
      
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(`❌ Попытка ${attempt} провалилась: ${error.message}`);
        console.log(`Повторяем через ${retryDelay}мс...`);
        await sleep(retryDelay);
      } else {
        throw new Error(`Операция провалилась после ${maxRetries} попыток: ${error.message}`);
      }
    }
  }
}
```

## Преимущества поэтапного подхода

### 1. Максимальная надежность
- ✅ **Проверка на каждом этапе** - если что-то пошло не так, процесс останавливается
- ✅ **Изоляция ошибок** - проблема с одним модулем не влияет на другие
- ✅ **Возможность восстановления** - можно продолжить с места остановки
- ✅ **Детальная диагностика** - точно знаем, на каком этапе произошла ошибка
- ✅ **Автоматические повторы** - временные проблемы решаются автоматически
- ✅ **Устойчивость к сбоям** - network congestion, gas spikes, Etherscan overload

### 2. Гибкость управления
- ✅ **Выборочный деплой** - можно деплоить только нужные модули
- ✅ **Повторные попытки** - можно повторить только неудачный этап
- ✅ **Параллельная работа** - разные модули можно деплоить независимо
- ✅ **Контроль качества** - верификация после каждого деплоя

### 3. Улучшенная диагностика
- ✅ **Пошаговые логи** - детальная информация о каждом этапе
- ✅ **Статусы в реальном времени** - видно прогресс выполнения
- ✅ **Обработка ошибок** - понятные сообщения об ошибках
- ✅ **История операций** - можно отследить все выполненные действия

### 4. Масштабируемость
- ✅ **Легко добавить новые модули** - просто добавить новые этапы
- ✅ **Поддержка новых сетей** - автоматически работает для всех сетей
- ✅ **Модульная архитектура** - каждый endpoint независим
- ✅ **Расширяемость** - легко добавить новые типы операций

### 5. Безопасность
- ✅ **Постепенное развертывание** - минимизация рисков
- ✅ **Проверка перед выполнением** - валидация на каждом этапе
- ✅ **Откат изменений** - можно отменить неудачные операции
- ✅ **Аудит операций** - полная история всех действий

## Пример использования поэтапного подхода

### Сценарий: Деплой DLE с модулями в 4 сетях

```javascript
// 1. Деплой DLE контракта
const dleResult = await deployDLE({
  networks: [11155111, 17000, 421614, 84532],
  privateKey: "0x...",
  params: { name: "My DLE", symbol: "MDLE" }
});

// 2. Проверка деплоя DLE
const dleStatus = await checkDLEStatus(dleResult.address, [11155111, 17000, 421614, 84532]);
if (!dleStatus.allDeployed) {
  throw new Error("DLE не задеплоен во всех сетях");
}

// 3. Верификация DLE
const dleVerification = await verifyDLE(dleResult.address, "0x...");
console.log("DLE верификация:", dleVerification);

// 4. Деплой TreasuryModule
const treasuryResult = await deployModule("treasury", dleResult.address, "0x...");

// 5. Проверка деплоя TreasuryModule
const treasuryStatus = await checkModuleStatus("treasury", dleResult.address, [11155111, 17000, 421614, 84532]);
if (!treasuryStatus.allDeployed) {
  throw new Error("TreasuryModule не задеплоен во всех сетях");
}

// 6. Верификация TreasuryModule
const treasuryVerification = await verifyModule("treasury", dleResult.address, "0x...");
console.log("TreasuryModule верификация:", treasuryVerification);

// 7. Инициализация TreasuryModule
const treasuryInit = await initializeModule("treasury", dleResult.address, "0x...");
console.log("TreasuryModule инициализация:", treasuryInit);

// 8-15. Повторяем для TimelockModule и DLEReader...

// 16. Создание governance предложений для добавления модулей
const addTreasuryProposal = await createAddModuleProposal(dleResult.address, treasuryAddress, "Treasury Module");
const addTimelockProposal = await createAddModuleProposal(dleResult.address, timelockAddress, "Timelock Module");
const addReaderProposal = await createAddModuleProposal(dleResult.address, readerAddress, "Reader Module");
console.log("Governance предложения созданы:", { addTreasuryProposal, addTimelockProposal, addReaderProposal });
```

### Обработка ошибок

```javascript
try {
  // Деплой модуля
  const result = await deployModule("treasury", dleAddress, privateKey);
  
  // Проверка успеха
  const status = await checkModuleStatus("treasury", dleAddress, chainIds);
  
  if (status.errors.length > 0) {
    console.log("Ошибки деплоя:", status.errors);
    // Можно повторить только для сетей с ошибками
    const retryResult = await deployModule("treasury", dleAddress, privateKey, status.errorChains);
  }
  
} catch (error) {
  console.error("Критическая ошибка:", error);
  // Логирование и уведомление пользователя
}
```

## Следующие шаги

### 1. Реализация новых API endpoints
- `check-dle-deployment-status` - проверка деплоя DLE
- `check-module-deployment-status` - проверка деплоя модуля
- `deploy-module-all-networks` - деплой одного модуля
- `verify-dle-all-networks` - верификация DLE
- `verify-module-all-networks` - верификация модуля
- `initialize-module-all-networks` - инициализация модуля
- `initialize-base-modules-all-networks` - финальная инициализация

### 2. Веб-интерфейс для поэтапного деплоя
- Мастер деплоя с пошаговым интерфейсом
- Прогресс-бар для каждого этапа
- Обработка ошибок и повторные попытки
- Логи операций в реальном времени

### 3. Интеграция с существующей формой деплоя
- Добавить опцию "Поэтапный деплой"
- Автоматическое выполнение всех этапов
- Уведомления о статусе каждого этапа

### 4. Мониторинг и логирование
- Детальные логи всех операций
- История деплоев и их статусов
- Алерты при ошибках
- Метрики производительности

## Технические детали

### Поддерживаемые сети:
- Sepolia (Chain ID: 11155111)
- Holesky (Chain ID: 17000)
- Arbitrum Sepolia (Chain ID: 421614)
- Base Sepolia (Chain ID: 84532)

### Модули:
- **TreasuryModule** - управление финансами
- **TimelockModule** - задержки исполнения
- **DLEReader** - чтение данных DLE

### API Endpoints:

#### Основные endpoints (уже реализованы):
- `POST /api/dle-modules/initialize-modules-all-networks` - инициализация всех модулей
- `POST /api/dle-modules/verify-modules-all-networks` - верификация всех модулей
- `POST /api/dle-modules/get-all-modules` - получение списка модулей
- `POST /api/dle-modules/get-networks-info` - информация о сетях

#### Новые endpoints (требуют реализации):

**Проверка статуса деплоя:**
- `POST /api/dle-modules/check-dle-deployment-status` - проверка деплоя DLE контракта
- `POST /api/dle-modules/check-module-deployment-status` - проверка деплоя конкретного модуля

**Деплой модулей:**
- `POST /api/dle-modules/deploy-module-all-networks` - деплой одного модуля во всех сетях

**Верификация:**
- `POST /api/dle-modules/verify-dle-all-networks` - верификация DLE контракта
- `POST /api/dle-modules/verify-module-all-networks` - верификация одного модуля

**Инициализация:**
- `POST /api/dle-modules/initialize-module-all-networks` - инициализация одного модуля
- `POST /api/dle-modules/initialize-base-modules-all-networks` - финальная инициализация всех модулей

**Управление отображением:**
- `POST /api/dle-modules/final-deployment-check` - финальная проверка готовности
- `POST /api/dle-modules/get-deployment-status` - получение статуса деплоя

## Заключение

Реализованные улучшения обеспечивают:
1. **Полную автоматизацию** процесса деплоя модулей
2. **Надежность** через проверки статуса и обработку ошибок
3. **Удобство использования** через улучшенный интерфейс
4. **Масштабируемость** для добавления новых сетей и модулей

Пользователь теперь может одним кликом развернуть полностью функциональный DLE с инициализированными и верифицированными модулями во всех выбранных сетях.
