const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Local Test NFTAuction", async function () {
    let nft;
    let auctionProxy;
    let auctionFactoryProxy;
    let factoryImplAddress;
    let deployer;
    let user1;
    let user2;
    beforeEach(async function () {
        // 获取部署者账户
        [deployer, user1, user2] = await ethers.getSigners();
        console.log("Deployer address、user1 address、user2 address", deployer.address, user1.address, user2.address);
        // 1.部署NFT合约
        const NFT = await ethers.getContractFactory("NFT");
        nft = await NFT.deploy("MyNFT", "MyNFT");
        await nft.waitForDeployment();
        console.log("NFT deployed to:", nft.target);
        // 为部署者mint一个NFT
        await nft.connect(deployer).mint(deployer.address, 1, "https://ipfs.io/ipfs/bafkreihyf3rp64dmhmrlionfmbw22rnvckslwylecsxeshuyafoj6fpmmu");
        console.log("Minted NFT to deployer success");

        // 2.部署拍卖合约
        const NFTAuction = await ethers.getContractFactory("NFTAuction");
        auctionProxy = await upgrades.deployProxy(NFTAuction,
            [deployer.address, nft.target, 1, 10000, 1, ethers.ZeroAddress, ethers.ZeroAddress, 0],
            { initializer: "initialize" }
        );
        await auctionProxy.waitForDeployment();
        console.log("NFTAuction deployed to:", auctionProxy.target);
        const proxyAddress = await auctionProxy.getAddress();
        console.log("NFTAuction代理合约地址：", proxyAddress);
        const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        console.log("NFTAuction实现合约地址：", implAddress);

        // 这里需要调用把nft转移到拍卖合约地址，模拟拍卖开始前的准备工作（工厂模式，是先授权nft给工厂，然后由工厂转移nft到拍卖合约）
        const nftTx = await nft.connect(deployer).transferFrom(deployer.address, proxyAddress, 1);
        await nftTx.wait();

        let auctionInfo = await auctionProxy.getAuctionInfo();
        console.log("查询拍卖状态信息: ended =", auctionInfo.ended, ", seller =", auctionInfo.seller, "tokenId =", auctionInfo.tokenId, ", highestBid =", auctionInfo.highestBid);

        await sleep(1000);
        // 调用结束拍卖，确保拍卖已结束
        const endTx = await auctionProxy.endAuction();
        await endTx.wait();

        // 再次查询拍卖状态
        auctionInfo = await auctionProxy.getAuctionInfo();
        console.log("拍卖结束后查询拍卖状态信息: ended =", auctionInfo.ended, ", seller =", auctionInfo.seller, "tokenId =", auctionInfo.tokenId, ", highestBid =", auctionInfo.highestBid);

        // 3.部署拍卖工厂合约（调用initialize，要用到上面拍卖合约的代理合约地址）
        const NFTAuctionFactory = await ethers.getContractFactory("NFTAuctionFactory");
        auctionFactoryProxy = await upgrades.deployProxy(NFTAuctionFactory,
            [
                implAddress,
                deployer.address,
                600, // 6%手续费
            ],
            { initializer: "initialize" }
        );
        await auctionFactoryProxy.waitForDeployment();
        console.log("NFTAuctionFactory deployed to:", auctionFactoryProxy.target);
        const factoryProxyAddress = await auctionFactoryProxy.getAddress()
        console.log("NFTAuctionFactory代理合约地址：", factoryProxyAddress);
        factoryImplAddress = await upgrades.erc1967.getImplementationAddress(factoryProxyAddress);
        console.log("NFTAuctionFactory实现合约地址：", factoryImplAddress);

        // 给用户1 mint一个NFT
        await nft.connect(deployer).mint(user1.address, 10, "https://ipfs.io/ipfs/bafkreihyf3rp64dmhmrlionfmbw22rnvckslwylecsxeshuyafoj6fpmmu");
        console.log("Minted NFT to user1 success");

    });

    describe("User 1 Create Auction", function () {
        it("Should create a new auction successfully", async function () {
            // 未授权时，getApproved 返回零地址
            let approvedAddress = await nft.getApproved(10)
            expect(approvedAddress).to.equal(ethers.ZeroAddress);
            console.log("Testing create auctionFactoryProxy...", auctionFactoryProxy.target);
            // 用户1授权拍卖工厂合约转移NFT
            await nft.connect(user1).approve(auctionFactoryProxy.target, 10);
            console.log("Approved NFT to factory");
            // 验证授权地址
            approvedAddress = await nft.getApproved(10)
            expect(approvedAddress).to.equal(auctionFactoryProxy.target);
            let owner = await nft.ownerOf(10);
            console.log("NFT拍卖创建好之前，NFT的owner:", owner);

            // 监听合约创建成功事件
            const emittedEvent = new Promise((resolve) => {
                auctionFactoryProxy.once("AuctionCreated", (...args) => {
                    resolve(args);
                });
            });

            // 用户1用10号NFT创建拍卖，用ETH支付，持续2秒，起拍价1000000 wei (在创建拍卖合约前，需要上面的NFT合约授权拍卖工厂合约转移NFT)
            let tx = await auctionFactoryProxy.connect(user1).createAuction(nft.target, 2, 1000000, 10, ethers.ZeroAddress);
            await tx.wait();
            // 2. 获取创建的合约地址
            const nftAuction = await auctionFactoryProxy.getAuctionAddress(1);
            console.log("Auction created, address:", nftAuction);

            // 验证事件参数
            await expect(tx).to.emit(auctionFactoryProxy, "AuctionCreated")
                .withArgs(1, nftAuction, user1.address, nft.target, 10);
            // 得到合约创建事件的参数
            const [auctionId, auctionAddress, seller, tokenId, duration] = await emittedEvent;
            console.log("Auction created, auctionId:", auctionId, "auctionAddress:", auctionAddress, "seller:", seller, "tokenId:", tokenId, "duration:", duration);

            // 工厂合约创建了拍卖合约实例，根据得到的拍卖合约地址，调用getAuctionStatus方法，验证拍卖状态
            const NFTAuction = await ethers.getContractFactory("NFTAuction");
            const newAuction = await NFTAuction.attach(nftAuction);
            // const newAuction = await ethers.getContractAt("NFTAuction", nftAuction);     // 上面和这种方式都可以获取实例

            // 验证NFT的owner是否为拍卖合约地址
            owner = await nft.ownerOf(10);
            console.log("NFT拍卖创建成功，NFT的owner:", owner);
            expect(owner).to.equal(nftAuction);

            try {
                // TODO: 这里调用getAuctionInfo报错，提示ABI错误，需要确认下原因 ????????????????????????                
                let auctionInfo = await newAuction.getAuctionInfo();
                console.log("工厂创建的拍卖状态信息: ended =", auctionInfo.ended, ", highestBidder =", auctionInfo.highestBidder, ", highestBid =", auctionInfo.highestBid);
            } catch (error) {
                console.error("Error fetching auction info:", error);
            }

            // 3秒后调用结束拍卖，验证NFT被回退到用户1地址
            await sleep(3000);
            const endTx = await newAuction.endAuction();
            await endTx.wait();  // 等待交易确认

            owner = await nft.ownerOf(10);
            console.log("NFT拍卖结束后，NFT的owner:", owner);
            expect(owner).to.equal(user1.address);
        });
    });
});