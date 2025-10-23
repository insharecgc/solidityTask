const hre = require("hardhat");
const { expect } = require("chai");

describe("ERC20", async () => {

    const { ethers } = hre;
    const initialSupply = 10000;
    let erc20Contract;
    let account1, account2;

    beforeEach(async () => {
        [account1, account2] = await ethers.getSigners();
        console.log([account1, account2], '===accounts===');

        const ERC20 = await ethers.getContractFactory("ERC20");   //工厂模板
        erc20Contract = await ERC20.deploy("MyERC20", "TST", initialSupply);  //部署合约
        erc20Contract.waitForDeployment();

        expect(await erc20Contract.name()).to.equal("MyERC20");
    })

    it("验证下合约的构造信息", async () => {
        const totalSupply = await erc20Contract.totalSupply();
        expect(totalSupply).to.equal(initialSupply);
        expect(await erc20Contract.decimals()).to.equal(18);
        expect(await erc20Contract.symbol()).to.equal("TST");
        expect(await erc20Contract.balanceOf(account1.address)).to.equal(initialSupply);
    })

    it("验证转账", async () => {
        const resp = await erc20Contract.transfer(account2.address, 100);
        console.log(resp)
        expect(await erc20Contract.balanceOf(account1.address)).to.equal(initialSupply - 100);
        expect(await erc20Contract.balanceOf(account2.address)).to.equal(100);
    })
})