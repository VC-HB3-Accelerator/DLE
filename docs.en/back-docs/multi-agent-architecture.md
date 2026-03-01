**English** | [Русский](../../docs.ru/back-docs/multi-agent-architecture.md)

# Multi-Agent AI Architecture in DLE

> **Concept:** Separate specialized agents for different tasks, using one local Ollama model with different system prompts, rules, and interfaces.

---

## Table of Contents

1. [Architecture concept](#architecture-concept)
2. [Agent types](#agent-types)
3. [System architecture](#system-architecture)
4. [Agent configuration](#agent-configuration)
5. [Agent interfaces](#agent-interfaces)
6. [Knowledge base](#knowledge-base)
7. [Agent workflow](#agent-workflow)

---

## Architecture concept

### Principles

1. **One model, many agents** — all use one Ollama instance (e.g. qwen2.5:7b); differentiation by prompts and rules.
2. **Isolation** — each agent has its own prompt, rules, RAG tables, channels, route, permissions.
3. **Task specialization** — support (user Q&A), content editor (posts, articles), others (analyst, translator, procurement).
4. **Separate interfaces** — each agent has its own UI and access path.

---

## Agent types

### 1. Support agent

**Role:** Answer user messages. Uses RAG (FAQ, docs), strict mode (minimal generation), system prompt “professional support assistant”. Interface: chat (web, Telegram, email). Knowledge: FAQ, product docs, client knowledge base.

### 2. Content editor agent

**Role:** Create content on request. RAG: platform instructions, company style, examples. Creative mode. System prompt “content marketer and editor”. Interface: `/content-editor` page. Knowledge: platform instructions, style, examples, keywords, CTAs.

### 3. Other possible agents

Analyst (reports, trends), Translator (localization), Procurement (suppliers, terms).

---

## System architecture

Single Ollama model → multiple agents (Support, Content editor, Others), each with own prompt, rules, RAG, interface.

**Storage:** table `ai_agents` — id, name, role, description, system_prompt_encrypted, rules_id, selected_rag_tables, enabled_channels, interface_route, permissions_required, is_active. Links to `ai_assistant_rules` and RAG tables.

---

## Agent configuration

Steps: (1) Basic info — name, role, description. (2) System prompt. (3) Rules (from or new). (4) RAG tables. (5) Interface — route, permissions, channels. (6) Activate and test.

Example: Support — strict (temperature 0.3, searchRagFirst, no generateIfNoRag), FAQ + docs, chat. Content editor — creative (0.7, generateIfNoRag), instructions + style + examples, `/content-editor`, web only.

---

## Agent interfaces

**Support:** embedded in main chat (HomeView); auto on message; expand/collapse; history.

**Content editor:** page `/content-editor` — request field, content type, platform, generate → edit → save/export, history. Editor role only.

---

## Knowledge base

Support: FAQ, Documentation, Client knowledge base. Content editor: Platform instructions, Company style, Content examples, Keywords, CTAs. RAG search → context → LLM; each agent only sees its own tables.

---

## Agent workflow

**Support:** message → RAG search (FAQ, docs) → if found use it, else suggest operator → send reply.

**Content editor:** request + type + platform → RAG (instructions, style, examples, keywords) → generate content → show in UI → edit/save/export.

---

## Advantages

Specialization, flexibility, isolation, scalability (one model, many agents), clear responsibility.

---

## Comparison: single vs multiple agents

| | Single agent | Multiple agents |
|--|--------------|-----------------|
| Specialization | General, less precise | Per-task, more precise |
| Configuration | One set for all | Per task |
| Knowledge base | Shared | Isolated per agent |
| Interface | One | Per agent |
| Flexibility | Harder to adapt | Easy to add agents |

---

## Next steps

1. Create `ai_agents` table  
2. Agent management service  
3. Adapt AI Assistant for multiple agents  
4. Content editor UI  
5. Support agent (adapt existing)  
6. Content editor knowledge base  
7. Test both agents  

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated:** January 2026
