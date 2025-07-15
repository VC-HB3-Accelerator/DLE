<template>
  <BaseLayout>
    <div class="ai-assistant-settings-block">
      <button class="close-btn" @click="goBack">×</button>
      <h2>ИИ-ассистент: интеграция и настройки</h2>
      <div class="ai-assistant-settings settings-panel">
        <form @submit.prevent="saveSettings">
          <label>Системный промт</label>
          <textarea v-model="settings.system_prompt" rows="3" />
          <!-- Блок плейсхолдеров -->
          <div class="placeholders-block">
            <h4>Плейсхолдеры пользовательских таблиц</h4>
            <div v-if="placeholders.length === 0" class="empty-placeholder">Нет пользовательских плейсхолдеров</div>
            <table v-else class="placeholders-table">
              <thead>
                <tr>
                  <th>Плейсхолдер</th>
                  <th>Столбец</th>
                  <th>Таблица</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ph in placeholders" :key="ph.column_id">
                  <td><code>{ {{ ph.placeholder }} }</code></td>
                  <td>{{ ph.column_name }}</td>
                  <td>{{ ph.table_name }}</td>
                  <td><button type="button" @click="openEditPlaceholder(ph)">Редактировать</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Модалка редактирования плейсхолдера -->
          <div v-if="editingPlaceholder" class="modal-bg">
            <div class="modal">
              <h4>Редактировать плейсхолдер</h4>
              <div><b>Таблица:</b> {{ editingPlaceholder.table_name }}</div>
              <div><b>Столбец:</b> {{ editingPlaceholder.column_name }}</div>
              <label>Плейсхолдер</label>
              <input v-model="editingPlaceholderValue" />
              <div class="actions">
                <button type="button" @click="savePlaceholderEdit">Сохранить</button>
                <button type="button" @click="closeEditPlaceholder">Отмена</button>
              </div>
            </div>
          </div>
          <label>LLM-модель</label>
          <select v-if="llmModels.length" v-model="settings.model">
            <option v-for="m in llmModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.provider }})</option>
          </select>
          <input v-else v-model="settings.model" placeholder="qwen2.5" />
          <label>Embedding-модель</label>
          <select v-if="filteredEmbeddingModels.length" v-model="settings.embedding_model">
            <option v-for="m in filteredEmbeddingModels" :key="m.id" :value="m.id">{{ m.id }} ({{ m.provider }})</option>
          </select>
          <input v-else v-model="settings.embedding_model" placeholder="bge-base-zh" />
          <label>Выбранные RAG-таблицы</label>
          <select v-model="settings.selected_rag_tables" :multiple="false">
            <option v-for="table in ragTables" :key="table.id" :value="table.id">{{ table.name }} (id: {{ table.id }})</option>
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
            <button type="button" @click="goBack">Отмена</button>
          </div>
        </form>
        <RuleEditor v-if="showRuleEditor" :rule="editingRule" @close="onRuleEditorClose" />
      </div>
      
      <!-- Системный мониторинг -->
      <SystemMonitoring />
    </div>
  </BaseLayout>
</template>
<script setup>
import BaseLayout from '@/components/BaseLayout.vue';
import { useRouter } from 'vue-router';
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import axios from 'axios';
import RuleEditor from '@/components/ai-assistant/RuleEditor.vue';
import SystemMonitoring from '@/components/ai-assistant/SystemMonitoring.vue';
const router = useRouter();
const goBack = () => router.push('/settings/ai');
const settings = ref({ system_prompt: '', model: '', selected_rag_tables: [], rules_id: null });
const userTables = ref([]);
const ragTables = computed(() => userTables.value.filter(t => t.is_rag_source_id === 1));
const rulesList = ref([]);
const showRuleEditor = ref(false);
const editingRule = ref(null);
const telegramBots = ref([]);
const emailList = ref([]);
const llmModels = ref([]);
const embeddingModels = ref([]);
const selectedRule = computed(() => rulesList.value.find(r => r.id === settings.value.rules_id) || null);
const selectedLLM = computed(() => llmModels.value.find(m => m.id === settings.value.model));
const filteredEmbeddingModels = computed(() => {
  if (!selectedLLM.value) return embeddingModels.value;
  return embeddingModels.value.filter(m => m.provider === selectedLLM.value.provider);
});
const placeholders = ref([]);
const editingPlaceholder = ref(null);
const editingPlaceholderValue = ref('');

async function loadUserTables() {
  const { data } = await axios.get('/tables');
  userTables.value = Array.isArray(data) ? data : [];
}
async function loadRules() {
  const { data } = await axios.get('/settings/ai-assistant-rules');
  rulesList.value = data.rules || [];
}
async function loadSettings() {
  const { data } = await axios.get('/settings/ai-assistant');
  if (data.success && data.settings) {
    settings.value = data.settings;
  }
}
async function loadTelegramBots() {
  const { data } = await axios.get('/settings/telegram-settings/list');
  telegramBots.value = data.items || [];
}
async function loadEmailList() {
  const { data } = await axios.get('/settings/email-settings/list');
  emailList.value = data.items || [];
}
async function loadLLMModels() {
  const { data } = await axios.get('/settings/llm-models');
  llmModels.value = data.models || [];
}
async function loadEmbeddingModels() {
  const { data } = await axios.get('/settings/embedding-models');
  embeddingModels.value = data.models || [];
}
async function loadPlaceholders() {
  const { data } = await axios.get('/tables/placeholders/all');
  placeholders.value = Array.isArray(data) ? data : [];
}
function openEditPlaceholder(ph) {
  editingPlaceholder.value = { ...ph };
  editingPlaceholderValue.value = ph.placeholder;
}
function closeEditPlaceholder() {
  editingPlaceholder.value = null;
  editingPlaceholderValue.value = '';
}
async function savePlaceholderEdit() {
  if (!editingPlaceholder.value) return;
  await axios.patch(`/tables/column/${editingPlaceholder.value.column_id}`, { placeholder: editingPlaceholderValue.value });
  await loadPlaceholders();
  closeEditPlaceholder();
}
onMounted(() => {
  loadSettings();
  loadUserTables();
  loadRules();
  loadTelegramBots();
  loadEmailList();
  loadLLMModels();
  loadEmbeddingModels();
  loadPlaceholders();
  // Подписка на глобальное событие обновления плейсхолдеров
  window.addEventListener('placeholders-updated', loadPlaceholders);
});

onBeforeUnmount(() => {
  window.removeEventListener('placeholders-updated', loadPlaceholders);
});
async function saveSettings() {
  await axios.put('/settings/ai-assistant', settings.value);
  goBack();
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
      await axios.delete(`/settings/ai-assistant-rules/${ruleId}`);
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
.ai-assistant-settings-block {
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%;
  position: relative;
  overflow-x: auto;
}
.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}
h2 {
  margin-bottom: 0;
}
.ai-assistant-settings.settings-panel {
  background: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  margin-top: 0 !important;
  max-width: 100% !important;
  padding: 0 !important;
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
.rag-table-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1em 0;
}
.rag-table-link {
  color: #2ecc40;
  text-decoration: underline;
  cursor: pointer;
  font-weight: 500;
}
.rag-table-link:hover {
  color: #27ae38;
}
.placeholders-block {
  margin: 1.5em 0 2em 0;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1em 1.5em;
}
.placeholders-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5em;
  background: #fff;
}
.placeholders-table th, .placeholders-table td {
  border: 1px solid #ececec;
  padding: 0.5em 0.7em;
  font-size: 1em;
}
.placeholders-table th {
  background: #f7f7f7;
  font-weight: 600;
}
.empty-placeholder {
  color: #888;
  font-size: 1em;
  margin: 0.7em 0;
}
</style> 