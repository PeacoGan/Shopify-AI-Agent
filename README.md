# Shopify AI Agent MVP

This MVP reads product source material from Feishu, uses AI to draft an English Shopify product page, writes the draft and diff back to Feishu for approval, then updates the matching Shopify draft product after approval.

## 中文快速开始

当前工程已经生成了 `.env` 模板文件。先把下面这些值填进去：

| `.env` key | 从哪里获取 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | 默认 `gpt-4o-mini`，可按账号可用模型调整 |
| `LLM_PROVIDER` | `openai` 或 `deepseek` |
| `DEEPSEEK_API_KEY` | 使用 DeepSeek 时填写 |
| `FEISHU_APP_ID` | 飞书开放平台自建应用的 App ID |
| `FEISHU_APP_SECRET` | 飞书开放平台自建应用的 App Secret |
| `FEISHU_BITABLE_APP_TOKEN` | 飞书多维表格 URL 里的 `base`/`app_token` |
| `FEISHU_BITABLE_TABLE_ID` | 多维表格数据表 ID |
| `FEISHU_USE_LARK_CLI` | 新机器人建议保持 `false`，用 App ID/Secret 直连 |
| `LARK_PROFILE` | 仅本机复用 lark-cli 授权时需要，新机器人模式不用填 |
| `SHOPIFY_SHOP_DOMAIN` | 例如 `your-shop.myshopify.com` |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | 旧版 custom app 的 Admin API access token |
| `SHOPIFY_CLIENT_ID` | 新版 Dev Dashboard app 的 Client ID |
| `SHOPIFY_CLIENT_SECRET` | 新版 Dev Dashboard app 的 Client secret |

第一次不要改 `DRY_RUN=true`。填完后按顺序执行：

```bash
node src/setup-env.js
node src/check-connections.js
node src/draft-products.js
```

确认飞书里生成的 `AI Draft JSON` 和 `Shopify Diff JSON` 没问题后，把对应行的 `Approval Status` 改成 `Approved`。再把 `.env` 里的 `DRY_RUN=false`，执行：

```bash
node src/apply-approved.js
```

脚本只会更新 Shopify 状态为 `DRAFT` 的商品。

## 新飞书机器人配置

在飞书开放平台创建一个自建应用，建议命名为 `Shopify AI Agent`。创建后把 App ID 和 App Secret 填入 `.env`：

```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_USE_LARK_CLI=false
```

权限建议先开最小集合：

- 多维表格记录读取
- 多维表格记录写入
- 云文档内容读取
- 如果资料在知识库或云空间里，还需要给应用开对应文档访问权限，并把应用加入目标文档/多维表格的协作者

多维表格 URL 一般包含两类值：

- `FEISHU_BITABLE_APP_TOKEN`：URL 里的 `base`/`app_token`
- `FEISHU_BITABLE_TABLE_ID`：URL 参数或页面里的 `table=tbl...`

也可以让脚本创建一张新表：

```bash
node src/create-feishu-base.js
```

默认会创建：

- 多维表格：`Shopify AI 商品运营审批台`
- 数据表：`商品审批`

## Workflow

1. Feishu Bitable contains one row per SKU.
2. Rows with `Approval Status = Ready for AI` are processed by `node src/draft-products.js`.
3. The script reads product notes and linked Feishu docs, generates English Shopify content, and writes:
   - `AI Draft JSON`
   - `Shopify Diff JSON`
   - `Approval Status = Pending Approval`
4. An operator reviews the draft in Feishu and changes `Approval Status` to `Approved`.
5. `node src/apply-approved.js` updates only matching Shopify products whose status is `DRAFT`.
6. The row becomes `Applied`, or `Error` with `Last Error`.

## Feishu Bitable fields

Create these fields or change the names in `.env`:

| Field | Purpose |
| --- | --- |
| `SKU` | Product SKU for tracking. |
| `Shopify Product ID` | Shopify product numeric ID or `gid://shopify/Product/...`. Preferred. |
| `Shopify Handle` | Fallback lookup if product ID is empty. |
| `Source Doc URLs` | Feishu docx URLs that contain long product material. |
| `Source Notes` | Short product facts, specs, positioning, constraints. |
| `Target Market` | Example: `US`, `UK`, `EU`. |
| `Brand Voice` | Example: `clear, premium, practical`. |
| `Approval Status` | `Ready for AI`, `Pending Approval`, `Approved`, `Applied`, `Error`. |
| `AI Draft JSON` | Generated Shopify content for review. |
| `Shopify Diff JSON` | Difference between current Shopify draft and AI draft. |
| `Last Error` | Error details. |
| `Last Synced At` | ISO timestamp. |

## Setup

```bash
cp .env.example .env
```

Fill `.env` with:

- OpenAI API key.
- OpenAI model. The default is `gpt-4o-mini`; change it in `.env` if your account uses a newer preferred model.
- Feishu custom app ID and secret.
- Feishu Bitable app token and table ID.
- Shopify custom app Admin API token.

Keep `DRY_RUN=true` until one row has been verified end to end.

## Feishu permissions

The Feishu app needs access to:

- Read and write Bitable records.
- Read linked docx Markdown content.
- Access the workspace where the table and docs live.

The current implementation uses Feishu tenant access token auth and assumes the app has been granted access to the target table and documents.

## Shopify permissions

Create a Shopify custom app with the minimum Admin API scopes needed for your store, typically:

- `read_products`
- `write_products`

The script refuses to update products unless Shopify reports `status = DRAFT`.

## Commands

Check credentials and API connectivity:

```bash
node src/setup-env.js
node src/check-connections.js
```

Generate drafts and write them back to Feishu:

```bash
node src/draft-products.js
```

Apply rows approved in Feishu to Shopify draft products:

```bash
node src/apply-approved.js
```

Syntax check:

```bash
for file in src/*.js; do node --check "$file"; done
```

If your environment has `npm`, the equivalent shortcuts are `npm run draft`, `npm run apply`, and `npm run check`.

## Safety defaults

- `DRY_RUN=true` by default.
- Shopify updates are blocked unless the product is `DRAFT`.
- Generated content is stored as JSON in Feishu before Shopify is changed.
- The AI prompt explicitly avoids inventing certifications, compatibility, warranty terms, discounts, medical claims, or performance metrics.

## Production hardening

For production, add:

- Scheduled jobs or webhook-triggered runs.
- A richer Feishu approval process if Bitable status is not enough.
- Field-level allowlists for Shopify updates.
- Versioned backups of old Shopify product content.
- Slack/Feishu bot notifications for errors.
- Tests with mocked Feishu, OpenAI, and Shopify responses.
