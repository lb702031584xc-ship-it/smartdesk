/**
 * Content block registry validation (Phase 39).
 * Usage: npm run validate:content-blocks
 */
import {
  CONTENT_BLOCK_REGISTRY,
  CONTENT_BLOCK_TYPES,
  validateContentBlocks,
} from "../src/lib/content-blocks";
import type { ContentBlock } from "../src/types/content-document";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function headingBlock(id: string, content: string): ContentBlock {
  return {
    id,
    type: "heading",
    level: 2,
    content,
    sourceMarkdown: `## ${content}`,
  };
}

function productRefBlock(id: string, productId: string): ContentBlock {
  return {
    id,
    type: "product-reference",
    productId,
    heading: "Best Overall",
    content: `Pick \`${productId}\``,
    sourceMarkdown: `## Best Overall\n\nPick \`${productId}\``,
  };
}

async function main() {
  console.log("=== Registry ===");
  assert(CONTENT_BLOCK_TYPES.length === 6, "six block types");
  for (const type of CONTENT_BLOCK_TYPES) {
    assert(Boolean(CONTENT_BLOCK_REGISTRY[type]), `registry entry: ${type}`);
  }

  console.log("=== Valid blocks ===");
  const valid = validateContentBlocks(
    [
      headingBlock("h1", "Introduction"),
      {
        id: "p1",
        type: "paragraph",
        content: "Hello world.",
        sourceMarkdown: "Hello world.",
      },
      productRefBlock("pr1", "flexispot-compact"),
      {
        id: "t1",
        type: "comparison-table",
        markdown: "| A | B |\n|---|---|\n| 1 | 2 |",
        sourceMarkdown: "| A | B |\n|---|---|\n| 1 | 2 |",
      },
      {
        id: "pc1",
        type: "pros-cons",
        pros: ["Compact"],
        cons: ["Pricey"],
        sourceMarkdown: "### Pros\n- Compact\n\n### Cons\n- Pricey",
      },
      {
        id: "c1",
        type: "callout",
        variant: "tip",
        content: "Measure your desk first.",
        sourceMarkdown: "> Measure your desk first.",
      },
    ],
    { knownProductIds: ["flexispot-compact"] },
  );
  assert(valid.valid, "valid block set passes");

  console.log("=== Invalid blocks ===");
  const unknownType = validateContentBlocks([
    { id: "x", type: "html-embed", sourceMarkdown: "<div/>" },
  ]);
  assert(!unknownType.valid, "unknown block type rejected");

  const missingProduct = validateContentBlocks(
    [productRefBlock("pr2", "")],
    { knownProductIds: ["flexispot-compact"] },
  );
  assert(!missingProduct.valid, "missing productId rejected");

  const badProduct = validateContentBlocks(
    [productRefBlock("pr3", "does-not-exist-xyz")],
    { knownProductIds: ["flexispot-compact"] },
  );
  assert(!badProduct.valid, "unknown productId rejected");

  const knownProduct = validateContentBlocks(
    [productRefBlock("pr4", "flexispot-compact")],
    { knownProductIds: ["flexispot-compact"] },
  );
  assert(knownProduct.valid, "valid product-reference passes");

  const notArray = validateContentBlocks({ type: "paragraph" });
  assert(!notArray.valid, "non-array blocks rejected");

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Content blocks validation passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
