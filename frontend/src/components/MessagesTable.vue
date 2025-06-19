<template>
  <div class="messages-table-modal">
    <div class="messages-table-header">
      <h2>Новые сообщения</h2>
    </div>
    <div v-if="!messages.length" class="empty">Нет новых сообщений</div>
    <div v-else class="messages-list">
      <Message v-for="msg in messages" :key="msg.id" :message="msg" />
    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';
import Message from './Message.vue';
const props = defineProps({
  messages: { type: Array, required: true }
});
</script>

<style scoped>
.messages-table-modal {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  margin-top: 40px;
  position: relative;
  overflow-x: auto;
}
.messages-table-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}
.empty {
  color: #888;
  text-align: center;
  margin: 20px 0;
}
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
</style> 