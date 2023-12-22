const { Web3 } = require("web3")
const axios = require("axios")
const { ethers } = require("ethers")
require("dotenv").config()
const fs = require("fs")
const cheerio = require("cheerio")

const { EmbedBuilder, WebhookClient } = require("discord.js")
const UNISWAP_CONTRACT_NAME = ["swaprouter", "UniversalRouter"]

async function getLatestBlockNumber(RPC_URL) {
    try {
        const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL))
        const blockNumber = await web3.eth.getBlockNumber()
        return blockNumber
    } catch (e) {
        console.log(e)
        throw new Error("Error when getting latest block number", e)
    }
}

async function filterNewTx(txLst, monitorTarget) {
    if (txLst.length < 1) {
        return []
    }
    try {
        const lastMonitoredTimeStamp = Number(monitorTarget.lastMonitoredTimeStamp)

        const newTxLst = txLst.filter(
            (tx) => Number(tx.timeStamp) > lastMonitoredTimeStamp && (tx.isError === "0" || tx.txreceipt_status === "1")
        )

        return newTxLst
    } catch (e) {
        console.log(e)
        throw new Error("error processing TX", e)
    }
}

async function readTx(tx, contractName, etherscanLink) {
    try {
        const output = {
            event: "",
            from: tx.from,
            to: tx.to,
            timeStamp: tx.timeStamp,
            contractName: contractName,
            function: tx.functionName,
            inAmount: "0",
            outAmount: "0",
            inToken: "",
            outToken: "",
            etherscanLink: `${etherscanLink}tx/${tx.hash}`,
        }

        for (const uniswapContract of UNISWAP_CONTRACT_NAME) {
            if (contractName.toLowerCase().includes(uniswapContract.toLowerCase())) {
                output.event = "uniswap"
                output.contractName = "uniswap"
                // const decodedLogs = await getUniswapTransactionLogs(tx.hash)
                // let depositLogs = []
                // let transferLogs = []

                // decodedLogs.forEach((txLog) => {
                //     if (txLog !== null && txLog.name.toLowerCase() == "deposit") {
                //         depositLogs.push(txLog)
                //     }
                //     if (txLog !== null && txLog.name.toLowerCase() == "transfer") {
                //         transferLogs.push(txLog)
                //     }
                // })

                // for (const transferLog of transferLogs) {
                //     for (let i = 0; i < 2; i++) {
                //         const arg = transferLog.args[i]

                //         if (arg.toLowerCase() === tx.from.toLowerCase()) {
                //             if (i === 0) {
                //                 output["outAmount"] = ethers.parseUnits(transferLog.args[2].toString())
                //                 output["outToken"] = await getToken(transferLog.address)
                //                 break
                //             }
                //             if (i === 1) {
                //                 output["inAmount"] = ethers.parseUnits(transferLog.args[2].toString())
                //                 output["inToken"] = await getToken(transferLog.address)
                //                 break
                //             }
                //         }
                //     }
                // }

                // if (depositLogs.length > 1) {
                //     throw new Error("there are two deposit logs at readTx function")
                // }

                // if (output["outAmount"] === "0") {
                //     output["outAmount"] = depositLogs[0].args[1].toString()
                //     output["outToken"] = await getToken(depositLogs[0].address)
                // }

                return
            }
        }
        if (tx.value !== "0") {
            output.outAmount = ethers.formatEther(tx.value).toString()
            output.outToken = "ETH"
        }
        output.event = "normal-transaction"
        return output
    } catch (e) {
        console.log(e)
        throw new Error("error reading transaction event")
    }
}

async function updateMonitorAddressData(
    needToUpdatedMonitorTarget,
    monitorTargets,
    lastMonitoredTimeStamp,
    lastMonitoredBlock
) {
    for (const monitorTarget of monitorTargets) {
        if (monitorTarget.address === needToUpdatedMonitorTarget.address) {
            monitorTarget.lastMonitoredTimeStamp = lastMonitoredTimeStamp
            monitorTarget.lastMonitoredBlock = lastMonitoredBlock
        }
    }
    const updatedJsonData = JSON.stringify(monitorTargets, null, 2)
    fs.writeFileSync("./data/monitor-addresses.json", updatedJsonData, "utf-8")
}

async function convertObjectToStr(object, monitorTarget) {
    const from =
        object.from.toLowerCase() === monitorTarget.address.toLowerCase() ? monitorTarget.nickName : object.from
    const to = object.to.toLowerCase() === monitorTarget.address.toLowerCase() ? monitorTarget.nickName : object.to

    const output = `From: ${from}\nTo: ${to}\nAmount Sent: ${object.outAmount} ETH\nContract Name: ${object.contractName}\nFunction Invoked: ${object.function}`
    return output
}

async function getTxAction(tx, monitorTarget, etherscanLink) {
    try {
        const txUrl = `${etherscanLink}tx/${tx.hash}`
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

        return output.join(" ")
    } catch (e) {
        console.log(e)
        throw new Error("Error getting transaction action")
    }
}

async function sendToDiscord(monitorTarget, msg, tx, etherscanLink, id, token) {
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
    const description = `[${monitorTarget.nickName}](${etherscanLink}address/${
        monitorTarget.address
    })\n\nTransaction Actions:\n\`${msg}\nTx Value: ${ethers.formatEther(
        tx.value
    )} eth\`\n\n[Etherscan Link](${etherscanLink}tx/${tx.hash})`
    const webhook = new WebhookClient({
        id: id,
        token: token,
    })
    const embed = new EmbedBuilder()
        .setTitle(`New Transaction Detected`)
        .setColor(0x00ffff)
        .setDescription(description)
        .setFooter({ text: `Tx submitted at ${formattedTime}` }) // Set color (you can use hex codes)

    await webhook.send({
        embeds: [embed],
    })
}

async function addUser(nickName, address) {
    try {
        const monitorTargets = JSON.parse(fs.readFileSync("./data/monitor-addresses.json", "utf-8"))
        const newUser = {
            nickName: nickName,
            address: address,
            lastMonitoredTimeStamp: "0",
            lastMonitoredBlock: "",
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
    getLatestBlockNumber,
    filterNewTx,
    readTx,
    updateMonitorAddressData,
    getTxAction,
    sendToDiscord,
    convertObjectToStr,
    addUser,
}
