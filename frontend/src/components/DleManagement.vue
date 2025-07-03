<template>
  <div class="dle-management-modal">
    <div class="dle-management-header">
      <h2>Ваши DLE</h2>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div class="dle-list-section">
      <div v-if="dleList.length === 0" class="no-dle-message">
        <p>У вас пока нет созданных DLE.</p>
      </div>
      <div v-else>
        <div class="dle-list">
          <div v-for="(dle, index) in dleList" :key="index" class="dle-card"
               :class="{ 'active': selectedDleIndex === index }"
               @click="selectDle(index)">
            <div class="dle-card-header">
              <h3>{{ dle.name }} ({{ dle.symbol }})</h3>
              <button v-if="isAdmin" class="delete-dle-btn" @click.stop="deleteDle(dle, index)" title="Удалить DLE">
                <i class="fas fa-trash"></i>
              </button>
            </div>
            <p><strong>Адрес:</strong> {{ shortenAddress(dle.tokenAddress) }}</p>
            <p><strong>Местонахождение:</strong> {{ dle.location }}</p>
          </div>
        </div>
      </div>
    </div>
    <div v-if="selectedDle" class="dle-details-section">
      <h2>Управление "{{ selectedDle.name }}"</h2>
      <div class="dle-tabs">
        <div class="tab-header">
          <div class="tab-button" :class="{ 'active': activeTab === 'info' }" @click="activeTab = 'info'">
            <i class="fas fa-info-circle"></i> Основная информация
          </div>
          <div class="tab-button" :class="{ 'active': activeTab === 'proposals' }" @click="activeTab = 'proposals'">
            <i class="fas fa-tasks"></i> Предложения
          </div>
          <div class="tab-button" :class="{ 'active': activeTab === 'governance' }" @click="activeTab = 'governance'">
            <i class="fas fa-balance-scale"></i> Управление
          </div>
          <div class="tab-button" :class="{ 'active': activeTab === 'modules' }" @click="activeTab = 'modules'">
            <i class="fas fa-puzzle-piece"></i> Модули
          </div>
        </div>
        <div class="tab-content" v-if="activeTab === 'info'">
          <div class="info-card">
            <h3>Основная информация</h3>
            <div class="info-row">
              <span class="info-label">Название:</span>
              <span class="info-value">{{ selectedDle.name }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Символ токена:</span>
              <span class="info-value">{{ selectedDle.symbol }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Местонахождение:</span>
              <span class="info-value">{{ selectedDle.location }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Коды деятельности:</span>
              <span class="info-value">{{ selectedDle.isicCodes && selectedDle.isicCodes.length ? selectedDle.isicCodes.join(', ') : 'Не указаны' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Дата создания:</span>
              <span class="info-value">{{ formatDate(selectedDle.creationTimestamp) }}</span>
            </div>
          </div>
          <div class="contract-cards">
            <div class="contract-card">
              <h4>Токен управления</h4>
              <p class="address">{{ selectedDle.tokenAddress }}</p>
              <div class="contract-actions">
                <button class="btn btn-sm btn-secondary" @click="copyToClipboard(selectedDle.tokenAddress)">
                  <i class="fas fa-copy"></i> Копировать адрес
                </button>
                <button class="btn btn-sm btn-info" @click="viewOnExplorer(selectedDle.tokenAddress)">
                  <i class="fas fa-external-link-alt"></i> Обзор
                </button>
              </div>
            </div>
            <div class="contract-card">
              <h4>Таймлок</h4>
              <p class="address">{{ selectedDle.timelockAddress }}</p>
              <div class="contract-actions">
                <button class="btn btn-sm btn-secondary" @click="copyToClipboard(selectedDle.timelockAddress)">
                  <i class="fas fa-copy"></i> Копировать адрес
                </button>
                <button class="btn btn-sm btn-info" @click="viewOnExplorer(selectedDle.timelockAddress)">
                  <i class="fas fa-external-link-alt"></i> Обзор
                </button>
              </div>
            </div>
            <div class="contract-card">
              <h4>Governor</h4>
              <p class="address">{{ selectedDle.governorAddress }}</p>
              <div class="contract-actions">
                <button class="btn btn-sm btn-secondary" @click="copyToClipboard(selectedDle.governorAddress)">
                  <i class="fas fa-copy"></i> Копировать адрес
                </button>
                <button class="btn btn-sm btn-info" @click="viewOnExplorer(selectedDle.governorAddress)">
                  <i class="fas fa-external-link-alt"></i> Обзор
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="tab-content" v-if="activeTab === 'proposals'">
          <h3>Предложения</h3>
          <div class="proposals-actions">
            <button class="btn btn-primary" @click="showCreateProposalForm = true">
              <i class="fas fa-plus"></i> Создать предложение
            </button>
          </div>
          <div v-if="showCreateProposalForm" class="create-proposal-form">
            <h4>Новое предложение</h4>
            <div class="form-group">
              <label for="proposalTitle">Заголовок:</label>
              <input type="text" id="proposalTitle" v-model="newProposal.title" class="form-control">
            </div>
            <div class="form-group">
              <label for="proposalDescription">Описание:</label>
              <textarea id="proposalDescription" v-model="newProposal.description" class="form-control" rows="3"></textarea>
            </div>
            <div class="form-actions">
              <button class="btn btn-success" @click="createProposal" :disabled="isCreatingProposal">
                <i class="fas fa-paper-plane"></i> {{ isCreatingProposal ? 'Отправка...' : 'Отправить' }}
              </button>
              <button class="btn btn-secondary" @click="showCreateProposalForm = false">
                <i class="fas fa-times"></i> Отмена
              </button>
            </div>
          </div>
          <div class="proposals-list">
            <p v-if="proposals.length === 0">Предложений пока нет</p>
            <div v-else v-for="(proposal, index) in proposals" :key="index" class="proposal-card">
              <h4>{{ proposal.title }}</h4>
              <p>{{ proposal.description }}</p>
              <div class="proposal-status" :class="proposal.status">
                {{ getProposalStatusText(proposal.status) }}
              </div>
              <div class="proposal-actions">
                <button class="btn btn-sm btn-primary" @click="voteForProposal(proposal.id, true)" :disabled="!canVote(proposal)">
                  <i class="fas fa-thumbs-up"></i> За
                </button>
                <button class="btn btn-sm btn-danger" @click="voteForProposal(proposal.id, false)" :disabled="!canVote(proposal)">
                  <i class="fas fa-thumbs-down"></i> Против
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="tab-content" v-if="activeTab === 'governance'">
          <h3>Управление</h3>
          <div class="governance-info">
            <div class="info-card">
              <h4>Настройки Governor</h4>
              <div class="info-row">
                <span class="info-label">Порог предложения:</span>
                <span class="info-value">100,000 GT</span>
              </div>
              <div class="info-row">
                <span class="info-label">Кворум:</span>
                <span class="info-value">4%</span>
              </div>
              <div class="info-row">
                <span class="info-label">Задержка голосования:</span>
                <span class="info-value">1 день</span>
              </div>
              <div class="info-row">
                <span class="info-label">Период голосования:</span>
                <span class="info-value">7 дней</span>
              </div>
            </div>
            <div class="info-card">
              <h4>Статистика голосований</h4>
              <div class="info-row">
                <span class="info-label">Всего предложений:</span>
                <span class="info-value">{{ proposals.length }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Активных предложений:</span>
                <span class="info-value">{{ getProposalsByStatus('active').length }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Успешных предложений:</span>
                <span class="info-value">{{ getProposalsByStatus('succeeded').length }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Отклоненных предложений:</span>
                <span class="info-value">{{ getProposalsByStatus('defeated').length }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="tab-content" v-if="activeTab === 'modules'">
          <h3>Подключение модулей</h3>
          <p>Здесь вы можете подключить дополнительные модули к вашему DLE.</p>
          <div class="modules-list">
            <div v-for="(module, index) in availableModules" :key="index" class="module-card">
              <h4>{{ module.name }}</h4>
              <p>{{ module.description }}</p>
              <div class="module-status" :class="{ 'installed': isModuleInstalled(module) }">
                {{ isModuleInstalled(module) ? 'Установлен' : 'Доступен' }}
              </div>
              <div v-if="module.name === 'Прием платежей' && paymentModuleTokens.length > 0" class="payment-tokens-list">
                <div v-for="token in paymentModuleTokens" :key="token.address + token.network" class="payment-token-entry">
                  <span><b>{{ token.name }}</b> ({{ token.network }})</span>
                  <span style="font-size:0.95em;color:#888">{{ token.address }}</span>
                </div>
              </div>
              <div class="module-actions">
                <button v-if="module.name === 'Прием платежей' && !isModuleInstalled(module)" class="btn btn-success" @click="openPaymentTokensModal">
                  <i class="fas fa-plus"></i> Настроить
                </button>
                <button v-else-if="module.name === 'Прием платежей' && isModuleInstalled(module)" class="btn btn-danger" @click="uninstallPaymentModule">
                  <i class="fas fa-trash"></i> Удалить
                </button>
                <button v-else-if="!isModuleInstalled(module)" class="btn btn-success" @click="installModule(module)">
                  <i class="fas fa-plus"></i> Установить
                </button>
                <button v-else class="btn btn-danger" @click="uninstallModule(module)">
                  <i class="fas fa-trash"></i> Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <BaseModal
      :show="showDeleteModal"
      :title="deleteSuccess ? 'Готово' : 'Подтвердите удаление DLE'"
      @close="closeDeleteModal"
    >
      <template #default>
        <div style="margin-bottom:18px;">
          <span v-if="!deleteSuccess">Удалить DLE <b>«{{ dleToDelete?.name }}»</b>? Это действие необратимо.</span>
          <span v-else>DLE успешно удалён</span>
        </div>
      </template>
      <template #actions>
        <template v-if="!deleteSuccess">
          <button class="modal-ok-btn delete-btn" @click="confirmDeleteDle" :disabled="isDeletingDle">
            {{ isDeletingDle ? 'Удаление...' : 'Удалить' }}
          </button>
          <button class="modal-ok-btn cancel-btn" @click="closeDeleteModal" :disabled="isDeletingDle">Отмена</button>
        </template>
        <template v-else>
          <button class="modal-ok-btn" @click="closeDeleteModal">OK</button>
        </template>
      </template>
    </BaseModal>
    <BaseModal
      :show="showPaymentTokensModal"
      title="Выберите токены для приема платежей"
      @close="closePaymentTokensModal"
    >
      <template #default>
        <div v-if="authTokens.length === 0">Нет доступных токенов. Добавьте токены в настройках безопасности.</div>
        <div v-else>
          <div v-for="token in authTokens" :key="token.address + token.network" class="token-select-row">
            <label>
              <input type="checkbox" :value="token" v-model="paymentModuleTokens.value" />
              <b>{{ token.name }}</b> ({{ token.network }}) <span style="font-size:0.95em;color:#888">{{ token.address }}</span>
            </label>
          </div>
        </div>
      </template>
      <template #actions>
        <button class="modal-ok-btn" @click="closePaymentTokensModal">Отмена</button>
        <button class="modal-ok-btn btn-success" @click="closePaymentTokensModal">Сохранить</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, defineProps, computed, inject } from 'vue';
import { useAuthContext } from '@/composables/useAuth';
import dleService from '@/services/dleService';
import BaseModal from './NoAccessModal.vue';

const props = defineProps({
  dleList: { type: Array, required: true },
  selectedDleIndex: { type: Number, default: null }
});

const { isAdmin } = useAuthContext();
const selectedDleIndex = ref(props.selectedDleIndex ?? 0);
const activeTab = ref('info');
const showCreateProposalForm = ref(false);
const newProposal = ref({ title: '', description: '' });
const isCreatingProposal = ref(false);
const proposals = ref([]);
const availableModules = ref([
  {
    name: 'Контракт на активы',
    description: 'Позволяет токенизировать физические активы и управлять ими через DLE.',
    installed: false
  },
  {
    name: 'Мультиподпись',
    description: 'Добавляет функциональность мультиподписи для повышенной безопасности.',
    installed: false
  },
  {
    name: 'Дивиденды',
    description: 'Позволяет распределять дивиденды между держателями токенов.',
    installed: false
  },
  {
    name: 'Стейкинг',
    description: 'Добавляет возможность стейкинга токенов для получения наград.',
    installed: false
  }
]);
const selectedDle = computed(() => {
  if (selectedDleIndex.value !== null && props.dleList.length > selectedDleIndex.value) {
    return props.dleList[selectedDleIndex.value];
  }
  return null;
});
function selectDle(index) {
  selectedDleIndex.value = index;
  activeTab.value = 'info';
}
function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
}
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => {
      alert('Адрес скопирован в буфер обмена');
    })
    .catch(err => {
      console.error('Ошибка при копировании текста: ', err);
    });
}
function viewOnExplorer(address) {
  window.open(`https://sepolia.etherscan.io/address/${address}`, '_blank');
}
function createProposal() {
  if (!newProposal.value.title || !newProposal.value.description) {
    alert('Пожалуйста, заполните все поля');
    return;
  }
  isCreatingProposal.value = true;
  try {
    proposals.value.push({
      id: Date.now().toString(),
      title: newProposal.value.title,
      description: newProposal.value.description,
      status: 'pending',
      votes: { for: 0, against: 0 }
    });
    showCreateProposalForm.value = false;
    newProposal.value = { title: '', description: '' };
    alert('Предложение создано!');
  } catch (error) {
    console.error('Ошибка при создании предложения:', error);
    alert('Ошибка при создании предложения');
  } finally {
    isCreatingProposal.value = false;
  }
}
function voteForProposal(proposalId, isFor) {
  try {
    const proposal = proposals.value.find(p => p.id === proposalId);
    if (proposal) {
      if (isFor) {
        proposal.votes.for += 1;
      } else {
        proposal.votes.against += 1;
      }
      if (proposal.votes.for > proposal.votes.against && proposal.votes.for >= 3) {
        proposal.status = 'succeeded';
      } else if (proposal.votes.against > proposal.votes.for && proposal.votes.against >= 3) {
        proposal.status = 'defeated';
      } else {
        proposal.status = 'active';
      }
      alert('Ваш голос учтен!');
    }
  } catch (error) {
    console.error('Ошибка при голосовании:', error);
    alert('Ошибка при голосовании');
  }
}
function canVote(proposal) {
  return proposal.status === 'active' || proposal.status === 'pending';
}
function getProposalStatusText(status) {
  const statusMap = {
    'pending': 'Ожидает',
    'active': 'Активно',
    'succeeded': 'Принято',
    'defeated': 'Отклонено',
    'executed': 'Выполнено'
  };
  return statusMap[status] || status;
}
function getProposalsByStatus(status) {
  return proposals.value.filter(p => p.status === status);
}
function installModule(module) {
  module.installed = true;
  alert(`Модуль "${module.name}" успешно установлен!`);
}
function uninstallModule(module) {
  module.installed = false;
  alert(`Модуль "${module.name}" удален.`);
}
function isModuleInstalled(module) {
  if (typeof module.installed === 'function') return module.installed();
  return !!module.installed;
}
const emit = defineEmits(['close', 'dle-updated']);
const showDeleteModal = ref(false);
const dleToDelete = ref(null);
const isDeletingDle = ref(false);
const deleteSuccess = ref(false);
function deleteDle(dle, idx) {
  if (!isAdmin.value) return;
  dleToDelete.value = dle;
  showDeleteModal.value = true;
  deleteSuccess.value = false;
}
function closeDeleteModal() {
  showDeleteModal.value = false;
  dleToDelete.value = null;
  isDeletingDle.value = false;
  deleteSuccess.value = false;
}
async function confirmDeleteDle() {
  if (!dleToDelete.value) return;
  isDeletingDle.value = true;
  try {
    await dleService.deleteDLE(dleToDelete.value.tokenAddress);
    deleteSuccess.value = true;
    emit('dle-updated');
    isDeletingDle.value = false;
  } catch (e) {
    alert('Ошибка при удалении DLE: ' + (e?.message || e));
    isDeletingDle.value = false;
  }
}
const authTokens = inject('authTokens', ref([]));
const paymentModuleTokens = ref([]);
const showPaymentTokensModal = ref(false);
function openPaymentTokensModal() {
  showPaymentTokensModal.value = true;
}
function closePaymentTokensModal() {
  showPaymentTokensModal.value = false;
}
function savePaymentTokens(selected) {
  paymentModuleTokens.value = selected;
  closePaymentTokensModal();
  // Можно добавить сохранение в API, если потребуется
}
function uninstallPaymentModule() {
  paymentModuleTokens.value = [];
}
availableModules.value.push({
  name: 'Прием платежей',
  description: 'Позволяет принимать оплату в выбранных токенах. Можно выбрать один или несколько токенов для приема платежей.',
  installed: computed(() => paymentModuleTokens.value.length > 0)
});
</script>

<style scoped>
.dle-management-modal {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  margin-top: 40px;
  position: relative;
  overflow-x: auto;
}
.dle-management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.close-btn {
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
.dle-list-section {
  margin-bottom: 30px;
}
.dle-list {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 20px;
}
.dle-card {
  width: 300px;
  padding: 15px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.2s ease;
}
.dle-card.active {
  border-color: #17a2b8;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}
.dle-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.dle-card h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #17a2b8;
}
.dle-details-section {
  margin-top: 30px;
  border-top: 1px solid #e5e7eb;
  padding-top: 20px;
}
.no-dle-message {
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 10px;
  text-align: center;
}
.dle-tabs {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.tab-header {
  display: flex;
  gap: 20px;
  border-bottom: 1px solid #e5e7eb;
}
.tab-button {
  padding: 10px 20px;
  cursor: pointer;
  transition: border-bottom 0.2s;
}
.tab-button.active {
  border-bottom: 2px solid #17a2b8;
}
.tab-content {
  margin-top: 20px;
}
.info-card {
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 10px;
}
.info-row {
  margin-bottom: 10px;
}
.info-label {
  font-weight: bold;
}
.info-value {
  margin-left: 10px;
}
.contract-cards {
  display: flex;
  gap: 24px;
  margin-top: 24px;
  flex-wrap: wrap;
  justify-content: space-between;
}
.contract-card {
  flex: 1 1 0;
  min-width: 260px;
  max-width: 340px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.07);
  padding: 22px 20px 18px 20px;
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  transition: box-shadow 0.2s, transform 0.2s;
}
.contract-card:hover {
  box-shadow: 0 6px 24px rgba(23,162,184,0.13);
  transform: translateY(-2px) scale(1.02);
}
.contract-card h4 {
  margin: 0 0 10px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #17a2b8;
}
.contract-card .address {
  font-family: 'Fira Mono', 'Consolas', monospace;
  word-break: break-all;
  background: #f6f8fa;
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 0.98rem;
  margin-bottom: 18px;
  color: #222;
}
.contract-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}
.contract-actions .btn {
  flex: 1 1 0;
  min-width: 0;
  font-size: 1rem;
  padding: 10px 0;
  border-radius: 8px;
  font-weight: 500;
  box-shadow: none;
  border: none;
  transition: background 0.18s, color 0.18s;
}
.contract-actions .btn-secondary {
  background: #f1f3f6;
  color: #888;
}
.contract-actions .btn-secondary:hover {
  background: #e2e6ea;
  color: #222;
}
.contract-actions .btn-info {
  background: #17a2b8;
  color: #fff;
}
.contract-actions .btn-info:hover {
  background: #148a9d;
}
@media (max-width: 900px) {
  .contract-cards {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  .contract-card {
    max-width: 100%;
    min-width: 0;
  }
}
.proposals-actions {
  margin-bottom: 20px;
}
.create-proposal-form {
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 10px;
}
.form-group {
  margin-bottom: 10px;
}
.form-group label {
  display: block;
  margin-bottom: 5px;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
}
.form-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.proposals-list {
  margin-top: 20px;
}
.proposal-card {
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 5px;
  margin-bottom: 10px;
}
.proposal-status {
  margin-top: 5px;
  padding: 5px 10px;
  border-radius: 5px;
}
.proposal-status.pending {
  background-color: #ffd700;
}
.proposal-status.active {
  background-color: #17a2b8;
  color: #fff;
}
.proposal-status.succeeded {
  background-color: #28a745;
  color: #fff;
}
.proposal-status.defeated {
  background-color: #dc3545;
  color: #fff;
}
.proposal-actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}
.modules-list {
  margin-top: 20px;
}
.module-card {
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 5px;
  margin-bottom: 10px;
}
.module-status {
  margin-top: 5px;
  padding: 5px 10px;
  border-radius: 5px;
}
.module-status.installed {
  background-color: #28a745;
  color: #fff;
}
.module-actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}
.delete-dle-btn {
  background: none;
  border: none;
  color: #dc3545;
  font-size: 1.2em;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}
.delete-dle-btn:hover {
  background: #ffeaea;
  color: #a71d2a;
}
.delete-btn {
  background: #dc3545;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 2rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.delete-btn:disabled {
  background: #e6a6ad;
  cursor: not-allowed;
}
.delete-btn:hover:not(:disabled) {
  background: #b52a37;
}
.cancel-btn {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 0.5rem 2rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.cancel-btn:disabled {
  background: #eee;
  color: #aaa;
  cursor: not-allowed;
}
.cancel-btn:hover:not(:disabled) {
  background: #e0e0e0;
}
.payment-tokens-list {
  margin: 10px 0 0 0;
  padding: 8px 0 0 0;
  border-top: 1px solid #e5e7eb;
}
.payment-token-entry {
  font-size: 1.02em;
  margin-bottom: 4px;
  display: flex;
  flex-direction: column;
}
.token-select-row {
  margin-bottom: 8px;
  text-align: left;
}
.btn-success {
  background: #28a745;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 2rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.btn-success:hover {
  background: #218838;
}
</style> 