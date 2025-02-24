<template>
  <div id="app">
    <div class="app-layout">
      <Sidebar 
        v-if="isConnected && isAdmin" 
        :isAdmin="isAdmin"
        @update:collapsed="isSidebarCollapsed = $event"
      />
      <main class="main-content">
        <WalletConnection
          :isConnected="isConnected"
          :userAddress="userAddress"
          @connect="handleConnect"
          @disconnect="handleDisconnect"
        />
        <router-view 
          :userAddress="userAddress"
          :isConnected="isConnected"
          :isAdmin="isAdmin"
          @chatUpdated="handleChatUpdate"
        />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import WalletConnection from './components/WalletConnection.vue'
import Sidebar from './components/Sidebar/Sidebar.vue'

const router = useRouter()
const isConnected = ref(false)
const userAddress = ref('')
const isAdmin = ref(false)
const isSidebarCollapsed = ref(false)

// При отключении кошелька перенаправляем на главную
watch(isConnected, (newValue) => {
  if (!newValue) {
    router.push('/')
  }
})

// Проверка сессии при загрузке
async function checkSession() {
  try {
    const response = await fetch('http://127.0.0.1:3000/session', {
      credentials: 'include'
    })
    const data = await response.json()
    
    if (data.authenticated) {
      userAddress.value = data.address
      isConnected.value = true
      await checkAdminStatus()
    }
  } catch (error) {
    console.error('Ошибка проверки сессии:', error)
  }
}

// Проверка прав админа
async function checkAdminStatus() {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/admin/check', {
      credentials: 'include'
    })
    if (response.ok) {
      const { isAdmin: adminStatus } = await response.json()
      isAdmin.value = adminStatus
      console.log('Проверка прав после входа:', {
        userAddress: userAddress.value,
        isAdmin: isAdmin.value
      })
    }
  } catch (error) {
    console.error('Ошибка проверки прав админа:', error)
  }
}

async function handleConnect(address) {
  userAddress.value = address
  isConnected.value = true
  await checkAdminStatus()
}

async function handleDisconnect() {
  try {
    // Отправляем запрос на выход
    await fetch('http://127.0.0.1:3000/signout', {
      method: 'POST',
      credentials: 'include'
    })
    
    userAddress.value = ''
    isConnected.value = false
    isAdmin.value = false
  } catch (error) {
    console.error('Ошибка при отключении:', error)
  }
}

function handleChatUpdate() {
  if (isAdmin.value) {
    // Обновляем данные в админской панели
    // dataTables.value?.fetchData()
  }
}

onMounted(() => {
  checkSession()
})
</script>

<style>
#app {
  height: 100vh;
  overflow: hidden;
}

.app-layout {
  display: flex;
  height: 100%;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 2rem;  /* Соответствует отступам header */
  margin-left: v-bind("isConnected && isAdmin ? (isSidebarCollapsed ? '80px' : '270px') : '0'");
  overflow-y: auto;
  transition: margin-left 0.3s ease;
  margin-top: 70px; /* Высота header + верхний отступ */
}

/* Когда сайдбар скрыт */
.app-layout:not(:has(.sidebar)) .main-content {
  margin-left: 0;
  padding-left: 2rem;  /* Сохраняем отступ слева когда сайдбар скрыт */
}

/* Стили для заголовка */
h1 {
  margin-top: 0;
}
</style> 