const express = require('express');
const router = express.Router();
const mysqlService = require('../services/mysqlService');
const vectorDB = require('../services/vectorDB');

// Database connect karo
router.post('/connect', async (req, res) => {
  try {
    const { host, user, password, database, name } = req.body;

    // Validation
    if (!host || !user || !password || !database) {
      return res.status(400).json({ 
        error: 'All database credentials are required' 
      });
    }

    // Unique ID banao
    const databaseId = 'db_' + Date.now();

    // MySQL se connect karo
    await mysqlService.createConnection({
      host,
      user,
      password,
      database,
      id: databaseId
    });

    res.json({
      success: true,
      databaseId: databaseId,
      name: name || database,
      message: 'Database connected successfully'
    });

  } catch (error) {
    console.error('Database Connection Error:', error);
    res.status(500).json({ 
      error: 'Failed to connect to database',
      details: error.message 
    });
  }
});

// Database ko train karo (data extract karke vector DB mein dalo)
router.post('/train', async (req, res) => {
  try {
    const { databaseId } = req.body;

    if (!databaseId) {
      return res.status(400).json({ error: 'Database ID is required' });
    }

    console.log(`🎓 Starting training for database: ${databaseId}`);

    // Step 1: MySQL se saara data nikalo
    const allData = await mysqlService.extractAllData(databaseId);
    
    if (!allData || allData.trim().length === 0) {
      return res.status(400).json({ 
        error: 'No data found in database' 
      });
    }

    console.log(`📊 Extracted ${allData.length} characters of data`);

    // Step 2: Vector DB mein train karo
    const result = await vectorDB.trainOnData(databaseId, allData);

    res.json({
      success: true,
      message: 'Database trained successfully',
      documentsCount: result.documentsCount,
      databaseId: databaseId
    });

  } catch (error) {
    console.error('Training Error:', error);
    res.status(500).json({ 
      error: 'Failed to train database',
      details: error.message 
    });
  }
});

// Database tables list karo
router.get('/tables/:databaseId', async (req, res) => {
  try {
    const { databaseId } = req.params;
    const tables = await mysqlService.getTables(databaseId);

    res.json({
      success: true,
      tables: tables
    });

  } catch (error) {
    console.error('Get Tables Error:', error);
    res.status(500).json({ 
      error: 'Failed to get tables',
      details: error.message 
    });
  }
});

// Custom SQL query run karo
router.post('/query', async (req, res) => {
  try {
    const { databaseId, query } = req.body;

    if (!databaseId || !query) {
      return res.status(400).json({ 
        error: 'Database ID and query are required' 
      });
    }

    // Security: Only allow SELECT queries
    if (!query.trim().toLowerCase().startsWith('select')) {
      return res.status(403).json({ 
        error: 'Only SELECT queries are allowed' 
      });
    }

    const results = await mysqlService.executeQuery(databaseId, query);

    res.json({
      success: true,
      results: results,
      count: results.length
    });

  } catch (error) {
    console.error('Query Error:', error);
    res.status(500).json({ 
      error: 'Failed to execute query',
      details: error.message 
    });
  }
});

// Database status check karo
router.get('/status/:databaseId', async (req, res) => {
  try {
    const { databaseId } = req.params;
    
    const isTrained = vectorDB.indices.has(databaseId);
    const isConnected = mysqlService.connections.has(databaseId);

    res.json({
      success: true,
      databaseId: databaseId,
      isConnected: isConnected,
      isTrained: isTrained,
      documentsCount: isTrained ? vectorDB.documents.get(databaseId).length : 0
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get status',
      details: error.message 
    });
  }
});

module.exports = router;