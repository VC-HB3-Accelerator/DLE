import { ref } from 'vue';

// Простая шина событий на основе ref
const listeners = ref({});

export default {
  // Подписка на событие
  on(event, callback) {
    if (!listeners.value[event]) {
      listeners.value[event] = [];
    }
    listeners.value[event].push(callback);
    
    // Возвращаем функцию отписки
    return () => {
      this.off(event, callback);
    };
  },
  
  // Отписка от события
  off(event, callback) {
    if (!listeners.value[event]) return;
    
    const idx = listeners.value[event].indexOf(callback);
    if (idx > -1) {
      listeners.value[event].splice(idx, 1);
    }
    
    // Очистка пустых массивов
    if (listeners.value[event].length === 0) {
      delete listeners.value[event];
    }
  },
  
  // Вызов события с передачей данных
  emit(event, data) {
    if (!listeners.value[event]) return;
    
    listeners.value[event].forEach(callback => {
      callback(data);
    });
  }
}; 