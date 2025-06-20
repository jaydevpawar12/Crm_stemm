// const { Pool } = require('pg');
// const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// const client = new SecretManagerServiceClient();

// async function getSecret(secretName) {
//   try {
//     console.log(`Fetching secret: ${secretName}`);
//     const [version] = await client.accessSecretVersion({
//       name: `projects/reminder-app-8226b/secrets/${secretName}/versions/latest`,
//     });
//     const secretValue = version.payload.data.toString();
//     console.log(`Successfully fetched secret: ${secretName}`);
//     return secretValue;
//   } catch (error) {
//     console.error(`Error fetching secret ${secretName}:`, error);
//     throw error;
//   }
// }

// let pool;
// async function initializePool() {
//   if (!pool) {
//     try {
//       const connectionString = await getSecret('cockroachdb-connection-uri');
//       const caCert = await getSecret('cockroachdb-ca-cert');

//       console.log("Creating new database pool...");
//       pool = new Pool({
//         connectionString,
//         ssl: {
//           rejectUnauthorized: true,
//           ca: caCert,
//         },
//       });

//       // Test the connection
//       const testClient = await pool.connect();
//       console.log("Database connection successful");
//       testClient.release();
//     } catch (error) {
//       console.error("Failed to initialize database pool:", error);
//       throw error;
//     }
//   }
//   return pool;
// }

// module.exports = { initializePool };


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