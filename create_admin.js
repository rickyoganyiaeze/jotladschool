const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Your MongoDB Connection String (with database name included)
const uri = 'mongodb+srv://richardoganyiaeze_db_user:MfFFeplsRrTKK7f6@cluster0.3qxusgu.mongodb.net/jotlad-schools?retryWrites=true&w=majority';

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to MongoDB...');
    
    // Define the Admin model
    const Admin = mongoose.model('Admin', new mongoose.Schema({
      username: String,
      password: String,
      createdAt: { type: Date, default: Date.now }
    }));

    // Check if admin exists
    const existingAdmin = await Admin.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('SUCCESS: Admin user already exists!');
      console.log('Username: admin');
      console.log('Password: admin123');
    } else {
      // Create new admin
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Admin.create({ username: 'admin', password: hashedPassword });
      console.log('SUCCESS: Admin user created!');
      console.log('Username: admin');
      console.log('Password: admin123');
    }
    
    mongoose.connection.close();
    process.exit();
  })
  .catch(err => {
    console.log('ERROR:', err.message);
    process.exit(1);
  });