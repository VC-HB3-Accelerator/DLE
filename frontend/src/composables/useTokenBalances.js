import { ref, watch, onUnmounted } from 'vue';
import { fetchTokenBalances } from '../services/tokens';
import { useAuth } from './useAuth'; // Предполагаем, что useAuth предоставляет identities

export function useTokenBalances() {
  const auth = useAuth(); // Получаем доступ к состоянию аутентификации
  const tokenBalances = ref({
    eth: '0',
    bsc: '0',
    arbitrum: '0',
    polygon: '0',
  });
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
          console.log('[useTokenBalances] Запрос балансов для адреса:', walletAddress);
          const balances = await fetchTokenBalances(walletAddress);
          console.log('[useTokenBalances] Полученные балансы:', balances);
          tokenBalances.value = {
            eth: balances.eth || '0',
            bsc: balances.bsc || '0',
            arbitrum: balances.arbitrum || '0',
            polygon: balances.polygon || '0',
          };
          console.log('[useTokenBalances] Обновленные балансы:', tokenBalances.value);
        } catch (error) {
          console.error('[useTokenBalances] Ошибка при обновлении балансов:', error);
          // Возможно, стоит сбросить балансы при ошибке
          tokenBalances.value = { eth: '0', bsc: '0', arbitrum: '0', polygon: '0' };
        }
      } else {
        console.log('[useTokenBalances] Не найден адрес кошелька для запроса балансов.');
        tokenBalances.value = { eth: '0', bsc: '0', arbitrum: '0', polygon: '0' };
      }
    } else {
      console.log('[useTokenBalances] Пользователь не аутентифицирован, сброс балансов.');
      tokenBalances.value = { eth: '0', bsc: '0', arbitrum: '0', polygon: '0' };
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
        tokenBalances.value = { eth: '0', bsc: '0', arbitrum: '0', polygon: '0' };
      }
    },
    { immediate: true } // Запустить проверку сразу при инициализации
  );

  // Остановка интервала при размонтировании
  onUnmounted(() => {
    stopBalanceUpdates();
  });

  return {
    tokenBalances,
    updateBalances,
    startBalanceUpdates, // Можно не экспортировать, если управление полностью автоматическое
    stopBalanceUpdates, // Можно не экспортировать
  };
} 