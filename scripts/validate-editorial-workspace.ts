/**
 * Unified Editorial Workspace validation (Phase 38).
 * Usage: npm run validate:editorial-workspace
 *
 * Confirms workspace view models compose existing layers without new mutations.
 */
import "./load-env-local";
import fs from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildEditorialWorkspaceLinks,
  editorialWorkspaceHref,
  getEditorialWorkspace,
  getEditorialWorkspaceIndex,
} from "../src/lib/editorial-workspace";
import {
  createWorkflowRecord,
  deleteEditorialWorkflowForTests,
  submitForReview,
} from "../src/lib/editorial-workflow";
import { updateProductEditorialFields } from "../src/lib/product-mutations";
import {
  createAdminProduct,
  deleteAdminProductRecord,
  getAdminProduct,
} from "../src/lib/admin/product-store";
import { blankProductV1 } from "../src/lib/admin/blank-product";
import { closeDb } from "../src/lib/db/client";
import { isDatabaseContentStore } from "../src/lib/content/store-config";
import { WorkspaceStatusPanel } from "../src/components/editorial/EditorialWorkspacePanels";
import { EditorialWorkspaceShell } from "../src/components/editorial/EditorialWorkspaceShell";
import type { ProductV1Document } from "../src/types/product-v1";

const PRODUCT_ID = "zz-phase38-workspace-product";
const ACTOR = "phase38-workspace@smartdesksetup.com";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function assertFile(rel: string) {
  assert(fs.existsSync(path.join(process.cwd(), rel)), `exists ${rel}`);
}

function ensureActorAdmin() {
  const admins = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  admins.add(ACTOR);
  process.env.ADMIN_EMAILS = [...admins].join(",");
}

async function cleanup() {
  await deleteEditorialWorkflowForTests("product", PRODUCT_ID).catch(() => undefined);
  await deleteAdminProductRecord(PRODUCT_ID).catch(() => undefined);
}

function testProduct(): ProductV1Document {
  return {
    ...blankProductV1(),
    id: PRODUCT_ID,
    identity: {
      name: "Phase 38 Workspace Fixture",
      brand: "SmartDesk Test",
      category: "accessories",
    },
    editorial: {
      role: "best-value",
      verdict: "Workspace before",
      bestFor: ["labs"],
      notFor: ["warehouses"],
    },
  };
}

async function main() {
  console.log("=== Route / component files ===");
  assertFile("src/types/editorial-workspace.ts");
  assertFile("src/lib/editorial-workspace.ts");
  assertFile("src/components/editorial/EditorialWorkspaceShell.tsx");
  assertFile("src/components/editorial/EditorialWorkspacePanels.tsx");
  assertFile("src/app/admin/products/[id]/workspace/page.tsx");
  assertFile("src/app/admin/articles/[id]/workspace/page.tsx");
  assertFile("src/app/dashboard/editorial/page.tsx");

  console.log("=== Pure: workspace links ===");
  const links = buildEditorialWorkspaceLinks("product", "demo-id");
  assert(links.length === 5, "five workspace surfaces");
  assert(
    links.some((l) => l.surface === "edit" && l.href.includes("/edit")),
    "edit link preserved",
  );
  assert(
    links.some((l) => l.surface === "workflow" && l.href.includes("/workflow")),
    "workflow link preserved",
  );
  assert(
    editorialWorkspaceHref("article", "x") === "/admin/articles/x/workspace",
    "article workspace href",
  );

  console.log("=== Index resolver (empty-safe) ===");
  const index = await getEditorialWorkspaceIndex();
  assert(typeof index.pendingCount === "number", "index pendingCount");
  assert(Array.isArray(index.recentActivity), "index activity");
  assert(Array.isArray(index.reviewQueue.items), "index review queue");

  const missing = await getEditorialWorkspace("product", "missing-phase38-id");
  assert(missing === undefined, "missing entity returns undefined");

  console.log("=== Shell rendering ===");
  const shellHtml = renderToStaticMarkup(
    React.createElement(
      EditorialWorkspaceShell,
      {
        entityType: "product",
        entityId: "demo",
        entityName: "Demo Product",
        links,
        activeSurface: "overview",
        listHref: "/admin/products",
        listLabel: "Products",
      },
      React.createElement("p", null, "Workspace body"),
    ),
  );
  assert(shellHtml.includes("Demo Product"), "shell renders entity name");
  assert(shellHtml.includes("Workspace"), "shell renders nav");

  if (!isDatabaseContentStore()) {
    console.log("\nSKIP integration: CONTENT_STORE is not database");
    console.log(`\nResults: ${passed} passed, ${failed} failed (partial)`);
    if (failed > 0) process.exit(1);
    console.log("Editorial workspace validation passed (pure + empty-safe).");
    return;
  }

  ensureActorAdmin();
  console.log("=== Integration: composed workspace ===");
  await cleanup();

  try {
    const created = await createAdminProduct(testProduct());
  assert(created.ok, "fixture product create");

  const beforeRec = await getAdminProduct(PRODUCT_ID);
  const mut = await updateProductEditorialFields({
    productId: PRODUCT_ID,
    changes: {
      editorial: {
        verdict: "Workspace after",
        role: "best-overall",
      },
    },
    expectedVersion: beforeRec!.version ?? 1,
    actor: ACTOR,
  });
  assert(mut.success, "controlled mutation for workspace activity");

  const wf = await createWorkflowRecord({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: ACTOR,
  });
  assert(wf.success, "workflow create");
  const submitted = await submitForReview({
    entityType: "product",
    entityId: PRODUCT_ID,
    actor: ACTOR,
  });
  assert(submitted.success, "submit for review");

  const workspace = await getEditorialWorkspace("product", PRODUCT_ID);
  assert(Boolean(workspace), "workspace resolves");
  assert(workspace!.entityName.includes("Phase 38"), "workspace entity name");
  assert(workspace!.revisionCount >= 1, "workspace revision count");
  assert(workspace!.workflowStatus === "review", "workspace workflow status");
  assert(workspace!.links.length === 5, "workspace links");
  assert(
    workspace!.recentActivity.some((a) => a.entityId === PRODUCT_ID),
    "workspace includes entity activity",
  );
  assert(
    workspace!.recentChanges.some((c) => c.entityId === PRODUCT_ID),
    "workspace includes entity changes",
  );

  const statusHtml = renderToStaticMarkup(
    React.createElement(WorkspaceStatusPanel, { workspace: workspace! }),
  );
  assert(statusHtml.includes("Operational status"), "status panel renders");
  assert(statusHtml.includes("review"), "status panel shows workflow");
  } finally {
    await cleanup();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Editorial workspace validation passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb().catch(() => undefined);
  });
