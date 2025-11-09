const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const vectorDB = require('../services/vectorDB');

// File upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.doc', '.docx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, TXT, DOC, DOCX, CSV'));
    }
  }
});

// Text extraction function
async function extractText(filePath, mimetype) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.pdf') {
      // Try to import pdf-parse dynamically
      try {
        const pdfParse = require('pdf-parse');
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
      } catch (error) {
        console.error('PDF parsing error:', error);
        // Fallback: Try to read as text (won't work well but better than nothing)
        const buffer = await fs.readFile(filePath);
        return buffer.toString('utf-8', 0, Math.min(buffer.length, 50000));
      }
    }
    
    else if (ext === '.txt' || ext === '.csv') {
      return await fs.readFile(filePath, 'utf-8');
    }
    
    else if (ext === '.doc' || ext === '.docx') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
      } catch (error) {
        console.error('DOCX parsing error:', error);
        throw new Error('Failed to parse Word document');
      }
    }
    
    else {
      throw new Error('Unsupported file type');
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw error;
  }
}

// Single file upload
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { databaseId } = req.body;

    console.log(`\n📄 Processing file: ${req.file.originalname}`);

    // Extract text
    let text = '';
    try {
      text = await extractText(req.file.path, req.file.mimetype);
    } catch (extractError) {
      console.error('Extraction failed:', extractError);
      // Cleanup
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ 
        success: false,
        error: 'Failed to extract text from file',
        details: extractError.message 
      });
    }
    
    if (!text || text.trim().length < 50) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ 
        success: false,
        error: 'No meaningful text content found in file (minimum 50 characters required)' 
      });
    }

    console.log(`✅ Extracted ${text.length} characters from ${req.file.originalname}`);

    // Train vector DB
    const fileId = databaseId || 'file_' + Date.now();
    const trainResult = await vectorDB.trainOnData(fileId, text);

    // Cleanup file
    await fs.unlink(req.file.path).catch(() => {});

    res.json({
      success: true,
      message: 'File uploaded and trained successfully',
      fileId: fileId,
      fileName: req.file.originalname,
      textLength: text.length,
      documentsCount: trainResult.documentsCount
    });

  } catch (error) {
    console.error('Upload Error:', error);
    
    // Cleanup on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {}
    }

    res.status(500).json({ 
      success: false,
      error: 'Failed to process file',
      details: error.message 
    });
  }
});

// Multiple files upload
router.post('/multiple', upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { databaseId } = req.body;
    const fileId = databaseId || 'files_' + Date.now();
    
    let allText = '';
    const processedFiles = [];

    // Process all files
    for (const file of req.files) {
      try {
        const text = await extractText(file.path, file.mimetype);
        allText += `\n\n=== FILE: ${file.originalname} ===\n${text}`;
        
        processedFiles.push({
          name: file.originalname,
          size: file.size,
          textLength: text.length
        });

        // Delete file
        await fs.unlink(file.path);
      } catch (error) {
        console.error(`Error processing ${file.originalname}:`, error);
        // Continue with other files
      }
    }

    if (allText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        error: 'No meaningful text extracted from files'
      });
    }

    // Train
    const trainResult = await vectorDB.trainOnData(fileId, allText);

    res.json({
      success: true,
      message: 'Files uploaded and trained successfully',
      fileId: fileId,
      filesProcessed: processedFiles.length,
      files: processedFiles,
      totalTextLength: allText.length,
      documentsCount: trainResult.documentsCount
    });

  } catch (error) {
    console.error('Multiple Upload Error:', error);
    
    // Cleanup
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (e) {}
      }
    }

    res.status(500).json({ 
      success: false,
      error: 'Failed to process files',
      details: error.message 
    });
  }
});

module.exports = router;