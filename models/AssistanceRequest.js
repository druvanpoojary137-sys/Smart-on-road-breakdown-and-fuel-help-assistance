const mongoose = require("mongoose");

const assistanceRequestSchema = new mongoose.Schema({
    userName: String,
    userPhone: String,
    helperPhone: String,
    problem: String,
    category: String,
    latitude: Number,
    longitude: Number,
    status: {
        type: String,
        default: "PENDING"
    }
}, {
    timestamps: true
});

module.exports = mongoose.model(
    "AssistanceRequest",
    assistanceRequestSchema
);