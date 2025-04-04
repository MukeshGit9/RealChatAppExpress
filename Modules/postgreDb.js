// const {Pool} = require('pg');
const pool = require('../postgreDB/pool')
require('dotenv').config();
const createTable = require('../postgreDB/createTable')
//postgre connection details
// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: process.env.DB_PORT
// })

// to connect database


const connectPgDB = async ()=>{
  try {
    pool.connect()
    .then(()=>{console.log("Connected to PostgreDB"); createTable(pool)})
    .catch((err)=>console.log('Connection error',err.stack))
  } catch (err) {
    console.log('Postgre connected error', err);
    process.exit(1);
  }
}

module.exports = connectPgDB;
// module.exports = pool;