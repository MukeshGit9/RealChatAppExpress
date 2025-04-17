const express = require("express");
const http = require("http");
const uploadRoute = require("./upload");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const connectDB = require("./Modules/db");
const connectPgDB = require("./Modules/postgreDb");
const clientPg = require("./postgreDB/clientPg");
const pool = require("./postgreDB/pool");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
// const router = express.Router();

const BASE_URL = process.env.BASE_URL_SERVER;

// enable cors for frontend----------------------------------------------------------------CORS
const corsOptions = {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
};

// app.use(cors(corsOptions)); // enable cors for frontend requests
app.use(cors()); // enable cors for frontend requests

// initialize cors options with socket.io
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    // Allow only this origin
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// middlewares----------------------------------------------------------------------------------MIDDLEWARES
app.use(express.json()); // for parsing application/json
app.use("/api", uploadRoute);
app.use("/uploads", express.static("uploads"));

//DB connection module-----------------------------------------------------------------------DB CONNECTION
connectDB();
connectPgDB();
// clientPg();

// schemas------------------------------------------------------------------------SCHEMA
// const users = {};
const User = require("./models/user"); //import user model
const MessageSave = require("./models/messageSave"); //import messages model
const FileSave = require("./models/files"); //import file model
const activeUsers = {}; //track active users
const messages = []; //store messages temprerely

//jwt secret----------------------------------------------------------------------------JWK
const JWT_SECRET = process.env.JWT_SECRET;

//default route---------------------------------------------------------------------------DEFAULT
app.get("/", (req, res) => {
  res.send("Real Chat App, Using MongoDB Atlas Database and ExpressJS");
});

// User registration---------------------------------------------------------------------REGISTRATION
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;

  // Check if all fields are required
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ status: "error", message: "All fields are required" });
  }

  try {
    // Check if user already exists in PostgreSQL
    // const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const result = await clientPg.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (result.rows.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "User already exists in PostgreSQL",
      });
    }

    // Check if user already exists in MongoDB
    // const existingUser = await User.findOne({ email });
    // if (existingUser) {
    //   return res.status(400).json({ "status": "error", "message": "User already exists in MongoDB" });
    // }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into PostgreSQL
    const insertQuery =
      "INSERT INTO users (username, email, password, created_at) VALUES ($1, $2, $3, DEFAULT) RETURNING *";
    const insertResult = await clientPg.query(insertQuery, [
      username,
      email,
      hashedPassword,
    ]);

    // Check if the insertion in PostgreSQL was successful
    if (insertResult.rows.length === 0) {
      return res.status(500).json({
        status: "error",
        message: "Failed to insert user into PostgreSQL",
      });
    }
    const newUserPostgres = insertResult.rows[0];

    // Create new user and save to MongoDB
    // const newUser = new User({
    //   username,
    //   email,
    //   password: hashedPassword // Store hashed password in MongoDB as well
    // });

    // await newUser.save(); // Save the user to MongoDB

    // Return a successful response
    return res.status(201).json({
      status: "success",
      message: "User registered successfully",
      user: {
        username: newUserPostgres.username,
        email: newUserPostgres.email,
      },
    });
  } catch (err) {
    console.log("Error occurred:", err); // Log the error for debugging
    res.status(500).json({
      status: "error",
      message: "Error while registering user, please try again",
    });
  }
});

//User login------------------------------------------------------------------------------------LOGIN
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // check user in mongodb
    // const user = await User.findOne({ email });
    // if (!user) {
    //   return res.status(404).json({ "status": "error", "message": 'user not found in MongoDB' });
    // }

    // check user in postgre
    const pgUserResult = await clientPg.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    if (pgUserResult.rows.length === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "user not found in Postgres DB" });
    }
    const pgUser = pgUserResult.rows[0];

    // const isPasswordCorrectMongoDB = await bcrypt.compare(password, user.password);
    const isPasswordCorrectPostgresDB = await bcrypt.compare(
      password,
      pgUser.password
    );
    if (!isPasswordCorrectPostgresDB) {
      return res
        .status(401)
        .json({ status: "error", message: "incorrect password" });
    }

    //generate jwt token using mongodb
    // const token = jwt.sign({ email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

    //generate jwt token using postgre
    const tokenPg = jwt.sign(
      { email: pgUser.email, username: pgUser.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      status: "success",
      message: "Login Successful!",
      token: tokenPg,
      user: {
        username: pgUser.username,
        email: pgUser.email,
      },
    }); //return token as a JSON response
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ status: "error", message: "Something wrong, Please try again" });
  }
});

//middleware to verify token and authenticate user---------------------------------------------VERIFY TOKEN
const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"]; //get the authorization header
  const token = authHeader && authHeader.split(" ")[1]; //get the token from header
  if (!token) {
    return res.status(401).json({ status: "Error", message: "Token Required" });
  }

  //verif JWT Token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res
        .status(403)
        .json({ status: "Error", message: "Invalide Token" });
    }
    req.user = user;
    next();
  });
};

//user profile--------------------------------------------------------------------------------PROFILE
app.get("/api/userprofile", authenticate, (req, res) => {
  res.json({
    status: "success",
    user: {
      username: req.user.username,
      email: req.user.email,
    },
  });
});

//Get all users--------------------------------------------------------------------------------ALL USERS
app.get("/api/allusers", async (req, res) => {
  try {
    const allUsers = await clientPg.query(`SELECT * from users `);
    if (allUsers.rows.length === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "No users found" });
    }
    res.status(200).json({ status: "success", data: allUsers.rows });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Error fetching users" });
  }
});

//socket.io handling real time chat messages----------------------------------------------------HANDLING MESSAGES
io.on("connection", (socket) => {
  console.log("A user connected with Socket Successfuly!!", socket.id);
  let currentUser = null;

  // user authenticate via socket.io (using JWT token)---------------------Auth via socket.io
  socket.on("authenticate", async (token) => {
    console.log("Authenticate event received with token:", token);

    jwt.verify(token, JWT_SECRET, async (err, user) => {
      if (err) {
        socket.emit("unauthorized", {
          status: "Error",
          message: "Authentication failed",
        });
        return;
      }

      currentUser = user;
      const userId = user.email;
      activeUsers[userId] = socket.id;

      console.log(`User ${userId} is connected with socket ${socket.id}`);
      socket.emit("auth_success", user.username, userId);
      console.log("active users auth", activeUsers);

      try {
        // ✅ ONLY fetch undelivered text messages
        const missedMessages = await MessageSave.find({
          receiverId: userId,
          status: "sent",
        });

        missedMessages.forEach((msg) => {
          socket.emit("receive_message", {
            user: msg.senderName,
            formattedMessage: {
              status: "success",
              type: "message",
              data: msg,
            },
          });
        });

        // ✅ ONLY fetch undelivered file messages
        const missedFiles = await FileSave.find({
          receiverId: userId,
          status: "sent",
        });

        missedFiles.forEach((file) => {
          socket.emit("receive_file", {
            user: file.senderName,
            fileMessage: {
              status: "success",
              type: "file",
              data: file,
            },
          });
        });

        // ✅ Mark as delivered
        await MessageSave.updateMany(
          { receiverId: userId, status: "sent" },
          { $set: { status: "delivered" } }
        );

        await FileSave.updateMany(
          { receiverId: userId, status: "sent" },
          { $set: { status: "delivered" } }
        );
      } catch (err) {
        console.log("Error fetching missed messages:", err);
      }
    });
  });

  //handle incoming messages------------------------------------------------------------------INCOMING MESSAGES
  socket.on("send_message", async (message) => {
    if (currentUser) {
      const messageId = uuidv4();
      // const timestamp = new Date().toISOString();
      const timestamp = new Date();

      const formattedMessage = {
        status: "success",
        type: "message",
        data: {
          messageId,
          senderName: currentUser.username,
          senderId: currentUser.email,
          receiverId: message.receivedId,
          content: message.content,
          timestamp,
          messageType: "text",
          status: "sent",
        },
      };

      //create new message document for mongodb
      const newMessageSave = new MessageSave({
        messageId,
        senderName: currentUser.username,
        senderId: currentUser.email,
        receiverId: message.receivedId,
        content: message.content,
        timestamp,
        messageType: "text",
        status: "sent",
      });

      console.log("active users message", activeUsers);

      console.log("Incoming message payload:", message);
      if (!message.receivedId) {
        console.log("Error: receivedId is missing from the message.");
        return;
      }

      try {
        // message save in mongodb
        await newMessageSave.save(); //method to save

        // ✅ Emit to sender (so it appears instantly)
        socket.emit("receive_message", {
          user: currentUser.username,
          formattedMessage,
        });

        const receiverSocketId = activeUsers[message.receivedId];
        const senderSocketId = activeUsers[currentUser.email];

        console.log("Receever id is : ", receiverSocketId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", {
            user: currentUser.username,
            formattedMessage,
          });

          // send message to sender when
          // io.to(senderSocketId).emit("receive_message", {
          //   user: currentUser.username,
          //   formattedMessage,
          // });
          socket.to(receiverSocketId).emit("send_message_ack", {
            status: "success",
            message: "Message sent successfully!",
          });
          socket
            .to(receiverSocketId)
            .emit("message_status_update", { messageId, status: "sent" });
          console.log(
            `${currentUser.username} sent a message: ${message.content}`
          );
        }
      } catch (error) {
        console.log("Error while saving messages to database", error);
        socket.emit("message_send_ack", {
          status: "error",
          message: "Error sending message",
        });
      }
    }
  });

  //handle file uploads-------------------------------------------------------------------------FILE UPLOAD
  socket.on("upload_file", async (fileData) => {
    if (currentUser) {
      console.log(currentUser);
      const fileId = uuidv4();
      // const timestamp = new Date().toISOString();
      const timestamp = new Date();
      const {
        fileName,
        originalName,
        fileMimeType,
        fileUrl,
        receivedId,
        size,
      } = fileData;

      const fileMessage = {
        status: "success",
        type: "file",
        data: {
          messageId: fileId,
          senderName: currentUser.username,
          senderId: currentUser.email,
          receiverId: receivedId,
          originalName: originalName,
          fileName: fileName,
          mimeType: fileMimeType,
          size: size,
          fileUrl,
          timestamp,
          messageType: "file",
          status: "sent",
          content: "File uploaded",
        },
      };

      //create new file document for mongodb
      const newFileMessage = new FileSave({
        messageId: fileId,
        senderName: currentUser.username,
        senderId: currentUser.email,
        receiverId: receivedId,
        originalName: originalName,
        fileName: fileName,
        mimeType: fileMimeType,
        size: size,
        fileUrl,
        timestamp,
        messageType: "file",
        status: "sent",
        content: "File uploaded",
      });

      console.log("Incoming message payload:", fileData);
      if (!fileData.receivedId) {
        console.log("Error: receivedId is missing from the file data.");
        return;
      }

      try {
        await newFileMessage.save();

        const receiverSocketId = activeUsers[receivedId];
        const senderSocketId = activeUsers[currentUser.email];
        console.log("Receever id is : ", receiverSocketId);

        // ✅ Emit to sender (so it appears instantly)
        socket.emit("receive_file", {
          user: currentUser.username,
          fileMessage,
        });

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_file", {
            user: currentUser.username,
            fileMessage,
          });

          // io.to(senderSocketId).emit("receive_file", {
          //   user: currentUser.username,
          //   fileMessage,
          // });

          socket.to(receiverSocketId).emit("file_upload_ack", {
            status: "success",
            message: "File sent successfully!",
          });
          socket
            .to(receiverSocketId)
            .emit("message_status_update", { fileId, status: "sent" });
          console.log(`${currentUser.username} uploaded a file: ${fileName}`);
        }
      } catch (error) {
        console.log("Error while saving file to MongoDB database", error);
        socket.emit("file_upload_ack", {
          status: "error",
          message: "Error saving file",
        });
      }
    }
  });

  //Route to get message for current user-----------------------------------------------------MESSAGE FOR CURRENT USER
  app.get("/messages", async (req, res) => {
    const { userId, receiveId } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ status: "error", message: "user id is required" });
    }
    try {
      const storedMessages = await MessageSave.find({
        $or: [
          { senderId: userId, receiverId: receiveId }, //get message where user is sender
          // { receiverId: "receiver_mail@example.com" }, //get message where user is receiver
          { senderId: receiveId, receiverId: userId }, //get message where user is receiver
        ],
      }).sort({ timestamp: 1 }); //older first
      res.json({ status: "success", data: storedMessages });
    } catch (error) {
      console.log("error fetching messages", error);
      res
        .status(500)
        .json({ status: "error", message: "Failed to fetch messages" });
    }
  });

  //Route to get files for current user----------------------------------------------------------FILES FOR CURRENT USER
  app.get("/files", async (req, res) => {
    const { userId, receiveId } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ status: "error", message: "user is is required" });
    }
    try {
      const storedFiles = await FileSave.find({
        $or: [
          { senderId: userId, receiverId: receiveId },
          { senderId: receiveId, receiverId: userId },
        ],
      }).sort({ timestamp: 1 }); //older first
      res.json({ status: "success", data: storedFiles });
    } catch (error) {
      console.log("error fetching files", error);
      res
        .status(500)
        .json({ status: "error", message: "failed to fetch files" });
    }
  });

  //handle typing notification----------------------------------------------------------------------TYPING
  socket.on("user_typing", (username) => {
    socket.broadcast.emit("user_typing", username); //notify other users
  });

  // delete messages---------------------------------------------------------------------------DELETE MESSAGE
  socket.on("delete_message", async ({ messageId, senderId }) => {
    try {
      // try deleting messages
      const message = await MessageSave.findOne({ messageId });
      if (message) {
        if (message.senderId !== senderId) {
          return socket.emit("delete_ack", {
            status: "error",
            message: "Unauthorized to delete this message",
          });
        }
        await message.deleteOne({ messageId });
        io.emit("message_deleted", { messageId });
        return socket.emit("delete_ack", {
          status: "success",
          message: "Text message deleted",
        });
      }

      // try deleting files
      const file = await FileSave.findOne({ messageId });
      if (file) {
        if (file.senderId !== senderId) {
          return socket.emit("Delete_ack", {
            status: "error",
            message: "Unauthorized to delete this file",
          });
        }

        await FileSave.deleteOne({ messageId });
        io.emit("message_deleted", { messageId });
        return socket.emit("delete_ack", {
          status: "success",
          message: "File message deleted",
        });
      }

      // if no message found
      socket.emit("delete_ack", {
        status: "error",
        message: "Message not found",
      });
    } catch (error) {
      console.log("Delete error", error);
      socket.emit("delete_ack", {
        status: "error",
        message: "Server error during message deletion",
      });
    }
  });

  // message status-------------------------------------------------------------------------READ, delivered, SEEN STATUS
  // Mark message as read
  socket.on("mark_as_read", async (messageId) => {
    await MessageSave.updateOne({ messageId }, { status: "read" });
    await FileSave.updateOne({ messageId }, { status: "read" });
    io.emit("message_status_update", { messageId, status: "read" });
  });

  // Mark message as delivered (on view)
  socket.on("mark_as_delivered", async (messageId) => {
    await MessageSave.updateOne({ messageId }, { status: "delivered" });
    await FileSave.updateOne({ messageId }, { status: "read" });
    io.emit("message_status_update", { messageId, status: "delivered" });
  });

  // Mark as read when user opens chat
  socket.on("mark_as_read", async ({ messageId }) => {
    await MessageSave.updateOne({ messageId }, { status: "read" });
    await FileSave.updateOne({ messageId }, { status: "read" });
    io.emit("message_status_update", { messageId, status: "read" });
  });

  // handling calls------------------------------------------------------------------------------HANDLE VIDEO CALLS
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  socket.on("call_user", ({ to, from, signal, name }) => {
    io.to(to).emit("incoming_call", { from, signal, name });
  });

  socket.on("answer_call", ({ to, signal }) => {
    io.to(to).emit("call_accepted", { signal });
  });

  socket.on("end_call", ({ to }) => {
    io.to(to).emit("call_ended");
  });

  //handle user disconnection------------------------------------------------------------------------DISCONNECT
  socket.on("disconnect", () => {
    if (currentUser && activeUsers[currentUser.email]) {
      delete activeUsers[currentUser.email];
      console.log(`${currentUser.username} disconnected (${socket.id})`);
    }
  });
});

// start server------------------------------------------------------------------------------------SERVER START
const PORT = process.env.PORT || 11000;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// This will make the server accessible to other devices in the network

server.listen(PORT, `192.168.0.5`, () => {
  console.log(`Server running on ${BASE_URL}`);
});
