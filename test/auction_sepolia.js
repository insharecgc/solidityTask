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
            // 验证用户2出价成功
            expect(await newAuction.highestBidder()).to.equal(user2.address);

            // deployer出价0.001 ETH拍卖
            await newAuction.connect(deployer).placeBid(ethers.ZeroAddress, ethers.parseEther("0.001"));
            // 验证deployer出价成功
            expect(await newAuction.highestBidder()).to.equal(deployer.address);

            // 2秒后调用结束拍卖，验证NFT被回退到用户1地址
            await sleep(2000);
            await newAuction.endAuction();

            owner = await nft.ownerOf(10);
            console.log("NFT拍卖结束后，NFT的owner:", owner);
            // expect(owner).to.equal(user1.address);
        });
    });

    //     // 测试1：创建拍卖
    //     describe("Auction Creation", function () {
    //       // 测试1：创建拍卖
    //       it("Should create a new auction successfully", async function () {
    //         console.log("Testing create auction...", factory.target);
    //         // 用户1授权工厂合约转移NFT
    //         await myNFT.connect(user1).approve(factory.target, 1);
    //         console.log("Approved NFT to factory");

    //         // 创建拍卖：1号NFT，用ETH支付，持续3600秒，起拍价0.1 ETH
    //         const tx = await factory.connect(user1).createAuction(
    //           3600,
    //           ethers.parseEther("0.1"),
    //           myNFT.target,
    //           1,
    //           ethers.ZeroAddress
    //         );
    //         await tx.wait();

    //         const auctionAddress = await factory.auctions(1);
    //         //验证事件
    //         await expect(tx)
    //           .to.emit(factory, "AuctionCreated")
    //           .withArgs(1, auctionAddress, user1.address, myNFT.target, 1);
    //         console.log("Auction created:", auctionAddress);

    //         // 检查拍卖数量
    //         expect(await factory.nextAuctionId()).to.equal(2);
    //         console.log("Auction count:", await factory.nextAuctionId());

    //         // 检查NFT是否已转移到拍卖合约
    //         console.log("NFT owner:", await myNFT.ownerOf(1));
    //         expect(await myNFT.ownerOf(1)).to.equal(auctionAddress);
    //       });

    //       it("Should fail if creator is not NFT owner", async function () {
    //         // 用户2不是NFT所有者，尝试创建拍卖
    //         await myNFT.connect(user1).approve(factory.target, 1);

    //         await expect(factory.connect(user2).createAuction(
    //           3600,
    //           ethers.parseEther("0.1"),
    //           myNFT.target,
    //           1,
    //           ethers.ZeroAddress
    //         )).to.be.revertedWith("Not the owner");
    //       });

    //       it("Should fail if contract is not approved to transfer NFT", async function () {
    //         // 未授权工厂合约转移NFT
    //         await expect(factory.connect(user1).createAuction(
    //           3600,
    //           ethers.parseEther("0.1"),
    //           myNFT.target,
    //           1,
    //           ethers.ZeroAddress
    //         )).to.be.revertedWith("Not approved");
    //       });
    //     });


    //     // 测试2：拍卖出价  
    //     describe("Bidding", function () {
    //       beforeEach(async function () {
    //         // 创建一个拍卖
    //         await myNFT.connect(user1).approve(factory.target, 1);
    //         await factory.connect(user1).createAuction(
    //           3600,
    //           ethers.parseEther("0.1"),// 0.1 ETH起拍价
    //           myNFT.target,
    //           1,
    //           ethers.ZeroAddress
    //         );
    //       });

    //       it("Should allow users to bid with ETH", async function () {
    //         const auctionAddress = await factory.auctions(1);
    //         const Auction = await ethers.getContractFactory("AuctionNFT");
    //         const auction = Auction.attach(auctionAddress);

    //         // 用户2出价0.2 ETH
    //         await expect(auction.connect(user2).placeBid(
    //           ethers.parseEther("0.2"),
    //           { value: ethers.parseEther("0.2") }
    //         ))
    //           .to.emit(auction, "BidPlaced")
    //           .withArgs(user2.address, ethers.parseEther("0.2"));

    //         // 检查最高出价
    //         const info = await auction.getAuctionInfo();
    //         expect(info.highestBidder).to.equal(user2.address);
    //         expect(info.highestBid).to.equal(ethers.parseEther("0.2"));
    //       });

    //       it("Should allow users to bid with ERC20", async function () {
    //         // 创建一个用USDC支付的拍卖
    //         await myNFT.connect(user1).mint(user1.address); // 铸造2号NFT
    //         console.log("Minted NFT #2 to user1");
    //         await myNFT.connect(user1).approve(factory.target, 2);
    //         console.log("Approved NFT #2 to factory");

    //         //创建拍卖
    //         const createTx = await factory.connect(user1).createAuction(
    //           3600,
    //           ethers.parseUnits("200", 6), // 200 USDC起拍价
    //           myNFT.target,
    //           2,
    //           usdc.target
    //         );
    //         await createTx.wait();
    //         console.log("Created auction for NFT #2");

    //         const auctionAddress = await factory.auctions(2);
    //         console.log("Auction address for ID 2:", auctionAddress);

    //         //确保拍卖地址有效
    //         expect(auctionAddress).to.not.be.null;
    //         expect(auctionAddress).to.not.equal(ethers.ZeroAddress);

    //         const Auction = await ethers.getContractFactory("AuctionNFT");
    //         const auction = Auction.attach(auctionAddress);

    //         // 用户2授权拍卖合约使用USDC
    //         await usdc.connect(user2).approve(auctionAddress, ethers.parseUnits("500", 6));
    //         console.log("User2 approved USDC to auction contract");

    //         // 用户2出价300 USDC
    //         await expect(auction.connect(user2).placeBid(
    //           ethers.parseUnits("300", 6),
    //           { value: 0 } //ERC20拍卖不需要ETH
    //         ))
    //           .to.emit(auction, "BidPlaced")
    //           .withArgs(user2.address, ethers.parseUnits("300", 6));

    //         // 检查最高出价
    //         const info = await auction.getAuctionInfo();
    //         expect(info.highestBidder).to.equal(user2.address);
    //         expect(info.highestBid).to.equal(ethers.parseUnits("300", 6));
    //       });

    //       it("Should refund previous highest bidder", async function () {
    //         const auctionAddress = await factory.auctions(1);
    //         const Auction = await ethers.getContractFactory("AuctionNFT");
    //         const auction = Auction.attach(auctionAddress);

    //         // 记录用户2和用户3的初始ETH余额
    //         const user2InitialBalance = await ethers.provider.getBalance(user2.address);
    //         const user3InitialBalance = await ethers.provider.getBalance(user3.address);
    //         console.log("User2 initial balance:", user2InitialBalance);
    //         console.log("User3 initial balance:", user3InitialBalance);

    //         // 用户2出价0.2 ETH
    //         await auction.connect(user2).placeBid(
    //           ethers.parseEther("0.2"),
    //           { value: ethers.parseEther("0.2") }
    //         );

    //         // 用户3出价0.3 ETH
    //         const tx = await auction.connect(user3).placeBid(
    //           ethers.parseEther("0.3"),
    //           { value: ethers.parseEther("0.3") }
    //         );
    //         const receipt = await tx.wait();

    //         // 在 Ethers.js v6 中正确计算 gas 成本
    //         const gasCost = receipt.gasUsed * receipt.gasPrice;
    //         console.log("Gas cost:", gasCost);

    //         // 检查用户2是否收到退款
    //         const user2FinalBalance = await ethers.provider.getBalance(user2.address);
    //         expect(user2FinalBalance).to.be.closeTo(
    //           user2InitialBalance, // 应该收到0.2 ETH退款
    //           ethers.parseEther("0.01") // 允许小额误差（gas）
    //         );

    //         // 检查最高出价是否为用户3
    //         const info = await auction.getAuctionInfo();
    //         expect(info.highestBidder).to.equal(user3.address);
    //         expect(info.highestBid).to.equal(ethers.parseEther("0.3"));
    //       });

    //       it("Should reject bids lower than current highest", async function () {
    //         const auctionAddress = await factory.auctions(1);
    //         const Auction = await ethers.getContractFactory("AuctionNFT");
    //         const auction = Auction.attach(auctionAddress);

    //         // 用户2出价0.2 ETH
    //         await auction.connect(user2).placeBid(
    //           ethers.parseEther("0.2"),
    //           { value: ethers.parseEther("0.2") }
    //         );

    //         // 用户3出价0.15 ETH（低于当前最高）
    //         await expect(auction.connect(user3).placeBid(
    //           ethers.parseEther("0.15"),
    //           { value: ethers.parseEther("0.15") }
    //         )).to.be.revertedWith("Bid not higher than current");
    //       });
    //     });


    //   // 测试3：结束拍卖
    //   describe("Ending Auction", function () {
    //     beforeEach(async function () {
    //       console.log("Ending auction start test...");
    //       // 创建一个拍卖
    //       await myNFT.connect(user1).approve(factory.target, 1);
    //       console.log("Approved NFT #1 to factory");
    //       const createTx = await factory.connect(user1).createAuction(
    //         3, // 2秒后结束（便于测试）
    //         ethers.parseEther("0.1"),
    //         myNFT.target,
    //         1,
    //         ethers.ZeroAddress
    //       );
    //       await createTx.wait();
    //       console.log("Created auction for NFT #1");

    //       // 用户2出价
    //       const auctionAddress = await factory.auctions(1);
    //       const Auction = await ethers.getContractFactory("AuctionNFT");
    //       const auction = Auction.attach(auctionAddress);
    //       await auction.connect(user2).placeBid(
    //         ethers.parseEther("0.2"),
    //         { value: ethers.parseEther("0.2") }
    //       );

    //       // 等待拍卖结束
    //       await ethers.provider.send("evm_increaseTime", [2]);
    //       await ethers.provider.send("evm_mine");
    //       console.log("Auction ended-----");
    //     });

    //     it("Should end auction and transfer NFT and funds", async function () {
    //       const auctionAddress = await factory.auctions(1);
    //       const Auction = await ethers.getContractFactory("AuctionNFT");
    //       const auction = Auction.attach(auctionAddress);
    //       console.log("Auction address:", auctionAddress);

    //       // 记录卖家和平台的初始余额
    //       const sellerInitialBalance = await ethers.provider.getBalance(user1.address);
    //       const platformInitialBalance = await ethers.provider.getBalance(owner.address);

    //       // 结束拍卖 - 由卖家user1调用
    //       await expect(auction.endAuction())
    //         .to.emit(auction, "AuctionEnded")
    //         .withArgs(user2.address, ethers.parseEther("0.2"));

    //       // 检查NFT是否转移给获胜者
    //       expect(await myNFT.ownerOf(1)).to.equal(user2.address);

    //       // 检查拍卖状态
    //       const info = await auction.getAuctionInfo();
    //       expect(info.ended).to.be.true;

    //       // 检查卖家收到的资金（0.2 ETH - 2%手续费 = 0.196 ETH）
    //       const sellerFinalBalance = await ethers.provider.getBalance(user1.address);
    //       expect(sellerFinalBalance - sellerInitialBalance).to.be.closeTo(
    //         ethers.parseEther("0.196"),
    //         ethers.parseEther("0.001")
    //       );

    //       // 检查平台收到的手续费（0.2 ETH * 2% = 0.004 ETH）
    //       const platformFinalBalance = await ethers.provider.getBalance(owner.address);
    //       expect(platformFinalBalance - platformInitialBalance).to.be.closeTo(
    //         ethers.parseEther("0.004"),
    //         ethers.parseEther("0.001")
    //       );
    //     });

    //     it("Should return NFT to seller if no bids", async function () {
    //       // 创建一个新拍卖
    //       await myNFT.connect(user1).mint(user1.address); // 2号NFT
    //       await myNFT.connect(user1).approve(factory.target, 2);
    //       await factory.connect(user1).createAuction(
    //         3,
    //         ethers.parseEther("0.1"),
    //         myNFT.target,
    //         2,
    //         ethers.ZeroAddress
    //       );

    //       // 等待拍卖结束
    //       await ethers.provider.send("evm_increaseTime", [2]);
    //       await ethers.provider.send("evm_mine");

    //       // 结束拍卖
    //       const auctionAddress = await factory.auctions(2);
    //       const Auction = await ethers.getContractFactory("AuctionNFT");
    //       const auction = Auction.attach(auctionAddress);
    //       await auction.endAuction();

    //       // 检查NFT是否返回给卖家
    //       expect(await myNFT.ownerOf(2)).to.equal(user1.address);
    //     });
    //   });
});