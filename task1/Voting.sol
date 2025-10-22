// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/*
一个mapping来存储候选人的得票数
一个vote函数，允许用户投票给某个候选人
一个getVotes函数，返回某个候选人的得票数
一个resetVotes函数，重置所有候选人的得票数
*/
contract Voting {

    mapping(address => uint) private candidateMap;
    address[] private candidates;  // 动态数组gas高

    function vote(address candidate) external {
        require(candidate != address(0), "address not be 0");
        if (candidateMap[candidate] == 0) {
            // 首次投票，记录候选人
            candidates.push(candidate);
        }
        candidateMap[candidate]++;
    }

    function getVotes(address candidate) external view returns(uint) {
        return candidateMap[candidate];
    }

    function resetVotes() external {
        for (uint i = 0; i < candidates.length; i++) {
            // 重置得票数
            candidateMap[candidates[i]] = 0;
        }
        delete candidates;
    }

}