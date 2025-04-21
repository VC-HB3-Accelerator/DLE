<template>
  <div class="telegram-connect">
    <div v-if="!showQR" class="intro">
      <p>Подключите свой аккаунт Telegram для быстрой авторизации</p>
      <button class="connect-button" :disabled="loading" @click="startConnection">
        <span class="telegram-icon">📱</span>
        {{ loading ? 'Загрузка...' : 'Подключить Telegram' }}
      </button>
    </div>

    <div v-else class="qr-section">
      <p>Отсканируйте QR-код в приложении Telegram</p>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="qr-container" v-html="qrCode" />
      <p class="or-divider">или</p>
      <a :href="botLink" target="_blank" class="bot-link"> Открыть бота в Telegram </a>
      <button class="reset-button" @click="resetConnection">Отмена</button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup>
  import { ref, onMounted, onUnmounted } from 'vue';
  import axios from '@/api/axios';
  import { useAuth } from '@/composables/useAuth';
  import QRCode from 'qrcode';

  const emit = defineEmits(['close']);
  const { linkIdentity } = useAuth();

  const loading = ref(false);
  const error = ref('');
  const showQR = ref(false);
  const qrCode = ref('');
  const botLink = ref('');
  const pollInterval = ref(null);
  const connectionToken = ref('');

  const startConnection = async () => {
    try {
      loading.value = true;
      error.value = '';

      const response = await axios.post('/api/auth/telegram/start-connection');

      if (response.data.success) {
        connectionToken.value = response.data.token;
        botLink.value = `https://t.me/${response.data.botUsername}?start=${connectionToken.value}`;

        // Генерируем QR-код
        const qr = await QRCode.toDataURL(botLink.value);
        qrCode.value = `<img src="${qr}" alt="Telegram QR Code" />`;

        showQR.value = true;
        startPolling();
      } else {
        error.value = response.data.error || 'Не удалось начать процесс подключения';
      }
    } catch (err) {
      error.value = err.response?.data?.error || 'Ошибка при подключении Telegram';
    } finally {
      loading.value = false;
    }
  };

  const checkConnection = async () => {
    try {
      const response = await axios.post('/api/auth/telegram/check-connection', {
        token: connectionToken.value,
      });

      if (response.data.success && response.data.telegramId) {
        // Связываем Telegram с текущим пользователем
        await linkIdentity('telegram', response.data.telegramId);
        stopPolling();
        emit('close');
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const startPolling = () => {
    pollInterval.value = setInterval(checkConnection, 2000);
  };

  const stopPolling = () => {
    if (pollInterval.value) {
      clearInterval(pollInterval.value);
      pollInterval.value = null;
    }
  };

  const resetConnection = () => {
    stopPolling();
    showQR.value = false;
    error.value = '';
    qrCode.value = '';
    botLink.value = '';
    connectionToken.value = '';
  };

  onUnmounted(() => {
    stopPolling();
  });
</script>
