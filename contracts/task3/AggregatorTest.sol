// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

import {console} from "hardhat/console.sol";

contract AggregatorTest {
    /**
     * eth(address(0)) => 0x694AA1769357215DE4FAC081bf1f309aDC325306 ETH/USD
     * usdc => 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E USDC/USD
     * 初始化默认添加以上两个币对，管理员可以添加更多映射
     */
    mapping(address => AggregatorV3Interface) private priceFeeds; // 价格预言机，统一为【代币/USD】的喂价

    constructor() {
        priceFeeds[address(0)] = AggregatorV3Interface(
            0x694AA1769357215DE4FAC081bf1f309aDC325306
        ); // ETH/USD
        priceFeeds[0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238] = AggregatorV3Interface(
            0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E
        ); // USDC/USD
    }

    /**
     * ETH的USD价值（6位小数） = （ETH数量（wei） * ETH价格（USD/ETH，8位小数））/ (1e18 * 1e8 / 1e6)
     * 分母简化：10**(18 + 8 - 6) = 10**20（抵消ETH的18位和价格的8位，保留6位）
     * @param eth ETH数量（wei）
     * @return uint256 USD价值，6位小数
     */
    function ethToUsd(uint256 eth) external view returns(uint256){
        (uint256 price, uint256 feedDecimal) = _calculateToUSDPrice(address(0));
        return price * eth / (10**(12 + feedDecimal));  // 10**(18 + feedDecimal - 6) = 10**(12 + feedDecimal)
    }

    /**
     * 代币的USD价值（6位小数） = （代币数量（最小单位） * 代币价格（USD/代币，8位小数））/ (1e6 * 1e8 / 1e6)
     * 分母简化：10**(6 + 8 - 6) = 10**8（抵消代币USDC的6位和价格的8位，保留6位）
     * @param usdc USDC代币数量（最小单位）
     * @return uint256 USD价值，6位小数
     */
    function usdcToUsd(uint256 usdc) external view returns(uint256){
        (uint256 price, uint256 feedDecimal) = _calculateToUSDPrice(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238);
        return price * usdc / (10**(feedDecimal));  // 10**(6 + feedDecimal - 6) = 10**feedDecimal
    }

    /**
     * 喂价查询的价格是8位小数
     * @param _payToken 代币地址，address(0)表示ETH
     * @return price 价格，8位小数
     * @return feedDecimal 代币本身的小数位 
     */
    function _calculateToUSDPrice(address _payToken) internal view returns (uint256 price, uint256 feedDecimal) {
        AggregatorV3Interface feed = priceFeeds[_payToken];
        require(address(feed) != address(0), "Price feed not set for payToken");
        (, int256 priceRaw, , , ) = feed.latestRoundData();
        require(priceRaw > 0, "Invalid price from feed");
        feedDecimal = feed.decimals();
        console.log("feedDecimal:", feedDecimal);
        price = uint256(priceRaw);
        console.log("price:", price);
    }
}