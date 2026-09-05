import type {
  ProductAccessorySpecsV1,
  ProductChairSpecsV1,
  ProductDeskSpecsV1,
  ProductMonitorSpecsV1,
  ProductSpecsV1,
  ProductV1Document,
} from "@/types/product-v1";
import {
  omitEmptyObject,
  parseOptionalNumber,
  trimToUndefined,
  uniqueStrings,
} from "./form-utils";

function compactBlock<T extends object>(block: T | undefined): T | undefined {
  if (!block) return undefined;
  return omitEmptyObject(block as Record<string, unknown>) as T | undefined;
}

function normalizeDesk(desk?: ProductDeskSpecsV1): ProductDeskSpecsV1 | undefined {
  return compactBlock({
    adjustable: desk?.adjustable,
    heightRangeIn: trimToUndefined(desk?.heightRangeIn),
    motor: trimToUndefined(desk?.motor),
    weightCapacityLb: parseOptionalNumber(desk?.weightCapacityLb),
    widthIn: parseOptionalNumber(desk?.widthIn),
    depthIn: parseOptionalNumber(desk?.depthIn),
    assemblyTimeMin: parseOptionalNumber(desk?.assemblyTimeMin),
  });
}

function normalizeChair(chair?: ProductChairSpecsV1): ProductChairSpecsV1 | undefined {
  return compactBlock({
    seatHeightRangeIn: trimToUndefined(chair?.seatHeightRangeIn),
    lumbarSupport: chair?.lumbarSupport,
    lumbarType: trimToUndefined(chair?.lumbarType),
    armrest: chair?.armrest,
    armrestAdjustable: chair?.armrestAdjustable,
    armrestRemovable: chair?.armrestRemovable,
    recline: chair?.recline,
    meshBack: chair?.meshBack,
    weightCapacityLb: parseOptionalNumber(chair?.weightCapacityLb),
    widthIn: parseOptionalNumber(chair?.widthIn),
    depthIn: parseOptionalNumber(chair?.depthIn),
    heightIn: parseOptionalNumber(chair?.heightIn),
    adjustable: chair?.adjustable,
    assemblyTimeMin: parseOptionalNumber(chair?.assemblyTimeMin),
  });
}

function normalizeMonitor(monitor?: ProductMonitorSpecsV1): ProductMonitorSpecsV1 | undefined {
  return compactBlock({
    sizeIn: parseOptionalNumber(monitor?.sizeIn),
    resolution: trimToUndefined(monitor?.resolution),
    panel: trimToUndefined(monitor?.panel),
    refreshRate: parseOptionalNumber(monitor?.refreshRate),
  });
}

function normalizeAccessory(
  accessory?: ProductAccessorySpecsV1,
): ProductAccessorySpecsV1 | undefined {
  return compactBlock({
    type: trimToUndefined(accessory?.type),
    maxWeightLb: parseOptionalNumber(accessory?.maxWeightLb),
    monitorCount: parseOptionalNumber(accessory?.monitorCount),
  });
}

function normalizeSpecs(specs?: ProductSpecsV1): ProductSpecsV1 | undefined {
  if (!specs) return undefined;
  const dimensions = compactBlock({
    widthIn: parseOptionalNumber(specs.dimensions?.widthIn),
    depthIn: parseOptionalNumber(specs.dimensions?.depthIn),
    heightIn: parseOptionalNumber(specs.dimensions?.heightIn),
  });
  return compactBlock({
    dimensions,
    weightLb: parseOptionalNumber(specs.weightLb),
    desk: normalizeDesk(specs.desk),
    chair: normalizeChair(specs.chair),
    monitor: normalizeMonitor(specs.monitor),
    accessory: normalizeAccessory(specs.accessory),
  });
}

export function normalizeProductV1(product: ProductV1Document): ProductV1Document {
  const related = uniqueStrings(product.relationships?.relatedProducts)?.filter(
    (id) => id !== product.id,
  );

  return {
    schemaVersion: 1,
    id: product.id.trim(),
    identity: {
      name: product.identity.name.trim(),
      brand: product.identity.brand.trim(),
      model: trimToUndefined(product.identity.model),
      category: product.identity.category,
    },
    classification: compactBlock({
      subcategory: trimToUndefined(product.classification?.subcategory),
      tags: uniqueStrings(product.classification?.tags),
    }),
    editorial: compactBlock({
      role: product.editorial?.role,
      verdict: trimToUndefined(product.editorial?.verdict),
      description: trimToUndefined(product.editorial?.description),
      bestFor: uniqueStrings(product.editorial?.bestFor),
      notFor: uniqueStrings(product.editorial?.notFor),
      pros: uniqueStrings(product.editorial?.pros),
      cons: uniqueStrings(product.editorial?.cons),
      featured: product.editorial?.featured,
    }),
    commerce: compactBlock({
      asin: trimToUndefined(product.commerce?.asin),
      amazonUrl: trimToUndefined(product.commerce?.amazonUrl),
      priceRange: trimToUndefined(product.commerce?.priceRange),
      availability: product.commerce?.availability,
      lastChecked: trimToUndefined(product.commerce?.lastChecked),
    }),
    media: compactBlock({
      primary: trimToUndefined(product.media?.primary),
      gallery: uniqueStrings(product.media?.gallery),
    }),
    specs: normalizeSpecs(product.specs),
    review: compactBlock({
      slug: trimToUndefined(product.review?.slug),
      rating: parseOptionalNumber(product.review?.rating),
      summary: trimToUndefined(product.review?.summary),
    }),
    comparison: compactBlock({
      compareReady: product.comparison?.compareReady,
      keyFactors: uniqueStrings(product.comparison?.keyFactors),
    }),
    relationships: compactBlock({
      relatedProducts: related,
    }),
  };
}
