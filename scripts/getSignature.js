// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const config = require("../utils/config.json")
const privateKey = config.privateKey;
const threshold = config.threshold;
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(config.connectionURL))
const { utils, ethers, providers, Contract } = require("ethers");


// function module for `getSignature` accepts three parameters
//  signingAdddress - address that will sign the data, essentially the SafeProxyContract owners
//  pvtKey  - pvtKey of corresponding signing address
//  values  - parameters of withdrawtoken function e.g. (_beneficiary, withdrawAmount, createdAt)

const spec = {
  magicValue: "0x1626ba7e",
  abi: [
    {
      constant: true,
      inputs: [
        {
          name: "_hash",
          type: "bytes32",
        },
        {
          name: "_sig",
          type: "bytes",
        },
      ],
      name: "isValidSignature",
      outputs: [
        {
          name: "magicValue",
          type: "bytes4",
        },
      ],
      payable: false,
      stateMutability: "view",
      type: "function",
    },
  ],
};

async function isValidSignature(
  address,
  sig,
  data,
  provider,
  abi = spec.abi,
  magicValue = spec.magicValue
) {
  let returnValue;
  try {
    let contract = new Contract(address, abi, provider);
    // console.log(contract);
    returnValue = await contract.isValidSignature(utils.arrayify(data), sig);
    // console.log("returnValue", returnValue);
  } catch (e) {
    console.log(e);
    return false;
  }
  return returnValue.toLowerCase() === magicValue.toLowerCase();
}


async function verifySignature(address, sig, hash, provider) {
  let messageToArray = ethers.utils.arrayify(hash);
  let arrayToHash = ethers.utils.hashMessage(messageToArray);
  const bytecode = "0x00";
  const signer = ethers.utils.verifyMessage(ethers.utils.arrayify(hash), sig);
  if (
    !bytecode ||
    bytecode === "0x" ||
    bytecode === "0x0" ||
    bytecode === "0x00"
  ) {
    return signer.toLowerCase() === address.toLowerCase();
  } else {
    return isValidSignature(address, sig, arrayToHash, provider);
  }
}

async function getSignature(signingAddress, pvtKey, values) {
    // console.log("gettting signature", signingAddress, pvtKey, values);
  
    let hashToSign = await ethers.utils.solidityKeccak256(
      ['address', 'uint256', 'uint256'], //for beneficiary, withdrawAmount, signatureCreatedAt
      values
    );
  
    // console.log("hashToSign", hashToSign);
  
    let encodedSig = web3.eth.accounts.sign(hashToSign, pvtKey);

    let signerSignedMessage = await verifySignature(
      signingAddress,
      encodedSig.signature,
      hashToSign,
      web3
    );
  
    if (signerSignedMessage) {
      return encodedSig.signature;
    } else {
      throw console.log("Signer is not the signingAddress!");
    }
  }


exports.getSignature = getSignature;
