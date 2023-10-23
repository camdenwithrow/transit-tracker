const express = require('express')
const cors = require('cors')
const path = require('path')
const axios = require('axios')

if (process.env.NODE_ENV !== 'prod') {
    require('dotenv').config()
}

const app = express()
const PORT = 3000 || process.env.PORT

const TRAIN_API_KEY = process.env.TRAIN_API_KEY
const BUS_API_KEY = process.env.BUS_API_KEY

app.use(express.json())
app.use(cors())
app.use(express.static(path.join(__dirname, 'public')))

const TRAIN_BASE_URL = 'http://lapi.transitchicago.com/api/1.0'
const BUS_BASE_URL = 'http://ctabustracker.com/bustime/api/v2'

const BASE_TRAIN_PARAMS = { key: TRAIN_API_KEY, outputType: "JSON" }
const BASE_BUS_PARAMS = { key: BUS_API_KEY, format: "json" }

app.get('/train/arrivals', async (req, res) => {
    const arrUrl = `${TRAIN_BASE_URL}/ttarrivals.aspx`
    let station = req.query.station
    let route = req.query.route
    console.log(station, route)
    try {
        const arrResp = await axios.get(arrUrl, {
            params: {
                ...BASE_TRAIN_PARAMS,
                mapid: station,
                rt: route,
            }
        })
        const arrRespBody = arrResp.data.ctatt
        if (arrRespBody.errNm != null) throw Error(arrRespBody.errNm)

        const data = arrRespBody.eta.map(train => {
            const arrivingIn = (Date.parse(train.arrT) - Date.parse(train.prdt)) / 60000
            return {
                serving: train.destNm,
                servingId: train.destSt,
                due: Boolean(parseInt(train.isApp)),
                arrivingIn: arrivingIn,
                arrivalTime: train.arrT,
                requestTime: train.prdt
            }
        })
        res.send(data)
    } catch (error) {
        res.send(error)
    }
})

app.get('/bus/predictions', async (req, res) => {
    const predUrl = `${BUS_BASE_URL}/getpredictions`
    const stop = req.query.stop
    const route = req.query.route
    try {
        const predResp = await axios.get(predUrl, {
            params: {
                ...BASE_BUS_PARAMS,
                stpid: stop,
                rt: route,
            }
        })
        const predRespBody = predResp.data['bustime-response']
        console.log(predRespBody)
        if("error" in predRespBody) throw Error(predRespBody.error)

        const data = predRespBody.prd.map(bus => {
            return {
                stopName: bus.stpnm,
                direction: bus.rtdir,
                arrivalTime: bus.prdctdn,
                due: bus.prdctdn === "DUE",
                delay: bus.dly
            }
        })
        res.send(data)
    } catch (error) {
        res.status(400).send(error)
    }
})

app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
})