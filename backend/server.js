import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory array acting as a temporary database store before hooking up Postgres
let collections = [
  { id: 'col-1', title: 'Institutional Audits', status: 'Draft', count: 0 }
];
let cases = [];
let records = [];

// Configure Multer to intercept files in memory so we can hash them first
const upload = multer({ storage: multer.memoryStorage() });

// 1. Endpoint: Retrieve Inventory for Frontend
app.get('/api/collections', (req, res) => res.json(collections));
app.get('/api/cases', (req, res) => res.json(cases));

// 2. Endpoint: Create Collection
app.post('/api/collections', (req, res) => {
  const { title } = req.body;
  const newCol = { id: `col-${Date.now()}`, title, status: 'Draft', count: 0 };
  collections.push(newCol);
  res.status(201).json(newCol);
});

// 3. Endpoint: Upload PDF and compute SHA-256 Fingerprint
app.post('/api/records/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF submitted.' });

    // Compute cryptographic SHA-256 hash immediately
    const hashSum = crypto.createHash('sha256');
    hashSum.update(req.file.buffer);
    const fileHash = hashSum.digest('hex');

    const fileName = req.file.originalname;
    const targetPath = path.join('storage', 'documents', `${fileHash}.pdf`);

    // Write file to local disk storage using the hash as the unique file name
    fs.writeFileSync(targetPath, req.file.buffer);

    const newRecord = {
      id: `rec-${Date.now()}`,
      file_name: fileName,
      storage_path: targetPath,
      file_hash: fileHash,
      ledger_status: 'pending'
    };
    records.push(newRecord);

    console.log(`[Ingestion Core] PDF verified & written. Hash: ${fileHash}`);
    res.status(201).json({ success: true, record: newRecord });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ensure your package.json has "type": "module" to run this syntax cleanly
app.listen(5000, () => console.log('⚡ Archive Backend Core running on http://localhost:5000'));