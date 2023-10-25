function main() {

    let trains = getData("trains")
    let buses = getData("buses")

    const addTrainButton = document.getElementById("train-add")
    const addBusButton = document.getElementById("bus-add")
    const addModal = document.getElementById("add-modal")
    const closeModalButton = document.getElementById("close-modal")
    let trainRouteSelected
    let busRouteSelected

    const trainRouteOptions = { Red: "Red", Blue: "Blue", Brown: "Brn", Purple: "P", Pink: "Pink", Green: "G", Orange: "Org" }

    addTrainButton.addEventListener("click", () => {
        addModal.classList.remove("hide")

        const trainOptionsGrid = document.getElementById("select-route")
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

    function getData(key) {
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
    function updateData(key, data) {
        try {
            const serializedData = JSON.stringify(data);
            localStorage.setItem(key, serializedData);
        } catch (error) {
            console.error('Error updating data in localStorage:', error);
        }
    }

    const selectRoute = (e) => {
        trainRouteSelected = e.target.id
        openStationOptions()
        console.log(e.target)
        const routeOptions = document.getElementsByClassName("train-route-option")
        console.log(routeOptions)
        for (opt of routeOptions) {
            console.log(trainRouteSelected, opt.id)
            if (opt.id === trainRouteSelected) {
                opt.style.backgroundColor = trainRouteSelected.toLowerCase()
            } else {
                opt.style.backgroundColor = ""
                opt.classList.add("disabled-train-route")
            }
        }
    }

    const openStationOptions = async () => {
        const selectStationContainer = document.getElementById("select-station")
        const params = `route=${trainRouteOptions[trainRouteSelected]}`
        const trainStopsResp = await fetch(`/train/stops?${params}`)
        const trainStopsData = await trainStopsResp.json()
        trainStopsData.sort((a, b) => a.stationName > b.stationName)
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
        const newTrainData = { route: trainRouteSelected, stationId: e.target.id }
        const newTrains = [...trains]
        newTrains.push(newTrainData)
        console.log(newTrains)
        updateData("trains", newTrains)
    }
}

main()