const mongoose = require("mongoose");
const fs = require("fs");
const Helper = require("./models/Helper");

mongoose.connect("mongodb://127.0.0.1:27017/vehicleAssistance")
    .then(async () => {

        const helpers = JSON.parse(
            fs.readFileSync("helpers.json", "utf-8")
        );

        const count = await Helper.countDocuments();

        if (count === 0) {
            await Helper.insertMany(helpers);
            console.log("Helpers inserted successfully");
        } else {
            console.log("Helpers already exist. Nothing inserted.");
        }

        await mongoose.connection.close();
    })
    .catch(err => console.log(err));