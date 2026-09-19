const mongoose = require("mongoose");

const assistanceRequestSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: true
        },

        userPhone: {
            type: String,
            required: true
        },

        helperName: {
            type: String,
            default: ""
        },

        helperPhone: {
            type: String,
            required: true
        },

        problem: {
            type: String,
            required: true
        },

        category: {
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

        status: {
            type: String,
            enum: [
                "PENDING",
                "ACCEPTED",
                "REJECTED"
            ],
            default: "PENDING"
        }

    },

    {
        timestamps: true
    }
);


module.exports =
    mongoose.model(
        "AssistanceRequest",
        assistanceRequestSchema
    );