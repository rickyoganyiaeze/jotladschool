require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
// Render sets the PORT environment variable
const PORT = process.env.PORT || 3000;

// Define Schema
const AdminLogSchema = new mongoose.Schema({
  action: String,
  timestamp: { type: Date, default: Date.now }
});
const AdminLog = mongoose.model('AdminLog', AdminLogSchema);

// Connect to Mongo and THEN start the server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ CONNECTED successfully to the Admin Database!");

    // ROUTES
    app.get('/', (req, res) => {
      res.send('<h1>Admin Server is Running!</h1><p>Try going to <a href="/test-add">/test-add</a></p>');
    });

    app.get('/test-add', async (req, res) => {
      try {
        const newLog = new AdminLog({ action: "Test from Render" });
        await newLog.save();
        res.send("✅ Added a test document to the 'admin' database on Render!");
      } catch (err) {
        res.status(500).send("Error writing to DB: " + err.message);
      }
    });

    app.get('/test-view', async (req, res) => {
      try {
        const logs = await AdminLog.find();
        res.json(logs);
      } catch (err) {
        res.status(500).send("Error reading DB: " + err.message);
      }
    });

    // START LISTENING
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });

  })
  .catch(err => {
    console.error("❌ Connection Failed:", err);
    process.exit(1); // Stop the app if DB fails
  });