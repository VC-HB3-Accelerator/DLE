**English** | [Русский](../docs.ru/ai-assistant.md)

# DLE AI Agents — a system for creating specialized business agents

> **Concept**: one local model — many specialized agents. Each agent is tailored to a specific business process: its own prompt, its own rules, its own knowledge base, its own interface.

## Table of contents

1. [What it is and why](#what-it-is-and-why)
2. [Architecture](#architecture)
3. [How to create an agent](#how-to-create-an-agent)
4. [Agent examples](#agent-examples)
5. [Technology stack](#technology-stack)
6. [Advantages over cloud solutions](#advantages-over-cloud-solutions)
7. [Economic impact](#economic-impact)

---

## What it is and why

DLE provides **tools for creating AI agents** — specialized assistants, each responsible for a separate business process.

This is not one universal chatbot. It is a **builder** where you:

- Create an agent for a specific task (customer support, content, procurement, analytics)
- Define its role via a system prompt
- Connect a knowledge base (RAG tables) with relevant data
- Configure behavior rules (strict mode, creative, hybrid)
- Bind it to channels (web chat, Telegram, Email)
- Get an isolated specialist that works 24/7

All agents use **one local Ollama model** on your server. The difference between them is in system prompts, rules, and connected data. Data never leaves your server.

---

## Architecture

### Principle: one model — many agents

```
┌──────────────────────────────────────────────────────┐
│            Local Ollama model (qwen2.5:1.5b)           │
│            Shared by all agents                      │
└───────────┬──────────────┬───────────────┬───────────┘
            │              │               │
            ↓              ↓               ↓
┌───────────────┐ ┌────────────────┐ ┌──────────────┐
│ Support       │ │ Content        │ │ Procurement  │
│ agent         │ │ editor         │ │ agent        │
│               │ │ agent          │ │              │
│ Prompt:       │ │ Prompt:        │ │ Prompt:      │
│ "You are a    │ │ "You are a     │ │ "You are a   │
│  support      │ │  content       │ │  procurement │
│  assistant"   │ │  marketer"     │ │  specialist" │
│               │ │                │ │              │
│ RAG: FAQ,     │ │ RAG: style,    │ │ RAG:         │
│ documentation │ │ instructions,  │ │ suppliers,   │
│               │ │ examples       │ │ terms        │
│               │ │                │ │              │
│ Rules:        │ │ Rules:         │ │ Rules:       │
│ strict        │ │ creative       │ │ hybrid       │
│ (t=0.3)       │ │ (t=0.7)        │ │ (t=0.5)      │
│               │ │                │ │              │
│ Channels:     │ │ Channels:      │ │ Channels:    │
│ chat, TG,     │ │ web UI         │ │ web UI       │
│ email         │ │ /content-editor│ │              │
└───────────────┘ └────────────────┘ └──────────────┘
```

### Agent isolation

Each agent is fully isolated:

| Parameter | Isolation |
|----------|----------|
| System prompt | Own for each agent |
| Rules | Own set: temperature, maxTokens, RAG mode |
| RAG tables | Agent sees only its connected tables |
| Channels | Separate binding to web chat, Telegram, Email |
| Interface | Own route and UI |
| Access rights | Separate permissions |

Agents do not affect each other: you can create, change, and delete them independently.

### Request processing

```
User request
       ↓
Agent resolution (by channel / route)
       ↓
Load agent settings (prompt, rules, RAG tables)
       ↓
Request vectorization (Ollama mxbai-embed-large → vector [768])
       ↓
RAG search over connected tables (FAISS)
       ↓
Response generation (LLM with RAG context + system prompt + history)
       ↓
Response caching (TTL 1 hour, repeat request < 50ms)
       ↓
Response to user
```

---

## How to create an agent

### Step 1. Basic information

- **Name** — “Support Agent”, “Content Editor”, “AI Purchaser”
- **Role** — support, content_editor, analyst, purchaser, etc.
- **Description** — what the agent is for

### Step 2. System prompt

Defines the agent’s personality and behavior. Examples:

**For a support agent:**
```
You are a professional support assistant for the company "Name".

Rules:
1. Answer ONLY based on the knowledge base
2. If there is no answer — suggest contacting an operator
3. Do not invent information about prices, deadlines, or terms
4. Address the client formally
5. End with: "How else can I help?"
```

**For a content editor:**
```
You are a professional content marketer and editor for the company "Name".

Rules:
1. Use the company style from the knowledge base
2. Follow the instructions for the specific platform (VK, Telegram, etc.)
3. Use keywords and hashtags from the knowledge base
4. Add CTA blocks from the knowledge base
```

### Step 3. Rules

JSON configuration of agent behavior:

```json
{
  "searchRagFirst": true,
  "generateIfNoRag": false,
  "checkUserTags": true,
  "temperature": 0.3,
  "maxTokens": 500
}
```

| Parameter | What it does | Support | Content | Analytics |
|----------|-----------|-----------|---------|-----------|
| `temperature` | Creativity level (0.0–1.0) | 0.3 | 0.7 | 0.2 |
| `searchRagFirst` | Search the knowledge base first | true | true | true |
| `generateIfNoRag` | Generate if nothing found in the base | false | true | false |
| `maxTokens` | Maximum response length | 500 | 2000 | 1000 |
| `checkUserTags` | Take user tags into account | true | false | true |

### Step 4. Knowledge base (RAG tables)

Connect spreadsheets the agent will search for information:

- **Support agent** → “FAQ”, “Product documentation” tables
- **Content editor** → “Platform instructions”, “Company style”, “Content examples”, “Keywords” tables
- **AI purchaser** → “Supplier base”, “Terms and price lists” tables

Each table must have columns assigned as “Question for AI” and “AI Answer” — they are automatically indexed for vector search.

### Step 5. Channels and interface

| Parameter | Description |
|----------|----------|
| Channels | web chat, Telegram, Email, SMS |
| Route | Agent interface URL (for example, `/content-editor`) |
| Access rights | Which user roles have access |

### Step 6. Activation

Enable the agent — it will start processing requests on the connected channels.

---

## Agent examples

### 1. Customer support agent

**Task**: answer customer questions 24/7 based on the knowledge base.

| Parameter | Value |
|----------|----------|
| Mode | Strict — only from the knowledge base |
| temperature | 0.3 |
| RAG tables | FAQ, Documentation, Customer knowledge base |
| Channels | Web chat, Telegram, Email |
| Behavior when no answer | Suggests contacting an operator |

**Example flow:**
```
Client: "How do I pay for an order?"
Agent:  [Searches the FAQ table → finds an answer with Score < 300]
        "We accept payment by bank card, via PayPal
         or bank transfer. How else can I help?"
```

### 2. Content editor

**Task**: create content for social networks, blog, and newsletters in the company style.

| Parameter | Value |
|----------|----------|
| Mode | Creative — generates based on instructions and examples |
| temperature | 0.7 |
| RAG tables | Platform instructions, Company style, Content examples, Keywords, CTA blocks |
| Channels | Web interface `/content-editor` |
| Access | Users with the Editor role |

**Interface:**
- Task input field
- Content type selection (VK post, blog article, email newsletter)
- Platform selection
- Generate → edit → save/export
- History of created content

### 3. AI purchaser

**Task**: help with supplier selection and terms analysis.

| Parameter | Value |
|----------|----------|
| Mode | Hybrid |
| temperature | 0.5 |
| RAG tables | Supplier base, Terms and price lists |
| Channels | Web interface |
| Access | Procurement managers |

**Example flow:**
```
Manager: "Who supplies electronics with delivery within 3 days?"
Agent:   [Searches the supplier table, filters by category and lead time]
         "TOP-3 electronics suppliers with delivery within 3 days:
          1. TechnoSupply LLC — rating 9/10, delivery 2 days
          2. ..."
```

### 4. Other possible agents

| Agent | Task | RAG tables |
|-------|--------|-------------|
| **Analyst** | Data analysis, report creation, trend detection | Metrics, KPI, Reports |
| **HR assistant** | Resume screening, employee answers, training planning | Employee knowledge base, HR policies |
| **Translator** | Document translation, content localization | Glossaries, Style for different languages |
| **Legal assistant** | Contract analysis, answers to legal questions | Contract templates, Regulations |

The number of agents is unlimited. Each new agent is a new combination of prompt, rules, and connected tables.

---

## Technology stack

| Component | Technology | Purpose |
|-----------|------------|------------|
| LLM | Ollama (qwen2.5:1.5b or any other) | Response generation, dialogue |
| Embedding | mxbai-embed-large | Text vectorization for search |
| Vector DB | FAISS | Fast semantic search |
| Primary DB | PostgreSQL | Storing agent settings, knowledge bases, history |
| Cache | Node.js Map + TTL | Speeding up repeat requests (< 50ms) |
| Queue | AI Queue | Priority-based task processing |
| Encryption | AES-256 | All prompts and settings are encrypted |

### Search methods (RAG)

| Method | Description | When to use |
|-------|----------|-------------------|
| Semantic | Meaning-based search via FAISS | When understanding accuracy matters |
| Keyword | Fast text search | When speed matters |
| Hybrid | 70% semantic + 30% keywords | Recommended by default |

Additionally: fuzzy search (typos), stemming (word forms), keyword extraction.

---

## Advantages over cloud solutions

| Characteristic | DLE (local) | ChatGPT API | Claude API |
|----------------|----------------|-------------|------------|
| **Cost** | $0 | ~$0.02/request | ~$0.03/request |
| **Confidentiality** | 100% — data on your server | Data at OpenAI | Data at Anthropic |
| **Speed (cache)** | < 50ms | 500–2000ms | 500–2000ms |
| **Offline work** | Yes | No | No |
| **Business customization** | Full: prompts, rules, RAG | Limited | Limited |
| **API limits** | None | Yes | Yes |
| **Number of agents** | Unlimited | Separate API call needed | Separate API call needed |
| **Multiple knowledge bases** | Yes, isolated RAG tables | No native support | No native support |

---

## Economic impact

### Savings on API requests

| Request volume | ChatGPT API | Claude API | DLE |
|---------------|-------------|------------|-----|
| 10,000/mo | $2,400/year | $3,600/year | $0 |
| 50,000/mo | $12,000/year | $18,000/year | $0 |
| 100,000/mo | $24,000/year | $36,000/year | $0 |

### Savings from process automation

Each agent replaces routine employee work. Estimate for a mid-size company:

| Agent | What it automates | Annual savings |
|-------|--------------------|----------------|
| Support agent | Answers to typical questions 24/7 (instead of 1–2 operators) | $57,600 |
| AI purchaser | Supplier search and comparison (instead of manual analysis) | $64,800 |
| HR assistant | Resume screening, employee answers | $57,600 |
| Content editor | Post, newsletter, and article generation | $86,400 |
| Analyst | Reporting, data analysis, KPI monitoring | $144,000 |
| Partner relations agent | Communications, document preparation | $43,200 |
| Staff training | Personalized programs, knowledge tests | $30,000 |
| API savings | No fees for cloud APIs | $24,000–36,000 |
| **Total** | | **$507,600–519,600** |

**DLE cost**: $1,000 (one-time)

### Comparison with SaaS over 5 years

```
Typical SaaS stack:
  CRM (HubSpot):      $200/mo × 60 = $12,000
  Chatbot (Intercom): $150/mo × 60 = $9,000
  Email (SendGrid):   $100/mo × 60 = $6,000
  AI (ChatGPT API):   $200/mo × 60 = $12,000
  ─────────────────────────────────────────────
  Total SaaS:                         $39,000

DLE:
  License:                            $1,000
  Unlimited AI:                       $0
  Updates for 5 years:                $0
  ─────────────────────────────────────────────
  Total DLE:                          $1,000

  Savings over 5 years:              $38,000
```

---

## Additional materials

- [Multi-agent AI architecture](./back-docs/multi-agent-architecture.md) — detailed technical specification
- [AI assistant setup](./back-docs/setup-ai-assistant.md) — step-by-step deployment guide
- [Spreadsheet system](./back-docs/tables-system.md) — how RAG tables work
- [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md) — frequently asked questions

---

## Support

- **Email**: info@hb3-accelerator.com
- **Chat**: https://hb3-accelerator.com
- **Documentation**: [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md)

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated**: February 2026
