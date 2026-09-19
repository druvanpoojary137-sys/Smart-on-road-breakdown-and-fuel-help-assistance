const session = require("express-session");
const express = require("express");
const mongoose = require("mongoose");
const Helper = require("./models/Helper");
const AssistanceRequest = require("./models/AssistanceRequest");
const { spawn } = require("child_process");

const app = express();


// ===============================
// MongoDB Connection
// ===============================

mongoose.connect("mongodb://127.0.0.1:27017/vehicleAssistance")
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((err) => {
        console.log("MongoDB connection error:", err);
    });


// ===============================
// Middleware
// ===============================

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(session({
    secret: "vehicle-assistance-secret",
    resave: false,
    saveUninitialized: false
}));

app.set("view engine", "ejs");

app.use(express.static("public"));


// ===============================
// Home Page
// ===============================

app.get("/", (req, res) => {
    res.render("breakdown");
});


// ===============================
// Receive User Location
// ===============================

app.post("/location", (req, res) => {

    const {
        latitude,
        longitude
    } = req.body;

    console.log("User Latitude:", latitude);
    console.log("User Longitude:", longitude);

    res.json({
        message: "Location received"
    });

});


// ===============================
// Predict Vehicle Problem
// ===============================

app.post("/predict", (req, res) => {

    const problem = req.body.problem;

    if (!problem) {
        return res.status(400).json({
            message: "Problem description is required."
        });
    }

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

    python.on("close", (code) => {

        if (code !== 0) {

            return res.status(500).json({
                message: "Prediction failed"
            });

        }

        res.json({
            category: result.trim()
        });

    });

});


// ===============================
// Calculate Distance
// Haversine Formula
// ===============================

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
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;

}


// ===============================
// Find Suitable Helpers
// ===============================

app.post("/find-helper", async (req, res) => {

    const {
        category,
        latitude,
        longitude
    } = req.body;

    console.log(
        "Find Helper Request:"
    );

    console.log(
        "Category:",
        category
    );

    console.log(
        "Latitude:",
        latitude
    );

    console.log(
        "Longitude:",
        longitude
    );


    try {

        // Check user location

        if (
            latitude === undefined ||
            longitude === undefined ||
            latitude === null ||
            longitude === null
        ) {

            return res.status(400).json({
                message:
                    "User location not available."
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
                    "Invalid user location."
            });

        }


        // Check category

        if (!category) {

            return res.status(400).json({
                message:
                    "Problem category is missing."
            });

        }


        console.log(
            "Searching helpers for:",
            category
        );


        // Find available helpers

        const helpers =
            await Helper.find({

                service: category,

                available: true

            });


        console.log(
            "Helpers found:",
            helpers.length
        );


        const matchingHelpers = [];


        for (const helper of helpers) {

            const helperLatitude =
                Number(helper.latitude);

            const helperLongitude =
                Number(helper.longitude);


            // Skip invalid helper locations

            if (
                !Number.isFinite(helperLatitude) ||
                !Number.isFinite(helperLongitude)
            ) {

                console.log(
                    "Skipping helper because location is invalid:",
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

                available:
                    helper.available,

                distance:
                    distance

            });

        }


        // Sort nearest helper first

        matchingHelpers.sort(

            (a, b) =>
                a.distance - b.distance

        );


        console.log(
            "Matching helpers:",
            matchingHelpers
        );


        res.json(
            matchingHelpers
        );

    }

    catch (error) {

        console.log(
            "Error finding helpers:",
            error
        );

        res.status(500).json({

            message:
                error.message ||
                "Error finding helpers"

        });

    }

});


// ===============================
// Request Helper
// ===============================

app.post("/request-helper", async (req, res) => {

    const {
        userName,
        userPhone,
        helperPhone,
        problem,
        category,
        latitude,
        longitude
    } = req.body;


    try {

        // Get logged-in user if available

        const sessionUser =
            req.session.user || {};


        const finalUserName =
            userName ||
            sessionUser.name ||
            "Vehicle User";


        const finalUserPhone =
            userPhone ||
            sessionUser.phone ||
            "";


        // Validate location

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
                    "Valid user location is required."

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


        const newRequest =
            await AssistanceRequest.create({

                userName:
                    finalUserName,

                userPhone:
                    finalUserPhone,

                helperPhone:
                    helperPhone,

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
            "NEW REQUEST:",
            newRequest
        );


        res.json({

            success: true,

            message:
                "Assistance request sent to helper."

        });

    }

    catch (error) {

        console.log(
            "Error saving request:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Failed to send assistance request."

        });

    }

});


// ===============================
// Helper Dashboard
// ===============================

app.get("/helper", (req, res) => {

    res.render("helper");

});


// ===============================
// Accept Request
// ===============================

app.post("/accept-request", async (req, res) => {

    try {

        const request =
            await AssistanceRequest.findOne({

                status: "PENDING"

            }).sort({

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
            "Helper accepted the request."
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


// ===============================
// Reject Request
// ===============================

app.post("/reject-request", async (req, res) => {

    try {

        const request =
            await AssistanceRequest.findOne({

                status: "PENDING"

            }).sort({

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
            "Helper rejected the request."
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


// ===============================
// Check Request Status
// ===============================

app.get("/request-status", async (req, res) => {

    try {

        const request =
            await AssistanceRequest.findOne()
                .sort({
                    createdAt: -1
                });


        if (!request) {

            return res.json({

                found: false,

                status: "NONE"

            });

        }


        // Find helper details

        const helper =
            await Helper.findOne({

                phone:
                    request.helperPhone

            });


        let helperLatitude = null;

        let helperLongitude = null;

        let helperName = "";


        if (helper) {

            helperLatitude =
                Number(helper.latitude);

            helperLongitude =
                Number(helper.longitude);

            helperName =
                helper.name;

        }


        res.json({

            found: true,

            status:
                request.status,

            request: {

                userName:
                    request.userName,

                userPhone:
                    request.userPhone,

                helperPhone:
                    request.helperPhone,

                helperName:
                    helperName,

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
            "Error checking status:",
            error
        );


        res.status(500).json({

            found: false,

            status:
                "ERROR"

        });

    }

});


// ===============================
// Send Request To Helper Dashboard
// ===============================

app.get("/helper-request", async (req, res) => {

    try {

        const request =
            await AssistanceRequest.findOne({

                status: "PENDING"

            }).sort({

                createdAt: -1

            });


        console.log(
            "HELPER REQUEST:",
            request
        );


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

                problem:
                    request.problem,

                category:
                    request.category,

                latitude:
                    request.latitude,

                longitude:
                    request.longitude,

                helperPhone:
                    request.helperPhone,

                status:
                    request.status

            }

        });

    }

    catch (error) {

        console.log(
            "Error getting request:",
            error
        );


        res.status(500).json({

            found: false,

            message:
                "Error getting request"

        });

    }

});


// ===============================
// Login Page
// ===============================

app.get("/login", (req, res) => {

    res.render("login");

});


// ===============================
// Login
// ===============================

app.post("/login", (req, res) => {

    const {
        name,
        phone,
        password,
        role
    } = req.body;


    req.session.user = {

        name:
            name,

        phone:
            phone,

        role:
            role

    };


    console.log(
        "Logged in:",
        req.session.user
    );


    if (role === "helper") {

        res.redirect("/helper");

    }

    else {

        res.redirect("/");

    }

});


// ===============================
// Get Current Logged-In User
// ===============================

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


// ===============================
// Helper Registration Page
// ===============================

app.get("/register-helper", (req, res) => {

    res.render("helper-register");

});


// ===============================
// Register Helper
// ===============================

app.post("/register-helper", async (req, res) => {

    const {
        name,
        phone,
        service,
        latitude,
        longitude
    } = req.body;


    try {

        const helperLatitude =
            Number(latitude);

        const helperLongitude =
            Number(longitude);


        if (
            !Number.isFinite(helperLatitude) ||
            !Number.isFinite(helperLongitude)
        ) {

            return res.status(400).send(

                "Valid helper location is required."

            );

        }


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
            name
        );


        res.send(

            "Helper registered successfully!"

        );

    }

    catch (error) {

        console.log(
            "Error registering helper:",
            error
        );


        res.status(500).send(

            "Helper registration failed."

        );

    }

});


// ===============================
// Start Server
// ===============================

app.listen(3000, () => {

    console.log(
        "Server running on port 3000"
    );

});