<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <BaseLayout>
    <div class="broadcast-page">
      <div class="broadcast-header">
        <div>
          <h1>Массовая рассылка</h1>
          <p>Вы выбрали {{ userIds.length }} пользователей для рассылки.</p>
        </div>
        <el-button :disabled="loading" @click="goBack">Назад к контактам</el-button>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="broadcast-alert"
      >
        <template #title>
          Каждое письмо отправляется отдельному получателю. Пользователи не увидят список рассылки.
        </template>
      </el-alert>

      <el-form class="broadcast-form" label-position="top" @submit.prevent>
        <el-form-item label="Тема письма" required>
          <el-input v-model="subject" placeholder="Введите тему письма" maxlength="200" show-word-limit />
        </el-form-item>

        <el-form-item label="Текст письма" required>
          <el-input
            v-model="message"
            type="textarea"
            :rows="12"
            placeholder="Введите текст письма"
          />
        </el-form-item>

        <el-form-item label="Вложения">
          <div class="attachments-box">
            <input ref="fileInputRef" class="file-input" type="file" multiple @change="onFilesSelected" />
            <el-button type="default" :disabled="loading" @click="openFilePicker">Добавить вложения</el-button>
            <span class="attachments-hint">Файлы будут приложены к каждому email-письму.</span>
          </div>

          <div v-if="attachments.length" class="attachments-list">
            <div v-for="(file, index) in attachments" :key="`${file.name}-${file.size}-${index}`" class="attachment-item">
              <span>{{ file.name }} ({{ formatFileSize(file.size) }})</span>
              <el-button link type="danger" :disabled="loading" @click="removeAttachment(index)">Удалить</el-button>
            </div>
          </div>
        </el-form-item>

        <el-divider />

        <section class="delivery-settings">
          <div class="section-heading">
            <h2>Настройки доставки</h2>
            <el-switch
              v-model="warmupMode"
              active-text="Режим прогрева"
              inactive-text="Обычный режим"
              :disabled="loading"
            />
          </div>

          <div class="settings-grid">
            <el-form-item label="Пауза между письмами">
              <el-input-number
                v-model="delaySeconds"
                :min="0"
                :max="600"
                :step="5"
                :disabled="loading"
              />
              <span class="field-hint">секунд</span>
            </el-form-item>

            <el-form-item label="Лимит писем за запуск">
              <el-input-number
                v-model="maxRecipients"
                :min="1"
                :max="Math.max(userIds.length, 1)"
                :disabled="loading"
              />
              <span class="field-hint">будет отправлено {{ recipientsToSend.length }} из {{ userIds.length }}</span>
            </el-form-item>
          </div>

          <el-alert
            v-if="warmupMode"
            type="success"
            :closable="false"
            show-icon
            class="delivery-alert"
          >
            <template #title>
              Режим прогрева снижает риск спама: небольшой лимит и заметная пауза между письмами.
            </template>
          </el-alert>

          <el-alert
            v-if="attachments.length"
            type="warning"
            :closable="false"
            show-icon
            class="delivery-alert"
          >
            <template #title>
              Вложения увеличивают риск попадания в спам. Общий размер: {{ formatFileSize(attachmentsTotalSize) }}.
              Для больших файлов лучше использовать ссылку в тексте письма.
            </template>
          </el-alert>

          <ul class="delivery-checklist">
            <li>Проверьте тему письма: без капса, спам-слов и агрессивных обещаний.</li>
            <li>Не отправляйте сразу всю базу с нового домена: начните с малого лимита.</li>
            <li>Если есть ссылка на отписку или контакт для отказа от писем, добавьте её в текст.</li>
          </ul>
        </section>

        <div v-if="loading" class="send-progress">
          <div class="progress-text">
            Отправка: {{ sentAttempts }} из {{ recipientsToSend.length }}
            <span v-if="currentUserId">, текущий ID {{ currentUserId }}</span>
          </div>
          <el-progress :percentage="progressPercentage" />
        </div>

        <div class="form-actions">
          <el-button :disabled="loading" @click="goBack">Отмена</el-button>
          <el-button type="primary" :disabled="!canSend" :loading="loading" @click="sendBroadcast">
            Отправить рассылку
          </el-button>
        </div>
      </el-form>

      <el-card v-if="result" class="result-card" shadow="never">
        <template #header>Результат отправки</template>
        <p>Успешно отправлено: {{ result.successCount }} из {{ result.totalCount }}</p>
        <p v-if="result.skippedCount">Не отправляли из-за лимита: {{ result.skippedCount }}</p>
        <div v-if="result.errors.length" class="errors-list">
          <p>Ошибки:</p>
          <ul>
            <li v-for="error in result.errors" :key="error.userId">
              ID {{ error.userId }}: {{ error.error }}
            </li>
          </ul>
        </div>
      </el-card>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import BaseLayout from '@/components/BaseLayout.vue';
import messagesService from '@/services/messagesService.js';

const route = useRoute();
const router = useRouter();

const subject = ref('');
const message = ref('');
const attachments = ref([]);
const loading = ref(false);
const result = ref(null);
const fileInputRef = ref(null);
const warmupMode = ref(true);
const delaySeconds = ref(60);
const maxRecipients = ref(20);
const sentAttempts = ref(0);
const currentUserId = ref(null);

const userIds = computed(() => {
  const ids = String(route.query.ids || '')
    .split(',')
    .map(id => Number(id.trim()))
    .filter(id => Number.isInteger(id) && id > 0);

  return [...new Set(ids)];
});

const normalizedMaxRecipients = computed(() => {
  return Math.max(1, Math.min(Number(maxRecipients.value) || 1, Math.max(userIds.value.length, 1)));
});

const recipientsToSend = computed(() => {
  return userIds.value.slice(0, normalizedMaxRecipients.value);
});

const attachmentsTotalSize = computed(() => {
  return attachments.value.reduce((sum, file) => sum + (file.size || 0), 0);
});

const progressPercentage = computed(() => {
  if (!recipientsToSend.value.length) return 0;
  return Math.round((sentAttempts.value / recipientsToSend.value.length) * 100);
});

const canSend = computed(() => {
  return recipientsToSend.value.length > 0 && subject.value.trim() && message.value.trim() && !loading.value;
});

watch(warmupMode, (enabled) => {
  if (enabled) {
    delaySeconds.value = Math.max(Number(delaySeconds.value) || 0, 60);
    maxRecipients.value = Math.min(20, Math.max(userIds.value.length, 1));
  }
});

watch(userIds, (ids) => {
  if (!ids.length) return;
  maxRecipients.value = Math.min(Number(maxRecipients.value) || ids.length, ids.length);
}, { immediate: true });

function goBack() {
  router.push({ name: 'contacts-list' });
}

function openFilePicker() {
  fileInputRef.value?.click();
}

function onFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  attachments.value = [...attachments.value, ...files];
  event.target.value = '';
}

function removeAttachment(index) {
  attachments.value.splice(index, 1);
}

function formatFileSize(size) {
  if (!size) return '0 Б';
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendBroadcast() {
  if (!canSend.value) return;

  loading.value = true;
  result.value = null;
  sentAttempts.value = 0;
  currentUserId.value = null;

  const errors = [];
  let successCount = 0;
  const recipients = [...recipientsToSend.value];

  for (const [index, userId] of recipients.entries()) {
    currentUserId.value = userId;

    try {
      await messagesService.broadcastMessage({
        userId,
        subject: subject.value.trim(),
        message: message.value.trim(),
        attachments: attachments.value
      });
      successCount += 1;
    } catch (error) {
      errors.push({
        userId,
        error: error?.response?.data?.error || error?.response?.data?.details || error?.message || 'Ошибка отправки'
      });
    } finally {
      sentAttempts.value = index + 1;
    }

    if (index < recipients.length - 1 && delaySeconds.value > 0) {
      await wait(Number(delaySeconds.value) * 1000);
    }
  }

  result.value = {
    successCount,
    errors,
    totalCount: recipients.length,
    skippedCount: Math.max(userIds.value.length - recipients.length, 0)
  };
  loading.value = false;
  currentUserId.value = null;

  if (errors.length) {
    ElMessage.warning(`Рассылка завершена с ошибками: ${errors.length}`);
  } else {
    ElMessage.success('Рассылка успешно отправлена');
  }
}
</script>

<style scoped>
.broadcast-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}

.broadcast-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.broadcast-header h1 {
  margin: 0 0 8px;
  font-size: 1.8rem;
}

.broadcast-header p {
  margin: 0;
  color: #606266;
}

.broadcast-alert {
  margin-bottom: 20px;
}

.broadcast-form {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.08);
  padding: 24px;
}

.attachments-box {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.file-input {
  display: none;
}

.attachments-hint,
.field-hint {
  color: #909399;
  font-size: 0.95rem;
}

.field-hint {
  margin-left: 10px;
}

.attachments-list {
  width: 100%;
  margin-top: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.attachment-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #ebeef5;
}

.attachment-item:last-child {
  border-bottom: 0;
}

.delivery-settings {
  margin-top: 4px;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.section-heading h2 {
  margin: 0;
  font-size: 1.2rem;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.delivery-alert {
  margin-bottom: 12px;
}

.delivery-checklist {
  margin: 12px 0 0;
  padding-left: 20px;
  color: #606266;
  line-height: 1.6;
}

.send-progress {
  margin-top: 24px;
}

.progress-text {
  margin-bottom: 8px;
  color: #606266;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.result-card {
  margin-top: 20px;
}

.errors-list {
  color: #f56c6c;
}

@media (max-width: 700px) {
  .broadcast-page {
    padding: 12px;
  }

  .broadcast-header,
  .section-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .broadcast-form {
    padding: 16px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column-reverse;
  }
}
</style>
