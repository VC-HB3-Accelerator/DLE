import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
// Импортируем компоненты напрямую, если они существуют
import HomeView from '../views/HomeView.vue';
import DashboardView from '../views/DashboardView.vue';
import ProfileView from '../views/ProfileView.vue';
import AdminView from '../views/AdminView.vue'; // Новый компонент для администраторов
import AccessTestView from '../views/AccessTestView.vue';
import ConversationsView from '../views/ConversationsView.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: false },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  // Перенаправляем с /chat на главную страницу
  {
    path: '/chat',
    redirect: { name: 'home' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/AdminView.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/access-test',
    name: 'access-test',
    component: AccessTestView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/conversations',
    name: 'Conversations',
    component: ConversationsView,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 };
  },
});

// Навигационный хук для проверки аутентификации
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Проверяем аутентификацию только если еще не проверяли
  if (!authStore.checkPerformed) {
    try {
      await authStore.checkAuth();
    } catch (error) {
      console.error('Ошибка при проверке аутентификации:', error);
    }
  }

  // Проверка прав доступа
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Home' });
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next({ name: 'Home' });
  } else {
    next();
  }
});

export default router;
