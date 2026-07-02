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
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="vds-management-container">
      <div class="vds-header">
        <div class="status-badge" :class="{ online: isOnline }">
          <div class="status-indicator" :class="{ online: isOnline }"></div>
          <span>{{ isOnline ? t('common.online') : t('common.offline') }}</span>
        </div>
      </div>

      <!-- Настройки VDS -->
      <div class="settings-section">
        <div class="section-header">
          <h2>{{ t('vds.settings') }}</h2>
          <button v-if="isEditor" @click="toggleEditMode" class="action-btn edit-mode-btn">
            {{ isEditMode ? t('common.cancel') : t('common.edit') }}
          </button>
        </div>
        
        <div v-if="!isEditMode && settings" class="settings-display">
          <div v-if="!settings.domain && !settings.sshHost" class="empty-settings">
            <p>{{ t('vds.settingsNotSet') }}</p>
          </div>
          <div v-else class="settings-grid">
            <div class="setting-item">
              <label>{{ t('vds.domain') }}</label>
              <div class="setting-value">
                <a v-if="settings.domain" :href="`https://${settings.domain}`" target="_blank">
                  https://{{ settings.domain }}
                </a>
                <span v-else class="empty-value">{{ t('common.notSet') }}</span>
              </div>
            </div>
            <div class="setting-item">
              <label>{{ t('vds.emailSsl') }}</label>
              <div class="setting-value">{{ settings.email || t('common.notSet') }}</div>
            </div>
            <div class="setting-item">
              <label>{{ t('vds.sshHost') }}</label>
              <div class="setting-value">{{ settings.sshHost || t('common.notSet') }}</div>
            </div>
            <div class="setting-item">
              <label>{{ t('vds.sshPort') }}</label>
              <div class="setting-value">{{ settings.sshPort || t('common.notSet') }}</div>
            </div>
            <div class="setting-item">
              <label>{{ t('vds.sshUser') }}</label>
              <div class="setting-value">{{ settings.sshUser || t('common.notSet') }}</div>
            </div>
            <div class="setting-item">
              <label>{{ t('vds.ubuntuUser') }}</label>
              <div class="setting-value">{{ settings.ubuntuUser || t('common.notSet') }}</div>
            </div>
            <div class="setting-item">
              <label>{{ t('vds.dockerUser') }}</label>
              <div class="setting-value">{{ settings.dockerUser || t('common.notSet') }}</div>
            </div>
            <div class="setting-item">
              <label>{{ t('vds.composePath') }}</label>
              <div class="setting-value">{{ settings.dappPath || '/root/dapp' }}</div>
            </div>
          </div>
        </div>
        
        <div v-if="!isEditMode && !settings" class="empty-settings">
          <p>{{ t('vds.settingsNotSet') }}</p>
        </div>

        <div v-if="isEditMode" class="settings-form">
          <form @submit.prevent="saveSettings">
            <div class="form-section">
              <h3>{{ t('webssh.vdsSettings') }}</h3>
              <div class="form-group">
                <label for="domain">{{ t('webssh.domain') }}</label>
                <input 
                  id="domain" 
                  v-model="formSettings.domain" 
                  type="text" 
                  placeholder="example.com" 
                  required 
                />
                <small class="form-help">{{ t('vds.domainHelp') }}</small>
              </div>
              <div class="form-group">
                <label for="email">{{ t('webssh.emailSsl') }}</label>
                <input 
                  id="email" 
                  v-model="formSettings.email" 
                  type="email" 
                  placeholder="admin@example.com" 
                  required 
                />
                <small class="form-help">{{ t('vds.emailSslHelp') }}</small>
              </div>
              <div class="form-group">
                <label for="ubuntuUser">{{ t('webssh.ubuntuUser') }}</label>
                <input 
                  id="ubuntuUser" 
                  v-model="formSettings.ubuntuUser" 
                  type="text" 
                  placeholder="ubuntu" 
                  required 
                />
                <small class="form-help">{{ t('webssh.ubuntuUserHelp') }}</small>
              </div>
              <div class="form-group">
                <label for="dockerUser">{{ t('webssh.dockerUser') }}</label>
                <input 
                  id="dockerUser" 
                  v-model="formSettings.dockerUser" 
                  type="text" 
                  placeholder="docker" 
                  required 
                />
                <small class="form-help">{{ t('webssh.dockerUserHelp') }}</small>
              </div>
              <div class="form-group">
                <label for="dappPath">{{ t('vds.composePathLabel') }}</label>
                <input 
                  id="dappPath" 
                  v-model="formSettings.dappPath" 
                  type="text" 
                  placeholder="/home/docker/dapp" 
                  required 
                />
                <small class="form-help">{{ t('vds.composePathHelp') }}</small>
              </div>
            </div>

            <div class="form-section">
              <h3>{{ t('webssh.sshConnection') }}</h3>
              <div class="form-group">
                <label for="sshHost">{{ t('vds.sshHostLabel') }}</label>
                <input 
                  id="sshHost" 
                  v-model="formSettings.sshHost" 
                  type="text" 
                  placeholder="185.26.121.127" 
                  required 
                />
                <small class="form-help">{{ t('webssh.sshHostHelp') }}</small>
              </div>
              <div class="form-group">
                <label for="sshPort">{{ t('vds.sshPortLabel') }}</label>
                <input 
                  id="sshPort" 
                  v-model="formSettings.sshPort" 
                  type="number" 
                  placeholder="22" 
                  required 
                />
                <small class="form-help">{{ t('vds.sshPortHelp') }}</small>
              </div>
              <div class="form-group">
                <label for="sshUser">{{ t('vds.sshUserLabel') }}</label>
                <input 
                  id="sshUser" 
                  v-model="formSettings.sshUser" 
                  type="text" 
                  placeholder="root" 
                  required 
                />
                <small class="form-help">{{ t('webssh.sshUserHelp') }}</small>
              </div>
              <div class="form-group">
                <label for="sshPassword">{{ t('vds.sshPasswordLabel') }} <span v-if="!settings || !settings.sshHost">*</span></label>
                <input 
                  id="sshPassword" 
                  v-model="formSettings.sshPassword" 
                  type="password" 
                  :placeholder="settings?.sshHost ? t('vds.sshPasswordPlaceholderKeep') : '••••••••'" 
                  :required="!settings || !settings.sshHost"
                />
                <small class="form-help">
                  {{ settings?.sshHost 
                    ? t('vds.sshPasswordHelpKeep')
                    : t('vds.sshPasswordHelpRequired')
                  }}
                </small>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" :disabled="isSaving" class="save-btn">
                {{ isSaving ? t('common.saving') : t('common.save') }}
              </button>
              <button type="button" @click="cancelEdit" :disabled="isSaving" class="cancel-btn">
                {{ t('common.cancel') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Статистика -->
      <div class="stats-section">
        <h2>{{ t('vds.systemStats') }}</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <h3>CPU</h3>
            <div class="stat-value">{{ stats.cpu?.usage?.toFixed(1) || '--' }}%</div>
            <div class="stat-detail">{{ t('vds.cores', { count: stats.cpu?.cores || '--' }) }}</div>
          </div>
          <div class="stat-card">
            <h3>RAM</h3>
            <div class="stat-value">{{ stats.ram?.usage?.toFixed(1) || '--' }}%</div>
            <div class="stat-detail">{{ formatBytes((stats.ram?.used || 0) * 1024 * 1024) }} / {{ formatBytes((stats.ram?.total || 0) * 1024 * 1024) }}</div>
          </div>
          <div class="stat-card">
            <h3>{{ t('vds.traffic') }}</h3>
            <div class="stat-value">{{ formatBytes((stats.traffic?.total || 0) * 1024 * 1024) }}</div>
            <div class="stat-detail">RX: {{ formatBytes((stats.traffic?.rx || 0) * 1024 * 1024) }} / TX: {{ formatBytes((stats.traffic?.tx || 0) * 1024 * 1024) }}</div>
          </div>
        </div>
      </div>

      <!-- Графики -->
      <div class="charts-section">
        <h2>{{ t('vds.loadCharts') }}</h2>
        <div class="charts-grid">
          <div class="chart-card">
            <h3>{{ t('vds.cpuLoad') }}</h3>
            <div class="chart-container">
              <canvas ref="cpuChart"></canvas>
            </div>
          </div>
          <div class="chart-card">
            <h3>{{ t('vds.ramUsage') }}</h3>
            <div class="chart-container">
              <canvas ref="ramChart"></canvas>
            </div>
          </div>
          <div class="chart-card">
            <h3>{{ t('vds.trafficUsage') }}</h3>
            <div class="chart-container">
              <canvas ref="trafficChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Управление контейнерами -->
      <div class="containers-section">
        <div class="section-header">
          <h2>{{ t('vds.containerManagement') }}</h2>
          <div class="container-actions">
            <button v-if="isEditor" @click="restartAllContainers" :disabled="isLoading" class="action-btn restart-all">
              {{ t('vds.restartAll') }}
            </button>
            <button v-if="isEditor" @click="cleanupDocker" :disabled="isLoading" class="action-btn cleanup">
              {{ t('vds.cleanupDocker') }}
            </button>
            <button @click="loadContainers" :disabled="isLoading" class="action-btn refresh">
              {{ t('vds.refresh') }}
            </button>
          </div>
        </div>
        <div v-if="isLoading && containers.length === 0" class="loading">{{ t('common.loading') }}</div>
        <div v-else-if="containers.length === 0" class="empty">{{ t('vds.containersNotFound') }}</div>
        <div v-else class="containers-list">
          <div v-for="container in containers" :key="container.name" class="container-item">
            <div class="container-info">
              <div class="container-name">{{ container.name }}</div>
              <div class="container-status">{{ container.status }}</div>
              <div class="container-image">{{ container.image }}</div>
            </div>
            <div class="container-actions-item">
              <button v-if="isEditor" @click="startContainer(container.name)" :disabled="isLoading || container.status.includes('Up')" class="action-btn-small start" :title="t('vds.start')">
                ▶️
              </button>
              <button v-if="isEditor" @click="stopContainer(container.name)" :disabled="isLoading || !container.status.includes('Up')" class="action-btn-small stop" :title="t('vds.stop')">
                ⏹️
              </button>
              <button v-if="isEditor" @click="restartContainer(container.name)" :disabled="isLoading" class="action-btn-small restart" :title="t('vds.restart')">
                🔄
              </button>
              <button @click="viewContainerLogs(container.name)" :disabled="isLoading" class="action-btn-small logs" :title="t('vds.logs')">
                📋
              </button>
              <button v-if="isEditor" @click="rebuildContainer(container.name)" :disabled="isLoading" class="action-btn-small rebuild" :title="t('vds.rebuild')">
                🔨
              </button>
              <button v-if="isEditor" @click="deleteContainer(container.name)" :disabled="isLoading" class="action-btn-small delete" :title="t('common.delete')">
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Управление сервером -->
      <div class="server-section">
        <div class="section-header">
          <h2>{{ t('vds.serverManagement') }}</h2>
        </div>
        <div v-if="!isEditor" class="access-denied-message">
          <p>{{ t('vds.editorOnlyServer') }}</p>
        </div>
        <div v-else class="server-actions-grid">
          <button @click="rebootServer" :disabled="isLoading" class="action-btn server-btn reboot">
            {{ t('vds.rebootServer') }}
          </button>
          <button @click="shutdownServer" :disabled="isLoading" class="action-btn server-btn shutdown">
            {{ t('vds.shutdownServer') }}
          </button>
          <button @click="updateSystem" :disabled="isLoading" class="action-btn server-btn update">
            {{ t('vds.updateSystem') }}
          </button>
          <button @click="viewSystemLogs" :disabled="isLoading" class="action-btn server-btn logs">
            {{ t('vds.systemLogs') }}
          </button>
          <button @click="viewDiskInfo" :disabled="isLoading" class="action-btn server-btn disk">
            {{ t('vds.diskInfo') }}
          </button>
          <button @click="viewProcesses" :disabled="isLoading" class="action-btn server-btn processes">
            {{ t('vds.processes') }}
          </button>
        </div>
      </div>

      <!-- Управление пользователями -->
      <div class="users-section">
        <div class="section-header">
          <h2>{{ t('vds.userManagement') }}</h2>
          <button v-if="isEditor" @click="showCreateUserModal = true" class="action-btn create-user">
            {{ t('vds.createUser') }}
          </button>
        </div>
        <div v-if="!isEditor" class="access-denied-message">
          <p>{{ t('vds.editorOnlyUsers') }}</p>
        </div>
        <template v-if="isEditor">
          <div v-if="isLoading && users.length === 0" class="loading">{{ t('common.loading') }}</div>
          <div v-else-if="users.length === 0" class="empty">{{ t('vds.usersNotFound') }}</div>
          <div v-else class="users-list">
            <div v-for="user in users" :key="user.username" class="user-item">
              <div class="user-info">
                <div class="user-name">{{ user.username }}</div>
                <div class="user-details">UID: {{ user.uid }} | Shell: {{ user.shell }}</div>
              </div>
              <div class="user-actions">
                <button @click="viewUserSshKeys(user.username)" :disabled="isLoading" class="action-btn-small ssh-keys" :title="t('vds.sshKeys')">
                  🔑
                </button>
                <button @click="changeUserPassword(user.username)" :disabled="isLoading" class="action-btn-small password" :title="t('vds.changePassword')">
                  🔒
                </button>
                <button @click="deleteUser(user.username)" :disabled="isLoading" class="action-btn-small delete" :title="t('common.delete')">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Бэкапы -->
      <div class="backup-section">
        <div class="section-header">
          <h2>{{ t('vds.backups') }}</h2>
        </div>
        <div v-if="!isEditor" class="access-denied-message">
          <p>{{ t('vds.editorOnlyBackups') }}</p>
        </div>
        <div v-else class="backup-actions-grid">
          <button @click="createBackup" :disabled="isLoading" class="action-btn backup-btn create">
            {{ t('vds.createDbBackup') }}
          </button>
          <button @click="showSendBackupModal = true" :disabled="isLoading" class="action-btn backup-btn send">
            {{ t('vds.sendBackupLocal') }}
          </button>
        </div>
      </div>

      <!-- SSL сертификаты -->
      <div class="ssl-section">
        <div class="section-header">
          <h2>{{ t('vds.sslCert') }}</h2>
          <div v-if="isDevelopment" style="font-size: 12px; color: #666; margin-top: 5px;">
            {{ t('vds.debugStatus', { isEditor, role: currentRole, loading: isLoadingSsl }) }}
          </div>
        </div>

        <div v-if="!isEditor" class="access-denied-message">
          <p>{{ t('vds.editorOnlySsl') }}</p>
          <p v-if="isDevelopment" style="font-size: 12px; color: #666;">
            {{ t('vds.currentRole', { role: currentRole }) }}
          </p>
        </div>

        <div v-else>
          <div class="ssl-status">
            <div v-if="isLoadingSsl">
              {{ t('vds.loadingSsl') }}
            </div>
              <div v-else>
              <div v-if="sslStatus && sslStatus.success && sslStatus.allCertificates && sslStatus.allCertificates.length">
                <div class="ssl-info">
                  <div
                    v-for="cert in sslStatus.allCertificates"
                    :key="cert.name"
                    class="ssl-info-item"
                  >
                    <label>{{ cert.name || t('vds.noName') }}</label>
                    <span :class="{ 'expiring-soon': isCertExpiringSoon(cert.expiryDate) }">
                      {{ cert.expiryDate ? formatDate(cert.expiryDate) : t('vds.noData') }}
                    </span>
                    <div v-if="cert.domains && cert.domains.length" class="ssl-domains">
                      {{ t('vds.domains', { list: cert.domains.join(', ') }) }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="ssl-no-cert">
                <p>{{ t('vds.sslNotFound') }}</p>
                <p v-if="sslStatus && sslStatus.domain" class="ssl-domain-info">
                  {{ t('vds.domainLabel', { domain: sslStatus.domain }) }}
                </p>
                <p v-if="sslStatus && !sslStatus.success" class="ssl-error-info">
                  {{ t('vds.errorLabel', { error: sslStatus.error || t('common.unknownError') }) }}
                </p>
              </div>
            </div>
          </div>

          <div class="ssl-actions-grid">
            <button
              class="action-btn ssl-btn status"
              :disabled="isLoadingSsl || isLoading"
              @click="checkSslStatus"
            >
              {{ t('vds.checkSsl') }}
            </button>
            <button
              v-if="isEditor"
              class="action-btn ssl-btn renew"
              :disabled="isLoading"
              @click="renewSslCertificate"
              :title="isLoading ? t('vds.inProgress') : t('vds.renewSsl')"
            >
              {{ t('vds.renewSslBtn') }}
            </button>
            <div v-if="!isEditor && isDevelopment" style="font-size: 12px; color: #f00; margin-top: 5px;">
              {{ t('vds.debugHiddenBtn', { role: currentRole }) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Модальные окна -->
      <!-- Модальное окно создания пользователя -->
      <div v-if="showCreateUserModal && isEditor" class="modal-overlay" @click="showCreateUserModal = false">
        <div class="modal-content" @click.stop>
          <h3>{{ t('vds.createUserTitle') }}</h3>
          <form @submit.prevent="createUser">
            <div class="form-group">
              <label>{{ t('vds.username') }}</label>
              <input v-model="newUser.username" type="text" required />
            </div>
            <div class="form-group">
              <label>{{ t('vds.password') }}</label>
              <input v-model="newUser.password" type="password" required />
            </div>
            <div class="form-group">
              <label>
                <input v-model="newUser.addToDocker" type="checkbox" />
                {{ t('vds.addToDockerGroup') }}
              </label>
            </div>
            <div class="form-actions">
              <button type="submit" :disabled="isLoading" class="save-btn">{{ t('common.create') }}</button>
              <button type="button" @click="showCreateUserModal = false" class="cancel-btn">{{ t('common.cancel') }}</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Модальное окно отправки бэкапа -->
      <div v-if="showSendBackupModal && isEditor" class="modal-overlay" @click="showSendBackupModal = false">
        <div class="modal-content" @click.stop>
          <h3>{{ t('vds.sendBackupTitle') }}</h3>
          <form @submit.prevent="sendBackup">
            <div class="form-group">
              <label>{{ t('vds.backupFile') }}</label>
              <input v-model="backupForm.file" type="text" placeholder="/tmp/backup-xxx.sql" required />
            </div>
            <div class="form-group">
              <label>{{ t('vds.localHost') }}</label>
              <input v-model="backupForm.localHost" type="text" placeholder="192.168.1.100" required />
            </div>
            <div class="form-group">
              <label>{{ t('vds.localUser') }}</label>
              <input v-model="backupForm.localUser" type="text" placeholder="user" required />
            </div>
            <div class="form-group">
              <label>{{ t('vds.localPath') }}</label>
              <input v-model="backupForm.localPath" type="text" placeholder="/home/user/backups" required />
            </div>
            <div class="form-group">
              <label>{{ t('vds.sshKeyPath') }}</label>
              <input v-model="backupForm.sshKeyPath" type="text" placeholder="/root/.ssh/id_rsa" />
            </div>
            <div class="form-actions">
              <button type="submit" :disabled="isLoading" class="save-btn">{{ t('common.send') }}</button>
              <button type="button" @click="showSendBackupModal = false" class="cancel-btn">{{ t('common.cancel') }}</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Модальное окно просмотра логов -->
      <div v-if="showLogsModal" class="modal-overlay" @click="showLogsModal = false">
        <div class="modal-content logs-modal" @click.stop>
          <h3>{{ logsTitle }}</h3>
          <div class="logs-content">
            <pre>{{ logsContent }}</pre>
          </div>
          <div class="form-actions">
            <button @click="showLogsModal = false" class="cancel-btn">{{ t('common.close') }}</button>
          </div>
        </div>
      </div>

    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../components/BaseLayout.vue';
import axios from 'axios';
import Chart from 'chart.js/auto';
import { usePermissions } from '../composables/usePermissions';
import { ROLES } from '../composables/permissions';
import { errorMessageMatches } from '../utils/i18nErrorMatch';

const { t, locale } = useI18n();

const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

const emit = defineEmits(['auth-action-completed']);

const router = useRouter();

// Проверка прав доступа
const { currentRole, canManageSettings } = usePermissions();
const isEditor = computed(() => currentRole.value === ROLES.EDITOR);

// Отладочная информация (только для разработки)
const isDevelopment = computed(() => import.meta.env.DEV || import.meta.env.MODE === 'development');

// Состояние
const domain = ref(null);
const isOnline = ref(false);
const stats = ref({ cpu: {}, ram: {}, traffic: {} });
const containers = ref([]);
const isLoading = ref(false);
const settings = ref(null);
const isEditMode = ref(false);
const isSaving = ref(false);
const users = ref([]);
const showCreateUserModal = ref(false);
const showSendBackupModal = ref(false);
const showLogsModal = ref(false);
const logsTitle = ref('');
const logsContent = ref('');
const sslStatus = ref(null);
const isLoadingSsl = ref(false);

const newUser = reactive({
  username: '',
  password: '',
  addToDocker: false
});

const backupForm = reactive({
  file: '',
  localHost: '',
  localUser: '',
  localPath: '',
  sshKeyPath: ''
});

// Форма настроек
const formSettings = reactive({
  domain: '',
  email: '',
  ubuntuUser: 'ubuntu',
  dockerUser: 'docker',
  dappPath: '/home/docker/dapp',
  sshHost: '',
  sshPort: 22,
  sshUser: 'root',
  sshPassword: ''
});

// Графики
const cpuChart = ref(null);
const ramChart = ref(null);
const trafficChart = ref(null);
let cpuChartInstance = null;
let ramChartInstance = null;
let trafficChartInstance = null;

// Данные для графиков
const chartData = {
  cpu: { labels: [], data: [] },
  ram: { labels: [], data: [] },
  traffic: { labels: [], data: [] }
};

let statsInterval = null;

// Загрузка настроек
const loadSettings = async () => {
  try {
    // axios.defaults.baseURL = '/api', поэтому используем относительный путь
    const response = await axios.get('/vds/settings');
    if (response.data.success) {
      if (response.data.settings) {
        settings.value = response.data.settings;
        domain.value = response.data.settings.domain;
        isOnline.value = !!response.data.settings.domain;
        
        // Заполняем форму текущими значениями
        Object.assign(formSettings, {
          domain: response.data.settings.domain || '',
          email: response.data.settings.email || '',
          ubuntuUser: response.data.settings.ubuntuUser || 'ubuntu',
          dockerUser: response.data.settings.dockerUser || 'docker',
          dappPath: response.data.settings.dappPath || `/home/${response.data.settings.dockerUser || 'docker'}/dapp`,
          sshHost: response.data.settings.sshHost || '',
          sshPort: response.data.settings.sshPort || 22,
          sshUser: response.data.settings.sshUser || 'root',
          sshPassword: '' // Пароль не возвращается из API по соображениям безопасности
        });
      } else if (response.data.domain) {
        // Обратная совместимость - если пришел только домен
        domain.value = response.data.domain;
        isOnline.value = true;
        settings.value = { domain: response.data.domain };
        // Заполняем форму только доменом
        formSettings.domain = response.data.domain;
      } else {
        // Настройки не заданы
        settings.value = {};
        // Автоматически открываем форму редактирования, если настройки не заданы и пользователь - редактор
        if (isEditor.value && (!settings.value || (!settings.value.domain && !settings.value.sshHost))) {
          isEditMode.value = true;
        }
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки настроек:', error);
  }
};

// Переключение режима редактирования
const toggleEditMode = () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyEdit'));
    return;
  }
  if (isEditMode.value) {
    // Отменяем - загружаем настройки заново
    loadSettings();
  }
  isEditMode.value = !isEditMode.value;
};

// Отмена редактирования
const cancelEdit = () => {
  loadSettings();
  isEditMode.value = false;
};

// Сохранение настроек
const saveSettings = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlySave'));
    return;
  }
  if (!formSettings.domain || !formSettings.email || !formSettings.sshHost || 
      !formSettings.sshPort || !formSettings.sshUser) {
    alert(t('vds.alerts.fillRequired'));
    return;
  }
  
  if (!settings.value || (!settings.value.sshHost && !formSettings.sshPassword)) {
    if (!formSettings.sshPassword) {
      alert(t('vds.alerts.sshPasswordRequired'));
      return;
    }
  }
  
  isSaving.value = true;
  try {
    // axios.defaults.baseURL = '/api', поэтому используем относительный путь
    const response = await axios.post('/vds/settings', {
      domain: formSettings.domain,
      email: formSettings.email,
      ubuntuUser: formSettings.ubuntuUser,
      dockerUser: formSettings.dockerUser,
      dappPath: formSettings.dappPath || '/root/dapp',
      sshHost: formSettings.sshHost,
      sshPort: formSettings.sshPort,
      sshUser: formSettings.sshUser,
      sshPassword: formSettings.sshPassword || undefined // Отправляем только если указан
    });
    
    if (response.data.success) {
      await loadSettings();
      isEditMode.value = false;
      // Очищаем пароль из формы после сохранения (безопасность)
      formSettings.sshPassword = '';
      alert(t('vds.alerts.settingsSaved'));
    }
  } catch (error) {
    console.error('Ошибка сохранения настроек:', error);
    alert(error.response?.data?.error || t('vds.alerts.settingsSaveError'));
  } finally {
    isSaving.value = false;
  }
};

// Загрузка статистики
const loadStats = async () => {
  try {
    const response = await axios.get('/vds/stats');
    if (response.data.success) {
      stats.value = response.data.stats;
      updateCharts();
    }
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
  }
};

// Загрузка контейнеров
const loadContainers = async () => {
  isLoading.value = true;
  try {
    // axios.defaults.baseURL = '/api', поэтому используем относительный путь
    const response = await axios.get('/vds/containers');
    if (response.data.success) {
      containers.value = response.data.containers || [];
    } else {
      containers.value = [];
    }
  } catch (error) {
    console.error('Ошибка загрузки контейнеров:', error);
    const errorMessage = error.response?.data?.error || error.message || t('common.unknownError');
    alert(t('vds.alerts.containersLoadError', { error: errorMessage }));
    containers.value = [];
  } finally {
    isLoading.value = false;
  }
};

// Перезапуск контейнера
const restartContainer = async (name) => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyContainers'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmRestartContainer', { name }))) return;
  isLoading.value = true;
  try {
    const response = await axios.post(`/vds/containers/${name}/restart`);
    if (response.data.success) {
      alert(t('vds.alerts.containerRestarted', { name }));
      await loadContainers();
    }
  } catch (error) {
    console.error('Ошибка перезапуска контейнера:', error);
    alert(t('vds.alerts.restartContainerError'));
  } finally {
    isLoading.value = false;
  }
};

// Перезапуск всех контейнеров
const restartAllContainers = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyContainers'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmRestartAll'))) return;
  isLoading.value = true;
  try {
    const response = await axios.post('/vds/containers/restart-all');
    if (response.data.success) {
      alert(t('vds.alerts.containersRestarted', { count: response.data.restarted }));
      await loadContainers();
    }
  } catch (error) {
    console.error('Ошибка перезапуска контейнеров:', error);
    alert(t('vds.alerts.restartAllError'));
  } finally {
    isLoading.value = false;
  }
};

// Запуск контейнера
const startContainer = async (name) => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyContainers'));
    return;
  }
  isLoading.value = true;
  try {
    const response = await axios.post(`/vds/containers/${name}/start`);
    if (response.data.success) {
      alert(t('vds.alerts.containerStarted', { name }));
      await loadContainers();
    }
  } catch (error) {
    console.error('Ошибка запуска контейнера:', error);
    alert(error.response?.data?.error || t('vds.alerts.startContainerError'));
  } finally {
    isLoading.value = false;
  }
};

// Остановка контейнера
const stopContainer = async (name) => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyContainers'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmStopContainer', { name }))) return;
  isLoading.value = true;
  try {
    const response = await axios.post(`/vds/containers/${name}/stop`);
    if (response.data.success) {
      alert(t('vds.alerts.containerStopped', { name }));
      await loadContainers();
    }
  } catch (error) {
    console.error('Ошибка остановки контейнера:', error);
    alert(error.response?.data?.error || t('vds.alerts.stopContainerError'));
  } finally {
    isLoading.value = false;
  }
};

// Просмотр логов контейнера
const viewContainerLogs = async (name) => {
  isLoading.value = true;
  try {
    const response = await axios.get(`/vds/containers/${name}/logs?tail=200`);
    if (response.data.success) {
      logsTitle.value = t('vds.containerLogsTitle', { name });
      logsContent.value = response.data.logs;
      showLogsModal.value = true;
    }
  } catch (error) {
    console.error('Ошибка получения логов:', error);
    alert(error.response?.data?.error || t('vds.alerts.logsError'));
  } finally {
    isLoading.value = false;
  }
};

// Удаление контейнера
const deleteContainer = async (name) => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyContainers'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmDeleteContainer', { name }))) return;
  isLoading.value = true;
  try {
    const response = await axios.delete(`/vds/containers/${name}`);
    if (response.data.success) {
      alert(t('vds.alerts.containerDeleted', { name }));
      await loadContainers();
    }
  } catch (error) {
    console.error('Ошибка удаления контейнера:', error);
    alert(error.response?.data?.error || t('vds.alerts.deleteContainerError'));
  } finally {
    isLoading.value = false;
  }
};

// Очистка Docker
const cleanupDocker = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyDockerCleanup'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmCleanupDocker'))) return;
  isLoading.value = true;
  try {
    const response = await axios.post('/vds/docker/cleanup', { type: 'all' });
    if (response.data.success) {
      alert(t('vds.alerts.dockerCleaned'));
      await loadContainers();
    }
  } catch (error) {
    console.error('Ошибка очистки Docker:', error);
    alert(error.response?.data?.error || t('vds.alerts.cleanupError'));
  } finally {
    isLoading.value = false;
  }
};

// Пересборка контейнера
const rebuildContainer = async (name) => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyRebuild'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmRebuildContainer', { name }))) return;
  isLoading.value = true;
  try {
    const response = await axios.post(`/vds/containers/${name}/rebuild`);
    if (response.data.success) {
      alert(t('vds.alerts.containerRebuilt', { name }));
      await loadContainers();
    }
  } catch (error) {
    console.error('Ошибка пересборки контейнера:', error);
    alert(error.response?.data?.error || t('vds.alerts.rebuildError'));
  } finally {
    isLoading.value = false;
  }
};

// Управление сервером
const rebootServer = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyServer'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmReboot'))) return;
  isLoading.value = true;
  try {
    const response = await axios.post('/vds/server/reboot');
    if (response.data.success) {
      alert(t('vds.alerts.serverRebootScheduled'));
    }
  } catch (error) {
    console.error('Ошибка перезагрузки сервера:', error);
    alert(error.response?.data?.error || t('vds.alerts.rebootError'));
    isLoading.value = false;
  }
};

const shutdownServer = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyServer'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmShutdown'))) return;
  isLoading.value = true;
  try {
    const response = await axios.post('/vds/server/shutdown');
    if (response.data.success) {
      alert(t('vds.alerts.serverShutdownScheduled'));
    }
  } catch (error) {
    console.error('Ошибка выключения сервера:', error);
    alert(error.response?.data?.error || t('vds.alerts.shutdownError'));
    isLoading.value = false;
  }
};

const updateSystem = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyUpdateSystem'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmUpdateSystem'))) return;
  isLoading.value = true;
  try {
    const response = await axios.post('/vds/server/update');
    if (response.data.success) {
      alert(t('vds.alerts.systemUpdated'));
    }
  } catch (error) {
    console.error('Ошибка обновления системы:', error);
    alert(error.response?.data?.error || t('vds.alerts.updateSystemError'));
  } finally {
    isLoading.value = false;
  }
};

const viewSystemLogs = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyViewSystemLogs'));
    return;
  }
  isLoading.value = true;
  try {
    const response = await axios.get('/vds/server/logs?type=syslog&lines=200');
    if (response.data.success) {
      logsTitle.value = t('vds.systemLogs');
      logsContent.value = response.data.logs;
      showLogsModal.value = true;
    }
  } catch (error) {
    console.error('Ошибка получения системных логов:', error);
    alert(error.response?.data?.error || t('vds.alerts.systemLogsError'));
  } finally {
    isLoading.value = false;
  }
};

const viewDiskInfo = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyViewDisk'));
    return;
  }
  isLoading.value = true;
  try {
    const response = await axios.get('/vds/server/disk');
    if (response.data.success) {
      logsTitle.value = t('vds.diskInfo');
      logsContent.value = t('vds.diskInfoContent', {
        df: response.data.disk.df,
        du: response.data.disk.du
      });
      showLogsModal.value = true;
    }
  } catch (error) {
    console.error('Ошибка получения информации о диске:', error);
    alert(error.response?.data?.error || t('vds.alerts.diskInfoError'));
  } finally {
    isLoading.value = false;
  }
};

const viewProcesses = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyViewProcesses'));
    return;
  }
  isLoading.value = true;
  try {
    const response = await axios.get('/vds/server/processes');
    if (response.data.success) {
      logsTitle.value = t('vds.processesTitle');
      logsContent.value = response.data.processes;
      showLogsModal.value = true;
    }
  } catch (error) {
    console.error('Ошибка получения списка процессов:', error);
    alert(error.response?.data?.error || t('vds.alerts.processesError'));
  } finally {
    isLoading.value = false;
  }
};

// Управление пользователями
const loadUsers = async () => {
  isLoading.value = true;
  try {
    // axios.defaults.baseURL = '/api', поэтому используем относительный путь
    const response = await axios.get('/vds/users');
    if (response.data.success) {
      users.value = response.data.users;
    } else {
      users.value = [];
    }
  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error);
    const errorMessage = error.response?.data?.error || error.message || t('common.unknownError');
    alert(t('vds.alerts.usersLoadError', { error: errorMessage }));
    users.value = [];
  } finally {
    isLoading.value = false;
  }
};

const createUser = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyCreateUsers'));
    return;
  }
  isLoading.value = true;
  try {
    const response = await axios.post('/vds/users/create', newUser);
    if (response.data.success) {
      alert(t('vds.alerts.userCreated', { name: newUser.username }));
      showCreateUserModal.value = false;
      newUser.username = '';
      newUser.password = '';
      newUser.addToDocker = false;
      await loadUsers();
    }
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    alert(error.response?.data?.error || t('vds.alerts.createUserError'));
  } finally {
    isLoading.value = false;
  }
};

const deleteUser = async (username) => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyUsers'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmDeleteUserIrreversible', { name: username }))) return;
  isLoading.value = true;
  try {
    const response = await axios.delete(`/vds/users/${username}`);
    if (response.data.success) {
      alert(t('vds.alerts.userDeleted', { name: username }));
      await loadUsers();
    }
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    alert(error.response?.data?.error || t('vds.alerts.deleteUserError'));
  } finally {
    isLoading.value = false;
  }
};

const changeUserPassword = async (username) => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyChangePassword'));
    return;
  }
  const password = prompt(t('vds.alerts.newPasswordPrompt', { name: username }));
  if (!password) return;
  
  isLoading.value = true;
  try {
    const response = await axios.post(`/vds/users/${username}/password`, { password });
    if (response.data.success) {
      alert(t('vds.alerts.passwordChangedUser', { name: username }));
    }
  } catch (error) {
    console.error('Ошибка изменения пароля:', error);
    alert(error.response?.data?.error || t('vds.alerts.changePasswordError'));
  } finally {
    isLoading.value = false;
  }
};

const viewUserSshKeys = async (username) => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyViewSshKeys'));
    return;
  }
  isLoading.value = true;
  try {
    const response = await axios.get(`/vds/users/${username}/ssh-keys`);
    if (response.data.success) {
      logsTitle.value = t('vds.sshKeysTitle', { name: username });
      logsContent.value = response.data.keys.length > 0 
        ? response.data.keys.map((k, i) => `${i + 1}. ${k.key}`).join('\n\n')
        : t('vds.sshKeysNotFound');
      showLogsModal.value = true;
    }
  } catch (error) {
    console.error('Ошибка получения SSH ключей:', error);
    alert(error.response?.data?.error || t('vds.alerts.sshKeysError'));
  } finally {
    isLoading.value = false;
  }
};

// Бэкапы
const createBackup = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyBackups'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmCreateBackup'))) return;
  isLoading.value = true;
  try {
    const response = await axios.post('/vds/backup/create');
    if (response.data.success) {
      alert(t('vds.alerts.backupCreated', { file: response.data.file }));
      backupForm.file = response.data.file;
    }
  } catch (error) {
    console.error('Ошибка создания бэкапа:', error);
    alert(error.response?.data?.error || t('vds.alerts.backupError'));
  } finally {
    isLoading.value = false;
  }
};

const sendBackup = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyBackups'));
    return;
  }
  isLoading.value = true;
  try {
    const response = await axios.post('/vds/backup/send', backupForm);
    if (response.data.success) {
      alert(t('vds.alerts.backupSentLocal'));
      showSendBackupModal.value = false;
      backupForm.file = '';
      backupForm.localHost = '';
      backupForm.localUser = '';
      backupForm.localPath = '';
      backupForm.sshKeyPath = '';
    }
  } catch (error) {
    console.error('Ошибка отправки бэкапа:', error);
    alert(error.response?.data?.error || t('vds.alerts.sendBackupError'));
  } finally {
    isLoading.value = false;
  }
};

// SSL Сертификаты
const loadSslStatus = async () => {
  if (!isEditor.value) {
    return;
  }
  isLoadingSsl.value = true;
  try {
    const response = await axios.get('/vds/ssl/status');
    if (response.data.success) {
      sslStatus.value = response.data;
    } else {
      sslStatus.value = null;
    }
  } catch (error) {
    console.error('Ошибка получения статуса SSL:', error);
    const errorMessage = error.response?.data?.error || error.message || t('common.unknownError');
    
    if (errorMessageMatches(errorMessage, 'vds.errors.notConfigured') || error.response?.status === 400) {
      sslStatus.value = null;
      return;
    }
    
    if (error.response?.status === 401 || errorMessageMatches(errorMessage, 'vds.alerts.authRequired') || errorMessageMatches(errorMessage, 'vds.errors.authKeyword')) {
      sslStatus.value = null;
      return;
    }
    
    sslStatus.value = null;
  } finally {
    isLoadingSsl.value = false;
  }
};

// Ручная проверка статуса (с показом ошибок пользователю)
const checkSslStatus = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyCheckSsl'));
    return;
  }
  isLoadingSsl.value = true;
  try {
    const response = await axios.get('/vds/ssl/status');
    if (response.data.success) {
      sslStatus.value = response.data;
      if (!response.data.allCertificates || response.data.allCertificates.length === 0) {
        alert(t('vds.sslNotFound'));
      }
    } else {
      alert(t('vds.alerts.sslStatusError', { error: response.data.error || t('common.unknownError') }));
    }
  } catch (error) {
    console.error('Ошибка получения статуса SSL:', error);
    const errorMessage = error.response?.data?.error || error.message || t('common.unknownError');
    
    if (error.response?.status === 401 || errorMessageMatches(errorMessage, 'vds.alerts.authRequired') || errorMessageMatches(errorMessage, 'vds.errors.authKeyword')) {
      alert(t('vds.alerts.authRequired'));
      return;
    }
    
    alert(t('vds.alerts.sslStatusError', { error: errorMessage }));
  } finally {
    isLoadingSsl.value = false;
  }
};

const renewSslCertificate = async () => {
  if (!isEditor.value) {
    alert(t('vds.alerts.editorOnlyRenewSsl'));
    return;
  }
  if (!confirm(t('vds.alerts.confirmRenewSsl'))) {
    return;
  }
  isLoading.value = true;
  try {
    const response = await axios.post('/vds/ssl/renew', {
      sslProvider: 'letsencrypt'
    });
    if (response.data.success) {
      alert(t('vds.alerts.sslRenewed'));
      await loadSslStatus();
    } else {
      console.error('[VDS] Ошибка получения SSL сертификата:', response.data);
      alert(t('vds.alerts.sslStatusError', { error: response.data.error || t('common.unknownError') }));
    }
  } catch (error) {
    console.error('Ошибка получения SSL сертификата:', error);
    const errorMessage = error.response?.data?.error || error.message || t('common.unknownError');
    const errorDetails = error.response?.data?.details || '';
    
    if (error.response?.status === 401 || errorMessageMatches(errorMessage, 'vds.alerts.authRequired') || errorMessageMatches(errorMessage, 'vds.errors.authKeyword')) {
      alert(t('vds.alerts.authRequiredRefresh'));
      router.push({ name: 'home' });
      return;
    }
    
    if (error.response?.status === 429 || error.response?.data?.rateLimit || errorMessage.includes('too many certificates') || errorMessage.includes('rate limit') || errorDetails.includes('too many certificates')) {
      alert(t('vds.alerts.sslRateLimit'));
      return;
    }
    
    alert(t('vds.alerts.sslStatusError', { error: errorMessage }));
  } finally {
    isLoading.value = false;
  }
};

const isCertExpiringSoon = (expiryDate) => {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysUntilExpiry = (expiry - now) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry < 30; // Истекает в течение 30 дней
};

const formatDate = (dateString) => {
  if (!dateString) return t('common.notSpecified');
  try {
    const date = new Date(dateString);
    const localeCode = locale.value === 'ru' ? 'ru-RU' : 'en-US';
    return date.toLocaleString(localeCode, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return dateString;
  }
};

// Форматирование байтов
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Инициализация графиков
const initCharts = async () => {
  await nextTick();
  
  if (cpuChart.value) {
    cpuChartInstance = new Chart(cpuChart.value, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'CPU %',
          data: [],
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  }
  
  if (ramChart.value) {
    ramChartInstance = new Chart(ramChart.value, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'RAM %',
          data: [],
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  }
  
  if (trafficChart.value) {
    trafficChartInstance = new Chart(trafficChart.value, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: t('vds.chartTrafficMb'),
          data: [],
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
};

// Обновление графиков
const updateCharts = () => {
  const now = new Date().toLocaleTimeString();
  
  // CPU
  if (cpuChartInstance && stats.value.cpu?.usage !== undefined && stats.value.cpu?.usage !== null) {
    const cpuValue = parseFloat(stats.value.cpu.usage) || 0;
    chartData.cpu.labels.push(now);
    chartData.cpu.data.push(cpuValue);
    if (chartData.cpu.labels.length > 20) {
      chartData.cpu.labels.shift();
      chartData.cpu.data.shift();
    }
    cpuChartInstance.data.labels = chartData.cpu.labels;
    cpuChartInstance.data.datasets[0].data = chartData.cpu.data;
    cpuChartInstance.update('none');
  }
  
  // RAM
  if (ramChartInstance && stats.value.ram?.usage !== undefined && stats.value.ram?.usage !== null) {
    const ramValue = parseFloat(stats.value.ram.usage) || 0;
    chartData.ram.labels.push(now);
    chartData.ram.data.push(ramValue);
    if (chartData.ram.labels.length > 20) {
      chartData.ram.labels.shift();
      chartData.ram.data.shift();
    }
    ramChartInstance.data.labels = chartData.ram.labels;
    ramChartInstance.data.datasets[0].data = chartData.ram.data;
    ramChartInstance.update('none');
  }
  
  // Traffic (в MB)
  if (trafficChartInstance && stats.value.traffic?.total !== undefined && stats.value.traffic?.total !== null) {
    const trafficValue = parseFloat(stats.value.traffic.total) || 0;
    chartData.traffic.labels.push(now);
    chartData.traffic.data.push(trafficValue);
    if (chartData.traffic.labels.length > 20) {
      chartData.traffic.labels.shift();
      chartData.traffic.data.shift();
    }
    trafficChartInstance.data.labels = chartData.traffic.labels;
    trafficChartInstance.data.datasets[0].data = chartData.traffic.data;
    trafficChartInstance.update('none');
  }
};

// Жизненный цикл
onMounted(async () => {
  await loadSettings();
  await loadContainers();
  await initCharts();
  await loadStats();
  
  if (isEditor.value) {
    await loadUsers();
    await loadSslStatus();
  }
  
  statsInterval = setInterval(loadStats, 5000);
});

onUnmounted(() => {
  if (statsInterval) {
    clearInterval(statsInterval);
  }
  if (cpuChartInstance) cpuChartInstance.destroy();
  if (ramChartInstance) ramChartInstance.destroy();
  if (trafficChartInstance) trafficChartInstance.destroy();
});
</script>

<style scoped>
.vds-management-container {
  padding: var(--block-padding, 20px);
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md, 0 2px 10px rgba(0, 0, 0, 0.1));
  margin-top: 20px;
  margin-bottom: 20px;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.vds-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.vds-header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-primary);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  background: #f8d7da;
  color: #721c24;
}

.status-badge.online {
  background: #d4edda;
  color: #155724;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc3545;
}

.status-indicator.online {
  background: #28a745;
}

.settings-section {
  margin-bottom: 30px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.settings-display {
  margin-top: 20px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.setting-item {
  padding: 16px;
  background: #f8f9fa;
  border-radius: var(--radius-sm, 8px);
  border: 1px solid #e9ecef;
}

.setting-item label {
  display: block;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.setting-value {
  color: var(--color-dark, #333);
  font-size: 1rem;
}

.setting-value a {
  color: var(--color-primary);
  text-decoration: none;
}

.setting-value a:hover {
  text-decoration: underline;
}

.empty-value {
  color: var(--color-grey-dark, #999);
  font-style: italic;
}

.empty-settings {
  text-align: center;
  padding: 40px;
  color: var(--color-grey-dark, #666);
  font-size: 1.1rem;
  background: #f8f9fa;
  border-radius: var(--radius-sm, 8px);
  border: 1px dashed #e9ecef;
}

.settings-form {
  margin-top: 20px;
}

.form-section {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e9ecef;
}

.form-section:last-of-type {
  border-bottom: none;
}

.form-section h3 {
  color: var(--color-primary);
  margin: 0 0 20px 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--color-dark, #333);
  font-size: 0.95rem;
}

.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #e9ecef;
  border-radius: var(--radius-sm, 8px);
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: white;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-help {
  display: block;
  margin-top: 6px;
  font-size: 0.85rem;
  color: var(--color-grey-dark, #666);
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.save-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.2s;
}

.save-btn:hover:not(:disabled) {
  background: var(--color-primary-dark, #0056b3);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: white;
  color: var(--color-dark, #333);
  border: 2px solid #e9ecef;
  padding: 12px 24px;
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.2s;
}

.cancel-btn:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: var(--color-primary);
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-mode-btn {
  background: var(--color-primary);
  color: white;
}

.stats-section, .charts-section, .containers-section, .server-section, .users-section, .backup-section {
  margin-bottom: 30px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.stats-section h2, .charts-section h2, .containers-section h2, .server-section h2, .users-section h2, .backup-section h2 {
  margin: 0 0 20px 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-primary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.stat-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.stat-card h3 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: var(--color-primary);
  font-weight: 600;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-dark, #333);
  margin-bottom: 8px;
}

.stat-detail {
  font-size: 0.9rem;
  color: var(--color-grey-dark, #666);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.chart-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.chart-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.chart-card h3 {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-primary);
}

.chart-container {
  position: relative;
  height: 300px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.container-actions {
  display: flex;
  gap: 12px;
}

.action-btn, .action-btn-small {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.action-btn {
  font-size: 1rem;
}

.action-btn-small {
  padding: 6px 12px;
  font-size: 0.9rem;
}

.action-btn.restart-all, .action-btn-small.restart {
  background: #ffc107;
  color: #000;
}

.action-btn.restart-all:hover:not(:disabled), .action-btn-small.restart:hover:not(:disabled) {
  background: #ffb300;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
}

.action-btn.refresh {
  background: var(--color-primary);
  color: white;
}

.action-btn.refresh:hover:not(:disabled) {
  background: var(--color-primary-dark, #0056b3);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.action-btn-small.rebuild {
  background: #28a745;
  color: white;
}

.action-btn-small.rebuild:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.action-btn-small.start {
  background: #28a745;
  color: white;
}

.action-btn-small.start:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.action-btn-small.stop {
  background: #dc3545;
  color: white;
}

.action-btn-small.stop:hover:not(:disabled) {
  background: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.action-btn-small.logs {
  background: #17a2b8;
  color: white;
}

.action-btn-small.logs:hover:not(:disabled) {
  background: #138496;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(23, 162, 184, 0.3);
}

.action-btn-small.delete {
  background: #dc3545;
  color: white;
}

.action-btn-small.delete:hover:not(:disabled) {
  background: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.action-btn-small.ssh-keys, .action-btn-small.password {
  background: #6c757d;
  color: white;
}

.action-btn-small.ssh-keys:hover:not(:disabled), .action-btn-small.password:hover:not(:disabled) {
  background: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
}

.action-btn.cleanup {
  background: #ff9800;
  color: white;
}

.action-btn.cleanup:hover:not(:disabled) {
  background: #f57c00;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
}

.action-btn.create-user {
  background: #28a745;
  color: white;
}

.action-btn.create-user:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.action-btn:disabled, .action-btn-small:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.containers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.container-item {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg, 12px);
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.container-item:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.container-info {
  flex: 1;
}

.container-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-dark, #333);
  margin-bottom: 8px;
}

.container-status {
  font-size: 0.9rem;
  color: var(--color-grey-dark, #666);
  margin-bottom: 4px;
}

.container-image {
  font-size: 0.85rem;
  color: #999;
  font-family: monospace;
}

.container-actions-item {
  display: flex;
  gap: 8px;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: var(--color-grey-dark, #666);
  font-size: 1.1rem;
  background: white;
  border-radius: var(--radius-lg, 12px);
  border: 1px solid #e9ecef;
}

@media (max-width: 768px) {
  .vds-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .domain-info {
    flex-direction: column;
    align-items: stretch;
  }
  
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .container-item {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .container-actions-item {
    justify-content: stretch;
  }
  
  .action-btn-small {
    flex: 1;
  }
}

/* Стили для управления сервером */
.server-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.server-btn {
  padding: 12px 20px;
  font-size: 0.95rem;
}

.server-btn.reboot {
  background: #ffc107;
  color: #000;
}

.server-btn.reboot:hover:not(:disabled) {
  background: #ffb300;
}

.server-btn.shutdown {
  background: #dc3545;
  color: white;
}

.server-btn.shutdown:hover:not(:disabled) {
  background: #c82333;
}

.server-btn.update {
  background: #17a2b8;
  color: white;
}

.server-btn.update:hover:not(:disabled) {
  background: #138496;
}

.server-btn.logs, .server-btn.disk, .server-btn.processes {
  background: #6c757d;
  color: white;
}

.server-btn.logs:hover:not(:disabled), .server-btn.disk:hover:not(:disabled), .server-btn.processes:hover:not(:disabled) {
  background: #5a6268;
}

/* Стили для управления пользователями */
.users-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-sm, 8px);
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-dark, #333);
  margin-bottom: 4px;
}

.user-details {
  font-size: 0.9rem;
  color: var(--color-grey-dark, #666);
}

.user-actions {
  display: flex;
  gap: 8px;
}

/* Стили для бэкапов */
.backup-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.backup-btn {
  padding: 12px 20px;
  font-size: 0.95rem;
}

.backup-btn.create {
  background: #28a745;
  color: white;
}

.backup-btn.create:hover:not(:disabled) {
  background: #218838;
}

.backup-btn.send {
  background: #17a2b8;
  color: white;
}

.backup-btn.send:hover:not(:disabled) {
  background: #138496;
}

/* Стили для SSL сертификатов */
.ssl-section {
  margin-bottom: 30px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.ssl-status {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: var(--radius-sm, 8px);
  border: 1px solid #e9ecef;
}

.ssl-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ssl-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
}

.ssl-info-item:last-child {
  border-bottom: none;
}

.ssl-info-item label {
  font-weight: 600;
  color: var(--color-primary);
  min-width: 150px;
}

.ssl-info-item span {
  color: var(--color-dark, #333);
  text-align: right;
}

.ssl-info-item span.expiring-soon {
  color: #dc3545;
  font-weight: 600;
}

.ssl-info-item span.self-signed {
  color: #ff9800;
  font-weight: 600;
}

.ssl-no-cert {
  text-align: center;
  padding: 20px;
  color: #856404;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: var(--radius-sm, 8px);
}

.ssl-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.ssl-btn {
  padding: 12px 20px;
  font-size: 0.95rem;
}

.ssl-btn.renew {
  background: #28a745;
  color: white;
}

.ssl-btn.renew:hover:not(:disabled) {
  background: #218838;
}

.ssl-btn.status {
  background: #17a2b8;
  color: white;
}

.ssl-btn.status:hover:not(:disabled) {
  background: #138496;
}

/* Модальные окна */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-content h3 {
  margin: 0 0 20px 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-primary);
}

.logs-modal {
  max-width: 900px;
  width: 95%;
}

.logs-content {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: var(--radius-sm, 8px);
  max-height: 60vh;
  overflow-y: auto;
  margin-bottom: 20px;
}

.logs-content pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Сообщение об отсутствии доступа */
.access-denied-message {
  text-align: center;
  padding: 40px;
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: var(--radius-lg, 12px);
  color: #856404;
  font-size: 1.1rem;
  font-weight: 600;
}

.access-denied-message p {
  margin: 0;
}
</style>

