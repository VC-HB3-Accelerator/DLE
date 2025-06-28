<template>
  <div class="cloudflare-details settings-panel">
    <button class="close-btn" @click="goBack">×</button>
    <h2>Настройка Cloudflare и подключение домена</h2>
    <ol class="instruction-block">
      <li>Зайдите в свой аккаунт <a href="https://dash.cloudflare.com/" target="_blank">Cloudflare</a> и добавьте ваш домен.</li>
      <li>Смените NS-записи у регистратора домена на те, что выдаст Cloudflare (см. <a href="https://developers.cloudflare.com/fundamentals/setup/add-site/ns/" target="_blank">инструкцию</a>).</li>
      <li>Дождитесь, когда домен будет обслуживаться Cloudflare (обычно 5-30 минут).</li>
      <li>Сгенерируйте <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">API Token</a> с правами управления DNS и туннелями.</li>
      <li>Введите API Token и домен ниже для автоматической настройки туннеля и DNS.</li>
      <li><b>Один раз выполните в терминале WSL2:</b>
        <pre style="white-space:pre-line;font-size:0.95em;">curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared noble main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update
sudo apt install cloudflared</pre>
      </li>
      <li>Нажмите кнопку <b>Автоматически настроить и открыть приложение</b> и дождитесь появления ссылки.</li>
    </ol>
    <form class="form-block" @submit.prevent="saveToken">
      <label>Cloudflare API Token:</label>
      <input v-model="apiToken" type="text" class="form-control" placeholder="Введите API Token" />
      <button class="btn-primary" type="submit">Сохранить токен</button>
    </form>
    <div v-if="accounts.length" class="form-block">
      <label>Выберите аккаунт Cloudflare:</label>
      <select v-model="selectedAccountId" class="form-control">
        <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
          {{ acc.name }} ({{ acc.id }})
        </option>
      </select>
      <button class="btn-primary" @click="saveAccountId">Сохранить аккаунт</button>
      <div v-if="accountStatusMsg" class="status-block">{{ accountStatusMsg }}</div>
    </div>
    <form class="form-block" @submit.prevent="connectDomain">
      <label>Домен для туннеля:</label>
      <input v-model="domain" type="text" class="form-control" placeholder="example.com" />
      <button class="btn-primary" type="submit">Проверить и подключить домен</button>
    </form>
    <div class="status-block">
      <b>Статус Cloudflared:</b> {{ tunnelStatus }}<br>
      <b>Статус домена:</b> {{ domainStatusMsg }}<br>
      <b>Статус туннеля:</b> {{ tunnelStatusMsg }}<br>
      <span v-if="statusMsg">{{ statusMsg }}</span>
    </div>
    <div v-if="appUrl" class="app-link-block">
      <a :href="appUrl" target="_blank" class="btn-primary open-app-btn">
        Открыть приложение
      </a>
    </div>
    <div v-if="autoSetupSteps.length" class="auto-setup-steps">
      <div v-for="step in autoSetupSteps" :key="step.step" :class="['auto-setup-step', step.status]">
        {{ step.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
const router = useRouter();
const goBack = () => router.push('/settings/interface');

const apiToken = ref('');
const domain = ref('');
const statusMsg = ref('');
const tunnelStatus = ref('');
const domainStatusMsg = ref('');
const tunnelStatusMsg = ref('');
const appUrl = ref('');
const autoSetupSteps = ref([]);
const accounts = ref([]);
const selectedAccountId = ref('');
const accountStatusMsg = ref('');

async function loadSettings() {
  try {
    console.log('[CloudflareDetails] loadSettings: start');
    const res = await fetch('/api/cloudflare/settings');
    const data = await res.json();
    console.log('[CloudflareDetails] loadSettings: data', data);
    if (data.success && data.settings) {
      apiToken.value = data.settings.api_token || '';
      domain.value = data.settings.domain || '';
    }
  } catch (e) {
    console.error('[CloudflareDetails] loadSettings: error', e);
  }
}

async function saveToken() {
  try {
    console.log('[CloudflareDetails] saveToken: start', apiToken.value);
    const res = await fetch('/api/cloudflare/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: apiToken.value })
    });
    const data = await res.json();
    console.log('[CloudflareDetails] saveToken: data', data);
    statusMsg.value = data.message || 'Токен сохранён!';
    // Получить список аккаунтов
    const accRes = await fetch('/api/cloudflare/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_token: apiToken.value })
    });
    const accData = await accRes.json();
    if (accData.success && accData.accounts) {
      accounts.value = accData.accounts;
      accountStatusMsg.value = 'Выберите аккаунт и сохраните.';
    } else {
      accountStatusMsg.value = accData.message || 'Ошибка получения аккаунтов';
    }
    getStatus();
  } catch (e) {
    console.error('[CloudflareDetails] saveToken: error', e);
    statusMsg.value = 'Ошибка при сохранении токена';
    accountStatusMsg.value = 'Ошибка получения аккаунтов';
  }
}

async function saveAccountId() {
  try {
    const res = await fetch('/api/cloudflare/account-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: selectedAccountId.value })
    });
    const data = await res.json();
    accountStatusMsg.value = data.message || 'Account ID сохранён!';
    getStatus();
  } catch (e) {
    accountStatusMsg.value = 'Ошибка при сохранении Account ID';
  }
}

async function connectDomain() {
  try {
    statusMsg.value = 'Выполняется автоматическая настройка...';
    appUrl.value = '';
    autoSetupSteps.value = [];
    const res = await fetch('/api/cloudflare/domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain.value })
    });
    const data = await res.json();
    if (data.success) {
      statusMsg.value = data.message || 'Готово!';
      appUrl.value = data.app_url || '';
      autoSetupSteps.value = data.steps || [];
    } else {
      statusMsg.value = data.error || 'Ошибка автоматической настройки';
      autoSetupSteps.value = data.steps || [];
    }
    getStatus();
  } catch (e) {
    statusMsg.value = 'Ошибка автоматической настройки: ' + e.message;
  }
}

async function getStatus() {
  try {
    console.log('[CloudflareDetails] getStatus: start');
    const res = await fetch('/api/cloudflare/status');
    const data = await res.json();
    console.log('[CloudflareDetails] getStatus: data', data);
    tunnelStatus.value = data.status || '';
    domainStatusMsg.value = data.domainMsg || '';
    tunnelStatusMsg.value = data.tunnelMsg || '';
  } catch (e) {
    console.error('[CloudflareDetails] getStatus: error', e);
    tunnelStatus.value = 'Ошибка';
    domainStatusMsg.value = 'Ошибка';
    tunnelStatusMsg.value = 'Ошибка';
  }
}

onMounted(() => {
  loadSettings();
  getStatus();
});
</script>

<style scoped>
.cloudflare-details.settings-panel {
  padding: var(--block-padding);
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-lg);
  animation: fadeIn var(--transition-normal);
  min-height: 200px;
  position: relative;
}
h2 {
  margin-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-grey-light);
  padding-bottom: var(--spacing-md);
}
.instruction-block {
  background: #f8f8f8;
  border-radius: 8px;
  padding: 1rem 1.5rem;
  margin-bottom: 2rem;
  font-size: 1rem;
}
.form-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  max-width: 400px;
}
.form-control {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 1rem;
}
.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
  margin-top: 0.5rem;
  align-self: flex-start;
}
.btn-primary:hover {
  background: var(--color-primary-dark);
}
.btn-primary.install-btn {
  margin-top: 2rem;
}
.status-block {
  margin: 1.5rem 0 0.5rem 0;
  font-size: 1.05rem;
  color: #555;
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
  z-index: 10;
}
.close-btn:hover {
  color: #333;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.app-link-block {
  margin-top: 2rem;
}
.open-app-btn {
  display: inline-block;
  padding: 0.7rem 2rem;
  font-size: 1.1rem;
  background: var(--color-success, #2cae4f);
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s;
}
.open-app-btn:hover {
  background: var(--color-success-dark, #1e7d32);
}
.auto-setup-btn {
  margin-top: 1.5rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
  display: block;
}
.auto-setup-steps {
  margin-top: 1.5rem;
}
.auto-setup-step {
  margin-bottom: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background: #f8f8f8;
  font-size: 1rem;
}
.auto-setup-step.ok {
  color: #2cae4f;
}
.auto-setup-step.error {
  color: #c62828;
}
</style> 