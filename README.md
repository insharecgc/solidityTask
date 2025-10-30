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


## 编译合约
```shell
npx hardhat compile
```
## 测试ERC20合约
```shell
npx hardhat test ./test/ERC20.js
```

## ERC20、NFT 部署合约到 Sepolia 测试网
```shell
npx hardhat run ./contracts/deploy/deploy_ERC20.js --network sepolia
```


# ---------------------实现一个 NFT 拍卖市场-----------------------
### 任务目标
1. 使用 Hardhat 框架开发一个 NFT 拍卖市场。
2. 使用 Chainlink 的 feedData 预言机功能，计算 ERC20 和以太坊到美元的价格。
3. 使用 UUPS/透明代理模式实现合约升级。
4. 使用类似于 Uniswap V2 的工厂模式管理每场拍卖。


## 任务步骤
### 项目初始化
1. 使用 Hardhat 初始化项目： npx hardhat init
2. 安装必要的依赖： 
```shell
npm install @openzeppelin/contracts @chainlink/contracts @nomiclabs/hardhat-ethers hardhat-deploy
```

## ---------------------本地测试-----------------------

### 本地测试拍卖合约
```shell
npx hardhat test ./test/auction_local.js --network localhost
```

### 这个是模拟USDC和喂价器完整测试功能
```shell
npx hardhat test ./test/localAuction_local.js --network localhost
```  

## ---------------------sepolia网测试-----------------------

### 部署NFT合约到 Sepolia 测试网
```shell
npx hardhat run ./contracts/deploy/deploy_NFT.js --network sepolia
```
需要记录下NFT合约的地址，后面测试拍卖合约需要用到

### 拍卖和工厂合约部署到 Sepolia 测试网
```shell
npx hardhat run ./contracts/deploy/deploy_auction.js --network sepolia
```

### Sepolia 测试网测试拍卖合约（测试前需要先部署NFT和拍卖合约到sepolia以上两条）
拍卖合约部署后成功后，会在 ./contracts/deploy/.cache目录下生成部署成功地址文件 <br>
proxyNftAuction.json和proxyNftAuctionFactory.json两个文件 <br>
分别是拍卖合约和拍卖工厂合约的地址 <br><br>
需要取拍卖合约的 implAddress（实现地址）和工厂合约下的 proxyFactoryAddress（工厂代理地址）<br>
设置到./test/auction_sepolia.js文件中 <br><br>
同时此文件还需要配置测试的nft地址，nft需要由deployer这个用户部署的<br>
设置自己的账户sep_owner（即deployer），sep_user1（用户地址1），sep_user2（用户地址2，确保你的用户2地址拥有1USDC以上）<br><br>

最后需要在根目录下创建.env文件，配置好sepolia的key和三个账户的私钥 <br>
最后执行：
```shell
npx hardhat test ./test/auction_sepolia.js --network sepolia
```

### sepolia测试比较慢，需要耐心等待await tx.wait(3);等待3个区块确认了才能正常后续查询

