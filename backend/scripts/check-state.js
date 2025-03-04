const hre = require('hardhat');

async function main() {
  const accessToken = await hre.ethers.getContractAt(
    'AccessToken',
    '0xF352c498cF0857F472dC473E4Dd39551E79B1063'
  );

  const owner = await accessToken.owner();
  console.log('Contract owner:', owner);

  // Проверяем все токены и их владельцев
  console.log('\nAll tokens:');
  for (let i = 1; i <= 10; i++) {
    try {
      const tokenOwner = await accessToken.ownerOf(i);
      console.log(`Token ${i} owner: ${tokenOwner}`);
    } catch (error) {
      if (!error.message.includes('invalid token ID')) {
        console.log(`Token ${i} error:`, error.message);
      }
    }
  }

  // Проверяем активные токены для всех известных адресов
  const addresses = [owner, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'];

  console.log('\nActive tokens:');
  for (const address of addresses) {
    const activeToken = await accessToken.activeTokens(address);
    console.log(`${address}: Token ${activeToken.toString()}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
