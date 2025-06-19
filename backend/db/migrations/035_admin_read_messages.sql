CREATE TABLE IF NOT EXISTS admin_read_messages (
  admin_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_read_at TIMESTAMP NOT NULL,
  PRIMARY KEY (admin_id, user_id)
); 