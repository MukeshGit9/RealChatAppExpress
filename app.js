const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const connectDB = require('./Modules/db')
const connectPgDB = require('./Modules/postgreDb')
const clientPg = require('./postgreDB/clientPg')
const pool = require('./postgreDB/pool')
const { v4: uuidv4 } = require('uuid')
require('dotenv').config();

const app = express();
const server = http.createServer(app);
// const router = express.Router();

//enable cors for frontend
const corsOptions = {
  origin: ["http://localhost:5173"],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}
//middlewares
app.use(express.json()); // for parsing application/json
// app.use(cors(corsOptions)); // enable cors for frontend requests
app.use(cors()); // enable cors for frontend requests

//initialize cors options with socket.io
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173"], // Allow only this origin
    methods: ['GET', 'POST'],
  }
});

//DB connection module
connectDB();
connectPgDB();
// clientPg();

// const users = {};
const User = require('./models/user'); //import user model
const MessageSave = require('./models/messageSave'); //import messages model
const activeUsers = {}; //track active users
const messages = []; //store messages temprerely

//jwt secret
const JWT_SECRET = process.env.JWT_SECRET;

//default route
app.get('/', (req, res) => {
  res.send('Real Chat App, Using MongoDB Atlas Database and ExpressJS');
});

// User registration
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Check if all fields are required
  if (!username || !email || !password) {
    return res.status(400).json({ "status": "error", "message": 'All fields are required' });
  }

  try {
    // Check if user already exists in PostgreSQL
    // const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const result = await clientPg.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      return res.status(400).json({ 'status': 'error', 'message': 'User already exists in PostgreSQL' });
    }

    // Check if user already exists in MongoDB
    // const existingUser = await User.findOne({ email });
    // if (existingUser) {
    //   return res.status(400).json({ "status": "error", "message": "User already exists in MongoDB" });
    // }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into PostgreSQL
    const insertQuery = 'INSERT INTO users (username, email, password, created_at) VALUES ($1, $2, $3, DEFAULT) RETURNING *';
    const insertResult = await clientPg.query(insertQuery, [username, email, hashedPassword]);

    // Check if the insertion in PostgreSQL was successful
    if (insertResult.rows.length === 0) {
      return res.status(500).json({ 'status': 'error', 'message': 'Failed to insert user into PostgreSQL' });
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
      "status": "success",
      "message": "User registered successfully",
      "user": {
        "username": newUserPostgres.username,
        "email": newUserPostgres.email
      }
    });
  } catch (err) {
    console.log("Error occurred:", err); // Log the error for debugging
    res.status(500).json({
      "status": "error",
      "message": "Error while registering user, please try again"
    });
  }
});


//User login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // check user in mongodb
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ "status": "error", "message": 'user not found in MongoDB' });
    }

    // check user in postgre
    const pgUserResult = await clientPg.query(`SELECT * FROM users WHERE email = $1`, [email])
    if(pgUserResult.rows.length === 0){
      return res.status(404).json({'status':'error', 'message':'user not found in Postgres DB'})
    }
    const pgUser = pgUserResult.rows[0];

    const isPasswordCorrectMongoDB = await bcrypt.compare(password, user.password);
    const isPasswordCorrectPostgresDB = await bcrypt.compare(password, pgUser.password);
    if (!isPasswordCorrectMongoDB && !isPasswordCorrectPostgresDB) {
      return res.status(401).json({ "status": "error", "message": 'incorrect password' });
    }

    //generate jwt token using mongodb
    const token = jwt.sign({ email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

    //generate jwt token using postgre
    const tokenPg = jwt.sign({ email: pgUser.email, username: pgUser.username }, JWT_SECRET, { expiresIn: '1h' });

    res.json({
      "status": "success",
      "message": "Login Successful!",
      "token": tokenPg,
      "user": {
        "username": pgUser.username,
        "email": pgUser.email
      }
    });  //return token as a JSON response
  } catch (err) {
    console.log(err);
    return res.status(500).json({ "status": "error", "message": 'Something wrong, Please try again' })
  }

});

//middleware to verify token and authenticate user
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization']; //get the authorization header
  const token = authHeader && authHeader.split(' ')[1]; //get the token from header
  if (!token) {
    return res.status(401).json({ "status": "Error", "message": "Token Required" });
  }

  //verif JWT Token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ "status": "Error", "message": "Invalide Token" });
    }
    req.user = user;
    next();
  })
}


//user fprofile
app.get('/api/userprofile', authenticate, (req, res) => {
  res.json({
    "status": "success",
    "user": {
      "username": req.user.username,
      "email": req.user.email
    }
  })
})

//socket.io handling real time chat messages
io.on('connection', (socket) => {
  console.log('A user connected');
  let currentUser = null;

  //user authenticate via socket.io (using JWT token)
  socket.on('authenticate', (token) => {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        socket.emit('unauthorized', { "status": "Error", "message": 'Authentication failed' });
        return;
      }
      currentUser = user;
      console.log(currentUser)
      activeUsers[user.email] = socket.id;
      socket.emit('auth_success', `Welcome ${user.username} ${user.email}`);
      console.log(`${user.username} connected`);
    });
  });

  //handle incoming messages
  socket.on('send_message', (message) => {
    if (currentUser) {
      const messageId = uuidv4();
      const timestamp = new Date().toISOString();

      const formattedMessage = {
        status: 'success',
        type: 'message',
        data: {
          messageId,
          senderName: currentUser.username,
          senderId: currentUser.email,
          receiverId: message.receivedId,
          content: message.content,
          timestamp,
          messageType: "text",
          status: "sent"
        }
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
        status: "sent"
      })

      try {
        // message save in mongodb 
        newMessageSave.save(); //method to save
        io.emit('receive_message', { user: currentUser.username, formattedMessage });
        console.log(`${currentUser.username} sent a message: ${message.content}`);
      } catch (error) {
        console.log('Error while saving messages to database', error)
      }


    }
  });

  //Route to get message for current user
  app.get('/messages',async (req, res)=>{
    const {userId} = req.query;
    if(!userId){
      return res.status(400).json({status:'error', message:"user id is required"})
    }
    try {
      const storedMessages = await MessageSave.find({
        $or:[
          {senderId:userId}, //get message where user is sender
          {receiverId:'receiver_mail@example.com'}//get message where user is receiver
        ]
      }).sort({timestamp : 1}); //older first
      res.json({status:'success', data:storedMessages})
    } catch (error) {
      console.log('error fetching messages', error)
      res.status(500).json({status:'error', message:'Failed to fetch messages'})
    }
  })



  //handle typing notification
  socket.on('user_typing', (username) => {
    socket.broadcast.emit('user_typing', username);  //notify other users
  });

  //handle user disconnection
  socket.on('disconnect', () => {
    if (currentUser) {
      delete activeUsers[currentUser.email];
      console.log(`${currentUser.username} disconnected`);
    }
  });
});

// start server
const PORT = process.env.PORT;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// This will make the server accessible to other devices in the network

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});