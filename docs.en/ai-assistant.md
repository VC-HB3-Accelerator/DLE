**English** | [Русский](../docs.ru/ai-assistant.md)

# DLE AI Agents — Building Specialized Business Agents

> **Concept:** one local model — many specialized agents. Each agent is tailored to a specific business process: its own prompt, rules, knowledge base, and interface.

## Table of Contents

1. [What and Why](#what-and-why)
2. [Architecture](#architecture)
3. [How to Create an Agent](#how-to-create-an-agent)
4. [Agent Examples](#agent-examples)
5. [Technology Stack](#technology-stack)
6. [Advantages Over Cloud Solutions](#advantages-over-cloud-solutions)
7. [Economic Impact](#economic-impact)

---

## What and Why

DLE provides **tools to create AI agents** — specialized assistants, each responsible for a distinct business process.

This is not one generic chatbot. It is a **builder** where you:

- Create an agent for a specific task (support, content, procurement, analytics)
- Set its role via system prompt
- Attach a knowledge base (RAG tables) with relevant data
- Configure behavior rules (strict, creative, hybrid)
- Bind to channels (web chat, Telegram, Email)
- Get an isolated specialist working 24/7

All agents use **one local Ollama model** on your server. They differ by system prompts, rules, and connected data. Data never leaves your server.

---

## Architecture

### Principle: One Model — Many Agents

One Ollama instance (e.g. qwen2.5:7b) serves multiple agents. Each has its own prompt, rules, RAG tables, channels, and UI. Agents are isolated and do not affect each other.

### Request Flow

User request → agent determined by channel/route → agent config (prompt, rules, RAG) → query vectorization (Ollama mxbai-embed-large) → RAG search (FAISS) → LLM response with RAG context + system prompt + history → optional cache (TTL 1 h) → response to user.

---

## How to Create an Agent

### Step 1. Basic Info

- **Name** — e.g. “Support Agent”, “Content Editor”, “AI Procurement”
- **Role** — support, content_editor, analyst, purchaser, etc.
- **Description** — what the agent is for

### Step 2. System Prompt

Defines identity and behavior. Examples:

**Support:** “You are a professional customer support assistant. Answer only from the knowledge base. If no answer — suggest contacting an operator. Do not invent prices, terms, or conditions.”

**Content editor:** “You are a professional content marketer and editor. Use company style from the knowledge base. Follow platform guidelines. Use keywords and hashtags from the base.”

### Step 3. Rules (JSON)

```json
{
  "searchRagFirst": true,
  "generateIfNoRag": false,
  "checkUserTags": true,
  "temperature": 0.3,
  "maxTokens": 500
}
```

| Parameter | Effect | Support | Content | Analytics |
|-----------|--------|----------|---------|-----------|
| temperature | Creativity (0.0–1.0) | 0.3 | 0.7 | 0.2 |
| searchRagFirst | Search knowledge base first | true | true | true |
| generateIfNoRag | Generate if not in base | false | true | false |
| maxTokens | Max response length | 500 | 2000 | 1000 |

### Step 4. Knowledge Base (RAG Tables)

Attach spreadsheets the agent will search: Support → FAQ, product docs; Content → platform instructions, style, examples, keywords; Procurement → supplier base, terms, prices. Tables need columns designated as “Question for AI” and “Answer for AI” for vector indexing.

### Step 5. Channels and Interface

Channels: web chat, Telegram, Email, SMS. Route: e.g. `/content-editor`. Set which roles can access.

### Step 6. Activate

Enable the agent; it starts handling requests on the selected channels.

---

## Agent Examples

### 1. Customer Support Agent

**Task:** answer customer questions 24/7 from the knowledge base. Strict mode (only from base), temperature 0.3, RAG: FAQ, docs. Channels: web chat, Telegram, Email. If no answer → suggest operator.

### 2. Content Editor Agent

**Task:** create social posts, blog articles, emails in company style. Creative mode, temperature 0.7, RAG: platform instructions, style, examples, keywords, CTAs. Interface: `/content-editor`, Editor role.

### 3. AI Procurement Agent

**Task:** help choose suppliers and compare terms. Hybrid mode, temperature 0.5, RAG: supplier base, terms and prices. Example: “Who supplies electronics with delivery up to 3 days?” → top 3 from table with filters.

### 4. Other Possible Agents

Analyst (reports, trends), HR assistant (screening, policies), Translator (glossaries, style), Legal assistant (contracts, norms). Each = new combination of prompt, rules, and tables.

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| LLM | Ollama (qwen2.5:7b or other) | Generation, dialogue |
| Embedding | mxbai-embed-large | Text vectorization |
| Vector DB | FAISS | Semantic search |
| Main DB | PostgreSQL | Agents, knowledge, history |
| Cache | Node.js Map + TTL | Fast repeat queries (< 50ms) |
| Queue | AI Queue | Priority processing |
| Encryption | AES-256 | Prompts and settings encrypted |

### RAG Search Methods

Semantic (FAISS), keyword, hybrid (e.g. 70% semantic, 30% keyword). Optional: fuzzy search, stemming, keyword extraction.

---

## Advantages Over Cloud Solutions

| | DLE (local) | ChatGPT API | Claude API |
|-|-------------|-------------|------------|
| **Cost** | $0 | ~$0.02/request | ~$0.03/request |
| **Confidentiality** | 100% on your server | Data at OpenAI | Data at Anthropic |
| **Speed (cached)** | < 50ms | 500–2000ms | 500–2000ms |
| **Offline** | Yes | No | No |
| **Business tuning** | Full: prompts, rules, RAG | Limited | Limited |
| **API limits** | None | Yes | Yes |
| **Number of agents** | Unlimited | Separate API per use | Separate API per use |

---

## Economic Impact

### API Cost Savings

| Requests/month | ChatGPT API | Claude API | DLE |
|----------------|-------------|------------|-----|
| 10,000 | $2,400/year | $3,600/year | $0 |
| 50,000 | $12,000/year | $18,000/year | $0 |
| 100,000 | $24,000/year | $36,000/year | $0 |

### Process Automation Savings

Each agent replaces routine work. Example for a mid-size company: support agent ($57,600), procurement ($64,800), HR ($57,600), content ($86,400), analyst ($144,000), partners ($43,200), training ($30,000), API savings ($24,000–36,000) → **total about $507,600–519,600/year**. DLE license: $1,000 one-time.

### 5-Year Comparison with SaaS

Typical SaaS stack (CRM, chatbot, email, AI API): ~$39,000 over 5 years. DLE: $1,000 + $0 AI + free updates 5 years → **savings about $38,000**.

---

## Additional Materials

- [Multi-agent architecture](./back-docs/multi-agent-architecture.md) — technical spec
- [AI assistant setup](./back-docs/setup-ai-assistant.md) — deployment steps
- [Tables system](./back-docs/tables-system.md) — RAG tables
- [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md)

---

## Support

- **Email:** info@hb3-accelerator.com
- **Chat:** https://hb3-accelerator.com
- **Docs:** [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md)

---

**© 2024-2025 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated:** February 2026
