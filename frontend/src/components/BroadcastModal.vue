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
  <el-dialog v-model="visible" :title="t('contacts.broadcastModal.title')" width="700px" @close="$emit('close')">
    <div v-if="step === 1">
      <div style="margin-bottom:1em;">{{ t('contacts.broadcastModal.selectedUsers', { count: userIds.length }) }}</div>
      <ChatInterface
        v-model:newMessage="message"
        :canSend="true"
        :canGenerateAI="false"
        :canSelectMessages="false"
        :messages="[]"
        :attachments="attachments"
        @update:attachments="val => attachments = val"
        @send-message="onSend"
      />
      <el-button type="primary" :disabled="!message.trim()" @click="sendBroadcast" :loading="loading">{{ t('common.send') }}</el-button>
      <el-button @click="$emit('close')" style="margin-left:1em;">{{ t('common.cancel') }}</el-button>
    </div>
    <div v-else-if="step === 2">
      <div v-if="result.success" style="color:green;">{{ t('contacts.broadcastModal.success') }}</div>
      <div v-if="result.errors && result.errors.length" style="color:red;max-height:120px;overflow:auto;">
        {{ t('common.errors') }}
        <ul>
          <li v-for="err in result.errors" :key="err.userId">{{ t('common.userId', { id: err.userId, error: err.error }) }}</li>
        </ul>
      </div>
      <el-button type="primary" @click="closeAndRefresh">{{ t('common.close') }}</el-button>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ChatInterface from './ChatInterface.vue';
import messagesService from '../services/messagesService.js';

const { t } = useI18n();
const props = defineProps({ userIds: { type: Array, required: true } });
const emit = defineEmits(['close']);
const visible = ref(true);
const message = ref('');
const attachments = ref([]);
const loading = ref(false);
const step = ref(1);
const result = ref({});

async function sendBroadcast() {
  loading.value = true;
  const errors = [];
  let successCount = 0;
  for (const userId of props.userIds) {
    try {
      await messagesService.broadcastMessage({ userId, message: message.value });
      successCount++;
    } catch (e) {
      errors.push({ userId, error: e?.message || t('common.sendError') });
    }
  }
  result.value = { success: errors.length === 0, errors };
  step.value = 2;
  loading.value = false;
}
function onSend() {
  sendBroadcast();
}
function closeAndRefresh() {
  visible.value = false;
  setTimeout(() => {
    step.value = 1;
    result.value = {};
    message.value = '';
    attachments.value = [];
    loading.value = false;
    emit('close');
  }, 300);
}
</script>
