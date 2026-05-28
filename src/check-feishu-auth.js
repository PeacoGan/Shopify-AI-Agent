import { config, requireEnv } from './config.js';
import { FeishuClient } from './feishu.js';

try {
  requireEnv(['feishu.appId', 'feishu.appSecret']);

  const feishu = new FeishuClient(config.feishu);
  const token = await feishu.getTenantAccessToken();
  console.log(`Feishu auth OK. Tenant token acquired, length=${token.length}.`);
} catch (error) {
  console.error(`Fatal: ${error.message}`);
  process.exitCode = 1;
}
