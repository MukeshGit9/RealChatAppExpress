const mongoose = require('mongoose');

// define user schema
const userSchema = new mongoose.Schema({
    username :{
      type:String,
      required:true,
      unique:true
    },
    email:{
      type:String,
      required:true,
      unique:true
    },
    password:{
      type:String,
      required:true
    }
});

// create user model from chema
const User = mongoose.model('User',userSchema);
module.exports = User;