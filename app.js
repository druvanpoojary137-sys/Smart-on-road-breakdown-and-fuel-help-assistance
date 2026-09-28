const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const { spawn } = require("child_process");

const Helper = require("./models/Helper");
const AssistanceRequest = require("./models/AssistanceRequest");

const app = express();


// ==========================================
// MongoDB Connection
// ==========================================

mongoose
    .connect("mongodb://127.0.0.1:27017/vehicleAssistance")
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.log("MongoDB connection error:", error);
    });


// ==========================================
// Middleware
// ==========================================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: "vehicle-assistance-secret",
        resave: false,
        saveUninitialized: false
    })
);

app.set("view engine", "ejs");

app.use(express.static("public"));


// ==========================================
// HOME PAGE
// ==========================================

app.get("/", (req, res) => {
    res.render("breakdown");
});


// ==========================================
// LOCATION
// ==========================================

app.post("/location", (req, res) => {

    const {
        latitude,
        longitude
    } = req.body;

    console.log("User Latitude:", latitude);
    console.log("User Longitude:", longitude);

    res.json({
        success: true,
        message: "Location received"
    });

});


// ==========================================
// NLP PREDICTION
// ==========================================

app.post("/predict", (req, res) => {

    const problem = req.body.problem;

    if (!problem) {
        return res.status(400).json({
            message: "Problem description is required."
        });
    }

    console.log("Problem:", problem);

    const python = spawn("python", [
        "nlp/predict_from_app.py",
        problem
    ]);

    let result = "";

    python.stdout.on("data", (data) => {
        result += data.toString();
    });

    python.stderr.on("data", (data) => {

        console.log(
            "Python error:",
            data.toString()
        );

    });

    python.on("error", (error) => {

        console.log(
            "Python process error:",
            error
        );

        if (!res.headersSent) {
            res.status(500).json({
                message: "Unable to start Python."
            });
        }

    });

    python.on("close", (code) => {

        if (code !== 0) {

            return res.status(500).json({
                message: "Prediction failed."
            });

        }

        const category = result.trim();

        console.log(
            "Predicted category:",
            category
        );

        res.json({
            category: category
        });

    });

});


// ==========================================
// HAVERSINE DISTANCE
// ==========================================

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    lat1 = Number(lat1);
    lon1 = Number(lon1);
    lat2 = Number(lat2);
    lon2 = Number(lon2);

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLon =
        (lon2 - lon1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(
            lat1 * Math.PI / 180
        ) *

        Math.cos(
            lat2 * Math.PI / 180
        ) *

        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


// ==========================================
// FIND SUITABLE HELPERS
// ==========================================

app.post("/find-helper", async (req, res) => {

    const {
        category,
        latitude,
        longitude
    } = req.body;

    console.log("\n========== FIND HELPER ==========");

    console.log(
        "Category:",
        category
    );

    console.log(
        "User Latitude:",
        latitude
    );

    console.log(
        "User Longitude:",
        longitude
    );

    try {

        // -----------------------------
        // Validate category
        // -----------------------------

        if (!category) {

            return res.status(400).json({
                message:
                    "Problem category is missing."
            });

        }


        // -----------------------------
        // Validate location
        // -----------------------------

        const userLatitude =
            Number(latitude);

        const userLongitude =
            Number(longitude);

        if (
            !Number.isFinite(userLatitude) ||
            !Number.isFinite(userLongitude)
        ) {

            return res.status(400).json({
                message:
                    "Invalid user location."
            });

        }


        // -----------------------------
        // Check MongoDB connection
        // -----------------------------

        if (
            mongoose.connection.readyState !== 1
        ) {

            return res.status(500).json({
                message:
                    "MongoDB is not connected."
            });

        }


        // -----------------------------
        // Find helpers
        // -----------------------------

        const helpers =
            await Helper.find({
                service: category,
                available: true
            });

        console.log(
            "Helpers found:",
            helpers.length
        );


        // -----------------------------
        // Calculate distance
        // -----------------------------

        const matchingHelpers = [];

        for (const helper of helpers) {

            const helperLatitude =
                Number(helper.latitude);

            const helperLongitude =
                Number(helper.longitude);


            if (
                !Number.isFinite(helperLatitude) ||
                !Number.isFinite(helperLongitude)
            ) {

                console.log(
                    "Invalid location for helper:",
                    helper.name
                );

                continue;

            }


            const distance =
                calculateDistance(
                    userLatitude,
                    userLongitude,
                    helperLatitude,
                    helperLongitude
                );


            matchingHelpers.push({

                name:
                    helper.name,

                phone:
                    helper.phone,

                service:
                    helper.service,

                latitude:
                    helperLatitude,

                longitude:
                    helperLongitude,

                available:
                    helper.available,

                distance:
                    Number(
                        distance.toFixed(2)
                    )

            });

        }


        // -----------------------------
        // Nearest helper first
        // -----------------------------

        matchingHelpers.sort(
            (a, b) =>
                a.distance - b.distance
        );


        console.log(
            "Matching helpers:",
            matchingHelpers
        );

        console.log(
            "================================\n"
        );


        res.json(
            matchingHelpers
        );

    }

    catch (error) {

        console.log(
            "ERROR FINDING HELPERS:"
        );

        console.log(error);

        res.status(500).json({

            message:
                error.message ||
                "Error finding helpers."

        });

    }

});


// ==========================================
// REQUEST HELPER
// ==========================================

app.post("/request-helper", async (req, res) => {

    const {
        helperPhone,
        problem,
        category,
        latitude,
        longitude
    } = req.body;


    try {

        // ----------------------------------
        // User must be logged in
        // ----------------------------------

        if (!req.session.user) {

            return res.status(401).json({
                message:
                    "Please login before requesting assistance."
            });

        }


        const userName =
            req.session.user.name;

        const userPhone =
            req.session.user.phone;


        // ----------------------------------
        // Validate
        // ----------------------------------

        if (!userName || !userPhone) {

            return res.status(400).json({
                message:
                    "User name and phone are required."
            });

        }


        if (!helperPhone) {

            return res.status(400).json({
                message:
                    "Helper phone number is required."
            });

        }


        if (!problem) {

            return res.status(400).json({
                message:
                    "Problem description is required."
            });

        }


        if (!category) {

            return res.status(400).json({
                message:
                    "Problem category is required."
            });

        }


        const userLatitude =
            Number(latitude);

        const userLongitude =
            Number(longitude);


        if (
            !Number.isFinite(userLatitude) ||
            !Number.isFinite(userLongitude)
        ) {

            return res.status(400).json({
                message:
                    "Valid location is required."
            });

        }


        // ----------------------------------
        // Find helper
        // ----------------------------------

        const helper =
            await Helper.findOne({
                phone: helperPhone
            });


        if (!helper) {

            return res.status(404).json({
                message:
                    "Helper not found."
            });

        }


        // ----------------------------------
        // Create request
        // ----------------------------------

        const newRequest =
            await AssistanceRequest.create({

                userName:
                    userName,

                userPhone:
                    userPhone,

                helperName:
                    helper.name,

                helperPhone:
                    helper.phone,

                problem:
                    problem,

                category:
                    category,

                latitude:
                    userLatitude,

                longitude:
                    userLongitude,

                status:
                    "PENDING"

            });


        console.log(
            "NEW ASSISTANCE REQUEST:"
        );

        console.log(newRequest);


        res.json({

            success: true,

            message:
                "Assistance request sent to helper."

        });

    }

    catch (error) {

        console.log(
            "Error saving assistance request:"
        );

        console.log(error);

        res.status(500).json({

            success: false,

            message:
                error.message ||
                "Failed to send assistance request."

        });

    }

});


// ==========================================
// HELPER DASHBOARD
// ==========================================

app.get("/helper", (req, res) => {

    res.render("helper");

});


// ==========================================
// GET PENDING REQUEST FOR HELPER
// ==========================================

app.get("/helper-request", async (req, res) => {

    try {

        const request =
            await AssistanceRequest
                .findOne({
                    status: "PENDING"
                })
                .sort({
                    createdAt: -1
                });


        if (!request) {

            return res.json({
                found: false
            });

        }


        res.json({

            found: true,

            request: {

                userName:
                    request.userName,

                userPhone:
                    request.userPhone,

                helperName:
                    request.helperName,

                helperPhone:
                    request.helperPhone,

                problem:
                    request.problem,

                category:
                    request.category,

                latitude:
                    request.latitude,

                longitude:
                    request.longitude,

                status:
                    request.status

            }

        });

    }

    catch (error) {

        console.log(
            "Error getting helper request:",
            error
        );

        res.status(500).json({

            found: false,

            message:
                "Error getting request."

        });

    }

});


// ==========================================
// ACCEPT REQUEST
// ==========================================

app.post("/accept-request", async (req, res) => {

    try {

        const request =
            await AssistanceRequest
                .findOne({
                    status: "PENDING"
                })
                .sort({
                    createdAt: -1
                });


        if (!request) {

            return res.json({

                success: false,

                message:
                    "No pending request found."

            });

        }


        request.status =
            "ACCEPTED";


        await request.save();


        console.log(
            "Request accepted."
        );


        res.json({

            success: true,

            message:
                "Assistance request accepted."

        });

    }

    catch (error) {

        console.log(
            "Error accepting request:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Error accepting request."

        });

    }

});


// ==========================================
// REJECT REQUEST
// ==========================================

app.post("/reject-request", async (req, res) => {

    try {

        const request =
            await AssistanceRequest
                .findOne({
                    status: "PENDING"
                })
                .sort({
                    createdAt: -1
                });


        if (!request) {

            return res.json({

                success: false,

                message:
                    "No pending request found."

            });

        }


        request.status =
            "REJECTED";


        await request.save();


        console.log(
            "Request rejected."
        );


        res.json({

            success: true,

            message:
                "Assistance request rejected."

        });

    }

    catch (error) {

        console.log(
            "Error rejecting request:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Error rejecting request."

        });

    }

});


// ==========================================
// USER REQUEST STATUS
// ==========================================

app.get("/request-status", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.json({

                found: false,

                status: "NOT_LOGGED_IN"

            });

        }


        const userPhone =
            req.session.user.phone;


        const request =
            await AssistanceRequest
                .findOne({
                    userPhone: userPhone
                })
                .sort({
                    createdAt: -1
                });


        if (!request) {

            return res.json({

                found: false,

                status: "NONE"

            });

        }


        // ----------------------------------
        // Get helper details
        // ----------------------------------

        const helper =
            await Helper.findOne({
                phone:
                    request.helperPhone
            });


        let helperName =
            request.helperName || "Helper";

        let helperLatitude =
            null;

        let helperLongitude =
            null;


        if (helper) {

            helperName =
                helper.name;

            helperLatitude =
                Number(
                    helper.latitude
                );

            helperLongitude =
                Number(
                    helper.longitude
                );

        }


        res.json({

            found: true,

            request: {

                userName:
                    request.userName,

                userPhone:
                    request.userPhone,

                helperName:
                    helperName,

                helperPhone:
                    request.helperPhone,

                problem:
                    request.problem,

                category:
                    request.category,

                latitude:
                    request.latitude,

                longitude:
                    request.longitude,

                helperLatitude:
                    helperLatitude,

                helperLongitude:
                    helperLongitude,

                status:
                    request.status

            }

        });

    }

    catch (error) {

        console.log(
            "Error checking request status:",
            error
        );

        res.status(500).json({

            found: false,

            status: "ERROR"

        });

    }

});


// ==========================================
// LOGIN PAGE
// ==========================================

app.get("/login", (req, res) => {

    res.render("login");

});


// ==========================================
// USER LOGIN
// ==========================================

app.post("/login", (req, res) => {

    const {
        name,
        phone
    } = req.body;


    if (!name || !phone) {

        return res.status(400).send(
            "Name and phone are required."
        );

    }


    req.session.user = {

        name:
            name,

        phone:
            phone,

        role:
            "user"

    };


    console.log(
        "User logged in:",
        req.session.user
    );


    res.redirect("/");

});


// ==========================================
// CURRENT USER
// ==========================================

app.get("/current-user", (req, res) => {

    if (!req.session.user) {

        return res.json({

            loggedIn: false

        });

    }


    res.json({

        loggedIn: true,

        user:
            req.session.user

    });

});


// ==========================================
// LOGOUT
// ==========================================

app.get("/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            console.log(
                "Logout error:",
                error
            );

            return res.status(500).send(
                "Logout failed."
            );

        }


        res.redirect("/");

    });

});


// ==========================================
// HELPER REGISTRATION PAGE
// ==========================================

app.get("/register-helper", (req, res) => {

    res.send(`

<!DOCTYPE html>

<html>

<head>

    <title>Register Helper</title>

</head>

<body>

    <h1>Register Helper</h1>

    <form
        method="POST"
        action="/register-helper"
    >

        <p>

            <label>
                Helper Name
            </label>

            <br>

            <input
                type="text"
                name="name"
                required
            >

        </p>


        <p>

            <label>
                Phone Number
            </label>

            <br>

            <input
                type="text"
                name="phone"
                required
            >

        </p>


        <p>

            <label>
                Service
            </label>

            <br>

            <select
                name="service"
                required
            >

                <option value="">
                    Select Service
                </option>

                <option value="PUNCTURE">
                    PUNCTURE
                </option>

                <option value="BATTERY_STARTING">
                    BATTERY_STARTING
                </option>

                <option value="FUEL">
                    FUEL
                </option>

                <option value="OVERHEATING">
                    OVERHEATING
                </option>

                <option value="TOWING">
                    TOWING
                </option>

            </select>

        </p>


        <p>

            <label>
                Latitude
            </label>

            <br>

            <input
                type="number"
                step="any"
                name="latitude"
                required
            >

        </p>


        <p>

            <label>
                Longitude
            </label>

            <br>

            <input
                type="number"
                step="any"
                name="longitude"
                required
            >

        </p>


        <button type="submit">
            Register Helper
        </button>

    </form>

</body>

</html>

    `);

});


// ==========================================
// REGISTER HELPER
// ==========================================

app.post("/register-helper", async (req, res) => {

    const {
        name,
        phone,
        service,
        latitude,
        longitude
    } = req.body;


    try {

        if (
            !name ||
            !phone ||
            !service
        ) {

            return res.status(400).send(
                "Name, phone and service are required."
            );

        }


        const helperLatitude =
            Number(latitude);

        const helperLongitude =
            Number(longitude);


        if (
            !Number.isFinite(helperLatitude) ||
            !Number.isFinite(helperLongitude)
        ) {

            return res.status(400).send(
                "Valid latitude and longitude are required."
            );

        }


        // ----------------------------------
        // Check whether helper already exists
        // ----------------------------------

        const existingHelper =
            await Helper.findOne({
                phone: phone
            });


        if (existingHelper) {

            return res.status(400).send(
                "A helper with this phone number already exists."
            );

        }


        // ----------------------------------
        // Create helper
        // ----------------------------------

        const helper =
            await Helper.create({

                name:
                    name,

                phone:
                    phone,

                service:
                    service,

                latitude:
                    helperLatitude,

                longitude:
                    helperLongitude,

                available:
                    true

            });


        console.log(
            "Helper registered:",
            helper
        );


        res.send(`

            <h2>
                Helper registered successfully!
            </h2>

            <p>
                Name: ${helper.name}
            </p>

            <p>
                Service: ${helper.service}
            </p>

            <p>
                Phone: ${helper.phone}
            </p>

            <a href="/">
                Go to Home
            </a>

        `);

    }

    catch (error) {

        console.log(
            "Error registering helper:"
        );

        console.log(error);


        res.status(500).send(

            "Helper registration failed: " +
            error.message

        );

    }

});


// ==========================================
// START SERVER
// ==========================================

app.listen(3000, () => {

    console.log(
        "================================"
    );

    console.log(
        "Server running on:"
    );

    console.log(
        "http://localhost:3000"
    );

    console.log(
        "================================"
    );

});

