// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";

contract ERC20 is IERC20 {
    address private  _owner;    // 合约所有者
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint256 private immutable DECIMALS;

    constructor(string memory name_, string memory symbol_, uint256 initialSupply_) {
        _owner = msg.sender;
        _name = name_;
        _symbol = symbol_;
        DECIMALS = 18;
        uint256 mintAmount = initialSupply_ * 10 ** DECIMALS;
        _mint(_owner, mintAmount); // 创始者初始发行量
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint256) {
        return DECIMALS;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    // transfer：转账
    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    // approve：授权
    function approve(address spender, uint256 amount) external override  returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    // transferFrom：代扣转账
    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        _transfer(sender, recipient, amount);
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transferFrom amount exceeds allowance");
        unchecked {
            _approve(sender, msg.sender, currentAllowance - amount);
        }
        return true;
    }

    // mint允许合约所有者增发代币
    function mint(address account, uint256 amount) external returns(bool) {
        require(_owner == msg.sender, "Just Owner can mint");
        _mint(account, amount);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        uint256 senderBalance = _balances[sender];
        require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");
        // 不需要自动添加溢出 / 下溢校验
        unchecked {
            _balances[sender] = senderBalance - amount;
        }
        // 0.8.0之后的版本，会自动添加溢出 / 下溢检查
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        // 代币的拥有者owner，把代币金额amount授权给spender交易权
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }
}
