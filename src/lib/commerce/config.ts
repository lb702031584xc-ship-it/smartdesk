export type AmazonPaapiConfig = {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  marketplace: string;
  region: string;
  host: string;
};

export function getAmazonPaapiConfig(): AmazonPaapiConfig | null {
  const accessKey = process.env.AMAZON_PAAPI_ACCESS_KEY?.trim();
  const secretKey = process.env.AMAZON_PAAPI_SECRET_KEY?.trim();
  const partnerTag = process.env.AMAZON_PAAPI_PARTNER_TAG?.trim();
  if (!accessKey || !secretKey || !partnerTag) return null;
  return {
    accessKey,
    secretKey,
    partnerTag,
    marketplace: process.env.AMAZON_PAAPI_MARKETPLACE?.trim() || "www.amazon.com",
    region: process.env.AMAZON_PAAPI_REGION?.trim() || "us-east-1",
    host: process.env.AMAZON_PAAPI_HOST?.trim() || "webservices.amazon.com",
  };
}

export function isAmazonPaapiConfigured(): boolean {
  return getAmazonPaapiConfig() !== null;
}
