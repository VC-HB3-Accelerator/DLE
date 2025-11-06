<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class='modal-bg'>
    <div class='modal'>
      <h3>{{ rule ? 'Редактировать' : 'Создать' }} набор правил</h3>
      
      <label>Название *</label>
      <input v-model="name" placeholder="Например: VIP Правило" />
      
      <label>Описание</label>
      <textarea v-model="description" rows="2" placeholder="Опишите правило в свободной форме" />
      
      <div class="rules-section">
        <h4>Системный промпт</h4>
        <textarea 
          v-model="ruleFields.system_prompt" 
          rows="4" 
          placeholder="Дополнительный системный промпт для этого правила. Например: 'Ты работаешь с VIP клиентами. Будь вежливым и профессиональным.'"
        />
      </div>

      <div class="rules-section">
        <h4>Параметры LLM</h4>
        <div class="form-row">
          <div class="form-group">
            <label>Temperature (0.0-2.0)</label>
            <input 
              type="number" 
              v-model.number="ruleFields.temperature" 
              min="0" 
              max="2" 
              step="0.1"
              placeholder="0.7"
            />
          </div>
          <div class="form-group">
            <label>Max Tokens</label>
            <input 
              type="number" 
              v-model.number="ruleFields.max_tokens" 
              min="1" 
              max="4000"
              placeholder="500"
            />
          </div>
        </div>
      </div>

      <div class="rules-section">
        <h4>Правила поведения</h4>
        <div class="form-group">
          <label>Разрешенные темы (через запятую)</label>
          <input 
            v-model="allowedTopicsText" 
            placeholder="продукт, поддержка, VIP услуги"
          />
        </div>
        <div class="form-group">
          <label>Запрещенные слова (через запятую)</label>
          <input 
            v-model="forbiddenWordsText" 
            placeholder="ругательство, спам"
          />
        </div>
        <div class="form-checkbox">
          <label>
            <input type="checkbox" v-model="ruleFields.checkUserTags" />
            Учитывать теги пользователя при фильтрации RAG
          </label>
        </div>
        <div class="form-checkbox">
          <label>
            <input type="checkbox" v-model="ruleFields.searchRagFirst" />
            Сначала искать в RAG базе знаний
          </label>
        </div>
        <div class="form-checkbox">
          <label>
            <input type="checkbox" v-model="ruleFields.generateIfNoRag" />
            Генерировать ответ, если ничего не найдено в RAG
          </label>
        </div>
      </div>

      <div class="rules-section" v-if="showJsonPreview">
        <h4>Предпросмотр JSON</h4>
        <pre class="json-preview">{{ generatedJson }}</pre>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
      
      <div class="actions">
        <button @click="save" :disabled="!name.trim()">Сохранить</button>
        <button @click="close">Отмена</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, watch, computed } from 'vue';
import axios from 'axios';

const emit = defineEmits(['close']);
const props = defineProps({ rule: Object });

const name = ref(props.rule ? props.rule.name : '');
const description = ref(props.rule ? props.rule.description : '');
const error = ref('');
const showJsonPreview = ref(false);

// Поля правила
const ruleFields = ref({
  system_prompt: props.rule?.rules?.system_prompt || '',
  temperature: props.rule?.rules?.temperature ?? 0.7,
  max_tokens: props.rule?.rules?.max_tokens ?? 500,
  checkUserTags: props.rule?.rules?.rules?.checkUserTags ?? true,
  searchRagFirst: props.rule?.rules?.rules?.searchRagFirst ?? true,
  generateIfNoRag: props.rule?.rules?.rules?.generateIfNoRag ?? true,
  allowed_topics: props.rule?.rules?.rules?.allowed_topics || [],
  forbidden_words: props.rule?.rules?.rules?.forbidden_words || []
});

// Текстовые поля для массивов
const allowedTopicsText = ref(
  props.rule?.rules?.rules?.allowed_topics?.join(', ') || ''
);
const forbiddenWordsText = ref(
  props.rule?.rules?.rules?.forbidden_words?.join(', ') || ''
);

// Генерация JSON из полей формы
const generatedJson = computed(() => {
  const rules = {
    system_prompt: ruleFields.value.system_prompt || undefined,
    temperature: ruleFields.value.temperature,
    max_tokens: ruleFields.value.max_tokens,
    rules: {
      checkUserTags: ruleFields.value.checkUserTags,
      searchRagFirst: ruleFields.value.searchRagFirst,
      generateIfNoRag: ruleFields.value.generateIfNoRag,
      allowed_topics: allowedTopicsText.value
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0),
      forbidden_words: forbiddenWordsText.value
        .split(',')
        .map(w => w.trim())
        .filter(w => w.length > 0)
    }
  };

  // Удаляем undefined поля
  Object.keys(rules).forEach(key => {
    if (rules[key] === undefined) delete rules[key];
  });

  return JSON.stringify(rules, null, 2);
});

watch(() => props.rule, (newRule) => {
  if (newRule) {
    name.value = newRule.name || '';
    description.value = newRule.description || '';
    
    ruleFields.value = {
      system_prompt: newRule.rules?.system_prompt || '',
      temperature: newRule.rules?.temperature ?? 0.7,
      max_tokens: newRule.rules?.max_tokens ?? 500,
      checkUserTags: newRule.rules?.rules?.checkUserTags ?? true,
      searchRagFirst: newRule.rules?.rules?.searchRagFirst ?? true,
      generateIfNoRag: newRule.rules?.rules?.generateIfNoRag ?? true,
      allowed_topics: newRule.rules?.rules?.allowed_topics || [],
      forbidden_words: newRule.rules?.rules?.forbidden_words || []
    };
    
    allowedTopicsText.value = (newRule.rules?.rules?.allowed_topics || []).join(', ');
    forbiddenWordsText.value = (newRule.rules?.rules?.forbidden_words || []).join(', ');
  } else {
    // Сброс для нового правила
    name.value = '';
    description.value = '';
    ruleFields.value = {
      system_prompt: '',
      temperature: 0.7,
      max_tokens: 500,
      checkUserTags: true,
      searchRagFirst: true,
      generateIfNoRag: true,
      allowed_topics: [],
      forbidden_words: []
    };
    allowedTopicsText.value = '';
    forbiddenWordsText.value = '';
  }
  error.value = '';
});

async function save() {
  if (!name.value.trim()) {
    error.value = 'Название обязательно для заполнения';
    return;
  }

  try {
    // Генерируем JSON из полей формы
    const rules = JSON.parse(generatedJson.value);
    
    if (props.rule && props.rule.id) {
      await axios.put(`/settings/ai-assistant-rules/${props.rule.id}`, { 
        name: name.value, 
        description: description.value, 
        rules 
      });
    } else {
      await axios.post('/settings/ai-assistant-rules', { 
        name: name.value, 
        description: description.value, 
        rules 
      });
    }
    emit('close', true);
  } catch (e) {
    error.value = `Ошибка сохранения: ${e.message}`;
    console.error('Ошибка сохранения правила:', e);
  }
}

function close() { 
  emit('close', false); 
}
</script>
<style scoped>
.modal-bg {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  overflow-y: auto;
  padding: 20px;
}

.modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.12);
  padding: 2rem;
  min-width: 500px;
  max-width: 600px;
  width: 100%;
  margin: auto;
}

h3 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #333;
}

h4 {
  margin-top: 0;
  margin-bottom: 0.75rem;
  font-size: 1rem;
  color: #555;
  font-weight: 600;
}

label {
  display: block;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
}

input[type="text"],
input[type="number"],
textarea {
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.625rem;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
}

input[type="text"]:focus,
input[type="number"]:focus,
textarea:focus {
  outline: none;
  border-color: var(--color-primary, #007bff);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

textarea {
  resize: vertical;
  font-family: 'Courier New', monospace;
}

.rules-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #eee;
}

.rules-section:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-checkbox {
  margin-top: 0.75rem;
}

.form-checkbox label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0;
  cursor: pointer;
  font-weight: normal;
}

.form-checkbox input[type="checkbox"] {
  width: auto;
  margin: 0;
  cursor: pointer;
}

.json-preview {
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 1rem;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  font-family: 'Courier New', monospace;
  max-height: 200px;
  overflow-y: auto;
  color: #333;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  justify-content: flex-end;
}

button {
  background: var(--color-primary, #007bff);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.625rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background: var(--color-primary-dark, #0056b3);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:last-child {
  background: #eee;
  color: #333;
}

button:last-child:hover {
  background: #ddd;
}

.error {
  color: #c00;
  margin-top: 1rem;
  padding: 0.75rem;
  background: #ffe6e6;
  border-radius: 6px;
  border: 1px solid #ffcccc;
  font-size: 0.9rem;
}
</style> 