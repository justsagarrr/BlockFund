const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying BlockFundFactory...");

  const BlockFundFactory = await hre.ethers.getContractFactory("BlockFundFactory");
  const factory = await BlockFundFactory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log(`BlockFundFactory deployed to: ${factoryAddress}`);

  // Save contract address to frontend
  const contractsDir = path.join(__dirname, "..", "src", "contracts");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  const addressesPath = path.join(contractsDir, "contractAddresses.json");
  fs.writeFileSync(
    addressesPath,
    JSON.stringify({ BlockFundFactory: factoryAddress }, null, 2)
  );
  console.log(`Contract address saved to ${addressesPath}`);

  // Copy ABIs to frontend
  const factoryArtifact = path.join(
    __dirname, "..", "artifacts", "contracts", "BlockFundFactory.sol", "BlockFundFactory.json"
  );
  const campaignArtifact = path.join(
    __dirname, "..", "artifacts", "contracts", "Campaign.sol", "Campaign.json"
  );

  if (fs.existsSync(factoryArtifact)) {
    fs.copyFileSync(factoryArtifact, path.join(contractsDir, "BlockFundFactory.json"));
    console.log("BlockFundFactory ABI copied.");
  }

  if (fs.existsSync(campaignArtifact)) {
    fs.copyFileSync(campaignArtifact, path.join(contractsDir, "Campaign.json"));
    console.log("Campaign ABI copied.");
  }

  console.log("Deployment complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
