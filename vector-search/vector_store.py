# Заглушка для работы с FAISS

import os
import pickle
import faiss
import numpy as np
from typing import List, Dict, Any

INDEX_DIR = os.path.join(os.path.dirname(__file__), 'indexes')

class VectorStore:
    def __init__(self):
        os.makedirs(INDEX_DIR, exist_ok=True)
        self.index_cache = {}  # table_id: (faiss_index, meta)

    def _index_path(self, table_id):
        return os.path.join(INDEX_DIR, f'table_{table_id}.faiss')
    def _meta_path(self, table_id):
        return os.path.join(INDEX_DIR, f'table_{table_id}_meta.pkl')

    def load(self, table_id):
        idx_path = self._index_path(table_id)
        meta_path = self._meta_path(table_id)
        if os.path.exists(idx_path) and os.path.exists(meta_path):
            index = faiss.read_index(idx_path)
            with open(meta_path, 'rb') as f:
                meta = pickle.load(f)
            self.index_cache[table_id] = (index, meta)
            return index, meta
        return None, None

    def save(self, table_id, index, meta):
        faiss.write_index(index, self._index_path(table_id))
        with open(self._meta_path(table_id), 'wb') as f:
            pickle.dump(meta, f)
        self.index_cache[table_id] = (index, meta)

    def upsert(self, table_id, rows: List[Dict]):
        # rows: [{row_id, embedding, metadata}]
        index, meta = self.load(table_id)
        if index is None:
            dim = len(rows[0]['embedding'])
            index = faiss.IndexFlatL2(dim)
            meta = []
        # Удаляем дубликаты row_id
        existing_ids = {m['row_id'] for m in meta}
        new_rows = [r for r in rows if r['row_id'] not in existing_ids]
        if not new_rows:
            return
        vectors = np.array([r['embedding'] for r in new_rows]).astype('float32')
        index.add(vectors)
        meta.extend(new_rows)
        self.save(table_id, index, meta)

    def search(self, table_id, query_embedding, top_k=3):
        index, meta = self.load(table_id)
        if index is None or not meta:
            return []
        query = np.array([query_embedding]).astype('float32')
        D, I = index.search(query, top_k)
        results = []
        for idx, dist in zip(I[0], D[0]):
            if idx < 0 or idx >= len(meta):
                continue
            m = meta[idx]
            results.append({
                'row_id': m['row_id'],
                'score': float(-dist),  # FAISS: чем меньше dist, тем ближе
                'metadata': m['metadata']
            })
        return results

    def delete(self, table_id, row_ids: List[str]):
        index, meta = self.load(table_id)
        if index is None or not meta:
            return
        # FAISS не поддерживает удаление, пересоздаём индекс
        new_meta = [m for m in meta if m['row_id'] not in row_ids]
        if not new_meta:
            # Удаляем файлы
            try:
                os.remove(self._index_path(table_id))
                os.remove(self._meta_path(table_id))
            except Exception:
                pass
            self.index_cache.pop(table_id, None)
            return
        dim = len(new_meta[0]['embedding'])
        new_index = faiss.IndexFlatL2(dim)
        vectors = np.array([m['embedding'] for m in new_meta]).astype('float32')
        new_index.add(vectors)
        self.save(table_id, new_index, new_meta)

    def rebuild(self, table_id, rows: List[Dict]):
        # rows: [{row_id, embedding, metadata}]
        if not rows:
            return
        dim = len(rows[0]['embedding'])
        index = faiss.IndexFlatL2(dim)
        vectors = np.array([r['embedding'] for r in rows]).astype('float32')
        index.add(vectors)
        self.save(table_id, index, rows) 