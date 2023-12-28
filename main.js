require("dotenv").config()
const fs = require("fs")
const { INTERVAL } = require("./constants")
const { logger } = require("./settings")
const { updateMonitorTargetData, getTxAction, sendToDiscord } = require("./utils/utils")
const { fetchTxLst } = require("./utils/etherscanApi")

async function main() {
    try {
        const monitorTargets = JSON.parse(fs.readFileSync("./data/monitor-addresses.json", "utf-8"))
        for (const monitorTarget of monitorTargets) {
            const txLst = await fetchTxLst(monitorTarget)
            for (const tx of txLst) {
                const txAction = await getTxAction(tx, monitorTarget)
                await sendToDiscord(monitorTarget, txAction, tx)
                await updateMonitorTargetData(monitorTarget, monitorTargets, tx.timeStamp, tx.blockNumber)
                await new Promise((resolve) => setTimeout(resolve, 1000))
            }
            await new Promise((resolve) => setTimeout(resolve, 1000))
        }
    } catch (e) {
        logger.error(e)
    }
    setTimeout(main, INTERVAL)
}
main()
