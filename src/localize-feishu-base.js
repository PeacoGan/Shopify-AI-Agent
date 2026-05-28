import { config, requireEnv } from './config.js';
import { FeishuClient } from './feishu.js';

const fieldNamePairs = [
  ['SKU', 'SKU'],
  ['Shopify Product ID', 'Shopify 商品ID'],
  ['Shopify Handle', 'Shopify Handle'],
  ['Source Doc URLs', '资料文档链接'],
  ['Source Notes', '资料备注'],
  ['Target Market', '目标市场'],
  ['Brand Voice', '品牌语气'],
  ['Approval Status', '审批状态'],
  ['AI Draft JSON', 'AI草稿JSON'],
  ['Shopify Diff JSON', 'Shopify差异JSON'],
  ['Last Error', '最近错误'],
  ['Last Synced At', '最近同步时间']
];

const fieldNames = Object.fromEntries([
  ...fieldNamePairs,
  ...fieldNamePairs.map(([, targetName]) => [targetName, targetName])
]);

const statusNames = {
  'Ready for AI': '待生成',
  'Pending Approval': '待审批',
  Approved: '已批准',
  Applied: '已同步',
  Error: '错误',
  待生成: '待生成',
  待审批: '待审批',
  已批准: '已批准',
  已同步: '已同步',
  错误: '错误'
};

const approvalStatusFieldNames = new Set(['Approval Status', '审批状态']);

try {
  requireEnv(['feishu.appId', 'feishu.appSecret', 'feishu.bitableAppToken', 'feishu.bitableTableId']);
  const feishu = new FeishuClient(config.feishu);
  const fields = await feishu.listFields({
    appToken: config.feishu.bitableAppToken,
    tableId: config.feishu.bitableTableId
  });

  for (const field of fields) {
    const targetName = fieldNames[field.field_name];
    if (!targetName) {
      continue;
    }
    const isApprovalStatusField = approvalStatusFieldNames.has(field.field_name);
    const targetOptions = isApprovalStatusField
      ? field.property.options.map((option) => ({
          id: option.id,
          name: statusNames[option.name] ?? option.name,
          color: option.color
        }))
      : undefined;

    if (
      field.field_name === targetName &&
      (!isApprovalStatusField || optionsUnchanged(field.property.options, targetOptions))
    ) {
      console.log(`${field.field_name} unchanged`);
      continue;
    }

    const payload = {
      field_name: targetName,
      type: field.type
    };

    if (isApprovalStatusField) {
      payload.property = {
        options: targetOptions
      };
    }

    await feishu.updateField({
      appToken: config.feishu.bitableAppToken,
      tableId: config.feishu.bitableTableId,
      fieldId: field.field_id,
      field: payload
    });
    console.log(`${field.field_name} -> ${targetName}`);
  }
} catch (error) {
  console.error(`Fatal: ${error.message}`);
  process.exitCode = 1;
}

function optionsUnchanged(currentOptions, targetOptions) {
  if (!targetOptions) {
    return true;
  }
  return currentOptions.every((option, index) => option.name === targetOptions[index]?.name);
}
