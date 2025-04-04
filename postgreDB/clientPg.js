const {Client} = require('pg');
require('dotenv').config();
const createTable = require('./createTable')

//initialize the pg client
const clientPg = new Client({
  // connectionString: process.env.PG_URL,
  connectionString: process.env.PG_URL_GLOB,
  ssl:{
    rejectUnauthorized:false
  }
})

//connect to the pg 
clientPg.connect().then(()=>{console.log("Connected to render PostGres DB"); createTable(clientPg) }).catch((err)=>console.log("Error connecting to render postgres db",err))

module.exports = clientPg;