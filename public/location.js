let userLatitude = null;
let userLongitude = null;
let detectedCategory = null;
function getLocation() {

    navigator.geolocation.getCurrentPosition(

        (position) => {

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            userLatitude = latitude;
            userLongitude = longitude;

            console.log("Latitude:", latitude);
            console.log("Longitude:", longitude);

            document.getElementById("location").innerText =
                `Latitude: ${latitude}, Longitude: ${longitude}`;

            fetch("/location", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    latitude: latitude,
                    longitude: longitude
                })
            })
                .then(response => response.text())
                .then(data => {
                    console.log(data);
                });

        },

        (error) => {

            console.log("Unable to get location:", error.message);

            document.getElementById("location").innerText =
                "Unable to get location.";

        }
    );
}

function predictProblem() {

    if (userLatitude === null || userLongitude === null) {
        alert("Please get your location first.");
        return;
    }

    const problem = document.getElementById("problem").value;

    fetch("/predict", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            problem: problem
        })
    })
    .then(response => response.json())
    .then(data => {

    console.log("Predicted category:", data.category);

    detectedCategory = data.category;

    document.getElementById("category").innerText =
        "Problem Category: " + data.category;

        // Find suitable helper
        fetch("/find-helper", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                category: data.category,
                latitude: userLatitude,
                longitude: userLongitude
            })
        })
        .then(response => response.json())
        .then(helpers => {

            console.log("Matching helpers:", helpers);

            helpers.sort((a, b) => a.distance - b.distance);

            if (helpers.length > 0) {

    const nearestHelpers = helpers.slice(0, 3);

    let helperHTML = "<h2>Available Helpers</h2>";

    nearestHelpers.forEach((helper, index) => {

        helperHTML += `
            <div>
                <h3>${index + 1}. ${helper.name}</h3>
                <p>Phone: ${helper.phone}</p>
                <p>Service: ${helper.service}</p>
                <p>Distance: ${helper.distance.toFixed(2)} km</p>

                <a href="tel:${helper.phone}">
                    <button>Call Helper</button>
                </a>

                <button onclick="requestHelper('${helper.phone}')">
                Request Assistance
                </button>

            </div>

            <hr>
        `;

    });

    document.getElementById("helper").innerHTML = helperHTML;

} else {

    document.getElementById("helper").innerText =
        "No suitable helper found.";

}

        });

    });
}

function requestHelper(helperPhone) {

    fetch("/current-user")
        .then(response => response.json())
        .then(userData => {

            if (!userData.loggedIn) {
                alert("Please login first.");
                return;
            }

            fetch("/request-helper", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({

                    userName: userData.user.name,
                    userPhone: userData.user.phone,

                    helperPhone: helperPhone,

                    problem: document.getElementById("problem").value,
                    category: detectedCategory,

                    latitude: userLatitude,
                    longitude: userLongitude
                })
            })
            .then(response => response.json())
            .then(data => {

                alert(data.message);

                document.getElementById("status").innerText =
                    "Assistance request sent.";

                setInterval(checkRequestStatus, 3000);
                function checkRequestStatus() {
    fetch("/request-status")
        .then(response => response.json())
        .then(data => {

            if (data.status === "PENDING") {
                document.getElementById("status").innerText =
                    "Waiting for helper to respond...";
            }

            else if (data.status === "ACCEPTED") {
                document.getElementById("status").innerText =
                    "Helper accepted your request! Please call the helper.";
            }

            else if (data.status === "REJECTED") {
                document.getElementById("status").innerText =
                    "Helper rejected the request.";
            }

        });
}
            });

        });
}

function checkRequestStatus() {

    fetch("/request-status")
        .then(response => response.json())
        .then(data => {

            if (data.status === "ACCEPTED") {

                document.getElementById("status").innerText =
                    "Helper accepted your request.";

            }

            else if (data.status === "REJECTED") {

                document.getElementById("status").innerText =
                    "Helper rejected your request.";

            }

        });

}