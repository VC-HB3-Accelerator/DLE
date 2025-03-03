const hre = require("hardhat");

async function main() {
  const accessToken = await hre.ethers.getContractAt(
    "AccessToken",
    "0xF352c498cF0857F472dC473E4Dd39551E79B1063" // Адрес нашего контракта
  );

  // Проверим текущего владельца
  const owner = await accessToken.owner();
  console.log("Contract owner:", owner);

  // Проверим роль владельца
  try {
    const ownerRole = await accessToken.checkRole(owner);
    console.log("Owner role:", ["ADMIN", "MODERATOR", "SUPPORT"][ownerRole]);
  } catch (error) {
    console.log("Owner role check error:", error.message);
  }

  // Создадим токен модератора для тестового адреса
  const moderatorAddress = "0xF45aa4917b3775bA37f48Aeb3dc1a943561e9e0B";
  try {
    const tx = await accessToken.mintAccessToken(moderatorAddress, 1); // 1 = MODERATOR
    await tx.wait();
    console.log(`Moderator token minted for ${moderatorAddress}`);

    // Проверим роль модератора
    const modRole = await accessToken.checkRole(moderatorAddress);
    console.log("Moderator role:", ["ADMIN", "MODERATOR", "SUPPORT"][modRole]);
  } catch (error) {
    console.log("Moderator token minting error:", error.message);
  }

  // Получим все активные токены (с ограничением по блокам)
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  const fromBlock = currentBlock - 1000; // Последние 1000 блоков
  
  const filter = accessToken.filters.Transfer(null, null, null);
  const events = await accessToken.queryFilter(filter, fromBlock);
  console.log("\nActive tokens (last 1000 blocks):");
  for (let event of events) {
    if (event.args.from === "0x0000000000000000000000000000000000000000") {
      console.log(`Token ID: ${event.args.tokenId}, Owner: ${event.args.to}`);
      try {
        const role = await accessToken.checkRole(event.args.to);
        console.log(`Role: ${["ADMIN", "MODERATOR", "SUPPORT"][role]}`);
      } catch (error) {
        console.log("Role check error:", error.message);
      }
    }
  }

  // Альтернативный способ - проверить конкретный токен
  console.log("\nChecking specific tokens:");
  for (let i = 1; i <= 2; i++) {
    try {
      const owner = await accessToken.ownerOf(i);
      const role = await accessToken.checkRole(owner);
      console.log(`Token ${i}: Owner ${owner}, Role: ${["ADMIN", "MODERATOR", "SUPPORT"][role]}`);
    } catch (error) {
      console.log(`Token ${i} not found or error:`, error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 