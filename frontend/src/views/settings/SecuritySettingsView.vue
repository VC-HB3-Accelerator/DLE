<template>
  <div class="security-settings settings-panel">
    <h2>Настройки Безопасности</h2>

    <!-- Панель Авторизация -->
    <div class="sub-settings-panel">
      <h3>Настройки авторизации</h3>
      <div class="setting-form">
        <p>Управление параметрами авторизации</p>
        <div class="form-group">
          <label class="form-label">Метод авторизации по умолчанию:</label>
          <select v-model="settings.defaultAuthMethod" class="form-control">
            <option value="wallet">Кошелек</option>
            <option value="email">Email</option>
            <option value="telegram">Telegram</option>
          </select>
        </div>
        <button class="btn btn-primary" @click="saveSettings('authorization')">Сохранить</button>
      </div>
    </div>
    
    <!-- Панель RPC -->
    <div class="sub-settings-panel">
      <h3>Настройки RPC</h3>
      <div class="setting-form">
        <p>Настройка RPC-эндпоинтов</p>
        <div class="form-group">
          <label class="form-label">Ethereum RPC:</label>
          <input type="text" v-model="settings.rpcEndpoints.ethereum" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">Polygon RPC:</label>
          <input type="text" v-model="settings.rpcEndpoints.polygon" class="form-control">
        </div>
        <button class="btn btn-primary" @click="saveSettings('rpc')">Сохранить</button>
      </div>
    </div>
    
    <!-- Панель Noda -->
    <div class="sub-settings-panel">
      <h3>Настройки Noda</h3>
      <div class="setting-form">
        <p>Конфигурация нод</p>
        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" v-model="settings.useCustomNode">
            Использовать собственную ноду
          </label>
        </div>
        <div class="form-group" v-if="settings.useCustomNode">
          <label class="form-label">URL собственной ноды:</label>
          <input type="text" v-model="settings.customNodeUrl" class="form-control">
        </div>
        <button class="btn btn-primary" @click="saveSettings('noda')">Сохранить</button>
      </div>
    </div>
    
    <!-- Панель Хранилище -->
    <div class="sub-settings-panel">
      <h3>Настройки хранилища</h3>
      <div class="setting-form">
        <p>Настройки для хранения данных</p>
        <div class="form-group">
          <label class="form-label">Тип хранилища:</label>
          <select v-model="settings.storageType" class="form-control">
            <option value="local">Локальное</option>
            <option value="ipfs">IPFS</option>
            <option value="arweave">Arweave</option>
          </select>
        </div>
        <button class="btn btn-primary" @click="saveSettings('storage')">Сохранить</button>
      </div>
    </div>
    
    <!-- Панель CPU -->
    <div class="sub-settings-panel">
      <h3>Настройки CPU</h3>
      <div class="setting-form">
        <p>Оптимизация использования CPU</p>
        <div class="form-group">
          <label class="form-label">Максимальное использование CPU (%):</label>
          <input type="number" v-model="settings.maxCpuUsage" min="0" max="100" class="form-control">
        </div>
        <button class="btn btn-primary" @click="saveSettings('cpu')">Сохранить</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
// TODO: Импортировать API

const settings = reactive({
  defaultAuthMethod: 'wallet',
  rpcEndpoints: {
    ethereum: '',
    polygon: ''
  },
  useCustomNode: false,
  customNodeUrl: '',
  storageType: 'local',
  maxCpuUsage: 80
});

onMounted(() => {
  loadSecuritySettings();
});

const loadSecuritySettings = async () => {
  console.log('[SecuritySettingsView] Загрузка настроек безопасности...');
  // TODO: API call
};

const saveSettings = async (section) => {
  console.log(`[SecuritySettingsView] Сохранение настроек раздела: ${section}`);
  // TODO: API call
};
</script>

<style scoped>
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
.sub-settings-panel:last-child {
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
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.form-control {
  max-width: 500px;
}
.btn-primary {
 align-self: flex-start;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style> 