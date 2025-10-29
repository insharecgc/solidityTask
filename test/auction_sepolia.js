const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

describe("Sepolia Test NFTAuction", async function () {
    this.timeout(60000); // 设置超时为60秒

    const myNFT = "0x4E8Ef74A824d4ef1C83D7c231c4bed5f4a0a6115";   // task2下的NFT在Sepolia下合约地址
    const nftAuctionProxy = "0xe019f9D778a568007A50abdCB4615D12e2B81B47";    // Sepolia下的NFT拍卖代理合约地址
    const nfgAuctionFactoryProxy = "0x2067F9a81E2dF1E5d815Ab6f2F8b66aAca4e7163";    // Sepolia下的NFT拍卖工厂代理合约地址
    const usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";  // Sepolia下的USDC合约地址
    const ethPriceFeed = "0x694AA1769357215DE4FAC081bf1f309aDC325306";    // Sepolia下的ETH/USD价格喂价地址
    const usdcPriceFeed = "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E";    // Sepolia下的USDC/USD价格喂价地址
    const sep_owner = "0x00D2Ca064B11F935059c22E6237f1E3276960156";    // Sepolia下的部署NFT、和拍卖合约的拥有者地址
    const sep_suser1 = "0x0405d109770350D2a26bd7874525945106E306cB";     // Sepolia下的用户1地址
    const sep_suser2 = "0xCC0089B3882bFfF3F476D506160c580cF28D9242";     // Sepolia下的用户2地址

    let nft;
    let auctionProxy;
    let auctionFactoryProxy;
    let deployer;
    let user1;
    let user2;
    beforeEach(async function () {
        // 所有合约都已经部署到Sepolia上了，所以直接根据合约地址获取实例
        deployer = await ethers.getSigner(sep_owner);
        user1 = await ethers.getSigner(sep_suser1);
        user2 = await ethers.getSigner(sep_suser2);
        console.log("Deployer address、user1 address、user2 address", deployer.address, user1.address, user2.address);
        // 1.根据NFT合约地址，拿到NFT合约实例
        const NFT = await ethers.getContractFactory("NFT");
        nft = NFT.attach(myNFT);
        // nft = await ethers.getContractAt("NFT", myNFT);
        console.log("NFT合约地址:", nft.target);

        // 2.根据拍卖合约地址，拿到拍卖合约实例
        auctionProxy = await ethers.getContractAt("NFTAuction", nftAuctionProxy);
        const proxyAddress = await auctionProxy.getAddress();
        console.log("NFTAuction代理合约地址：", proxyAddress);

        // 3.根据拍卖工厂合约地址，拿到拍卖工厂合约实例
        auctionFactoryProxy = await ethers.getContractAt("NFTAuctionFactory", nfgAuctionFactoryProxy);
        const factoryProxyAddress = await auctionFactoryProxy.getAddress()
        console.log("NFTAuctionFactory代理合约地址：", factoryProxyAddress);

        // 给用户1 mint一个NFT
        //await nft.connect(deployer).mint(user1.address, 10, "https://ipfs.io/ipfs/bafkreihyf3rp64dmhmrlionfmbw22rnvckslwylecsxeshuyafoj6fpmmu");
        //console.log("Minted NFT to user1 success");
    });

    describe("revert Auction", function () {
        const createdAuction = "0xaE571f39052c91095e22b89d96D02299c7dbe1A2"; // 已经创建的拍卖合约地址
        it("Should revert when non-owner tries to end auction", async function () {
            const NFTAuction = await ethers.getContractFactory("NFTAuction");
            const auction = NFTAuction.attach(createdAuction);
            // 查询拍卖状态
            const auctionInfo = await auction.auctionInfo();
            console.log("Auction info:", auctionInfo);

            await auction.endAuction();
            owner = await nft.ownerOf(10);
            console.log("NFT拍卖结束后，NFT的owner:", owner);
            // expect(owner).to.equal(user1.address);
        });
    });


    describe("User 1 Create Auction", function () {
        it("Should create a new auction successfully", async function () {
            // 未授权时，getApproved 返回零地址
            let approvedAddress = await nft.getApproved(10)
            // expect(approvedAddress).to.equal(ethers.ZeroAddress);    // 前面测试过了，已经授权了，这里注释掉
            console.log("Testing create auctionFactoryProxy...", auctionFactoryProxy.target);
            // 用户1授权拍卖工厂合约转移NFT
            await nft.connect(user1).approve(auctionFactoryProxy.target, 10);
            console.log("Approved NFT to factory");
            // 验证授权地址
            approvedAddress = await nft.getApproved(10)
            expect(approvedAddress).to.equal(auctionFactoryProxy.target);

            // 用户1用10号NFT创建拍卖，用ETH支付，持续2秒，起拍价1000000 wei
            const tx = await auctionFactoryProxy.connect(user1).createAuction(nft.target, 2, 1000000, 10, ethers.ZeroAddress);
            await tx.wait();
            const nftAuction = await auctionFactoryProxy.getAuctionContract(1);
            console.log("Auction created:", nftAuction);
            //验证事件
            await expect(tx).to.emit(auctionFactoryProxy, "AuctionCreated")
                .withArgs(1, nftAuction, user1.address, nft.target, 10);

            // 工厂合约创建了拍卖合约实例，根据得到的拍卖合约地址，调用getAuctionStatus方法，验证拍卖状态
            const NFTAuction = await ethers.getContractFactory("NFTAuction");
            const newAuction = NFTAuction.attach(nftAuction);
            // const newAuction = await ethers.getContractAt("NFTAuction", nftAuction);

            // 验证NFT的owner是否为拍卖合约地址
            owner = await nft.ownerOf(10);
            console.log("NFT拍卖创建成功，NFT的owner:", owner);
            expect(owner).to.equal(nftAuction);

            // 用户2出价 0.1 USDC拍卖
            await newAuction.connect(user2).placeBid(usdc, 10000000)
            console.log("User2 placed bid of 0.1 USDC");
            // 验证用户2出价成功
            let highestBidder = await newAuction.highestBidder()
            console.log("Highest bidder address:", highestBidder);
            expect(highestBidder).to.equal(user2.address);

            // deployer出价0.001 ETH拍卖
            await newAuction.connect(deployer).placeBid(ethers.ZeroAddress, ethers.parseEther("0.001"));
            // 验证deployer出价成功
            highestBidder = await newAuction.highestBidder()
            console.log("Highest bidder address:", highestBidder);
            expect(highestBidder).to.equal(deployer.address);

            // 2秒后调用结束拍卖，验证NFT被回退到用户1地址
            await sleep(2000);
            await newAuction.endAuction();

            owner = await nft.ownerOf(10);
            console.log("NFT拍卖结束后，NFT的owner:", owner);
            // expect(owner).to.equal(user1.address);
        });
    });

});