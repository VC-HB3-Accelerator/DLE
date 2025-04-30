export const isLocalStorageAvailable = () => {
  try {
    const test = '__storage_test__';
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch (e) {
    console.error('localStorage is not available:', e);
    return false;
  }
};

export const getFromStorage = (key, defaultValue = null) => {
  if (!isLocalStorageAvailable()) return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    // Пытаемся распарсить JSON, если не получается - возвращаем как есть или defaultValue
    try {
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        return item || defaultValue;
    }
  } catch (e) {
    console.error(`Error getting ${key} from localStorage:`, e);
    return defaultValue;
  }
};

export const setToStorage = (key, value) => {
  if (!isLocalStorageAvailable()) return false;
  try {
    // Сериализуем объекты и массивы в JSON
    const valueToStore = typeof value === 'object' || Array.isArray(value)
      ? JSON.stringify(value)
      : value;
    window.localStorage.setItem(key, valueToStore);
    return true;
  } catch (e) {
    console.error(`Error setting ${key} in localStorage:`, e);
    return false;
  }
};

export const removeFromStorage = (key) => {
  if (!isLocalStorageAvailable()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error(`Error removing ${key} from localStorage:`, e);
    return false;
  }
}; 