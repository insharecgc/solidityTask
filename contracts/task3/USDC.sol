// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title 模拟USDC合约
 * @notice 这是一个简单的ERC20代币合约，用于模拟USDC代币的行为，方便在本地测试环境中进行拍卖合约的测试。
 */
contract USDC is ERC20, Ownable {
    
    constructor() ERC20("USD Coin", "USDC") Ownable(msg.sender) {
        // 初始铸造一些代币给合约部署者
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    /**
     * @dev 铸造新的USDC代币
     * @param to 接收代币的地址
     * @param amount 铸造的代币数量
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev 销毁USDC代币
     * @param from 销毁代币的地址
     * @param amount 销毁的代币数量
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

}