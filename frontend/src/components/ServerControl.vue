<template>
  <div class="server-control">
    <button 
      @click="stopServer"
      class="stop-button"
      :disabled="isLoading"
    >
      {{ isLoading ? 'Останавливается...' : 'Остановить сервер' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const isLoading = ref(false)

async function stopServer() {
  if (!confirm('Вы уверены, что хотите остановить сервер?')) return
  
  isLoading.value = true
  try {
    const response = await fetch('http://localhost:3000/shutdown', {
      method: 'POST'
    })
    const data = await response.json()
    console.log(data.message)
  } catch (error) {
    console.error('Ошибка при остановке сервера:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.server-control {
  margin-top: 20px;
}

.stop-button {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.stop-button:disabled {
  background-color: #dc354580;
  cursor: not-allowed;
}
</style> 