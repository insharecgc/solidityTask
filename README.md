# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.js
```


# 编译合约
npx hardhat compile

# 测试ERC20合约
npx hardhat test ./test/ERC20.js

# ERC20、NFT 部署合约到 Sepolia 测试网
npx hardhat run ./contracts/deploy/deploy_ERC20.js --network sepolia
npx hardhat run ./contracts/deploy/deploy_ERC20.js --network sepolia


# 清理缓存目录
npx hardhat clean


### 实现一个 NFT 拍卖市场
任务目标
1. 使用 Hardhat 框架开发一个 NFT 拍卖市场。
2. 使用 Chainlink 的 feedData 预言机功能，计算 ERC20 和以太坊到美元的价格。
3. 使用 UUPS/透明代理模式实现合约升级。
4. 使用类似于 Uniswap V2 的工厂模式管理每场拍卖。


### 任务步骤
# 项目初始化
1. 使用 Hardhat 初始化项目： npx hardhat init
2. 安装必要的依赖： npm install @openzeppelin/contracts @chainlink/contracts @nomiclabs/hardhat-ethers hardhat-deploy

# 拍卖合约部署到 Sepolia 测试网
npx hardhat run ./contracts/deploy/deploy_auction.js --network sepolia

# 本地测试拍卖合约
npx hardhat test ./test/auction_local.js --network localhost

# Sepolia 测试网测试拍卖合约
npx hardhat test ./test/auction_sepolia.js --network sepolia
