'use strict'

const IPFS = require('ipfs')
const ipfs = new IPFS()

const location = 'QmPeph5cHyU9TC44RUxVgPKbgEEgT9GUBKnXGwU6aLWzcj/keyimg_yc2015-09-09-98.jpg'
//const readStream = ipfs.files.getReadableStream(location)
ipfs.on('ready', () => {
    console.log('ready')
    ipfs.swarm.addrs((err, peerInfos) => {
        console.log(peerInfos)
    })
    ipfs.swarm.peers((err, peerInfos) => {
        console.log(peerInfos)
    })
    const readStream = ipfs.files.getReadableStream(location)
    readStream.on('data', (data) => {
        console.log('dsads')
        console.log(data.path)
    })
    readStream
})