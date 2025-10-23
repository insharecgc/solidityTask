// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/*
  简化版的ERC20接口
*/
interface IERC20 {

    // Transfer转账事件
    event Transfer(address indexed from, address indexed to, uint256 value);

    // Approval授权事件
    event Approval( address indexed owner, address indexed spender, uint256 value);
    
    // balanceOf查账户余额
    function balanceOf(address account) external view returns (uint256);

    // transfer转账
    function transfer(address recipient, uint256 amount) external returns (bool);

    // approve授权
    function approve(address spender, uint256 amount) external returns (bool);

    // transferFrom代扣转账
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}