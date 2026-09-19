// ==========================================
// GLOBAL VARIABLES
// ==========================================

let detectedCategory = null;

let userLatitude = null;
let userLongitude = null;


// ==========================================
// CHECK USER LOGIN
// ==========================================

function checkUserLogin() {

    fetch("/current-user")

        .then(response => response.json())

        .then(data => {

            console.log(
                "CURRENT USER:",
                data
            );


            const status =
                document.getElementById(
                    "userStatus"
                );

            const loginButton =
                document.getElementById(
                    "loginButton"
                );


            // NOT LOGGED IN
            if (!data.loggedIn) {

                status.innerText =
                    "You are not logged in.";

                loginButton.style.display =
                    "inline-block";

                return;
            }


            // LOGGED IN AS HELPER
            if (
                data.user.role !== "user"
            ) {

                status.innerText =
                    "Please login as a user.";

                loginButton.style.display =
                    "inline-block";

                return;
            }


            // USER LOGGED IN
            status.innerText =
                `Logged in as ${data.user.name} (${data.user.phone})`;

            loginButton.style.display =
                "none";

        })

        .catch(error => {

            console.log(
                "LOGIN CHECK ERROR:",
                error
            );

        });
}


// ==========================================
// LOGIN BUTTON
// ==========================================

function goToLogin() {

    window.location.href =
        "/login";
}


// ==========================================
// PREDICT PROBLEM
// ==========================================

function predictProblem() {

    const problem =
        document.getElementById(
            "problem"
        ).value.trim();


    if (!problem) {

        alert(
            "Please describe your problem."
        );

        return;
    }


    fetch("/predict", {

        method: "POST",

        headers: {
            "Content-Type":
                "application/json"
        },

        body: JSON.stringify({
            problem: problem
        })

    })

        .then(response =>
            response.json()
        )

        .then(data => {

            if (data.message) {

                alert(
                    data.message
                );

                return;
            }


            detectedCategory =
                data.category;


            document.getElementById(
                "prediction"
            ).innerText =
                `Detected problem: ${detectedCategory}`;

        })

        .catch(error => {

            console.log(
                "PREDICTION ERROR:",
                error
            );

        });
}


// ==========================================
// GET LOCATION
// ==========================================

function getLocation() {

    if (!navigator.geolocation) {

        document.getElementById(
            "locationStatus"
        ).innerText =
            "Geolocation is not supported.";

        return;
    }


    navigator.geolocation.getCurrentPosition(

        function(position) {

            userLatitude =
                position.coords.latitude;

            userLongitude =
                position.coords.longitude;


            document.getElementById(
                "locationStatus"
            ).innerText =
                `Location detected: ${userLatitude}, ${userLongitude}`;


            console.log(
                "Latitude:",
                userLatitude
            );

            console.log(
                "Longitude:",
                userLongitude
            );


            fetch("/location", {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    latitude:
                        userLatitude,

                    longitude:
                        userLongitude

                })

            });

        },


        function(error) {

            console.log(
                "LOCATION ERROR:",
                error
            );

            document.getElementById(
                "locationStatus"
            ).innerText =
                "Unable to get location.";

        }

    );
}


// ==========================================
// FIND HELPERS
// ==========================================

function findHelpers() {

    // Check login
    fetch("/current-user")

        .then(response =>
            response.json()
        )

        .then(userData => {

            if (
                !userData.loggedIn ||
                userData.user.role !== "user"
            ) {

                alert(
                    "Please login as a user first."
                );

                return;
            }


            // Check category
            if (!detectedCategory) {

                alert(
                    "Please check your problem first."
                );

                return;
            }


            // Check location
            if (
                userLatitude === null ||
                userLongitude === null
            ) {

                alert(
                    "Please get your location first."
                );

                return;
            }


            return fetch(
                "/find-helper",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        category:
                            detectedCategory,

                        latitude:
                            userLatitude,

                        longitude:
                            userLongitude

                    })

                }

            );

        })

        .then(response => {

            if (!response) {
                return;
            }

            return response.json();

        })

        .then(data => {

            if (!data) {
                return;
            }


            console.log(
                "HELPERS:",
                data
            );


            const helperDiv =
                document.getElementById(
                    "helpers"
                );


            if (
                !Array.isArray(data) ||
                data.length === 0
            ) {

                helperDiv.innerHTML =
                    "No matching helpers found.";

                return;
            }


            helperDiv.innerHTML = "";


            data.forEach(helper => {

                const div =
                    document.createElement(
                        "div"
                    );


                div.innerHTML = `

                    <h3>
                        ${helper.name}
                    </h3>

                    <p>
                        Service:
                        ${helper.service}
                    </p>

                    <p>
                        Distance:
                        ${helper.distance} km
                    </p>

                    <p>
                        Phone:
                        ${helper.phone}
                    </p>

                    <button
                        onclick="requestHelper('${helper.phone}')"
                    >
                        Request Helper
                    </button>

                    <a
                        href="tel:${helper.phone}"
                    >
                        <button>
                            Call Helper
                        </button>
                    </a>

                    <hr>

                `;


                helperDiv.appendChild(
                    div
                );

            });

        })

        .catch(error => {

            console.log(
                "FIND HELPER ERROR:",
                error
            );

        });
}


// ==========================================
// REQUEST HELPER
// ==========================================

function requestHelper(helperPhone) {

    const problem =
        document.getElementById(
            "problem"
        ).value.trim();


    if (!problem) {

        alert(
            "Please describe your problem."
        );

        return;
    }


    if (!detectedCategory) {

        alert(
            "Please check your problem first."
        );

        return;
    }


    if (
        userLatitude === null ||
        userLongitude === null
    ) {

        alert(
            "Please get your location first."
        );

        return;
    }


    fetch("/request-helper", {

        method: "POST",

        headers: {
            "Content-Type":
                "application/json"
        },

        body: JSON.stringify({

            helperPhone:
                helperPhone,

            problem:
                problem,

            category:
                detectedCategory,

            latitude:
                userLatitude,

            longitude:
                userLongitude

        })

    })

        .then(response =>
            response.json()
        )

        .then(data => {

            console.log(
                "REQUEST RESULT:",
                data
            );


            if (!data.success) {

                alert(
                    data.message
                );

                return;
            }


            document.getElementById(
                "requestStatus"
            ).innerText =
                data.message;


            checkRequestStatus();

        })

        .catch(error => {

            console.log(
                "REQUEST ERROR:",
                error
            );

        });
}


// ==========================================
// CHECK REQUEST STATUS
// ==========================================

function checkRequestStatus() {

    fetch("/request-status")

        .then(response =>
            response.json()
        )

        .then(data => {

            console.log(
                "REQUEST STATUS:",
                data
            );


            if (!data.found) {

                document.getElementById(
                    "requestStatus"
                ).innerText =
                    "No request yet.";

                return;
            }


            if (
                data.status === "PENDING"
            ) {

                document.getElementById(
                    "requestStatus"
                ).innerText =
                    `Request sent to ${data.helperName}. Waiting for response...`;

                return;
            }


            if (
                data.status === "ACCEPTED"
            ) {

                document.getElementById(
                    "requestStatus"
                ).innerText =
                    `${data.acceptedBy} accepted your request.`;

                return;
            }


            if (
                data.status === "REJECTED"
            ) {

                document.getElementById(
                    "requestStatus"
                ).innerText =
                    `${data.rejectedBy} rejected your request.`;

                return;
            }

        })

        .catch(error => {

            console.log(
                "STATUS ERROR:",
                error
            );

        });
}


// ==========================================
// START
// ==========================================

checkUserLogin();


// Check status every 3 seconds
setInterval(
    checkRequestStatus,
    3000
);