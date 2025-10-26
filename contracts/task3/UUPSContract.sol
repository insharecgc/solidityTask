// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/* 
 代理合约，实际存储数据，通过注册不同的逻辑合约实现不同的功能（主要是升级用）
*/
contract UUPSContract {
    address public implementation; // 逻辑合约地址
    address public owner; // 代理合约所有者，通过调用upgradeTo函数升级逻辑合约

    // 合约状态变量
    string public Words;

    constructor(address _implementation) {
        implementation = _implementation;
        owner = msg.sender;
    }

    receive() external payable {}

    fallback() external payable {
        (bool success, bytes memory data) = implementation.delegatecall(msg.data);
        // 检查调用是否成功
        if (!success) {
            // 若调用失败，回滚并返回错误数据
            assembly {
                revert(add(data, 32), mload(data))
            }
        }        
        // 若调用成功，返回数据给调用者
        assembly {
            return(add(data, 32), mload(data))
        }
    }

    function upgradeTo(address _newImplementation) external {
        require(msg.sender == owner, "Only owner can upgrade");
        implementation = _newImplementation;
    }
}

/*
 升级函数在Logic合约，不会存在选择器冲突，这种标准叫 UUPS（Universal Upgradeable Proxy Standard）
 原理：如果用户A调用代理合约B，代理合约B去delegatecall合约逻辑合约C，在逻辑合约C中的上下文仍是合约B的上下文，
      即逻辑合约中使用的状态变量都是B的状态变量，msg.sender仍是B的调用者即用户A地址。
*/
contract LogicUUPS1 {
    address public implementation;
    address public owner;
    string public Words;

    /*
     UUPS中，逻辑合约中必须包含升级函数，不然就不能再升级了。
    */
    function upgradeTo(address _newImplementation) public {
        require(msg.sender == owner, "Only owner can upgrade");
        implementation = _newImplementation;
    }

    function changeWords() public {
        Words = "LogicUUPS1";
    }
}

contract LogicUUPS2 {
    address public implementation;
    address public owner;
    string public Words;

    /*
     UUPS中，逻辑合约中必须包含升级函数，不然就不能再升级了。
    */
    function upgradeTo(address _newImplementation) public {
        require(msg.sender == owner, "Only owner can upgrade");
        implementation = _newImplementation;
    }

    function changeWords() public {
        Words = "LogicUUPS2";
    }
}

contract Caller {

    // 代理合约地址
    address public uupsContract;

    constructor(address _uupsContract) {
        uupsContract = _uupsContract;
    }

    // 调用代理合约的changeWords函数
    function callProxyChangeWords() external  {
        (bool success, ) = uupsContract.call(abi.encodeWithSignature("changeWords()"));
        require(success, "call changeWords failed");
    }

    // 调用代理合约的Words函数
    function callProxyGetWords() external returns(string memory) {
        ( , bytes memory data) = uupsContract.call(abi.encodeWithSignature("Words()"));
        return abi.decode(data, (string));
    }
}