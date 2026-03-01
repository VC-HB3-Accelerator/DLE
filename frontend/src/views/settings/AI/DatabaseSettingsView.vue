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
    <div class="db-settings-block">
      <button class="close-btn" @click="goBack">×</button>
      <h2>База данных: интеграция и настройки</h2>
      <div class="db-settings settings-panel">
        <form v-if="editMode" @submit.prevent="saveDbSettings" class="settings-form">
          <div class="form-group">
            <label for="dbHost">Host</label>
            <input id="dbHost" v-model="form.dbHost" type="text" required />
          </div>
          <div class="form-group">
            <label for="dbPort">Port</label>
            <input id="dbPort" v-model.number="form.dbPort" type="number" required />
          </div>
          <div class="form-group">
            <label class="info-label">
              <i class="info-icon">ℹ️</i>
              Database name: <strong>{{ form.dbName }}</strong> (неизменяемо)
            </label>
          </div>
          <div class="form-group">
            <label for="dbUser">User</label>
            <input id="dbUser" v-model="form.dbUser" type="text" required />
          </div>
          <div class="form-group">
            <label for="dbPassword">Password</label>
            <input id="dbPassword" v-model="form.dbPassword" type="password" :placeholder="form.dbPassword ? 'Изменить пароль' : 'Введите пароль'" />
          </div>
          <button type="submit" class="save-btn">Сохранить</button>
          <button type="button" class="cancel-btn" @click="cancelEdit">Отмена</button>
        </form>
        <div v-else class="settings-view">
          <div class="view-row"><span>Host:</span> <b>{{ form.dbHost }}</b></div>
          <div class="view-row"><span>Port:</span> <b>{{ form.dbPort }}</b></div>
          <div class="view-row"><span>Database:</span> <b>{{ form.dbName }}</b> <span class="readonly-badge">(неизменяемо)</span></div>
          <div class="view-row"><span>User:</span> <b>{{ form.dbUser }}</b></div>
          <div class="view-row"><span>Password:</span> <b>••••••••••••••••••••••••••••••••</b></div>
          <div class="view-row encryption-key-row">
            <span>Ключ шифрования:</span> 
            <div class="encryption-key-inline">
              <div class="encryption-key-field">
                <span class="key-display">{{ displayKey }}</span>
                <button type="button" class="eye-btn" @click="toggleKeyVisibility" v-if="encryptionKeyState.exists">
                  {{ showKey ? '👁️' : '👁️‍🗨️' }}
                </button>
              </div>
              <span class="key-status" :class="keyStatusClass">
                {{ keyStatus }}
              </span>
              <button type="button" class="generate-key-btn" @click="generateNewEncryptionKey">
                {{ buttonText }}
              </button>
            </div>
          </div>
          <button type="button" class="edit-btn" @click="editMode = true">Изменить</button>
          <button type="button" class="cancel-btn" @click="goBack">Закрыть</button>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '@/components/BaseLayout.vue';
import { useRouter } from 'vue-router';
import { reactive, ref, onMounted, nextTick, computed, watch } from 'vue';
import api from '@/api/axios';

const router = useRouter();
const goBack = () => router.push('/settings/ai');

const form = reactive({
  dbHost: '',
  dbPort: 5432,
  dbName: '',
  dbUser: '',
  dbPassword: ''
});
const original = reactive({});
const editMode = ref(false);
const encryptionKeyState = reactive({ exists: false, key: null });
const showKey = ref(false);

// Computed свойство для отображения статуса ключа
const keyStatus = computed(() => {
  return encryptionKeyState.exists ? 'Настроен' : 'Не настроен';
});

const keyStatusClass = computed(() => {
  return encryptionKeyState.exists ? 'key-exists' : 'key-missing';
});

const buttonText = computed(() => {
  return encryptionKeyState.exists ? 'Сгенерировать новый' : 'Сгенерировать ключ';
});

const displayKey = computed(() => {
  if (!encryptionKeyState.exists) return 'Ключ не найден';
  if (!encryptionKeyState.key) return 'Ключ не загружен';
  return showKey.value ? encryptionKeyState.key : '••••••••••••••••••••••••••••••••';
});

const toggleKeyVisibility = () => {
  showKey.value = !showKey.value;
};

// Watch для отслеживания изменений состояния ключа
watch(() => encryptionKeyState.exists, (newValue, oldValue) => {
  console.log('encryptionKeyState.exists changed from', oldValue, 'to', newValue);
}, { immediate: true });

const loadDbSettings = async () => {
  try {
    const res = await api.get('/settings/db-settings');
    if (res.data.success) {
      const s = res.data.settings;
      form.dbHost = s.db_host;
      form.dbPort = s.db_port;
      form.dbName = s.db_name;
      form.dbUser = s.db_user;
      form.dbPassword = '';
      Object.assign(original, JSON.parse(JSON.stringify(form)));
    }
  } catch (e) {
    // обработка ошибки
  }
};

const checkEncryptionKey = async () => {
  try {
    // Сначала проверяем статус
    const statusRes = await api.get('/settings/encryption-key/status');
    console.log('Encryption key status response:', statusRes.data);
    encryptionKeyState.exists = statusRes.data.exists;
    console.log('encryptionKeyState.exists updated to:', encryptionKeyState.exists);
    
    // Если ключ существует, загружаем его содержимое
    if (encryptionKeyState.exists) {
      try {
        const keyRes = await api.get('/settings/encryption-key');
        console.log('Encryption key response:', keyRes.data);
        if (keyRes.data.success && keyRes.data.key) {
          encryptionKeyState.key = keyRes.data.key;
          console.log('encryptionKeyState.key loaded');
        } else {
          encryptionKeyState.key = null;
          console.log('Key not returned in response');
        }
      } catch (keyError) {
        console.error('Ошибка загрузки ключа шифрования:', keyError);
        encryptionKeyState.key = null;
      }
    } else {
      encryptionKeyState.key = null;
    }
    
    console.log('encryptionKeyState.exists type:', typeof encryptionKeyState.exists);
    console.log('encryptionKeyState.exists === true:', encryptionKeyState.exists === true);
    
    // Принудительно обновляем DOM
    await nextTick();
    console.log('DOM updated after nextTick');
  } catch (e) {
    console.error('Ошибка проверки ключа шифрования:', e);
    encryptionKeyState.exists = false;
    encryptionKeyState.key = null;
  }
};

const generateNewEncryptionKey = async () => {
  try {
    const confirmRotate = confirm('Сгенерировать новый ключ шифрования? Все зашифрованные данные будут безопасно перешифрованы новым ключом.');
    if (!confirmRotate) return;
    
    // Безопасная смена ключа (работает как для первой генерации, так и для смены)
    const res = await api.post('/settings/encryption-key/rotate');
    if (res.data.success) {
      alert(res.data.message);
      await checkEncryptionKey();
    } else {
      alert('Ошибка смены ключа шифрования');
    }
  } catch (e) {
    console.error('Ошибка генерации ключа шифрования:', e);
    alert('Ошибка генерации ключа шифрования');
  }
};

onMounted(async () => {
  await loadDbSettings();
  await checkEncryptionKey();
  editMode.value = false;
});

const saveDbSettings = async () => {
  try {
    // Отправляем только безопасные для изменения поля
    await api.put('/settings/db-settings', {
      db_host: form.dbHost,
      db_port: form.dbPort,
      db_user: form.dbUser,
      db_password: form.dbPassword || undefined
      // db_name не отправляем - он неизменяем
    });
    alert('Настройки базы данных сохранены');
    form.dbPassword = '';
    Object.assign(original, JSON.parse(JSON.stringify(form)));
    editMode.value = false;
  } catch (e) {
    alert('Ошибка сохранения настроек базы данных');
  }
};

const cancelEdit = () => {
  Object.assign(form, JSON.parse(JSON.stringify(original)));
  form.dbPassword = '';
  editMode.value = false;
};
</script>

<style scoped>
.db-settings-block {
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
.db-settings.settings-panel {
  background: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  margin-top: 0 !important;
  max-width: 100% !important;
  padding: 0 !important;
}
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.save-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.save-btn:hover {
  background: var(--color-primary-dark);
}
.cancel-btn {
  background: #eee;
  color: #333;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  margin-left: 1rem;
}
.settings-view {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.view-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1rem;
  background: #f8f8f8;
  border-radius: 4px;
  padding: 0.5rem 1rem;
}
.edit-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  align-self: flex-end;
  margin-top: 1.5rem;
  transition: background 0.2s;
}
.edit-btn:hover {
  background: var(--color-primary-dark);
}
.empty-placeholder {
  color: #888;
  font-size: 1em;
  margin: 0.7em 0;
}

.info-label {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 0.75rem;
  color: #495057;
  font-size: 0.95em;
}

.info-icon {
  margin-right: 0.5rem;
  color: #007bff;
}

.readonly-badge {
  background: #6c757d;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8em;
  margin-left: 0.5rem;
}

.encryption-key-row {
  align-items: center !important;
}

.encryption-key-inline {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.encryption-key-field {
  background: #f8f8f8;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-family: monospace;
  font-size: 0.9em;
  word-break: break-all;
  max-width: 300px;
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.key-display {
  color: #333;
  font-weight: 500;
  flex: 1;
}

.eye-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2em;
  padding: 0.2rem;
  border-radius: 3px;
  transition: background 0.2s;
}

.eye-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}

.key-status {
  padding: 0.3rem 0.8rem;
  border-radius: 4px;
  font-size: 0.9em;
  font-weight: 500;
}

.key-exists {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.key-missing {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.generate-key-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  font-size: 0.9em;
  transition: background 0.2s;
}

.generate-key-btn:hover {
  background: var(--color-primary-dark);
}
</style> 