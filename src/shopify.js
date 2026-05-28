export class ShopifyClient {
  constructor({ shopDomain, adminAccessToken, apiVersion }) {
    this.endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
    this.adminAccessToken = adminAccessToken;
  }

  async graphql(query, variables = {}) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.adminAccessToken
      },
      body: JSON.stringify({ query, variables })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.errors) {
      throw new Error(`Shopify GraphQL error ${response.status}: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  async getProductById(productId) {
    const data = await this.graphql(
      `query ProductById($id: ID!) {
        product(id: $id) {
          id
          handle
          title
          descriptionHtml
          status
          tags
          seo {
            title
            description
          }
        }
      }`,
      { id: normalizeProductGid(productId) }
    );

    return data.product;
  }

  async getShop() {
    const data = await this.graphql(
      `query ShopInfo {
        shop {
          name
          myshopifyDomain
        }
      }`
    );

    return data.shop;
  }

  async getProductByHandle(handle) {
    const data = await this.graphql(
      `query ProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          handle
          title
          descriptionHtml
          status
          tags
          seo {
            title
            description
          }
        }
      }`,
      { handle }
    );

    return data.productByHandle;
  }

  async updateProduct(productId, draft) {
    const data = await this.graphql(
      `mutation ProductUpdate($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product {
            id
            handle
            title
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        product: {
          id: normalizeProductGid(productId),
          title: draft.title,
          descriptionHtml: draft.descriptionHtml,
          tags: draft.tags,
          seo: {
            title: draft.seoTitle,
            description: draft.seoDescription
          }
        }
      }
    );

    const errors = data.productUpdate.userErrors;
    if (errors.length > 0) {
      throw new Error(`Shopify productUpdate userErrors: ${JSON.stringify(errors)}`);
    }

    return data.productUpdate.product;
  }

  async setMetafields(productId, draft) {
    const metafields = [
      {
        ownerId: normalizeProductGid(productId),
        namespace: 'custom',
        key: 'ai_product_page_faq',
        type: 'json',
        value: JSON.stringify(draft.faq)
      },
      {
        ownerId: normalizeProductGid(productId),
        namespace: 'custom',
        key: 'ai_product_page_specs',
        type: 'json',
        value: JSON.stringify(draft.specifications)
      },
      {
        ownerId: normalizeProductGid(productId),
        namespace: 'custom',
        key: 'ai_product_page_bullets',
        type: 'json',
        value: JSON.stringify(draft.bullets)
      }
    ];

    const data = await this.graphql(
      `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      { metafields }
    );

    const errors = data.metafieldsSet.userErrors;
    if (errors.length > 0) {
      throw new Error(`Shopify metafieldsSet userErrors: ${JSON.stringify(errors)}`);
    }

    return data.metafieldsSet.metafields;
  }
}

export function normalizeProductGid(productId) {
  if (!productId) {
    return productId;
  }

  if (productId.startsWith('gid://shopify/Product/')) {
    return productId;
  }

  return `gid://shopify/Product/${productId}`;
}

export function summarizeProductDiff(current, draft) {
  return {
    status: {
      from: current?.status ?? null,
      to: current?.status ?? null
    },
    title: {
      from: current?.title ?? '',
      to: draft.title
    },
    descriptionHtml: {
      from: current?.descriptionHtml ?? '',
      to: draft.descriptionHtml
    },
    tags: {
      from: current?.tags ?? [],
      to: draft.tags
    },
    seoTitle: {
      from: current?.seo?.title ?? '',
      to: draft.seoTitle
    },
    seoDescription: {
      from: current?.seo?.description ?? '',
      to: draft.seoDescription
    },
    metafields: {
      ai_product_page_faq: draft.faq,
      ai_product_page_specs: draft.specifications,
      ai_product_page_bullets: draft.bullets
    }
  };
}
