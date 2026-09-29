const mongoose = require("mongoose");

const helperSchema =
    new mongoose.Schema({

        name: String,

        phone: String,

        service: String,

        latitude: Number,

        longitude: Number,

        available: {

            type: Boolean,

            default: true

        }

    });


module.exports =
    mongoose.model(
        "Helper",
        helperSchema
    );