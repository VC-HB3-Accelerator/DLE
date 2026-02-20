**English** | [Русский](../../docs.ru/back-docs/setup-ai-assistant.md)

# AI Assistant Setup with Vector Search

## Full guide to launching the intelligent assistant

This document describes the step-by-step setup of the AI assistant for business tasks using spreadsheets and vector search.

---

## What you will have after setup

✅ Working AI assistant with local model (Ollama)  
✅ Knowledge base for customer answers (FAQ)  
✅ Supplier and procurement automation  
✅ Staff training system  
✅ Vector search over your data  
✅ Significant time and cost savings  

> 💡 **Economics:** See [DLE AI Agents](../ai-assistant.md) for architecture, examples, and savings.

---

## Time required

- **Quick setup:** 20–30 minutes (basic FAQ)
- **Full setup:** 1–2 hours (all features)

---

## Step 1: Install and run Ollama

1. **Settings** → **Integrations** → **Ollama** → **Details**
2. Check status: “Ollama is running” or “Ollama API not responding”
3. If not running: `docker-compose up -d ollama` or `ollama serve`
4. **Install model:** e.g. qwen2.5:7b (recommended), llama2:7b, mistral:7b
5. **Install embedding model:** mxbai-embed-large:latest (recommended) or nomic-embed-text:latest  

> ⚠️ Embedding model is required for RAG (vector search).

---

## Step 2: Create knowledge base (spreadsheets)

### 2.1 FAQ table

1. **Tables** → **+ Create table**
2. Name: e.g. “FAQ – Frequently asked questions”, description for AI
3. **Add columns:**
   - **Question** — type Text, **purpose: Question for AI** (required for RAG)
   - **Answer** — type Text, **purpose: Answer for AI**
   - **Product** (optional) — Multiselect, purpose: Product filter
   - **Tags** (optional) — Multiselect, purpose: User tags
   - **Priority** (optional) — Number, purpose: Priority

### 2.2 Fill with sample Q&A

Add rows: e.g. “How to pay?” / “We accept card, PayPal, bank transfer…”; “Delivery time?” / “3–5 business days…”; “Return policy?” / “Within 14 days…”. Minimum ~20–30 questions recommended.

### 2.3 Enable as AI source

In table settings enable **“Use as source for AI”** and save. Table is then indexed for vector search.

---

## Step 3: AI provider (Ollama) settings

1. **Settings** → **Integrations** → **Ollama**
2. Base URL: Docker `http://ollama:11434`, local `http://localhost:11434`
3. **LLM model:** e.g. qwen2.5:7b
4. **Embedding model:** mxbai-embed-large:latest  
Save.

---

## Step 4: AI Assistant settings

1. **Settings** → **Integrations** → **AI Assistant** → **Details**
2. **System prompt** — e.g. “You are a professional support assistant. Answer from the knowledge base. If not found, suggest contacting an operator. Always end with ‘How else can I help?’”
3. **Models:** select same LLM and embedding as above
4. **Selected RAG tables:** choose your FAQ table
5. **Rules (JSON):** e.g. `searchRagFirst: true`, `generateIfNoRag: true`, `temperature: 0.7`, `maxTokens: 500`
6. **RAG search:** e.g. Hybrid, max results 5, relevance threshold 0.1; optional keyword extraction, fuzzy search, stemming  
Save.

---

## Step 5: Test

1. **RAG tester** (on assistant settings page): choose table, ask e.g. “How to pay?” → check answer and score (good: about -300 to 0).
2. **Web chat:** open main page, ask e.g. “What is the delivery cost?” — answer should come from your FAQ.
3. Try questions inside and outside the knowledge base; test with typos (fuzzy search).

---

## Step 6 (optional): Extra tables and channels

- **Suppliers table:** columns for company, category, contact, email, phone, prices, payment terms, delivery, rating. Enable as AI source; add prompt instructions for “TOP-3 suppliers” style answers.
- **Staff knowledge base:** questions/answers by category (Sales, HR, IT). Same RAG setup.
- **Telegram:** create bot via @BotFather, add token and username in Settings → Integrations → Telegram; link to AI assistant.
- **Email:** IMAP/SMTP in Settings; for Gmail use app password. Link to AI assistant.

---

## Step 7: Monitoring and tuning

- **Status:** Settings → AI Assistant → Monitoring: Backend, Postgres, Ollama, Vector Search should be green.
- **RAG quality:** Score -300…0 = good; >300 = not found. Improve by adding variants of questions and adjusting relevance threshold.
- **Speed:** Smaller model or fewer RAG results if responses are slow.

---

## Troubleshooting

- **Ollama not responding:** `docker-compose restart ollama`, check logs.
- **Wrong answers:** Check RAG score; add more questions; lower relevance threshold; ensure column purposes “Question for AI” and “Answer for AI”.
- **Vector search error:** Install embedding model; on table page use “Rebuild index”; ensure table is enabled as AI source.
- **Wrong language:** Add “Always answer in English” (or desired language) to system prompt; choose suitable model (e.g. qwen2.5:7b for multilingual).

---

## Technical reference (developers)

- **DB:** ai_providers_settings, ai_assistant_settings, ai_assistant_rules (encrypted fields, RAG tables, rules JSON).
- **API:** GET/PUT settings per provider and assistant; rules CRUD; Ollama status, models, install.
- **Flow:** Message → UnifiedMessageProcessor → language check → dedup → load settings and rules → RAG search → generate LLM response → return. Security: AES-256 for sensitive fields; admin-only for settings.

---

**© 2024-2025 Alexander Viktorovich Tarabanov. All rights reserved.**

Version: 1.0.0 | Date: October 25, 2025
