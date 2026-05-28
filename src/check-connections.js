import { config, requireEnv } from './config.js';
import { FeishuClient } from './feishu.js';
import { ProductDrafter } from './openai-product-drafter.js';
import { ShopifyClient } from './shopify.js';

try {
  const requiredConfig = [
    'feishu.bitableAppToken',
    'feishu.bitableTableId',
    'shopify.shopDomain'
  ];
  if (!config.shopify.clientId || !config.shopify.clientSecret) {
    requiredConfig.push('shopify.adminAccessToken');
  }
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

  console.log('Checking Feishu...');
  const records = await feishu.searchRecords({
    appToken: config.feishu.bitableAppToken,
    tableId: config.feishu.bitableTableId,
    pageSize: 1
  });
  console.log(`Feishu OK. Read ${records.length} sample record(s).`);

  console.log('Checking Shopify...');
  const shop = await shopify.getShop();
  console.log(`Shopify OK. Connected to ${shop.name} (${shop.myshopifyDomain}).`);

  console.log(`Checking ${config.llmProvider}...`);
  const draft = await drafter.draftEnglishProductPage({
    sku: 'CONNECTION_TEST',
    targetMarket: 'US',
    brandVoice: 'clear and practical',
    sourceNotes:
      'Test product: a dimmable LED desk lamp with adjustable brightness and warm/cool color modes.',
    sourceDocuments: ''
  });
  console.log(`${config.llmProvider} OK. Sample title: ${draft.title}`);

  console.log('All connections passed.');
} catch (error) {
  console.error(`Fatal: ${error.message}`);
  process.exitCode = 1;
}
