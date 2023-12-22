require("dotenv").config()
const fs = require("fs")

const { fetchTxData, getContractName } = require("./functions/etherscanAPI")
const WEBHOOK_ID = process.env.WEBHOOK_ID
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN
const RPC_URL_MAINNET = process.env.RPC_URL_MAINNET
const INTERVAL = Number(process.env.INTERVAL)
const {
    getLatestBlockNumber,
    filterNewTx,
    readTx,
    updateMonitorAddressData,
    getTxAction,
    sendToDiscord,
    convertObjectToStr,
} = require("./functions/manipulateTxData")
const ETHERSCAN_ENDPOINT_MAINNET = process.env.ETHERSCAN_ENDPOINT_MAINNET
const ETHERSCAN_MAINNET = process.env.ETHERSCAN_MAINNET

async function main() {
    try {
        const monitorTargets = JSON.parse(fs.readFileSync("./data/monitor-addresses.json", "utf-8"))
        for (const monitorTarget of monitorTargets) {
            const latestBLockNumber = Number(await getLatestBlockNumber(RPC_URL_MAINNET))
            const txLst = await fetchTxData(
                monitorTarget,
                latestBLockNumber,
                ETHERSCAN_ENDPOINT_MAINNET,
                monitorTarget.lastMonitoredBlock ? false : true
            )
            const filteredtxLst = await filterNewTx(txLst, monitorTarget)

            for (const tx of filteredtxLst) {
                let txAction = await getTxAction(tx, monitorTarget, ETHERSCAN_MAINNET)
                if (!txAction) {
                    const contractName = await getContractName(tx.to, ETHERSCAN_ENDPOINT_MAINNET)

                    const res = await readTx(tx, contractName, ETHERSCAN_MAINNET)

                    if (res) {
                        txAction = await convertObjectToStr(res, monitorTarget)
                    }
                }
                await sendToDiscord(monitorTarget, txAction, tx, ETHERSCAN_MAINNET, WEBHOOK_ID, WEBHOOK_TOKEN)
                await updateMonitorAddressData(monitorTarget, monitorTargets, tx.timeStamp, tx.blockNumber)
                await new Promise((resolve) => setTimeout(resolve, 1000))
            }
            await new Promise((resolve) => setTimeout(resolve, 1000))
        }
    } catch (e) {
        console.error(e)
    }
    setTimeout(main, INTERVAL)
}
main()
