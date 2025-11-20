# AI Assistant Setup Guide with Vector Search

## 🤖 Complete Guide to Launching an Intelligent Assistant

This document describes the step-by-step process of setting up an AI assistant for solving business tasks through spreadsheets and vector search.

---

## 📚 What You'll Set Up

After completing the instructions, you will have:

✅ Working AI assistant with local model (Ollama)  
✅ Knowledge base for customer responses (FAQ)  
✅ Supplier work automation  
✅ Employee training system  
✅ Vector search on your data  
✅ Significant time and resource savings  

> 💡 **Economic Impact**: See [AI Assistant](./ai-assistant.md) - detailed description of all capabilities and savings calculations.  

---

## ⏱️ Setup Time

- **Quick Setup**: 20-30 minutes (basic FAQ)
- **Full Setup**: 1-2 hours (all capabilities)

---

## Step 1: Installing and Running Ollama

### 1.1 Checking Ollama Status

1. Go to **Settings** → **Integrations** tab
2. Find the **"Ollama"** block and click **"Details"**
3. Check connection status:
   - ✅ **"Ollama is running"** — ready, proceed to step 1.3
   - ❌ **"Ollama API not responding"** — proceed to step 1.2

### 1.2 Starting Ollama (if not running)

If Ollama is not running, execute in terminal:

```bash
# For Docker (recommended)
docker-compose up -d ollama

# Or locally
ollama serve
```

Refresh the page and check status again.

### 1.3 Installing AI Model

1. In the **Ollama** section, click **"Install Model"**
2. Select model:
   - **qwen2.5:7b** (recommended) — for Russian, 4.7 GB
   - **llama2:7b** — for English, 3.8 GB
   - **mistral:7b** — universal, 4.1 GB
3. Click **"Install"**
4. Wait for download to complete (5-10 minutes depending on internet speed)

> 💡 **Tip**: Model downloads once and is stored locally

### 1.4 Installing Embedding Model

1. In the same section, find **"Install Embedding Model"**
2. Select model:
   - **mxbai-embed-large:latest** (recommended) — 670 MB
   - **nomic-embed-text:latest** — alternative, 274 MB
3. Click **"Install"**

> ⚠️ **Important**: Embedding model is needed for vector search (RAG)

---

## Step 2: Creating Knowledge Base (Spreadsheets)

### 2.1 Creating FAQ Table

1. Go to **Tables** (in main menu)
2. Click **"+ Create Table"**
3. Fill in:
   - **Name**: `FAQ - Frequently Asked Questions`
   - **Description**: `Knowledge base for AI assistant customer service`
4. Click **"Create"**

### 2.2 Configuring Table Columns

Add the following columns:

#### Column 1: Question (required for RAG)

1. Click **"+ Add Column"**
2. Fill in:
   - **Name**: `Question`
   - **Type**: `Text`
   - **Purpose**: Select `Question for AI` ⭐
3. Click **"Save"**

> ⚠️ **Critical**: Must select purpose "Question for AI" — this field will be indexed for vector search

#### Column 2: Answer (required for RAG)

1. Click **"+ Add Column"**
2. Fill in:
   - **Name**: `Answer`
   - **Type**: `Text`
   - **Purpose**: Select `AI Answer` ⭐
3. Click **"Save"**

#### Column 3: Product (optional, for filtering)

1. Click **"+ Add Column"**
2. Fill in:
   - **Name**: `Product`
   - **Type**: `Multiple Choice`
   - **Options**: `Basic`, `Premium`, `Corporate`
   - **Purpose**: Select `Product Filter`
3. Click **"Save"**

#### Column 4: Tags (optional, for categorization)

1. Click **"+ Add Column"**
2. Fill in:
   - **Name**: `Tags`
   - **Type**: `Multiple Choice`
   - **Options**: `Payment`, `Delivery`, `Return`, `Warranty`, `Support`
   - **Purpose**: Select `User Tags`
3. Click **"Save"**

#### Column 5: Priority (optional)

1. Click **"+ Add Column"**
2. Fill in:
   - **Name**: `Priority`
   - **Type**: `Number`
   - **Purpose**: Select `Priority`
3. Click **"Save"**

> 💡 **Tip**: Questions with higher priority will be shown to AI first

### 2.3 Filling Knowledge Base

Add typical questions and answers:

**Example 1: Payment**

| Question | Answer | Product | Tags | Priority |
|----------|--------|---------|------|----------|
| How to pay for order? | We accept payment by bank card, PayPal, or bank transfer. Choose convenient method when placing order. | All | Payment | 10 |
| Can I pay in installments? | Yes, for orders from 50,000₽ installment plan available for 3, 6 or 12 months without overpayment. | Premium, Corporate | Payment | 8 |

**Example 2: Delivery**

| Question | Answer | Product | Tags | Priority |
|----------|--------|---------|------|----------|
| How long does delivery take? | Standard delivery: 3-5 business days in Russia. Express delivery: 1-2 days in major cities. | All | Delivery | 10 |
| How much does delivery cost? | Free delivery for orders from 5,000₽. For orders less than 5,000₽ delivery cost is 300₽. | All | Delivery | 9 |

**Example 3: Return**

| Question | Answer | Product | Tags | Priority |
|----------|--------|---------|------|----------|
| How to return product? | Return possible within 14 days from receipt. Product must be in original packaging, with preserved appearance. Contact support to process return. | All | Return | 10 |
| When will money be returned? | Refund processed within 5-10 business days after product received at our warehouse. | All | Return | 8 |

> 💡 **Recommendation**: Add minimum 20-30 questions for quality AI work. More questions = more accurate answers!

### 2.4 Activating Table as AI Source

1. In top right corner of table, find **⚙️ Table Settings**
2. Enable toggle **"Use as AI Source"** ✅
3. Click **"Save"**

> ✅ **Done!** Table is now indexed for vector search

---

## Step 3: Configuring AI Provider (Ollama)

### 3.1 Opening Ollama Settings

1. Go to **Settings** → **Integrations**
2. Find **"Ollama"** block and click **"Details"**

### 3.2 Checking Base URL

1. Check **Base URL** field:
   - For Docker: `http://ollama:11434` ✅
   - For local: `http://localhost:11434`
2. If URL is incorrect, fix and click **"Save"**

### 3.3 Selecting Model

1. In **"Model (LLM)"** field, select installed model:
   - `qwen2.5:7b` (recommended for Russian)
2. In **"Embeddings Model"** field, select:
   - `mxbai-embed-large:latest`
3. Click **"Save"**

---

## Step 4: Configuring AI Assistant

### 4.1 Opening Assistant Settings

1. Go to **Settings** → **Integrations**
2. Find **"AI Assistant"** block and click **"Details"**

### 4.2 Configuring System Prompt

In **"System Prompt"** field, enter instructions for AI:

**Basic Prompt (to start)**:

```
You are a professional customer support assistant.

Rules:
1. Answer politely and professionally
2. Use information from knowledge base
3. If information not available — suggest contacting operator
4. Answer briefly and to the point
5. Always end with question "How else can I help?"
```

**Advanced Prompt (with personalization)**:

```
You are a professional customer support assistant for "Your Company Name".

About company:
- We are engaged in [brief business description]
- Our values: quality, reliability, customer focus

Communication style:
- Friendly but professional
- Address customer as "You"
- Use emojis moderately (1-2 per message)

Response rules:
1. MANDATORY: Answer ONLY in Russian. All questions and answers must be in Russian
2. First search answer in knowledge base (RAG)
3. If found — answer based on found information
4. If not found — honestly say and suggest operator help
5. Don't make up information about prices, terms, conditions
6. For complex questions suggest contacting manager

Always end with: "How else can I help? 😊"
```

### 4.3 Selecting Models

1. **LLM Model**: Select `qwen2.5:7b (ollama)`
2. **Embedding Model**: Select `mxbai-embed-large:latest (ollama)`

> 💡 **Tip**: Models automatically pulled from Ollama settings

> 📊 **Context Window Size**: 
> - **Qwen2.5:7b**: Base context = **32,768 tokens** (~24,000 Russian words)
> - Total data sent to model:
>   - System prompt: ~500-2000 characters (~300-1200 tokens)
>   - Conversation history: up to 20 messages (~100-500 tokens per message = ~2000-10000 tokens)
>   - RAG context: ~500-2000 tokens (from found data)
>   - Current question: ~50-200 tokens
>   - **Total**: approximately 3,000-15,000 tokens (sufficient reserve)
> - If larger context needed → use Qwen3 with YaRN (up to 131K tokens)

### 4.4 Selecting RAG Table

1. In **"Selected RAG Tables"** field, select created table:
   - `FAQ - Frequently Asked Questions`
2. Click **"Save"**

### 4.5 Configuring AI Rules

Create rule set for managing AI behavior:

1. Click **"Create"** button next to "Rule Set" field
2. In modal window, fill in:

**Name**: `Hybrid Mode (RAG + Generation)`

**Description**: `AI first searches knowledge base, if not found — generates answer`

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
4. Select created rule in dropdown

> 💡 **What parameters mean**:
> - `checkUserTags: true` — consider user tags when searching
> - `searchRagFirst: true` — first search knowledge base
> - `generateIfNoRag: true` — generate answer if nothing found
> - `temperature: 0.7` — balance between accuracy and creativity (0.0-1.0)
> - `maxTokens: 500` — maximum answer length

### 4.6 RAG Search Settings

Expand **"🔍 RAG Search Settings"** section:

**Basic Settings:**
1. **Search Method**: Select `Hybrid Search` (recommended)
2. **Maximum Results**: `5`
3. **Relevance Threshold**: `0.1` (from 0.01 to 1.0)

**Keyword Extraction:**
1. ✅ **Enable Keyword Extraction**
2. **Minimum Word Length**: `3`
3. **Maximum Keywords**: `10`
4. ✅ **Remove Stop Words**

**Search Weights (for hybrid):**
1. **Semantic Search**: `70%` (accuracy)
2. **Keyword Search**: `30%` (speed)

**Additional Settings:**
1. ✅ **Fuzzy Search** (for typos)
2. ✅ **Word Stemming** (finds different word forms)
3. ☐ **Synonym Search** (currently disabled)

### 4.7 Saving Settings

Click **"Save"** button at bottom of form.

---

## Step 5: Testing AI Assistant

### 5.1 Using Built-in Tester

1. On AI assistant settings page, scroll down to **"🔍 System Monitoring"** block
2. In **"🧠 RAG Functionality Test"** section:
   - Ensure table `FAQ - Frequently Asked Questions` is selected
   - Enter test question: `How to pay for order?`
   - Click **"Test RAG"**
3. Observe process:
   - 🔍 Searching answer in knowledge base... (vector search)
   - 🤖 Generating answer with AI... (LLM generation)
   - ✅ Done!
4. Check result:
   - Answer from your table should be displayed
   - Score (similarity score): closer to 0 is better

> 💡 **Good Score**: from -300 to 0 (answer found)  
> ⚠️ **Bad Score**: greater than 300 (answer not found, AI will make up its own)

### 5.2 Testing via Web Chat

1. Go to application main page
2. Find **"💬 Chat with AI"** widget (usually bottom right)
3. Click widget to open chat
4. Enter question: `How much does delivery cost?`
5. Check AI response

**Expected Result:**
```
🤖 AI Assistant:
Free delivery for orders from 5,000₽. 
For orders less than 5,000₽ delivery cost is 300₽.

How else can I help? 😊
```

### 5.3 Testing Different Scenarios

Try asking various questions:

**✅ Question from knowledge base:**
```
User: "How to return product?"
AI: [Answer from FAQ table]
```

**⚠️ Question NOT from knowledge base:**
```
User: "What's the weather today?"
AI: "Sorry, I specialize in questions about our company and products. 
     For weather questions, please contact specialized services. 
     How else can I help?"
```

**🎯 Question with typo:**
```
User: "How to pay for order?" (typo)
AI: [Will find correct answer thanks to fuzzy search]
```

---

## Step 6: Advanced Capabilities (Optional)

### 6.1 Creating Supplier Table

#### "Supplier Database" Table Structure

1. Create new table: `Supplier Database`
2. Add columns:

| Column | Type | Description |
|--------|------|-------------|
| Company Name | Text | Supplier name |
| Product Category | Multiple Choice | Electronics, Furniture, Clothing, etc. |
| Contact Person | Text | Manager name |
| Email | Text | Email address |
| Phone | Text | Contact phone |
| Prices | Text | Price list (brief description) |
| Payment Terms | Text | Deferred payment, prepayment, etc. |
| Minimum Order | Number | Minimum order amount |
| Delivery Time | Text | Delivery terms |
| Rating | Number | Rating from 1 to 10 |
| Notes | Text | Additional information |

3. Activate as AI source
4. Fill with your supplier data

#### Prompt for AI Purchaser

Add to system prompt:

```
ADDITIONALLY - Working with Suppliers:

When user asks about suppliers:
1. Search in "Supplier Database" base
2. Filter by product category
3. Sort by rating and terms
4. Provide TOP-3 recommendations

Response format:
🏆 TOP-3 suppliers for "[category]":

1. [Name] ⭐ [Rating]/10
   📧 [Email] | 📞 [Phone]
   💰 Terms: [Payment Terms]
   🚚 Delivery: [Delivery Time]
   📦 Minimum: [Minimum Order]₽

2. ...
3. ...

I recommend contacting [First Supplier Name] — best terms.
```

### 6.2 Creating Employee Training Table

#### "Employee Knowledge Base" Table Structure

1. Create new table: `Employee Knowledge Base`
2. Add columns:

| Column | Type | Description |
|--------|------|-------------|
| Question | Text | Employee question (purpose: Question for AI) |
| Answer | Text | Detailed answer (purpose: AI Answer) |
| Category | Multiple Choice | Sales, HR, Finance, IT, Marketing |
| Department | Multiple Choice | Which department it's relevant for |
| Difficulty | Number | From 1 (simple) to 5 (complex) |
| Instructions | Text | Step-by-step instructions (if any) |
| Links | Text | Links to documents/videos |
| Update Date | Date | When information was updated |

3. Example questions:

**"Sales" Category:**
- "How to process customer return?"
- "What discounts can be given to regular customers?"
- "How to work with corporate customers?"

**"HR" Category:**
- "How to apply for vacation?"
- "Where to contact for sick leave?"
- "How does new employee onboarding work?"

**"IT" Category:**
- "How to get access to corporate email?"
- "What to do with VPN problems?"
- "How to create support ticket?"

### 6.3 Creating Table Relationships

#### Example: "Customers" → "Orders" Relationship

1. Create **"Customers"** table:
   - Name, Email, Phone, Status (VIP/Regular)

2. Create **"Orders"** table:
   - Order Number, Date, Amount

3. In "Orders" table, add column:
   - **Name**: `Customer`
   - **Type**: `Relation`
   - **Related Table**: select `Customers`
   - **Display Field**: select `Name`

4. Add another column in "Orders":
   - **Name**: `Customer Email`
   - **Type**: `Lookup`
   - **Relation Through**: select `Customer` column
   - **Lookup Field**: select `Email`

**Result**: When selecting customer, their Email is automatically filled!

#### Using AI with Related Tables

AI automatically understands relationships and can answer questions:

```
User: "Show all orders for customer Ivanov"
AI: [Searches Orders table, filters by customer Ivanov]
```

---

## Step 7: Telegram and Email Integration (Optional)

### 7.1 Setting Up Telegram Bot

1. Go to **Settings** → **Integrations** → **Telegram**
2. Create bot via [@BotFather](https://t.me/botfather) in Telegram:
   - Send `/newbot`
   - Choose bot name and username
   - Copy **Bot Token**
3. In DLE settings, enter:
   - **Bot Token**: paste token from BotFather
   - **Bot Username**: your bot username (e.g., `@mycompany_bot`)
4. Click **"Save"**
5. In AI assistant settings, select this Telegram bot in **"Telegram Bot"** field

**Result**: AI will respond to Telegram messages!

### 7.2 Setting Up Email Integration

1. Go to **Settings** → **Integrations** → **Email**
2. Fill IMAP settings (for receiving emails):
   - **IMAP Host**: `imap.gmail.com` (for Gmail)
   - **IMAP Port**: `993`
   - **IMAP User**: your email
   - **IMAP Password**: app password (not main password!)
3. Fill SMTP settings (for sending emails):
   - **SMTP Host**: `smtp.gmail.com`
   - **SMTP Port**: `587`
   - **SMTP User**: your email
   - **SMTP Password**: app password
   - **From Email**: email for sending
4. Click **"Test IMAP"** and **"Test SMTP"** to verify
5. Click **"Save"**
6. In AI assistant settings, select this Email in **"Email Contact"** field

> ⚠️ **Important for Gmail**: Create "App Password" in Google security settings

**Result**: AI will automatically respond to incoming emails!

---

## Step 8: Monitoring and Optimization

### 8.1 Checking Service Status

1. Go to **Settings** → **Integrations** → **AI Assistant**
2. Scroll down to **"🔍 System Monitoring"**
3. Click **"🔄 Refresh Status"**
4. Check statuses:
   - 🟢 **Backend**: should be "Running"
   - 🟢 **Postgres**: should be "Running"
   - 🟢 **Ollama**: should show number of models
   - 🟢 **Vector Search**: should be "Running"

> ⚠️ If something is red (🔴) — see "Troubleshooting" section below

### 8.2 Analyzing Answer Quality

Regularly check AI answer quality:

1. **Score in RAG Tester**:
   - **-300 to 0** ✅ — excellent match
   - **0 to 300** ⚠️ — average match
   - **>300** ❌ — match not found

2. **If Score is Bad**:
   - Add more similar questions to table
   - Use different phrasings of same question
   - Increase relevance threshold (e.g., to 0.2)

### 8.3 Optimizing RAG Settings

Experiment with settings to improve results:

**For More Accurate Answers:**
```
Search Method: Semantic
Relevance Threshold: 0.05 (lower = stricter)
Weights: Semantic 100% / Keywords 0%
```

**For Faster Answers:**
```
Search Method: Keyword Search
Maximum Results: 3
```

**For Balance (Recommended):**
```
Search Method: Hybrid
Weights: Semantic 70% / Keywords 30%
Relevance Threshold: 0.1
```

---

## ✅ AI Assistant Ready to Work!

### What You Now Have

✅ **Local AI Assistant** without cloud dependency  
✅ **FAQ Knowledge Base** for customer responses  
✅ **Vector Search** for accurate answers  
✅ **Configured Rules** for AI behavior  
✅ **Monitoring System** for quality control  

### Economic Impact

With proper AI assistant setup, you will get:

✅ **Task Automation** - freeing time for strategy  
✅ **Improved Service Quality** - AI works 24/7 without fatigue  
✅ **Reduced Operating Costs** - less staff on routine tasks  
✅ **Faster Decision Making** - instant access to information  

> 💡 **Detailed Information**: See [AI Assistant - Complete Description](./ai-assistant.md#economic-impact) - detailed description of all capabilities, use cases, and savings calculations.

---

## 📚 Next Steps

### Expand AI Capabilities

1. **Add More Tables**:
   - Partner knowledge base
   - Employee instructions
   - Product catalog
   - Contact database

2. **Create Rules for Different Scenarios**:
   - Strict mode (RAG only) — for finance
   - Creative mode (more generation) — for marketing
   - Hybrid mode (balance) — for support

3. **Integrate with Other Systems**:
   - CRM (customer synchronization)
   - Warehouse system (inventory)
   - Accounting (invoices and payments)

### Train Your Team

1. Show employees how AI works
2. Explain how to add new questions to base
3. Establish regular knowledge base update process
4. Assign responsible person for AI answer quality

---

## 🆘 Troubleshooting

### Problem: Ollama Not Starting

**Symptoms**: Status "Ollama API not responding"

**Solution**:
```bash
# Check container
docker ps | grep ollama

# Restart
docker-compose restart ollama

# Check logs
docker-compose logs ollama
```

### Problem: AI Answers Inaccurately

**Symptoms**: Answers don't match knowledge base

**Solution**:
1. Check Score in tester (should be < 300)
2. Add more question variations to table
3. Decrease relevance threshold (e.g., to 0.05)
4. Check that columns have correct purposes ("Question for AI", "AI Answer")

### Problem: Vector Search Not Working

**Symptoms**: Vector Search status shows error

**Solution**:
1. Check if Embedding model is installed
2. Rebuild index: on table page click **"🔄 Rebuild Index"**
3. Check that table is activated as AI source

### Problem: AI Answers in Wrong Language

**Symptoms**: Answers in English instead of Russian

**Solution**:
1. Change system prompt, adding at start: `ALWAYS answer in Russian.`
2. Use `qwen2.5:7b` model instead of `llama2:7b`
3. In AI rules, set `"language": "ru"`

### Problem: Slow Responses

**Symptoms**: AI responds longer than 5-10 seconds

**Solution**:
1. Use smaller model (`mistral:7b` instead of `qwen2.5:14b`)
2. Decrease `maxResults` in RAG settings (e.g., to 3)
3. Disable "Synonym Search" in additional settings
4. Use SSD for storing models

---

## 📖 Additional Documentation

### Learn AI Capabilities

- 🤖 **[AI Assistant - Complete Description](./ai-assistant.md)** - all capabilities and use cases
- 📊 **[Spreadsheet System](./tables-system.md)** - technical description of tables (temporary)
- ⚙️ **[AI Configuration](./setup-ai-assistant.md#technical-documentation-for-developers)** - technical setup details

### General Documentation

- 🛡️ **[Security](./security.md)** - how AI protects your data
- 💼 **[Blockchain for Business](./blockchain-for-business.md)** - AI integration with blockchain
- 📋 **[FAQ](./FAQ.md)** - frequently asked questions

### Support

- 💬 **Support Chat**: https://hb3-accelerator.com/
- 📧 **Email**: info@hb3-accelerator.com
- 📚 **Knowledge Base**: https://hb3-accelerator.com

---

## 🔧 Technical Documentation (for Developers)

### AI System Architecture

```
┌───────────────────────────────────────────────────────────┐
│          AI Assistant Configuration in DLE                │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  🤖 AI Providers:                                        │
│     ├── OpenAI (GPT-4, GPT-3.5)                          │
│     ├── Anthropic (Claude)                               │
│     ├── Google (Gemini)                                  │
│     └── Ollama (local models)                            │
│                                                           │
│  ⚙️  AI Settings:                                        │
│     ├── System Prompt                                    │
│     ├── LLM Model Selection                              │
│     ├── Embedding Model Selection                        │
│     ├── RAG Table Selection                              │
│     ├── Rules                                            │
│     └── RAG Search Settings                              │
│                                                           │
│  📋 Rules:                                                │
│     ├── JSON behavior configuration                      │
│     ├── Create/edit/delete                              │
│     └── Link to AI assistant                            │
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
    rules_id INTEGER REFERENCES ai_assistant_rules(id),  -- Rule reference
    telegram_settings_id INTEGER,         -- Telegram bot reference
    email_settings_id INTEGER,            -- Email settings reference
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

#### AI Provider Settings

- **GET** `/settings/ai-settings/:provider` — Get provider settings
- **PUT** `/settings/ai-settings/:provider` — Save provider settings
- **DELETE** `/settings/ai-settings/:provider` — Delete provider settings
- **GET** `/settings/ai-settings/:provider/models` — Get model list
- **POST** `/settings/ai-settings/:provider/verify` — Verify API key

#### AI Assistant Settings

- **GET** `/settings/ai-assistant` — Get assistant settings
- **PUT** `/settings/ai-assistant` — Save assistant settings

#### AI Rules

- **GET** `/settings/ai-assistant-rules` — Get all rules
- **GET** `/settings/ai-assistant-rules/:id` — Get rule by ID
- **POST** `/settings/ai-assistant-rules` — Create rule
- **PUT** `/settings/ai-assistant-rules/:id` — Update rule
- **DELETE** `/settings/ai-assistant-rules/:id` — Delete rule

#### Ollama (Local Models)

- **GET** `/ollama/status` — Check Ollama status
- **GET** `/ollama/models` — Get model list
- **POST** `/ollama/install` — Install model
- **DELETE** `/ollama/models/:modelName` — Delete model

### Frontend Pages

- **`/settings/ai`** — Main integrations page
- **`/settings/ai/:provider`** — AI provider settings
- **`/settings/ai/assistant`** — AI assistant settings

### Message Processing Flow

```
1. User → Message
              ↓
2. UnifiedMessageProcessor
              ↓
3. Language Check (Russian only)
              ↓
4. Deduplication (message hash)
              ↓
5. Load Settings (aiAssistantSettingsService)
              ↓
6. Load Rules (aiAssistantRulesService)
              ↓
7. RAG Search (ragService)
   ├── Semantic Search (vector search)
   ├── Keyword Search
   └── Hybrid Search
              ↓
8. Generate Answer (generateLLMResponse)
   ├── System Prompt
   ├── Conversation History
   ├── RAG Context
   └── Rules
              ↓
9. Answer → User
```

### Security

- **Encryption**: All sensitive fields encrypted with AES-256
- **Access Rights**: Only administrators can change settings
- **Validation**: All input data and API keys validated

---

**© 2024-2025 Tarabanov Alexander Viktorovich. All rights reserved.**

**Document Version**: 1.0.0  
**Creation Date**: October 25, 2025

