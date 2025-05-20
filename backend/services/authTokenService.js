const db = require('../db');

async function getAllAuthTokens() {
  const { rows } = await db.query('SELECT * FROM auth_tokens ORDER BY id');
  return rows;
}

async function saveAllAuthTokens(authTokens) {
  await db.query('DELETE FROM auth_tokens');
  for (const token of authTokens) {
    await db.query(
      'INSERT INTO auth_tokens (name, address, network, min_balance) VALUES ($1, $2, $3, $4)',
      [token.name, token.address, token.network, token.minBalance]
    );
  }
}

async function upsertAuthToken(token) {
  const minBalance = token.minBalance == null ? 0 : Number(token.minBalance);
  await db.query(
    `INSERT INTO auth_tokens (name, address, network, min_balance)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (address, network) DO UPDATE SET name=EXCLUDED.name, min_balance=EXCLUDED.min_balance`,
    [token.name, token.address, token.network, minBalance]
  );
}

async function deleteAuthToken(address, network) {
  await db.query('DELETE FROM auth_tokens WHERE address = $1 AND network = $2', [address, network]);
}

module.exports = { getAllAuthTokens, saveAllAuthTokens, upsertAuthToken, deleteAuthToken }; 