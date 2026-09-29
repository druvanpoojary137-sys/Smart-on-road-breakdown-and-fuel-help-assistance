const mongoose = require("mongoose");

const helperSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true,
        unique: true
    },

    service: {
        type: String,
        required: true
    },

    latitude: {
        type: Number,
        required: true
    },

    longitude: {
        type: Number,
        required: true
    },

    available: {
        type: Boolean,
        default: true
    }

});

module.exports =
    mongoose.model("Helper", helperSchema);