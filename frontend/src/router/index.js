import { createRouter, createWebHistory } from 'vue-router'
import Chats from '../components/AI/Chats.vue'
import Users from '../components/AI/Users.vue'
import VectorStore from '../components/AI/VectorStore.vue'
import Deploy from '../components/Contract/Deploy.vue'
import Manage from '../components/Contract/Manage.vue'

// Защита маршрутов для админа
const requireAdmin = async (to, from, next) => {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/admin/check', {
      credentials: 'include'
    })
    if (response.ok) {
      const { isAdmin } = await response.json()
      if (isAdmin) {
        next()
        return
      }
    }
    next('/')
  } catch (error) {
    console.error('Ошибка проверки прав:', error)
    next('/')
  }
}

const routes = [
  {
    path: '/',
    redirect: '/ai/chats'
  },
  {
    path: '/ai/chats',
    name: 'chats',
    component: Chats
  },
  {
    path: '/ai/users',
    beforeEnter: requireAdmin,
    component: Users
  },
  {
    path: '/ai/vectorstore',
    beforeEnter: requireAdmin,
    component: VectorStore
  },
  {
    path: '/contract/deploy',
    beforeEnter: requireAdmin,
    component: Deploy
  },
  {
    path: '/contract/manage',
    beforeEnter: requireAdmin,
    component: Manage
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
}) 