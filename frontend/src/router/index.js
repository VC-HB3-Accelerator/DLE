import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import { useAuthStore } from '../stores/auth';

console.log('router/index.js: Script loaded');

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

console.log('router/index.js: Router created');

// Защита маршрутов
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  // Если пытаемся перейти на несуществующий маршрут, перенаправляем на главную
  if (!to.matched.length) {
    return next({ name: 'home' });
  }
  
  // Проверяем аутентификацию, если маршрут требует авторизации
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!authStore.isAuthenticated) {
      return next({ name: 'home' });
    }
    
    // Проверяем права администратора
    if (to.matched.some(record => record.meta.requiresAdmin) && !authStore.isAdmin) {
      return next({ name: 'home' });
    }
  }
  
  next();
});

export default router;
