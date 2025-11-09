const mysql = require('mysql2/promise');

class MySQLService {
  constructor() {
    this.connection = null;
    this.config = null;
  }

  async connect(config) {
    this.config = config;
    this.connection = await mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
      port: config.port || 3306
    });
    console.log('✅ Connected to MySQL database');
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  // Generic query method - can work with any database structure
  async query(sql, params = []) {
    if (!this.connection) {
      throw new Error('Database not connected');
    }

    const [rows] = await this.connection.execute(sql, params);
    return rows;
  }

  // Fetch Q&A pairs from connected database
  async getQAPairs(tableName = 'faqs', questionColumn = 'question', answerColumn = 'answer') {
    const sql = `SELECT ${questionColumn} as question, ${answerColumn} as answer FROM ${tableName}`;
    return await this.query(sql);
  }

  // Search for relevant content in database
  async searchRelevantContent(query, tables = []) {
    let results = [];
    
    for (const table of tables) {
      // This is a simplified search - you might want to implement full-text search
      const sql = `SELECT * FROM ${table.name} WHERE ${table.searchColumn} LIKE ? LIMIT 5`;
      const tableResults = await this.query(sql, [`%${query}%`]);
      results.push(...tableResults.map(row => ({ table: table.name, ...row })));
    }
    
    return results;
  }
}

module.exports = new MySQLService();