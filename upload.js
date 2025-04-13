const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { log } = require("console");
require("dotenv").config();

const BASE_URL = process.env.BASE_URL_SERVER;

const router = express.Router();

//ensure uploads folder exist
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

//storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    //Accept images and common docs
    const allowed = [
      "image/png",
      "image/jpeg",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessinggml.document",
      "video/mp4",
      "video/mov",
      "video/webm",
      "video/ogg"
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type"), false);
  },
});

// upload endpoint
router.post("/upload", upload.array("files", 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res
      .status(400)
      .json({ status: "Error", message: "No files uploaded" });
  }
  const uploadedFiles = req.files.map((file) => ({
    fileUrl: `${BASE_URL}/uploads/${file.filename}`,
    fileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  }));

  res.status(200).json({ status: "success", files: uploadedFiles });
});

module.exports = router;
