# Интеграция динамических операций модулей в CreateProposalView

## Обзор

Реализована система автоматического отображения блоков с предложениями операций модулей в реальном времени на странице создания предложений (`/management/create-proposal`). После деплоя модуля карточки с операциями автоматически появляются без необходимости обновления страницы.

## Архитектура решения

### 1. Backend API Endpoints

Добавлены новые API endpoints в `/backend/routes/dleModules.js`:

- `POST /dle-modules/get-module-operations` - получение всех доступных операций модулей для DLE
- `POST /dle-modules/get-module-specific-operations` - получение операций конкретного модуля
- `POST /dle-modules/get-module-interface` - получение ABI и интерфейса модуля
- `POST /dle-modules/get-module-available-functions` - получение доступных функций модуля
- `POST /dle-modules/get-module-function-parameters` - получение параметров функции модуля
- `POST /dle-modules/create-module-operation-proposal` - создание предложения для операции модуля
- `POST /dle-modules/validate-module-operation` - валидация операции модуля

### 2. Frontend Services

Создан новый сервис `/frontend/src/services/moduleOperationsService.js` с функциями:

- `getModuleOperations(dleAddress)` - получение операций модулей
- `getModuleSpecificOperations(dleAddress, moduleType, moduleAddress, chainId)` - операции конкретного модуля
- `createModuleOperationProposal(dleAddress, operationData)` - создание предложения
- `getModuleInterface(moduleType, moduleAddress, chainId)` - получение интерфейса
- `validateModuleOperation(dleAddress, operationData)` - валидация операции

### 3. WebSocket Integration

#### Backend (wsHub.js)
- Добавлена функция `broadcastModulesUpdate(dleAddress, updateType, moduleData)` для отправки уведомлений об обновлениях модулей
- Уведомления отправляются при обнаружении новых модулей в файлах деплоя

#### Frontend (CreateProposalView.vue)
- Подключение к WebSocket при монтировании компонента
- Обработка сообщений: `modules_updated`, `module_verified`, `module_status_changed`
- Автоматическое обновление списка операций при получении уведомлений

### 4. Динамическое отображение

#### Состояние компонента
```javascript
const moduleOperations = ref([]);
const isLoadingModuleOperations = ref(false);
const modulesWebSocket = ref(null);
const isModulesWSConnected = ref(false);
```

#### Шаблон
- Условное отображение индикатора загрузки
- Динамическое создание блоков операций для каждого модуля
- Анимация появления новых блоков

## Поддерживаемые типы модулей и операции

### 1. Treasury Module (💰)
- **Депозит средств** - пополнение казначейства DLE
- **Вывод средств** - вывод средств из казначейства
- **Распределение дивидендов** - распределение дивидендов между держателями токенов

### 2. Timelock Module (⏰)
- **Установить задержку** - установить время задержки для операций
- **Поставить операцию в очередь** - добавить операцию в очередь для выполнения

### 3. Reader Module (📖)
- **Обновить данные** - обновить информацию о DLE

### 4. Hierarchical Voting Module (🗳️)
- **Голосование во внешнем DLE** - использовать токены для голосования в другом DLE

## Реальный процесс работы

1. **Деплой модуля** → Backend сохраняет информацию в файлы деплоя
2. **Обнаружение модуля** → `getDeployedModulesInfo()` читает файлы и находит новые модули
3. **WebSocket уведомление** → `broadcastModulesUpdate()` отправляет уведомление клиентам
4. **Обновление UI** → Frontend получает уведомление и автоматически загружает новые операции
5. **Отображение блоков** → Новые блоки операций появляются с анимацией

## Стили и UX

### Визуальные особенности
- Отдельные стили для блоков операций модулей (`.module-operation-block`)
- Цветовая схема с зеленым акцентом для модулей
- Теги категорий операций
- Анимация появления (`fadeInUp`)
- Индикатор загрузки с анимацией

### Адаптивность
- Responsive grid для блоков операций
- Поддержка мобильных устройств
- Адаптивные размеры и отступы

## Технические детали

### WebSocket Events
```javascript
// Подписка на обновления
{
  type: 'subscribe',
  dleAddress: '0x...'
}

// Уведомления
{
  type: 'modules_updated',
  dleAddress: '0x...',
  moduleData: { modulesCount: 3, moduleTypes: ['treasury', 'timelock'] },
  timestamp: 1234567890
}
```

### Структура данных операций
```javascript
{
  id: 'deposit',
  name: 'Депозит средств',
  description: 'Пополнение казначейства DLE',
  icon: '💰',
  functionName: 'deposit',
  parameters: [
    { name: 'amount', type: 'uint256', label: 'Сумма', required: true }
  ],
  category: 'Финансы'
}
```

## Будущие улучшения

1. **Полные формы создания предложений** - замена alert на полноценные модальные окна
2. **Валидация параметров** - клиентская валидация перед отправкой
3. **Предпросмотр операций** - отображение calldata перед созданием предложения
4. **История операций** - показ выполненных операций модулей
5. **Расширенная фильтрация** - фильтры по типам операций и модулей

## Файлы изменений

### Новые файлы
- `frontend/src/services/moduleOperationsService.js`
- `docs/MODULE_OPERATIONS_INTEGRATION.md`

### Измененные файлы
- `frontend/src/views/smartcontracts/CreateProposalView.vue`
- `backend/routes/dleModules.js`
- `backend/wsHub.js`

## Заключение

Реализована полноценная система динамического отображения операций модулей с реальным временем обновлений через WebSocket. После деплоя модуля пользователи сразу видят доступные операции без необходимости обновления страницы, что значительно улучшает пользовательский опыт.
