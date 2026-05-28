import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadDotEnv();

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const index = trimmed.indexOf('=');
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function readEnv(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }
  return value;
}

function readBoolean(name, fallback = false) {
  const value = readEnv(name);
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
}

export const config = {
  openai: {
    apiKey: readEnv('OPENAI_API_KEY'),
    model: readEnv('OPENAI_MODEL', 'gpt-4o-mini')
  },
  llmProvider: readEnv('LLM_PROVIDER', 'openai'),
  deepseek: {
    apiKey: readEnv('DEEPSEEK_API_KEY'),
    model: readEnv('DEEPSEEK_MODEL', 'deepseek-chat')
  },
  feishu: {
    appId: readEnv('FEISHU_APP_ID'),
    appSecret: readEnv('FEISHU_APP_SECRET'),
    bitableAppToken: readEnv('FEISHU_BITABLE_APP_TOKEN'),
    bitableTableId: readEnv('FEISHU_BITABLE_TABLE_ID'),
    useLarkCli: readBoolean('FEISHU_USE_LARK_CLI', false),
    larkCliPath: readEnv(
      'LARK_CLI_PATH',
      '/Users/ganzhen/Documents/Codex/2026-05-13/new-chat/tools/lark-cli/node_modules/.bin/lark-cli'
    ),
    larkProfile: readEnv('LARK_PROFILE', 'jira-tool-2'),
    fields: {
      sku: readEnv('FEISHU_FIELD_SKU', 'SKU'),
      shopifyProductId: readEnv('FEISHU_FIELD_SHOPIFY_PRODUCT_ID', 'Shopify 商品ID'),
      shopifyHandle: readEnv('FEISHU_FIELD_SHOPIFY_HANDLE', 'Shopify Handle'),
      sourceDocUrls: readEnv('FEISHU_FIELD_SOURCE_DOC_URLS', '资料文档链接'),
      sourceNotes: readEnv('FEISHU_FIELD_SOURCE_NOTES', '资料备注'),
      targetMarket: readEnv('FEISHU_FIELD_TARGET_MARKET', '目标市场'),
      brandVoice: readEnv('FEISHU_FIELD_BRAND_VOICE', '品牌语气'),
      approvalStatus: readEnv('FEISHU_FIELD_APPROVAL_STATUS', '审批状态'),
      draftJson: readEnv('FEISHU_FIELD_DRAFT_JSON', 'AI草稿JSON'),
      diffJson: readEnv('FEISHU_FIELD_DIFF_JSON', 'Shopify差异JSON'),
      lastError: readEnv('FEISHU_FIELD_LAST_ERROR', '最近错误'),
      lastSyncedAt: readEnv('FEISHU_FIELD_LAST_SYNCED_AT', '最近同步时间')
    },
    statuses: {
      ready: readEnv('FEISHU_STATUS_READY', '待生成'),
      pendingApproval: readEnv('FEISHU_STATUS_PENDING_APPROVAL', '待审批'),
      approved: readEnv('FEISHU_STATUS_APPROVED', '已批准'),
      applied: readEnv('FEISHU_STATUS_APPLIED', '已同步'),
      error: readEnv('FEISHU_STATUS_ERROR', '错误')
    }
  },
  shopify: {
    shopDomain: readEnv('SHOPIFY_SHOP_DOMAIN'),
    adminAccessToken: readEnv('SHOPIFY_ADMIN_ACCESS_TOKEN'),
    clientId: readEnv('SHOPIFY_CLIENT_ID'),
    clientSecret: readEnv('SHOPIFY_CLIENT_SECRET'),
    apiVersion: readEnv('SHOPIFY_API_VERSION', '2026-04')
  },
  dryRun: readBoolean('DRY_RUN', true)
};

export function requireEnv(paths) {
  const missing = [];

  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => current?.[key], config);
    if (value === undefined || value === '') {
      missing.push(path);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required config values: ${missing.join(', ')}`);
  }
}
