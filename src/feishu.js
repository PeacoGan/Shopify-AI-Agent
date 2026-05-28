import { execFileSync, spawnSync } from 'node:child_process';

const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';

export class FeishuClient {
  constructor({ appId, appSecret, useLarkCli, larkCliPath, larkProfile }) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.useLarkCli = useLarkCli;
    this.larkCliPath = larkCliPath;
    this.larkProfile = larkProfile;
    this.tenantAccessToken = null;
    this.tokenExpiresAt = 0;
  }

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    };

    if (options.auth !== false) {
      headers.Authorization = `Bearer ${await this.getTenantAccessToken()}`;
    }

    const { status, body } = requestJsonWithCurl(`${FEISHU_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body
    });

    if (status < 200 || status >= 300 || (body.code !== undefined && body.code !== 0)) {
      throw new Error(`Feishu API error ${status}: ${JSON.stringify(body)}`);
    }

    return body;
  }

  async getTenantAccessToken() {
    const now = Date.now();
    if (this.tenantAccessToken && now < this.tokenExpiresAt) {
      return this.tenantAccessToken;
    }

    const body = await this.request('/auth/v3/tenant_access_token/internal', {
      auth: false,
      method: 'POST',
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret
      })
    });

    this.tenantAccessToken = body.tenant_access_token;
    this.tokenExpiresAt = now + Math.max(60, body.expire - 120) * 1000;
    return this.tenantAccessToken;
  }

  async searchRecords({ appToken, tableId, filter, pageSize = 50 }) {
    if (this.useLarkCli) {
      return this.searchRecordsWithLarkCli({ appToken, tableId, filter, pageSize });
    }

    const records = [];
    let pageToken;

    do {
      const query = new URLSearchParams({ page_size: String(pageSize) });
      if (pageToken) {
        query.set('page_token', pageToken);
      }

      const body = await this.request(
        `/bitable/v1/apps/${appToken}/tables/${tableId}/records/search?${query}`,
        {
          method: 'POST',
          body: JSON.stringify(filter ? { filter } : {})
        }
      );

      records.push(...(body.data?.items ?? []));
      pageToken = body.data?.has_more ? body.data?.page_token : undefined;
    } while (pageToken);

    return records;
  }

  async updateRecord({ appToken, tableId, recordId, fields }) {
    if (this.useLarkCli) {
      return this.updateRecordWithLarkCli({ appToken, tableId, recordId, fields });
    }

    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ fields })
    });
  }

  async listFields({ appToken, tableId }) {
    const fields = [];
    let pageToken;

    do {
      const query = new URLSearchParams({ page_size: '100' });
      if (pageToken) {
        query.set('page_token', pageToken);
      }
      const body = await this.request(
        `/bitable/v1/apps/${appToken}/tables/${tableId}/fields?${query}`
      );
      fields.push(...(body.data?.items ?? []));
      pageToken = body.data?.has_more ? body.data?.page_token : undefined;
    } while (pageToken);

    return fields;
  }

  async updateField({ appToken, tableId, fieldId, field }) {
    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(field)
    });
  }

  async createBitable({ name, folderToken, timeZone = 'Asia/Shanghai' }) {
    const body = {
      name,
      time_zone: timeZone
    };
    if (folderToken) {
      body.folder_token = folderToken;
    }

    return this.request('/bitable/v1/apps', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async createTable({ appToken, name, fields }) {
    return this.request(`/bitable/v1/apps/${appToken}/tables`, {
      method: 'POST',
      body: JSON.stringify({
        table: {
          name,
          default_view_name: '全部商品',
          fields
        }
      })
    });
  }

  async getDocMarkdown(documentId) {
    if (this.useLarkCli) {
      return this.getDocMarkdownWithLarkCli(documentId);
    }

    const query = new URLSearchParams({
      doc_token: documentId,
      doc_type: 'docx',
      content_type: 'markdown',
      lang: 'zh'
    });
    const body = await this.request(`/docs/v1/content?${query}`);
    return body.data?.content ?? '';
  }

  searchRecordsWithLarkCli({ appToken, tableId, filter, pageSize }) {
    const output = this.runLarkCli([
      'base',
      '+record-list',
      '--base-token',
      appToken,
      '--table-id',
      tableId,
      '--limit',
      String(pageSize),
      '--format',
      'json'
    ]);
    const body = JSON.parse(output);
    const records = normalizeLarkCliRecords(body);

    if (!filter?.conditions?.length) {
      return records;
    }

    return records.filter((record) =>
      filter.conditions.every((condition) => {
        const actual = normalizeFieldValue(record.fields?.[condition.field_name]);
        const expected = normalizeFieldValue(condition.value?.[0]);
        return actual === expected;
      })
    );
  }

  updateRecordWithLarkCli({ appToken, tableId, recordId, fields }) {
    const payload = {
      record_id_list: [recordId],
      patch: fields
    };

    const output = this.runLarkCli([
      'base',
      '+record-batch-update',
      '--base-token',
      appToken,
      '--table-id',
      tableId,
      '--json',
      JSON.stringify(payload)
    ]);

    return JSON.parse(output);
  }

  getDocMarkdownWithLarkCli(documentId) {
    const output = this.runLarkCli([
      'docs',
      '+fetch',
      '--doc',
      documentId,
      '--format',
      'json',
      '--api-version',
      'v2'
    ]);

    const body = JSON.parse(output);
    return (
      body.data?.content ??
      body.content ??
      body.markdown ??
      body.data?.markdown ??
      JSON.stringify(body.data ?? body)
    );
  }

  runLarkCli(args) {
    const output = execFileSync(this.larkCliPath, [...args, '--profile', this.larkProfile], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return output.trim();
  }
}

function requestJsonWithCurl(url, { method, headers, body }) {
  const args = ['-sS', '-m', '30', '-w', '\\n%{http_code}', '-X', method];
  for (const [key, value] of Object.entries(headers)) {
    args.push('-H', `${key}: ${value}`);
  }
  if (body !== undefined) {
    args.push('--data-binary', body);
  }
  args.push(url);

  const result = spawnSync('curl', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`curl failed ${result.status}: ${result.stderr}`);
  }

  const output = result.stdout.trimEnd();
  const splitAt = output.lastIndexOf('\n');
  const responseText = splitAt === -1 ? output : output.slice(0, splitAt);
  const status = Number(splitAt === -1 ? 0 : output.slice(splitAt + 1));
  const parsed = responseText ? JSON.parse(responseText) : {};

  return { status, body: parsed };
}

function normalizeLarkCliRecords(body) {
  const items = body.data?.items ?? body.items ?? body.records ?? [];
  return items.map((item) => ({
    record_id: item.record_id ?? item.recordId ?? item.id,
    fields: item.fields ?? item.record?.fields ?? {}
  }));
}

export function extractFeishuDocumentIds(value) {
  const text = normalizeFieldValue(value);
  if (!text) {
    return [];
  }

  const ids = new Set();
  const urlPattern =
    /https?:\/\/[^\s/]+(?:feishu\.cn|larksuite\.com)\/(?:docx|docs)\/([A-Za-z0-9]+)/g;
  const tokenPattern = /\b(?:docx|docs)_?([A-Za-z0-9]{12,})\b/g;

  for (const match of text.matchAll(urlPattern)) {
    ids.add(match[1]);
  }

  for (const match of text.matchAll(tokenPattern)) {
    ids.add(match[1]);
  }

  return [...ids];
}

export function normalizeFieldValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFieldValue).filter(Boolean).join('\n');
  }

  if (typeof value === 'object') {
    if (value.text) {
      return normalizeFieldValue(value.text);
    }
    if (value.name) {
      return normalizeFieldValue(value.name);
    }
    if (value.link) {
      return normalizeFieldValue(value.link);
    }
    return JSON.stringify(value);
  }

  return String(value);
}

export function makeEqualsFilter(fieldName, value) {
  return {
    conjunction: 'and',
    conditions: [
      {
        field_name: fieldName,
        operator: 'is',
        value: [value]
      }
    ]
  };
}
