import { config } from './config.js';
import { extractFeishuDocumentIds, makeEqualsFilter, normalizeFieldValue } from './feishu.js';
import { summarizeProductDiff } from './shopify.js';

export function getRecordField(record, fieldName) {
  return normalizeFieldValue(record.fields?.[fieldName]);
}

export function buildStatusFilter(status) {
  return makeEqualsFilter(config.feishu.fields.approvalStatus, status);
}

export async function loadSourceMaterial({ feishu, record }) {
  const fields = config.feishu.fields;
  const sourceDocField = record.fields?.[fields.sourceDocUrls];
  const documentIds = extractFeishuDocumentIds(sourceDocField);
  const documents = [];

  for (const documentId of documentIds) {
    const content = await feishu.getDocMarkdown(documentId);
    documents.push(`--- Feishu document ${documentId} ---\n${content}`);
  }

  return {
    sku: getRecordField(record, fields.sku),
    shopifyProductId: getRecordField(record, fields.shopifyProductId),
    shopifyHandle: getRecordField(record, fields.shopifyHandle),
    sourceNotes: getRecordField(record, fields.sourceNotes),
    targetMarket: getRecordField(record, fields.targetMarket),
    brandVoice: getRecordField(record, fields.brandVoice),
    sourceDocuments: documents.join('\n\n')
  };
}

export async function findShopifyProduct({ shopify, productId, handle }) {
  if (productId) {
    return shopify.getProductById(productId);
  }

  if (handle) {
    return shopify.getProductByHandle(handle);
  }

  return null;
}

export function assertDraftProduct(product, identifier) {
  if (!product) {
    throw new Error(`Shopify product not found for ${identifier}`);
  }

  if (product.status !== 'DRAFT') {
    throw new Error(
      `Refusing to update Shopify product ${product.id}; expected DRAFT status but found ${product.status}`
    );
  }
}

export function buildDraftUpdateFields({ draft, currentProduct }) {
  const fields = config.feishu.fields;
  return {
    [fields.draftJson]: JSON.stringify(draft, null, 2),
    [fields.diffJson]: JSON.stringify(summarizeProductDiff(currentProduct, draft), null, 2),
    [fields.approvalStatus]: config.feishu.statuses.pendingApproval,
    [fields.lastError]: '',
    [fields.lastSyncedAt]: new Date().toISOString()
  };
}

export function buildErrorFields(error) {
  const fields = config.feishu.fields;
  return {
    [fields.approvalStatus]: config.feishu.statuses.error,
    [fields.lastError]: error.message,
    [fields.lastSyncedAt]: new Date().toISOString()
  };
}

export function buildAppliedFields(result) {
  const fields = config.feishu.fields;
  return {
    [fields.approvalStatus]: config.feishu.statuses.applied,
    [fields.lastError]: '',
    [fields.lastSyncedAt]: new Date().toISOString(),
    [fields.diffJson]: JSON.stringify(result, null, 2)
  };
}

export function parseDraftJson(value) {
  const text = normalizeFieldValue(value);
  if (!text) {
    throw new Error('Missing AI Draft JSON');
  }

  return JSON.parse(text);
}
