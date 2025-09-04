from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import os
import requests
from vector_store import VectorStore

OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://ollama:11434')
EMBED_MODEL = os.getenv('OLLAMA_EMBED_MODEL', 'mxbai-embed-large')

app = FastAPI()
store = VectorStore()

class UpsertRow(BaseModel):
    row_id: str
    text: str
    metadata: Dict[str, Any] = {}

class UpsertRequest(BaseModel):
    table_id: str
    rows: List[UpsertRow]

class SearchRequest(BaseModel):
    table_id: str
    query: str
    top_k: int = 3

class SearchResult(BaseModel):
    row_id: str
    score: float
    metadata: Dict[str, Any] = {}

class SearchResponse(BaseModel):
    results: List[SearchResult]

class DeleteRequest(BaseModel):
    table_id: str
    row_ids: List[str]

class RebuildRequest(BaseModel):
    table_id: str
    rows: List[UpsertRow]

# --- Ollama embedding ---
def get_embedding(text: str) -> list:
    print(f"[DEBUG] Getting embedding for text: '{text[:50]}...' (length: {len(text)})")
    print(f"[DEBUG] Using OLLAMA_BASE_URL: {OLLAMA_BASE_URL}")
    print(f"[DEBUG] Using EMBED_MODEL: {EMBED_MODEL}")
    
    try:
        resp = requests.post(f"{OLLAMA_BASE_URL}/api/embeddings", json={
            "model": EMBED_MODEL,
            "prompt": text
        }, timeout=300)
        print(f"[DEBUG] Ollama response status: {resp.status_code}")
        
        if not resp.ok:
            print(f"[ERROR] Ollama API error: {resp.status_code} - {resp.text}")
            raise HTTPException(status_code=resp.status_code, detail=f"Ollama API error: {resp.text}")
        
        data = resp.json()
        print(f"[DEBUG] Ollama response keys: {list(data.keys())}")
        
        if 'embedding' in data:
            print(f"[DEBUG] Found embedding in data['embedding'], length: {len(data['embedding'])}")
            return data['embedding']
        if 'data' in data and isinstance(data['data'], list) and 'embedding' in data['data'][0]:
            print(f"[DEBUG] Found embedding in data['data'][0]['embedding'], length: {len(data['data'][0]['embedding'])}")
            return data['data'][0]['embedding']
        
        print(f"[ERROR] No embedding found in response: {data}")
        raise ValueError('No embedding in Ollama response')
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Request exception: {e}")
        raise HTTPException(status_code=422, detail=f"Failed to connect to Ollama: {e}")
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        raise HTTPException(status_code=422, detail=f"Failed to get embedding: {e}")

@app.post("/upsert")
def upsert_rows(req: UpsertRequest):
    print(f"[DEBUG] Upsert request: table_id={req.table_id}, rows_count={len(req.rows)}")
    rows_to_upsert = []
    for i, row in enumerate(req.rows):
        print(f"[DEBUG] Processing row {i}: row_id={row.row_id}, text_length={len(row.text)}")
        try:
            emb = get_embedding(row.text)
            print(f"[DEBUG] Got embedding for row {i}: length={len(emb)}")
            rows_to_upsert.append({
                'row_id': row.row_id,
                'embedding': emb,
                'metadata': row.metadata
            })
        except Exception as e:
            print(f"[ERROR] Failed to get embedding for row {i}: {e}")
            raise HTTPException(status_code=422, detail=f"Failed to get embedding: {e}")
    
    print(f"[DEBUG] Upserting {len(rows_to_upsert)} rows to store")
    store.upsert(req.table_id, rows_to_upsert)
    return {"success": True}

@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    emb = get_embedding(req.query)
    results = store.search(req.table_id, emb, req.top_k)
    return {"results": results}

@app.post("/delete")
def delete(req: DeleteRequest):
    store.delete(req.table_id, req.row_ids)
    return {"success": True}

@app.post("/rebuild")
def rebuild(req: RebuildRequest):
    rows_to_upsert = []
    for row in req.rows:
        emb = get_embedding(row.text)
        rows_to_upsert.append({
            'row_id': row.row_id,
            'embedding': emb,
            'metadata': row.metadata
        })
    store.rebuild(req.table_id, rows_to_upsert)
    return {"success": True}

@app.get("/health")
def health():
    return {"status": "ok"} 