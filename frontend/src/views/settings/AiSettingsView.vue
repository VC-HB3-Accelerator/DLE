<template>
  <div class="ai-settings settings-panel">
    <h2>Настройки ИИ</h2>
    
    <!-- Панель Промт -->
    <div class="sub-settings-panel">
      <h3>Настройки промптов</h3>
      <div class="setting-form">
        <p>Здесь будут настройки для конфигурации промптов</p>
        <textarea v-model="settings.prompt" placeholder="Базовый промпт для ИИ..." rows="5" class="form-control"></textarea>
        <button class="btn btn-primary" @click="saveSettings('prompt')">Сохранить</button>
      </div>
    </div>
    
    <!-- Панель RAG -->
    <div class="sub-settings-panel">
      <h3>Настройки RAG (Retrieval Augmented Generation)</h3>
      <div class="setting-form">
        <p>Конфигурация системы поиска и генерации ответов</p>
        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" v-model="settings.ragEnabled">
            Включить RAG
          </label>
        </div>
        <button class="btn btn-primary" @click="saveSettings('rag')">Сохранить</button>
      </div>
    </div>
    
    <!-- Панель Каналы -->
    <div class="sub-settings-panel">
      <h3>Настройки каналов для ИИ</h3>
      <div class="setting-form">
        <p>Управление каналами связи для ИИ</p>
        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" v-model="settings.channels.telegram">
            Telegram
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" v-model="settings.channels.email">
            Email
          </label>
        </div>
        <button class="btn btn-primary" @click="saveSettings('channels')">Сохранить</button>
      </div>
    </div>
    
    <!-- Панель Модели -->
    <div class="sub-settings-panel">
      <h3>Настройки моделей ИИ</h3>
      <div class="setting-form">
        <p>Выбор и конфигурация моделей ИИ</p>
        <div class="form-group">
          <label class="form-label">Модель по умолчанию:</label>
          <select v-model="settings.defaultModel" class="form-control">
            <option value="claude-3-haiku">Claude 3 Haiku</option>
            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
            <option value="gpt-4o">GPT-4o</option>
          </select>
        </div>
        <button class="btn btn-primary" @click="saveSettings('models')">Сохранить</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Логика из AISettings.vue
import { reactive, onMounted } from 'vue';
// TODO: Импортировать API для загрузки/сохранения

// Локальное состояние настроек
const settings = reactive({
  prompt: '',
  ragEnabled: false,
  channels: {
    telegram: false,
    email: false
  },
  defaultModel: 'claude-3-sonnet'
});

// Загрузка настроек при монтировании
onMounted(() => {
  loadAiSettings();
});

const loadAiSettings = async () => {
  console.log('[AiSettingsView] Загрузка настроек ИИ...');
  // TODO: Заменить на реальный вызов API
  // Пример:
  // try {
  //   const response = await api.get('/api/settings/ai');
  //   Object.assign(settings, response.data);
  // } catch (error) {
  //   console.error('Ошибка загрузки настроек ИИ:', error);
  // }
};

// Сохранение настроек
const saveSettings = async (section) => {
  console.log(`[AiSettingsView] Сохранение настроек раздела: ${section}`);
  // TODO: Заменить на реальный вызов API
  // Пример:
  // try {
  //   const dataToSave = { [section]: settings[section] }; // Или вся группа настроек
  //   await api.post('/api/settings/ai', dataToSave);
  //   // Показать сообщение об успехе
  // } catch (error) {
  //   console.error('Ошибка сохранения настроек ИИ:', error);
  //   // Показать сообщение об ошибке
  // }
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
  margin-bottom: 0; /* Убираем лишний отступ, т.к. есть gap */
}

.form-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.form-control {
  max-width: 500px; /* Ограничим ширину для select/textarea */
}

.btn-primary {
 align-self: flex-start;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style> 