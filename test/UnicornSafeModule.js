const DEBUG = false;    /// make it true to enable console.log(...)s
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");

const { expect } = require("chai");
const { ethers, web3, config } = require("hardhat");

const ADDRESS_0 = "0x0000000000000000000000000000000000000000"
const GnosisSafe = artifacts.require("@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol:GnosisSafe")
const ProxyFactory = artifacts.require("@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol:GnosisSafeProxyFactory");

const TestToken = artifacts.require("./TestToken.sol")

const safeDetails = require('@gnosis.pm/safe-contracts/build/artifacts/contracts/GnosisSafe.sol/GnosisSafe.json');
const { getSignature } = require("../scripts/getSignature");
const GnosisSafeProxy = new web3.eth.Contract(safeDetails.abi)
GnosisSafeProxy.options.data = safeDetails.bytecode;




let execTransaction = async function (safe, safeInstance, to, value, data, operation, message, account) {
  let nonce = await safeInstance.methods.nonce().call()
  let threshold = await safeInstance.methods.getThreshold().call()
  let owners = await safeInstance.methods.getOwners().call()
  let transactionHash = await safeInstance.methods.getTransactionHash(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, nonce).call()
  if (DEBUG) console.log(message, ": owners", owners, "nonce: ", nonce, "transactionHash: ", transactionHash, "data", data, "account: ", account, "threshsold:", threshold)
  let sig = '0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266000000000000000000000000000000000000000000000000000000000000000001'
  const tx = await safe.execTransaction(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, sig)
}



let currTime;   // used everywhere in Module function call when _createdAt parameter has to be assigned
//set the value of current time
let setTime = async function () {
  currTime = await time.latest();
}



// gets the signature signed by owners of Safe Contract
let getSignatureArray = async function (currTime, threshold, accounts, withdrawAmount) {
  const acc = config.networks.hardhat.accounts;
  let signatureByAdmin = []
  for (i = 0; i < threshold; i++) {
    const index = i; // first wallet, increment for next wallets
    const wallet1 = ethers.Wallet.fromMnemonic(acc.mnemonic, acc.path + `/${index}`);

    const adminpvtKey = wallet1.privateKey
    if (DEBUG) console.log("accounts used to sign: ", accounts[index].address, adminpvtKey)
    signatureByAdmin.push(await getSignature(accounts[index].address, adminpvtKey, [accounts[5].address, withdrawAmount, currTime]))
  }
  return signatureByAdmin;
}




contract('UnicornSafeModule', function () {
  let accounts


  let gnosisSafeMasterCopy
  let proxyFactory
  let UnicornToken

  let safeInstance
  let safe
  let unicornSafeModule


  let signatureByAdmin = []
  let withdrawAmount = 50
  const CALL = 0

  before(async function () {
    accounts = await ethers.getSigners();
    //sets time
    await setTime();
    // Create Master Copy
    gnosisSafeMasterCopy = await GnosisSafe.new()

    // create Proxy factory
    proxyFactory = await ProxyFactory.new()

    // Setup Unicorn test token
    UnicornToken = await TestToken.new({ from: accounts[0].address })
    if (DEBUG) console.log("gnosisSafeMasterCopy threshold: ", gnosisSafeMasterCopy.address)
    if (DEBUG) console.log("proxyFactory.address: ", proxyFactory.address)
    if (DEBUG) console.log("UnicornToken.address: ", UnicornToken.address)

    const setupValues =
      [
        accounts[0].address,
        [accounts[0].address, accounts[1].address],
        2,
        ADDRESS_0,
        ADDRESS_0
      ]
    const setupType =
      [
        'address',
        'address[]',
        'uint256',
        'address',
        'address'
      ]
    let setupData = await ethers.utils.solidityKeccak256(
      setupType,
      setupValues
    );

    // creating safe proxy contract from Gnosis Safe Proxy contract
    const createProxyData = await proxyFactory.createProxy(gnosisSafeMasterCopy.address, setupData)
    if (DEBUG) console.log("createProxyData: ", createProxyData.logs[0].args.proxy)

    // initialzing and assigning address to our (Gnosis) Safe Proxy Contract
    const MySafeProxy = await ethers.getContractFactory("@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol:GnosisSafe");
    safe = await MySafeProxy.attach(
      createProxyData.logs[0].args.proxy
    );

    //setting up Safe Contract
    const safeSetupData = await safe.setup([accounts[0].address, accounts[1].address], 1, ADDRESS_0, "0x", ADDRESS_0, ADDRESS_0, 0, ADDRESS_0)
    safeInstance = GnosisSafeProxy.clone()
    safeInstance.options.address = createProxyData.logs[0].args.proxy;


    // deploying our Safe Module with withdrawing token feature - UnicornSafeModule
    const UnicornSafeModule = await ethers.getContractFactory("UnicornSafeModule")
    unicornSafeModule = await UnicornSafeModule.deploy(safe.address, UnicornToken.address)
    if (DEBUG) console.log("safe & USM: ", safe.address, unicornSafeModule.address)

    //Enabling our Safe Module on Safe Proxy contract
    const enableModuleData = await safeInstance.methods.enableModule(unicornSafeModule.address).encodeABI()

    // executing transaction (to enableModule) on safe proxy contract
    await execTransaction(safe, safeInstance, safe.address, 0, enableModuleData, CALL, "enable module", accounts[0].address)


  })
  it('should execute token transfer to safe(proxy) contract', async () => {
    const modules = await safe.isModuleEnabled(unicornSafeModule.address)
    if (DEBUG) console.log("modules : ", modules)

    assert.equal(await safe.isModuleEnabled(unicornSafeModule.address), true)

    // tramsferring tokens to SafeProxy Contract
    await UnicornToken.transfer(safe.address, 1000, { from: accounts[0].address })
    assert.equal(1000, await UnicornToken.balanceOf(safe.address))
    assert.equal(0, await UnicornToken.balanceOf(accounts[1].address))

  })
  it('should create signature/s', async () => {
    const modules = await safe.isModuleEnabled(unicornSafeModule.address)
    if (DEBUG) console.log("modules : ", modules)

    assert.equal(await safe.isModuleEnabled(unicornSafeModule.address), true)
    assert.equal(1000, await UnicornToken.balanceOf(safe.address))

    // fetching current threshold number from SafeProxy Contract
    let threshold = await safeInstance.methods.getThreshold().call()
    if (DEBUG) console.log("threshold : ", threshold)

    if (DEBUG) console.log("currTime : ", currTime)

    //getting signatures signed by owners(admins) of SafeProxy Contract
    signatureByAdmin = await getSignatureArray(currTime, threshold, accounts, withdrawAmount);

    if (DEBUG) console.log("signatureByAdmin: ", signatureByAdmin)

    // we should get as many signatures as threshold number
    assert.equal(threshold, signatureByAdmin.length)
  })
  it('should call withdrawTokens from our module - UnicornSafeModule', async () => {
    let threshold = await safeInstance.methods.getThreshold().call()
    if (DEBUG) console.log("threshold : ", threshold)

    if (DEBUG) console.log("currTime : ", currTime)
    assert.equal(threshold, signatureByAdmin.length)

    if (DEBUG) console.log("signatureByAdmin: ", signatureByAdmin)

    // function call to withdraw 50 tokens for account[5] as beneficiary by accounts[5]
    await unicornSafeModule.connect(accounts[5]).withdrawToken(accounts[5].address, 50, currTime, signatureByAdmin)

    //balance check
    assert.equal(950, await UnicornToken.balanceOf(safe.address))
    assert.equal(50, await UnicornToken.balanceOf(accounts[5].address))
  })
  it('should not withdraw tokens again with same sig', async () => {
    let threshold = await safeInstance.methods.getThreshold().call()
    if (DEBUG) console.log("threshold : ", threshold)

    if (DEBUG) console.log("currTime : ", currTime)
    assert.equal(threshold, signatureByAdmin.length)

    if (DEBUG) console.log("signatureByAdmin: ", signatureByAdmin)

    await expect(unicornSafeModule.connect(accounts[5]).withdrawToken(accounts[5].address, 50, currTime, signatureByAdmin)).to.be.revertedWith("Token already withdrawed by this user")
    
    assert.equal(950, await UnicornToken.balanceOf(safe.address))
    assert.equal(50, await UnicornToken.balanceOf(accounts[5].address))
  })
  it('should not withdraw tokens after expiry time', async () => {
    let threshold = await safeInstance.methods.getThreshold().call()
    if (DEBUG) console.log("threshold : ", threshold)

    let expiryTime = Number(await unicornSafeModule.expiryTime())
    if (DEBUG) console.log("expiryTime : ", expiryTime)

    let currTime = await time.latest();
    if (DEBUG) console.log("currTime : ", currTime)

    let signatureByAdmin = await getSignatureArray(currTime, threshold, accounts, withdrawAmount);

    //increasing time by 3600 which is much more than current expiry time(600)
    await time.increase(3600);

    assert.equal(threshold, signatureByAdmin.length)
    if (DEBUG) console.log("signatureByAdmin: ", signatureByAdmin)

    await expect(unicornSafeModule.connect(accounts[5]).withdrawToken(accounts[5].address, 50, currTime, signatureByAdmin)).to.be.revertedWith("Signature expired")
    
    assert.equal(950, await UnicornToken.balanceOf(safe.address))
    assert.equal(50, await UnicornToken.balanceOf(accounts[5].address))
  })
  it('should not withdraw tokens from nonOwners` signed signature', async () => {
    let threshold = await safeInstance.methods.getThreshold().call()

    let currTime = await time.latest();
    if (DEBUG) console.log("currTime : ", currTime)

    //creating signatures by accounts who are not the owner of SafeProxy Contract
    const acc = config.networks.hardhat.accounts;
    signatureByAdmin = []
    for (i = 0; i < threshold; i++) {
      const index = i + 4; // using account[4] to get pvtKey & sign
      const wallet1 = ethers.Wallet.fromMnemonic(acc.mnemonic, acc.path + `/${index}`);

      const adminpvtKey = wallet1.privateKey
      if (DEBUG) console.log("accounts used to sign: ", accounts[index].address, adminpvtKey)
      signatureByAdmin.push(await getSignature(accounts[index].address, adminpvtKey, [accounts[5].address, 50, currTime]))
    }

    if (DEBUG) console.log("currTime : ", currTime)

    if (DEBUG) console.log("signatureByAdmin: ", signatureByAdmin)
    await expect(unicornSafeModule.connect(accounts[5]).withdrawToken(accounts[5].address, 50, currTime, signatureByAdmin)).to.be.revertedWith("Signer is not Safe owner")

    assert.equal(950, await UnicornToken.balanceOf(safe.address))
    assert.equal(50, await UnicornToken.balanceOf(accounts[5].address))
  })
  it('should not withdraw tokens if withdrawer changes params like amount(toBeReceived)', async () => {
    let threshold = await safeInstance.methods.getThreshold().call()
    let currTime = await time.latest();
    if (DEBUG) console.log("currTime : ", currTime)

    let signatureByAdmin = await getSignatureArray(currTime, threshold, accounts, withdrawAmount);

    if (DEBUG) console.log("signatureByAdmin: ", signatureByAdmin)

    // amount in withdrawToken function params is changed to 100, whereas signatures are created for withdrawAmout(50)
    await expect(unicornSafeModule.connect(accounts[5]).withdrawToken(accounts[5].address, 100, currTime, signatureByAdmin)).to.be.revertedWith("Signer is not Safe owner")

    assert.equal(950, await UnicornToken.balanceOf(safe.address))
    assert.equal(50, await UnicornToken.balanceOf(accounts[5].address))
  })
  it('should not withdraw tokens after expiry time by increasing createdAt(currTime here) directly in fn call params', async () => {
    let threshold = await safeInstance.methods.getThreshold().call()
    if (DEBUG) console.log("threshold : ", threshold)

    let expiryTime = Number(await unicornSafeModule.expiryTime())
    if (DEBUG) console.log("expiryTime : ", expiryTime)

    let currTime = await time.latest();
    if (DEBUG) console.log("currTime : ", currTime)

    let signatureByAdmin = await getSignatureArray(currTime, threshold, accounts, withdrawAmount);

    await time.increase(3600);

    assert.equal(threshold, signatureByAdmin.length)
    if (DEBUG) console.log("signatureByAdmin: ", signatureByAdmin)

    // createdAt params is increased by 3600 more than the created time for this fn call
    await expect(unicornSafeModule.connect(accounts[5]).withdrawToken(accounts[5].address, 50, currTime + 3600, signatureByAdmin)).to.be.revertedWith("Signer is not Safe owner")
    
    assert.equal(950, await UnicornToken.balanceOf(safe.address))
    assert.equal(50, await UnicornToken.balanceOf(accounts[5].address))
  })
  it('should meet the threshold', async () => {
    // changing threshold from 1 to 2 for our SafeProxy Contract
    const changeThresholdData = await safeInstance.methods.changeThreshold(2).encodeABI()
    await execTransaction(safe, safeInstance, safe.address, 0, changeThresholdData, CALL, "change threshold", accounts[0].address)
    
    let threshold = await safeInstance.methods.getThreshold().call()
    if (DEBUG) console.log("threshold : ", threshold)

    let currTime = await time.latest();
    if (DEBUG) console.log("currTime : ", currTime)

    // creating signature from one owner wallet only
    const tryWithOneThreshold = 1;
    let signatureByAdmin = await getSignatureArray(currTime, tryWithOneThreshold, accounts, withdrawAmount);

    if (DEBUG) console.log("signatureByAdmin: ", signatureByAdmin)

    // it will fails as threshold in SafeProxy Contract is 2 but we providing only 1 signature. To meet threshold condition in UnicornSafeModule, total 2 signatures should be provided here too
    await expect(unicornSafeModule.connect(accounts[5]).withdrawToken(accounts[5].address, 50, currTime, signatureByAdmin)).to.be.revertedWith("Threshold not met, provide threshold no of sigs")
    
    assert.equal(950, await UnicornToken.balanceOf(safe.address))
    assert.equal(50, await UnicornToken.balanceOf(accounts[5].address))
  })
  it('should fail if withdraw amount is more than safe`s token balance', async () => {
    let threshold = await safeInstance.methods.getThreshold().call()
    if (DEBUG) console.log("threshold : ", threshold)

    let currTime = await time.latest();
    if (DEBUG) console.log("currTime : ", currTime)
    // withdraw for a very high amount
    const veryHighWithdrawAmount = 2000
    let signatureByAdmin = await getSignatureArray(currTime, threshold, accounts, veryHighWithdrawAmount);

    if (DEBUG) console.log("signatureByAdmin: ", signatureByAdmin)

    //contract fn call fails as SafeProxy contract's Unicorn token balance is less than the withdrawAmount
    await expect(unicornSafeModule.connect(accounts[5]).withdrawToken(accounts[5].address, veryHighWithdrawAmount, currTime, signatureByAdmin)).to.be.revertedWith("Safe: Insufficient Balance")
    assert.equal(950, await UnicornToken.balanceOf(safe.address))
    assert.equal(50, await UnicornToken.balanceOf(accounts[5].address))
  })
  it('change expiryTime by nonOwner', async () => {
    //changing expiry time from accounts[5], which is not the owner, resulting in trxn fail
    await expect(unicornSafeModule.connect(accounts[5]).setExpiryTime(1000)).to.be.revertedWith("Ownable: caller is not the owner")

  })
  it('change expiryTime by owner', async () => {
    let owner = await unicornSafeModule.owner()
    if (DEBUG) console.log("owner : ", owner)
    assert.equal(accounts[0].address, owner)

    let expiryTime = Number(await unicornSafeModule.expiryTime())
    if (DEBUG) console.log("expiryTime : ", expiryTime)
    assert.equal(600, expiryTime)

    //changing expiry time from accounts[0], which is the owner, resulting in successful trxn
    await unicornSafeModule.connect(accounts[0]).setExpiryTime(1000);

    let newExpiryTime = Number(await unicornSafeModule.expiryTime())
    if (DEBUG) console.log("newExpiryTime : ", newExpiryTime)
    assert.equal(1000, newExpiryTime)

  })
})