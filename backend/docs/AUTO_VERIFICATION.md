# Автоматическая верификация контрактов

## Обзор

Автоматическая верификация контрактов интегрирована в процесс деплоя DLE. После успешного деплоя контрактов во всех выбранных сетях, система автоматически запускает процесс верификации на соответствующих блокчейн-эксплорерах.

## Как это работает

1. **Настройка в форме деплоя**: В форме деплоя DLE есть чекбокс "Авто-верификация после деплоя" (по умолчанию включен)
2. **Деплой контрактов**: Система разворачивает DLE контракты во всех выбранных сетях
3. **Автоматическая верификация**: Если `autoVerifyAfterDeploy = true`, система автоматически запускает верификацию
4. **Результаты**: Статус верификации отображается в логах деплоя

## Поддерживаемые сети

Автоматическая верификация работает для всех сетей, настроенных в `hardhat.config.js`:

- **Sepolia** (Ethereum testnet)
- **Holesky** (Ethereum testnet)  
- **Arbitrum Sepolia**
- **Base Sepolia**
- **И другие сети** (настраиваются в конфиге)

## Требования

1. **Etherscan API ключ**: Должен быть указан в форме деплоя
2. **Права на запись**: Приватный ключ должен иметь права на деплой контрактов
3. **Сеть доступна**: RPC провайдеры для всех выбранных сетей должны быть доступны

## Логи и мониторинг

### В логах деплоя вы увидите:

```
[MULTI_DBG] autoVerifyAfterDeploy: true
[MULTI_DBG] Starting automatic contract verification...
🔍 Верификация в сети sepolia (chainId: 11155111)
✅ Верификация успешна: https://sepolia.etherscan.io/address/0x...
[MULTI_DBG] ✅ Automatic verification completed successfully
```

### Статусы верификации:

- `verified` - контракт успешно верифицирован
- `verification_failed` - ошибка верификации
- `disabled` - верификация отключена
- `already_verified` - контракт уже был верифицирован ранее

## Отключение автоматической верификации

Если вы хотите отключить автоматическую верификацию:

1. В форме деплоя снимите галочку "Авто-верификация после деплоя"
2. Или установите `autoVerifyAfterDeploy: false` в настройках

## Ручная верификация

Если автоматическая верификация не сработала, вы можете запустить верификацию вручную:

```bash
# В Docker контейнере
docker exec dapp-backend node scripts/verify-with-hardhat-v2.js

# Или через npm скрипт
docker exec dapp-backend npm run verify:contracts
```

## Техническая реализация

Автоматическая верификация интегрирована в `backend/scripts/deploy/deploy-multichain.js`:

```javascript
if (params.autoVerifyAfterDeploy) {
  console.log('[MULTI_DBG] Starting automatic contract verification...');
  
  try {
    const { verifyContracts } = require('../verify-with-hardhat-v2');
    await verifyContracts();
    verificationResults = networks.map(() => 'verified');
    console.log('[MULTI_DBG] ✅ Automatic verification completed successfully');
  } catch (verificationError) {
    console.error('[MULTI_DBG] ❌ Automatic verification failed:', verificationError.message);
    verificationResults = networks.map(() => 'verification_failed');
  }
}
```

## Устранение проблем

### Ошибка "Contract already verified"
Это нормально - контракт уже был верифицирован ранее.

### Ошибка "Rate limit exceeded"
Система автоматически добавляет задержки между запросами к разным сетям.

### Ошибка "Network not supported"
Убедитесь, что сеть настроена в `hardhat.config.js` и имеет правильный Etherscan API URL.

## Преимущества

1. **Автоматизация**: Не нужно запускать верификацию вручную
2. **Надежность**: Верификация происходит сразу после деплоя
3. **Мультисеть**: Верификация во всех развернутых сетях одновременно
4. **Мониторинг**: Полная видимость процесса через логи
5. **Интеграция**: Единый процесс деплоя и верификации
