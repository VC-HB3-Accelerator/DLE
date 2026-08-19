<template>
  <BaseLayout>
    <AdminPageShell
      :title="$t('settings.ai.agentAccess.pageTitle')"
      :show-close="true"
      fallback="/settings/ai"
      variant="panel"
    >
      <div class="panel intro-card">
        <h3>{{ $t('settings.ai.agentAccess.introTitle') }}</h3>
        <p class="section-description">{{ $t('settings.ai.agentAccess.introText') }}</p>
        <ul class="intro-list">
          <li>{{ $t('settings.ai.agentAccess.axes.role') }}</li>
          <li>{{ $t('settings.ai.agentAccess.axes.audience') }}</li>
          <li>{{ $t('settings.ai.agentAccess.axes.agent') }}</li>
        </ul>
      </div>

      <div class="panel matrix-card">
        <div class="matrix-head">
          <div>
            <h3>{{ $t('settings.ai.agentAccess.matrixTitle') }}</h3>
            <p class="section-description">{{ $t('settings.ai.agentAccess.matrixDesc') }}</p>
          </div>
        </div>

        <div v-if="loading" class="empty-state">{{ $t('common.loading') }}</div>
        <div v-else-if="loadError" class="empty-state empty-state--error">{{ loadError }}</div>
        <div v-else class="matrix-table-wrap">
          <table class="matrix-table">
            <thead>
              <tr>
                <th>{{ $t('settings.ai.agentAccess.columns.role') }}</th>
                <th>{{ $t('settings.ai.agentAccess.columns.chat') }}</th>
                <th>{{ $t('settings.ai.agentAccess.columns.readProfile') }}</th>
                <th>{{ $t('settings.ai.agentAccess.columns.updateName') }}</th>
                <th>{{ $t('settings.ai.agentAccess.columns.updateTags') }}</th>
                <th>{{ $t('settings.ai.agentAccess.columns.readInternal') }}</th>
                <th>{{ $t('settings.ai.agentAccess.columns.proposePrompt') }}</th>
                <th>{{ $t('settings.ai.agentAccess.columns.applyPrompt') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="role in roles"
                :key="role.role"
                :class="{ 'is-active': selectedRole?.role === role.role }"
                @click="selectRole(role.role)"
              >
                <td>
                  <div class="role-cell">
                    <strong>{{ role.title }}</strong>
                    <span>{{ role.role }}</span>
                  </div>
                </td>
                <td>{{ formatFlag(role.permissions.chat_ai) }}</td>
                <td>{{ formatFlag(role.permissions.read_profile) }}</td>
                <td>{{ formatFlag(role.permissions.update_name) }}</td>
                <td>{{ formatFlag(role.permissions.update_tags) }}</td>
                <td>{{ formatFlag(role.permissions.read_internal) }}</td>
                <td>{{ formatFlag(role.permissions.propose_prompt_changes) }}</td>
                <td>{{ formatApplyPrompt(role.permissions.apply_prompt_changes, role.permissions.apply_prompt_changes_requires_confirm) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="selectedRole" class="panel role-card">
        <h3>{{ $t('settings.ai.agentAccess.roleCardTitle') }}</h3>
        <div class="role-card-grid">
          <div class="role-card-item">
            <span class="role-card-label">{{ $t('settings.ai.agentAccess.roleCard.role') }}</span>
            <strong>{{ selectedRole.title }}</strong>
          </div>
          <div class="role-card-item">
            <span class="role-card-label">{{ $t('settings.ai.agentAccess.roleCard.mode') }}</span>
            <strong>{{ roleModeLabel(selectedRole.mode) }}</strong>
          </div>
          <div class="role-card-item">
            <span class="role-card-label">{{ $t('settings.ai.agentAccess.roleCard.tools') }}</span>
            <strong>{{ selectedRole.toolsSummary }}</strong>
          </div>
          <div class="role-card-item">
            <span class="role-card-label">{{ $t('settings.ai.agentAccess.roleCard.knowledge') }}</span>
            <strong>{{ selectedRole.knowledgeScope }}</strong>
          </div>
        </div>

        <div class="caps-card">
          <h4>{{ $t('settings.ai.agentAccess.chatCapsTitle') }}</h4>
          <div class="caps-grid">
            <div class="caps-item">
              <span>{{ $t('settings.security.roles.send_text') }}</span>
              <strong>{{ formatCap(selectedRole.chatCaps?.send_text) }}</strong>
            </div>
            <div class="caps-item">
              <span>{{ $t('settings.security.roles.send_file') }}</span>
              <strong>{{ formatCap(selectedRole.chatCaps?.send_file) }}</strong>
            </div>
            <div class="caps-item">
              <span>{{ $t('settings.security.roles.send_video') }}</span>
              <strong>{{ formatCap(selectedRole.chatCaps?.send_video) }}</strong>
            </div>
            <div class="caps-item">
              <span>{{ $t('settings.security.roles.send_audio') }}</span>
              <strong>{{ formatCap(selectedRole.chatCaps?.send_audio) }}</strong>
            </div>
            <div class="caps-item">
              <span>{{ $t('settings.security.roles.send_call') }}</span>
              <strong>{{ formatCap(selectedRole.chatCaps?.send_call) }}</strong>
            </div>
          </div>
        </div>

        <div class="notes-card">
          <p><strong>{{ $t('settings.ai.agentAccess.notes.tagsTitle') }}</strong> {{ selectedRole.notes?.tags }}</p>
          <p><strong>{{ $t('settings.ai.agentAccess.notes.promptTitle') }}</strong> {{ selectedRole.notes?.prompt }}</p>
        </div>
      </div>

      <div class="panel editor-card">
        <h3>{{ $t('settings.ai.agentAccess.editorFlowTitle') }}</h3>
        <p class="section-description">{{ $t('settings.ai.agentAccess.editorFlowDesc') }}</p>
        <ol class="editor-flow">
          <li>{{ $t('settings.ai.agentAccess.editorFlow.step1') }}</li>
          <li>{{ $t('settings.ai.agentAccess.editorFlow.step2') }}</li>
          <li>{{ $t('settings.ai.agentAccess.editorFlow.step3') }}</li>
          <li>{{ $t('settings.ai.agentAccess.editorFlow.step4') }}</li>
        </ol>
      </div>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from '@/api/axios';
import BaseLayout from '@/components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import { ROLES, PERMISSIONS, PERMISSIONS_MAP, getRoleDescription } from '@/composables/permissions.js';
import { cloneDefaultCaps, roleKeyForChatCaps } from '@/shared/chatRoleCaps.js';

const { t } = useI18n();

const loading = ref(true);
const loadError = ref('');
const roles = ref([]);
const selectedRoleKey = ref('guest');

const selectedRole = computed(() => roles.value.find((role) => role.role === selectedRoleKey.value) || roles.value[0] || null);

function selectRole(role) {
  selectedRoleKey.value = role;
}

function formatFlag(value) {
  return value ? t('common.yes') : t('common.no');
}

function formatApplyPrompt(canApply, requiresConfirm) {
  if (!canApply) return t('settings.ai.agentAccess.planned');
  if (requiresConfirm) return t('settings.ai.agentAccess.applyOnlyAfterConfirm');
  return t('common.yes');
}

function formatCap(value) {
  return value === false ? t('common.no') : t('common.yes');
}

function roleModeLabel(mode) {
  if (mode === 'control_plane') return t('settings.ai.agentAccess.modes.controlPlane');
  return t('settings.ai.agentAccess.modes.consultant');
}

function buildRoleCard(role, chatCapsMatrix) {
  const rolePerms = PERMISSIONS_MAP[role] || [];
  const isGuest = role === ROLES.GUEST;
  const isEditor = role === ROLES.EDITOR;
  const canReadInternal = rolePerms.includes(PERMISSIONS.VIEW_LEGAL_DOCS);
  const canProposePromptChanges = isEditor
    && rolePerms.includes(PERMISSIONS.MANAGE_SETTINGS)
    && rolePerms.includes(PERMISSIONS.GENERATE_AI_REPLIES);

  return {
    role,
    title: getRoleDescription(role),
    mode: isEditor ? 'control_plane' : 'consultant',
    knowledgeScope: isGuest ? 'public-client' : (canReadInternal ? 'crm + internal по правам' : 'crm + public-client'),
    toolsSummary: isGuest ? 'нет' : (isEditor ? 'профиль + режим правок' : 'профиль'),
    permissions: {
      chat_ai: rolePerms.includes(PERMISSIONS.CHAT_AI),
      read_profile: !isGuest,
      update_name: !isGuest,
      update_tags: false,
      read_internal: canReadInternal,
      propose_prompt_changes: canProposePromptChanges,
      apply_prompt_changes: canProposePromptChanges,
      apply_prompt_changes_requires_confirm: canProposePromptChanges
    },
    chatCaps: chatCapsMatrix[roleKeyForChatCaps(role)] || cloneDefaultCaps(),
    notes: {
      tags: t('settings.ai.agentAccess.notes.tagsBody'),
      prompt: isEditor
        ? t('settings.ai.agentAccess.notes.promptEditor')
        : t('settings.ai.agentAccess.notes.promptOther')
    }
  };
}

async function loadChatCapsMatrix() {
  try {
    const { data } = await axios.get('/settings/chat-role-capabilities', {
      headers: { 'Cache-Control': 'no-store' }
    });
    if (data?.success && data.data && typeof data.data === 'object') {
      return data.data;
    }
  } catch (error) {
    console.warn('[AiAgentAccessView] chat caps fallback:', error?.message || error);
  }
  return {};
}

async function loadAgentAccess() {
  loading.value = true;
  loadError.value = '';
  try {
    const chatCapsMatrix = await loadChatCapsMatrix();
    const roleOrder = [ROLES.GUEST, ROLES.USER, ROLES.READONLY, ROLES.EDITOR];
    roles.value = roleOrder.map((role) => buildRoleCard(role, chatCapsMatrix));
    if (!roles.value.find((role) => role.role === selectedRoleKey.value) && roles.value[0]) {
      selectedRoleKey.value = roles.value[0].role;
    }
  } catch (error) {
    console.error('[AiAgentAccessView] load failed:', error);
    loadError.value = t('settings.ai.agentAccess.loadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(loadAgentAccess);
</script>

<style scoped>
.intro-card,
.matrix-card,
.role-card,
.editor-card {
  margin: var(--spacing-xl) 0;
}

.intro-list,
.editor-flow {
  margin: var(--spacing-md) 0 0;
  padding-left: 1.1rem;
  color: var(--color-text);
}

.matrix-table-wrap {
  overflow-x: auto;
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-white);
}

.matrix-table th,
.matrix-table td {
  border: 1px solid var(--color-border);
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  vertical-align: middle;
}

.matrix-table tbody tr {
  cursor: pointer;
}

.matrix-table tbody tr.is-active {
  background: color-mix(in srgb, var(--color-primary) 8%, white);
}

.role-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.role-cell span {
  color: var(--color-text-light);
  font-size: var(--font-size-sm);
}

.role-card-grid,
.caps-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.role-card-item,
.caps-item {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
}

.role-card-label,
.caps-item span {
  display: block;
  margin-bottom: var(--spacing-xs);
  color: var(--color-text-light);
  font-size: var(--font-size-sm);
}

.caps-card,
.notes-card {
  margin-top: var(--spacing-lg);
}

.notes-card p {
  margin: var(--spacing-sm) 0;
}

.empty-state {
  color: var(--color-text-light);
}

.empty-state--error {
  color: var(--color-danger);
}

@media (max-width: 768px) {
  .role-card-grid,
  .caps-grid {
    grid-template-columns: 1fr;
  }
}
</style>
