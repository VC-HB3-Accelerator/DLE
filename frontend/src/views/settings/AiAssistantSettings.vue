<template>
  <div class="ai-assistant-settings-modal">
    <h2>Настройки ИИ-ассистента</h2>
    <form @submit.prevent="saveSettings">
      <label>Системный промт</label>
      <textarea v-model="settings.system_prompt" rows="3" />
      <label>Языки</label>
      <input v-model="languagesInput" placeholder="ru, en, es" />
      <label>Модель</label>
      <input v-model="settings.model" placeholder="qwen2.5" />
      <label>Выбранные RAG-таблицы</label>
      <select v-model="settings.selected_rag_tables" multiple>
        <option v-for="table in userTables" :key="table.id" :value="table.id">
          {{ table.name }}
        </option>
      </select>
      <label>Набор правил</label>
      <div class="rules-row">
        <select v-model="settings.rules_id">
          <option v-for="rule in rulesList" :key="rule.id" :value="rule.id">
            {{ rule.name }}
          </option>
        </select>
        <button type="button" @click="openRuleEditor()">Создать</button>
        <button type="button" :disabled="!settings.rules_id" @click="openRuleEditor(settings.rules_id)">Редактировать</button>
        <button type="button" :disabled="!settings.rules_id" @click="deleteRule(settings.rules_id)">Удалить</button>
      </div>
      <div v-if="selectedRule">
        <p><b>Описание:</b> {{ selectedRule.description }}</p>
        <pre class="rules-json">{{ JSON.stringify(selectedRule.rules, null, 2) }}</pre>
      </div>
      <label>Telegram-бот</label>
      <select v-model="settings.telegram_settings_id">
        <option v-for="tg in telegramBots" :key="tg.id" :value="tg.id">
          {{ tg.bot_username }}
        </option>
      </select>
      <label>Email для связи</label>
      <select v-model="settings.email_settings_id">
        <option v-for="em in emailList" :key="em.id" :value="em.id">
          {{ em.from_email }}
        </option>
      </select>
      <div class="actions">
        <button type="submit">Сохранить</button>
        <button type="button" @click="emit('cancel')">Отмена</button>
      </div>
    </form>
    <RuleEditor v-if="showRuleEditor" :rule="editingRule" @close="onRuleEditorClose" />
  </div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import RuleEditor from '../../components/ai-assistant/RuleEditor.vue';
const emit = defineEmits(['cancel']);
const settings = ref({ system_prompt: '', model: '', selected_rag_tables: [], languages: [], rules_id: null });
const languagesInput = ref('');
const userTables = ref([]);
const rulesList = ref([]);
const showRuleEditor = ref(false);
const editingRule = ref(null);
const telegramBots = ref([]);
const emailList = ref([]);

const selectedRule = computed(() => rulesList.value.find(r => r.id === settings.value.rules_id) || null);

async function loadUserTables() {
  const { data } = await axios.get('/api/tables');
  userTables.value = Array.isArray(data) ? data : [];
}
async function loadRules() {
  const { data } = await axios.get('/api/settings/ai-assistant-rules');
  rulesList.value = data.rules || [];
}
async function loadSettings() {
  const { data } = await axios.get('/api/settings/ai-assistant');
  if (data.success && data.settings) {
    settings.value = data.settings;
    languagesInput.value = (data.settings.languages || []).join(', ');
  }
}
async function loadTelegramBots() {
  const { data } = await axios.get('/api/settings/telegram-settings');
  telegramBots.value = data.items || [];
}
async function loadEmailList() {
  const { data } = await axios.get('/api/settings/email-settings');
  emailList.value = data.items || [];
}
onMounted(() => {
  loadSettings();
  loadUserTables();
  loadRules();
  loadTelegramBots();
  loadEmailList();
});

async function saveSettings() {
  settings.value.languages = languagesInput.value.split(',').map(s => s.trim()).filter(Boolean);
  await axios.put('/api/settings/ai-assistant', settings.value);
  emit('cancel');
}

function openRuleEditor(ruleId = null) {
  if (ruleId) {
    editingRule.value = rulesList.value.find(r => r.id === ruleId) || null;
  } else {
    editingRule.value = null;
  }
  showRuleEditor.value = true;
}

async function deleteRule(ruleId) {
  if (!confirm('Удалить этот набор правил?')) return;
  await axios.delete(`/api/settings/ai-assistant-rules/${ruleId}`);
  await loadRules();
  if (settings.value.rules_id === ruleId) settings.value.rules_id = null;
}

async function onRuleEditorClose(updated) {
  showRuleEditor.value = false;
  editingRule.value = null;
  if (updated) await loadRules();
}
</script>

<style scoped>
.ai-assistant-settings-modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 2rem;
  max-width: 540px;
  margin: 2rem auto;
}
label {
  display: block;
  margin-top: 1rem;
  font-weight: 500;
}
textarea, input, select {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 1rem;
}
select[multiple] {
  min-height: 80px;
}
.rules-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.rules-json {
  background: #f7f7f7;
  border-radius: 6px;
  padding: 0.5rem;
  font-size: 0.95em;
  margin-top: 0.5rem;
  white-space: pre-wrap;
}
.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}
button[type="submit"], .actions button {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
}
button[type="button"] {
  background: #eee;
  color: #333;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
}
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
.error {
  color: #c00;
  margin-top: 0.5rem;
}
</style> 