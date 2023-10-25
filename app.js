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
    let stationId = req.query.stationId
    let route = req.query.route
    try {
        const arrResp = await axios.get(arrUrl, {
            params: {
                ...BASE_TRAIN_PARAMS,
                mapid: stationId,
                rt: route,
            }
        })
        const arrRespBody = arrResp.data.ctatt
        if (arrRespBody.errNm != null) throw Error(arrRespBody.errNm)

        const data = arrRespBody.eta.map(train => {
            const arrivingIn = (Date.parse(train.arrT) - Date.parse(train.prdt)) / 60000
            return {
                stationName: train.staNm,
                destinationName: train.destNm,
                destinationId: train.destSt,
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

app.get('/train/stops', async (req, res) => {
    // route options: Red, Blue, Brn, G, Org, P, Pink, Y
    const route = req.query.route
    try {
        const stopsResp = await axios.get('https://data.cityofchicago.org/resource/8pix-ypme.json', {
            params: {
                $query: `SELECT \`station_name\`, \`station_descriptive_name\`, \`map_id\` WHERE \`${route}\` IN ("true")`
            }
        })
        const data = stopsResp.data.map(stop => {
            let decrName = stop["station_descriptive_name"]
            decrName = decrName.substring(decrName.indexOf('(') + 1, decrName.indexOf(')'))
            const linesAtStation = decrName.replace(/\W|lines?/gi, ",").split(",").filter(x => x != "")
            return {
                stationName: stop["station_name"],
                routesAtStation: linesAtStation,
                stationId: stop["map_id"]
            }
        })

        // Remove duplicates
        const unique = new Set()
        const filtered = data.filter(obj => {
            const objString = JSON.stringify(obj);
            const isUnique = !unique.has(objString)
            if (isUnique) { unique.add(objString) }
            return isUnique
        })

        res.send(filtered)
    } catch (error) {
        res.status(500).send(error)
    }

})

app.get('/bus/predictions', async (req, res) => {
    const predUrl = `${BUS_BASE_URL}/getpredictions`
    try {
        const predResp = await axios.get(predUrl, {
            params: {
                ...BASE_BUS_PARAMS,
                stpid: req.query.stopId,
                rt: req.query.route,
            }
        })
        const predRespBody = predResp.data['bustime-response']
        if ("error" in predRespBody) throw Error(predRespBody.error)

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
        res.status(500).send(error)
    }
})

const getDirection = async (route) => {
    try {
        const dirResp = await axios.get(`${BUS_BASE_URL}/getdirections`, {
            params: {
                ...BASE_BUS_PARAMS,
                rt: route
            }
        })
        const dirRespBody = dirResp.data['bustime-response']
        if ("error" in dirRespBody) throw Error(dirRespBody.error)

        return dirRespBody.directions.map(dir => dir.dir)
    } catch (error) { return error }
}

const getStops = async (route, direction) => {
    try {
        const stopsResp = await axios.get(`${BUS_BASE_URL}/getstops`, {
            params: {
                ...BASE_BUS_PARAMS,
                rt: route,
                dir: direction,
            }
        })
        const stopsRespBody = stopsResp.data['bustime-response']
        if ("error" in stopsRespBody) throw Error(stopsRespBody.error)

        return stopsRespBody.stops.map(stop => {
            return {
                stopId: stop.stpid,
                stopName: stop.stpnm,
                direction: direction
            }
        })

    } catch (error) { return (error) }
}

app.get('/bus/routes', async (req, res) => {
    try {
        const routesResp = await axios.get(`${BUS_BASE_URL}/getroutes`, {
            params: BASE_BUS_PARAMS
        })
        const routesRespBody = routesResp.data['bustime-response']
        console.log(routesRespBody)
        if ("error" in routesRespBody) throw Error(routesRespBody.error)

        const data = routesRespBody.routes.map(route => {
            return {
                route: route.rt,
                routeName: route.rtnm
            }
        })
        res.send(data)
    } catch (error) {
        res.status(500).send(error)
    }
})

app.get('/bus/stops', async (req, res) => {
    const route = req.query.route
    try {
        const direction = await getDirection(route)
        const stopsA = await getStops(route, direction[0])
        const stopsB = await getStops(route, direction[1])
        const stops = [...stopsA, ...stopsB].reduce((acc, curr) => {
            const { stopId, stopName, direction } = curr;
            let findStop = acc.find(s => s.stopName === stopName)
            if (!findStop) {
                acc.push({ stopName, [direction]: stopId })
            } else {
                findStop[direction] = stopId
            }
            return acc
        }, [])
        res.send({ [route]: stops })
    } catch (error) {
        console.log(error)
        res.status(500).send(error)
    }
})


app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
})