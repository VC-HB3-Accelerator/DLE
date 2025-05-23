<template>
  <div class="domain-block">
    <h3>Подключение домена</h3>
    <p>Укажите свой домен, чтобы привязать его к опубликованному в IPFS фронтенду. Следуйте инструкции ниже для настройки DNS.</p>
    <div class="form-group">
      <input v-model="domain" class="form-control" placeholder="example.com" />
      <button class="btn-primary" :disabled="loading || !domain" @click="checkDomain">
        {{ loading ? 'Проверка...' : 'Проверить' }}
      </button>
    </div>
    <div v-if="error" class="error">Ошибка: {{ error }}</div>
    <div v-if="success" class="success">DNS-записи найдены: <pre>{{ records }}</pre></div>
    <div class="instruction">
      <b>Инструкция по подключению:</b>
      <ol>
        <li>Опубликуйте фронтенд в IPFS и получите CID.</li>
        <li>В панели управления доменом создайте DNS-запись типа <b>CNAME</b> или <b>TXT</b> (или используйте IPFS gateway).</li>
        <li>Для CNAME: укажите <code>yourdomain.com CNAME gateway.ipfs.io</code> или аналогичный шлюз.</li>
        <li>Для TXT: <code>_dnslink.yourdomain.com TXT dnslink=/ipfs/&lt;ваш CID&gt;</code></li>
        <li>Дождитесь обновления DNS и проверьте домен через эту форму.</li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from '../../api/axios';

const domain = ref('');
const loading = ref(false);
const error = ref('');
const success = ref(false);
const records = ref('');

async function checkDomain() {
  loading.value = true;
  error.value = '';
  success.value = false;
  records.value = '';
  try {
    const { data } = await axios.post('/api/settings/interface/check-domain', { domain: domain.value });
    if (data.success && data.records) {
      records.value = JSON.stringify(data.records, null, 2);
      success.value = true;
    } else {
      error.value = data.error || 'DNS-записи не найдены';
    }
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Ошибка запроса';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.domain-block {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem;
  margin-bottom: 2rem;
  max-width: 500px;
}
.form-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}
.form-control {
  flex: 1;
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
}
.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.success {
  margin-top: 1rem;
  color: var(--color-success, #2e7d32);
}
.error {
  margin-top: 1rem;
  color: var(--color-danger, #c62828);
}
.instruction {
  margin-top: 1.5rem;
  font-size: 0.95em;
  color: #555;
  background: #f8f8f8;
  border-radius: 8px;
  padding: 1rem;
}
pre {
  background: #f4f4f4;
  border-radius: 6px;
  padding: 0.5rem;
  font-size: 0.95em;
  margin: 0.5rem 0 0 0;
}
</style> 