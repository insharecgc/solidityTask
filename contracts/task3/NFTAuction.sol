// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

import {console} from "hardhat/console.sol";

contract NFTAuction is
    IERC721Receiver,
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // 拍卖结构体
    struct Auction {
        address seller; // 卖家
        uint256 startTime; // 开始时间
        uint256 duration; // 拍卖时长（单位秒）
        uint256 startPrice; // 起拍价格
        bool ended; // 是否结束
        address highestBidder; // 最高出价者
        uint256 highestBid; // 最高出价
        address nftContract; // 拍卖的NFT合约地址
        uint256 tokenId; // NFT ID
        address payToken; // 参与竞价的资产类型（0x0 地址表示eth，其他地址表示erc20）
        address factory;    // 工厂合约地址，用于调用工厂合约的相关函数（如计算手续费，把手续费转给平台）
        uint256 auctionId;  //拍卖ID
    }

    Auction public auctionInfo; // 拍卖信息存储

    /**
     * eth(address(0)) => 0x694AA1769357215DE4FAC081bf1f309aDC325306 ETH/USD
     * usdc => 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E USDC/USD
     * 初始化默认添加以上两个币对，管理员可以添加更多映射
     */
    mapping(address => AggregatorV3Interface) private priceFeeds; // 价格预言机，统一为【代币/USD】的喂价

    // 拍卖创建事件
    event AuctionCreated(
        address indexed seller,
        address indexed nftContract,
        uint256 startTime,
        uint256 duration,
        uint256 startPrice,
        uint256 tokenId,
        address payToken,
        uint256 _auctionId
    );
    // 竞拍出价事件
    event BidPlaced(
        address indexed bidder,
        address indexed nftContract,
        uint256 tokenId,
        uint256 bid,
        address payToken
    );
    // 拍卖结束事件
    event AuctionEnded(
        address indexed winner,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount,
        address payToken
    );

    /**
     * @dev 初始化函数
     * @param _seller 卖家地址
     * @param _nftContract NFT合约地址
     * @param _duration 拍卖时长（单位秒）
     * @param _startPrice 起拍价格
     * @param _tokenId NFT ID
     * @param _payToken 参与竞价的资产类型（0x0 地址表示eth，其他地址表示erc20）
     * @param _auctionId 拍卖ID
     */
    function initialize(
        address _seller,
        address _nftContract,
        uint256 _duration,
        uint256 _startPrice,
        uint256 _tokenId,
        address _payToken,
        address _factory,
        uint256 _auctionId
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_seller != address(0), "seller not be 0x0");
        require(_nftContract != address(0), "nftContract not be 0x0");
        require(_factory != address(0), "factory not be 0x0");
        require(_duration > 0, "duration need > 0");
        require(_startPrice > 0, "startPrice need > 0");
        require(_tokenId > 0, "tokenId need > 0");

        // 获取NFT合约实例
        IERC721 nft = IERC721(_nftContract);
        require(nft.ownerOf(_tokenId) == _seller, "seller not be NFT owner");
        require(
            nft.isApprovedForAll(_seller, address(this)) ||
                nft.getApproved(_tokenId) == address(this),
            "Not NFT Approval"
        );

        // 初始化添加Sepolia测试网的 ETH/USD 和 USDC/USD 价格预言机
        _initPriceFeeds();

        // 如果是ERC20代币，需要交易拍卖是否支持此代币
        if (_payToken != address(0)) {
            AggregatorV3Interface feed = priceFeeds[_payToken];
            // 校验拍卖合约是否此支持_payToken代币来进行拍卖，可由管理员添加映射
            require(address(feed) != address(0), "payToken not support");
        }

        auctionInfo = Auction({
            seller: _seller,
            startTime: block.timestamp,
            duration: _duration,
            startPrice: _startPrice,
            ended: false,
            highestBidder: address(0),
            highestBid: 0,
            nftContract: _nftContract,
            tokenId: _tokenId,
            payToken: _payToken,
            factory: _factory,
            auctionId: _auctionId
        });

        emit AuctionCreated(
            _seller,
            _nftContract,
            block.timestamp,
            _duration,
            _startPrice,
            _tokenId,
            _payToken,
            _auctionId
        );
    }

    // 合约创建者可添加价格预言机，以支持更多代币竞拍
    function addPriceFeed(
        address _tokenAddress,
        address _priceFeedAddress
    ) external onlyOwner {
        require(_priceFeedAddress != address(0), "priceFeedAddress not be 0x0");
        priceFeeds[_tokenAddress] = AggregatorV3Interface(_priceFeedAddress);
    }

    /**
     * @dev 竞拍出价
     * @notice 出价金额必须大于0、必须大于起拍价格、必须大于当前最高出价
     * @notice 出价时间必须在拍卖开始时间之后，拍卖结束时间之前，竞争卖家出价
     * @param _payToken 出价资产类型（0x0 地址表示eth，其他地址表示erc20）
     * @param _amount 对应资产类型出价金额，如果是ETH竞拍，msg.value必须等于此值
     */
    function placeBid(
        address _payToken,
        uint256 _amount
    ) public payable nonReentrant {
        require(
            !auctionInfo.ended &&
            block.timestamp < auctionInfo.startTime + auctionInfo.duration,
            "auction ended"
        );
        if (_payToken == address(0)) {
            // ETH 出价，当此函数成功执行后，msg.value对应的ETH会自动存入本合约余额中
            require(msg.value == _amount, "ETH bid need value equal amount");
        } else {
            // ERC20 出价
            require(msg.value == 0, "ERC20 bid need not send ETH");
            require(IERC20(auctionInfo.payToken).allowance(msg.sender, address(this)) >= _amount, "ERC20 allowance not enough");
        }
        require(_amount > 0, "bid amount need > 0");    // 出价金额必须大于0
        require(msg.sender != auctionInfo.seller, "Seller cannot bid"); // 禁止卖家自己出价

        // 得到当前最高出价的USD价值
        uint256 hightestUSD = _getHightestUSDValue();
        console.log("hightestUSD", hightestUSD);
        // 计算出价的USD价值
        uint256 bidUSDValue = _calculateBidUSDValue(_payToken, _amount);
        console.log("bidUSDValue", bidUSDValue);
        require(bidUSDValue > hightestUSD, "bid amount need > highestBid");

        if (_payToken != address(0)) {
            // 当前竞拍价为最高，把竞拍的ERC20金额转到本合约
            bool transferSuccess = IERC20(_payToken).transferFrom(msg.sender, address(this), _amount);
            require(transferSuccess, "ERC20 transfer failed");
        }

        if (auctionInfo.highestBidder != address(0) && auctionInfo.highestBid > 0) {
            // 存在上一个出价者，退还上一个出价者出价金额
            _refund(auctionInfo.highestBidder, auctionInfo.payToken, auctionInfo.highestBid);
        }

        // 更新最高出价
        auctionInfo.highestBidder = msg.sender;
        auctionInfo.highestBid = _amount;
        auctionInfo.payToken = _payToken;

        emit BidPlaced(
            msg.sender,
            auctionInfo.nftContract,
            auctionInfo.tokenId,
            _amount,
            _payToken
        );
    }

    /**
     * @dev 结束拍卖，需要在拍卖结束时间之后手动调用
     */
    function endAuction() public nonReentrant {
        // 拍卖结束只能被成功调用一次，调用成功后ended置为true
        require(!auctionInfo.ended, "auction had ended");
        require(block.timestamp >= auctionInfo.startTime + auctionInfo.duration, "auction not ended");

        // 结束拍卖
        auctionInfo.ended = true;

        // 获取NFT合约实例
        IERC721 nft = IERC721(auctionInfo.nftContract);

        if (auctionInfo.highestBidder != address(0)) {
            // 如果有人出价，则将NFT转给最高出价者，扣出手续费后把剩余的金额转给卖家
            nft.safeTransferFrom(address(this), auctionInfo.highestBidder, auctionInfo.tokenId);

            // 计算手续费，从工厂函数计算手续费，（手续费可由工厂管理员设置）
            (uint256 feeAmount, uint256 sellerAmount) = _calculateFeeAndSellerAmount(auctionInfo.highestBid);

            // TODO 转给卖家
            _refund(auctionInfo.seller, auctionInfo.payToken, sellerAmount);

            // TODO 把手续费转给平台，从工厂函数获取平台地址


        } else {
            // 如果无人出价，则将NFT转回给卖家
            nft.safeTransferFrom(address(this), auctionInfo.seller, auctionInfo.tokenId);
        }


        emit AuctionEnded(
            auctionInfo.highestBidder,
            auctionInfo.nftContract,
            auctionInfo.tokenId,
            auctionInfo.highestBid,
            auctionInfo.payToken
        );
    }

    // 初始化价格预言机喂价代币类型
    // TODO 讲道理这里只应该添加ETH就好了，至于支持哪些ERC代币参与竞拍由卖家决定，卖家在设置拍卖规则的时候，可以设置哪些ERC代币
    function _initPriceFeeds() internal {
        priceFeeds[address(0)] = AggregatorV3Interface(
            0x694AA1769357215DE4FAC081bf1f309aDC325306
        ); // ETH/USD
        priceFeeds[ 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238] = AggregatorV3Interface(
            0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E
        ); // USDC/USD
    }

    // 辅助函数：计算出价的 USD 价值
    function _calculateBidUSDValue(
        address _payToken,
        uint256 _amount
    ) internal view returns (uint256) {
        AggregatorV3Interface feed = priceFeeds[_payToken];
        require(address(feed) != address(0), "Price feed not set for payToken");
        (, int256 priceRaw, , , ) = feed.latestRoundData();
        require(priceRaw > 0, "Invalid price from feed");
        uint256 price = uint256(priceRaw);
        uint256 feedDecimal = feed.decimals();
        return (_amount * price) / (10 ** feedDecimal);
    }

    // 计算当前拍卖最高出价的 USD 价值
    function _getHightestUSDValue() internal view returns (uint256) {
        AggregatorV3Interface feed = priceFeeds[auctionInfo.payToken];
        require(address(feed) != address(0), "Price feed not set for payToken");
        (, int256 priceRaw, , , ) = feed.latestRoundData();
        require(priceRaw > 0, "Invalid price from feed");
        uint256 price = uint256(priceRaw); // 获取价格预言机喂价
        uint256 feedDecimal = feed.decimals(); // 获取价格预言机小数位数

        // 获取当前最高出价，默认为起拍价格，如果有人出价，则最高出价为最高出价
        uint256 hightestAmount = auctionInfo.startPrice;
        if (auctionInfo.highestBidder != address(0)) {
            hightestAmount = auctionInfo.highestBid;
        }
        return (hightestAmount * price) / (10 ** feedDecimal);
    }

    // 通用退款/转账函数，处理ETH和ERC20资金
    function _refund(address to, address tokenAddress, uint256 amount) internal nonReentrant {
        require(to != address(0), "Recipient address not be 0");
        require(amount > 0, "amount must be > 0");
        if (tokenAddress == address(0)) {
            // ETH 转账
            payable(to).transfer(amount);
        } else {
            // ERC20 转账
            bool success = IERC20(tokenAddress).transfer(to, amount);
            require(success, "ERC20 refund failed");
        }     
    }

    /**
     * @dev 计算手续费和卖家实际所得
     * @param _amount 总金额
     * @return 手续费和卖家金额
     */
    function _calculateFeeAndSellerAmount(uint256 _amount) internal returns (uint256, uint256) {
        // 调用工厂合约获取手续费比例
        (bool success, bytes memory data) = auctionInfo.factory.call(
            abi.encodeWithSignature("calculateFee(uint256)", _amount)
        );
        require(success, "Failed to calculate fee");
        uint256 fee = abi.decode(data, (uint256));
        
        return (fee, _amount - fee);
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
