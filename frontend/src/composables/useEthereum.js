import { ref } from 'vue';

export function useEthereum() {
  const address = ref('');
  const isConnected = ref(true);

  async function connect() {
    console.log('Имитация подключения к кошельку');
    return { success: true };
  }

  async function getContract() {
    console.log('Имитация получения контракта');
    return {};
  }

  return {
    address,
    isConnected,
    connect,
    getContract,
  };
}
