const hre = require("hardhat");

const { ethers } = hre;
const initialSupply = 1000;      // 初始供应量

// 部署脚本
async function main() {

  [account1, account2] = await ethers.getSigners();
  console.log([account1, account2], '===accounts===');

  // 获取合约工厂（用于部署合约）
  const ERC20 = await ethers.getContractFactory("ERC20");
  
  // 部署合约（若有构造函数参数，需在此处传入，如 MyERC20.deploy("参数1", "参数2")）
  const erc20Contract = await ERC20.deploy("ERC20", "ISR", initialSupply);

  erc20Contract.waitForDeployment();

  // 输出合约地址
  console.log(`ERC20 已部署到 Sepolia 测试网：${erc20Contract.target}`);
}

// 执行部署并处理错误
main().catch((error) => {
  console.error("部署失败：", error);
  process.exitCode = 1;
});