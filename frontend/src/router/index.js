import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
// Импортируем компоненты напрямую, если они существуют
import HomeView from '../views/HomeView.vue';
import DashboardView from '../views/DashboardView.vue';
import KanbanView from '../views/KanbanView.vue';
import KanbanBoardView from '../views/KanbanBoardView.vue';
import AccessTestPage from '../views/AccessTestPage.vue';
import ProfileView from '../views/ProfileView.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/access-test',
    name: 'access-test',
    component: AccessTestPage,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  // Перенаправляем с /chat на главную страницу
  {
    path: '/chat',
    redirect: { name: 'home' }
  },
  // Маршруты для Канбан-досок
  {
    path: '/kanban',
    name: 'kanban',
    component: KanbanView,
    meta: { requiresAuth: true }
  },
  {
    path: '/kanban/boards/:id',
    name: 'kanbanBoard',
    component: KanbanBoardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  }
});

// Навигационный хук для проверки аутентификации
router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  
  // Если маршрут требует аутентификации и пользователь не аутентифицирован
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next({ name: 'home' });
  } 
  // Если маршрут требует прав администратора и пользователь не администратор
  else if (to.meta.requiresAdmin && !auth.isAdmin) {
    next({ name: 'home' });
  }
  // В остальных случаях разрешаем переход
  else {
    next();
  }
});

export default router; 