/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Диспетчер: id из каталога → обёртка ОС. Пишущие вызовы — только после явного решения.
 */

const crypto = require('crypto');
const { assertTool } = require('./orchToolGate');
const consent = require('./orchConsent');

const toolEffects = require('./orchToolEffects');

const WRITE_TOOLS = new Set([
  'tables.create',
  'tables.add_columns',
  'tables.add_rows',
  'tables.enrich',
  'listing.create_draft',
  'store.create_draft',
  'card.publish',
  'listing.attach_media',
  'store.attach_media',
  'card.generate_slot',
]);

function effectKey(toolId, args, ctx) {
  if (args?.idempotency_key) return String(args.idempotency_key);
  const basis = JSON.stringify({
    tool: toolId,
    job: ctx.jobId || null,
    name: args?.name || null,
    tableId: args?.table_id || args?.tableId || null,
    pageId: args?.page_id || args?.pageId || null,
    productId: args?.product_id || args?.productId || null,
    columns: args?.columns || null,
    rowHash: args?.rows ? crypto.createHash('sha256').update(JSON.stringify(args.rows)).digest('hex').slice(0, 16) : null,
    apply: args?.apply || false,
    patchHash: args?.patches
      ? crypto.createHash('sha256').update(JSON.stringify(args.patches)).digest('hex').slice(0, 16)
      : null,
    briefHash: args?.brief
      ? crypto.createHash('sha256').update(JSON.stringify({
        kind: args.brief.kind,
        title: args.brief.title,
        excerpt: args.brief.excerpt,
        price: args.brief.store?.price_units,
        token: args.brief.store?.pay_token_address,
      })).digest('hex').slice(0, 16)
      : null,
  });
  return `${ctx.jobId || 'job'}:${toolId}:${crypto.createHash('sha256').update(basis).digest('hex').slice(0, 24)}`;
}

async function remember(key, value) {
  return toolEffects.remember(key, value);
}

async function replay(key) {
  return toolEffects.replay(key);
}

async function execute({
  toolId,
  args = {},
  ctx = {},
  hooks = {},
} = {}) {
  const id = String(toolId || '').trim();
  const brief = ctx.brief || { tools_allow: [id] };
  assertTool(id, {
    agentId: ctx.agentId || 'orchestrator',
    brief,
    args,
  });

  const writes = WRITE_TOOLS.has(id) && !(id === 'tables.enrich' && !args.apply);
  if (writes) {
    if (id === 'card.publish') {
      consent.assertPublishDecision(ctx.decision || '', ctx.rawText || '');
    } else {
      consent.assertExplicitDecision(ctx.decision || '', ctx.rawText || '');
    }
  }

  const key = effectKey(id, args, ctx);
  const cached = await replay(key);
  if (cached && writes) return cached;

  const ownerUserId = ctx.ownerUserId;
  if (id === 'file.parse') {
    const parser = hooks.fileParse || require('./orchFileParse');
    return parser.parse(args);
  }
  if (id === 'search.pages' || id === 'search_web') {
    const pageSearch = hooks.pageSearch || require('./orchPageSearch');
    return pageSearch.searchPages({
      query: args.query,
      tableId: args.table_id || args.tableId || null,
      ownerUserId,
      fetchHtml: hooks.fetchHtml,
      hooks,
    });
  }
  if (id === 'tables.create') {
    const tables = hooks.tables || require('./orchTablesTools');
    const result = await tables.createTable({
      name: args.name,
      description: args.description,
      ragSource: Boolean(args.rag_source || args.ragSource),
      ownerUserId,
    }, hooks);
    if (ctx.jobId && result.table_id) {
      try {
        const store = hooks.jobStore || require('./orchJobStore');
        const job = await store.getJob(ctx.jobId);
        if (job) {
          job.plan = { ...(job.plan || {}), table_id: result.table_id };
          await store.saveJob(job);
        }
      } catch { /* best-effort */ }
    }
    return remember(key, { tool: id, ...result });
  }
  if (id === 'tables.add_columns') {
    const tables = hooks.tables || require('./orchTablesTools');
    const result = await tables.addColumns({
      tableId: args.table_id || args.tableId,
      columns: args.columns,
      ownerUserId,
    }, hooks);
    return remember(key, { tool: id, ...result });
  }
  if (id === 'tables.add_rows') {
    const tables = hooks.tables || require('./orchTablesTools');
    const result = await tables.addRows({
      tableId: args.table_id || args.tableId,
      columns: args.columns,
      rows: args.rows,
      ownerUserId,
    }, hooks);
    return remember(key, { tool: id, ...result });
  }
  if (id === 'tables.enrich') {
    const enrich = hooks.tableEnrich || require('./orchTableEnrich');
    if (args.apply) {
      const result = await enrich.apply({
        tableId: args.table_id || args.tableId,
        patches: args.patches,
        ownerUserId,
      }, hooks);
      return remember(key, { tool: id, ...result });
    }
    return enrich.propose({
      preview: args.preview,
      tableId: args.table_id || args.tableId,
      message: args.message || '',
      ownerUserId,
    }, hooks);
  }
  if (id === 'listing.create_draft') {
    const drafts = hooks.cardDraft || require('./orchCardDraft');
    const result = await drafts.createListingDraft({
      brief: args.brief,
      ownerUserId,
      jobId: ctx.jobId,
    }, hooks);
    return remember(key, result);
  }
  if (id === 'store.create_draft') {
    const drafts = hooks.cardDraft || require('./orchCardDraft');
    const result = await drafts.createStoreDraft({
      brief: args.brief,
      ownerUserId,
      jobId: ctx.jobId,
    }, hooks);
    return remember(key, result);
  }
  if (id === 'card.plan_media') {
    const media = hooks.cardMedia || require('./orchCardMedia');
    return media.planMedia({
      brief: args.brief,
      text: args.text || '',
      hasReference: Boolean(args.has_reference || args.hasReference),
    });
  }
  if (id === 'card.generate_slot') {
    const media = hooks.cardMedia || require('./orchCardMedia');
    const result = await media.generateSlot({
      brief: args.brief,
      plan: args.plan,
      slotId: args.slot_id || args.slotId,
      hasReference: Boolean(args.has_reference || args.hasReference),
      text: args.text || '',
    }, { ...hooks, model: args.model || hooks.model });
    return remember(key, { tool: id, ...result });
  }
  if (id === 'listing.attach_media' || id === 'store.attach_media') {
    const media = hooks.cardMedia || require('./orchCardMedia');
    const result = await media.attachMedia({
      pageId: args.page_id || args.pageId || null,
      productId: args.product_id || args.productId || null,
      slots: args.slots || [],
      ownerUserId,
    }, hooks);
    return remember(key, { tool: id, ...result });
  }
  if (id === 'card.publish') {
    const pub = hooks.cardPublish || require('./orchCardPublish');
    const result = await pub.publishCard({
      pageId: args.page_id || args.pageId || null,
      productId: args.product_id || args.productId || null,
      brief: args.brief || null,
      ownerUserId,
      canPublishDirectly: Boolean(ctx.canPublishDirectly),
    }, hooks);
    return remember(key, result);
  }
  const error = new Error(`Нет исполнителя для ${id}`);
  error.status = 501;
  error.code = 'TOOL_NOT_IMPLEMENTED';
  throw error;
}

function resetEffects() {
  toolEffects.resetEffects();
}

module.exports = {
  WRITE_TOOLS,
  execute,
  effectKey,
  resetEffects,
};
