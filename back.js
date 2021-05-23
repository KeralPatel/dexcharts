const http = require('http')
const os = require('os')
const path = require('path')
const express = require('express')
const fetch = require('node-fetch')
const { writeFile } = require('fs')



/********************************

          DexPairs.xyz

*********************************/
/*        Dorian Bayart         */
/*             2021             */
/********************************/


/*
* Backend Server
*
* Fetch data from APIs
* Structure data in JSON
* Store them as file
* Expose those files
*/



const dir_home = os.homedir()
console.log(dir_home)


const HISTORY_SIZE = 150


/* DexPairs */


// Pancake data
let tokens_list = {}
let top_tokens = {}
let tokens_data = {}
let tokens_charts = {}

// Uniswap data
let uniswap_list = {}
let uniswap_top = {}
let uniswap_data = {}
let uniswap_charts = {}



// Utils
async function get(url, query = null) {
  if(query) {
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      .then((response) => response.json())
      .then(resolve)
      .catch(reject)
    });
  }
  return new Promise((resolve, reject) => {
    fetch(url)
    .then((response) => response.json())
    .then(resolve)
    .catch(reject)
  });
}


// Get Pancake's top
async function getTopTokens() {
  return await get("https://api.pancakeswap.info/api/v2/tokens")
}
async function getTopPairs() {
  return await get("https://api.pancakeswap.info/api/v2/pairs")
}

// Get Uniswap's top
const uniswap_request = `
query
  {
    tokens(first: 1000, orderBy: tradeVolumeUSD, orderDirection: desc, where: { totalLiquidity_gt: "10" } ) {
      id
      name
      symbol
      derivedETH
    }
    bundle(id: "1" ) {
      ethPrice
    }
  }
`

// Use TheGraph API - https://thegraph.com/explorer/subgraph/uniswap/uniswap-v2
async function getUniswapTopTokens() {
  return await get("https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2", uniswap_request)
}




// Program - Pancake
async function launch() {
  let tokens_data_file = {}
  let tokens_charts_file = {}
  try {
    tokens_data_file = require(path.join(dir_home, 'pancake-simple.json'))
    tokens_charts_file = require(path.join(dir_home, 'pancake-charts.json'))
  } catch(error) {
    // console.log(error)
  }

  tokens_data = tokens_data_file
  tokens_charts = tokens_charts_file


  // get data from PancakeSwap
  const top = await getTopTokens()



  const time = top.updated_at
  const tokens = top.data

  for (var token in tokens) {
    if (tokens.hasOwnProperty(token)) {
      const address = token
      const symbol = tokens[token].symbol
      const name = tokens[token].name
      const price = tokens[token].price

      // create tokens list
      tokens_list[address] = symbol


      // update tokens simple data
      tokens_data[address] = {
        s: symbol,
        n: name,
        p: price,
        t: time
      }

      // update tokens charts
      //
      if(tokens_charts[address]) {
        if(tokens_charts[address].chart_often[tokens_charts[address].chart_often.length-1]['t'] < time) {
          tokens_charts[address].chart_often.push({
            t: time,
            p: price
          })
          tokens_charts[address].chart_often = tokens_charts[address].chart_often.slice(-HISTORY_SIZE)
        }
      } else {
        tokens_charts[address] = {
          s: symbol,
          n: name,
          chart_often: [{
            t: time,
            p: price
          }]
        }
      }
      if(tokens_charts[address].chart_4h) {
        if((time - tokens_charts[address].chart_4h[tokens_charts[address].chart_4h.length-1]['t']) > 14400000) {
          const val1 = tokens_charts[address].chart_often[tokens_charts[address].chart_often.length-2]
          const val2 = tokens_charts[address].chart_often[tokens_charts[address].chart_often.length-1]
          const a = (val2.p - val1.p) / (val2.t - val1.t)
          const b = val1.p - a * val1.t
          const tx = tokens_charts[address].chart_4h[tokens_charts[address].chart_4h.length-1]['t'] + 14400000
          const vx = a * tx + b
          tokens_charts[address].chart_4h.push({
            t: tx,
            p: vx
          })
          tokens_charts[address].chart_4h = tokens_charts[address].chart_4h.slice(-HISTORY_SIZE)
        }
      } else {
        tokens_charts[address].chart_4h = [{
          t: time,
          p: price
        }]
      }
    }
  }


  // build Top 25 list
  top_tokens = {}
  if(tokens.length > 0) {
    for (var i = 0; i < 25; i++) {
      const token = Object.keys(tokens)[i]
      const address = token
      const symbol = tokens[token].symbol
      const name = tokens[token].name
      const price = tokens[token].price

      top_tokens[address] = {
        s: symbol,
        n: name,
        p: price,
        chart: tokens_charts[token].chart_often
      }
    }
  }





  /* Store files */

  // Update the tokens list
  let pathFile = path.join(dir_home, 'pancake.json')
  writeFile( pathFile, JSON.stringify( tokens_list ), "utf8", (err) => {
    if (err) throw err;
  });

  // Update the top 25 tokens list
  pathFile = path.join(dir_home, 'pancake-top.json')
  writeFile( pathFile, JSON.stringify( top_tokens ), "utf8", (err) => {
    if (err) throw err;
  });

  // Update the tokens simple data
  pathFile = path.join(dir_home, 'pancake-simple.json')
  writeFile( pathFile, JSON.stringify( tokens_data ), "utf8", (err) => {
    if (err) throw err;
  });

  // Update the tokens charts
  pathFile = path.join(dir_home, 'pancake-charts.json')
  writeFile( pathFile, JSON.stringify( tokens_charts ), "utf8", (err) => {
    if (err) throw err;
  });

  // loop
  setTimeout(function(){ launch() }, 179000) // every 3 minutes
}


// Program - Uniswap
async function launchUniswap() {
  let uniswap_data_file = {}
  let uniswap_charts_file = {}
  try {
    uniswap_data_file = require(path.join(dir_home, 'uniswap-simple.json'))
    uniswap_charts_file = require(path.join(dir_home, 'uniswap-charts.json'))
  } catch(error) {
    // console.log(error)
  }

  uniswap_data = uniswap_data_file
  uniswap_charts = uniswap_charts_file


  // get data from Uniswap
  const top = await getUniswapTopTokens()



  const time = Date.now()
  const tokens = top.data ? top.data.tokens : []

  const eth_price = top.data ? top.data.bundle.ethPrice : 0

  tokens.forEach(token => {
      const address = token.id
      const symbol = token.symbol
      const name = token.name
      const price_ETH = token.derivedETH
      const price = price_ETH * eth_price

      // create Uniswap list
      uniswap_list[address] = symbol


      // update Uniswap simple data
      uniswap_data[address] = {
        s: symbol,
        n: name,
        p: price,
        t: time
      }

      // update Uniswap charts
      //
      if(uniswap_charts[address]) {
        if(uniswap_charts[address].chart_often[uniswap_charts[address].chart_often.length-1]['t'] < time) {
          uniswap_charts[address].chart_often.push({
            t: time,
            p: price,
          })
          uniswap_charts[address].chart_often = uniswap_charts[address].chart_often.slice(-HISTORY_SIZE)
        }
      } else {
        uniswap_charts[address] = {
          s: symbol,
          n: name,
          chart_often: [{
            t: time,
            p: price,
          }]
        }
      }
      if(uniswap_charts[address].chart_4h) {
        if((time - uniswap_charts[address].chart_4h[uniswap_charts[address].chart_4h.length-1]['t']) > 14400000) {
          const val1 = uniswap_charts[address].chart_often[uniswap_charts[address].chart_often.length-2]
          const val2 = uniswap_charts[address].chart_often[uniswap_charts[address].chart_often.length-1]
          const a = (val2.p - val1.p) / (val2.t - val1.t)
          const b = val1.p - a * val1.t
          const tx = uniswap_charts[address].chart_4h[uniswap_charts[address].chart_4h.length-1]['t'] + 14400000
          const vx = a * tx + b
          uniswap_charts[address].chart_4h.push({
            t: tx,
            p: vx
          })
          uniswap_charts[address].chart_4h = uniswap_charts[address].chart_4h.slice(-HISTORY_SIZE)
        }
      } else {
        uniswap_charts[address].chart_4h = [{
          t: time,
          p: price,
        }]
      }
  })


  // build Top 25 list of Uniswap
  uniswap_top = {}
  if(tokens.length > 0) {
    for (var i = 0; i < 25; i++) {
      const token = tokens[i]
      const address = token.id
      const symbol = token.symbol
      const name = token.name
      const price_ETH = token.derivedETH
      const price = price_ETH * eth_price

      uniswap_top[address] = {
        s: symbol,
        n: name,
        p: price,
        chart: uniswap_charts[address].chart_often
      }
    }
  }


  /* Store files */

  // Update the Uniswap list
  let pathFile = path.join(dir_home, 'uniswap.json')
  writeFile( pathFile, JSON.stringify( uniswap_list ), "utf8", (err) => {
    if (err) throw err;
  });

  // Update the Uniswap top 25
  pathFile = path.join(dir_home, 'uniswap-top.json')
  writeFile( pathFile, JSON.stringify( uniswap_top ), "utf8", (err) => {
    if (err) throw err;
  });

  // Update the Uniswap simple data
  pathFile = path.join(dir_home, 'uniswap-simple.json')
  writeFile( pathFile, JSON.stringify( uniswap_data ), "utf8", (err) => {
    if (err) throw err;
  });

  // Update the Uniswap charts
  pathFile = path.join(dir_home, 'uniswap-charts.json')
  writeFile( pathFile, JSON.stringify( uniswap_charts ), "utf8", (err) => {
    if (err) throw err;
  });

  // loop
  setTimeout(function(){ launchUniswap() }, 179000) // every 3 minutes
}




/* MAIN */
setTimeout(function(){
  launch()
  launchUniswap()
}, 2500)









/* server */
const port = process.env.PORT || 3000
const app = express()

// Pancake URLs
app.get('/list/pancake', (req, res) => res.json(tokens_list))
app.get('/top/pancake', (req, res) => res.json(top_tokens))
app.get('/simple/pancake', (req, res) => res.json(tokens_data))
app.get('/charts/pancake', (req, res) => res.json(tokens_charts))
// Uniswap URLs
app.get('/list/uniswap', (req, res) => res.json(uniswap_list))
app.get('/top/uniswap', (req, res) => res.json(uniswap_top))
app.get('/simple/uniswap', (req, res) => res.json(uniswap_data))
app.get('/charts/uniswap', (req, res) => res.json(uniswap_charts))

app.listen(port, () => console.log(`Backend start at ${port}`))

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'})
  res.end('Hello World')
})
