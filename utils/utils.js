const axios = require("axios")
const ethers = require("ethers")
require("dotenv").config()
const fs = require("fs")
const cheerio = require("cheerio")
const { logger } = require("../settings")
const { EmbedBuilder, WebhookClient } = require("discord.js")
const UNISWAP_CONTRACT_NAME = ["swaprouter", "UniversalRouter"]
const { ETHERSCAN_MAINNET } = require("../constants")
const { getContractName } = require("./etherscanApi")
const WEBHOOK_ID = process.env.WEBHOOK_ID
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN

async function updateMonitorTargetData(
    needToUpdatedMonitorTarget,
    monitorTargets,
    lastMonitoredTimeStamp,
    lastMonitoredBlock
) {
    try {
        logger.info(`Updating monitor target data`)
        for (const monitorTarget of monitorTargets) {
            if (monitorTarget.address === needToUpdatedMonitorTarget.address) {
                monitorTarget.lastMonitoredTimeStamp = Number(lastMonitoredTimeStamp)
                monitorTarget.lastMonitoredBlock = Number(lastMonitoredBlock)
            }
        }
        const updatedJsonData = JSON.stringify(monitorTargets, null, 2)
        fs.writeFileSync("./data/monitor-addresses.json", updatedJsonData, "utf-8")
    } catch (e) {
        logger.error(`Error updating monitor target data ${e}`)
    }
}

async function convertObjectToStr(txnData, monitorTarget) {
    const from =
        txnData.from.toLowerCase() === monitorTarget.address.toLowerCase() ? monitorTarget.nickName : txnData.from
    const to = txnData.to.toLowerCase() === monitorTarget.address.toLowerCase() ? monitorTarget.nickName : txnData.to

    const output = `From: ${from}\nTo: ${to}\nAmount Sent: ${txnData.outAmount} ETH\nContract Name: ${txnData.contractName}\nFunction Invoked: ${txnData.function}`
    return output
}

async function getTxnAction1(tx, monitorTarget) {
    try {
        logger.info(`[ETHERSCAN] Fetching txn data --ver 1: ${tx.hash}`)
        const txUrl = `${ETHERSCAN_MAINNET}tx/${tx.hash}`
        const res = await axios.get(txUrl)
        const html = res.data
        const $ = cheerio.load(html)

        let parentElement = $("#wrapperContent")

        if (parentElement.length === 0) {
            const ele = $('[data-bs-content="Highlighted events of the transaction."]')
            parentElement = ele.parent().next()
        }

        let output = []
        const changeMade = new Map()
        const addressLst = [tx.to.toLowerCase(), tx.from.toLowerCase()]

        if (parentElement.length > 0) {
            const textContainDiv = parentElement.children("div")
            const textContainDiv2 = textContainDiv.children("div")
            const allTextArr = textContainDiv2.text().split(/\s+/)

            const textContainDiv3 = textContainDiv2.children()
            textContainDiv3.each((_, textEle) => {
                const text = $(textEle).text()
                const textSplitted = text.split(" ")
                for (const textPart of textSplitted) {
                    if (textPart.startsWith("0x")) {
                        const addressPrefix = textPart.slice(0, 3).toLowerCase()
                        const addressSuffix = textPart.slice(-4).toLowerCase()
                        const preOutputLen = output.length
                        for (const address of addressLst) {
                            if (address.slice(0, 3) === addressPrefix && address.slice(-4) === addressSuffix) {
                                if (address === monitorTarget.address.toLowerCase()) {
                                    changeMade.set(textPart.toLowerCase(), monitorTarget.nickName)
                                    output.push(monitorTarget.nickName)
                                } else {
                                    output.push(address)
                                }
                            }
                        }
                        if (output.length === preOutputLen) {
                            output.push(textPart)
                        }
                    } else {
                        if (textPart !== "") {
                            output.push(textPart)
                        }
                    }
                }
            })

            if (allTextArr.length > output.length) {
                for (let i = 0; i < allTextArr.length; i++) {
                    if (changeMade.has(allTextArr[i].toLowerCase())) {
                        allTextArr[i] = changeMade.get(allTextArr[i].toLowerCase())
                    }
                }
                output = allTextArr
            }
        }
        if (output.length === 0) {
            throw new Error("txn actions is empty")
        }

        return output.join(" ")
    } catch (e) {
        logger.error(`Error getting txn action --ver 1: ${e}`)
        return null
    }
}

async function getTxnAction2(tx, monitorTarget) {
    try {
        const contractName = await getContractName(tx.to === monitorTarget.address ? tx.from : tx.to)
        const txnData = {
            event: "normal-transaction",
            from: tx.from,
            to: tx.to,
            timeStamp: tx.timeStamp,
            contractName: contractName,
            function: tx.functionName,
            inAmount: "0",
            outAmount: "0",
            inToken: "",
            outToken: "",
            etherscanLink: `${ETHERSCAN_MAINNET}tx/${tx.hash}`,
        }
        logger.info(`fetching txn action --ver 2 - ${tx.hash}`)
        for (const uniswapContract of UNISWAP_CONTRACT_NAME) {
            if (contractName.toLowerCase().includes(uniswapContract.toLowerCase())) {
                txnData.event = "uniswap"
                txnData.contractName = "uniswap"
            }
        }
        if (tx.value !== "0") {
            txnData.outAmount = ethers.formatEther(tx.value).toString()
            txnData.outToken = "ETH"
        }
        const txnAction = await convertObjectToStr(txnData, monitorTarget)
        return txnAction
    } catch (e) {
        logger.error(`Error fetching txn actions --ver2: ${e}`)
        return null
    }
}

async function getTxAction(tx, monitorTarget) {
    try {
        const [result1, result2] = await Promise.all([
            getTxnAction1(tx, monitorTarget),
            getTxnAction2(tx, monitorTarget),
        ])
        if (result1) {
            return result1
        } else if (result2) {
            return result2
        }
    } catch (e) {
        logger.error(`Error getting transaction action: ${e}`)
    }
}

async function sendToDiscord(monitorTarget, msg, tx) {
    try {
        logger.info(`${monitorTarget.nickName} Sending to Discord: ${tx.hash}`)
        const unixTimeStamp = tx.timeStamp * 1000 //convert to milliseconds
        const date = new Date(unixTimeStamp)
        const year = date.getFullYear()
        const month = date.getMonth() + 1 // Months are zero-based, so add 1
        const day = date.getDate()
        const hours = date.getHours()
        const minutes = date.getMinutes()
        const seconds = date.getSeconds()
        const formattedTime = `${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}-${year} ${hours
            .toString()
            .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        const description = `[${monitorTarget.nickName}](${ETHERSCAN_MAINNET}address/${
            monitorTarget.address
        })\n\nTransaction Actions:\n\`${msg}\nTx Value: ${ethers.formatEther(
            tx.value
        )} eth\`\n\n[Etherscan Link](${ETHERSCAN_MAINNET}tx/${tx.hash})`
        const webhook = new WebhookClient({
            id: WEBHOOK_ID,
            token: WEBHOOK_TOKEN,
        })
        const embed = new EmbedBuilder()
            .setTitle(`New Transaction Detected`)
            .setColor(0x00ffff)
            .setDescription(description)
            .setFooter({ text: `Tx submitted at ${formattedTime}` }) // Set color (you can use hex codes)

        await webhook.send({
            embeds: [embed],
        })
        return true
    } catch (e) {
        logger.error(`[WARNING] ${monitorTarget.nickName} Error sending to discord: ${tx.hash}`)
        return false
    }
}

async function addUser(nickName, address) {
    try {
        const monitorTargets = JSON.parse(fs.readFileSync("./data/monitor-addresses.json", "utf-8"))
        const newUser = {
            nickName: nickName,
            address: address,
            lastMonitoredTimeStamp: null,
            lastMonitoredBlock: null,
        }
        monitorTargets.push(newUser)
        const updatedJsonData = JSON.stringify(monitorTargets, null, 2)
        fs.writeFileSync("./data/monitor-addresses.json", updatedJsonData, "utf-8")
        console.log(`success adding user ${nickName} at ${address}`)
    } catch (e) {
        console.log(e)
    }
}

module.exports = {
    updateMonitorTargetData,
    getTxAction,
    sendToDiscord,
    convertObjectToStr,
    addUser,
}
