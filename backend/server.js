require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const chatRoutes = require('./routes/chat');
const uploadRoutes = require('./routes/upload');
const databaseRoutes = require('./routes/database');

app.use('/api/chat', chatRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/database', databaseRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Chatbot Backend Running! 🤖',
    timestamp: new Date().toISOString()
  });
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    groqConfigured: !!process.env.GROQ_API_KEY
  });
});

// Server start
app.listen(PORT, () => {
  console.log(`\n🚀 Chatbot server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/health`);
  console.log(`🤖 AI Provider: Groq (Llama 3.1 70B)\n`);
  
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️  WARNING: GROQ_API_KEY not found in .env file!\n');
  }
});