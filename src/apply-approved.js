import { config, requireEnv } from './config.js';
import { FeishuClient } from './feishu.js';
import { ShopifyClient } from './shopify.js';
import {
  assertDraftProduct,
  buildAppliedFields,
  buildErrorFields,
  buildStatusFilter,
  findShopifyProduct,
  getRecordField,
  parseDraftJson
} from './workflow.js';

try {
  const requiredConfig = [
    'feishu.bitableAppToken',
    'feishu.bitableTableId',
    'shopify.shopDomain'
  ];
  if (!config.shopify.clientId || !config.shopify.clientSecret) {
    requiredConfig.push('shopify.adminAccessToken');
  }
  if (!config.feishu.useLarkCli) {
    requiredConfig.push('feishu.appId', 'feishu.appSecret');
  }
  requireEnv(requiredConfig);

  const feishu = new FeishuClient(config.feishu);
  const shopify = new ShopifyClient(config.shopify);

  const records = await feishu.searchRecords({
    appToken: config.feishu.bitableAppToken,
    tableId: config.feishu.bitableTableId,
    filter: buildStatusFilter(config.feishu.statuses.approved)
  });

  console.log(`Found ${records.length} approved record(s) to apply.`);

  for (const record of records) {
    try {
      const fields = config.feishu.fields;
      const draft = parseDraftJson(record.fields?.[fields.draftJson]);
      const productId = getRecordField(record, fields.shopifyProductId);
      const handle = getRecordField(record, fields.shopifyHandle);
      const identifier = productId || handle || getRecordField(record, fields.sku);

      const currentProduct = await findShopifyProduct({ shopify, productId, handle });
      assertDraftProduct(currentProduct, identifier);

      if (config.dryRun) {
        console.log(`[DRY_RUN] Would update Shopify product ${currentProduct.id}:`, draft);
        continue;
      }

      const updatedProduct = await shopify.updateProduct(currentProduct.id, draft);
      const metafields = await shopify.setMetafields(currentProduct.id, draft);

      await feishu.updateRecord({
        appToken: config.feishu.bitableAppToken,
        tableId: config.feishu.bitableTableId,
        recordId: record.record_id,
        fields: buildAppliedFields({ updatedProduct, metafields })
      });

      console.log(`Applied approved draft to Shopify product ${updatedProduct.id}.`);
    } catch (error) {
      console.error(`Apply failed for record ${record.record_id}: ${error.message}`);

      if (!config.dryRun) {
        await feishu.updateRecord({
          appToken: config.feishu.bitableAppToken,
          tableId: config.feishu.bitableTableId,
          recordId: record.record_id,
          fields: buildErrorFields(error)
        });
      }
    }
  }
} catch (error) {
  console.error(`Fatal: ${error.message}`);
  process.exitCode = 1;
}
