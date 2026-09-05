/**
 * Приёмка TZ §10.1 — сценарии T1–T15.
 * Запуск: docker compose exec -T backend node scripts/tz-accept-t1-t15.js
 */

const db = require('../db');
const identityService = require('../services/identity-service');
const accessResolver = require('../services/accessResolverService');
const authDomainRules = require('../services/authDomainRulesService');
const contactProvenance = require('../services/contactProvenanceService');
const authService = require('../services/auth-service');
const roleActionCaps = require('../services/roleActionCapabilitiesService');

const DOMAIN = 'tz-accept.example';
const DOMAIN_RO = 'tz-ro.example';
const TAG = `tz-accept-${Date.now()}`;
const KEY = require('../utils/encryptionUtils').getEncryptionKey();

const results = [];
let failed = 0;

function assert(id, cond, detail = '') {
  const ok = Boolean(cond);
  results.push({ id, ok, detail: String(detail || '') });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
}

async function createUser() {
  const { rows } = await db.getQuery()(`INSERT INTO users (role) VALUES ('user') RETURNING id`);
  return rows[0].id;
}

async function linkEmail(userId, email) {
  const r = await identityService.saveIdentity(userId, 'email', email, true);
  if (!r.success) throw new Error(`email link failed: ${r.error}`);
}

async function linkWallet(userId, address) {
  const r = await identityService.saveIdentity(userId, 'wallet', address.toLowerCase(), true);
  if (!r.success) throw new Error(`wallet link failed: ${r.error}`);
}

async function deleteUsers(ids) {
  if (!ids.length) return;
  await db.getQuery()(
    `DELETE FROM contact_provenance WHERE contact_user_id = ANY($1::int[]) OR imported_by = ANY($1::int[])`,
    [ids]
  ).catch(() => {});
  await db.getQuery()(`DELETE FROM user_identities WHERE user_id = ANY($1::int[])`, [ids]);
  await db.getQuery()(`DELETE FROM users WHERE id = ANY($1::int[])`, [ids]);
}

async function cleanup(extraIds = []) {
  await db.getQuery()(
    `DELETE FROM auth_email_domain_rules WHERE value LIKE $1 OR value = $2 OR value LIKE $3 OR value = $4 OR value LIKE $5`,
    [`%@${DOMAIN}`, DOMAIN, `%@${DOMAIN_RO}`, DOMAIN_RO, 'tz-editor-%']
  );
  const { rows } = await db.getQuery()(
    `SELECT DISTINCT user_id AS id FROM user_identities
     WHERE decrypt_text(provider_id_encrypted, $1) LIKE $2
        OR decrypt_text(provider_id_encrypted, $1) LIKE $3
        OR decrypt_text(provider_id_encrypted, $1) LIKE $4`,
    [KEY, `%@${DOMAIN}`, `%@${DOMAIN_RO}`, `${TAG}-%`]
  ).catch(() => ({ rows: [] }));
  const ids = [...new Set([...rows.map((r) => r.id), ...extraIds].filter(Boolean))];
  await deleteUsers(ids);
  await db.getQuery()(`DELETE FROM admin_pages_simple WHERE slug LIKE $1`, [`${TAG}-%`]).catch(() => {});
}

async function enableDomainPerms() {
  const matrix = await roleActionCaps.getMatrix();
  const before = {
    view_domain_contacts: Boolean(matrix.readonly.view_domain_contacts),
    edit_domain_contacts: Boolean(matrix.readonly.edit_domain_contacts),
    manage_domain_auth: Boolean(matrix.readonly.manage_domain_auth),
    view_domain_articles: Boolean(matrix.readonly.view_domain_articles),
  };
  const readonly = {
    ...matrix.readonly,
    view_domain_contacts: true,
    edit_domain_contacts: true,
    manage_domain_auth: true,
    view_domain_articles: true,
  };
  await roleActionCaps.saveMatrix({
    guest: matrix.guest,
    user: matrix.user,
    readonly,
    editor: matrix.editor,
  });
  return before;
}

async function restoreDomainPerms(before) {
  if (!before) return;
  const matrix = await roleActionCaps.getMatrix();
  await roleActionCaps.saveMatrix({
    guest: matrix.guest,
    user: matrix.user,
    readonly: { ...matrix.readonly, ...before },
    editor: matrix.editor,
  });
}

function installWalletStub(levelByWallet) {
  const original = authService.getUserAccessLevel.bind(authService);
  authService.getUserAccessLevel = async (address) => {
    const key = String(address || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(levelByWallet, key)) {
      return levelByWallet[key];
    }
    return original(address);
  };
  return () => {
    authService.getUserAccessLevel = original;
  };
}

async function main() {
  console.log(`\n=== TZ accept T1–T15 (${TAG}) ===\n`);
  await accessResolver.ensureTables();

  const editorAccess = {
    role: 'editor',
    tokenRole: 'editor',
    dataScope: 'global',
    domain: null,
    isDomainAdmin: false,
    permissions: { manage_domain_auth: true },
  };

  const createdIds = [];
  let domainPermsBefore = null;
  let restoreStub = () => {};

  try {
    await authDomainRules.createRule(
      { kind: 'domain', value: DOMAIN, role: 'user', domain_admin: false },
      editorAccess
    );
    await authDomainRules.createRule(
      { kind: 'domain', value: DOMAIN_RO, role: 'readonly', domain_admin: false },
      editorAccess
    );
    await authDomainRules.createRule(
      { kind: 'email', value: `boss@${DOMAIN}`, role: 'readonly', domain_admin: true },
      editorAccess
    );

    const ivanId = await createUser();
    createdIds.push(ivanId);
    await linkEmail(ivanId, `ivan@${DOMAIN}`);

    // Один boss@ (email unique) — последовательно T2 → T3 → T4 → T9
    const bossId = await createUser();
    createdIds.push(bossId);
    await linkEmail(bossId, `boss@${DOMAIN}`);
    const walletBoss = `${TAG}-wallet-boss`;

    const editorId = await createUser();
    createdIds.push(editorId);
    const walletEditor = `${TAG}-wallet-editor`;
    await linkWallet(editorId, walletEditor);

    const emailRoId = await createUser();
    createdIds.push(emailRoId);
    await linkEmail(emailRoId, `reader@${DOMAIN_RO}`);

    const contactId = await createUser();
    createdIds.push(contactId);
    await linkEmail(contactId, `client-${TAG}@gmail.com`);

    const levels = {
      [walletEditor]: { level: 'editor', tokenCount: 999999, hasAccess: true },
    };
    restoreStub = installWalletStub(levels);

    // T1
    {
      const a = await accessResolver.recompute(ivanId);
      assert(
        'T1',
        a.role === 'user' && a.dataScope === 'own' && !a.isDomainAdmin,
        `role=${a.role} scope=${a.dataScope} domainAdmin=${a.isDomainAdmin}`
      );
    }

    // T2 — boss@ без wallet
    {
      const a = await accessResolver.recompute(bossId);
      assert(
        'T2',
        a.role === 'user' && a.dataScope === 'own' && !a.isDomainAdmin,
        `role=${a.role} scope=${a.dataScope} domainAdmin=${a.isDomainAdmin}`
      );
    }

    // T3 — boss@ + wallet, balance < readonly
    await linkWallet(bossId, walletBoss);
    levels[walletBoss] = { level: 'user', tokenCount: 0, hasAccess: false };
    {
      const a = await accessResolver.recompute(bossId);
      assert(
        'T3',
        a.role === 'user' && !a.isDomainAdmin && a.dataScope === 'own',
        `role=${a.role} scope=${a.dataScope} domainAdmin=${a.isDomainAdmin}`
      );
    }

    // T4 — ≥ readonly + domain-permissions
    domainPermsBefore = await enableDomainPerms();
    levels[walletBoss] = { level: 'readonly', tokenCount: 100, hasAccess: true };
    {
      const a = await accessResolver.recompute(bossId);
      assert(
        'T4',
        a.role === 'readonly' && a.isDomainAdmin === true && a.dataScope === 'domain' && a.domain === DOMAIN,
        `role=${a.role} scope=${a.dataScope} domainAdmin=${a.isDomainAdmin} domain=${a.domain}`
      );
    }

    // T5
    {
      const a = await accessResolver.recompute(editorId);
      assert('T5', a.role === 'editor' && a.dataScope === 'global', `role=${a.role} scope=${a.dataScope}`);
    }

    // T6
    {
      const prov = await contactProvenance.recordImportProvenance({
        contactUserId: contactId,
        importedBy: bossId,
      });
      assert(
        'T6',
        prov && Number(prov.imported_by) === Number(bossId) && String(prov.owner_domain) === DOMAIN,
        `imported_by=${prov?.imported_by} owner_domain=${prov?.owner_domain}`
      );
    }

    // T7
    {
      const ivan = await accessResolver.resolveAccess(ivanId);
      const can = await accessResolver.canViewContact(ivan, contactId, ivanId);
      assert('T7', can === false, `canViewContact=${can}`);
    }

    // T8
    {
      const boss = await accessResolver.resolveAccess(bossId);
      const can = await accessResolver.canViewContact(boss, contactId, bossId);
      assert('T8', can === true && boss.dataScope === 'domain', `canViewContact=${can} scope=${boss.dataScope}`);
    }

    // T9 — demotion
    levels[walletBoss] = { level: 'user', tokenCount: 0, hasAccess: false };
    {
      const a = await accessResolver.recompute(bossId);
      assert(
        'T9',
        a.role === 'user' && !a.isDomainAdmin && a.dataScope === 'own',
        `role=${a.role} scope=${a.dataScope} domainAdmin=${a.isDomainAdmin}`
      );
    }

    // T10
    {
      let status = null;
      try {
        await authDomainRules.createRule(
          { kind: 'domain', value: 'tz-editor-forbidden.example', role: 'editor', domain_admin: false },
          editorAccess
        );
      } catch (e) {
        status = e.status || null;
      }
      assert('T10', status === 400, `status=${status}`);
    }

    // T11 — вернуть boss в domain-admin и попробовать other.com
    levels[walletBoss] = { level: 'readonly', tokenCount: 100, hasAccess: true };
    {
      const bossAccess = await accessResolver.recompute(bossId);
      let status = null;
      try {
        await authDomainRules.createRule(
          { kind: 'domain', value: 'other.com', role: 'user', domain_admin: false },
          bossAccess,
          bossId
        );
      } catch (e) {
        status = e.status || null;
      }
      assert(
        'T11',
        status === 403,
        `status=${status} scope=${bossAccess.dataScope} isDomainAdmin=${bossAccess.isDomainAdmin}`
      );
    }

    // T12
    {
      const rule = await authDomainRules.createRule(
        { kind: 'domain', value: 'tz-editor-ok.example', role: 'user', domain_admin: false },
        editorAccess,
        editorId
      );
      assert('T12', Boolean(rule?.id), `id=${rule?.id}`);
      if (rule?.id) await authDomainRules.deleteRule(rule.id, editorAccess, editorId);
    }

    // T13
    {
      await accessResolver.recompute(editorId);
      const before = await db.getQuery()('SELECT role FROM users WHERE id = $1', [editorId]);
      await accessResolver.recomputeAllWithWallets();
      const after = await db.getQuery()('SELECT role FROM users WHERE id = $1', [editorId]);
      assert(
        'T13',
        before.rows[0]?.role === 'editor' && after.rows[0]?.role === 'editor',
        `before=${before.rows[0]?.role} after=${after.rows[0]?.role}`
      );
    }

    // T14
    {
      const slug = `${TAG}-legal`;
      const { rows } = await db.getQuery()(
        `INSERT INTO admin_pages_simple
          (author_address, title, status, visibility, show_in_blog, slug, category)
         VALUES ($1, $2, 'published', 'public', FALSE, $3, 'политика и согласия')
         RETURNING id, show_in_blog`,
        [`user:${editorId}`, `Legal ${TAG}`, slug]
      );
      const { rows: feed } = await db.getQuery()(
        `SELECT id FROM admin_pages_simple
         WHERE visibility='public' AND status='published' AND show_in_blog=TRUE AND id=$1`,
        [rows[0].id]
      );
      assert(
        'T14',
        feed.length === 0 && rows[0].show_in_blog === false,
        `inFeed=${feed.length} show_in_blog=${rows[0].show_in_blog}`
      );
    }

    // T15
    {
      const a = await accessResolver.recompute(emailRoId);
      assert(
        'T15',
        a.role === 'readonly' && a.dataScope === 'own' && !a.isDomainAdmin,
        `role=${a.role} scope=${a.dataScope}`
      );
    }
  } finally {
    try { restoreStub(); } catch (_) { /* ignore */ }
    try { await restoreDomainPerms(domainPermsBefore); } catch (e) { console.warn('restoreDomainPerms:', e.message); }
    try { await cleanup(createdIds); } catch (e) { console.warn('cleanup:', e.message); }
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== Summary: ${passed}/${results.length} passed ===`);
  if (failed) {
    console.log('Failed:', results.filter((r) => !r.ok).map((r) => r.id).join(', '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
