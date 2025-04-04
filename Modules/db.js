const mongoose = require('mongoose');
require('dotenv').config();

//mongodb atlas connection string
const dbURL = process.env.MONGODB_URL;

const connectDB = async ()=>{
  try {
    await mongoose.connect(dbURL, {
      useNewUrlParser : true,
      useUnifiedTopology:true,
    });
    console.log('MongoDb connected successfully!')
  } catch (err) {
    console.log('MongoDB connected error', err);
    process.exit(1);
  }
}

module.exports = connectDB;