<template>
  <div class="sidebar" :class="{ 'collapsed': isSidebarCollapsed }">
    <div class="sidebar-content">
      <!-- AI Assistant Section -->
      <div class="sidebar-section">
        <div class="section-header" @click="toggleSidebarOrSection">
          <span v-if="!isSidebarCollapsed">
            <span>ИИ Ассистент</span>
          </span>
          <span v-else class="section-letter">AI</span>
        </div>
        <div class="section-content" v-show="!isSidebarCollapsed">
          <SidebarItem 
            to="/ai/chats"
            text="Чаты"
          />
          <template v-if="isAdmin">
            <SidebarItem 
              to="/ai/users"
              text="Пользователи"
            />
            <SidebarItem 
              to="/ai/vectorstore"
              text="Векторное хранилище"
            />
          </template>
        </div>
      </div>

      <!-- Smart Contract Section -->
      <div v-if="isAdmin" class="sidebar-section">
        <div class="section-header" @click="toggleSidebarOrSection">
          <span v-if="!isSidebarCollapsed">
            <span>Смарт Контракт</span>
          </span>
          <span v-else class="section-letter">SK</span>
        </div>
        <div class="section-content" v-show="!isSidebarCollapsed">
          <SidebarItem 
            to="/contract/deploy"
            icon="🚀"
            text="Деплой"
          />
          <SidebarItem 
            to="/contract/manage"
            icon="⚙️"
            text="Управление"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SidebarItem from './SidebarItem.vue'

const props = defineProps({
  isAdmin: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:collapsed'])

const aiExpanded = ref(true)
const contractExpanded = ref(true)
const isSidebarCollapsed = ref(false)

function toggleAI() {
  aiExpanded.value = !aiExpanded.value
}

function toggleContract() {
  contractExpanded.value = !contractExpanded.value
}

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  emit('update:collapsed', isSidebarCollapsed.value)
}

function toggleSidebarOrSection(event) {
  if (isSidebarCollapsed.value) {
    isSidebarCollapsed.value = false
    emit('update:collapsed', false)
  }
}
</script>

<style scoped>
.sidebar {
  width: 250px;
  background: white;
  color: #2c3e50;
  padding: 1.5rem 0;
  position: fixed;
  top: 70px;
  left: 0;
  overflow-y: auto;
  z-index: 100;
  transition: all 0.3s ease;
  height: calc(100vh - 70px);
}

.sidebar.collapsed {
  width: 60px;
  padding: 1rem 0;
  background: #2c3e50;
}

.sidebar-section {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.section-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 2rem;
  cursor: pointer;
  transition: background-color 0.3s;
  color: #2c3e50;
  font-weight: 500;
  height: 44px;
  user-select: none;
}

.section-header:hover {
  background-color: rgba(0,0,0,0.05);
}

.icon {
  display: none;
}

.section-content {
  margin-left: 2rem;
  padding-top: 0.25rem;
}

/* Стили для активных ссылок */
:deep(.router-link-active) {
  background-color: rgba(0,0,0,0.1);
}

.section-letter {
  color: white;
  font-weight: bold;
  font-size: 1.2rem;
  cursor: pointer;
  display: block;
  text-align: center;
  line-height: 40px;
  height: 40px;
}

.collapsed .section-header {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.collapsed .section-header:hover .section-letter {
  opacity: 0.8;
}

/* Стили для пунктов меню */
:deep(.sidebar-link) {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
}
</style>

