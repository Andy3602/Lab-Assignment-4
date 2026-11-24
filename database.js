const mongoose = require("mongoose");
const dns = require("dns");

require("dotenv").config();

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const connection = mongoose.connect(process.env.mongourl);

module.exports = { connection };