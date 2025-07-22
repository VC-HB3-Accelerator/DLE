<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <div class='modal-bg'>
    <div class='modal'>
      <h3>{{ rule ? 'Редактировать' : 'Создать' }} набор правил</h3>
      <label>Название</label>
      <input v-model="name" />
      <label>Описание</label>
      <textarea v-model="description" rows="3" placeholder="Опишите правило в свободной форме" />
      <label>Правила (JSON)</label>
      <textarea v-model="rulesJson" rows="6"></textarea>
      <div v-if="error" class="error">{{ error }}</div>
      <div class="actions">
        <button @click="save">Сохранить</button>
        <button @click="close">Отмена</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, watch } from 'vue';
import axios from 'axios';
const emit = defineEmits(['close']);
const props = defineProps({ rule: Object });
const name = ref(props.rule ? props.rule.name : '');
const description = ref(props.rule ? props.rule.description : '');
const rulesJson = ref(props.rule ? JSON.stringify(props.rule.rules, null, 2) : '{\n  "checkUserTags": true\n}');
const error = ref('');

watch(() => props.rule, (newRule) => {
  name.value = newRule ? newRule.name : '';
  description.value = newRule ? newRule.description : '';
  rulesJson.value = newRule ? JSON.stringify(newRule.rules, null, 2) : '{\n  "checkUserTags": true\n}';
});

function convertToJson() {
  // Простейший пример: если в описании есть "теги", выставляем checkUserTags
  // В реальном проекте здесь можно интегрировать LLM или шаблоны
  try {
    if (/тег[а-я]* пользов/.test(description.value.toLowerCase())) {
      rulesJson.value = JSON.stringify({ checkUserTags: true }, null, 2);
      error.value = '';
    } else {
      rulesJson.value = JSON.stringify({ customRule: description.value }, null, 2);
      error.value = '';
    }
  } catch (e) {
    error.value = 'Не удалось преобразовать описание в JSON';
  }
}

async function save() {
  let rules;
  try {
    rules = JSON.parse(rulesJson.value);
  } catch (e) {
    error.value = 'Ошибка в формате JSON!';
    return;
  }
  if (props.rule && props.rule.id) {
    await axios.put(`/settings/ai-assistant-rules/${props.rule.id}`, { name: name.value, description: description.value, rules });
  } else {
    await axios.post('/settings/ai-assistant-rules', { name: name.value, description: description.value, rules });
  }
  emit('close', true);
}
function close() { emit('close', false); }
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
}
.modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.12);
  padding: 2rem;
  min-width: 320px;
  max-width: 420px;
}
label {
  display: block;
  margin-top: 1rem;
  font-weight: 500;
}
input, textarea {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 1rem;
}
.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}
button {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
}
button:last-child {
  background: #eee;
  color: #333;
}
.error {
  color: #c00;
  margin-top: 0.5rem;
}
</style> 