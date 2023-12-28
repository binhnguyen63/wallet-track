const axios = require("axios")
require("dotenv").config()
const { logger } = require("../settings")
const { ETHERSCAN_ENDPOINT_MAINNET, BLOCK_RANGE } = require("../constants")
const { getLatestBlockNumber } = require("./web3Func")
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

async function fetchTxLst(monitorTarget) {
    try {
        const latestBLockNumber = await getLatestBlockNumber()
        if (!latestBLockNumber) {
            throw new Error(`invalid block number`)
        }

        const initialFetch = monitorTarget.lastMonitoredBlock ? false : true
        logger.info(`[ETHERSCAN] [${monitorTarget.nickName}] Fetching transaction Data`)
        const res = await axios.get(`${ETHERSCAN_ENDPOINT_MAINNET}?module=account`, {
            params: {
                action: "txlist",
                address: monitorTarget.address,
                startblock: initialFetch ? latestBLockNumber * BLOCK_RANGE : Number(monitorTarget.lastMonitoredBlock),
                /*latestBLockNumber * BLOCK_RANGE*/
                endblock: latestBLockNumber,
                /*latestBLockNumber*/
                page: 1,
                offset: initialFetch ? 1 : 10,
                sort: initialFetch ? "desc" : "asc",
                apikey: ETHERSCAN_API_KEY,
            },
        })

        if (res.status !== 200 || res.data.result.length === 0) {
            throw new Error("Res status is not 200 or txn data lst returned is empty")
        }
        let txLst = res.data.result
        const lastMonitoredTimeStamp = monitorTarget.lastMonitoredTimeStamp
        if (!lastMonitoredTimeStamp) {
            return txLst
        }
        txLst = txLst.filter(
            (tx) => Number(tx.timeStamp) > lastMonitoredTimeStamp && (tx.isError === "0" || tx.txreceipt_status === "1")
        )
        return txLst
    } catch (e) {
        logger.error(`${monitorTarget.nickName} Error fetching txn data: ${e}`)
        return []
    }
}

async function getContractName(contractAddress) {
    try {
        logger.info(`[ETHERSCAN] getting contract name: ${contractAddress}`)
        const res = await axios.get(`${ETHERSCAN_ENDPOINT_MAINNET}?module=contract`, {
            params: {
                action: "getsourcecode",
                address: contractAddress,
                apikey: ETHERSCAN_API_KEY,
            },
        })

        if (res.status === 200 && res.data.message === "OK") {
            return res.data.result[0].ContractName
        } else {
            throw new Error("")
        }
    } catch (e) {
        logger.error(`Error getting contract name: ${e}`)
        return "unknown contract name"
    }
}

module.exports = {
    fetchTxLst,
    getContractName,
}
