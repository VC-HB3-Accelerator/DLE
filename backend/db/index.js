const createGuestMessagesTable = require('./migrations/create_guest_messages_table');

async function initDatabase() {
  try {
    // ... существующий код ...
    
    // Выполняем миграции
    await pool.query(createUsersTable);
    await pool.query(createSessionTable);
    await pool.query(createNoncesTable);
    await pool.query(createMessagesTable);
    await pool.query(createConversationsTable);
    await pool.query(createGuestMessagesTable);
    
    // ... существующий код ...
  } catch (error) {
    // ... существующий код ...
  }
} 