const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: {
    rejectUnauthorized: false,
    ca: require("fs").readFileSync("./cert/cc-ca.crt").toString(),
  },
});

module.exports = {pool};
