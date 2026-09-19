// ==========================================
// CHECK HELPER LOGIN
// ==========================================

function checkLogin() {

    fetch("/current-user")

        .then(response =>
            response.json()
        )

        .then(data => {

            console.log(
                "CURRENT USER:",
                data
            );


            const loginSection =
                document.getElementById(
                    "loginSection"
                );

            const dashboard =
                document.getElementById(
                    "dashboard"
                );


            // NOT LOGGED IN
            if (!data.loggedIn) {

                loginSection.style.display =
                    "block";

                dashboard.style.display =
                    "none";

                return;
            }


            // LOGGED IN AS USER
            if (
                data.user.role !== "helper"
            ) {

                loginSection.style.display =
                    "block";

                dashboard.style.display =
                    "none";

                return;
            }


            // HELPER LOGGED IN
            loginSection.style.display =
                "none";

            dashboard.style.display =
                "block";


            checkRequest();

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
// CHECK REQUEST
// ==========================================

function checkRequest() {

    fetch("/helper-request")

        .then(response =>
            response.json()
        )

        .then(data => {

            console.log(
                "HELPER REQUEST:",
                data
            );


            if (!data.found) {

                document.getElementById(
                    "request"
                ).innerText =
                    "No request yet.";

                document.getElementById(
                    "buttons"
                ).style.display =
                    "none";

                return;
            }


            const request =
                data.request;


            document.getElementById(
                "request"
            ).innerHTML = `

                <p>
                    <strong>User:</strong>
                    ${request.userName}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${request.userPhone}
                </p>

                <p>
                    <strong>Problem:</strong>
                    ${request.problem}
                </p>

                <p>
                    <strong>Category:</strong>
                    ${request.category}
                </p>

                <a href="tel:${request.userPhone}">
                    <button>
                        Call User
                    </button>
                </a>

            `;


            document.getElementById(
                "buttons"
            ).style.display =
                "block";

        })

        .catch(error => {

            console.log(
                "REQUEST ERROR:",
                error
            );

        });
}


// ==========================================
// ACCEPT
// ==========================================

function acceptRequest() {

    fetch(
        "/accept-request",
        {
            method: "POST"
        }
    )

        .then(response =>
            response.json()
        )

        .then(data => {

            console.log(
                "ACCEPT:",
                data
            );


            document.getElementById(
                "status"
            ).innerText =
                data.message;


            document.getElementById(
                "buttons"
            ).style.display =
                "none";


            checkRequest();

        })

        .catch(error => {

            console.log(
                "ACCEPT ERROR:",
                error
            );

        });
}


// ==========================================
// REJECT
// ==========================================

function rejectRequest() {

    fetch(
        "/reject-request",
        {
            method: "POST"
        }
    )

        .then(response =>
            response.json()
        )

        .then(data => {

            console.log(
                "REJECT:",
                data
            );


            document.getElementById(
                "status"
            ).innerText =
                data.message;


            document.getElementById(
                "buttons"
            ).style.display =
                "none";


            checkRequest();

        })

        .catch(error => {

            console.log(
                "REJECT ERROR:",
                error
            );

        });
}


// ==========================================
// START
// ==========================================

checkLogin();


// Check for new requests
// every 3 seconds
setInterval(
    checkRequest,
    3000
);