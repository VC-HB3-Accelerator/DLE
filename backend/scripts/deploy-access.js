const hre = require('hardhat');

async function main() {
  const AccessToken = await hre.ethers.getContractFactory('AccessToken');
  const accessToken = await AccessToken.deploy();
  await accessToken.waitForDeployment();

  const address = await accessToken.getAddress();
  console.log('AccessToken deployed to:', address);

  // Создаем первый админский токен для владельца контракта
  const [owner] = await hre.ethers.getSigners();
  const tx = await accessToken.mintAccessToken(owner.address, 0); // 0 = ADMIN
  await tx.wait();
  console.log('Admin token minted for:', owner.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
