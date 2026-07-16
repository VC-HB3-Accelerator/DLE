**English** | [Русский](../../docs.ru/back-docs/multi-agent-architecture.md)

# 🏗️ Multi-agent AI architecture in DLE

> **Concept**: Creating separate specialized agents for different tasks that use one local Ollama model, but with different system prompts, rules, and interfaces.

---

## 📋 Table of contents

1. [Architecture concept](#architecture-concept)
2. [Agent types](#agent-types)
3. [System architecture](#system-architecture)
4. [Agent configuration](#agent-configuration)
5. [Agent interfaces](#agent-interfaces)
6. [Knowledge base for agents](#knowledge-base-for-agents)
7. [Agent workflows](#agent-workflows)

---

## 🎯 Architecture concept

### Core principles

1. **One model, many agents**
   - All agents use one local Ollama model (qwen2.5:7b)
   - The difference between agents is in system prompts and rules
   - Each agent has its own specialization and role

2. **Agent isolation**
   - Each agent has its own settings (system prompt, rules, RAG tables)
   - Agents do not affect each other
   - Agents can be created, edited, and deleted independently

3. **Task specialization**
   - Support agent — answers user questions
   - Editor agent — creates content on request
   - Ability to create additional agents (analyst, translator, etc.)

4. **Separate interfaces**
   - Each agent has its own access interface
   - Interfaces are adapted to the agent’s tasks
   - Different access rights for different agents

---

## 🤖 Agent types

### 1. Support Agent

**Role**: Answer user messages

**Tasks**:
- Process incoming user messages
- Search for answers in the knowledge base (FAQ, documentation)
- Generate answers based on found information
- Escalate complex questions to operators

**Characteristics**:
- Uses RAG to search FAQ and documents
- System prompt: "You are a professional support assistant"
- Rules: strict mode (only from the knowledge base, minimal generation)
- Interface: embedded in chat (web, telegram, email)

**Knowledge base**:
- FAQ tables
- Product documentation
- Customer knowledge base

---

### 2. Content Editor Agent

**Role**: Create content on user request

**Tasks**:
- Create posts for social networks
- Write blog articles
- Generate email newsletters
- Create advertising copy

**Characteristics**:
- Uses RAG to search platform instructions and company style
- System prompt: "You are a professional content marketer and editor"
- Rules: creative mode (more generation, use of examples)
- Interface: separate "Content editor" page

**Knowledge base**:
- Platform instructions (VK, Telegram, Instagram, etc.)
- Company style (tone of voice, forbidden words)
- Content examples (references)
- Keywords and hashtags
- CTA blocks

---

### 3. Potential additional agents

**Analyst agent**:
- Data analysis and report creation
- Trend detection
- Forecasting

**Translator agent**:
- Content translation into different languages
- Material localization
- Adaptation to cultural specifics

**Purchaser agent**:
- Supplier search
- Terms analysis
- Selection recommendations

---

## 🏛️ System architecture

### System components

```
┌─────────────────────────────────────────────────────────┐
│              Shared Ollama model                         │
│              (qwen2.5:7b)                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├─────────────────┬───────────────────────┐
                 │                 │                       │
                 ↓                 ↓                       ↓
    ┌────────────────────┐  ┌──────────────────┐  ┌──────────────┐
    │  Support agent     │  │ Editor agent     │  │ Other agents │
    │                    │  │                  │  │              │
    │ • System prompt    │  │ • System         │  │ • Own        │
    │ • Rules (strict)   │  │   prompt         │  │   settings   │
    │ • RAG: FAQ         │  │ • Rules          │  │              │
    │ • Interface: chat  │  │   (creative)     │  │              │
    │                    │  │ • RAG: instructions│ │              │
    │                    │  │ • Interface:     │  │              │
    │                    │  │   editor         │  │              │
    └────────────────────┘  └──────────────────┘  └──────────────┘
```

### Storing agent settings

**Table `ai_agents`**:
- `id` — unique agent identifier
- `name` — agent name (for example, "Support Agent", "Editor Agent")
- `role` — agent role (support, content_editor, analyst, etc.)
- `description` — description of the agent’s purpose
- `system_prompt_encrypted` — system prompt (encrypted)
- `rules_id` — link to agent rules (from table `ai_assistant_rules`)
- `selected_rag_tables` — array of table IDs for RAG search
- `enabled_channels` — which channels are active (web, telegram, email)
- `interface_route` — route for the agent interface
- `permissions_required` — required access rights
- `is_active` — whether the agent is active
- `created_at`, `updated_at` — creation and update dates

**Link to rules**:
- Each agent can use a set of rules from `ai_assistant_rules`
- Rules define behavior: temperature, maxTokens, searchRagFirst, etc.
- Rules can be created specifically for each agent

**Link to RAG tables**:
- Each agent can use its own RAG tables
- Support agent: FAQ, documentation
- Editor agent: platform instructions, company style, examples

---

## ⚙️ Agent configuration

### Creating a new agent

**Step 1: Basic information**
- Agent name
- Role (support, content_editor, etc.)
- Purpose description

**Step 2: System prompt**
- Defines the agent’s role and behavior
- Specifies how the agent should work
- Contains context about the company and style

**Step 3: Rules**
- Create or select existing rules
- Configure generation parameters (temperature, maxTokens)
- Configure RAG behavior (searchRagFirst, generateIfNoRag)

**Step 4: Knowledge base (RAG tables)**
- Select tables for information search
- Support agent: FAQ, documentation
- Editor agent: instructions, style, examples

**Step 5: Interface**
- Define the route for agent access
- Configure access rights
- Select channels (web, telegram, email)

**Step 6: Activation**
- Enable/disable the agent
- Test the agent’s operation

### Configuration examples

**Support agent**:
- System prompt: "You are a professional support assistant..."
- Rules: strict mode (temperature: 0.3, searchRagFirst: true, generateIfNoRag: false)
- RAG tables: FAQ, Product documentation
- Interface: embedded in chat
- Channels: web, telegram, email

**Editor agent**:
- System prompt: "You are a professional content marketer and editor..."
- Rules: creative mode (temperature: 0.7, searchRagFirst: true, generateIfNoRag: true)
- RAG tables: Platform instructions, Company style, Content examples
- Interface: separate page /content-editor
- Channels: web only (for editors)

---

## 🖥️ Agent interfaces

### Support agent — chat interface

**Location**: Embedded in the main chat (HomeView)

**Features**:
- Automatic activation when a user message is received
- Show response generation status
- Ability to disable AI for a specific message
- Dialogue history with context

**Access rights**:
- Available to all users
- Automatically answers messages

---

### Editor agent — editor interface

**Location**: Separate page `/content-editor`

**Features**:
- Field for entering a content creation request
- Content type selection (VK post, blog article, email, etc.)
- Platform selection (VKontakte, Telegram, Instagram, etc.)
- Show generation process
- Edit generated content
- Save finished content
- History of created content

**Access rights**:
- Only for users with the Editor role
- Authorization required

**Interface functionality**:
1. **Request form**:
   - Text field for task description
   - Content type selection (dropdown)
   - Platform selection (checkboxes or dropdown)
   - Additional parameters (tone, length, keywords)

2. **Generation process**:
   - Loading indicator
   - Show found instructions
   - Show generation process

3. **Result**:
   - Finished content in an editable field
   - "Save" button
   - "Regenerate" button
   - "Export" button (copy, download)

4. **History**:
   - List of created content
   - Filters by type, platform, date
   - Ability to edit and delete

---

## 📚 Knowledge base for agents

### Knowledge base structure

**For the support agent**:
- "FAQ" table — frequently asked questions
- "Documentation" table — product feature descriptions
- "Customer knowledge base" table — extended information

**For the editor agent**:
- "Platform instructions" table — content placement rules
- "Company style" table — tone of voice, forbidden words
- "Content examples" table — references for different content types
- "Keywords" table — semantic core, hashtags
- "CTA blocks" table — calls to action

### How agents use the knowledge base

1. **RAG search**:
   - User asks a question/makes a request
   - Agent performs vector search in its RAG tables
   - Finds relevant information

2. **Context for generation**:
   - Found information is passed to the LLM as context
   - LLM generates an answer/content based on the context
   - The system prompt guides how to use the context

3. **Role-based filtering**:
   - Support agent searches only in FAQ and documentation
   - Editor agent searches only in instructions and examples
   - Data isolation between agents

---

## 🔄 Agent workflows

### Support agent — answer process

1. **Receiving a message**:
   - User sends a message in chat
   - System determines that the support agent should be used

2. **RAG search**:
   - Agent searches for an answer in its RAG tables (FAQ, documentation)
   - Uses vector search for semantic search

3. **Answer generation**:
   - If an answer is found in the knowledge base → uses it
   - If not found → in strict mode suggests contacting an operator
   - Generates an answer considering the system prompt and rules

4. **Sending the answer**:
   - Answer is sent to the user in chat
   - Saved in dialogue history

---

### Editor agent — content creation process

1. **Receiving a request**:
   - Editor opens the `/content-editor` interface
   - Enters a request: "Create a VKontakte post about the new feature"
   - Selects content type and platform

2. **RAG search for instructions**:
   - Agent searches for instructions for the selected platform
   - Searches for company style
   - Searches for examples of similar content
   - Searches for relevant keywords

3. **Content generation**:
   - Agent generates content based on:
     - System prompt (editor role)
     - Found platform instructions
     - Company style
     - Content examples
     - Keywords

4. **Result**:
   - Finished content is shown in the interface
   - Editor can edit the content
   - Save or export

---

## 🎯 Architecture advantages

### 1. Specialization
- Each agent solves its task optimally
- No need to sacrifice quality for universality

### 2. Flexibility
- Easy to create new agents for new tasks
- Each agent can be configured independently

### 3. Isolation
- Agents do not interfere with each other
- Agents can be tested and updated independently

### 4. Scalability
- Easy to add new agents
- Each agent uses one model, no overload

### 5. Control
- Clear separation of responsibility
- Easy to track which agent does what

---

## 📊 Comparison with a single agent

| Characteristic | Single agent | Multiple agents |
|----------------|--------------|----------------------|
| **Specialization** | Universal, but less precise | Specialized, more precise |
| **Configuration** | One settings set for all tasks | Separate settings for each task |
| **Knowledge base** | All tables for all tasks | Isolated tables for each task |
| **Interface** | One interface | Separate interfaces for each task |
| **Flexibility** | Hard to adapt to different tasks | Easy to create new agents |
| **Performance** | One model for everything | One model, but different prompts |

---

## 🚀 Next steps

1. **Create the `ai_agents` table** in the database
2. **Create a service for agent management**
3. **Modify AI Assistant to work with multiple agents**
4. **Create the editor agent interface**
5. **Configure the support agent (already exists, needs adaptation)**
6. **Create a knowledge base for the editor agent**
7. **Test both agents**

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated**: January 2026
