function main() {

    let trains = null
    let buses = null
    let isFetching = null

    const trainCardSection = document.getElementById("train-card-container")
    const busCardSection = document.getElementById("bus-card-container")
    const addTrainButton = document.getElementById("train-add")
    const addBusButton = document.getElementById("bus-add")
    const addModal = document.getElementById("add-modal")
    const closeModalButton = document.getElementById("close-modal")
    let trainRouteSelected
    let busRouteSelected
    let selectStationContainer = document.getElementById("select-station")

    const trainRouteOptions = {
        "Red": { coc: "Red", cta: "Red", },
        "Blue": { coc: "Blue", cta: "Blue", },
        "Brown": { coc: "Brn", cta: "Brn", },
        "Purple": { coc: "P", cta: "P", },
        "Pink": { coc: "Pnk", cta: "Pink", },
        "Green": { coc: "G", cta: "G", },
        "Orange": { coc: "O", cta: "Org" },
        "Yellow": { coc: "Y", cta: "Y" }
    }

    addTrainButton.addEventListener("click", () => {
        addModal.classList.remove("hide")

        const trainOptionsGrid = document.getElementById("select-route")
        trainOptionsGrid.innerHTML = ""

        Object.keys(trainRouteOptions).forEach(route => {
            const newRouteOption = document.createElement("div")
            newRouteOption.className = "train-route-option"
            newRouteOption.id = route
            newRouteOption.innerHTML = `
                <button id="${route}" class="button">${route}</button>
            `
            trainOptionsGrid.appendChild(newRouteOption)
            newRouteOption.addEventListener("click", selectRoute)
        })

    })

    addBusButton.addEventListener("click", () => {
        addModal.classList.remove("hide")
    })

    closeModalButton.addEventListener("click", () => {
        addModal.classList.add("hide")
    })

    const getData = (key) => {
        try {
            const serializedData = localStorage.getItem(key);
            if (serializedData === null) {
                return []; // Key doesn't exist in localStorage
            }
            return JSON.parse(serializedData);
        } catch (error) {
            console.error('Error getting data from localStorage:', error);
            return null;
        }
    }

    // Update or add data to localStorage
    const updateData = (key, data) => {
        try {
            if (key === "trains") { trains = data }
            if (key === "buses") { buses = data }
            updateCards()
            const serializedData = JSON.stringify(data);
            localStorage.setItem(key, serializedData);
        } catch (error) {
            console.error('Error updating data in localStorage:', error);
        }
    }

    const fetchTrainApi = async () => {
        const trainArrivals = []
        for (const train of trains) {
            const params = new URLSearchParams({ stationId: train.stationId, route: trainRouteOptions[train.route].cta }).toString()
            const trainArrivalResp = await fetch(`/train/arrivals?${params}`)
            const trainArrivalData = await trainArrivalResp.json()
            const newArr = { ...train, arrivals: trainArrivalData }
            trainArrivals.push(newArr)
        }

        return trainArrivals;
    }
    const fetchBusApi = async () => {
        const busArrivals = []
        for (const bus of buses) {
            const params = new URLSearchParams({ stopId: bus.stopId, route: route })
            const busArrivalResp = await fetch(`/bus/predictions?${params}`)
            const busArrivalData = await busArrivalResp.json()
            const newArr = { ...bus, arrivals: busArrivalData }
            busArrivals.push({ newArr })
        }
        return busArrivals
    }

    const fetchDataFromApi = async () => {
        if (isFetching) return
        isFetching = true;
        let trainArrivals
        let busArrivals
        try {
            trainArrivals = await fetchTrainApi()
            busArrivals = await fetchBusApi()
        } catch (err) {
            console.log(err)
        } finally {
            isFetching = false
        }
        return [trainArrivals, busArrivals]
    }

    const updateCards = async () => {
        const [trainArrivals, busArrivals] = await fetchDataFromApi()
        trainCardSection.innerHTML = ""
        trainArrivals.forEach((train) => {
            // Get closest etas for both directions
            let lowestEtas = {}
            let result = {}
            for (const arr of train.arrivals) {
                const dest = arr.destinationName
                if (!lowestEtas.hasOwnProperty(dest) || arr.arrivingIn < lowestEtas[dest]) {
                    lowestEtas[dest] = arr.arrivingIn
                    result[dest] = arr
                }
            }

            const destIds = Object.keys(result)
            let destinationOptsHtml = ""
            for (const dest of destIds) {
                const destHtml = `
                <div class="direction">
                    <p>${result[dest].destinationName}</p>
                    <p class="eta">${result[dest].due ? "Due" : result[dest].arrivingIn}</p>
                </div>
                `
                destinationOptsHtml = destinationOptsHtml + destHtml
            }

            const trainCard = document.createElement("div")
            trainCard.className = "route-card"
            trainCard.innerHTML = `
                <div class="card-header">
                    <h4>${train.route}</h4>
                </div>
                ${destinationOptsHtml}
                <p class="stop">${train.arrivals[0].stationName}</p>
            </div>
            `
            trainCardSection.appendChild(trainCard)
        })
    }

    const selectRoute = (e) => {
        trainRouteSelected = e.target.id
        openStationOptions()

        const routeOptions = document.getElementsByClassName("train-route-option")
        for (opt of routeOptions) {
            if (opt.id === trainRouteSelected) {
                opt.style.backgroundColor = trainRouteSelected.toLowerCase()
            } else {
                opt.style.backgroundColor = ""
                opt.classList.add("disabled-train-route")
            }
        }
    }

    const openStationOptions = async () => {
        selectStationContainer = document.getElementById("select-station")
        const params = `route=${trainRouteOptions[trainRouteSelected].coc}`
        const trainStopsResp = await fetch(`/train/stops?${params}`)
        const trainStopsData = await trainStopsResp.json()
        trainStopsData.sort((a, b) => a.stationName > b.stationName)
        selectStationContainer.innerHTML = ""

        trainStopsData.forEach(station => {
            const stationContainer = document.createElement('div')
            stationContainer.className = "station-option"
            stationContainer.id = station.stationId
            stationContainer.innerHTML = `
                <p>${station.stationName}</p>
                <p>${station.routesAtStation.join(", ")}</p>
            `
            selectStationContainer.appendChild(stationContainer)
            selectStationContainer.addEventListener("click", selectStation)
        })
    }

    const selectStation = (e) => {
        addModal.classList.add("hide")
        selectStationContainer.innerHTML = ""
        const newTrainData = { route: trainRouteSelected, stationId: e.target.id }
        if (trains.includes(newTrainData)) return

        const newTrains = [...trains]
        newTrains.push(newTrainData)
        updateData("trains", newTrains)
    }

    // const updateInterval = 60000; // 60 seconds
    // setInterval(fetchDataFromApi, updateInterval);
    trains = getData("trains")
    buses = getData("buses")
    updateCards()

    const updateInterval = 15000
    setInterval(updateCards, updateInterval)
}

main()