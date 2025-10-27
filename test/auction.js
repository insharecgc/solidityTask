const { ethers, deployments } = require("hardhat")
const { expect } = require("chai")


describe("Test auction", async function () {
    it("Should be ok", async function () {
        await main();
    });
})

async function main() {
    const [signer, buyer] = await ethers.getSigners()
    await deployments.fixture(["depolyNFTAuction"]);
    
    const nftAuctionProxy = await deployments.get("NFTAuctionProxy");
    const nftAuction = await ethers.getContractAt(
        "NFTAuction",
        nftAuctionProxy.address
    );
}