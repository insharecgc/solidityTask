const hre = require("hardhat");

const { ethers } = hre;

// 部署脚本
async function main() {

  [account1, account2] = await ethers.getSigners();
  console.log([account1, account2], '===accounts===');

  // 获取合约工厂（用于部署合约）
  const NFT = await ethers.getContractFactory("NFT");
  
  // 部署合约（若有构造函数参数，需在此处传入）
  const myNft = await NFT.deploy("ISRNFT", "ISRNFT");

  myNft.waitForDeployment();

  // 输出合约地址
  console.log(`NFT 已部署到 Sepolia 测试网：${myNft.target}`);
}

// 执行部署并处理错误
main().catch((error) => {
  console.error("部署失败：", error);
  process.exitCode = 1;
});