// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Empty contract address used as mempool `to` filter until real operator is deployed.
contract WatchTarget {
    event Ping(address indexed from);

    function ping() external {
        emit Ping(msg.sender);
    }
}
