import { ref, watch, onUnmounted } from 'vue';
import { fetchTokenBalances } from '../services/tokens';
import { useAuth } from './useAuth'; // Предполагаем, что useAuth предоставляет identities
import eventBus from '../utils/eventBus';

export function useTokenBalances() {
  const auth = useAuth(); // Получаем доступ к состоянию аутентификации
  const tokenBalances = ref([]); // теперь массив объектов
  const isLoadingTokens = ref(false);
  let balanceUpdateInterval = null;

  const getIdentityValue = (type) => {
    if (!auth.identities?.value) return null;
    const identity = auth.identities.value.find((identity) => identity.provider === type);
    return identity ? identity.provider_id : null;
  };

  const updateBalances = async () => {
    if (auth.isAuthenticated.value) {
      const walletAddress = auth.address?.value || getIdentityValue('wallet');
      if (walletAddress) {
        try {
          isLoadingTokens.value = true;
          console.log('[useTokenBalances] Запрос балансов для адреса:', walletAddress);
          const response = await fetchTokenBalances(walletAddress);
          // Ожидаем, что response — это массив объектов
          tokenBalances.value = Array.isArray(response) ? response : (response?.data || []);
          console.log('[useTokenBalances] Обновленные балансы:', tokenBalances.value);
        } catch (error) {
          console.error('[useTokenBalances] Ошибка при обновлении балансов:', error);
          tokenBalances.value = [];
        } finally {
          isLoadingTokens.value = false;
        }
      } else {
        console.log('[useTokenBalances] Не найден адрес кошелька для запроса балансов.');
        tokenBalances.value = [];
      }
    } else {
      console.log('[useTokenBalances] Пользователь не аутентифицирован, сброс балансов.');
      tokenBalances.value = [];
    }
  };

  const startBalanceUpdates = (intervalMs = 300000) => {
    stopBalanceUpdates(); // Остановить предыдущий интервал, если он был
    console.log('[useTokenBalances] Запуск обновления балансов...');
    updateBalances(); // Обновить сразу
    balanceUpdateInterval = setInterval(updateBalances, intervalMs);
  };

  const stopBalanceUpdates = () => {
    if (balanceUpdateInterval) {
      console.log('[useTokenBalances] Остановка обновления балансов.');
      clearInterval(balanceUpdateInterval);
      balanceUpdateInterval = null;
    }
  };

  // Следим за аутентификацией и наличием кошелька
  watch(
    () => [auth.isAuthenticated.value, auth.address?.value, getIdentityValue('wallet')],
    ([isAuth, directAddress, identityAddress]) => {
      const hasWallet = directAddress || identityAddress;
      if (isAuth && hasWallet) {
        // Если пользователь аутентифицирован, имеет кошелек, и интервал не запущен
        if (!balanceUpdateInterval) {
            startBalanceUpdates();
        }
        // Если адрес изменился, принудительно обновить
        // updateBalances(); // Убрал, т.к. startBalanceUpdates уже вызывает updateBalances()
      } else if (!isAuth || !hasWallet) {
        // Если пользователь вышел, отвязал кошелек, или не аутентифицирован
        stopBalanceUpdates();
        // Сбрасываем балансы
        tokenBalances.value = [];
      }
    },
    { immediate: true } // Запустить проверку сразу при инициализации
  );

  // Подписываемся на событие для обновления баланса после сохранения настроек
  const unsubscribe = eventBus.on('auth-settings-saved', () => {
    console.log('[useTokenBalances] Получено событие сохранения настроек, обновляем балансы');
    updateBalances();
  });

  // Остановка интервала и отписки при размонтировании
  onUnmounted(() => {
    stopBalanceUpdates();
    if (unsubscribe) {
      unsubscribe();
    }
  });

  return {
    tokenBalances,
    isLoadingTokens,
    updateBalances,
    startBalanceUpdates,
    stopBalanceUpdates,
  };
} 