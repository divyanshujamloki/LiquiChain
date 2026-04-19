// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {WatchTarget} from "../src/mocks/WatchTarget.sol";

/// @dev Deploys mock tokens and writes deployments/<chainId>.json for apps.
/// LiquiChain core/operator: add as git submodules under lib/ and extend deploy scripts when ready.
contract DeployMocks is Script {
    function run() external {
        uint256 pk = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        string memory pkEnv = vm.envOr("PRIVATE_KEY", string(""));
        if (bytes(pkEnv).length > 0) {
            pk = vm.parseUint(pkEnv);
        }
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        MockERC20 tka = new MockERC20("Token A", "TKA", 18);
        MockERC20 tkb = new MockERC20("Token B", "TKB", 18);
        WatchTarget watch = new WatchTarget();
        tka.mint(deployer, 1_000_000 ether);
        tkb.mint(deployer, 1_000_000 ether);

        vm.stopBroadcast();

        uint256 chainId = block.chainid;
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/deployments/", vm.toString(chainId), ".json");

        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(chainId),
            ",\n",
            '  "deployer": "',
            vm.toString(deployer),
            '",\n',
            '  "mockTokenA": "',
            vm.toString(address(tka)),
            '",\n',
            '  "mockTokenB": "',
            vm.toString(address(tkb)),
            '",\n',
            '  "core": "0x0000000000000000000000000000000000000000",\n',
            '  "operator": "0x0000000000000000000000000000000000000000",\n',
            '  "watchTarget": "',
            vm.toString(address(watch)),
            '"\n',
            "}\n"
        );

        vm.writeFile(path, json);
        console2.log("Wrote", path);
        console2.log("TKA", address(tka));
        console2.log("TKB", address(tkb));
    }
}
