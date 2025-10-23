// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Algorithm {

    // 罗马字符到数值的映射
    mapping(bytes1 => uint) private romanValues;

    // 构造函数初始化映射
    constructor() {
        romanValues["I"] = 1;
        romanValues["V"] = 5;
        romanValues["X"] = 10;
        romanValues["L"] = 50;
        romanValues["C"] = 100;
        romanValues["D"] = 500;
        romanValues["M"] = 1000;
    }

    // 定义数值与对应罗马数字的映射（从大到小排列，包含6个特殊组合）
    uint[13] private values = [
        1000, 900, 500, 400, 100, 
        90, 50, 40, 10, 9,
        5, 4, 1
    ];
    string[13] private symbols = [
        "M", "CM", "D", "CD", "C", 
        "XC", "L", "XL", "X", "IX", 
        "V", "IV", "I"
    ];


    // 1.反转字符串 (Reverse String)
    function reverse(string calldata str) public pure returns (string memory) {
        bytes calldata byteStr = bytes(str);
        bytes memory reversed = new bytes(byteStr.length);
        for (uint256 i = 0; i < byteStr.length; i++) {
            reversed[i] = byteStr[byteStr.length - 1 - i];
        }
        return string(reversed);
    }


    // 2.用 solidity 实现整数转罗马数字
    function intToRoman(uint num) public view returns (string memory) {
        // 校验输入范围（罗马数字常规表示范围）
        require(num >= 1 && num <= 3999, "out of range (1-3999)");
        string memory result;
        // 遍历数值数组，从大到小拼接罗马数字
        for (uint i = 0; i < 13; i++) {
            // 当前数值小于等于剩余num，执行减法操作并追加对应符号
            while (num >= values[i]) {
                num -= values[i];
                result = string(abi.encodePacked(result, symbols[i]));
            }
            if (num == 0) {
                break;
            }
        }
        return result;
    }


    // 3.用 solidity 实现罗马数字转数整数
    function romanToInt(string calldata s) public view returns (uint) {
        bytes calldata byteStr = bytes(s);
        require(byteStr.length > 0, "empty string");
        uint result;
        for (uint i = 0; i < byteStr.length; i++) {
            uint curValue = romanValues[byteStr[i]];
            require(curValue > 0, "Invalid Roman");
            // 若不是最后一个字符，且当前值 < 下一个值，则减去当前值
            if (i < byteStr.length - 1 && curValue < romanValues[byteStr[i + 1]]) {
                result -= curValue;
            } else {
                result += curValue;
            }
        }
        return result;
    }


    // 4.合并两个有序数组 (Merge Sorted Array)
    function mergeSortedArrays(uint[] memory a, uint[] memory b) public pure returns (uint[] memory) {
        uint len1 = a.length;
        uint len2 = b.length;
        uint[] memory merged = new uint[](len1 + len2);
        uint i = 0;
        uint j = 0;
        uint k = 0;
        while (i < len1 && j < len2) {
            if (a[i] <= b[j]) {
                merged[k] = a[i];
                i++;
            } else {
                merged[k] = b[j];
                j++;
            }
            k++;
        }
        // 再分别处理数组a和b的剩余元素（若有）
        while (i < len1) {
            merged[k] = a[i];
            i++;
            k++;
        }
        while (j < len2) {
            merged[k] = b[j];
            j++;
            k++;
        }
        return merged;
    }


    // 5.二分查找 (Binary Search)，在一个有序数组中查找目标值
    function binarySearch(uint[] memory nums, uint target) public pure returns (uint) {
        require(nums.length > 0, "empty array");
        uint left = 0;
        uint right = nums.length - 1;
        while (left <= right) {
            // 计算中间索引（避免 left + right 溢出）
            uint mid = left + (right - left) / 2;
            if (nums[mid] == target) {
                return mid;
            } else if (nums[mid] < target) {
                left = mid + 1;
            } else {
                if (mid == 0) {
                    // 已经找完了，未找到返回数组长度
                    return nums.length;
                }
                right = mid - 1;
            }
        }
        // 未找到，返回数组长度
        return nums.length;
    }

}
