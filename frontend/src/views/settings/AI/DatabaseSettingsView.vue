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
            <label for="dbName">Database</label>
            <input id="dbName" v-model="form.dbName" type="text" required />
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
          <div class="view-row"><span>Database:</span> <b>{{ form.dbName }}</b></div>
          <div class="view-row"><span>User:</span> <b>{{ form.dbUser }}</b></div>
          <div class="view-row"><span>Password:</span> <b>••••••••••••••••••••••••••••••••</b></div>
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
import { reactive, ref, onMounted } from 'vue';
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

const loadDbSettings = async () => {
  try {
    const res = await api.get('/api/settings/db-settings');
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

onMounted(async () => {
  await loadDbSettings();
  editMode.value = false;
});

const saveDbSettings = async () => {
  try {
    await api.put('/api/settings/db-settings', {
      db_host: form.dbHost,
      db_port: form.dbPort,
      db_name: form.dbName,
      db_user: form.dbUser,
      db_password: form.dbPassword || undefined
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
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  max-width: 600px;
  margin: 40px auto 0 auto;
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
</style> 