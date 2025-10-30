const { ethers, upgrades } = require("hardhat")
const fs = require("fs")
const path = require("path")

async function main() {
    const { save } = deployments;
    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("部署用户地址：:", deployer.address);

    // 读取 .cache/proxyNftAuction.json文件
    const storePath = path.resolve(__dirname, "./.cache/proxyNftAuction.json");
    const storeData = fs.readFileSync(storePath, "utf-8");
    const { proxyAddress, implAddress, abi } = JSON.parse(storeData);
    console.log("原代理合约地址：", proxyAddress);
    console.log("原实现合约地址：", implAddress);

    // 升级版的业务合约
    const NftAuctionV2 = await ethers.getContractFactory("NFTAuctionV2")

    // 升级代理合约
    const nftAuctionProxyV2 = await upgrades.upgradeProxy(proxyAddress, NftAuctionV2);
    await nftAuctionProxyV2.waitForDeployment();
    const proxyAddressV2 = await nftAuctionProxyV2.getAddress();
    console.log("升级后的代理合约地址：", proxyAddressV2);  // 代理合约地址是不会变的
    const implAddressV2 = await upgrades.erc1967.getImplementationAddress(proxyAddressV2)
    console.log("升级后实现合约地址：", implAddressV2);     // 只有实现合约地址会变

    // 保存合约地址到文件
    const storePathV2 = path.resolve(__dirname, "./.cache/proxyNftAuctionV2.json");
    fs.writeFileSync(
        storePathV2,
        JSON.stringify({
            proxyAddressV2,
            implAddressV2,
            abi: NftAuctionV2.interface.format("json"),
        })
    );
    await save("NFTAuctionProxyV2", {
        abi: NFTAuction.interface.format("json"),
        address: proxyAddressV2,
    })
}

// 执行部署并处理错误
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });