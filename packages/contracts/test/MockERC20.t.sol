// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract MockERC20Test is Test {
    MockERC20 internal token;

    function setUp() public {
        token = new MockERC20("T", "T", 18);
    }

    function testMintTransfer() public {
        token.mint(address(this), 100 ether);
        assertEq(token.balanceOf(address(this)), 100 ether);
        token.transfer(address(0xBEEF), 10 ether);
        assertEq(token.balanceOf(address(0xBEEF)), 10 ether);
    }
}
