const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Sepolia Test NFTAuction", async function () {
    this.timeout(600 * 1000); // 设置超时为10分钟

    const myNFT = "";   // task2下的NFT在Sepolia下合约地址
    const nftAuction = "";    // Sepolia下的NFT拍卖合约地址
    const nfgAuctionFactoryProxy = "";    // Sepolia下的NFT拍卖工厂代理合约地址

    const sep_owner = "";    // Sepolia下的部署NFT、和拍卖合约的拥有者地址
    const sep_user1 = "";     // Sepolia下的用户1地址
    const sep_user2 = "";     // Sepolia下的用户2地址
    
    const usdc = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";  // Sepolia下的USDC合约地址
    const ethPriceFeed = "0x694AA1769357215DE4FAC081bf1f309aDC325306";    // Sepolia下的ETH/USD价格喂价地址
    const usdcPriceFeed = "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E";    // Sepolia下的USDC/USD价格喂价地址

    let nft;
    let auction;
    let auctionFactoryProxy;
    let mintTokenId;
    let deployer;
    let user1;
    let user2;
    let owner;
    beforeEach(async function () {
        // 所有合约都已经部署到Sepolia上了，所以直接根据合约地址获取实例
        deployer = await ethers.getSigner(sep_owner);
        user1 = await ethers.getSigner(sep_user1);
        user2 = await ethers.getSigner(sep_user2);
        console.log("Deployer address、user1 address、user2 address", deployer.address, user1.address, user2.address);
        // 1.根据NFT合约地址，拿到NFT合约实例
        const NFT = await ethers.getContractFactory("NFT");
        nft = NFT.attach(myNFT);
        // nft = await ethers.getContractAt("NFT", myNFT);
        console.log("NFT合约地址:", nft.target);

        // 2.根据拍卖合约地址，拿到拍卖合约实例
        auction = await ethers.getContractAt("NFTAuction", nftAuction);
        const auctionAddress = await auction.getAddress();
        console.log("NFTAuction合约地址：", auctionAddress);

        const auctionInfo = await auction.getAuctionInfo();
        // console.log("Auction info:", auctionInfo);

        // 3.根据拍卖工厂合约地址，拿到拍卖工厂合约实例
        auctionFactoryProxy = await ethers.getContractAt("NFTAuctionFactory", nfgAuctionFactoryProxy);
        const factoryProxyAddress = await auctionFactoryProxy.getAddress()
        console.log("NFTAuctionFactory代理合约地址：", factoryProxyAddress);

        mintTokenId = 1;
        // 给用户1 mint一个NFT
        const tx = await nft.connect(deployer).mint(user1.address, mintTokenId, "https://ipfs.io/ipfs/bafkreihyf3rp64dmhmrlionfmbw22rnvckslwylecsxeshuyafoj6fpmmu");
        await tx.wait(3);   // 等待3个区块确认
        console.log("Minted NFT to user1 success");
        owner = await nft.ownerOf(mintTokenId);
        console.log("====当前NFT拥有者owner:", owner);
    });

    describe("User 1 Create Auction", function () {
        it("Should create a new auction successfully", async function () {
            // 未授权时，getApproved 返回零地址
            let approvedAddress = await nft.getApproved(mintTokenId)
            expect(approvedAddress).to.equal(ethers.ZeroAddress);

            // /** --------------------------创建拍卖------------------------ */
            console.log("Testing create auctionFactoryProxy...", auctionFactoryProxy.target);
            // 用户1授权拍卖工厂合约转移NFT
            let tx = await nft.connect(user1).approve(auctionFactoryProxy.target, mintTokenId);
            await tx.wait(3);
            console.log("Approved NFT to factory");
            // 验证授权地址
            approvedAddress = await nft.getApproved(mintTokenId)

            // 监听合约创建成功事件
            const emittedEvent = new Promise((resolve) => {
                auctionFactoryProxy.once("AuctionCreated", (...args) => {
                    resolve(args);
                });
            });

            // 用户1用14号NFT创建拍卖，用ETH支付，持续5分钟，起拍价1000000 wei
            tx = await auctionFactoryProxy.connect(user1).createAuction(nft.target, 300, 1000000, mintTokenId, ethers.ZeroAddress);
            await tx.wait(3);
            // 得到合约创建事件的参数
            const [auctionId, auctionAddress, seller, nftContract, tokenId] = await emittedEvent;
            // 不用后移除监听器
            auctionFactoryProxy.removeAllListeners("AuctionCreated");
            console.log("Auction created with auctionId:", auctionId.toString(), "tokenId:", tokenId, "and address:", auctionAddress);
            // 通过拍卖ID查询拍卖合约地址，验证拍卖合约地址与事件中拍卖合约地址一致
            const nftAuction = await auctionFactoryProxy.getAuctionAddress(auctionId);
            console.log("Auction created:", nftAuction);

            /** -------------------------END------------------------- */

            /** -------------------------验证信息------------------------- */
            /** *********************************************** */
            // 前面已经通过，所以这里直接取值
            // const auctionId = 1;
            // const tokenId = 1;
            // const nftAuction = "";
            /** *********************************************** */

            // 工厂合约创建了拍卖合约实例，根据得到的拍卖合约地址，调用getAuctionStatus方法，验证拍卖状态
            const NFTAuction = await ethers.getContractFactory("NFTAuction");
            const newAuction = NFTAuction.attach(nftAuction);
            // const newAuction = await ethers.getContractAt("NFTAuction", nftAuction);     // 这两种方式都可以获取到合约实例
            // 验证NFT的owner是否为拍卖合约地址
            owner = await nft.ownerOf(tokenId);
            console.log("NFT拍卖创建成功，NFT的owner:", owner);
            expect(owner).to.equal(nftAuction);     // 校验nft目前属于拍卖合约
            // 创建后直接获取拍卖信息，拍卖状态应为未结束，最高出价者应为零地址，最高出价为0
            let auctionInfo = await newAuction.getAuctionInfo();
            console.log("111工厂创建的拍卖状态信息: ended =", auctionInfo.ended, ", payToken =", auctionInfo.payToken, ", highestBidder =", auctionInfo.highestBidder, ", highestBid =", auctionInfo.highestBid);
            // /** -------------------------END------------------------- */

            // /** -----------------------------出价---------------------------- */
            // 用户2出价 1USDC(6位小数) 拍卖    **** 注意别忘记 ERC20代币授权给拍卖合约，user2是否拥有1USDC以上的代币  ****
            console.log("User2 出价 1USDC");
            const usdcContract = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", usdc);
            tx = await usdcContract.connect(user2).approve(newAuction.target, ethers.parseUnits("1", 6));
            await tx.wait(3);

            tx = await newAuction.connect(user2).placeBid(usdc, ethers.parseUnits("1", 6))
            await tx.wait(3);
            // 验证用户2出价成功
            console.log("User2 出价成功");
            auctionInfo = await newAuction.getAuctionInfo();
            console.log("Highest bidder address:", auctionInfo.highestBidder, ", highestBid =", auctionInfo.highestBid);
            // 验证用户2出价后拍卖状态，最高出价者应为用户2，最高出价为1最小单位 USDC(6位小数)
            expect(auctionInfo.ended).to.equal(false);
            expect(auctionInfo.highestBidder).to.equal(user2.address);
            expect(auctionInfo.highestBid).to.equal(ethers.parseUnits("1", 6));

            // deployer出价 0.001 ETH拍卖
            console.log("Deployer 出价 0.001 ETH");
            tx = await newAuction.connect(deployer).placeBid(ethers.ZeroAddress, ethers.parseEther("0.001"), { value: ethers.parseEther("0.001") });
            await tx.wait(3);
            // 验证deployer出价成功
            console.log("Deployer 出价成功");
            auctionInfo = await newAuction.getAuctionInfo();
            console.log("Highest bidder address:", auctionInfo.highestBidder, ", highestBid =", auctionInfo.highestBid);
            // 验证deployer出价后拍卖状态，最高出价者应为deployer，最高出价为 0.001 ETH
            expect(auctionInfo.ended).to.equal(false);
            expect(auctionInfo.highestBidder).to.equal(deployer.address);
            expect(auctionInfo.highestBid).to.equal(ethers.parseEther("0.001"));

            /** -------------------------END------------------------- */
            console.log("Waiting for auction to end...");
            await sleep(200 * 1000);
            // 最后单独调用结束拍卖，验证NFT被回退到用户1地址
            tx = await newAuction.endAuction();
            await tx.wait(3);
            // 验证拍卖结束，最高出价者应为deployer，最高出价为0.001 ETH，
            auctionInfo = await newAuction.getAuctionInfo();
            console.log("拍卖结束后状态信息: ended =", auctionInfo.ended, ", highestBidder =", auctionInfo.highestBidder, ", highestBid =", auctionInfo.highestBid);
            // 验证拍卖结束后，deployer竞拍成功，成为NFT的owner
            owner = await nft.ownerOf(tokenId);
            console.log("NFT拍卖结束后，NFT的owner:", owner);
            expect(owner).to.equal(deployer.address);
            // 最后可以到 https://sepolia.etherscan.io/ 上查看合约交易记录验证
        });
    });

});