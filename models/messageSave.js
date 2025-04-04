const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  messageId:{
    type:String,
    required:true,
    unique:true
  },
  senderName:{
    type:String,
    required:true
  },
  senderId:{
    type:String,
    required:true
  },
  receiverId:{
    type:String,
    required:true
  },
  content:{
    type:String,
    required:true
  },
  timestamp:{
    type:Date,
    default:Date.now
  },
  messageType:{
    type:String,
    enum:['text','image','video','file'],
    default:'text'
  },
  status:{
    type:String,
    enum:['sent','delivered','read'],
    default:'sent'
  }
})

const MessageSave = mongoose.model('MessageSave', messageSchema)
module.exports = MessageSave;