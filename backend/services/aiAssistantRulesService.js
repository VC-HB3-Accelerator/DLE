const db = require('../db');
const TABLE = 'ai_assistant_rules';

async function getAllRules() {
  const { rows } = await db.getQuery()(`SELECT * FROM ${TABLE} ORDER BY id`);
  return rows;
}

async function getRuleById(id) {
  const { rows } = await db.getQuery()(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function createRule({ name, description, rules }) {
  const { rows } = await db.getQuery()(
    `INSERT INTO ${TABLE} (name, description, rules, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *`,
    [name, description, rules]
  );
  return rows[0];
}

async function updateRule(id, { name, description, rules }) {
  const { rows } = await db.getQuery()(
    `UPDATE ${TABLE} SET name = $1, description = $2, rules = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
    [name, description, rules, id]
  );
  return rows[0];
}

async function deleteRule(id) {
  await db.getQuery()(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
}

module.exports = { getAllRules, getRuleById, createRule, updateRule, deleteRule }; 