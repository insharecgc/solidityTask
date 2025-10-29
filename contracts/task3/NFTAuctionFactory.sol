// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./NFTAuction.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol"; // 用于克隆代理合约
import {console} from "hardhat/console.sol";

/**
 * @title NFT拍卖工厂合约，负责创建和管理拍卖合约
 * @notice 采用类似于Uniswap V2的工厂模式，每个拍卖是独立的合约，使用UUPS升级模式
 */
contract NFTAuctionFactory is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    mapping(uint256 => address) private auctionAddressMap; // 拍卖ID到拍卖合约地址的映射
    address private nftAuctionImplementation; // NFTAuction拍卖合约的代理地址
    address private platformFeeRecipient; // 平台手续费接收地址
    uint256 private platformFeePercentage; // 平台手续费比例（万分之为单位，100 = 1%）
    uint256 public nextAuctionId; // 下一个拍卖ID

    // 事件定义
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed auctionAddress,
        address indexed seller,
        address nftContract,
        uint256 tokenId
    );

    event PlatformFeeUpdated(uint256 percentage);

    /**
     * @dev 初始化工厂合约
     * @param _nftAuctionImplementation  NFTAuction拍卖合约的代理地址
     * @param _platformFeeRecipient      平台手续费接收地址
     * @param _platformFeePercentage     平台手续费百分比 0.01% - 10% 之间
     */
    function initialize(
        address _nftAuctionImplementation,
        address _platformFeeRecipient,
        uint256 _platformFeePercentage
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        nextAuctionId = 1;

        require(
            _nftAuctionImplementation != address(0),
            "Invalid nftAuctionImplementation"
        );
        require(
            _platformFeeRecipient != address(0),
            "Invalid platformFeeRecipient"
        );
        require(
            _platformFeePercentage >= 1 && _platformFeePercentage <= 1000,
            "Fee percentage must be between 0.01% and 10%"
        );

        nftAuctionImplementation = _nftAuctionImplementation;
        platformFeeRecipient = _platformFeeRecipient;
        platformFeePercentage = _platformFeePercentage;
    }

    function createAuction(
        address _nftContract,
        uint256 _duration,
        uint256 _startPrice,
        uint256 _tokenId,
        address _payToken
    ) external {
        require(_nftContract != address(0), "nftContract not be 0x0");
        require(_duration > 0, "duration need > 0");
        require(_startPrice > 0, "startPrice need > 0");
        require(_tokenId > 0, "tokenId need > 0");

        // 检查用户是否拥有NFT且已授权
        IERC721 nft = IERC721(_nftContract);
        require(nft.ownerOf(_tokenId) == msg.sender, "Not the owner");
        // NFT合约需要授权给拍卖工厂合约，拍卖工厂合约才能转移NFT
        require(
            nft.isApprovedForAll(msg.sender, address(this)) || 
            nft.getApproved(_tokenId) == address(this),
            "Not approved"
        );

        uint256 auctionId = nextAuctionId;
        // 创建新的拍卖合约
        // 1. 部署ERC1967代理合约（UUPS兼容的代理），指向实现合约
        ERC1967Proxy proxy = new ERC1967Proxy(
            nftAuctionImplementation,
            "" // 初始化数据暂为空，后续单独调用initialize
        );
        // 2. 调用代理合约的initialize函数（初始化状态）
        address auctionAddress = address(proxy);
        NFTAuction(payable(auctionAddress)).initialize(
            msg.sender,
            _nftContract,
            _duration,
            _startPrice,
            _tokenId,
            _payToken,
            address(this),
            auctionId
        );

        auctionAddressMap[auctionId] = auctionAddress;
        nextAuctionId++;

        // 在创建拍卖合约之后，将NFT转移给拍卖合约
        nft.transferFrom(msg.sender, auctionAddress, _tokenId);

        console.log("NFTAuctionFactory - Auction created: %s", auctionAddress);

        emit AuctionCreated(auctionId, auctionAddress, msg.sender, _nftContract, _tokenId);
    }

    /**
     * @dev 更新平台手续费比例
     * @param newPercentage 新的手续费比例
     */
    function setPlatformFee(uint256 newPercentage) external onlyOwner {
        require(newPercentage >= 1 && newPercentage <= 1000, "Fee percentage must be between 0.01% and 10%");
        platformFeePercentage = newPercentage;
        emit PlatformFeeUpdated(newPercentage);
    }
    
    /**
     * @dev 设置手续费接收地址
     * @param newRecipient 新的接收地址
     */
    function setPlatformFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        platformFeeRecipient = newRecipient;
    }

    /**
     * 计算平台手续费
     */
    function calculateFee(uint256 amount) public view returns (uint256 fee) {
        return (platformFeePercentage * amount) / 10000;        
    }

    
    function getAuctionAddress(uint256 auctionId) external view returns (address) {
        return auctionAddressMap[auctionId];
    }

    function getNftAuctionImplementation() external view returns (address) {
        return nftAuctionImplementation;
    }

    function getPlatformFeeRecipient() external view returns (address) {
        return platformFeeRecipient;
    }

    function getPlatformFeePercentage() external view returns (uint256) {
        return platformFeePercentage;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

}

