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

    def _clear(self, table_id):
        idx_path = self._index_path(table_id)
        meta_path = self._meta_path(table_id)
        for path in (idx_path, meta_path):
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as exc:
                    print(f"[WARN] Failed to remove {path}: {exc}")
        self.index_cache.pop(table_id, None)

    def _ensure_index_dimension(self, table_id, index, dim):
        if index is None:
            return index

        if index.d == dim:
            return index

        print(f"[WARN] Dimension mismatch for table {table_id}: index.d={index.d}, expected={dim}. Resetting index.")
        self._clear(table_id)
        return None

    def upsert(self, table_id, rows: List[Dict]):
        print(f"[DEBUG] VectorStore.upsert called: table_id={table_id}, rows_count={len(rows)}")
        # rows: [{row_id, embedding, metadata}]
        index, meta = self.load(table_id)
        print(f"[DEBUG] Loaded existing index: {index is not None}, existing meta count: {len(meta) if meta else 0}")
        
        if index is None:
            dim = len(rows[0]['embedding'])
            print(f"[DEBUG] Creating new index with dimension: {dim}")
            index = faiss.IndexFlatL2(dim)
            meta = []
        else:
            dim = len(rows[0]['embedding'])
            index = self._ensure_index_dimension(table_id, index, dim)
            if index is None:
                print(f"[DEBUG] Re-creating index after dimension mismatch: dim={dim}")
                index = faiss.IndexFlatL2(dim)
                meta = []
            else:
                print(f"[DEBUG] Using existing index")
            
        # Удаляем дубликаты row_id
        existing_ids = {m['row_id'] for m in meta}
        new_rows = [r for r in rows if r['row_id'] not in existing_ids]
        print(f"[DEBUG] Found {len(new_rows)} new rows to add (out of {len(rows)} total)")
        
        if not new_rows:
            print(f"[DEBUG] No new rows to add")
            return
            
        vectors = np.array([r['embedding'] for r in new_rows]).astype('float32')
        print(f"[DEBUG] Adding {len(vectors)} vectors to index")
        index.add(vectors)
        meta.extend(new_rows)
        print(f"[DEBUG] Total meta count after upsert: {len(meta)}")
        self.save(table_id, index, meta)
        print(f"[DEBUG] Index saved successfully")

    def search(self, table_id, query_embedding, top_k=3):
        print(f"[DEBUG] VectorStore.search called: table_id={table_id}, top_k={top_k}")
        index, meta = self.load(table_id)
        print(f"[DEBUG] Loaded index: {index is not None}, meta count: {len(meta) if meta else 0}")
        
        if index is None or not meta:
            print(f"[DEBUG] No index or meta found, returning empty results")
            return []
            
        query = np.array([query_embedding]).astype('float32')
        print(f"[DEBUG] Query shape: {query.shape}")

        dim = query.shape[1]
        index = self._ensure_index_dimension(table_id, index, dim)
        if index is None:
            print(f"[DEBUG] Index reset due to dimension mismatch, returning empty results")
            return []
        
        D, I = index.search(query, top_k)
        print(f"[DEBUG] FAISS search results - D: {D}, I: {I}")
        
        results = []
        for idx, dist in zip(I[0], D[0]):
            print(f"[DEBUG] Processing result: idx={idx}, dist={dist}")
            if idx < 0 or idx >= len(meta):
                print(f"[DEBUG] Invalid index {idx}, skipping")
                continue
            m = meta[idx]
            score = float(-dist)  # FAISS: чем меньше dist, тем ближе
            print(f"[DEBUG] Valid result: row_id={m['row_id']}, score={score}, metadata={m['metadata']}")
            results.append({
                'row_id': m['row_id'],
                'score': score,
                'metadata': m['metadata']
            })
        
        print(f"[DEBUG] Returning {len(results)} results")
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