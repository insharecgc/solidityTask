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

# ERC20 Token 部署合约到 Sepolia 测试网
npx hardhat run ./deploy_scripts/ERC20.js --network sepolia