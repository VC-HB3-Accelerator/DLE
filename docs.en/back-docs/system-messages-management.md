**English** | [Русский](../../docs.ru/back-docs/system-messages-management.md)

# Technical Specification: System Messages Management

## 1. Goal and context

- Manage display of system messages on the home page (`/`, `HomeView.vue`) and provide an admin UI for creating and moderating them in Content (`/content`, `ContentListView.vue`).
- System messages support statuses “draft” and “published”, are stored in the database, and exposed via REST API.

## 2. Current state

- Home is built by `HomeView.vue` with assistant chat (`ChatInterface.vue`); system messages are those with `message.role === 'system'` (`Message.vue`).
- Content (`ContentListView.vue`) has cards: Create page, Templates, Published, Settings, Internal. No entity or API for system messages yet; `pagesService.js` only handles pages (`/pages`).

## 3. User scenarios

- **View on home (/):** Published system messages loaded into assistant chat as collapsible cards with clickable title. On click: expand to show full text **or** send a prepared AI assistant reply (content stored with message, chosen by `reply_type`). Messages visually marked as system; optional “read” state in localStorage.
- **Content section:** New card “System messages” with “Details” → `/content/system-messages/table` (user table, no separate dashboard). Table: rows per message, checkboxes for bulk: publish, unpublish, move to draft, delete. Row “Details” → view/edit form.
- **Create/Edit:** Routes `/content/system-messages/create`, `/content/system-messages/:id/edit`. Form: title, summary, main content (Markdown/HTML), reply type (`inline` | `assistant_reply`), assistant reply content (when `assistant_reply`), severity (info/warning/danger), publish_at, expire_at, visible to guests. Buttons: Save as draft, Publish; on edit: Update, Unpublish, Delete. Validation: title and main content (or assistant reply when applicable) required; expire_at ≥ publish_at.

## 4. UI requirements

- In `ContentListView.vue` add “System messages” card to `management-blocks`.
- Table page: BaseLayout, scoped styles; sort, filter by status, search by title; header and row checkboxes; action bar when selection exists; “Create message” opens create form.
- Form: rich text (at least Markdown), preview, character/word count; reply type switch with conditional “Assistant reply” field; severity presets (icon/color).

## 5. Routing and components

- Routes: `/content/system-messages/table` → SystemMessagesTableView; `/content/system-messages/create` → SystemMessageCreateView; `/content/system-messages/:id` → SystemMessageDetailsView; `/content/system-messages/:id/edit` → SystemMessageEditView.
- Components under `src/views/content/system-messages/` and shared in `src/components/system-messages/`.
- Service: `src/services/systemMessagesService.js`.

## 6. API and data

- **Table** `system_messages`: id (uuid), title, summary, content, reply_type (inline | assistant_reply), assistant_reply_content, severity (info | warning | danger), status (draft | published), visible_for (all | authenticated | guests), publish_at, expire_at, created_at, updated_at, created_by, updated_by, slug.
- **REST:** GET /system-messages (pagination, filters), GET /system-messages/published (public, by date/audience), GET /system-messages/:id (editors), POST, PATCH, DELETE; optional POST publish/unpublish.
- Auth and permission (e.g. MANAGE_LEGAL_DOCS) on protected endpoints. New migration, validation (e.g. Joi), logging (winston).

## 7. Frontend logic

- **HomeView:** On load, fetch published messages (by audience) via `systemMessagesService.getPublished({ includeExpired: false })`; cache; on expand either show content (inline) or trigger sending assistant_reply_content; optional “read” in localStorage.
- **ContentListView:** Add “System messages” card.
- List: pagination, sort by date, status badges.
- Form: client-side validation; on publish redirect to list; on draft save stay with notification.

## 8. Security and access

- Create/edit for roles with PERMISSIONS.MANAGE_LEGAL_DOCS.
- GET /system-messages/published: filter by status=published, publish_at ≤ now, expire_at > now (or null), visible_for by guest/auth.
- In chat response hide created_by, updated_by, internal fields. CSRF, CORS, rate-limit as in existing routes.

## 9. Testing

- Backend: CRUD tests in tests/system-messages/*.test.js (Mocha); filters and role access; migration rollback/apply.
- Frontend: unit tests for form and list if present; E2E: draft → publish → visible on home.
- Regression: existing content list and assistant chat still work; `yarn lint`, `yarn test`.

## 10. Integration and DevOps

- Update docker-compose if needed (e.g. migrations on startup). Document new env vars in README and setup-instruction. Optional seed script for test messages.

## 11. Open points

- Audit history (system_messages_history)? Multi-language? WebSocket event for new messages (wsHub)?

## 12. Deliverables

Backend: routes, controllers, service, migration. Frontend: pages, service, updated routes, HomeView, ContentListView. Docs: README, application-description or tables-system if schemas change, this spec.
