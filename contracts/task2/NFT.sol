// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFT is ERC721, Ownable {
    // 最大NFT数量
    uint256 constant MAX_TOKEN = 1000;
    // NFT对应的URI
    mapping(uint256 => string) private _tokenURIs;
    // NFT铸造成功事件
    event MintNFTURI(address indexed recipient, uint256 indexed tokenId, string uri);

    // 构造函数：初始化 NFT 名称、符号、部署者为所有者
    constructor(string memory name, string memory symbol)
        ERC721(name, symbol)
        Ownable(msg.sender)
    {}

    // 重写 ERC721 的 tokenURI方法，返回NFT的URI
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }


    // 铸造 NFT（仅所有者可调用）
    function mintNFT(address to, uint256 tokenId, string calldata tokenUri) external onlyOwner returns(bool) {
        require(tokenId >=0 && tokenId < MAX_TOKEN, "tokenId out of range");
        require(bytes(tokenUri).length > 0, "tokenUri is empty");
        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = tokenUri;
        emit MintNFTURI(to, tokenId, tokenUri);
        return true;
    }

}
