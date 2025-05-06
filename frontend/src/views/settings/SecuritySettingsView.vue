<template>
  <div class="security-settings settings-panel">
    <h2>Настройки безопасности и подключения к блокчейну</h2>
    
    <div class="sub-settings-panel">
      <h3>RPC Провайдеры</h3>
      <p>Добавьте конфигурации RPC для сетей, которые будут использоваться в приложении.</p>
      
      <!-- Список добавленных RPC -->
      <div v-if="securitySettings.rpcConfigs.length > 0" class="rpc-list">
          <h4>Добавленные RPC конфигурации:</h4>
          <div v-for="(rpc, index) in securitySettings.rpcConfigs" :key="index" class="rpc-entry">
              <span><strong>ID Сети:</strong> {{ rpc.networkId }}</span>
              <span><strong>URL:</strong> {{ rpc.rpcUrl }}</span>
              <button class="btn btn-danger btn-sm" @click="removeRpcConfig(index)">Удалить</button>
          </div>
      </div>
      <p v-else>Нет добавленных RPC конфигураций.</p>

      <!-- Форма добавления нового RPC -->
      <div class="setting-form add-rpc-form">
           <h4>Добавить новую RPC конфигурацию:</h4>
            <div class="form-group">
                <label class="form-label" for="newRpcNetworkId">ID Сети:</label>
                <input type="text" id="newRpcNetworkId" v-model="newRpcEntry.networkId" class="form-control" placeholder="Например, polygon или sepolia">
                 <small>Этот ID должен совпадать со значением `value` в выпадающем списке сетей при создании DLE.</small>
            </div>
             <div class="form-group">
                <label class="form-label" for="newRpcUrl">RPC URL:</label>
                <input type="text" id="newRpcUrl" v-model="newRpcEntry.rpcUrl" class="form-control" placeholder="https://...">
            </div>
            <button class="btn btn-secondary" @click="addRpcConfig">Добавить RPC</button>
      </div>
    </div>

    <div class="sub-settings-panel">
      <h3>Ключ Деплоера</h3>
      <div class="setting-form">
        <div class="form-group">
          <label class="form-label" for="deployerKey">Приватный ключ кошелька для деплоя:</label>
          <input type="password" id="deployerKey" v-model="securitySettings.deployerPrivateKey" class="form-control" placeholder="0x...">
          <small>Ключ будет скрыт. Не сохраняйте его в браузере.</small>
        </div>
      </div>
    </div>

    <div class="sub-settings-panel">
      <h3>Ключ API Etherscan</h3>
       <p>API ключ для Etherscan (и аналогов для других сетей) используется для автоматической верификации исходного кода смарт-контрактов после деплоя.</p>
      <div class="setting-form">
        <div class="form-group">
          <label class="form-label" for="etherscanApi">Etherscan API Key:</label>
          <input type="text" id="etherscanApi" v-model="securitySettings.etherscanApiKey" class="form-control" placeholder="YourEtherscanApiKey">
        </div>
         <!-- TODO: Добавить поля для API ключей других обозревателей (Polygonscan, BscScan и т.д.) -->
      </div>
    </div>

    <div class="sub-settings-panel">
        <h3>База данных (PostgreSQL)</h3>
        <div class="setting-form">
            <div class="form-group">
                <label class="form-label" for="dbHost">Хост:</label>
                <input type="text" id="dbHost" v-model="securitySettings.dbHost" class="form-control" placeholder="postgres">
            </div>
            <div class="form-group">
                <label class="form-label" for="dbPort">Порт:</label>
                <input type="number" id="dbPort" v-model="securitySettings.dbPort" class="form-control" placeholder="5432">
            </div>
            <div class="form-group">
                <label class="form-label" for="dbName">Имя БД:</label>
                <input type="text" id="dbName" v-model="securitySettings.dbName" class="form-control" placeholder="dapp_db">
            </div>
            <div class="form-group">
                <label class="form-label" for="dbUser">Пользователь БД:</label>
                <input type="text" id="dbUser" v-model="securitySettings.dbUser" class="form-control" placeholder="dapp_user">
            </div>
            <div class="form-group">
                <label class="form-label" for="dbPassword">Пароль БД:</label>
                <input type="password" id="dbPassword" v-model="securitySettings.dbPassword" class="form-control" placeholder="********">
            </div>
        </div>
    </div>

    <div class="sub-settings-panel">
        <h3>Настройки Email</h3>
        <div class="setting-form">
             <div class="form-group">
                <label class="form-label" for="emailSmtpHost">SMTP Хост:</label>
                <input type="text" id="emailSmtpHost" v-model="securitySettings.emailSmtpHost" class="form-control" placeholder="smtp.example.com">
            </div>
             <div class="form-group">
                <label class="form-label" for="emailSmtpPort">SMTP Порт:</label>
                <input type="number" id="emailSmtpPort" v-model="securitySettings.emailSmtpPort" class="form-control" placeholder="465">
            </div>
             <div class="form-group">
                <label class="form-label" for="emailImapHost">IMAP Хост:</label>
                <input type="text" id="emailImapHost" v-model="securitySettings.emailImapHost" class="form-control" placeholder="imap.example.com">
            </div>
            <div class="form-group">
                <label class="form-label" for="emailImapPort">IMAP Порт:</label>
                <input type="number" id="emailImapPort" v-model="securitySettings.emailImapPort" class="form-control" placeholder="993">
            </div>
             <div class="form-group">
                <label class="form-label" for="emailUser">Email Пользователь:</label>
                <input type="email" id="emailUser" v-model="securitySettings.emailUser" class="form-control" placeholder="your_email@example.com">
            </div>
             <div class="form-group">
                <label class="form-label" for="emailPassword">Email Пароль:</label>
                <input type="password" id="emailPassword" v-model="securitySettings.emailPassword" class="form-control" placeholder="********">
            </div>
        </div>
    </div>

    <div class="sub-settings-panel">
        <h3>Telegram Бот</h3>
        <div class="setting-form">
            <div class="form-group">
                <label class="form-label" for="telegramToken">Токен Бота:</label>
                <input type="text" id="telegramToken" v-model="securitySettings.telegramBotToken" class="form-control" placeholder="123456:ABC-DEF1234...">
                 <small>Получите у @BotFather в Telegram.</small>
            </div>
             <div class="form-group">
                <label class="form-label" for="telegramUsername">Имя пользователя Бота:</label>
                <input type="text" id="telegramUsername" v-model="securitySettings.telegramBotUsername" class="form-control" placeholder="YourTelegramBot">
            </div>
        </div>
    </div>
    
    <div class="sub-settings-panel">
        <h3>Прочие настройки</h3>
        <div class="setting-form">
            <div class="form-group">
                <label class="form-label" for="sessionSecret">Секрет сессии:</label>
                <input type="password" id="sessionSecret" v-model="securitySettings.sessionSecret" class="form-control" placeholder="Очень длинный и случайный секрет">
                 <small>Используется для подписи cookie сессий. Должен быть надежным.</small>
            </div>
             <div class="form-group">
                <label class="form-label" for="frontendUrl">Frontend URL:</label>
                <input type="text" id="frontendUrl" v-model="securitySettings.frontendUrl" class="form-control" placeholder="http://localhost:5173">
                 <small>URL, по которому доступен фронтенд (для CORS, ссылок и т.д.).</small>
            </div>
        </div>
    </div>

     <div class="sub-settings-panel save-panel">
       <button class="btn btn-primary btn-lg" @click="saveSecuritySettings">Сохранить настройки безопасности</button>
     </div>

  </div>
</template>

<script setup>
import { reactive } from 'vue';

// TODO: Импортировать API для сохранения/загрузки настроек (если это безопасно реализуемо)

const securitySettings = reactive({
  rpcConfigs: [], // Массив для хранения { networkId: string, rpcUrl: string }
  deployerPrivateKey: '', 
  etherscanApiKey: '',
  // Настройки БД
  dbHost: '',
  dbPort: 5432,
  dbName: '',
  dbUser: '',
  dbPassword: '',
  // Настройки Email
  emailSmtpHost: '',
  emailSmtpPort: 465,
  emailImapHost: '',
  emailImapPort: 993,
  emailUser: '',
  emailPassword: '',
  // Настройки Telegram
  telegramBotToken: '',
  telegramBotUsername: '',
  // Прочие настройки
  sessionSecret: '',
  frontendUrl: '',
});

// Реактивный объект для новой записи RPC
const newRpcEntry = reactive({
    networkId: '',
    rpcUrl: ''
});

// Функция добавления новой RPC конфигурации
const addRpcConfig = () => {
    const networkId = newRpcEntry.networkId.trim();
    const rpcUrl = newRpcEntry.rpcUrl.trim();
    if (networkId && rpcUrl) {
        // Проверка на дубликат ID (опционально, но полезно)
        if (securitySettings.rpcConfigs.some(rpc => rpc.networkId === networkId)) {
            alert(`Ошибка: RPC конфигурация для сети с ID '${networkId}' уже существует.`);
            return;
        }
        securitySettings.rpcConfigs.push({ networkId, rpcUrl });
        // Очистка полей ввода
        newRpcEntry.networkId = '';
        newRpcEntry.rpcUrl = '';
    } else {
        alert('Пожалуйста, заполните ID Сети и RPC URL.');
    }
};

// Функция удаления RPC конфигурации
const removeRpcConfig = (index) => {
    securitySettings.rpcConfigs.splice(index, 1);
};

const saveSecuritySettings = async () => {
  // ВАЖНО: Отправка приватного ключа на бэкенд или его сохранение 
  // через UI - КРАЙНЕ ОПАСНО. 
  // Идеально - настроить его через .env или защищенный серверный механизм.
  // Эта функция - заглушка. В реальном приложении нужна безопасная логика.
  if (securitySettings.deployerPrivateKey) {
     console.warn('[SecuritySettingsView] Попытка сохранить приватный ключ через UI! Это небезопасно!');
     alert('ПРЕДУПРЕЖДЕНИЕ: Сохранение приватного ключа через веб-интерфейс КРАЙНЕ НЕ РЕКОМЕНДУЕТСЯ из соображений безопасности. Используйте .env файл или переменные окружения на сервере.');
  }
  console.log('[SecuritySettingsView] Попытка сохранения настроек:', { 
    rpcConfigs: JSON.parse(JSON.stringify(securitySettings.rpcConfigs)), // Логируем копию массива
    etherscanApiKey: securitySettings.etherscanApiKey ? '******' : 'Не указан', // Тоже чувствительные данные
    deployerPrivateKey: securitySettings.deployerPrivateKey ? '******' : 'Не указан', // Не логируем сам ключ!
    dbHost: securitySettings.dbHost,
    dbPort: securitySettings.dbPort,
    dbName: securitySettings.dbName,
    dbUser: securitySettings.dbUser,
    dbPassword: securitySettings.dbPassword ? '******' : 'Не указан',
    emailSmtpHost: securitySettings.emailSmtpHost,
    emailSmtpPort: securitySettings.emailSmtpPort,
    emailImapHost: securitySettings.emailImapHost,
    emailImapPort: securitySettings.emailImapPort,
    emailUser: securitySettings.emailUser,
    emailPassword: securitySettings.emailPassword ? '******' : 'Не указан',
    telegramBotToken: securitySettings.telegramBotToken ? '******' : 'Не указан',
    telegramBotUsername: securitySettings.telegramBotUsername,
    sessionSecret: securitySettings.sessionSecret ? '******' : 'Не указан',
    frontendUrl: securitySettings.frontendUrl,
  });
  
  // TODO: Реализовать безопасную отправку данных (кроме ключа?) на бэкенд
  // await api.saveSecurityConfig({ 
  //   rpcUrls: { 
  //     polygon: securitySettings.polygonRpcUrl,
  //     ethereum: securitySettings.ethRpcUrl,
  //     bsc: securitySettings.bscRpcUrl,
  //     arbitrum: securitySettings.arbitrumRpcUrl,
  //     default: securitySettings.defaultRpcUrl,
  //   } 
  //   etherscanApiKey: securitySettings.etherscanApiKey 
  //   // НЕ передавать приватный ключ напрямую!
  // });
  alert('Настройки (заглушка) сохранены. Проверьте консоль. Обратите внимание на предупреждения о приватном ключе.');
};
</script>

<style scoped>
/* Используем стили, похожие на BlockchainSettingsView */
.settings-panel {
  padding: var(--block-padding);
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-lg);
  animation: fadeIn var(--transition-normal);
}
h2 {
  margin-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-grey-light);
  padding-bottom: var(--spacing-md);
}
h3 {
  margin-bottom: var(--spacing-md);
  color: var(--color-primary);
}
.sub-settings-panel {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px dashed var(--color-grey-light);
}
.sub-settings-panel:last-child,
.save-panel {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}
.setting-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.form-group {
  margin-bottom: 0;
}
.form-label {
  display: block; /* Чтобы занимала всю ширину */
  margin-bottom: var(--spacing-xs);
  font-weight: 500;
}
.form-control {
  max-width: 600px; /* Немного шире для ключей и URL */
  padding: var(--spacing-sm);
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-sm);
  font-size: 1rem;
}
.form-control[type="password"] {
  font-family: monospace; /* Чтобы легче было вводить ключ */
}
small {
  display: block;
  margin-top: var(--spacing-xs);
  color: var(--color-grey-dark);
}

.warning-block {
  border: 2px solid var(--color-danger);
  background-color: var(--color-danger-light);
  color: var(--color-danger-dark);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-md);
}
.warning-block h4 {
  color: var(--color-danger);
  margin-top: 0;
  margin-bottom: var(--spacing-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.warning-block p {
  margin-bottom: var(--spacing-sm);
}
.warning-block p:last-child {
  margin-bottom: 0;
}

.btn-lg {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: 1.125rem;
}
.btn-primary {
 align-self: flex-start;
 background-color: var(--color-primary);
 color: white;
 border: none;
 padding: var(--spacing-sm) var(--spacing-md);
 border-radius: var(--radius-sm);
 cursor: pointer;
 transition: background-color var(--transition-fast);
}
.btn-primary:hover {
  background-color: var(--color-primary-dark);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Предполагаем, что у вас есть иконки FontAwesome или аналог */
/* @import url('.../path/to/fontawesome.css'); */ 
/* Если иконок нет, можно убрать тег <i> */
.fa-exclamation-triangle {
  color: var(--color-danger);
}

.rpc-list {
    margin-top: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
}

.rpc-entry {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm);
    border: 1px solid var(--color-grey-light);
    border-radius: var(--radius-sm);
    background-color: white; /* Немного выделить фон */
}

.rpc-entry span {
    flex-grow: 1;
}
.rpc-entry .btn-danger {
    flex-shrink: 0;
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.875rem;
}

.add-rpc-form {
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-lg);
    border-top: 1px dashed var(--color-grey-light);
}

.add-rpc-form h4 {
    margin-bottom: var(--spacing-md);
}

.add-rpc-form .btn-secondary {
    align-self: flex-start;
    background-color: var(--color-secondary); /* Пример цвета */
    color: white;
    border: none;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color var(--transition-fast);
}

.add-rpc-form .btn-secondary:hover {
    background-color: var(--color-secondary-dark); /* Пример цвета */
}
</style> 