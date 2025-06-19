CREATE TABLE IF NOT EXISTS admin_read_contacts (
  admin_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  read_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (admin_id, contact_id)
); 