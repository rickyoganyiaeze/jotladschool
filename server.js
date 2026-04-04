const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
// Note: We removed the '/uploads' static folder because files are now in DB

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Atlas Connected Successfully'))
  .catch(err => {
    console.log('MongoDB Connection Error:', err);
    process.exit(1);
  });

// Database Schema - UPDATED to hold file data
const resultSchema = new mongoose.Schema({
  admissionNumber: { type: String, required: true, unique: true },
  studentName: { type: String, required: true },
  studentClass: String,
  resultFile: { type: String, required: true }, // This will hold the Base64 string
  fileType: { type: String, required: true },   // 'image' or 'pdf'
  availabilityStart: Date,
  availabilityEnd: Date,
  createdAt: { type: Date, default: Date.now }
});

const Result = mongoose.model('Result', resultSchema);

// File Upload Setup - Store in memory (not disk)
const storage = multer.memoryStorage(); 
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10000000 }, // Increased limit to 10MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb('Error: Images and PDFs only!');
  }
});

// --- ROUTES ---

// 1. Student Login
app.post('/api/login', async (req, res) => {
  try {
    const { admissionNumber } = req.body;
    if (!admissionNumber) {
      return res.status(400).json({ success: false, message: 'Please enter an admission number' });
    }

    const student = await Result.findOne({ admissionNumber: admissionNumber.toUpperCase() });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Invalid Admission Number' });
    }

    const now = new Date();
    if (student.availabilityStart && student.availabilityEnd) {
      const start = new Date(student.availabilityStart);
      const end = new Date(student.availabilityEnd);
      if (now < start || now > end) {
        return res.status(403).json({ success: false, message: 'Results are not currently available.' });
      }
    }
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Admin Middleware
const adminAuth = (req, res, next) => {
  const key = req.headers['admin-key'] || req.query.key;
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// Upload Result (Admin) - UPDATED
app.post('/api/admin/upload', adminAuth, upload.single('resultFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Convert file buffer to Base64 string
    const fileBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const newResult = new Result({
      admissionNumber: req.body.admissionNumber,
      studentName: req.body.studentName,
      studentClass: req.body.studentClass,
      resultFile: `data:${mimeType};base64,${fileBase64}`, // Save as Data URI
      fileType: mimeType.includes('pdf') ? 'pdf' : 'image',
      availabilityStart: req.body.start,
      availabilityEnd: req.body.end
    });

    await newResult.save();
    res.json({ success: true, message: 'Result uploaded', data: newResult });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get All Results (Admin)
app.get('/api/admin/results', adminAuth, async (req, res) => {
  try {
    // We select all fields EXCEPT the heavy file data for the list view
    const results = await Result.find().select('-resultFile').sort({ createdAt: -1 });
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Result (Admin)
app.put('/api/admin/results/:id', adminAuth, async (req, res) => {
  try {
    const { admissionNumber, studentName, studentClass, start, end } = req.body;
    const updatedResult = await Result.findByIdAndUpdate(
      req.params.id, 
      { admissionNumber, studentName, studentClass, availabilityStart: start, availabilityEnd: end },
      { new: true }
    );
    res.json({ success: true, data: updatedResult });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Result (Admin)
app.delete('/api/admin/results/:id', adminAuth, async (req, res) => {
  try {
    await Result.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));