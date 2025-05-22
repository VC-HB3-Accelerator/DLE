<template>
  <div class="ollama-settings settings-panel">
    <h2>Настройки Ollama</h2>
    <div class="current-model-block">
      <span>Текущая модель:</span>
      <b>{{ currentModel }}</b>
    </div>
    <div class="select-model-block">
      <label for="ollamaModel">Доступные модели для загрузки:</label>
      <select id="ollamaModel" v-model="selectedModel">
        <option v-for="model in availableModels" :key="model" :value="model">{{ model }}</option>
      </select>
    </div>
    <button class="close-btn" @click="$emit('cancel')">Закрыть</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
// TODO: заменить на реальный API Ollama
const currentModel = ref('qwen2.5');
const availableModels = ref(['qwen2.5', 'llama3', 'mistral', 'phi3', 'gemma']);
const selectedModel = ref(currentModel.value);

onMounted(() => {
  // Здесь будет запрос к Ollama для получения списка моделей и текущей
});
</script>

<style scoped>
.ollama-settings.settings-panel {
  padding: var(--block-padding);
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-lg);
  max-width: 500px;
}
.current-model-block {
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
}
.select-model-block {
  margin-bottom: 2rem;
}
select {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 1rem;
}
.close-btn {
  background: #eee;
  color: #333;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
}
.close-btn:hover {
  background: #ddd;
}
</style> 