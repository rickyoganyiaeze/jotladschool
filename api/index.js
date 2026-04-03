const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit for base64 PDFs
app.use(express.static(path.join(__dirname, '..', 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ DB Error:', err));

// Result Schema (Database Storage)
const resultSchema = new mongoose.Schema({
  admissionNumber: { type: String, required: true, uppercase: true },
  studentName: { type: String, required: true },
  class: { type: String, required: true },
  term: { type: String, required: true },
  year: { type: String, required: true },
  pdfData: { type: String, required: true }, // Stores PDF in DB
  createdAt: { type: Date, default: Date.now }
});
resultSchema.index({ admissionNumber: 1, class: 1, term: 1, year: 1 }, { unique: true });
const Result = mongoose.model('Result', resultSchema);

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const Admin = mongoose.model('Admin', adminSchema);

const JWT_SECRET = process.env.JWT_SECRET || 'secret-2024';

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) { res.status(400).json({ message: 'Invalid token' }); }
};

// Multer Config (Memory Storage)
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// Helper
const bufferToBase64 = (buffer) => buffer.toString('base64');

// --- ROUTES ---

// Public: Check Admission
app.post('/check-admission', async (req, res) => {
  try {
    const results = await Result.find({ admissionNumber: req.body.admissionNumber.toUpperCase() }).select('class term year studentName');
    if (!results.length) return res.status(404).json({ success: false, message: 'Invalid' });
    res.json({ success: true, studentName: results[0].studentName, results });
  } catch (e) { res.status(500).json({ success: false }); }
});

// Public: Get Options
app.post('/student-options', async (req, res) => {
  try {
    const results = await Result.find({ admissionNumber: req.body.admissionNumber.toUpperCase() }).select('class term year');
    res.json({ success: true, classes: [...new Set(results.map(r=>r.class))], terms: [...new Set(results.map(r=>r.term))], years: [...new Set(results.map(r=>r.year))] });
  } catch(e) { res.status(500).json({ success:false }); }
});

// Public: Get Result (Returns Base64 Data)
app.post('/get-result', async (req, res) => {
  try {
    const result = await Result.findOne({
      admissionNumber: req.body.admissionNumber.toUpperCase(),
      class: req.body.class, term: req.body.term, year: req.body.year
    });
    if (!result) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, result });
  } catch(e) { res.status(500).json({ success:false }); }
});

// Admin: Login
app.post('/admin/login', async (req, res) => {
  try {
    const admin = await Admin.findOne({ username: req.body.username });
    if (!admin || !(await bcrypt.compare(req.body.password, admin.password))) return res.status(400).json({ message: 'Invalid creds' });
    const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, username: admin.username });
  } catch(e) { res.status(500).json({ success:false }); }
});

// Admin: Upload (Saves to DB)
app.post('/admin/upload', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'PDF required' });
    
    const result = new Result({
      admissionNumber: req.body.admissionNumber.toUpperCase(),
      studentName: req.body.studentName,
      class: req.body.class,
      term: req.body.term,
      year: req.body.year,
      pdfData: bufferToBase64(req.file.buffer)
    });
    await result.save();
    res.json({ success: true, message: 'Uploaded!' });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: 'Exists already' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: Get All Results
app.get('/admin/results', authMiddleware, async (req, res) => {
  res.json({ success: true, results: await Result.find().sort({createdAt: -1}) });
});

// Admin: Update
app.put('/admin/results/:id', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    const result = await Result.findById(req.params.id);
    if(!result) return res.status(404).send('Not found');
    if(req.file) result.pdfData = bufferToBase64(req.file.buffer);
    
    Object.assign(result, {
      admissionNumber: req.body.admissionNumber.toUpperCase(),
      studentName: req.body.studentName,
      class: req.body.class, term: req.body.term, year: req.body.year
    });
    await result.save();
    res.json({ success: true });
  } catch(e) { res.status(500).json({success:false}); }
});

// Admin: Delete
app.delete('/admin/results/:id', authMiddleware, async (req, res) => {
  await Result.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Export for Vercel
module.exports = app;