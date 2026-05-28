const productPageSchema = {
  name: 'shopify_product_page_draft',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: {
        type: 'string',
        description: 'English Shopify product title, concise and customer-facing.'
      },
      descriptionHtml: {
        type: 'string',
        description: 'Production-ready Shopify HTML product description.'
      },
      bullets: {
        type: 'array',
        items: { type: 'string' }
      },
      seoTitle: {
        type: 'string',
        description: 'SEO title, ideally under 70 characters.'
      },
      seoDescription: {
        type: 'string',
        description: 'Meta description, ideally under 160 characters.'
      },
      tags: {
        type: 'array',
        items: { type: 'string' }
      },
      specifications: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            value: { type: 'string' }
          },
          required: ['name', 'value']
        }
      },
      faq: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' }
          },
          required: ['question', 'answer']
        }
      },
      sourceGaps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Missing facts or weak source material that need human review.'
      }
    },
    required: [
      'title',
      'descriptionHtml',
      'bullets',
      'seoTitle',
      'seoDescription',
      'tags',
      'specifications',
      'faq',
      'sourceGaps'
    ]
  }
};

export class ProductDrafter {
  constructor({ provider, openai, deepseek }) {
    this.provider = provider;
    this.openai = openai;
    this.deepseek = deepseek;
  }

  async draftEnglishProductPage({ sku, targetMarket, brandVoice, sourceNotes, sourceDocuments }) {
    if (this.provider === 'deepseek') {
      return this.draftWithDeepSeek({ sku, targetMarket, brandVoice, sourceNotes, sourceDocuments });
    }

    const body = await fetchJsonWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openai.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
      model: this.openai.model,
      input: [
        {
          role: 'system',
          content:
            'You are an ecommerce product content specialist. Create accurate English Shopify product page content only from the provided source material. Do not invent certifications, compatibility, warranty terms, discounts, medical claims, or performance metrics. If source material is missing, record the gap in sourceGaps.'
        },
        {
          role: 'user',
          content: [
            `SKU: ${sku || 'Unknown'}`,
            `Target market: ${targetMarket || 'US'}`,
            `Brand voice: ${brandVoice || 'clear, premium, practical'}`,
            'Source notes:',
            sourceNotes || '(none)',
            'Source documents:',
            sourceDocuments || '(none)'
          ].join('\n\n')
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          ...productPageSchema
        }
      }
      })
    });
    if (!body.ok || body.payload.error) {
      throw new Error(
        `OpenAI Responses API error ${body.status}: ${JSON.stringify(body.payload)}`
      );
    }

    return JSON.parse(extractOutputText(body.payload));
  }

  async draftWithDeepSeek({ sku, targetMarket, brandVoice, sourceNotes, sourceDocuments }) {
    const body = await fetchJsonWithTimeout('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.deepseek.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.deepseek.model,
        temperature: 0.2,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'You are an ecommerce product content specialist.',
              'Create accurate English Shopify product page content only from the provided source material.',
              'Do not invent certifications, compatibility, warranty terms, discounts, medical claims, or performance metrics.',
              'Only output valid JSON with this exact shape:',
              JSON.stringify(exampleProductDraftShape())
            ].join('\n')
          },
          {
            role: 'user',
            content: [
              `SKU: ${sku || 'Unknown'}`,
              `Target market: ${targetMarket || 'US'}`,
              `Brand voice: ${brandVoice || 'clear, premium, practical'}`,
              'Source notes:',
              sourceNotes || '(none)',
              'Source documents:',
              sourceDocuments || '(none)'
            ].join('\n\n')
          }
        ]
      })
    });

    if (!body.ok || body.payload.error) {
      throw new Error(`DeepSeek API error ${body.status}: ${JSON.stringify(body.payload)}`);
    }

    return normalizeDraft(JSON.parse(body.payload.choices?.[0]?.message?.content ?? '{}'));
  }
}

async function fetchJsonWithTimeout(url, options, timeoutMs = 90_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      status: response.status,
      payload
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractOutputText(response) {
  if (response.output_text) {
    return response.output_text;
  }

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('');

  if (!text) {
    throw new Error(`OpenAI response did not include output text: ${JSON.stringify(response)}`);
  }

  return text;
}

function exampleProductDraftShape() {
  return {
    title: 'string',
    descriptionHtml: '<section><h2>...</h2><p>...</p></section>',
    bullets: ['string'],
    seoTitle: 'string',
    seoDescription: 'string',
    tags: ['string'],
    specifications: [{ name: 'string', value: 'string' }],
    faq: [{ question: 'string', answer: 'string' }],
    sourceGaps: ['string']
  };
}

function normalizeDraft(draft) {
  const normalized = {
    title: String(draft.title ?? ''),
    descriptionHtml: String(draft.descriptionHtml ?? ''),
    bullets: Array.isArray(draft.bullets) ? draft.bullets.map(String) : [],
    seoTitle: String(draft.seoTitle ?? ''),
    seoDescription: String(draft.seoDescription ?? ''),
    tags: Array.isArray(draft.tags) ? draft.tags.map(String) : [],
    specifications: Array.isArray(draft.specifications)
      ? draft.specifications.map((item) => ({
          name: String(item.name ?? ''),
          value: String(item.value ?? '')
        }))
      : [],
    faq: Array.isArray(draft.faq)
      ? draft.faq.map((item) => ({
          question: String(item.question ?? ''),
          answer: String(item.answer ?? '')
        }))
      : [],
    sourceGaps: Array.isArray(draft.sourceGaps) ? draft.sourceGaps.map(String) : []
  };

  const requiredStrings = ['title', 'descriptionHtml', 'seoTitle', 'seoDescription'];
  for (const key of requiredStrings) {
    if (!normalized[key]) {
      throw new Error(`AI draft missing required field: ${key}`);
    }
  }

  return normalized;
}
