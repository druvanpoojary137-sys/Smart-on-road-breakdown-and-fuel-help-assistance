const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { spawn } = require("child_process");

const Helper = require("./models/Helper");
const AssistanceRequest = require("./models/AssistanceRequest");

const app = express();


// ===============================
// MONGODB CONNECTION
// ===============================

mongoose
    .connect("mongodb://127.0.0.1:27017/vehicleAssistance")
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((error) => {
        console.log("MongoDB connection error:", error);
    });


// ===============================
// MIDDLEWARE
// ===============================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: "vehicle-assistance-secret",
        resave: false,
        saveUninitialized: false
    })
);


// ===============================
// VIEW ENGINE
// ===============================

app.set("view engine", "ejs");


// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
    res.render("breakdown");
});


// ===============================
// USER LOGIN
// ===============================

app.get("/login", (req, res) => {
    res.render("login");
});


app.post("/login", (req, res) => {

    const { name, phone } = req.body;

    if (!name || !phone) {
        return res.status(400).send(
            "Name and phone are required."
        );
    }

    req.session.user = {
        name: name.trim(),
        phone: phone.trim(),
        role: "user"
    };

    console.log("User logged in:");
    console.log(req.session.user);

    res.redirect("/");
});


// ===============================
// CURRENT USER
// ===============================

app.get("/current-user", (req, res) => {

    if (!req.session.user) {
        return res.json({
            loggedIn: false
        });
    }

    res.json({
        loggedIn: true,
        user: req.session.user
    });
});


// ===============================
// LOGOUT
// ===============================

app.get("/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {
            console.log("Logout error:", error);
            return res.status(500).send("Logout failed.");
        }

        res.redirect("/");
    });
});


// ===============================
// USER LOCATION
// ===============================

app.post("/location", (req, res) => {

    const { latitude, longitude } = req.body;

    console.log("User location:");
    console.log("Latitude:", latitude);
    console.log("Longitude:", longitude);

    res.json({
        message: "Location received successfully."
    });
});


// ===============================
// NLP PREDICTION
// ===============================

app.post("/predict", (req, res) => {

    const { problem } = req.body;

    if (!problem) {
        return res.status(400).json({
            error: "Problem description is required."
        });
    }

    const pythonProcess = spawn(
        "python",
        [
            "nlp/predict_from_app.py",
            problem
        ]
    );

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
        output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
    });

    pythonProcess.on("close", (code) => {

        if (code !== 0) {

            console.log("Python error:");
            console.log(errorOutput);

            return res.status(500).json({
                error: "Prediction failed."
            });
        }

        const category = output.trim();

        console.log(
            "Predicted category:",
            category
        );

        res.json({
            category: category
        });
    });
});


// ===============================
// HAVERSINE DISTANCE
// ===============================

function calculateDistance(
    latitude1,
    longitude1,
    latitude2,
    longitude2
) {

    const earthRadius = 6371;

    const lat1 =
        latitude1 * Math.PI / 180;

    const lat2 =
        latitude2 * Math.PI / 180;

    const differenceLatitude =
        (latitude2 - latitude1) *
        Math.PI / 180;

    const differenceLongitude =
        (longitude2 - longitude1) *
        Math.PI / 180;

    const a =
        Math.sin(differenceLatitude / 2) *
        Math.sin(differenceLatitude / 2) +

        Math.cos(lat1) *
        Math.cos(lat2) *

        Math.sin(differenceLongitude / 2) *
        Math.sin(differenceLongitude / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadius * c;
}


// ===============================
// FIND HELPER
// ===============================

app.post("/find-helper", async (req, res) => {

    try {

        const {
            category,
            latitude,
            longitude
        } = req.body;

        console.log("Finding helper...");
        console.log("Category:", category);
        console.log("Latitude:", latitude);
        console.log("Longitude:", longitude);


        if (
            !category ||
            latitude === undefined ||
            longitude === undefined
        ) {

            return res.status(400).json({
                error:
                    "Category and location are required."
            });
        }


        // Get helpers from MongoDB
        const helpers = await Helper.find({
            service: category,
            available: true
        });


        console.log(
            "Helpers found in database:",
            helpers.length
        );


        if (helpers.length === 0) {

            return res.json({
                helpers: []
            });
        }


        const userLatitude =
            Number(latitude);

        const userLongitude =
            Number(longitude);


        // Calculate distance for every helper
        const helpersWithDistance =
            helpers.map((helper) => {

                const distance =
                    calculateDistance(
                        userLatitude,
                        userLongitude,
                        Number(helper.latitude),
                        Number(helper.longitude)
                    );

                return {

                    id: helper._id,

                    name: helper.name,

                    phone: helper.phone,

                    service: helper.service,

                    latitude: helper.latitude,

                    longitude: helper.longitude,

                    distance:
                        Number(
                            distance.toFixed(2)
                        )
                };
            });


        // Nearest helper first
        helpersWithDistance.sort(
            (a, b) =>
                a.distance - b.distance
        );


        // Top 3 helpers
        const topHelpers =
            helpersWithDistance.slice(0, 3);


        console.log(
            "Top helpers:",
            topHelpers
        );


        res.json({
            helpers: topHelpers
        });


    } catch (error) {

        // IMPORTANT:
        // Show the actual error in terminal
        console.log(
            "ERROR FINDING HELPERS:"
        );

        console.log(error);

        console.log(
            "ERROR MESSAGE:",
            error.message
        );

        res.status(500).json({

            error:
                "Error finding helpers.",

            details:
                error.message
        });
    }
});


// ===============================
// REQUEST ASSISTANCE
// ===============================

app.post("/request-helper", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "Please login first."
            });
        }


        const {
            helperPhone,
            problem,
            category,
            latitude,
            longitude
        } = req.body;


        const userName =
            req.session.user.name;

        const userPhone =
            req.session.user.phone;


        if (!userName || !userPhone) {

            return res.status(400).json({
                error:
                    "User name and phone are required."
            });
        }


        if (
            !helperPhone ||
            !problem ||
            !category ||
            latitude === undefined ||
            longitude === undefined
        ) {

            return res.status(400).json({
                error:
                    "Required information is missing."
            });
        }


        const helper =
            await Helper.findOne({
                phone: helperPhone
            });


        if (!helper) {

            return res.status(404).json({
                error:
                    "Helper not found."
            });
        }


        const newRequest =
            await AssistanceRequest.create({

                userName: userName,

                userPhone: userPhone,

                helperName: helper.name,

                helperPhone: helper.phone,

                problem: problem,

                category: category,

                latitude:
                    Number(latitude),

                longitude:
                    Number(longitude),

                status: "PENDING"
            });


        console.log(
            "Assistance request created:",
            newRequest
        );


        res.json({
            message:
                "Assistance request sent to helper."
        });


    } catch (error) {

        console.log(
            "Request helper error:",
            error
        );

        res.status(500).json({
            error:
                "Unable to send assistance request."
        });
    }
});


// ===============================
// REQUEST STATUS
// ===============================

app.get("/request-status", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.json({
                found: false
            });
        }


        const request =
            await AssistanceRequest
                .findOne({
                    userPhone:
                        req.session.user.phone
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
            request: request
        });


    } catch (error) {

        console.log(
            "Request status error:",
            error
        );

        res.status(500).json({
            found: false,
            error:
                "Error checking request status."
        });
    }
});


// ===============================
// HELPER PAGE
// ===============================

app.get("/helper", (req, res) => {

    res.render("helper");
});


// ===============================
// HELPER REQUEST
// ===============================

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
            request: request
        });


    } catch (error) {

        console.log(
            "Helper request error:",
            error
        );

        res.status(500).json({
            found: false
        });
    }
});


// ===============================
// ACCEPT REQUEST
// ===============================

app.post("/accept-request", async (req, res) => {

    try {

        const request =
            await AssistanceRequest
                .findOneAndUpdate(
                    {
                        status: "PENDING"
                    },
                    {
                        status: "ACCEPTED"
                    },
                    {
                        new: true,
                        sort: {
                            createdAt: -1
                        }
                    }
                );


        if (!request) {

            return res.status(404).json({
                error:
                    "No pending request found."
            });
        }


        res.json({
            message:
                "Request accepted.",
            request: request
        });


    } catch (error) {

        console.log(
            "Accept request error:",
            error
        );

        res.status(500).json({
            error:
                "Unable to accept request."
        });
    }
});


// ===============================
// REJECT REQUEST
// ===============================

app.post("/reject-request", async (req, res) => {

    try {

        const request =
            await AssistanceRequest
                .findOneAndUpdate(
                    {
                        status: "PENDING"
                    },
                    {
                        status: "REJECTED"
                    },
                    {
                        new: true,
                        sort: {
                            createdAt: -1
                        }
                    }
                );


        if (!request) {

            return res.status(404).json({
                error:
                    "No pending request found."
            });
        }


        res.json({
            message:
                "Request rejected.",
            request: request
        });


    } catch (error) {

        console.log(
            "Reject request error:",
            error
        );

        res.status(500).json({
            error:
                "Unable to reject request."
        });
    }
});


// ===============================
// REGISTER HELPER
// ===============================

app.post("/register-helper", async (req, res) => {

    try {

        const {
            name,
            phone,
            service,
            latitude,
            longitude
        } = req.body;


        if (
            !name ||
            !phone ||
            !service ||
            latitude === undefined ||
            longitude === undefined
        ) {

            return res.status(400).json({
                error:
                    "All helper details are required."
            });
        }


        const existingHelper =
            await Helper.findOne({
                phone: phone
            });


        if (existingHelper) {

            return res.status(400).json({
                error:
                    "Helper already registered."
            });
        }


        const helper =
            await Helper.create({

                name: name.trim(),

                phone: phone.trim(),

                service: service,

                latitude:
                    Number(latitude),

                longitude:
                    Number(longitude),

                available: true
            });


        res.json({
            message:
                "Helper registered successfully.",

            helper: helper
        });


    } catch (error) {

        console.log(
            "Register helper error:",
            error
        );

        res.status(500).json({
            error:
                "Unable to register helper."
        });
    }
});


// ===============================
// START SERVER
// ===============================

const PORT = 3000;

app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );
});