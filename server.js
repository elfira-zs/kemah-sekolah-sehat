/**
 * Backend Node.js Server - Kemah Sekolah Sehat
 * Uses Express.js and a JSON-file Database for simple, cross-platform persistence.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static client files directly
app.use(express.static(__dirname));

// Initialize Database JSON file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
  console.log('Database file created:', DB_FILE);
}

// Helpers for Reading/Writing Database
function readDatabase() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file:', err);
    return [];
  }
}

function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing database file:', err);
    return false;
  }
}

// API Routes

// 1. Status Check
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', mode: 'server', timestamp: new Date() });
});

// 2. Submit Student Results
app.post('/api/submit', (req, res) => {
  const { name, class: studentClass, startedAt, submittedAt, scores, totalScore } = req.body;

  if (!name || !studentClass || totalScore === undefined) {
    return res.status(400).json({ error: 'Nama, Kelas, dan Skor Total harus disediakan.' });
  }

  const submissions = readDatabase();

  // Create new submission record
  const newRecord = {
    id: Date.now(),
    name,
    class: studentClass,
    startedAt,
    submittedAt,
    scores,
    totalScore
  };

  // Prevent duplicate submissions by overwriting previous record for the same name + class combo
  const duplicateIndex = submissions.findIndex(
    sub => sub.name.toLowerCase() === name.toLowerCase() && 
           sub.class.toLowerCase() === studentClass.toLowerCase()
  );

  if (duplicateIndex > -1) {
    submissions[duplicateIndex] = newRecord;
    console.log(`Overwrote record for student: ${name} (${studentClass})`);
  } else {
    submissions.push(newRecord);
    console.log(`Saved new record for student: ${name} (${studentClass})`);
  }

  if (writeDatabase(submissions)) {
    res.status(201).json({ success: true, record: newRecord });
  } else {
    res.status(500).json({ error: 'Gagal menyimpan ke basis data.' });
  }
});

// 3. Retrieve All Submissions (Admin)
app.get('/api/submissions', (req, res) => {
  const submissions = readDatabase();
  // Sort by final submission timestamp, newest first
  submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(submissions);
});

// 4. Reset All Submissions (Admin)
app.post('/api/reset', (req, res) => {
  if (writeDatabase([])) {
    console.log('Database wiped by Admin.');
    res.json({ success: true, message: 'Seluruh rekap data pengerjaan berhasil dihapus.' });
  } else {
    res.status(500).json({ error: 'Gagal menghapus data.' });
  }
});

// Catch-all route serving client's index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Aksi Sehat Server running at http://localhost:${PORT}`);
  console.log(`💼 Mode Penyimpanan: File JSON terpusat (${DB_FILE})`);
  console.log(`===================================================`);
});
