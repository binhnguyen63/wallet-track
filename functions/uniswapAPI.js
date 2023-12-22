const axios = require("axios")
require("dotenv").config()
const UNISWAP_SUBGRAPH_ENDPOINT = [
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    "https://api.thegraph.com/subgraphs/name/ianlapham/uniswapv2",
    "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap",
]

async function getToken(contractAddress) {
    try {
        for (const endpoint of UNISWAP_SUBGRAPH_ENDPOINT) {
            // Use for...of instead of for...in
            const res = await axios.post(endpoint, {
                query: `
        {
            token(id:"${contractAddress}") {
              symbol
              name
            }
          }
        `,
            })
            if (res.data.data.token !== null) {
                return res.data.data.token.symbol
            }
        }
    } catch (e) {
        console.log(e)
        throw new Error("error getting ")
    }
}
module.exports = {
    getToken,
}

// deprecared code
