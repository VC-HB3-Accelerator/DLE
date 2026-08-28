/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '@/api/axios';

export async function fetchStoreSettings() {
  const { data } = await api.get('/store/settings');
  return data;
}

export async function saveStoreSettings(payload) {
  const { data } = await api.put('/store/settings', payload);
  return data;
}

export async function pullStoreTreasuryFromModule() {
  const { data } = await api.post('/store/settings/pull-treasury');
  return data;
}

export async function fetchStoreCatalog(params = {}) {
  const { data } = await api.get('/store/catalog', { params });
  return data?.products || data || [];
}

export async function fetchStoreCatalogProduct(id) {
  const { data } = await api.get(`/store/catalog/${id}`);
  return data?.product || data;
}

export async function fetchStoreProducts() {
  const { data } = await api.get('/store/products');
  return data?.products || data || [];
}

export async function fetchStoreProduct(id) {
  const { data } = await api.get(`/store/products/${id}`);
  return data?.product || data;
}

export async function createStoreProduct(payload) {
  const { data } = await api.post('/store/products', payload);
  return data?.product || data;
}

export async function updateStoreProduct(id, payload) {
  const { data } = await api.put(`/store/products/${id}`, payload);
  return data?.product || data;
}

export async function importStoreProducts(rows) {
  const { data } = await api.post('/store/products/import', { rows });
  return data;
}

export async function fetchStoreOrders(params = {}) {
  const { data } = await api.get('/store/orders', { params });
  return data?.orders || data || [];
}

export async function fetchMyStoreOrders() {
  const { data } = await api.get('/store/orders/mine');
  return data?.orders || data || [];
}

export async function createStoreOrder(payload) {
  const { data } = await api.post('/store/orders', payload);
  return data?.order || data;
}

export async function checkStorePayment(orderId, body = {}) {
  const { data } = await api.post(`/store/orders/${orderId}/check-payment`, body);
  return data?.order || data;
}

export async function checkStoreCheckoutPayment(checkoutId, body = {}) {
  const { data } = await api.post(`/store/checkouts/${checkoutId}/check-payment`, body);
  return data?.checkout || data;
}

export async function cancelStoreOrder(orderId) {
  const { data } = await api.post(`/store/orders/${orderId}/cancel`);
  return data?.order || data;
}

export async function markStoreOrderFulfilled(orderId) {
  const { data } = await api.post(`/store/orders/${orderId}/mark-fulfilled`);
  return data?.order || data;
}

export async function markStoreOrderRefunded(orderId) {
  const { data } = await api.post(`/store/orders/${orderId}/mark-refunded`);
  return data?.order || data;
}

export async function prepareStoreFulfillment(orderId, body = {}) {
  const { data } = await api.post(`/store/orders/${orderId}/prepare-fulfillment`, body);
  return data;
}

export async function prepareStoreRefund(orderId) {
  const { data } = await api.post(`/store/orders/${orderId}/prepare-refund`);
  return data;
}

export async function linkFulfillmentProposal(orderId, proposalId) {
  const { data } = await api.post(`/store/orders/${orderId}/link-fulfillment-proposal`, { proposalId });
  return data?.order || data;
}

export async function linkRefundProposal(orderId, proposalId) {
  const { data } = await api.post(`/store/orders/${orderId}/link-refund-proposal`, { proposalId });
  return data?.order || data;
}

export async function fetchTreasuryTokens() {
  const { data } = await api.get('/store/treasury-tokens');
  return data?.tokens || data || [];
}

export async function resolveStoreToken(address, options = {}) {
  const { data } = await api.post('/store/resolve-token', {
    address,
    standard: options.standard || 'erc20',
    receipt_erc1155_token_id: options.receipt_erc1155_token_id,
  });
  return data?.token || data;
}

export async function fetchStoreSections(params = {}) {
  const { data } = await api.get('/store/sections', { params });
  return data?.sections || data || [];
}

export async function createStoreSection(payload) {
  const { data } = await api.post('/store/sections', payload);
  return data?.section || data;
}

export async function updateStoreSection(id, payload) {
  const { data } = await api.put(`/store/sections/${id}`, payload);
  return data?.section || data;
}

export async function deleteStoreSection(id) {
  const { data } = await api.delete(`/store/sections/${id}`);
  return data;
}

export async function createStoreCheckout(items) {
  const { data } = await api.post('/store/checkouts', { items });
  return data?.checkout || data;
}

export async function fetchStoreCheckout(id) {
  const { data } = await api.get(`/store/checkouts/${id}`);
  return data?.checkout || data;
}

export async function fetchStoreCheckoutsCrm() {
  const { data } = await api.get('/store/checkouts');
  return data?.checkouts || data || [];
}

const CART_KEY = 'dle_store_cart_v1';
const CART_EVENT = 'dle-store-cart-changed';

export function readStoreCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeStoreCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items || []));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { items: items || [] } }));
  }
}

export function storeCartCount(items = null) {
  const list = items || readStoreCart();
  return list.reduce((sum, x) => sum + Number(x.qty || 0), 0);
}

export function onStoreCartChange(handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = () => handler(readStoreCart());
  window.addEventListener(CART_EVENT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(CART_EVENT, fn);
    window.removeEventListener('storage', fn);
  };
}

export function addToStoreCart({
  productId,
  qty = 1,
  title = '',
  payToken = '',
  payTokenAddress = '',
  priceUnits = '',
  decimals = 0,
  maxQty = 99,
}) {
  const items = readStoreCart();
  const id = String(productId);
  const cap = Math.max(1, Math.min(99, Number(maxQty) || 99));
  const existing = items.find((x) => String(x.productId) === id);
  if (existing) {
    existing.qty = Math.min(cap, Number(existing.qty || 1) + Number(qty || 1));
    if (title) existing.title = title;
    if (payToken) existing.payToken = payToken;
    if (payTokenAddress) existing.payTokenAddress = payTokenAddress;
    if (priceUnits) existing.priceUnits = String(priceUnits);
    if (decimals != null) existing.decimals = Number(decimals);
    existing.maxQty = cap;
  } else {
    items.push({
      productId: id,
      qty: Math.min(cap, Number(qty || 1)),
      title,
      payToken,
      payTokenAddress,
      priceUnits: priceUnits ? String(priceUnits) : '',
      decimals: Number(decimals || 0),
      maxQty: cap,
    });
  }
  writeStoreCart(items);
  return items;
}
