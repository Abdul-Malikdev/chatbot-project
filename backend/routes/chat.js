const express = require('express');
const router = express.Router();
const groqService = require('../services/groq');
const vectorDB = require('../services/vectorDB');

const chatHistories = new Map();
const conversationMetadata = new Map();

// Create new conversation
router.post('/conversation/new', (req, res) => {
  const conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  chatHistories.set(conversationId, []);
  conversationMetadata.set(conversationId, {
    created: new Date().toISOString(),
    messageCount: 0
  });
  
  console.log(`✨ New conversation created: ${conversationId}`);
  
  res.json({
    success: true,
    conversationId: conversationId
  });
});

// Send message
router.post('/message', async (req, res) => {
  try {
    const { 
      message,
      databaseId,
      conversationId,
      includeHistory = true
    } = req.body;

    // Validation
    if (!message?.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Message is required' 
      });
    }

    if (!conversationId) {
      return res.status(400).json({ 
        success: false,
        error: 'Conversation ID is required' 
      });
    }

    console.log(`\n💬 [${conversationId}] User: ${message}`);

    // Get history
    let history = chatHistories.get(conversationId) || [];

    // Search for context
    let context = '';
    let sources = [];

    if (databaseId) {
      const dbStatus = vectorDB.getStatus(databaseId);
      
      if (dbStatus.exists) {
        console.log(`🔍 Searching in database: ${databaseId} (${dbStatus.documentCount} docs)`);
        
        try {
          const searchResults = await vectorDB.search(databaseId, message, 5);
          
          // Lower threshold for better recall
          const relevantResults = searchResults.filter(r => r.score > 0.05);
          
          if (relevantResults.length > 0) {
            context = relevantResults
              .map((result, idx) => `[Source ${idx + 1}]:\n${result.text}`)
              .join('\n\n');
            
            sources = relevantResults.map((result, idx) => ({
              id: idx + 1,
              text: result.text.substring(0, 250) + (result.text.length > 250 ? '...' : ''),
              score: result.score.toFixed(3)
            }));

            console.log(`✅ Found ${sources.length} relevant sources (scores: ${sources.map(s => s.score).join(', ')})`);
          } else {
            console.log(`⚠️ No relevant sources found (all scores < 0.05)`);
          }
        } catch (error) {
          console.error('❌ Search error:', error.message);
        }
      } else {
        console.log(`⚠️ Database ${databaseId} not found or not trained`);
      }
    }

    // Get recent history
    const recentHistory = includeHistory ? history.slice(-6) : [];

    // Generate response
    console.log(`🤖 Generating response with Groq...`);
    const startTime = Date.now();
    
    const aiResponse = await groqService.generateResponse(
      message,
      context,
      recentHistory
    );

    const responseTime = Date.now() - startTime;
    console.log(`✅ Response generated in ${responseTime}ms`);

    // Update history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: aiResponse });
    
    if (history.length > 40) {
      history = history.slice(-40);
    }
    
    chatHistories.set(conversationId, history);

    // Update metadata
    const metadata = conversationMetadata.get(conversationId) || {};
    metadata.messageCount = (metadata.messageCount || 0) + 2;
    metadata.lastActivity = new Date().toISOString();
    conversationMetadata.set(conversationId, metadata);

    // Send response
    res.json({
      success: true,
      response: aiResponse,
      sources: sources,
      conversationId: conversationId,
      timestamp: new Date().toISOString(),
      responseTime: responseTime
    });

  } catch (error) {
    console.error('❌ Chat Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process message',
      details: error.message 
    });
  }
});

// Get history
router.get('/history/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const history = chatHistories.get(conversationId) || [];
  const metadata = conversationMetadata.get(conversationId) || {};
  
  res.json({
    success: true,
    conversationId: conversationId,
    history: history,
    metadata: metadata
  });
});

// Clear conversation
router.delete('/conversation/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  chatHistories.set(conversationId, []);
  
  console.log(`🗑️ Conversation cleared: ${conversationId}`);
  
  res.json({
    success: true,
    message: 'Conversation cleared'
  });
});

// Get all conversations
router.get('/conversations', (req, res) => {
  const conversations = [];
  
  conversationMetadata.forEach((metadata, id) => {
    const history = chatHistories.get(id) || [];
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;
    
    conversations.push({
      id: id,
      created: metadata.created,
      lastActivity: metadata.lastActivity,
      messageCount: metadata.messageCount,
      lastMessage: lastMessage ? lastMessage.content.substring(0, 100) : ''
    });
  });

  res.json({
    success: true,
    conversations: conversations.sort((a, b) => 
      new Date(b.lastActivity || b.created) - new Date(a.lastActivity || a.created)
    )
  });
});

module.exports = router;