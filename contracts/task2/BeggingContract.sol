// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BeggingContract {
    // 捐赠信息
    struct DonationInfo {
        address donor;
        uint256 amount;
        string name; // 捐赠者姓名
        uint256 timestamp; // 捐款时间
    }
    // 合约所有者
    address payable private _owner;

    // 记录捐赠者的地址和金额
    mapping(address => uint256) private _donations;

    // 记录捐赠者的地址每次捐款信息
    mapping(address => DonationInfo[]) private _donationInfos;

    // 捐赠金额最多的3个地址以及对应金额
    address[3] private _topDonors;
    uint256[3] private _topAmounts;

    constructor() {
        _owner = payable(msg.sender);
    }

    event Donation(address indexed donor, uint256 amount);
    event Withdraw(address indexed owner, uint256 amount);

    receive() external payable {}

    modifier onlyOwner() {
        require(msg.sender == _owner, "Not owner");
        _;
    }

    function getOwner() external view returns (address) {
        return _owner;
    }

    // 捐赠函数
    function donate(string memory name) public payable virtual returns (bool) {
        require(msg.value > 0, "Donation amount must be greater than 0");
        _donations[msg.sender] += msg.value;
        // 每一笔捐款详情内容
        _donationInfos[msg.sender].push(
            DonationInfo(msg.sender, msg.value, name, block.timestamp)
        );
        emit Donation(msg.sender, msg.value);
        // 每收到一笔捐款就更新一下捐赠金额最多的3个地址
        _updateTopDonors(msg.sender, msg.value);
        return true;
    }

    // 允许合约所有者提取所有捐赠的资金
    function withdraw() external payable onlyOwner returns (bool) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        _owner.transfer(balance);
        emit Withdraw(_owner, address(this).balance);
        return true;
    }

    // 获取捐赠者的捐赠金额、和每一笔捐赠信息
    function getDonation(
        address _donor
    )
        external
        view
        returns (uint256 totalAmount, DonationInfo[] memory donationInfos)
    {
        totalAmount = _donations[_donor];
        donationInfos = _donationInfos[_donor];
    }

    // 获取捐赠金额最多的3个地址
    function getTopDonors() external view returns (address[3] memory) {
        return _topDonors;
    }

    // 更新捐赠金额最多的3个地址
    function _updateTopDonors(address donor, uint256 amount) internal {
        // 检查捐赠者是否已经在top3里
        for (uint256 i = 0; i < 3; i++) {
            if (_topDonors[i] == donor) {
                // 捐赠者已经在top3里，更新金额，并重新排序
                _topAmounts[i] = amount;
                _sortTopDonors();
                return;
            }
        }
        // 未进入top3的捐赠者，检查是否能进入前三
        for (uint256 i = 0; i < 3; i++) {
            if (amount > _topAmounts[i]) {
                // 将捐赠者插入到top3里，后面的依次往后移
                for (uint256 j = 2; j > i; j--) {
                    _topDonors[j] = _topDonors[j - 1];
                    _topAmounts[j] = _topAmounts[j - 1];
                }
                _topDonors[i] = donor;
                _topAmounts[i] = amount;
                return;
            }
        }
    }

    function _sortTopDonors() internal {
        // 从大到小排序，小数组，冒泡排序
        for (uint256 i = 0; i < 2; i++) {
            for (uint256 j = 0; j < 2 - i; j++) {
                if (_topAmounts[j] < _topAmounts[j + 1]) {
                    // 交换位置
                    (address tempAddr, uint256 tempAmount) = (
                        _topDonors[j],
                        _topAmounts[j]
                    );
                    _topDonors[j] = _topDonors[j + 1];
                    _topAmounts[j] = _topAmounts[j + 1];
                    _topDonors[j + 1] = tempAddr;
                    _topAmounts[j + 1] = tempAmount;
                }
            }
        }
    }
}

// 限定时间段才可接收捐赠的合约
contract TimeLimitedBeggingContract is BeggingContract {
    uint256 public startTime;
    uint256 public endTime;

    // 字符串处理在Solidity中比较消耗gas，一般在链下处理好uint256来处理
    constructor(uint256 _startTime, uint256 _endTime) {
        startTime = _startTime;
        endTime = _endTime;
    }

    function donate(string memory name) public payable override returns (bool) {
        require(
            block.timestamp >= startTime && block.timestamp <= endTime,
            "Donation period has ended"
        );
        return super.donate(name);
    }
}
