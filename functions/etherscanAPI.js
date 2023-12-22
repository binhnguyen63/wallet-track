const axios = require("axios")
const { ethers } = require("ethers")
require("dotenv").config()
const fs = require("fs")

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const BLOCK_RANGE = process.env.BLOCK_RANGE //98% within the latest block

async function fetchTxData(monitorTarget, latestBLockNumber, etherscanEndpoint, initialFetch) {
    try {
        const res = await axios.get(`${etherscanEndpoint}?module=account`, {
            params: {
                action: "account",
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
        if (res.data.message === "OK") {
            return res.data.result
        } else {
            return []
        }
    } catch (e) {
        console.log(e)
        throw new Error("Error Fetching the etherscan API", e)
    }
}

async function getContractName(contractAddress, etherscanEndpoint) {
    try {
        const res = await axios.get(`${etherscanEndpoint}?module=contract`, {
            params: {
                action: "getsourcecode",
                address: contractAddress,
                apikey: ETHERSCAN_API_KEY,
            },
        })

        if (res.data.message === "OK") {
            return res.data.result[0].ContractName
        } else {
            return "unknown-contract"
        }
    } catch (e) {
        throw new Error("Error getting contract Name", e)
    }
}

async function getUniswapTransactionLogs(txHash, etherscanEndpoint) {
    try {
        const interfacePaths = [
            "./Interfaces/IUniswapV3PoolEventsABI.json",
            "./Interfaces/IuniswapV2Pair.json",
            "./Interfaces/IWETH.json",
            "./Interfaces/IUniswapProtocalPermit2.json",
        ]

        // Fetch the transaction receipt
        const txReceipt = await axios.get(`${etherscanEndpoint}?module=proxy`, {
            params: {
                action: "eth_getTransactionReceipt",
                txhash: txHash,
                apikey: ETHERSCAN_API_KEY,
            },
        })

        const interactedContractAddresses = new Set()
        const logs = txReceipt.data.result.logs
        // console.log("log", logs)

        logs.forEach((log) => {
            // if (!ADDRESS_NO_SEARCH.includes(log.address) && log.address !== txReceipt.from) {
            interactedContractAddresses.add(log.address)
            // }
        })

        // Decode logs using the contract ABI
        if (txReceipt.data.result && logs) {
            const decodedLogs = logs.map((log) => {
                let validDecodedLog = null

                interfacePaths.forEach((path) => {
                    if (validDecodedLog !== null) {
                        return
                    }
                    const jsondata = fs.readFileSync(path, "utf-8")
                    let contractAbi = JSON.parse(jsondata)
                    let contract = new ethers.Contract(log.address, contractAbi)

                    const decodedLog = contract.interface.parseLog(log)
                    if (decodedLog !== null) {
                        decodedLog["address"] = log.address
                        validDecodedLog = decodedLog
                        return
                    }
                })

                return validDecodedLog
            })

            return decodedLogs
        }
    } catch (e) {
        console.log(e)
        throw new Error("Error getting Tx Event", e)
    }
}

module.exports = {
    fetchTxData,
    getContractName,
    getUniswapTransactionLogs,
}
