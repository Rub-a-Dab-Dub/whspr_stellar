// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

contract MockERC20 is ERC20, Ownable {
    constructor(address initialOwner) ERC20("USDC", "USDC") Ownable(initialOwner) {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}

contract USDT is ERC20, Ownable {
    constructor(address initialOwner) ERC20("USDT", "USDT") Ownable(initialOwner) {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
