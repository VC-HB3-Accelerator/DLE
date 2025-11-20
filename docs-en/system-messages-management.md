# Technical Specification: System Messages Management

## 1. Goal and Context
- Provide managed display of system messages on the main page (`/`, component `HomeView.vue`) and add an administrative interface for their creation and moderation in the content section (`/content`, component `ContentListView.vue`).
- System messages must support "draft" and "published" statuses, be stored in the database, and be accessible via REST API.

## 2. Current State
- The main page is built by component `HomeView.vue` and displays the assistant chat (`ChatInterface.vue`), in which system messages (`Message.vue`) are highlighted by the `message.role === 'system'` attribute.
- The content section (`ContentListView.vue`) contains navigation cards: "Create Page", "Templates", "Public", "Settings", "Internal". Cards lead to existing routes `content-create`, `content-templates`, `content-published`, `content-settings`, `content-internal`.
- The project lacks entities and API for system messages; current `pagesService.js` works only with pages (`/pages`).

## 3. New User Scenarios
- **Viewing System Messages (main page, `/`):**
  - Published system messages are loaded into the assistant chat and displayed as collapsed cards with clickable headers.
  - When clicking the header, the message expands: the chat feed displays the full message text **or** sends a pre-prepared response from the AI assistant (the "response" content is stored with the message and selected by the `reply_type` flag).
  - Messages must be explicitly marked as system (color, icon). When reopened, the user sees the last expansion state; local "read" memory is possible.
- **"System Messages" Section (`/content`):**
  - On the `/content` page, a new "System Messages" card appears with a "Details" button. Navigation leads to a page with a user table (`/content/system-messages/table`), built on existing table components (see `UserTablesList.vue`), without a separate dashboard of cards.
  - The table displays system messages row by row, with multiple selection via checkboxes; available bulk actions: publish, unpublish, move to drafts, delete.
  - For each message, clicking "Details" (within the row) opens view/edit with a form (see below).
- **Create/Edit (`/content/system-messages/create`, `/content/system-messages/:id/edit`):**
  - Form with fields: title, brief description, main text (Markdown/HTML), response type (`inline` — show content, `assistant_reply` — send prepared assistant response), "Assistant Reply" field (active when `assistant_reply`), importance tag (info/warning/danger), publication start date (optional), end date (optional), flag for guest display.
  - Buttons: "Save as Draft", "Publish". When editing — "Update", "Unpublish", "Delete".
  - Validations: title and main text required (or assistant reply in corresponding mode); date validation (end ≥ start).
- **Working with System Messages Table:**
  - Columns: selection checkbox, title (clickable), status, response type, active period, target audience (guests/authenticated/all), creation date, author.
  - Bulk actions are performed for selected rows; single actions available via context menu/buttons in row (edit, publish, unpublish, delete).

## 4. Interface Requirements
- In `ContentListView.vue`, add "System Messages" card to the `management-blocks` grid with a `Details` button. The card design should match existing blocks (header, description, button).
- System messages table page:
  - Use `BaseLayout` and local styles (`scoped`).
  - Table supports sorting, filtering by status, and search by title.
  - Checkboxes in header and rows for bulk selection; action panel appears when selection exists.
  - "Create Message" button opens creation form.
- Create/Edit Form:
  - Rich-text (minimum Markdown) with preview and character/word counters.
  - Display mode toggle (`inline`/`assistant_reply`) with conditional display of "Assistant Reply" field (can use `<transition>`).
  - Field for icon/color selection by `severity` (static presets).
- Main Page:
  - System messages are displayed in the chat block as collapsed cards (`system-message-collapsed`). Clicking the header expands the card (`system-message-expanded`) or initiates assistant sending (UI shows "message from assistant").
  - For expanded messages, provide "Collapse" button and (optionally) "Mark as Read". Store state in `localStorage`.

## 5. Routing and Components
- Add routes in `router/index.js`:
-  - `/content/system-messages/table` → `SystemMessagesTableView.vue`
-  - `/content/system-messages/create` → `SystemMessageCreateView.vue`
-  - `/content/system-messages/:id` → `SystemMessageDetailsView.vue` (view)
-  - `/content/system-messages/:id/edit` → `SystemMessageEditView.vue`
- If needed for modal/nested routes, child routes or named views can be used.
- Create corresponding Vue components in `src/views/content/system-messages/` and a common set of reusable elements (table, form, filters, bulk actions) in `src/components/system-messages/`.
- Create service `src/services/systemMessagesService.js` with methods for the new API.

## 6. API and Data Requirements
- **New Table** `system_messages` (PostgreSQL):
  - `id` (uuid, pk)
  - `title` (text, not null)
  - `summary` (text, nullable)
  - `content` (text, not null)
  - `reply_type` (enum: inline, assistant_reply; default inline)
  - `assistant_reply_content` (text, nullable; required when `reply_type = assistant_reply`)
  - `severity` (enum: info, warning, danger; default info)
  - `status` (enum: draft, published; not null)
  - `visible_for` (enum: all, authenticated, guests; default all)
  - `publish_at` (timestamp, nullable)
  - `expire_at` (timestamp, nullable)
  - `created_at`, `updated_at`
  - `created_by`, `updated_by` (references users/identities, nullable)
  - `slug` (text, unique, for addressing by link if needed)
- **REST API (Express):**
  - `GET /system-messages` (pagination, filters by status, search)
  - `GET /system-messages/published` (filtering by date/audience; public)
  - `GET /system-messages/:id` (access only for authorized editors)
  - `POST /system-messages` (creation; `MANAGE_LEGAL_DOCS` permission)
  - `PATCH /system-messages/:id` (editing; status checks)
  - `DELETE /system-messages/:id` (soft delete or physical)
  - `POST /system-messages/:id/publish` and `POST /system-messages/:id/unpublish` (optional, if not using PATCH)
- All protected endpoints must require authorization and permissions (see `permissions.js`, `usePermissions`).
- Add new migration (`backend/scripts/run-migrations.js`) and ORM/SQL files in the project's existing format.
- Update logging and error handling `winston`, add input validation (e.g., `Joi` or custom).

## 7. Frontend Display Logic
- `HomeView.vue`:
  - On initialization, request published system messages (considering current audience) via `systemMessagesService.getPublished({ includeExpired: false })`.
  - Cache response in store or local state; when subscribing to WebSocket, can provide `system_message_updated` event.
  - Add expansion handler: on header click, either substitute full message text (`inline`), or initiate sending `assistant_reply_content` to chat (without user participation).
  - Add message hiding handler, saving identifier in `localStorage` and filtering locally.
- `ContentListView.vue`:
  - Add new "System Messages" card to the `management-blocks` grid, without breaking the adaptive grid (update `grid-template-columns` if needed).
- List Pages:
  - Implement pagination (lazy loading or regular), sorting by date.
  - For statuses, use color badges (info/warning/danger).
- Creation Form:
  - Support submit via `yarn lint`-friendly code; client-side validation (e.g., using `computed`/`watch`).
  - On successful publication, redirect to published list; when saving draft — stay on page with notification.

## 8. Security and Access Requirements
- Creation/editing scenarios available only to roles with `PERMISSIONS.MANAGE_LEGAL_DOCS`.
- Public list (`GET /system-messages/published`) filters by:
  - `status === 'published'`.
  - `publish_at <= now()` (or null).
  - `expire_at > now()` (or null).
  - `visible_for` is checked based on context (guest/authenticated).
- When issuing through chat, hide fields `created_by`, `updated_by`, internal tags.
- Consider CSRF, CORS, rate-limit (adopt config from existing routes).

## 9. Testing
- **Backend:**
  - Unit tests for CRUD in `tests/system-messages/*.test.js` (Mocha).
  - Check publish/expire filters and role-based access.
  - Test migration (rollback/apply).
- **Frontend:**
  - Vue unit tests (if configured) for main components (form, list).
  - E2E (if available) — scenario: create draft → publish → display on main page.
- **Regression Checks:**
  - Ensure existing content list and assistant chat continue to work without errors (`yarn lint`, `yarn test`).

## 10. Integration and DevOps
- Update `docker-compose.yml` if needed (e.g., add migrations to startup process).
- Ensure new environment variables (if any, e.g., message count limits) are documented in `README.md` and `setup-instruction.md`.
- Add seeding script (optional) for test system messages.

## 11. Open Questions
- Is publication history (auditing) needed? If yes — provide `system_messages_history` table.
- Is multilingual support required? (If absent — limit to one language, EN).
- Is WebSocket notification needed when new messages appear? (If yes — add event to `wsHub.js`).

## 12. Final Artifacts
- Backend: new routes, controllers, service, migration.
- Frontend: new pages and service, updated routes and components `HomeView`, `ContentListView`.
- Documentation: update `README.md` (launch section), `application-description.md` or `tables-system.md` when schemas change, this specification.

