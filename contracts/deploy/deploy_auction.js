// 部署脚本：部署拍卖合约和拍卖工厂合约
const { ethers, upgrades, deployments } = require("hardhat");

const fs = require("fs");
const path = require("path");

async function main() {
    const { save } = deployments;
    // 获取部署者账户
    const [deployer] = await ethers.getSigners(); 
    console.log("部署用户地址：:", deployer.address);
    
    console.log("开始部署拍卖代理合约...");
    const nftContract = "0xB283Ff12d5961b20Ff22a0509081BD6763509395";
    const tokenId = 4;
    // 通过代理合约部署拍卖合约
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    const nftAuctionProxy = await upgrades.deployProxy(NFTAuction, [deployer.address, nftContract, 10, 10000, tokenId, ethers.ZeroAddress, ethers.ZeroAddress, 0], {
        initializer: "initialize",
    })
    await nftAuctionProxy.waitForDeployment();  // 等待部署完成
    const proxyAddress = await nftAuctionProxy.getAddress()
    console.log("拍卖代理合约地址：", proxyAddress);
    const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress)
    console.log("拍卖实现合约地址：", implAddress);

    // 保存合约地址到文件
    const storePath = path.resolve(__dirname, "./.cache/proxyNftAuction2.json");
    fs.writeFileSync(
        storePath,
        JSON.stringify({
            proxyAddress,
            implAddress,
            abi: NFTAuction.interface.format("json"),
        })
    );
    await save("NFTAuctionProxy", {
        abi: NFTAuction.interface.format("json"),
        address: proxyAddress,
    })
    console.log("代理拍卖合约部署完成，信息保存成功");

    // ----------------------------------------------------------------------------

    // 通过代理合约部署拍卖工厂合约 （需要先把拍卖合约部署好，然后取得拍卖合约的代理地址，作为第一个参数）
    // console.log("开始部署拍卖工厂代理合约...")
    // proxyAddress = "0xe019f9D778a568007A50abdCB4615D12e2B81B47"    // 上面部署成功的拍卖合约代理地址
    // const NFTAuctionFactory = await ethers.getContractFactory("NFTAuctionFactory");
    // const nftAuctionFactoryProxy = await upgrades.deployProxy(NFTAuctionFactory, [proxyAddress, deployer.address, 600], {
    //     initializer: "initialize",
    // })
    // await nftAuctionFactoryProxy.waitForDeployment();  // 等待部署完成
    // const proxyFactoryAddress = await nftAuctionFactoryProxy.getAddress()
    // console.log("拍卖工厂代理合约地址：", proxyFactoryAddress);
    // const implFactoryAddress = await upgrades.erc1967.getImplementationAddress(proxyFactoryAddress)
    // console.log("拍卖工厂实现合约地址：", implFactoryAddress);

    // // 保存合约地址到文件
    // const storePath2 = path.resolve(__dirname, "./.cache/proxyNftAuctionFactory.json");
    // fs.writeFileSync(
    //     storePath2,
    //     JSON.stringify({
    //         proxyFactoryAddress,
    //         implFactoryAddress,
    //         abi: NFTAuctionFactory.interface.format("json"),
    //     })
    // );
    // await save("NFTAuctionFactoryProxy", {
    //     abi: NFTAuctionFactory.interface.format("json"),
    //     address: proxyFactoryAddress,
    // })
    // console.log("代理拍卖工厂合约部署完成，信息保存成功");

}


// 执行部署并处理错误
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });