**English** | [Русский](../../docs.ru/back-docs/system-messages-management.md)

# Technical specification: system messages management

## 1. Goal and context
- Provide controlled display of system messages on the home page (`/`, component `HomeView.vue`) and add an administrative interface for creating and moderating them in the content section (`/content`, component `ContentListView.vue`).
- System messages must support “draft” and “published” statuses, be stored in the database, and be available via REST API.

## 2. Current state
- The home page is built by the `HomeView.vue` component and displays the assistant chat (`ChatInterface.vue`), where system messages (`Message.vue`) are highlighted by `message.role === 'system'`.
- The content section (`ContentListView.vue`) contains navigation cards: “Create page”, “Templates”, “Public”, “Settings”, “Internal”. The cards lead to existing routes `content-create`, `content-templates`, `content-published`, `content-settings`, `content-internal`.
- The project has no entities or API for system messages; the current `pagesService.js` works only with pages (`/pages`).

## 3. New user scenarios
- **Viewing system messages (home, `/`):**
  - Published system messages are loaded into the assistant chat and shown as collapsed cards with a clickable title.
  - On title click the message expands: the chat feed shows the full message text **or** a prepared AI assistant reply is sent (the “reply” content is stored with the message and selected by the `reply_type` flag).
  - Messages must be clearly marked as system messages (color, icon). On reopen the user sees the last expanded state; local “read” memory is possible.
- **“System messages” section (`/content`):**
  - On the `/content` page a new “System messages” card appears with a “Details” button. Navigation leads to a page with a user table (`/content/system-messages/table`) built on already existing table components (see `UserTablesList.vue`), without a separate card dashboard.
  - The table shows system messages row by row, with multi-select via checkboxes; available bulk actions: publish, unpublish, move to drafts, delete.
  - For each message, clicking “Details” (inside the row) opens view/edit with a form (see below).
- **Create/edit (`/content/system-messages/create`, `/content/system-messages/:id/edit`):**
  - Form fields: title, short description, main text (Markdown/HTML), reply type (`inline` — show content, `assistant_reply` — send a prepared assistant reply), “Assistant reply” field (active when `assistant_reply`), importance tag (info/warning/danger), publish start date (optional), end date (optional), show-to-guests flag.
  - Buttons: “Save as draft”, “Publish”. When editing — “Update”, “Unpublish”, “Delete”.
  - Checks: title and main text are required (or assistant reply in the corresponding mode); date validation (end ≥ start).
- **Working with the system messages table:**
  - Columns: selection checkbox, title (clickable), status, reply type, validity period, target audience (guests/authenticated/all), creation date, author.
  - Bulk actions apply to selected rows; single actions are available via context menu/row buttons (edit, publish, unpublish, delete).

## 4. UI requirements
- In `ContentListView.vue`, add a “System messages” card with a `Details` button to the `management-blocks` grid. By design the card must match existing blocks (title, description, button).
- System messages table page:
  - Use `BaseLayout` and local styles (`scoped`).
  - The table supports sorting, status filtering, and title search.
  - Checkboxes in the header and rows for bulk selection; an action panel appears when a selection exists.
  - The “Create message” button opens the create form.
- Create/edit form:
  - Rich-text (at least Markdown) with preview and character/word counters.
  - Display mode switch (`inline`/`assistant_reply`) with conditional “Assistant reply” field (you can use `<transition>`).
  - Field for choosing icon/color by `importance` (static presets).
- Home page:
  - System messages are shown in the chat block as collapsed cards (`system-message-collapsed`). On title click the card expands (`system-message-expanded`) or initiates an assistant send (UI shows an “assistant message”).
  - For expanded messages provide a “Collapse” button and (optionally) “Mark as read”. Store state in `localStorage`.

## 5. Routing and components
- Add routes in `router/index.js`:
-  - `/content/system-messages/table` → `SystemMessagesTableView.vue`
-  - `/content/system-messages/create` → `SystemMessageCreateView.vue`
-  - `/content/system-messages/:id` → `SystemMessageDetailsView.vue` (view)
-  - `/content/system-messages/:id/edit` → `SystemMessageEditView.vue`
- If needed for modal/nested routes, child routes or named views can be used.
- Create the corresponding Vue components in `src/views/content/system-messages/` and a shared set of reusable elements (table, form, filters, bulk actions) in `src/components/system-messages/`.
- Create the service `src/services/systemMessagesService.js` with methods for the new API.

## 6. API and data requirements
- **New table** `system_messages` (PostgreSQL):
  - `id` (uuid, pk)
  - `title` (text, not null)
  - `summary` (text, nullable)
  - `content` (text, not null)
  - `reply_type` (enum: inline, assistant_reply; default inline)
  - `assistant_reply_content` (text, nullable; required when `reply_type = assistant_reply`)
  - `importance` (enum: info, warning, danger; default info)
  - `status` (enum: draft, published; not null)
  - `visible_for` (enum: all, authenticated, guests; default all)
  - `publish_at` (timestamp, nullable)
  - `expire_at` (timestamp, nullable)
  - `created_at`, `updated_at`
  - `created_by`, `updated_by` (references users/identities, nullable)
  - `slug` (text, unique, for link addressing when needed)
- **REST API (Express):**
  - `GET /system-messages` (pagination, status filters, search)
  - `GET /system-messages/published` (filter by date/audience; public)
  - `GET /system-messages/:id` (access only for authorized editors)
  - `POST /system-messages` (create; permission `MANAGE_LEGAL_DOCS`)
  - `PATCH /system-messages/:id` (edit; status checks)
  - `DELETE /system-messages/:id` (soft or hard delete)
  - `POST /system-messages/:id/publish` and `POST /system-messages/:id/unpublish` (optional, if not using PATCH)
- All protected endpoints must require authorization and permissions (see `permissions.js`, `usePermissions`).
- Add a new migration (`backend/scripts/run-migrations.js`) and ORM/SQL files in the project’s existing format.
- Update `winston` logging and error handling; add input validation (for example, `Joi` or custom).

## 7. Frontend display logic
- `HomeView.vue`:
  - On init, request published system messages (considering the current audience) via `systemMessagesService.getPublished({ includeExpired: false })`.
  - Cache the response in a store or local state; with WebSocket subscription, a `system_message_updated` event can be provided.
  - Add an expand handler: on title click either insert the full message text (`inline`) or initiate sending `assistant_reply_content` into the chat (without user action).
  - Add a hide-message handler that saves the id in `localStorage` and filters locally.
- `ContentListView.vue`:
  - Add a new “System messages” card to the `management-blocks` grid without breaking the responsive grid (update `grid-template-columns` if needed).
- List pages:
  - Implement pagination (lazy loading or regular), sort by date.
  - Use color badges for statuses (info/warning/danger).
- Create form:
  - Support submit via `yarn lint`-friendly code; client-side validation (for example, using `computed`/`watch`).
  - On successful publish, redirect to the published list; on draft save — stay on the page with a notification.

## 8. Security and access requirements
- Create/change scenarios are available only to roles with `PERMISSIONS.MANAGE_LEGAL_DOCS`.
- The public list (`GET /system-messages/published`) filters by:
  - `status === 'published'`.
  - `publish_at <= now()` (or null).
  - `expire_at > now()` (or null).
  - `visible_for` checked based on context (guest/authenticated).
- When serving via chat, hide `created_by`, `updated_by`, and internal labels.
- Account for CSRF, CORS, rate-limit (reuse config from existing routes).

## 9. Testing
- **Backend:**
  - Unit tests for CRUD in `tests/system-messages/*.test.js` (Mocha).
  - Check publish/expire filters and role-based access.
  - Migration test (rollback/apply).
- **Frontend:**
  - Vue unit tests (if configured) for main components (form, list).
  - E2E (if available) — scenario: create draft → publish → display on home.
- **Regression checks:**
  - Ensure the existing content list and assistant chat continue to work without errors (`yarn lint`, `yarn test`).

## 10. Integration and DevOps
- Update `docker-compose.yml` if needed (for example, add migrations to the startup process).
- Ensure any new environment variables (if added, for example message count limits) are documented in `README.md` and `setup-instruction.md`.
- Add a seeding script (optional) for test system messages.

## 11. Open questions
- Is publication history (auditing) needed? If yes — provide a `system_messages_history` table.
- Is multilingual support required? (If not — limit to one language, EN).
- Is WebSocket notification needed when new messages appear? (If yes — add an event in `wsHub.js`).

## 12. Final artifacts
- Backend: new routes, controllers, service, migration.
- Frontend: new pages and service, updated routes and `HomeView`, `ContentListView` components.
- Documentation: update `README.md` (run section), `tables-system.md` when schemas change, this specification.
