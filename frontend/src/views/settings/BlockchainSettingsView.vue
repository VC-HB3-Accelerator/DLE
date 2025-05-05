<template>
  <div class="blockchain-settings settings-panel">
    <h2>Настройки Блокчейна</h2>
    
    <!-- Панель Смарт-контракты -->
    <div class="sub-settings-panel">
      <h3>Настройки смарт-контрактов</h3>
      <div class="setting-form">
        <p>Управление смарт-контрактами</p>
        <div class="form-group">
          <label class="form-label">Адрес основного контракта:</label>
          <input type="text" v-model="settings.contractAddress" class="form-control">
        </div>
        <button class="btn btn-primary" @click="saveSettings('smartContract')">Сохранить</button>
      </div>
    </div>
    
    <!-- Панель Кворум -->
    <div class="sub-settings-panel">
      <h3>Настройки кворума</h3>
      <div class="setting-form">
        <p>Настройки кворума для блокчейн-операций</p>
        <div class="form-group">
          <label class="form-label">Минимальный кворум (%):</label>
          <input type="number" v-model="settings.quorumPercent" min="0" max="100" class="form-control">
        </div>
        <button class="btn btn-primary" @click="saveSettings('quorum')">Сохранить</button>
      </div>
    </div>
    
    <!-- Панель RWA -->
    <div class="sub-settings-panel">
      <h3>Настройки Real World Assets (RWA)</h3>
      <div class="setting-form">
        <p>Конфигурация для работы с реальными активами</p>
        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" v-model="settings.rwaEnabled">
            Включить поддержку RWA
          </label>
        </div>
        <button class="btn btn-primary" @click="saveSettings('rwa')">Сохранить</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
// TODO: Импортировать API

const settings = reactive({
  contractAddress: '',
  quorumPercent: 51,
  rwaEnabled: false
});

onMounted(() => {
  loadBlockchainSettings();
});

const loadBlockchainSettings = async () => {
  console.log('[BlockchainSettingsView] Загрузка настроек блокчейна...');
  // TODO: API call
};

const saveSettings = async (section) => {
  console.log(`[BlockchainSettingsView] Сохранение настроек раздела: ${section}`);
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