/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../api/axios'

const roles = ref([])
const isLoading = ref(false)
const error = ref(null)

export function useRoles() {
  // Загружаем роли с сервера (из базы данных через миграции)
  const fetchRoles = async () => {
    try {
      isLoading.value = true
      error.value = null
      
      const response = await api.get('/users/roles')
      
      if (response.data.success) {
        roles.value = response.data.roles
        console.log('[useRoles] Загружены роли из базы данных:', roles.value)
      } else {
        throw new Error(response.data.error || 'Ошибка загрузки ролей')
      }
    } catch (err) {
      console.error('[useRoles] Ошибка при загрузке ролей:', err)
      error.value = err.message
      // Не показываем ошибку если пользователь не авторизован
      if (err.response?.status === 401) {
        console.log('[useRoles] Пользователь не авторизован, пропускаем загрузку ролей')
        error.value = null
      }
    } finally {
      isLoading.value = false
    }
  }

  // Получаем название роли по ID
  const getRoleName = (roleId) => {
    const role = roles.value.find(r => r.id === roleId)
    return role ? role.name : 'Неизвестно'
  }

  // Получаем CSS класс для роли
  const getRoleClass = (roleName) => {
    const classMap = {
      'user': 'user-badge',
      'readonly': 'readonly-badge',
      'editor': 'editor-badge'
    }
    return classMap[roleName] || 'user-badge'
  }

  // Получаем отображаемое название роли
  const getRoleDisplayName = (roleName) => {
    const displayMap = {
      'user': 'Пользователь',
      'readonly': 'Чтение', 
      'editor': 'Редактор'
    }
    return displayMap[roleName] || 'Неизвестно'
  }

  // Функция для очистки ролей
  const clearRoles = () => {
    roles.value = []
    error.value = null
    console.log('[useRoles] Роли очищены')
  }

  // Computed для проверки загрузки
  const isReady = computed(() => roles.value.length > 0 && !isLoading.value)

  // Подписываемся на централизованные события
  const handleClearData = () => {
    console.log('[useRoles] Получено событие очистки данных')
    clearRoles()
  }

  const handleRefreshData = () => {
    console.log('[useRoles] Получено событие обновления данных, загружаем роли')
    fetchRoles()
  }

  onMounted(() => {
    window.addEventListener('clear-application-data', handleClearData)
    window.addEventListener('refresh-application-data', handleRefreshData)
  })

  onUnmounted(() => {
    window.removeEventListener('clear-application-data', handleClearData)
    window.removeEventListener('refresh-application-data', handleRefreshData)
  })

  return {
    roles: computed(() => roles.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    isReady,
    fetchRoles,
    clearRoles,
    getRoleName,
    getRoleClass,
    getRoleDisplayName
  }
}
