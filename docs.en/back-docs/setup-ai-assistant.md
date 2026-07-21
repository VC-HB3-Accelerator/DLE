**English** | [Русский](../../docs.ru/back-docs/setup-ai-assistant.md)

# AI Assistant setup guide with vector search

## 🤖 Complete guide to launching the intelligent assistant

This document describes the step-by-step process of setting up an AI assistant for solving business tasks through spreadsheets and vector search.

---

## 📚 What you will set up

After following this guide you will have:

✅ A working AI assistant with a local model (Ollama)  
✅ A knowledge base for customer answers (FAQ)  
✅ Automation for supplier workflows  
✅ A staff training system  
✅ Vector search over your data  
✅ Significant savings of time and resources  

> 💡 **Economic impact**: See [DLE AI agents](../ai-assistant.md) — architecture, agent examples, and savings calculations.  

---

## ⏱️ Setup time

- **Quick setup**: 20–30 minutes (basic FAQ)
- **Full setup**: 1–2 hours (all capabilities)

---

## Step 1: Install and start Ollama

### 1.1 Check Ollama status

1. Go to **Settings** → **Integrations** tab
2. Find the **"Ollama"** block and click **"Details"**
3. Check the connection status:
   - ✅ **"Ollama is running"** — everything is ready, go to step 1.3
   - ❌ **"Ollama API not responding"** — go to step 1.2

### 1.2 Start Ollama (if not running)

If Ollama is not running, execute in the terminal:

```bash
# For Docker (recommended)
docker-compose up -d ollama

# Or locally
ollama serve
```

Refresh the page and check the status again.

### 1.3 Install a model for AI

1. In the **Ollama** section click **"Install model"**
2. Choose a model:
   - **qwen2.5:1.5b** (recommended) — for Russian language, ~1.0 GB
   - **llama2:7b** — for English, 3.8 GB
   - **mistral:7b** — universal, 4.1 GB
3. Click **"Install"**
4. Wait for the download to finish (5–10 minutes depending on internet speed)

> 💡 **Tip**: The model is downloaded once and stored locally

### 1.4 Install an Embedding model

1. In the same section find **"Install Embedding model"**
2. Choose a model:
   - **mxbai-embed-large:latest** (recommended) — 670 MB
   - **nomic-embed-text:latest** — alternative, 274 MB
3. Click **"Install"**

> ⚠️ **Important**: An Embedding model is required for vector search (RAG)

---

## Step 2: Create a knowledge base (spreadsheets)

### 2.1 Create an FAQ table

1. Go to **Tables** (in the main menu)
2. Click **"+ Create table"**
3. Fill in:
   - **Name**: `FAQ - Frequently asked questions`
   - **Description**: `Knowledge base for the AI assistant for customer support`
4. Click **"Create"**

### 2.2 Configure table columns

Add the following columns:

#### Column 1: Question (required for RAG)

1. Click **"+ Add column"**
2. Fill in:
   - **Name**: `Question`
   - **Type**: `Text`
   - **Purpose**: Select `Question for AI` ⭐
3. Click **"Save"**

> ⚠️ **Critical**: Be sure to select the purpose "Question for AI" — this field will be indexed for vector search

#### Column 2: Answer (required for RAG)

1. Click **"+ Add column"**
2. Fill in:
   - **Name**: `Answer`
   - **Type**: `Text`
   - **Purpose**: Select `AI Answer` ⭐
3. Click **"Save"**

#### Column 3: Product (optional, for filtering)

1. Click **"+ Add column"**
2. Fill in:
   - **Name**: `Product`
   - **Type**: `Multiple choice`
   - **Options**: `Basic`, `Premium`, `Corporate`
   - **Purpose**: Select `Filter by product`
3. Click **"Save"**

#### Column 4: Tags (optional, for categorization)

1. Click **"+ Add column"**
2. Fill in:
   - **Name**: `Tags`
   - **Type**: `Multiple choice`
   - **Options**: `Payment`, `Delivery`, `Returns`, `Warranty`, `Tech support`
   - **Purpose**: Select `User tags`
3. Click **"Save"**

#### Column 5: Priority (optional)

1. Click **"+ Add column"**
2. Fill in:
   - **Name**: `Priority`
   - **Type**: `Number`
   - **Purpose**: Select `Priority`
3. Click **"Save"**

> 💡 **Tip**: Questions with higher priority will be shown to the AI first

### 2.3 Populate the knowledge base

Add typical questions and answers:

**Example 1: Payment**

| Question | Answer | Product | Tags | Priority |
|----------|--------|---------|------|----------|
| How do I pay for an order? | We accept payment by bank card, via PayPal, or by bank transfer. Choose a convenient method when placing your order. | All | Payment | 10 |
| Can I pay in installments? | Yes, for orders from 50,000₽ installment plans of 3, 6, or 12 months are available with no overpayment. | Premium, Corporate | Payment | 8 |

**Example 2: Delivery**

| Question | Answer | Product | Tags | Priority |
|----------|--------|---------|------|----------|
| How long does delivery take? | Standard delivery: 3–5 business days across Russia. Express delivery: 1–2 days in major cities. | All | Delivery | 10 |
| How much does delivery cost? | Free delivery for orders from 5,000₽. For orders under 5,000₽ delivery costs 300₽. | All | Delivery | 9 |

**Example 3: Returns**

| Question | Answer | Product | Tags | Priority |
|----------|--------|---------|------|----------|
| How do I return a product? | Returns are possible within 14 days of receipt. The item must be in the original packaging and retain its marketable condition. Contact support to arrange a return. | All | Returns | 10 |
| When will I get a refund? | Refunds are processed within 5–10 business days after the item is received at our warehouse. | All | Returns | 8 |

> 💡 **Recommendation**: Add at least 20–30 questions for good AI quality. The more questions, the more accurate the answers!

### 2.4 Activate the table as an AI source

1. In the top-right corner of the table find **⚙️ Table settings**
2. Turn on the toggle **"Use as AI source"** ✅
3. Click **"Save"**

> ✅ **Done!** The table is now indexed for vector search

---

## Step 3: Configure the AI provider (Ollama)

### 3.1 Open Ollama settings

1. Go to **Settings** → **Integrations**
2. Find the **"Ollama"** block and click **"Details"**

### 3.2 Check Base URL

1. Check the **Base URL** field:
   - For Docker: `http://ollama:11434` ✅
   - For local: `http://localhost:11434`
2. If the URL is incorrect, fix it and click **"Save"**

### 3.3 Select a model

1. In the **"Model (LLM)"** field select the installed model:
   - `qwen2.5:1.5b` (recommended for Russian)
2. In the **"Embeddings model"** field select:
   - `mxbai-embed-large:latest`
3. Click **"Save"**

---

## Step 4: Configure the AI Assistant

### 4.1 Open assistant settings

1. Go to **Settings** → **Integrations**
2. Find the **"AI Assistant"** block and click **"Details"**

### 4.2 Configure the system prompt

In the **"System prompt"** field enter instructions for the AI:

**Basic prompt (to start)**:

```
You are a professional company support assistant.

Rules:
1. Reply politely and professionally
2. Use information from the knowledge base
3. If there is no information — offer to contact an operator
4. Reply briefly and to the point
5. Always end with the question "How else can I help?"
```

**Advanced prompt (with personalization)**:

```
You are a professional support assistant for the company "Your company name".

About the company:
- We do [brief business description]
- Our values: quality, reliability, customer focus

Communication style:
- Friendly but professional
- Address the customer formally
- Use emojis moderately (1–2 per message)

Reply rules:
1. MANDATORY: Reply ONLY in Russian. All questions and answers must be in Russian
2. First search for the answer in the knowledge base (RAG)
3. If found — reply based on the found information
4. If not found — say so honestly and offer operator help
5. Do not invent information about prices, timelines, or terms
6. For complex questions, offer to contact a manager

Always end with: "How else can I help? 😊"
```

### 4.3 Select models

1. **LLM model**: Select `qwen2.5:1.5b (ollama)`
2. **Embedding model**: Select `mxbai-embed-large:latest (ollama)`

> 💡 **Tip**: Models are pulled automatically from Ollama settings

> 📊 **Context window size**: 
> - **Qwen2.5:1.5b**: Base context = **32,768 tokens** (~24,000 Russian words)
> - Total data sent to the model:
>   - System prompt: ~500–2000 characters (~300–1200 tokens)
>   - Dialog history: up to 20 messages (~100–500 tokens per message = ~2000–10000 tokens)
>   - RAG context: ~500–2000 tokens (from found data)
>   - Current question: ~50–200 tokens
>   - **Total**: roughly 3,000–15,000 tokens (headroom is sufficient)
> - If you need a larger context → use Qwen3 with YaRN (up to 131K tokens)

### 4.4 Select a RAG table

1. In the **"Selected RAG tables"** field select the created table:
   - `FAQ - Frequently asked questions`
2. Click **"Save"**

### 4.5 Configure AI Rules

Create a rule set to control AI behavior:

1. Click the **"Create"** button next to the "Rule set" field
2. In the modal window fill in:

**Name**: `Hybrid mode (RAG + generation)`

**Description**: `AI first searches the knowledge base; if nothing is found — generates an answer`

**Rules (JSON)**:
```json
{
  "checkUserTags": true,
  "searchRagFirst": true,
  "generateIfNoRag": true,
  "temperature": 0.7,
  "maxTokens": 500
}
```

3. Click **"Save"**
4. Select the created rule in the dropdown list

> 💡 **What the parameters mean**:
> - `checkUserTags: true` — consider user tags when searching
> - `searchRagFirst: true` — search the knowledge base first
> - `generateIfNoRag: true` — generate an answer if nothing is found
> - `temperature: 0.7` — balance between accuracy and creativity (0.0–1.0)
> - `maxTokens: 500` — maximum answer length

### 4.6 RAG search settings

Expand the section **"🔍 RAG search settings"**:

**Basic settings:**
1. **Search method**: Select `Hybrid search` (recommended)
2. **Maximum number of results**: `5`
3. **Relevance threshold**: `0.1` (from 0.01 to 1.0)

**Keyword extraction:**
1. ✅ **Enable keyword extraction**
2. **Minimum word length**: `3`
3. **Maximum number of keywords**: `10`
4. ✅ **Remove stop words**

**Search weights (for hybrid):**
1. **Semantic search**: `70%` (accuracy)
2. **Keyword search**: `30%` (speed)

**Additional settings:**
1. ✅ **Fuzzy search** (for typos)
2. ✅ **Word stemming** (finds different word forms)
3. ☐ **Synonym search** (currently disabled)

### 4.7 Save settings

Click the **"Save"** button at the bottom of the form.

---

## Step 5: Test the AI Assistant

### 5.1 Use the built-in tester

1. On the AI assistant settings page scroll down to the **"🔍 System monitoring"** block
2. In the **"🧠 Test RAG functionality"** section:
   - Make sure the table `FAQ - Frequently asked questions` is selected
   - Enter a test question: `How do I pay for an order?`
   - Click **"Test RAG"**
3. Watch the process:
   - 🔍 Searching for an answer in the knowledge base... (vector search)
   - 🤖 Generating a reply with AI... (LLM generation)
   - ✅ Done!
4. Check the result:
   - An answer from your table should be displayed
   - Score (similarity rating): the closer to 0, the better

> 💡 **Good Score**: from -300 to 0 (answer found)  
> ⚠️ **Bad Score**: greater than 300 (answer not found, AI will invent its own)

### 5.2 Testing via Web Chat

1. Go to the application home page
2. Find the **"💬 Chat with AI"** widget (usually bottom right)
3. Click the widget to open the chat
4. Enter a question: `How much does delivery cost?`
5. Check the AI reply

**Expected result:**
```
🤖 AI Assistant:
Free delivery for orders from 5,000₽. 
For orders under 5,000₽ delivery costs 300₽.

How else can I help? 😊
```

### 5.3 Testing different scenarios

Try asking various questions:

**✅ Question from the knowledge base:**
```
User: "How do I return a product?"
AI: [Answer from the FAQ table]
```

**⚠️ Question NOT from the knowledge base:**
```
User: "What's the weather today?"
AI: "Sorry, I specialize in questions about our company and products. 
     For weather questions, please use specialized services. 
     How else can I help?"
```

**🎯 Question with a typo:**
```
User: "How do I py for an order?" (typo)
AI: [Will find the correct answer thanks to fuzzy search]
```

---

## Step 6: Advanced capabilities (optional)

### 6.1 Create a table for working with suppliers

#### Structure of the "Supplier database" table

1. Create a new table: `Supplier database`
2. Add columns:

| Column | Type | Description |
|--------|------|-------------|
| Company name | Text | Supplier name |
| Product category | Multiple choice | Electronics, Furniture, Clothing, etc. |
| Contact person | Text | Manager full name |
| Email | Text | Email address |
| Phone | Text | Contact phone |
| Prices | Text | Price list (brief description) |
| Payment terms | Text | Deferred payment, prepayment, etc. |
| Minimum order | Number | Minimum order amount |
| Delivery time | Text | Delivery timelines |
| Rating | Number | Score from 1 to 10 |
| Notes | Text | Additional information |

3. Activate it as an AI source
4. Fill it with data about your suppliers

#### Prompt for an AI procurement assistant

Add to the system prompt:

```
ADDITIONALLY - Working with suppliers:

When the user asks about suppliers:
1. Search in the "Supplier database"
2. Filter by product category
3. Sort by rating and terms
4. Provide TOP-3 recommendations

Reply format:
🏆 TOP-3 suppliers for query "[category]":

1. [Name] ⭐ [Rating]/10
   📧 [Email] | 📞 [Phone]
   💰 Terms: [Payment terms]
   🚚 Delivery: [Delivery time]
   📦 Minimum: [Minimum order]₽

2. ...
3. ...

I recommend contacting [Name of the first supplier] — best terms.
```

### 6.2 Create a table for staff training

#### Structure of the "Employee knowledge base" table

1. Create a new table: `Employee knowledge base`
2. Add columns:

| Column | Type | Description |
|--------|------|-------------|
| Question | Text | Employee question (purpose: Question for AI) |
| Answer | Text | Detailed answer (purpose: AI Answer) |
| Category | Multiple choice | Sales, HR, Finance, IT, Marketing |
| Department | Multiple choice | Which department it applies to |
| Difficulty | Number | From 1 (simple) to 5 (complex) |
| Instructions | Text | Step-by-step instructions (if any) |
| Links | Text | Links to documents/videos |
| Updated date | Date | When the information was updated |

3. Example questions:

**"Sales" category:**
- "How do I process a customer return?"
- "What discounts can I give to regular customers?"
- "How do I work with corporate clients?"

**"HR" category:**
- "How do I request leave?"
- "Where do I go for sick leave?"
- "How does onboarding for new employees work?"

**"IT" category:**
- "How do I get access to corporate email?"
- "What should I do if I have VPN problems?"
- "How do I create a ticket for tech support?"

### 6.3 Create relations between tables

#### Example: "Customers" → "Orders" relation

1. Create a **"Customers"** table:
   - Name, Email, Phone, Status (VIP/Regular)

2. Create an **"Orders"** table:
   - Order number, Date, Amount

3. In the "Orders" table add a column:
   - **Name**: `Customer`
   - **Type**: `Relation`
   - **Related table**: select `Customers`
   - **Display field**: select `Name`

4. Add another column in "Orders":
   - **Name**: `Customer email`
   - **Type**: `Lookup`
   - **Relation via**: select the `Customer` column
   - **Lookup field**: select `Email`

**Result**: When you select a customer, their Email is filled in automatically!

#### Using AI with related tables

AI automatically understands relations and can answer questions:

```
User: "Show all orders for customer Ivanov"
AI: [Searches the Orders table, filters by customer Ivanov]
```

---

## Step 7: Integration with Telegram and Email (optional)

### 7.1 Configure a Telegram bot

1. Go to **Settings** → **Integrations** → **Telegram**
2. Create a bot via [@BotFather](https://t.me/botfather) in Telegram:
   - Send `/newbot`
   - Choose a name and username for the bot
   - Copy the **Bot Token**
3. In DLE settings enter:
   - **Bot Token**: paste the token from BotFather
   - **Bot Username**: your bot username (for example, `@mycompany_bot`)
4. Click **"Save"**
5. In AI assistant settings select this Telegram bot in the **"Telegram bot"** field

**Result**: AI will reply to messages in Telegram!

### 7.2 Configure Email integration

1. Go to **Settings** → **Integrations** → **Email**
2. Fill in IMAP settings (for receiving mail):
   - **IMAP Host**: `imap.gmail.com` (for Gmail)
   - **IMAP Port**: `993`
   - **IMAP User**: your email
   - **IMAP Password**: app password (not the main password!)
3. Fill in SMTP settings (for sending mail):
   - **SMTP Host**: `smtp.gmail.com`
   - **SMTP Port**: `587`
   - **SMTP User**: your email
   - **SMTP Password**: app password
   - **From Email**: email for sending
4. Click **"Test IMAP"** and **"Test SMTP"** to verify
5. Click **"Save"**
6. In AI assistant settings select this Email in the **"Contact Email"** field

> ⚠️ **Important for Gmail**: Create an "App password" in Google security settings

**Result**: AI will reply to incoming emails automatically!

---

## Step 8: Monitoring and optimization

### 8.1 Check service status

1. Go to **Settings** → **Integrations** → **AI Assistant**
2. Scroll down to **"🔍 System monitoring"**
3. Click **"🔄 Refresh status"**
4. Check the statuses:
   - 🟢 **Backend**: should be "Running"
   - 🟢 **Postgres**: should be "Running"
   - 🟢 **Ollama**: should show the number of models
   - 🟢 **Vector Search**: should be "Running"

> ⚠️ If something is red (🔴) — see the "Troubleshooting" section below

### 8.2 Analyze answer quality

Regularly check the quality of AI answers:

1. **Score in the RAG tester**:
   - **-300 to 0** ✅ — excellent match
   - **0 to 300** ⚠️ — average match
   - **>300** ❌ — no match found

2. **If Score is poor**:
   - Add more similar questions to the table
   - Use different phrasings of the same question
   - Increase the relevance threshold (for example, to 0.2)

### 8.3 Optimize RAG settings

Experiment with settings to improve results:

**For more accurate answers:**
```
Search method: Semantic
Relevance threshold: 0.05 (lower = stricter)
Weights: Semantic 100% / Keywords 0%
```

**For faster answers:**
```
Search method: Keyword search
Maximum number of results: 3
```

**For balance (recommended):**
```
Search method: Hybrid
Weights: Semantic 70% / Keywords 30%
Relevance threshold: 0.1
```

---

## ✅ AI Assistant is ready to work!

### What you now have

✅ **Local AI assistant** with no cloud dependency  
✅ **FAQ knowledge base** for customer answers  
✅ **Vector search** for accurate replies  
✅ **Configured rules** for AI behavior  
✅ **Monitoring system** for quality control  

### Economic impact

With proper AI assistant setup you will get:

✅ **Automation of routine tasks** — freeing time for strategy  
✅ **Improved service quality** — AI works 24/7 without fatigue  
✅ **Lower operating costs** — less staff on routine tasks  
✅ **Faster decision-making** — instant access to information  

> 💡 **Detailed information**: See [DLE AI agents](../ai-assistant.md#economic-impact) — architecture, agent examples, and savings calculations.

---

## 📚 Next steps

### Expand AI capabilities

1. **Add more tables**:
   - Knowledge base for partners
   - Instructions for staff
   - Product catalog
   - Contact database

2. **Create rules for different scenarios**:
   - Strict mode (RAG only) — for finance
   - Creative mode (more generation) — for marketing
   - Hybrid mode (balance) — for support

3. **Integrate with other systems**:
   - CRM (customer sync)
   - Warehouse system (stock levels)
   - Accounting (invoices and payments)

### Train the team

1. Show employees how AI works
2. Explain how to add new questions to the base
3. Set up a process for regularly updating the knowledge base
4. Assign someone responsible for AI answer quality

---

## 🆘 Troubleshooting

### Problem: Ollama will not start

**Symptoms**: Status "Ollama API not responding"

**Solution**:
```bash
# Check the container
docker ps | grep ollama

# Restart
docker-compose restart ollama

# Check logs
docker-compose logs ollama
```

### Problem: AI answers inaccurately

**Symptoms**: Answers do not match the knowledge base

**Solution**:
1. Check the Score in the tester (should be < 300)
2. Add more question variants to the table
3. Lower the relevance threshold (for example, to 0.05)
4. Check that columns have the correct purposes ("Question for AI", "AI Answer")

### Problem: Vector Search does not work

**Symptoms**: Vector Search status shows an error

**Solution**:
1. Check that an Embedding model is installed
2. Rebuild the index: on the table page click **"🔄 Rebuild index"**
3. Check that the table is activated as an AI source

### Problem: AI replies in the wrong language

**Symptoms**: Replies in English instead of Russian

**Solution**:
1. Change the system prompt, adding at the start: `ALWAYS reply in Russian.`
2. Use the `qwen2.5:1.5b` model instead of `llama2:7b`
3. In AI rules set `"language": "ru"`

### Problem: Slow replies

**Symptoms**: AI takes longer than 5–10 seconds to reply

**Solution**:
1. Use a smaller model (`mistral:7b` instead of `qwen2.5:14b`)
2. Reduce `maxResults` in RAG settings (for example, to 3)
3. Disable "Synonym search" in additional settings
4. Use an SSD for storing models

---

## 📖 Additional documentation

### Explore AI capabilities

- 🤖 **[DLE AI agents](../ai-assistant.md)** — architecture, agent examples, and economic impact
- 📊 **[Spreadsheet system](./tables-system.md)** — technical description of tables
- ⚙️ **[AI configuration](./setup-ai-assistant.md#technical-documentation-for-developers)** — technical setup details

### General documentation

- 🛡️ **[Security](../security.md)** — how AI protects your data
- 💼 **[Blockchain for business](../blockchain-for-business.md)** — integrating AI with blockchain
- 📋 **[FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md)** — frequently asked questions

### Support

- 💬 **Support chat**: https://hb3-accelerator.com/
- 📧 **Email**: info@hb3-accelerator.com
- 📚 **Knowledge base**: https://hb3-accelerator.com

---

## 🔧 Technical documentation (for developers)

### AI system architecture

```
┌───────────────────────────────────────────────────────────┐
│          AI Assistant setup in DLE                        │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  🤖 AI Providers:                                         │
│     ├── OpenAI (GPT-4, GPT-3.5)                          │
│     ├── Anthropic (Claude)                               │
│     ├── Google (Gemini)                                  │
│     └── Ollama (local models)                            │
│                                                           │
│  ⚙️  AI settings:                                         │
│     ├── System Prompt                                    │
│     ├── LLM model selection                              │
│     ├── Embedding model selection                        │
│     ├── RAG table selection                              │
│     ├── Rules                                            │
│     └── RAG search settings                              │
│                                                           │
│  📋 Rules:                                                │
│     ├── JSON behavior configuration                      │
│     ├── Create/edit/delete                               │
│     └── Binding to the AI assistant                      │
│                                                           │
│  🔗 Integrations:                                         │
│     ├── Email (IMAP + SMTP)                              │
│     └── Telegram Bot                                     │
│                                                           │
│  🔍 RAG:                                                  │
│     ├── Table selection for search                       │
│     ├── Search settings (hybrid/semantic)                │
│     ├── Relevance threshold                              │
│     └── Keyword extraction                               │
│                                                           │
│  📊 Monitoring:                                           │
│     ├── Service status (Backend, Ollama, Postgres)      │
│     ├── RAG functionality test                           │
│     └── Progress tracking                                │
│                                                           │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Database

#### Table: `ai_providers_settings`

```sql
CREATE TABLE IF NOT EXISTS ai_providers_settings (
    id SERIAL PRIMARY KEY,
    provider_encrypted TEXT,              -- Provider: openai, anthropic, google, ollama
    api_key_encrypted TEXT,               -- API key (encrypted)
    base_url_encrypted TEXT,              -- Base URL for API
    selected_model_encrypted TEXT,        -- Selected LLM model
    embedding_model_encrypted TEXT,       -- Selected Embedding model
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Table: `ai_assistant_settings`

```sql
CREATE TABLE IF NOT EXISTS ai_assistant_settings (
    id SERIAL PRIMARY KEY,
    system_prompt_encrypted TEXT,         -- System prompt
    selected_rag_tables INTEGER[],        -- Array of RAG table IDs
    languages TEXT[],                     -- Array of supported languages
    model_encrypted TEXT,                 -- Selected LLM model
    embedding_model_encrypted TEXT,       -- Selected Embedding model
    rules JSONB,                          -- Rules (DEPRECATED)
    rules_id INTEGER REFERENCES ai_assistant_rules(id),  -- Reference to a rule
    telegram_settings_id INTEGER,         -- Reference to Telegram bot
    email_settings_id INTEGER,            -- Reference to Email settings
    rag_settings JSONB,                   -- RAG search settings
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER
);
```

#### Table: `ai_assistant_rules`

```sql
CREATE TABLE IF NOT EXISTS ai_assistant_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,                   -- Rule set name
    description TEXT,                     -- Rule description
    rules JSONB NOT NULL,                 -- JSON configuration
    rules_encrypted TEXT,                 -- Encrypted version of rules
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Backend API

#### AI provider settings

- **GET** `/settings/ai-settings/:provider` — Get provider settings
- **PUT** `/settings/ai-settings/:provider` — Save provider settings
- **DELETE** `/settings/ai-settings/:provider` — Delete provider settings
- **GET** `/settings/ai-settings/:provider/models` — Get model list
- **POST** `/settings/ai-settings/:provider/verify` — Verify API key

#### AI assistant settings

- **GET** `/settings/ai-assistant` — Get assistant settings
- **PUT** `/settings/ai-assistant` — Save assistant settings

#### AI rules

- **GET** `/settings/ai-assistant-rules` — Get all rules
- **GET** `/settings/ai-assistant-rules/:id` — Get rule by ID
- **POST** `/settings/ai-assistant-rules` — Create a rule
- **PUT** `/settings/ai-assistant-rules/:id` — Update a rule
- **DELETE** `/settings/ai-assistant-rules/:id` — Delete a rule

#### Ollama (local models)

- **GET** `/ollama/status` — Check Ollama status
- **GET** `/ollama/models` — Get model list
- **POST** `/ollama/install` — Install a model
- **DELETE** `/ollama/models/:modelName` — Delete a model

### Frontend pages

- **`/settings/ai`** — Main integrations page
- **`/settings/ai/:provider`** — AI provider settings
- **`/settings/ai/assistant`** — AI assistant settings

### Message processing flow

```
1. User → Message
              ↓
2. UnifiedMessageProcessor
              ↓
3. Language check (Russian only)
              ↓
4. Deduplication (message hash)
              ↓
5. Load settings (aiAssistantSettingsService)
              ↓
6. Load rules (aiAssistantRulesService)
              ↓
7. RAG search (ragService)
   ├── Semantic search (vector search)
   ├── Keyword search
   └── Hybrid search
              ↓
8. Reply generation (generateLLMResponse)
   ├── System Prompt
   ├── Conversation history
   ├── Context from RAG
   └── Rules
              ↓
9. Reply → User
```

### Security

- **Encryption**: All sensitive fields are encrypted with AES-256
- **Access rights**: Only administrators can change settings
- **Validation**: All input data and API keys are validated

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Document version**: 1.0.0  
**Created**: February 28, 2026
