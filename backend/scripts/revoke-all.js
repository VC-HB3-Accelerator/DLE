const hre = require("hardhat");

async function main() {
  const accessToken = await hre.ethers.getContractAt(
    "AccessToken",
    "0xF352c498cF0857F472dC473E4Dd39551E79B1063"
  );

  // Отзываем все токены от 1 до 3
  for (let i = 1; i <= 3; i++) {
    try {
      const tx = await accessToken.revokeToken(i);
      await tx.wait();
      console.log(`Token ${i} revoked`);
    } catch (error) {
      console.log(`Token ${i} revoke error:`, error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 