const { RPC_URL_MAINNET } = require("../constants")
console.log(RPC_URL_MAINNET)
const { logger } = require("../settings")
const { Web3 } = require("web3")

async function getLatestBlockNumber() {
    try {
        logger.info(`getting latest block number`)
        const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL_MAINNET))
        const blockNumber = await web3.eth.getBlockNumber()
        return Number(blockNumber)
    } catch (e) {
        logger.error(`Error getting latest block number: ${e}`)
        return null
    }
}
module.exports = {
    getLatestBlockNumber,
}
