import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const envPath = '.env';
const examplePath = '.env.example';

const defaults = parseEnvFile(existsSync(envPath) ? envPath : examplePath);
const rl = createInterface({ input, output });

try {
  console.log('Shopify AI Agent setup. Press Enter to keep the current value.');

  const feishuUrl = await ask('Feishu Bitable URL', '');
  const parsedFeishu = parseFeishuBitableUrl(feishuUrl);

  defaults.OPENAI_API_KEY = await askSecret('OPENAI_API_KEY', defaults.OPENAI_API_KEY);
  defaults.OPENAI_MODEL = await ask('OPENAI_MODEL', defaults.OPENAI_MODEL || 'gpt-4o-mini');
  defaults.LLM_PROVIDER = await ask('LLM_PROVIDER (openai/deepseek)', defaults.LLM_PROVIDER || 'openai');
  defaults.DEEPSEEK_API_KEY = await askSecret('DEEPSEEK_API_KEY', defaults.DEEPSEEK_API_KEY);
  defaults.DEEPSEEK_MODEL = await ask('DEEPSEEK_MODEL', defaults.DEEPSEEK_MODEL || 'deepseek-chat');

  defaults.FEISHU_APP_ID = await ask('FEISHU_APP_ID', defaults.FEISHU_APP_ID);
  defaults.FEISHU_APP_SECRET = await askSecret('FEISHU_APP_SECRET', defaults.FEISHU_APP_SECRET);
  defaults.FEISHU_BITABLE_APP_TOKEN = await ask(
    'FEISHU_BITABLE_APP_TOKEN',
    parsedFeishu.appToken || defaults.FEISHU_BITABLE_APP_TOKEN
  );
  defaults.FEISHU_BITABLE_TABLE_ID = await ask(
    'FEISHU_BITABLE_TABLE_ID',
    parsedFeishu.tableId || defaults.FEISHU_BITABLE_TABLE_ID
  );
  defaults.FEISHU_USE_LARK_CLI = await ask(
    'FEISHU_USE_LARK_CLI (true/false)',
    defaults.FEISHU_USE_LARK_CLI || 'false'
  );
  defaults.LARK_PROFILE = await ask('LARK_PROFILE', defaults.LARK_PROFILE);

  defaults.SHOPIFY_SHOP_DOMAIN = await ask(
    'SHOPIFY_SHOP_DOMAIN',
    normalizeShopDomain(defaults.SHOPIFY_SHOP_DOMAIN)
  );
  defaults.SHOPIFY_ADMIN_ACCESS_TOKEN = await askSecret(
    'SHOPIFY_ADMIN_ACCESS_TOKEN',
    defaults.SHOPIFY_ADMIN_ACCESS_TOKEN
  );
  defaults.SHOPIFY_CLIENT_ID = await ask('SHOPIFY_CLIENT_ID', defaults.SHOPIFY_CLIENT_ID);
  defaults.SHOPIFY_CLIENT_SECRET = await askSecret(
    'SHOPIFY_CLIENT_SECRET',
    defaults.SHOPIFY_CLIENT_SECRET
  );
  defaults.DRY_RUN = await ask('DRY_RUN (true/false)', defaults.DRY_RUN || 'true');

  writeFileSync(envPath, renderEnv(defaults));
  console.log(`Wrote ${envPath}. Run: node src/check-connections.js`);
} finally {
  rl.close();
}

async function ask(label, currentValue = '') {
  const suffix = currentValue ? ` [${currentValue}]` : '';
  const answer = await rl.question(`${label}${suffix}: `);
  return answer.trim() || currentValue || '';
}

async function askSecret(label, currentValue = '') {
  const masked = currentValue ? maskSecret(currentValue) : '';
  return ask(label, masked ? masked : '').then((answer) => {
    if (answer === masked) {
      return currentValue;
    }
    return answer;
  });
}

function parseEnvFile(path) {
  const env = {};
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const index = trimmed.indexOf('=');
    if (index === -1) {
      continue;
    }
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

function renderEnv(env) {
  const lines = [
    `OPENAI_API_KEY=${env.OPENAI_API_KEY || ''}`,
    `OPENAI_MODEL=${env.OPENAI_MODEL || 'gpt-4o-mini'}`,
    `LLM_PROVIDER=${env.LLM_PROVIDER || 'openai'}`,
    `DEEPSEEK_API_KEY=${env.DEEPSEEK_API_KEY || ''}`,
    `DEEPSEEK_MODEL=${env.DEEPSEEK_MODEL || 'deepseek-chat'}`,
    '',
    `FEISHU_APP_ID=${env.FEISHU_APP_ID || ''}`,
    `FEISHU_APP_SECRET=${env.FEISHU_APP_SECRET || ''}`,
    `FEISHU_BITABLE_APP_TOKEN=${env.FEISHU_BITABLE_APP_TOKEN || ''}`,
    `FEISHU_BITABLE_TABLE_ID=${env.FEISHU_BITABLE_TABLE_ID || ''}`,
    `LARK_CLI_PATH=${env.LARK_CLI_PATH || ''}`,
    `LARK_PROFILE=${env.LARK_PROFILE || ''}`,
    `FEISHU_USE_LARK_CLI=${env.FEISHU_USE_LARK_CLI || 'false'}`,
    '',
    '# Comma-separated Feishu field names used by the MVP.',
    `FEISHU_FIELD_SKU=${env.FEISHU_FIELD_SKU || 'SKU'}`,
    `FEISHU_FIELD_SHOPIFY_PRODUCT_ID=${
      env.FEISHU_FIELD_SHOPIFY_PRODUCT_ID || 'Shopify Product ID'
    }`,
    `FEISHU_FIELD_SHOPIFY_HANDLE=${env.FEISHU_FIELD_SHOPIFY_HANDLE || 'Shopify Handle'}`,
    `FEISHU_FIELD_SOURCE_DOC_URLS=${env.FEISHU_FIELD_SOURCE_DOC_URLS || 'Source Doc URLs'}`,
    `FEISHU_FIELD_SOURCE_NOTES=${env.FEISHU_FIELD_SOURCE_NOTES || 'Source Notes'}`,
    `FEISHU_FIELD_TARGET_MARKET=${env.FEISHU_FIELD_TARGET_MARKET || 'Target Market'}`,
    `FEISHU_FIELD_BRAND_VOICE=${env.FEISHU_FIELD_BRAND_VOICE || 'Brand Voice'}`,
    `FEISHU_FIELD_APPROVAL_STATUS=${env.FEISHU_FIELD_APPROVAL_STATUS || 'Approval Status'}`,
    `FEISHU_FIELD_DRAFT_JSON=${env.FEISHU_FIELD_DRAFT_JSON || 'AI Draft JSON'}`,
    `FEISHU_FIELD_DIFF_JSON=${env.FEISHU_FIELD_DIFF_JSON || 'Shopify Diff JSON'}`,
    `FEISHU_FIELD_LAST_ERROR=${env.FEISHU_FIELD_LAST_ERROR || 'Last Error'}`,
    `FEISHU_FIELD_LAST_SYNCED_AT=${env.FEISHU_FIELD_LAST_SYNCED_AT || 'Last Synced At'}`,
    '',
    `FEISHU_STATUS_READY=${env.FEISHU_STATUS_READY || 'Ready for AI'}`,
    `FEISHU_STATUS_PENDING_APPROVAL=${
      env.FEISHU_STATUS_PENDING_APPROVAL || 'Pending Approval'
    }`,
    `FEISHU_STATUS_APPROVED=${env.FEISHU_STATUS_APPROVED || 'Approved'}`,
    `FEISHU_STATUS_APPLIED=${env.FEISHU_STATUS_APPLIED || 'Applied'}`,
    `FEISHU_STATUS_ERROR=${env.FEISHU_STATUS_ERROR || 'Error'}`,
    '',
    `SHOPIFY_SHOP_DOMAIN=${normalizeShopDomain(env.SHOPIFY_SHOP_DOMAIN || '')}`,
    `SHOPIFY_ADMIN_ACCESS_TOKEN=${env.SHOPIFY_ADMIN_ACCESS_TOKEN || ''}`,
    `SHOPIFY_CLIENT_ID=${env.SHOPIFY_CLIENT_ID || ''}`,
    `SHOPIFY_CLIENT_SECRET=${env.SHOPIFY_CLIENT_SECRET || ''}`,
    `SHOPIFY_API_VERSION=${env.SHOPIFY_API_VERSION || '2026-04'}`,
    '',
    '# Optional safety switch. Leave true until credentials and field mapping are verified.',
    `DRY_RUN=${env.DRY_RUN || 'true'}`,
    ''
  ];

  return lines.join('\n');
}

function parseFeishuBitableUrl(value) {
  if (!value) {
    return {};
  }

  const appToken =
    value.match(/\/base\/([A-Za-z0-9]+)/)?.[1] ??
    value.match(/[?&](?:app_token|base_token)=([A-Za-z0-9]+)/)?.[1] ??
    value.match(/\/bitable\/([A-Za-z0-9]+)/)?.[1] ??
    '';
  const tableId = value.match(/[?&]table=(tbl[A-Za-z0-9]+)/)?.[1] ?? '';
  return { appToken, tableId };
}

function normalizeShopDomain(value) {
  return String(value || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
}

function maskSecret(value) {
  if (!value) {
    return '';
  }
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
