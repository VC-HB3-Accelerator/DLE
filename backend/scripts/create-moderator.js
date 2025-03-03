const hre = require("hardhat");

async function main() {
  const accessToken = await hre.ethers.getContractAt(
    "AccessToken",
    "0xF352c498cF0857F472dC473E4Dd39551E79B1063"
  );

  const moderatorAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  
  try {
    console.log("\nMinting moderator token...");
    const mintTx = await accessToken.mintAccessToken(moderatorAddress, 1); // MODERATOR
    console.log("Waiting for transaction:", mintTx.hash);
    await mintTx.wait();
    console.log("Moderator token minted");

    // Проверяем результат
    const activeToken = await accessToken.activeTokens(moderatorAddress);
    console.log(`Moderator's active token: ${activeToken}`);

    const role = await accessToken.checkRole(moderatorAddress);
    console.log(`Moderator role: ${["ADMIN", "MODERATOR", "SUPPORT"][role]}`);
  } catch (error) {
    console.log("Moderator token minting error:", error.message);
  }

  // Проверяем все активные токены
  console.log("\nAll active tokens:");
  const addresses = [
    await accessToken.owner(),
    moderatorAddress
  ];

  for (const address of addresses) {
    try {
      const activeToken = await accessToken.activeTokens(address);
      const role = await accessToken.checkRole(address);
      console.log(`${address}: Token ${activeToken}, Role: ${["ADMIN", "MODERATOR", "SUPPORT"][role]}`);
    } catch (error) {
      console.log(`${address}: ${error.message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  }); 