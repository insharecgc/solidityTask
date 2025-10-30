const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Local Test LocalAuction", async function () {
    this.timeout(60 * 1000); // 设置超时为1分钟
    let nft;
    let usdc;
    let auctionProxy;
    let auctionFactoryProxy;
    let factoryImplAddress;
    let deployer;
    let user1;
    let user2;
    let user3;
    let tokenId;
    beforeEach(async function () {
        // 获取部署者账户
        [deployer, user1, user2, user3] = await ethers.getSigners();
        console.log("Deployer、user1、user2、user3", deployer.address, user1.address, user2.address, user3.address);
        // 1.1部署NFT合约
        const NFT = await ethers.getContractFactory("NFT");
        nft = await NFT.deploy("MyNFT", "MyNFT");
        await nft.waitForDeployment();
        console.log("NFT deployed to:", nft.target);
        // 为部署者mint一个NFT
        await nft.connect(deployer).mint(deployer.address, 1, "https://ipfs.io/ipfs/bafkreihyf3rp64dmhmrlionfmbw22rnvckslwylecsxeshuyafoj6fpmmu");
        console.log("Minted NFT to deployer success");

        // 1.2部署USDC合约
        const USDC = await ethers.getContractFactory("USDC");
        usdc = await USDC.deploy();
        await usdc.waitForDeployment();
        console.log("USDC deployed to:", usdc.target);
        // 给用户mint一些USDC
        await usdc.connect(deployer).mint(user1.address, ethers.parseUnits("1000", 6)); // mint 1000 USDC给user1，USDC有6位小数
        await usdc.connect(deployer).mint(user2.address, ethers.parseUnits("1000", 6)); // mint 1000 USDC给user2，USDC有6位小数
        await usdc.connect(deployer).mint(user3.address, ethers.parseUnits("1000", 6)); // mint 1000 USDC给user3，USDC有6位小数
        console.log("Minted USDC to deployer success");

        // 2.部署拍卖合约
        const LocalAuction = await ethers.getContractFactory("LocalAuction");
        auctionProxy = await upgrades.deployProxy(LocalAuction,
            [usdc.target, deployer.address, nft.target, 1, 10000, 1, ethers.ZeroAddress, ethers.ZeroAddress, 0],
            { initializer: "initialize" }
        );
        await auctionProxy.waitForDeployment();
        console.log("LocalAuction deployed to:", auctionProxy.target);
        const proxyAddress = await auctionProxy.getAddress();
        console.log("LocalAuction 代理合约地址：", proxyAddress);
        const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        console.log("LocalAuction 实现合约地址：", implAddress);

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
        const LocalAuctionFactory = await ethers.getContractFactory("LocalAuctionFactory");
        auctionFactoryProxy = await upgrades.deployProxy(LocalAuctionFactory,
            [
                implAddress,
                deployer.address,
                600, // 6%手续费
            ],
            { initializer: "initialize" }
        );
        await auctionFactoryProxy.waitForDeployment();
        console.log("LocalAuctionFactory deployed to:", auctionFactoryProxy.target);
        const factoryProxyAddress = await auctionFactoryProxy.getAddress()
        console.log("LocalAuctionFactory 代理合约地址：", factoryProxyAddress);
        factoryImplAddress = await upgrades.erc1967.getImplementationAddress(factoryProxyAddress);
        console.log("LocalAuctionFactory 实现合约地址：", factoryImplAddress);

        // 给用户1 mint一个NFT
        tokenId = 10;
        await nft.connect(deployer).mint(user1.address, tokenId, "https://ipfs.io/ipfs/bafkreihyf3rp64dmhmrlionfmbw22rnvckslwylecsxeshuyafoj6fpmmu");
        console.log("Minted NFT to user1 success");

    });

    describe("User 1 Create Auction", function () {
        it("Should create a new auction successfully", async function () {
            // 未授权时，getApproved 返回零地址
            let approvedAddress = await nft.getApproved(tokenId)
            expect(approvedAddress).to.equal(ethers.ZeroAddress);
            console.log("Testing create auctionFactoryProxy...", auctionFactoryProxy.target);
            // 用户1授权拍卖工厂合约转移NFT
            await nft.connect(user1).approve(auctionFactoryProxy.target, tokenId);
            console.log("Approved NFT to factory");
            // 验证授权地址
            approvedAddress = await nft.getApproved(tokenId)
            expect(approvedAddress).to.equal(auctionFactoryProxy.target);
            let owner = await nft.ownerOf(tokenId);
            console.log("NFT拍卖创建好之前，NFT的owner:", owner);

            // 监听合约创建成功事件
            const emittedEvent = new Promise((resolve) => {
                auctionFactoryProxy.once("AuctionCreated", (...args) => {
                    resolve(args);
                });
            });

            // 用户1用10号NFT创建拍卖，用ETH支付，持续10秒，起拍价1000000 wei (在创建拍卖合约前，需要上面的NFT合约授权拍卖工厂合约转移NFT)
            let tx = await auctionFactoryProxy.connect(user1).createAuction(usdc.target, nft.target, 10, 1000000, tokenId, ethers.ZeroAddress);
            await tx.wait();
            // 2. 获取创建的合约地址
            const nftAuction = await auctionFactoryProxy.getAuctionAddress(1);
            console.log("Auction created, address:", nftAuction);

            // 验证事件参数
            await expect(tx).to.emit(auctionFactoryProxy, "AuctionCreated")
                .withArgs(1, nftAuction, user1.address, nft.target, tokenId);
            // 得到合约创建事件的参数
            const [auctionId, auctionAddress, seller, nftContract, tokId] = await emittedEvent;
            console.log("Auction created, auctionId:", auctionId, "auctionAddress:", auctionAddress, "seller:", seller, "tokenId:", tokId);

            // 工厂合约创建了拍卖合约实例，根据得到的拍卖合约地址，调用getAuctionStatus方法，验证拍卖状态
            const LocalAuction = await ethers.getContractFactory("LocalAuction");
            const newAuction = await LocalAuction.attach(nftAuction);
            // const newAuction = await ethers.getContractAt("LocalAuction", nftAuction);     // 上面和这种方式都可以获取实例

            // 验证NFT的owner是否为拍卖合约地址
            owner = await nft.ownerOf(tokenId);
            console.log("NFT拍卖创建成功，NFT的owner:", owner);
            expect(owner).to.equal(nftAuction);

            try {
                let auctionInfo = await newAuction.getAuctionInfo();
                console.log("工厂创建的拍卖状态信息: ended =", auctionInfo.ended, ", highestBidder =", auctionInfo.highestBidder, ", highestBid =", auctionInfo.highestBid);
            } catch (error) {
                console.error("Error fetching auction info:", error);
            }

            // 授权拍卖合约使用USDC
            tx = await usdc.connect(user2).approve(newAuction.target, ethers.parseUnits("10", 6));
            await tx.wait();
            // 用户2 USDC出价
            console.log("User2 出价 10USDC");
            // 记录用户2 的USDC初始余额
            const user2BalanceInit = await usdc.balanceOf(user2.address);
            console.log("User2 出价前余额:", user2BalanceInit.toString());
            tx = await newAuction.connect(user2).placeBid(usdc.target, ethers.parseUnits("10", 6))
            await tx.wait();
            console.log("User2 出价成功");
            const user2BalanceBid = await usdc.balanceOf(user2.address);
            console.log("User2 出价后余额:", user2BalanceBid.toString());
            auctionInfo = await newAuction.getAuctionInfo();
            console.log("Highest bidder address:", auctionInfo.highestBidder, ", highestBid =", auctionInfo.highestBid, "payToken =", auctionInfo.payToken);
            // 验证用户2出价后拍卖状态，最高出价者应为用户2，最高出价为1最小单位 USDC(6位小数)
            expect(auctionInfo.ended).to.equal(false);
            expect(auctionInfo.highestBidder).to.equal(user2.address);
            expect(auctionInfo.highestBid).to.equal(ethers.parseUnits("10", 6));

            // 用户3 ETH 出价
            console.log("user3 出价 1 ETH");
            tx = await newAuction.connect(user3).placeBid(ethers.ZeroAddress, ethers.parseEther("1"), { value: ethers.parseEther("1") });
            await tx.wait();
            // 验证user3出价成功
            console.log("user3 出价成功");
            auctionInfo = await newAuction.getAuctionInfo();
            console.log("Highest bidder address:", auctionInfo.highestBidder, ", highestBid =", auctionInfo.highestBid);
            // 验证user3出价后拍卖状态，最高出价者应为user3，最高出价为 1 ETH
            expect(auctionInfo.ended).to.equal(false);
            expect(auctionInfo.highestBidder).to.equal(user3.address);
            expect(auctionInfo.highestBid).to.equal(ethers.parseEther("1"));

            // 验证10USDC被回退给user2
            const user2BalanceBack = await usdc.balanceOf(user2.address);
            console.log("User2 balance before refund:", user2BalanceBack.toString());
            expect(user2BalanceInit == user2BalanceBack).to.equal(true);

            // 记录拍卖结束前平台和用户1的ETH，用于后续验证
            const user1EthInit = await ethers.provider.getBalance(user1.address);            
            const platformEthInit = await ethers.provider.getBalance(deployer.address);            

            // 3秒后调用结束拍卖
            await sleep(9000);
            const endTx = await newAuction.endAuction();
            await endTx.wait();  // 等待交易确认

            // 验证NFT的owner是否为用户3
            owner = await nft.ownerOf(10);
            console.log("NFT拍卖结束后，NFT的owner:", owner);
            expect(owner).to.equal(user3.address);

            // 上面创建工厂合约，设置的手续费 6%
            // 验证用户收到 1*94% = 0.94ETH，允许存在0.0001误差
            console.log("User1 balance before auction ends:", user1EthInit.toString());
            const user1Eth = await ethers.provider.getBalance(user1.address);
            console.log("User1 balance after auction ends:", user1Eth.toString());
            expect(user1Eth - user1EthInit).to.be.closeTo(ethers.parseEther("0.94"), ethers.parseEther("0.0001"));

            // 验证平台方(deployer)收到 1*6% = 0.06ETH，允许存在0.0001误差
            console.log("Platform balance before auction ends:", platformEthInit.toString());
            const platformEth = await ethers.provider.getBalance(deployer.address);
            console.log("Platform balance after auction ends:", platformEth.toString());
            expect(platformEth - platformEthInit).to.be.closeTo(ethers.parseEther("0.06"), ethers.parseEther("0.0001"));
        });
    });
});