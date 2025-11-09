const groqService = require('./groq');
const fs = require('fs').promises;

class VectorDatabase {
  constructor() {
    this.databases = new Map();
  }

  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  chunkText(text, chunkSize = 300, overlap = 50) {
    // Split by sentences
    const sentences = text
      .replace(/\r\n/g, '\n')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
    
    if (sentences.length === 0) {
      return [text.trim()];
    }

    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);
      
      if (currentLength + words.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        
        // Overlap: keep last sentence
        if (currentChunk.length > 0) {
          currentChunk = [currentChunk[currentChunk.length - 1]];
          currentLength = currentChunk[0].split(/\s+/).length;
        } else {
          currentChunk = [];
          currentLength = 0;
        }
      }
      
      currentChunk.push(sentence);
      currentLength += words.length;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    // For very small texts, ensure at least one chunk
    if (chunks.length === 0 && text.trim().length > 0) {
      chunks.push(text.trim());
    }

    return chunks;
  }

  async trainOnData(databaseId, textData) {
    console.log(`\n🎓 Starting training for database: ${databaseId}`);
    console.log(`📊 Input text: ${textData.length} characters`);
    
    const chunks = this.chunkText(textData, 300, 50);
    console.log(`📝 Created ${chunks.length} text chunks`);

    if (chunks.length === 0) {
      throw new Error('No valid chunks created. Text might be too short or improperly formatted.');
    }

    const documents = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const embedding = groqService.createEmbedding(chunk);
        
        documents.push({
          text: chunk,
          embedding: embedding,
          id: i
        });
        
        if ((i + 1) % 20 === 0 || i === chunks.length - 1) {
          console.log(`✅ Processed ${i + 1}/${chunks.length} chunks`);
        }
        
      } catch (error) {
        console.error(`⚠️ Error processing chunk ${i}:`, error.message);
      }
    }

    if (documents.length === 0) {
      throw new Error('Failed to create any document embeddings');
    }

    this.databases.set(databaseId, documents);
    console.log(`✅ Training complete! ${documents.length} documents indexed\n`);
    
    return { 
      success: true, 
      documentsCount: documents.length,
      avgChunkLength: Math.round(chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length)
    };
  }

  async search(databaseId, query, topK = 5) {
    const documents = this.databases.get(databaseId);

    if (!documents || documents.length === 0) {
      throw new Error('Database not trained yet');
    }

    console.log(`🔍 Searching ${documents.length} documents for: "${query.substring(0, 60)}..."`);

    const queryEmbedding = groqService.createEmbedding(query);

    const scores = documents.map(doc => ({
      text: doc.text,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding),
      id: doc.id
    }));

    scores.sort((a, b) => b.score - a.score);

    const results = scores.slice(0, topK);
    
    console.log(`📊 Search results:`, results.map((r, i) => 
      `[${i + 1}] Score: ${r.score.toFixed(3)}`
    ).join(', '));

    return results;
  }

  async saveIndex(databaseId, filepath) {
    const documents = this.databases.get(databaseId);
    if (!documents) throw new Error('Database not found');

    await fs.writeFile(filepath, JSON.stringify(documents));
    console.log(`💾 Index saved: ${filepath} (${documents.length} docs)`);
  }

  async loadIndex(databaseId, filepath) {
    const data = await fs.readFile(filepath, 'utf-8');
    const documents = JSON.parse(data);
    this.databases.set(databaseId, documents);
    console.log(`📂 Index loaded: ${filepath} (${documents.length} docs)`);
  }

  getStatus(databaseId) {
    const documents = this.databases.get(databaseId);
    return {
      exists: !!documents,
      documentCount: documents ? documents.length : 0,
      databaseId: databaseId
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new VectorDatabase();