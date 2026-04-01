require('dotenv').config();
const mongoose = require('mongoose');

// TEMPORARY TEST: Paste the string directly here
const uri = "mongodb+srv://app_user:02764569@cluster0.3qxusgu.mongodb.net/school?retryWrites=true&w=majority"; 

async function connect() {
    try {
        await mongoose.connect(uri);
        console.log("Connected to MongoDB!");
    } catch (error) {
        console.error("Connection error:", error);
    }
}

connect();