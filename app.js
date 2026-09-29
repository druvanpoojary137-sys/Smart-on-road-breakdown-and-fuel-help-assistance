const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { spawn } = require("child_process");

const Helper = require("./models/Helper");
const AssistanceRequest = require("./models/AssistanceRequest");

const app = express();
const PORT = 3000;


// ===============================
// MIDDLEWARE
// ===============================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
    session({
        secret: "vehicle-assistance-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);

app.set("view engine", "ejs");

app.use(express.static("public"));


// ===============================
// MONGODB
// ===============================

mongoose
    .connect("mongodb://127.0.0.1:27017/vehicleAssistance")
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((error) => {
        console.error("MongoDB connection error:", error);
    });


// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
    res.redirect("/login");
});


// ===============================
// USER LOGIN PAGE
// ===============================

app.get("/login", (req, res) => {
    res.render("login");
});


// ===============================
// USER LOGIN
// ===============================

app.post("/login", (req, res) => {

    const { name, phone } = req.body;

    if (!name || !phone) {
        return res.status(400).json({
            success: false,
            message: "Name and phone are required"
        });
    }

    req.session.user = {
        name: name.trim(),
        phone: phone.trim(),
        role: "user"
    };

    console.log("USER LOGIN:");
    console.log(req.session.user);

    res.json({
        success: true,
        redirect: "/problem"
    });
});


// ===============================
// CURRENT USER
// ===============================

app.get("/current-user", (req, res) => {

    if (req.session.helper) {

        return res.json({
            loggedIn: true,
            role: "helper",
            name: req.session.helper.name,
            phone: req.session.helper.phone
        });
    }

    if (req.session.user) {

        return res.json({
            loggedIn: true,
            role: "user",
            name: req.session.user.name,
            phone: req.session.user.phone
        });
    }

    res.json({
        loggedIn: false
    });
});


// ===============================
// USER PROBLEM PAGE
// ===============================

app.get("/problem", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    res.render("breakdown");
});


// ===============================
// LOCATION
// ===============================

app.post("/location", (req, res) => {

    const { latitude, longitude } = req.body;

    console.log("USER LOCATION:");
    console.log("Latitude:", latitude);
    console.log("Longitude:", longitude);

    res.json({
        success: true,
        message: "Location received"
    });
});


// ===============================
// NLP PREDICTION
// ===============================

app.post("/predict", (req, res) => {

    const { problem } = req.body;

    if (!problem) {

        return res.status(400).json({
            success: false,
            message: "Problem is required"
        });
    }

    console.log("PROBLEM:", problem);

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

            console.error("PYTHON ERROR:");
            console.error(errorOutput);

            return res.status(500).json({
                success: false,
                message: "Prediction failed"
            });
        }

        console.log("PYTHON OUTPUT:", output);

        const lines = output
            .trim()
            .split("\n")
            .filter(line => line.trim() !== "");

        const category =
            lines[lines.length - 1].trim();

        console.log("Predicted category:", category);

        res.json({
            success: true,
            category: category
        });
    });
});


// ===============================
// DISTANCE CALCULATION
// ===============================

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371;

    const dLat =
        (lat2 - lat1) * Math.PI / 180;

    const dLon =
        (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *

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


// ===============================
// FIND HELPERS
// ===============================

app.post("/find-helper", async (req, res) => {

    try {

        const {
            category,
            latitude,
            longitude
        } = req.body;

        if (
            !category ||
            latitude === undefined ||
            longitude === undefined
        ) {

            return res.status(400).json({
                success: false,
                message: "Category and location are required"
            });
        }

        const helpers = await Helper.find({
            service: category,
            available: true
        });

        const userLat = Number(latitude);
        const userLon = Number(longitude);

        const result = helpers.map((helper) => {

            const distance =
                calculateDistance(
                    userLat,
                    userLon,
                    helper.latitude,
                    helper.longitude
                );

            return {
                id: helper._id,
                name: helper.name,
                phone: helper.phone,
                service: helper.service,
                latitude: helper.latitude,
                longitude: helper.longitude,
                distance: Number(
                    distance.toFixed(2)
                )
            };
        });

        result.sort(
            (a, b) => a.distance - b.distance
        );

        console.log(
            "Helpers found:",
            result.length
        );

        res.json({
            success: true,
            helpers: result.slice(0, 5)
        });

    } catch (error) {

        console.error(
            "FIND HELPER ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Could not find helpers"
        });
    }
});


// ===============================
// REQUEST HELPER
// ===============================

app.post("/request-helper", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.status(401).json({
                success: false,
                message: "User not logged in"
            });
        }

        const {
            helperPhone,
            problem,
            category,
            latitude,
            longitude
        } = req.body;

        if (
            !helperPhone ||
            !problem ||
            !category
        ) {

            return res.status(400).json({
                success: false,
                message: "Missing request details"
            });
        }

        const helper =
            await Helper.findOne({
                phone: helperPhone
            });

        if (!helper) {

            return res.status(404).json({
                success: false,
                message: "Helper not registered"
            });
        }

        const request =
            new AssistanceRequest({

                userName:
                    req.session.user.name,

                userPhone:
                    req.session.user.phone,

                helperName:
                    helper.name,

                helperPhone:
                    helper.phone,

                problem:
                    problem,

                category:
                    category,

                latitude:
                    Number(latitude),

                longitude:
                    Number(longitude),

                status:
                    "PENDING"
            });

        await request.save();

        console.log(
            "REQUEST CREATED:"
        );

        console.log(request);

        res.json({
            success: true,
            message: "Assistance request sent",
            requestId: request._id
        });

    } catch (error) {

        console.error(
            "REQUEST HELPER ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Could not send assistance request"
        });
    }
});


// ===============================
// USER REQUEST STATUS
// ===============================

app.get("/request-status", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.status(401).json({
                success: false,
                message: "User not logged in"
            });
        }

        let request = null;

        // Check exact request if requestId is provided
        if (req.query.requestId) {

            request =
                await AssistanceRequest.findOne({
                    _id: req.query.requestId,
                    userPhone:
                        req.session.user.phone
                });

        } else {

            // Otherwise get latest request
            request =
                await AssistanceRequest
                    .findOne({
                        userPhone:
                            req.session.user.phone
                    })
                    .sort({
                        createdAt: -1
                    });
        }

        if (!request) {

            return res.json({
                success: true,
                request: null
            });
        }

        console.log(
            "USER REQUEST STATUS:",
            request._id,
            request.status
        );

        res.json({
            success: true,
            request: request
        });

    } catch (error) {

        console.error(
            "REQUEST STATUS ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Could not get request status"
        });
    }
});


// ===============================
// HELPER LOGIN PAGE
// ===============================

app.get("/helper-login", (req, res) => {
    res.render("helper-login");
});


// ===============================
// HELPER LOGIN
// ===============================

app.post("/helper-login", async (req, res) => {

    try {

        const { phone } = req.body;

        if (!phone) {

            return res.status(400).json({
                success: false,
                message: "Phone number required"
            });
        }

        const helper =
            await Helper.findOne({
                phone: phone.trim()
            });

        if (!helper) {

            return res.status(404).json({
                success: false,
                message: "Helper not registered"
            });
        }

        req.session.helper = {

            name: helper.name,

            phone: helper.phone,

            role: "helper"
        };

        console.log(
            "HELPER LOGIN:"
        );

        console.log(
            req.session.helper
        );

        res.json({
            success: true,
            redirect: "/helper"
        });

    } catch (error) {

        console.error(
            "HELPER LOGIN ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Helper login failed"
        });
    }
});


// ===============================
// HELPER DASHBOARD
// ===============================

app.get("/helper", (req, res) => {

    if (!req.session.helper) {
        return res.redirect("/helper-login");
    }

    res.render("helper");
});


// ===============================
// GET HELPER REQUEST
// ===============================

app.get("/helper-request", async (req, res) => {

    try {

        if (!req.session.helper) {

            return res.status(401).json({
                success: false,
                message: "Helper not logged in"
            });
        }

        const request =
            await AssistanceRequest
                .findOne({
                    helperPhone:
                        req.session.helper.phone,

                    status:
                        "PENDING"
                })
                .sort({
                    createdAt: -1
                });

        if (!request) {

            return res.json({
                success: true,
                request: null
            });
        }

        console.log(
            "HELPER REQUEST FOUND:"
        );

        console.log(request);

        res.json({
            success: true,
            request: request
        });

    } catch (error) {

        console.error(
            "HELPER REQUEST ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Could not get request"
        });
    }
});


// ===============================
// ACCEPT REQUEST
// ===============================

app.post("/accept-request", async (req, res) => {

    try {

        if (!req.session.helper) {

            return res.status(401).json({
                success: false,
                message: "Helper not logged in"
            });
        }

        const { requestId } = req.body;

        if (!requestId) {

            return res.status(400).json({
                success: false,
                message: "Request ID required"
            });
        }

        const request =
            await AssistanceRequest.findById(
                requestId
            );

        if (!request) {

            return res.status(404).json({
                success: false,
                message: "Request not found"
            });
        }

        if (
            request.helperPhone !==
            req.session.helper.phone
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "This request belongs to another helper"
            });
        }

        if (request.status !== "PENDING") {

            return res.json({
                success: false,
                message:
                    `Request is already ${request.status}`
            });
        }

        request.status = "ACCEPTED";

        await request.save();

        console.log(
            "REQUEST ACCEPTED:",
            request._id
        );

        res.json({
            success: true,
            message: "Request accepted"
        });

    } catch (error) {

        console.error(
            "ACCEPT ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Accept failed"
        });
    }
});


// ===============================
// REJECT REQUEST
// ===============================

app.post("/reject-request", async (req, res) => {

    try {

        if (!req.session.helper) {

            return res.status(401).json({
                success: false,
                message: "Helper not logged in"
            });
        }

        const { requestId } = req.body;

        if (!requestId) {

            return res.status(400).json({
                success: false,
                message: "Request ID required"
            });
        }

        const request =
            await AssistanceRequest.findById(
                requestId
            );

        if (!request) {

            return res.status(404).json({
                success: false,
                message: "Request not found"
            });
        }

        if (
            request.helperPhone !==
            req.session.helper.phone
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "This request belongs to another helper"
            });
        }

        if (request.status !== "PENDING") {

            return res.json({
                success: false,
                message:
                    `Request is already ${request.status}`
            });
        }

        request.status = "REJECTED";

        await request.save();

        console.log(
            "REQUEST REJECTED:",
            request._id
        );

        res.json({
            success: true,
            message: "Request rejected"
        });

    } catch (error) {

        console.error(
            "REJECT ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Reject failed"
        });
    }
});


// ===============================
// HELPER LOGOUT
// ===============================

app.get("/helper-logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            return res.status(500).json({
                success: false,
                message: "Logout failed"
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            success: true
        });
    });
});


// ===============================
// USER LOGOUT
// ===============================

app.get("/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            return res.status(500).send(
                "Logout failed"
            );
        }

        res.clearCookie("connect.sid");

        res.redirect("/login");
    });
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
                success: false,
                message: "All fields are required"
            });
        }

        const existingHelper =
            await Helper.findOne({
                phone: phone.trim()
            });

        if (existingHelper) {

            return res.status(400).json({
                success: false,
                message: "Helper already registered"
            });
        }

        const helper =
            new Helper({

                name:
                    name.trim(),

                phone:
                    phone.trim(),

                service:
                    service.trim(),

                latitude:
                    Number(latitude),

                longitude:
                    Number(longitude),

                available:
                    true
            });

        await helper.save();

        console.log(
            "HELPER REGISTERED:",
            helper
        );

        res.json({
            success: true,
            message:
                "Helper registered successfully",
            helper:
                helper
        });

    } catch (error) {

        console.error(
            "REGISTER HELPER ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Helper registration failed"
        });
    }
});


// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});