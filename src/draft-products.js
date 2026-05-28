import { config, requireEnv } from './config.js';
import { FeishuClient } from './feishu.js';
import { ProductDrafter } from './openai-product-drafter.js';
import { ShopifyClient } from './shopify.js';
import {
  assertDraftProduct,
  buildDraftUpdateFields,
  buildErrorFields,
  buildStatusFilter,
  findShopifyProduct,
  loadSourceMaterial
} from './workflow.js';

try {
  const requiredConfig = [
    'feishu.bitableAppToken',
    'feishu.bitableTableId',
    'shopify.shopDomain',
    'shopify.adminAccessToken'
  ];
  if (config.llmProvider === 'deepseek') {
    requiredConfig.push('deepseek.apiKey');
  } else {
    requiredConfig.push('openai.apiKey');
  }
  if (!config.feishu.useLarkCli) {
    requiredConfig.push('feishu.appId', 'feishu.appSecret');
  }
  requireEnv(requiredConfig);

  const feishu = new FeishuClient(config.feishu);
  const shopify = new ShopifyClient(config.shopify);
  const drafter = new ProductDrafter({
    provider: config.llmProvider,
    openai: config.openai,
    deepseek: config.deepseek
  });

  const records = await feishu.searchRecords({
    appToken: config.feishu.bitableAppToken,
    tableId: config.feishu.bitableTableId,
    filter: buildStatusFilter(config.feishu.statuses.ready)
  });

  console.log(`Found ${records.length} record(s) ready for AI drafting.`);

  for (const record of records) {
    try {
      const material = await loadSourceMaterial({ feishu, record });
      const identifier = material.shopifyProductId || material.shopifyHandle || material.sku;
      const currentProduct = await findShopifyProduct({
        shopify,
        productId: material.shopifyProductId,
        handle: material.shopifyHandle
      });

      assertDraftProduct(currentProduct, identifier);

      const draft = await drafter.draftEnglishProductPage(material);
      const fields = buildDraftUpdateFields({ draft, currentProduct });

      if (config.dryRun) {
        console.log(`[DRY_RUN] Would update Feishu record ${record.record_id}:`, fields);
        continue;
      }

      await feishu.updateRecord({
        appToken: config.feishu.bitableAppToken,
        tableId: config.feishu.bitableTableId,
        recordId: record.record_id,
        fields
      });

      console.log(`Drafted ${identifier}; waiting for Feishu approval.`);
    } catch (error) {
      console.error(`Draft failed for record ${record.record_id}: ${error.message}`);

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
