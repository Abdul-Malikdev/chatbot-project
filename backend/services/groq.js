const axios = require('axios');

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.baseURL = 'https://api.groq.com/openai/v1';
  }

  async generateResponse(userMessage, context = '', conversationHistory = []) {
    try {
      if (!this.apiKey) {
        throw new Error('GROQ_API_KEY not found in environment variables');
      }

      const messages = [];

      // System prompt
      messages.push({
        role: 'system',
        content: 'You are a helpful, intelligent AI assistant. Answer questions clearly and conversationally. If context is provided, use it to give accurate answers. If you don\'t know something, admit it honestly.'
      });

      // Add conversation history (last 6 messages)
      conversationHistory.slice(-6).forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });

      // Add context from database/files
      if (context) {
        messages.push({
          role: 'system',
          content: `Relevant information from documents:\n\n${context}\n\nUse this information to answer the user's question accurately.`
        });
      }

      // Current user message
      messages.push({
        role: 'user',
        content: userMessage
      });

      console.log(`🤖 Calling Groq API with ${messages.length} messages...`);

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'llama-3.3-70b-versatile',
          messages: messages,
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 1,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const responseText = response.data.choices[0].message.content;
      console.log(`✅ Groq response received (${responseText.length} chars)`);
      
      return responseText;

    } catch (error) {
      console.error('❌ Groq API Error:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        throw new Error('Invalid Groq API key. Please check your GROQ_API_KEY in .env file');
      }
      
      if (error.response?.data?.error?.code === 'model_decommissioned') {
        throw new Error('Model no longer supported. Please update the model in groq.js');
      }
      
      throw new Error(`Groq API failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Create embeddings (improved algorithm)
  createEmbedding(text, dimensions = 768) {
    // Preprocess text
    const cleanText = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const words = cleanText.split(' ').filter(w => w.length > 2);
    
    if (words.length === 0) {
      return new Array(dimensions).fill(0);
    }

    const embedding = new Array(dimensions).fill(0);
    
    // Better distribution using multiple hash functions
    words.forEach((word, wordIdx) => {
      const weight = 1.0 / Math.sqrt(wordIdx + 1);
      
      // Multiple hash functions for better coverage
      for (let hashFunc = 0; hashFunc < 3; hashFunc++) {
        let hash = hashFunc * 7919; // Prime number seed
        
        for (let i = 0; i < word.length; i++) {
          hash = ((hash << 5) - hash) + word.charCodeAt(i);
          hash = hash & hash; // Convert to 32-bit integer
        }
        
        const position = Math.abs(hash) % dimensions;
        embedding[position] += weight;
        
        // Spread to neighbors for smoother distribution
        const spread = 2;
        for (let offset = 1; offset <= spread; offset++) {
          const leftPos = (position - offset + dimensions) % dimensions;
          const rightPos = (position + offset) % dimensions;
          embedding[leftPos] += weight / (offset + 1);
          embedding[rightPos] += weight / (offset + 1);
        }
      }
    });

    // Normalize vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) {
      return embedding;
    }
    
    return embedding.map(val => val / magnitude);
  }
}

module.exports = new GroqService();