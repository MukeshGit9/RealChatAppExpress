const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  senderName: { type: String, required: true },
  originalName: { type: String, required: true },
  fileName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  fileUrl: { type: String, required: true },
  messageType: { type: String, default: "file" },
  timestamp: { type: Date, default: Date.now },
  status: {type: String, enum: ["sent", "delivered", "read"], default: "sent" },
  content: { type: String, default: "File uploaded" },
});

const FileSave = mongoose.model("FileSave", fileSchema);
module.exports = FileSave;
