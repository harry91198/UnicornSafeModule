const config = require("../utils/config.json")
const privateKey = config.privateKey;
const threshold = config.threshold;
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(config.connectionURL))
const {getSignature} = require("./getSignature");


//Script which fetches basic params fron ./utils/config.json and calls getSignature(...args)
async function main() {
    const createdAt = Math.floor(Date.now()/1000);  //defining same createdAt for all signers
    console.log("toAccount: ", config.toAddress)
    console.log("amount: ", config.amount)
    console.log("createdAt: ", createdAt )
    for(i=0;i<threshold;i++){
      const {address: admin} = web3.eth.accounts.wallet.add(privateKey[i]);
      console.log(`From ${i+1} Admin: `, admin)
      const signature = await getSignature(admin, privateKey[i], [config.toAddress, config.amount, createdAt]);
      console.log("signature recieved: ", signature)
    }

}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });