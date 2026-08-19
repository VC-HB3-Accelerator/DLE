/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 *
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const db = require('../db');
const logger = require('../utils/logger');

const DEFAULT_AUDIENCE = {
  preset: 'guests_and_new_users',
  include_guests: true,
  include_authenticated: true,
  use_max_age: true,
  max_user_age_seconds: 3600,
  roles: [],
  tag_ids: [],
  tag_match: 'any',
  role_tag_logic: 'and',
};

const PRESET_DEFAULTS = {
  guests_only: {
    ...DEFAULT_AUDIENCE,
    preset: 'guests_only',
    include_guests: true,
    include_authenticated: false,
    use_max_age: false,
  },
  guests_and_new_users: { ...DEFAULT_AUDIENCE },
  users_by_tags: {
    ...DEFAULT_AUDIENCE,
    preset: 'users_by_tags',
    include_guests: false,
    include_authenticated: true,
    use_max_age: false,
  },
  users_by_roles: {
    ...DEFAULT_AUDIENCE,
    preset: 'users_by_roles',
    include_guests: false,
    include_authenticated: true,
    use_max_age: false,
  },
  users_by_tags_and_roles: {
    ...DEFAULT_AUDIENCE,
    preset: 'users_by_tags_and_roles',
    include_guests: false,
    include_authenticated: true,
    use_max_age: false,
    role_tag_logic: 'and',
  },
  custom: {
    ...DEFAULT_AUDIENCE,
    preset: 'custom',
  },
};

function normalizeAudience(raw, maxUserAgeSeconds) {
  const base = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...DEFAULT_AUDIENCE, ...raw }
    : { ...DEFAULT_AUDIENCE };
  if (maxUserAgeSeconds != null && Number.isFinite(Number(maxUserAgeSeconds))) {
    base.max_user_age_seconds = Number(maxUserAgeSeconds);
  }
  base.roles = Array.isArray(base.roles) ? base.roles.map(String) : [];
  base.tag_ids = Array.isArray(base.tag_ids)
    ? [...new Set(base.tag_ids.map((id) => parseInt(id, 10)).filter((n) => n > 0))]
    : [];
  base.tag_match = base.tag_match === 'all' ? 'all' : 'any';
  base.role_tag_logic = base.role_tag_logic === 'or' ? 'or' : 'and';
  base.include_guests = Boolean(base.include_guests);
  base.include_authenticated = Boolean(base.include_authenticated);
  base.use_max_age = Boolean(base.use_max_age);
  return base;
}

function normalizeChannels(raw) {
  const allowed = new Set(['web', 'telegram', 'email']);
  let list = raw;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch (_) {
      list = ['web'];
    }
  }
  if (!Array.isArray(list)) list = ['web', 'telegram', 'email'];
  const out = [...new Set(list.map(String).filter((c) => allowed.has(c)))];
  return out.length ? out : ['web'];
}

function normalizeI18n(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ru: { title: '', summary: '', content: '', branches: [] } };
  }
  const out = {};
  for (const [locale, block] of Object.entries(raw)) {
    if (!block || typeof block !== 'object') continue;
    const branches = Array.isArray(block.branches)
      ? block.branches.map((b, idx) => {
          const ragHint = ['company', 'product', 'partner', 'investor'].includes(String(b.rag_hint || '').trim().toLowerCase())
            ? String(b.rag_hint).trim().toLowerCase()
            : null;
          return {
            id: String(b.id || `b${idx}`).slice(0, 64),
            ui: b.ui === 'text' ? 'text' : 'button',
            label: String(b.label || '').slice(0, 256),
            action: ['send_user_message', 'inline', 'assistant_reply'].includes(b.action)
              ? b.action
              : 'send_user_message',
            payload: String(b.payload != null ? b.payload : b.label || ''),
            ...(ragHint ? { rag_hint: ragHint } : {})
          };
        })
      : [];
    out[locale] = {
      title: String(block.title || ''),
      summary: String(block.summary || ''),
      content: String(block.content || ''),
      assistant_reply_content: block.assistant_reply_content != null
        ? String(block.assistant_reply_content)
        : null,
      branches,
    };
  }
  return out;
}

function pickLocale(i18n, locale, fallback = 'ru') {
  const map = i18n && typeof i18n === 'object' ? i18n : {};
  if (locale && map[locale]) return { locale, data: map[locale] };
  if (map[fallback]) return { locale: fallback, data: map[fallback] };
  const first = Object.keys(map)[0];
  return first ? { locale: first, data: map[first] } : { locale: fallback, data: null };
}

function visibleForFromAudience(audience) {
  const a = normalizeAudience(audience);
  return a.preset || 'custom';
}

function matchTags(userTagIds, requiredIds, mode) {
  if (!requiredIds.length) return true;
  const set = new Set(userTagIds);
  if (mode === 'all') return requiredIds.every((id) => set.has(id));
  return requiredIds.some((id) => set.has(id));
}

/**
 * @param {object} viewer { isGuest, userId, role, createdAt, tagIds }
 * @param {object} msg row with audience / max_user_age_seconds
 */
function shouldShowMessage(viewer, msg) {
  if (!msg || msg.status !== 'published') return false;
  const audience = normalizeAudience(msg.audience, msg.max_user_age_seconds);
  const now = Date.now();

  if (viewer?.isGuest) {
    return audience.include_guests === true;
  }

  if (!audience.include_authenticated) return false;

  if (audience.use_max_age) {
    const created = viewer.createdAt ? new Date(viewer.createdAt).getTime() : null;
    if (created == null || Number.isNaN(created)) return false;
    const ageSec = (now - created) / 1000;
    if (ageSec >= Number(audience.max_user_age_seconds || 3600)) return false;
  }

  const roles = audience.roles || [];
  const tagIds = audience.tag_ids || [];
  const rolesOk = !roles.length || roles.includes(String(viewer.role || 'user'));
  const tagsOk = matchTags(viewer.tagIds || [], tagIds, audience.tag_match);

  switch (audience.preset) {
    case 'guests_only':
      return false;
    case 'users_by_tags':
      return tagIds.length ? tagsOk : false;
    case 'users_by_roles':
      return roles.length ? rolesOk : false;
    case 'users_by_tags_and_roles':
    case 'custom': {
      if (!roles.length && !tagIds.length) {
        return true;
      }
      if (audience.role_tag_logic === 'or') {
        const r = roles.length ? rolesOk : false;
        const t = tagIds.length ? tagsOk : false;
        return r || t;
      }
      const r = roles.length ? rolesOk : true;
      const t = tagIds.length ? tagsOk : true;
      return r && t;
    }
    case 'guests_and_new_users':
    default:
      return true;
  }
}

function isChannelActive(msg, channel) {
  return normalizeChannels(msg.channels).includes(channel);
}

function isWithinSchedule(msg, now = new Date()) {
  if (msg.publish_at && new Date(msg.publish_at) > now) return false;
  if (msg.expire_at && new Date(msg.expire_at) <= now) return false;
  return true;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    channels: normalizeChannels(row.channels),
    reply_type: row.reply_type,
    importance: row.importance,
    status: row.status,
    visible_for: row.visible_for,
    audience: normalizeAudience(row.audience, row.max_user_age_seconds),
    max_user_age_seconds: row.max_user_age_seconds,
    persist_to_history: Boolean(row.persist_to_history),
    publish_at: row.publish_at,
    expire_at: row.expire_at,
    sort_order: row.sort_order,
    i18n: normalizeI18n(row.i18n),
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  };
}

async function listAll({ status } = {}) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE status = $${params.length}`;
  }
  const { rows } = await db.getQuery()(
    `SELECT * FROM system_messages ${where} ORDER BY sort_order ASC, updated_at DESC`,
    params
  );
  return rows.map(mapRow);
}

async function getById(id) {
  const { rows } = await db.getQuery()(
    'SELECT * FROM system_messages WHERE id = $1',
    [id]
  );
  return mapRow(rows[0]);
}

async function getBySlug(slug) {
  const { rows } = await db.getQuery()(
    'SELECT * FROM system_messages WHERE slug = $1',
    [slug]
  );
  return mapRow(rows[0]);
}

async function countPublishedWelcomeForChannel(channel, excludeId = null) {
  const params = [JSON.stringify([channel])];
  let sql = `
    SELECT COUNT(*)::int AS c FROM system_messages
    WHERE kind = 'welcome'
      AND status = 'published'
      AND channels @> $1::jsonb
  `;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id <> $${params.length}`;
  }
  const { rows } = await db.getQuery()(sql, params);
  return rows[0]?.c || 0;
}

async function createMessage(payload, userId = null) {
  const kind = payload.kind === 'welcome' ? 'welcome' : 'generic';
  const status = payload.status === 'published' ? 'published' : 'draft';
  const channels = normalizeChannels(payload.channels);
  const audience = normalizeAudience(payload.audience, payload.max_user_age_seconds);
  const persist = kind === 'welcome' ? false : Boolean(payload.persist_to_history);
  const i18n = normalizeI18n(payload.i18n);
  const slug = String(payload.slug || '').trim();
  if (!slug) throw Object.assign(new Error('slug required'), { status: 400 });

  if (status === 'published' && kind === 'welcome') {
    for (const ch of channels) {
      const c = await countPublishedWelcomeForChannel(ch);
      if (c > 0) {
        throw Object.assign(
          new Error(`Уже есть published welcome для канала ${ch}`),
          { status: 409 }
        );
      }
    }
  }

  const { rows } = await db.getQuery()(
    `INSERT INTO system_messages (
       slug, kind, channels, reply_type, importance, status,
       visible_for, audience, max_user_age_seconds, persist_to_history,
       publish_at, expire_at, sort_order, i18n, created_by, updated_by
     ) VALUES (
       $1,$2,$3::jsonb,$4,$5,$6,
       $7,$8::jsonb,$9,$10,
       $11,$12,$13,$14::jsonb,$15,$15
     ) RETURNING *`,
    [
      slug,
      kind,
      JSON.stringify(channels),
      payload.reply_type === 'assistant_reply' ? 'assistant_reply' : 'inline',
      ['info', 'warning', 'danger'].includes(payload.importance) ? payload.importance : 'info',
      status,
      visibleForFromAudience(audience),
      JSON.stringify(audience),
      audience.max_user_age_seconds || 3600,
      persist,
      payload.publish_at || null,
      payload.expire_at || null,
      Number.isFinite(Number(payload.sort_order)) ? Number(payload.sort_order) : 0,
      JSON.stringify(i18n),
      userId,
    ]
  );
  return mapRow(rows[0]);
}

async function updateMessage(id, payload, userId = null) {
  const existing = await getById(id);
  if (!existing) {
    throw Object.assign(new Error('Not found'), { status: 404 });
  }

  const kind = payload.kind != null
    ? (payload.kind === 'welcome' ? 'welcome' : 'generic')
    : existing.kind;
  const status = payload.status != null
    ? (payload.status === 'published' ? 'published' : 'draft')
    : existing.status;
  const channels = payload.channels != null
    ? normalizeChannels(payload.channels)
    : existing.channels;
  const audience = normalizeAudience(
    payload.audience != null ? payload.audience : existing.audience,
    payload.max_user_age_seconds != null
      ? payload.max_user_age_seconds
      : existing.max_user_age_seconds
  );
  const persist = kind === 'welcome'
    ? false
    : (payload.persist_to_history != null
      ? Boolean(payload.persist_to_history)
      : existing.persist_to_history);
  const i18n = payload.i18n != null ? normalizeI18n(payload.i18n) : existing.i18n;
  const slug = payload.slug != null ? String(payload.slug).trim() : existing.slug;

  if (status === 'published' && kind === 'welcome') {
    for (const ch of channels) {
      const c = await countPublishedWelcomeForChannel(ch, id);
      if (c > 0) {
        throw Object.assign(
          new Error(`Уже есть published welcome для канала ${ch}`),
          { status: 409 }
        );
      }
    }
  }

  const { rows } = await db.getQuery()(
    `UPDATE system_messages SET
       slug = $2,
       kind = $3,
       channels = $4::jsonb,
       reply_type = $5,
       importance = $6,
       status = $7,
       visible_for = $8,
       audience = $9::jsonb,
       max_user_age_seconds = $10,
       persist_to_history = $11,
       publish_at = $12,
       expire_at = $13,
       sort_order = $14,
       i18n = $15::jsonb,
       updated_by = $16,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      slug,
      kind,
      JSON.stringify(channels),
      payload.reply_type != null
        ? (payload.reply_type === 'assistant_reply' ? 'assistant_reply' : 'inline')
        : existing.reply_type,
      payload.importance != null && ['info', 'warning', 'danger'].includes(payload.importance)
        ? payload.importance
        : existing.importance,
      status,
      visibleForFromAudience(audience),
      JSON.stringify(audience),
      audience.max_user_age_seconds || 3600,
      persist,
      payload.publish_at !== undefined ? payload.publish_at : existing.publish_at,
      payload.expire_at !== undefined ? payload.expire_at : existing.expire_at,
      payload.sort_order != null ? Number(payload.sort_order) : existing.sort_order,
      JSON.stringify(i18n),
      userId,
    ]
  );
  return mapRow(rows[0]);
}

async function deleteMessage(id) {
  const { rowCount } = await db.getQuery()(
    'DELETE FROM system_messages WHERE id = $1',
    [id]
  );
  return rowCount > 0;
}

async function bulkSetStatus(ids, status) {
  if (!Array.isArray(ids) || !ids.length) return { updated: 0 };
  if (!['published', 'draft'].includes(status)) {
    throw Object.assign(new Error('Invalid status'), { status: 400 });
  }
  if (status === 'published') {
    for (const id of ids) {
      const msg = await getById(id);
      if (!msg) continue;
      if (msg.kind === 'welcome') {
        for (const ch of msg.channels) {
          const c = await countPublishedWelcomeForChannel(ch, id);
          if (c > 0) {
            throw Object.assign(
              new Error(`Уже есть published welcome для канала ${ch}`),
              { status: 409 }
            );
          }
        }
      }
    }
  }
  const { rowCount } = await db.getQuery()(
    `UPDATE system_messages
     SET status = $2, updated_at = NOW(),
         persist_to_history = CASE WHEN kind = 'welcome' THEN false ELSE persist_to_history END
     WHERE id = ANY($1::uuid[])`,
    [ids, status]
  );
  return { updated: rowCount };
}

async function bulkDelete(ids) {
  if (!Array.isArray(ids) || !ids.length) return { deleted: 0 };
  const { rowCount } = await db.getQuery()(
    'DELETE FROM system_messages WHERE id = ANY($1::uuid[])',
    [ids]
  );
  return { deleted: rowCount };
}

async function getUserTagIds(userId) {
  if (!userId) return [];
  try {
    const { rows } = await db.getQuery()(
      'SELECT tag_id FROM user_tag_links WHERE user_id = $1',
      [userId]
    );
    return rows.map((r) => Number(r.tag_id));
  } catch (error) {
    logger.warn('[systemMessages] getUserTagIds:', error.message);
    return [];
  }
}

async function buildViewerFromRequest(req) {
  const userId = req.session?.userId || null;
  if (!userId) {
    return { isGuest: true, userId: null, role: 'guest', createdAt: null, tagIds: [] };
  }
  const { rows } = await db.getQuery()(
    'SELECT id, role, created_at FROM users WHERE id = $1',
    [userId]
  );
  const u = rows[0];
  if (!u) {
    return { isGuest: true, userId: null, role: 'guest', createdAt: null, tagIds: [] };
  }
  const tagIds = await getUserTagIds(u.id);
  return {
    isGuest: false,
    userId: u.id,
    role: u.role || 'user',
    createdAt: u.created_at,
    tagIds,
  };
}

async function buildViewerFromUserId(userId) {
  if (!userId) {
    return { isGuest: true, userId: null, role: 'guest', createdAt: null, tagIds: [] };
  }
  const { rows } = await db.getQuery()(
    'SELECT id, role, created_at FROM users WHERE id = $1',
    [userId]
  );
  const u = rows[0];
  if (!u) {
    return { isGuest: true, userId: null, role: 'guest', createdAt: null, tagIds: [] };
  }
  return {
    isGuest: false,
    userId: u.id,
    role: u.role || 'user',
    createdAt: u.created_at,
    tagIds: await getUserTagIds(u.id),
  };
}

/**
 * Active published messages for channel filtered by audience.
 */
async function getPublishedForChannel({ channel, viewer, kind = null }) {
  const params = [JSON.stringify([channel])];
  let sql = `
    SELECT * FROM system_messages
    WHERE status = 'published'
      AND channels @> $1::jsonb
  `;
  if (kind) {
    params.push(kind);
    sql += ` AND kind = $${params.length}`;
  }
  sql += ' ORDER BY sort_order ASC, updated_at DESC';
  const { rows } = await db.getQuery()(sql, params);
  const now = new Date();
  return rows
    .map(mapRow)
    .filter((m) => isWithinSchedule(m, now) && shouldShowMessage(viewer, m));
}

async function getActiveWelcome({ channel, viewer }) {
  const list = await getPublishedForChannel({ channel, viewer, kind: 'welcome' });
  return list[0] || null;
}

async function tryRecordDelivery(systemMessageId, channel, recipientKey) {
  if (!systemMessageId || !channel || !recipientKey) return false;
  try {
    const { rowCount } = await db.getQuery()(
      `INSERT INTO system_message_deliveries (system_message_id, channel, recipient_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (system_message_id, channel, recipient_key) DO NOTHING`,
      [systemMessageId, channel, String(recipientKey)]
    );
    return rowCount > 0;
  } catch (error) {
    logger.warn('[systemMessages] tryRecordDelivery:', error.message);
    return false;
  }
}

async function hasDelivery(systemMessageId, channel, recipientKey) {
  const { rows } = await db.getQuery()(
    `SELECT 1 FROM system_message_deliveries
     WHERE system_message_id = $1 AND channel = $2 AND recipient_key = $3
     LIMIT 1`,
    [systemMessageId, channel, String(recipientKey)]
  );
  return rows.length > 0;
}

function formatWelcomeText(msg, { locale = 'ru', channel = 'web' } = {}) {
  const { data } = pickLocale(msg.i18n, locale);
  if (!data) return { text: '', branches: [], title: '', locale };
  let text = data.content || '';
  const branches = Array.isArray(data.branches) ? data.branches : [];
  if (channel === 'email' && branches.length) {
    text += '\n\n';
    branches.forEach((b, i) => {
      text += `${i + 1}. ${b.label || b.payload}\n`;
    });
  }
  if (channel === 'telegram' && branches.length) {
    const textBranches = branches.filter((b) => b.ui === 'text');
    if (textBranches.length) {
      text += '\n\n';
      textBranches.forEach((b) => {
        text += `• ${b.label}\n`;
      });
    }
  }
  return {
    title: data.title || '',
    summary: data.summary || '',
    text,
    content: data.content || '',
    branches,
    locale,
    assistant_reply_content: data.assistant_reply_content,
  };
}

function telegramInlineKeyboard(msg, locale = 'ru') {
  const { branches } = formatWelcomeText(msg, { locale, channel: 'telegram' });
  const buttons = branches
    .filter((b) => b.ui === 'button' || b.ui === 'text')
    .map((b) => [{
      text: String(b.label || '').slice(0, 64),
      callback_data: `sysmsg:${msg.slug}:${b.id}`.slice(0, 64),
    }]);
  return buttons.length ? buttons : null;
}

module.exports = {
  DEFAULT_AUDIENCE,
  PRESET_DEFAULTS,
  normalizeAudience,
  normalizeChannels,
  normalizeI18n,
  pickLocale,
  shouldShowMessage,
  isChannelActive,
  mapRow,
  listAll,
  getById,
  getBySlug,
  createMessage,
  updateMessage,
  deleteMessage,
  bulkSetStatus,
  bulkDelete,
  buildViewerFromRequest,
  buildViewerFromUserId,
  getPublishedForChannel,
  getActiveWelcome,
  tryRecordDelivery,
  hasDelivery,
  formatWelcomeText,
  telegramInlineKeyboard,
  getUserTagIds,
};
