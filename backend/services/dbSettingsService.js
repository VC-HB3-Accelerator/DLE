const db = require('../db');

class DbSettingsService {
  async getSettings() {
    const { rows } = await db.getQuery()('SELECT * FROM db_settings WHERE id = 1');
    return rows[0];
  }

  async upsertSettings({ db_host, db_port, db_name, db_user, db_password }) {
    const { rows } = await db.getQuery()(
      `INSERT INTO db_settings (id, db_host, db_port, db_name, db_user, db_password, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
         db_host = EXCLUDED.db_host,
         db_port = EXCLUDED.db_port,
         db_name = EXCLUDED.db_name,
         db_user = EXCLUDED.db_user,
         db_password = EXCLUDED.db_password,
         updated_at = NOW()
       RETURNING *`,
      [db_host, db_port, db_name, db_user, db_password]
    );
    return rows[0];
  }
}

module.exports = new DbSettingsService(); 