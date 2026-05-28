import { config, requireEnv } from './config.js';
import { FeishuClient } from './feishu.js';

const baseName = process.argv[2] || 'Shopify AI 商品运营审批台';
const tableName = process.argv[3] || '商品审批';

const fields = [
  textField('SKU'),
  textField('Shopify 商品ID'),
  textField('Shopify Handle'),
  textField('资料文档链接'),
  textField('资料备注'),
  textField('目标市场'),
  textField('品牌语气'),
  singleSelectField('审批状态', [
    '待生成',
    '待审批',
    '已批准',
    '已同步',
    '错误'
  ]),
  textField('AI草稿JSON'),
  textField('Shopify差异JSON'),
  textField('最近错误'),
  textField('最近同步时间')
];

try {
  requireEnv(['feishu.appId', 'feishu.appSecret']);

  const feishu = new FeishuClient(config.feishu);
  console.log(`Creating Feishu Bitable: ${baseName}`);
  const base = await feishu.createBitable({ name: baseName, timeZone: 'Asia/Shanghai' });
  const appToken = base.data?.app?.app_token ?? base.data?.app_token;
  if (!appToken) {
    throw new Error(`Could not read app token from create response: ${JSON.stringify(base)}`);
  }

  console.log(`Creating table: ${tableName}`);
  const table = await feishu.createTable({
    appToken,
    name: tableName,
    fields
  });
  const tableId = table.data?.table_id ?? table.data?.table?.table_id;
  if (!tableId) {
    throw new Error(`Could not read table id from create response: ${JSON.stringify(table)}`);
  }

  console.log('Feishu Bitable created.');
  console.log(`FEISHU_BITABLE_APP_TOKEN=${appToken}`);
  console.log(`FEISHU_BITABLE_TABLE_ID=${tableId}`);
} catch (error) {
  console.error(`Fatal: ${error.message}`);
  process.exitCode = 1;
}

function textField(name) {
  return {
    field_name: name,
    type: 1
  };
}

function singleSelectField(name, options) {
  return {
    field_name: name,
    type: 3,
    property: {
      options: options.map((option) => ({ name: option }))
    }
  };
}
