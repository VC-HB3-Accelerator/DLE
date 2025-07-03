const vectorSearch = require('../services/vectorSearchClient');

const TEST_TABLE_ID = 'test_table_1';

const rows = [
  { row_id: '1', text: 'Как тебя зовут?', metadata: { answer: 'Алексей' } },
  { row_id: '2', text: 'Где ты живёшь?', metadata: { answer: 'Москва' } }
];

describe('Vector Search Service Integration', () => {
  afterAll(async () => {
    // Очистить тестовые данные
    await vectorSearch.remove(TEST_TABLE_ID, rows.map(r => r.row_id));
  });

  test('Upsert and search', async () => {
    await vectorSearch.upsert(TEST_TABLE_ID, rows);
    const results = await vectorSearch.search(TEST_TABLE_ID, 'Как зовут?', 1);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.answer).toBe('Алексей');
  });

  test('Delete', async () => {
    await vectorSearch.remove(TEST_TABLE_ID, ['1']);
    const results = await vectorSearch.search(TEST_TABLE_ID, 'Как зовут?', 1);
    expect(results.length === 0 || results[0].metadata.answer !== 'Алексей').toBe(true);
  });

  test('Rebuild', async () => {
    await vectorSearch.rebuild(TEST_TABLE_ID, [rows[1]]);
    const results = await vectorSearch.search(TEST_TABLE_ID, 'Где ты живёшь?', 1);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.answer).toBe('Москва');
  });
}); 