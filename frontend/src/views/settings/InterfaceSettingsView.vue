<template>
  <div class="interface-settings settings-panel">
    <h2>Настройки Интерфейса</h2>

    <!-- Панель Язык -->
    <div class="sub-settings-panel">
      <h3>Настройки языка</h3>
      <div class="setting-form">
        <p>Выбор языка интерфейса</p>
        <div class="form-group">
          <label class="form-label">Язык интерфейса:</label>
          <select v-model="selectedLanguage" class="form-control">
            <option value="ru">Русский</option>
            <option value="en">English</option> 
            <!-- Добавить другие языки по необходимости -->
          </select>
        </div>
      </div>
    </div>

    <DomainConnectBlock />

  </div>
</template>

<script setup>
import { ref } from 'vue';
import { getFromStorage, setToStorage } from '../../utils/storage'; // Путь к utils может отличаться
import DomainConnectBlock from './DomainConnectBlock.vue';
// TODO: Импортировать API для сохранения, если нужно

const selectedLanguage = ref(getFromStorage('userLanguage', 'ru'));

// Функция сохранения
const saveLanguageSetting = () => {
  setToStorage('userLanguage', selectedLanguage.value);
  console.log(`[InterfaceSettingsView] Язык сохранен как: ${selectedLanguage.value}`);
  // TODO: Добавить реальную смену языка (i18n)
  // TODO: Возможно, отправить на сервер, если язык влияет на бэкенд
  // alert('Язык сохранен!'); // Пример уведомления
};

// Можно убрать watch, если сохранение происходит только по кнопке
// watch(selectedLanguage, (newLang) => {
//   setToStorage('userLanguage', newLang);
//   console.log(`[InterfaceSettingsView] Язык изменен на: ${newLang}`);
// });
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
  /* Убираем нижнюю границу, если это последняя панель */
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
  display: block; /* Можно оставить блочным */
  margin-bottom: var(--spacing-xs);
}
.form-control {
  max-width: 300px; /* Ограничим ширину select */
}
.btn-primary {
 align-self: flex-start;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style> 