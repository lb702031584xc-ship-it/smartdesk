"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAdminProductAction,
  loadAdminProductAction,
  saveAdminProductAction,
} from "@/lib/admin/actions";
import { blankProductV1 } from "@/lib/admin/blank-product";
import {
  PRODUCT_AVAILABILITY,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_RATING_SCALE,
  PRODUCT_ROLES,
  type AdminProductOption,
} from "@/lib/admin/editor-constants";
import { suggestProductId } from "@/lib/admin/product-id";
import { normalizeProductV1 } from "@/lib/admin/normalize-product";
import {
  highRiskProductChanges,
  productChangeSummary,
} from "@/lib/admin/change-summary";
import { productLocalHints } from "@/lib/admin/local-hints";
import { saveRefreshStatusDetail } from "@/lib/admin/save-feedback";
import { isObviousPlaceholderAsin } from "@/lib/commerce/asin";
import { isAmazonSearchUrl } from "@/lib/admin/editorial-signals";
import type { AdminSaveResult, AdminWriteMode } from "@/lib/admin/types";
import type {
  ProductAvailabilityV1,
  ProductCategoryV1,
  ProductEditorialRoleV1,
  ProductV1Document,
} from "@/types/product-v1";
import { AdminSection } from "@/components/admin/AdminSection";
import {
  CanonicalJsonPreview,
  ChangeSummary,
  CreateSummary,
  EditorToolbar,
  ValidationSummary,
} from "@/components/admin/EditorChrome";
import {
  CheckboxField,
  NumberField,
  RepeatableStrings,
  SelectField,
  TextAreaField,
  TextField,
  ReadOnlyField,
} from "@/components/admin/EditorFields";
import { UnsavedChangesGuard } from "@/components/admin/UnsavedChangesGuard";
import { MaintenanceContextPanel } from "@/components/admin/MaintenanceContextPanel";
import { CommerceVerificationPanel } from "@/components/admin/CommerceVerificationPanel";
import type { ProductMaintenanceCandidate } from "@/lib/editorial/product-maintenance";
import type { ProductDependencyProfile } from "@/lib/editorial/product-maintenance";
import type { ProductMaterialChangeContext } from "@/lib/editorial/product-impact-context";
import { getCanonicalDateString } from "@/lib/editorial/commerce-verification";

type SaveStatus = "idle" | "saving" | "saved" | "failed";

function snapshot(product: ProductV1Document): string {
  return JSON.stringify(normalizeProductV1(product));
}

function createRisks(product: ProductV1Document): string[] {
  const risks: string[] = [];
  if (product.editorial?.featured) risks.push("Product is Featured");
  if (isAmazonSearchUrl(product.commerce?.amazonUrl)) risks.push("Amazon URL is a search URL");
  if (product.commerce?.availability === "unknown") risks.push("Availability is unknown");
  if (!product.commerce?.asin) risks.push("No ASIN");
  return risks;
}

export function ProductEditorForm({
  product,
  productOptions,
  writeMode,
  version,
  mode = "edit",
  existingProductIds = [],
  justCreated = false,
  revisionCount = 0,
  maintenanceCandidate,
  dependencyProfile,
  materialChangeContext,
}: {
  product: ProductV1Document;
  productOptions: AdminProductOption[];
  writeMode: AdminWriteMode;
  version?: number;
  mode?: "edit" | "create";
  existingProductIds?: string[];
  justCreated?: boolean;
  revisionCount?: number;
  maintenanceCandidate?: ProductMaintenanceCandidate;
  dependencyProfile?: ProductDependencyProfile;
  materialChangeContext?: ProductMaterialChangeContext;
}) {
  const router = useRouter();
  const isCreate = mode === "create";
  const [draft, setDraft] = useState(product);
  const [loaded, setLoaded] = useState(product);
  const [baseline, setBaseline] = useState(() => snapshot(product));
  const [recordVersion, setRecordVersion] = useState(version);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [result, setResult] = useState<AdminSaveResult | null>(
    justCreated
      ? { ok: true, errors: [], warnings: [] }
      : null,
  );
  const [savedAt, setSavedAt] = useState<string | undefined>(justCreated ? "just now" : undefined);
  const [idTouched, setIdTouched] = useState(Boolean(product.id));

  const dirty = useMemo(() => snapshot(draft) !== baseline, [draft, baseline]);
  const writeEnabled = isCreate
    ? writeMode === "database"
    : writeMode === "database" || writeMode === "development";
  const category = draft.identity.category;
  const suggestedId = suggestProductId(draft.identity.name);
  const normalizedDraft = useMemo(() => normalizeProductV1(draft), [draft]);
  const normalizedLoaded = useMemo(() => normalizeProductV1(loaded), [loaded]);
  const changeLines = useMemo(
    () =>
      isCreate
        ? []
        : productChangeSummary(
            normalizedLoaded as unknown as Record<string, unknown>,
            normalizedDraft as unknown as Record<string, unknown>,
          ),
    [isCreate, normalizedDraft, normalizedLoaded],
  );
  const highRisk = useMemo(
    () =>
      isCreate
        ? createRisks(normalizedDraft)
        : highRiskProductChanges(
            normalizedLoaded as unknown as Record<string, unknown>,
            normalizedDraft as unknown as Record<string, unknown>,
          ),
    [isCreate, normalizedDraft, normalizedLoaded],
  );
  const localHints = useMemo(
    () =>
      productLocalHints(normalizedDraft, {
        mode: isCreate ? "create" : "edit",
        existingIds: existingProductIds,
      }),
    [isCreate, normalizedDraft, existingProductIds],
  );
  const stale = Boolean(result?.errors.some((error) => error.includes("changed after you opened")));
  const statusDetail = useMemo(() => saveRefreshStatusDetail(result, status), [result, status]);

  function update(patch: (current: ProductV1Document) => ProductV1Document) {
    setDraft((current) => patch(current));
    if (status === "saved") setStatus("idle");
  }

  async function onSave() {
    if (status === "saving") return;
    if (!isCreate && !dirty) return;
    if (localHints.errors.length > 0) {
      setResult({ ok: false, errors: localHints.errors, warnings: localHints.warnings });
      setStatus("failed");
      document.getElementById("admin-validation-summary")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const confirmRisks = isCreate
      ? highRisk.filter((risk) => risk === "Product is Featured" || risk === "Amazon URL is a search URL")
      : highRisk;
    if (confirmRisks.length > 0) {
      const confirmed = window.confirm(
        `High-risk ${isCreate ? "create" : "changes"}:\n${confirmRisks.join("\n")}\n\n${isCreate ? "Create anyway?" : "Save anyway?"}`,
      );
      if (!confirmed) return;
    }
    setStatus("saving");
    const canonical = normalizeProductV1(draft);
    const saveResult = isCreate
      ? await createAdminProductAction(canonical)
      : await saveAdminProductAction(canonical, recordVersion);
    setResult(saveResult);
    if (saveResult.ok) {
      setDraft(canonical);
      setLoaded(canonical);
      setBaseline(snapshot(canonical));
      if (saveResult.version !== undefined) setRecordVersion(saveResult.version);
      setSavedAt("just now");
      setStatus("saved");
      if (isCreate) {
        router.push(`/admin/products/${canonical.id}?created=1`);
      }
    } else {
      setStatus("failed");
      document.getElementById("admin-validation-summary")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function onReset() {
    if (!dirty) return;
    const message = isCreate
      ? "Discard this candidate and reset to a blank Product?"
      : "Discard unsaved changes and restore the last loaded record?";
    if (!window.confirm(message)) return;
    const next = isCreate ? blankProductV1() : loaded;
    setDraft(next);
    setResult(null);
    setStatus("idle");
    if (isCreate) setIdTouched(false);
  }

  async function onReload() {
    if (isCreate) return;
    if (dirty && !window.confirm("Reload latest will discard unsaved changes. Continue?")) return;
    const latest = await loadAdminProductAction(product.id);
    if ("error" in latest) {
      setResult({ ok: false, errors: [latest.error], warnings: [] });
      setStatus("failed");
      return;
    }
    setDraft(latest.product);
    setLoaded(latest.product);
    setBaseline(snapshot(latest.product));
    setRecordVersion(latest.version);
    setResult(null);
    setStatus("idle");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <UnsavedChangesGuard dirty={dirty} />
      <EditorToolbar
        title={
          isCreate
            ? draft.identity.name || "New Product"
            : draft.identity.name || product.identity.name
        }
        subtitle={
          isCreate
            ? draft.id || "Choose a stable Product ID before creating"
            : `${product.id}${recordVersion ? ` · v${recordVersion}` : ""}`
        }
        dirty={dirty}
        status={status}
        savedAt={savedAt}
        writeMode={writeMode}
        writeEnabled={writeEnabled}
        variant={isCreate ? "create" : "save"}
        createLabel="Create Product"
        historyHref={isCreate ? undefined : `/admin/products/${draft.id}/history`}
        historyCount={isCreate ? undefined : revisionCount}
        stale={stale}
        statusDetail={statusDetail}
        onSave={() => void onSave()}
        onReset={onReset}
        onReload={() => void onReload()}
        onCopyJson={() => {
          void navigator.clipboard.writeText(JSON.stringify(normalizedDraft, null, 2));
        }}
      />
      <div id="admin-validation-summary">
        <ValidationSummary
          result={result}
          localErrors={localHints.errors}
          localWarnings={localHints.warnings}
          stale={stale}
          onReload={() => void onReload()}
          onCopyJson={() => {
            void navigator.clipboard.writeText(JSON.stringify(normalizedDraft, null, 2));
          }}
        />
      </div>
      {isCreate ? (
        <CreateSummary
          title="Product to create"
          fields={[
            { label: "id", value: draft.id },
            { label: "name", value: draft.identity.name },
            { label: "brand", value: draft.identity.brand },
            { label: "category", value: draft.identity.category },
          ]}
          risks={highRisk}
        />
      ) : (
        <ChangeSummary lines={changeLines} highRisk={highRisk} />
      )}

      {maintenanceCandidate && !isCreate && (
        <MaintenanceContextPanel candidate={maintenanceCandidate} />
      )}

      {!isCreate && dependencyProfile && (
        <CommerceVerificationPanel
          draft={draft}
          dependencyProfile={dependencyProfile}
          materialChangeContext={materialChangeContext}
          onMarkChecked={() =>
            update((current) => ({
              ...current,
              commerce: {
                ...current.commerce,
                lastChecked: getCanonicalDateString(),
              },
            }))
          }
          onUseSuggestion={(url) =>
            update((current) => ({
              ...current,
              commerce: { ...current.commerce, amazonUrl: url },
            }))
          }
          onApplyCommerce={(patch) =>
            update((current) => ({
              ...current,
              commerce: {
                ...current.commerce,
                ...(patch.asin !== undefined ? { asin: patch.asin } : {}),
                ...(patch.amazonUrl !== undefined ? { amazonUrl: patch.amazonUrl } : {}),
                ...(patch.availability !== undefined ? { availability: patch.availability } : {}),
              },
              media: {
                ...current.media,
                ...(patch.primaryImage !== undefined ? { primary: patch.primaryImage } : {}),
              },
            }))
          }
          onClearAsin={() =>
            update((current) => ({
              ...current,
              commerce: { ...current.commerce, asin: undefined },
            }))
          }
        />
      )}

      <div className="space-y-6">
        <AdminSection
          title="Identity"
          description={
            isCreate
              ? "Product ID is required, slug-like, and becomes immutable after create."
              : "Product ID is a permanent identifier and cannot be changed."
          }
        >
          {isCreate ? (
            <TextField
              id="product-id"
              label="id"
              value={draft.id}
              hint={
                suggestedId && suggestedId !== draft.id
                  ? `Suggested ID: ${suggestedId}`
                  : "Lowercase slug-like ID. Confirm this value before creating."
              }
              onChange={(id) => {
                setIdTouched(true);
                update((current) => ({ ...current, id }));
              }}
            />
          ) : (
            <ReadOnlyField label="id" value={draft.id} hint="Read-only system identifier" />
          )}
          <TextField
            id="product-name"
            label="name"
            value={draft.identity.name}
            onChange={(name) =>
              update((current) => {
                const nextId = !idTouched ? suggestProductId(name) : current.id;
                return {
                  ...current,
                  id: nextId,
                  identity: { ...current.identity, name },
                };
              })
            }
          />
          <TextField
            id="product-brand"
            label="brand"
            value={draft.identity.brand}
            onChange={(brand) =>
              update((current) => ({
                ...current,
                identity: { ...current.identity, brand },
              }))
            }
          />
          <TextField
            id="product-model"
            label="model"
            value={draft.identity.model ?? ""}
            onChange={(model) =>
              update((current) => ({
                ...current,
                identity: { ...current.identity, model },
              }))
            }
          />
          <SelectField
            id="product-category"
            label="category"
            allowEmpty={isCreate}
            emptyLabel="Select a canonical category"
            value={draft.identity.category}
            options={PRODUCT_CATEGORIES.map((value) => ({
              value,
              label: `${PRODUCT_CATEGORY_LABELS[value]} (${value})`,
            }))}
            onChange={(value) =>
              update((current) => ({
                ...current,
                identity: { ...current.identity, category: value as ProductCategoryV1 },
              }))
            }
          />
        </AdminSection>

        <AdminSection title="Classification">
          <TextField
            id="product-subcategory"
            label="subcategory"
            value={draft.classification?.subcategory ?? ""}
            onChange={(subcategory) =>
              update((current) => ({
                ...current,
                classification: { ...current.classification, subcategory },
              }))
            }
          />
          <RepeatableStrings
            id="product-tags"
            label="tags"
            addLabel="Add tag"
            values={draft.classification?.tags ?? []}
            onChange={(tags) =>
              update((current) => ({
                ...current,
                classification: { ...current.classification, tags },
              }))
            }
          />
        </AdminSection>

        <AdminSection title="Editorial">
          <SelectField
            id="product-role"
            label="role"
            allowEmpty
            value={draft.editorial?.role ?? ""}
            options={PRODUCT_ROLES.map((value) => ({ value, label: value }))}
            onChange={(value) =>
              update((current) => ({
                ...current,
                editorial: {
                  ...current.editorial,
                  role: value ? (value as ProductEditorialRoleV1) : undefined,
                },
              }))
            }
          />
          <TextAreaField
            id="product-verdict"
            label="verdict"
            value={draft.editorial?.verdict ?? ""}
            onChange={(verdict) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, verdict },
              }))
            }
          />
          <TextAreaField
            id="product-description"
            label="description"
            value={draft.editorial?.description ?? ""}
            onChange={(description) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, description },
              }))
            }
          />
          <RepeatableStrings
            id="product-bestFor"
            label="bestFor"
            values={draft.editorial?.bestFor ?? []}
            onChange={(bestFor) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, bestFor },
              }))
            }
          />
          <RepeatableStrings
            id="product-notFor"
            label="notFor"
            values={draft.editorial?.notFor ?? []}
            onChange={(notFor) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, notFor },
              }))
            }
          />
          <RepeatableStrings
            id="product-pros"
            label="pros"
            values={draft.editorial?.pros ?? []}
            onChange={(pros) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, pros },
              }))
            }
          />
          <RepeatableStrings
            id="product-cons"
            label="cons"
            values={draft.editorial?.cons ?? []}
            onChange={(cons) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, cons },
              }))
            }
          />
          <CheckboxField
            id="product-featured"
            label="featured"
            checked={Boolean(draft.editorial?.featured)}
            onChange={(featured) =>
              update((current) => ({
                ...current,
                editorial: { ...current.editorial, featured },
              }))
            }
          />
        </AdminSection>

        <AdminSection
          title="Commerce"
          description="Affiliate tags are applied at runtime. Store the untagged Amazon URL."
        >
          <TextField
            id="product-asin"
            label="asin"
            value={draft.commerce?.asin ?? ""}
            onChange={(asin) =>
              update((current) => ({
                ...current,
                commerce: { ...current.commerce, asin },
              }))
            }
            hint={
              !draft.commerce?.asin
                ? "Missing ASIN is allowed for generic product-class entries."
                : isObviousPlaceholderAsin(draft.commerce.asin)
                  ? "Placeholder ASIN — remove or replace with a verified value before saving."
                  : undefined
            }
          />
          <TextField
            id="product-amazonUrl"
            label="amazonUrl"
            type="url"
            value={draft.commerce?.amazonUrl ?? ""}
            onChange={(amazonUrl) =>
              update((current) => ({
                ...current,
                commerce: { ...current.commerce, amazonUrl },
              }))
            }
            hint="Do not append affiliate tags here."
          />
          {isAmazonSearchUrl(draft.commerce?.amazonUrl) ? (
            <p className="mb-3 text-xs text-amber-800">
              This looks like an Amazon search URL rather than a product detail URL. Stored as-is.
            </p>
          ) : null}
          <TextField
            id="product-priceRange"
            label="priceRange"
            value={draft.commerce?.priceRange ?? ""}
            onChange={(priceRange) =>
              update((current) => ({
                ...current,
                commerce: { ...current.commerce, priceRange },
              }))
            }
          />
          <SelectField
            id="product-availability"
            label="availability"
            allowEmpty
            value={draft.commerce?.availability ?? ""}
            options={PRODUCT_AVAILABILITY.map((value) => ({ value, label: value }))}
            onChange={(value) =>
              update((current) => ({
                ...current,
                commerce: {
                  ...current.commerce,
                  availability: value ? (value as ProductAvailabilityV1) : undefined,
                },
              }))
            }
          />
          <TextField
            id="product-lastChecked"
            label="lastChecked"
            value={draft.commerce?.lastChecked ?? ""}
            onChange={(lastChecked) =>
              update((current) => ({
                ...current,
                commerce: { ...current.commerce, lastChecked },
              }))
            }
          />
        </AdminSection>

        <AdminSection title="Media" description="Path/URL editing only. File upload is not available.">
          <TextField
            id="product-primary"
            label="media.primary"
            value={draft.media?.primary ?? ""}
            onChange={(primary) =>
              update((current) => ({
                ...current,
                media: { ...current.media, primary },
              }))
            }
          />
          <RepeatableStrings
            id="product-gallery"
            label="media.gallery"
            addLabel="Add path"
            values={draft.media?.gallery ?? []}
            onChange={(gallery) =>
              update((current) => ({
                ...current,
                media: { ...current.media, gallery },
              }))
            }
          />
        </AdminSection>

        <AdminSection
          title="Specs"
          description={
            category
              ? `Showing common specs plus the ${category} block. Empty optional fields stay absent.`
              : "Select a category to reveal the matching spec block. Empty optional fields stay absent."
          }
        >
          <NumberField
            id="spec-width"
            label="dimensions.widthIn"
            value={draft.specs?.dimensions?.widthIn}
            onChange={(widthIn) =>
              update((current) => ({
                ...current,
                specs: {
                  ...current.specs,
                  dimensions: { ...current.specs?.dimensions, widthIn },
                },
              }))
            }
          />
          <NumberField
            id="spec-depth"
            label="dimensions.depthIn"
            value={draft.specs?.dimensions?.depthIn}
            onChange={(depthIn) =>
              update((current) => ({
                ...current,
                specs: {
                  ...current.specs,
                  dimensions: { ...current.specs?.dimensions, depthIn },
                },
              }))
            }
          />
          <NumberField
            id="spec-height"
            label="dimensions.heightIn"
            value={draft.specs?.dimensions?.heightIn}
            onChange={(heightIn) =>
              update((current) => ({
                ...current,
                specs: {
                  ...current.specs,
                  dimensions: { ...current.specs?.dimensions, heightIn },
                },
              }))
            }
          />
          <NumberField
            id="spec-weight"
            label="weightLb"
            value={draft.specs?.weightLb}
            onChange={(weightLb) =>
              update((current) => ({
                ...current,
                specs: { ...current.specs, weightLb },
              }))
            }
          />

          {category === "desks" || draft.specs?.desk ? (
            <>
              <CheckboxField
                id="desk-adjustable"
                label="desk.adjustable"
                checked={Boolean(draft.specs?.desk?.adjustable)}
                onChange={(adjustable) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, desk: { ...current.specs?.desk, adjustable } },
                  }))
                }
              />
              <TextField
                id="desk-heightRange"
                label="desk.heightRangeIn"
                value={draft.specs?.desk?.heightRangeIn ?? ""}
                onChange={(heightRangeIn) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, desk: { ...current.specs?.desk, heightRangeIn } },
                  }))
                }
              />
              <TextField
                id="desk-motor"
                label="desk.motor"
                value={draft.specs?.desk?.motor ?? ""}
                onChange={(motor) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, desk: { ...current.specs?.desk, motor } },
                  }))
                }
              />
              <NumberField
                id="desk-capacity"
                label="desk.weightCapacityLb"
                value={draft.specs?.desk?.weightCapacityLb}
                onChange={(weightCapacityLb) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, desk: { ...current.specs?.desk, weightCapacityLb } },
                  }))
                }
              />
              <NumberField
                id="desk-width"
                label="desk.widthIn"
                value={draft.specs?.desk?.widthIn}
                onChange={(widthIn) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, desk: { ...current.specs?.desk, widthIn } },
                  }))
                }
              />
              <NumberField
                id="desk-depth"
                label="desk.depthIn"
                value={draft.specs?.desk?.depthIn}
                onChange={(depthIn) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, desk: { ...current.specs?.desk, depthIn } },
                  }))
                }
              />
            </>
          ) : null}

          {category === "chairs" || draft.specs?.chair ? (
            <>
              <TextField
                id="chair-seat"
                label="chair.seatHeightRangeIn"
                value={draft.specs?.chair?.seatHeightRangeIn ?? ""}
                onChange={(seatHeightRangeIn) =>
                  update((current) => ({
                    ...current,
                    specs: {
                      ...current.specs,
                      chair: { ...current.specs?.chair, seatHeightRangeIn },
                    },
                  }))
                }
              />
              <CheckboxField
                id="chair-lumbar"
                label="chair.lumbarSupport"
                checked={Boolean(draft.specs?.chair?.lumbarSupport)}
                onChange={(lumbarSupport) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, chair: { ...current.specs?.chair, lumbarSupport } },
                  }))
                }
              />
              <CheckboxField
                id="chair-armrest"
                label="chair.armrest"
                checked={Boolean(draft.specs?.chair?.armrest)}
                onChange={(armrest) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, chair: { ...current.specs?.chair, armrest } },
                  }))
                }
              />
              <CheckboxField
                id="chair-armrestAdj"
                label="chair.armrestAdjustable"
                checked={Boolean(draft.specs?.chair?.armrestAdjustable)}
                onChange={(armrestAdjustable) =>
                  update((current) => ({
                    ...current,
                    specs: {
                      ...current.specs,
                      chair: { ...current.specs?.chair, armrestAdjustable },
                    },
                  }))
                }
              />
              <CheckboxField
                id="chair-mesh"
                label="chair.meshBack"
                checked={Boolean(draft.specs?.chair?.meshBack)}
                onChange={(meshBack) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, chair: { ...current.specs?.chair, meshBack } },
                  }))
                }
              />
            </>
          ) : null}

          {category === "monitors" || draft.specs?.monitor ? (
            <>
              <NumberField
                id="monitor-size"
                label="monitor.sizeIn"
                value={draft.specs?.monitor?.sizeIn}
                onChange={(sizeIn) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, monitor: { ...current.specs?.monitor, sizeIn } },
                  }))
                }
              />
              <TextField
                id="monitor-resolution"
                label="monitor.resolution"
                value={draft.specs?.monitor?.resolution ?? ""}
                onChange={(resolution) =>
                  update((current) => ({
                    ...current,
                    specs: {
                      ...current.specs,
                      monitor: { ...current.specs?.monitor, resolution },
                    },
                  }))
                }
              />
              <TextField
                id="monitor-panel"
                label="monitor.panel"
                value={draft.specs?.monitor?.panel ?? ""}
                onChange={(panel) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, monitor: { ...current.specs?.monitor, panel } },
                  }))
                }
              />
              <NumberField
                id="monitor-refresh"
                label="monitor.refreshRate"
                value={draft.specs?.monitor?.refreshRate}
                onChange={(refreshRate) =>
                  update((current) => ({
                    ...current,
                    specs: {
                      ...current.specs,
                      monitor: { ...current.specs?.monitor, refreshRate },
                    },
                  }))
                }
              />
            </>
          ) : null}

          {category === "accessories" || draft.specs?.accessory ? (
            <>
              <TextField
                id="acc-type"
                label="accessory.type"
                value={draft.specs?.accessory?.type ?? ""}
                onChange={(type) =>
                  update((current) => ({
                    ...current,
                    specs: { ...current.specs, accessory: { ...current.specs?.accessory, type } },
                  }))
                }
              />
              <NumberField
                id="acc-weight"
                label="accessory.maxWeightLb"
                value={draft.specs?.accessory?.maxWeightLb}
                onChange={(maxWeightLb) =>
                  update((current) => ({
                    ...current,
                    specs: {
                      ...current.specs,
                      accessory: { ...current.specs?.accessory, maxWeightLb },
                    },
                  }))
                }
              />
              <NumberField
                id="acc-count"
                label="accessory.monitorCount"
                value={draft.specs?.accessory?.monitorCount}
                onChange={(monitorCount) =>
                  update((current) => ({
                    ...current,
                    specs: {
                      ...current.specs,
                      accessory: { ...current.specs?.accessory, monitorCount },
                    },
                  }))
                }
              />
            </>
          ) : null}
        </AdminSection>

        <AdminSection
          title="Review"
          description="Canonical product-owned overall rating. Article ratingCategories stay on the article."
        >
          <NumberField
            id="product-rating"
            label="rating"
            min={PRODUCT_RATING_SCALE.min}
            max={PRODUCT_RATING_SCALE.max}
            step={PRODUCT_RATING_SCALE.step}
            value={draft.review?.rating}
            onChange={(rating) =>
              update((current) => ({
                ...current,
                review: { ...current.review, rating },
              }))
            }
            hint="Scale 0–5. Canonical server validation is authoritative."
          />
          <TextAreaField
            id="product-review-summary"
            label="summary"
            value={draft.review?.summary ?? ""}
            onChange={(summary) =>
              update((current) => ({
                ...current,
                review: { ...current.review, summary },
              }))
            }
          />
          <TextField
            id="product-review-slug"
            label="slug"
            value={draft.review?.slug ?? ""}
            onChange={(slug) =>
              update((current) => ({
                ...current,
                review: { ...current.review, slug },
              }))
            }
          />
        </AdminSection>

        <AdminSection title="Comparison">
          <CheckboxField
            id="product-compareReady"
            label="compareReady"
            checked={Boolean(draft.comparison?.compareReady)}
            onChange={(compareReady) =>
              update((current) => ({
                ...current,
                comparison: { ...current.comparison, compareReady },
              }))
            }
          />
          <RepeatableStrings
            id="product-keyFactors"
            label="keyFactors"
            values={draft.comparison?.keyFactors ?? []}
            onChange={(keyFactors) =>
              update((current) => ({
                ...current,
                comparison: { ...current.comparison, keyFactors },
              }))
            }
          />
        </AdminSection>

        <AdminSection title="Relationships">
          <SelectField
            id="related-add"
            label="relatedProducts"
            allowEmpty
            emptyLabel="Add a related product"
            value=""
            options={productOptions
              .filter(
                (option) =>
                  option.id !== draft.id &&
                  !(draft.relationships?.relatedProducts ?? []).includes(option.id),
              )
              .map((option) => ({
                value: option.id,
                label: `${option.name} (${option.id})`,
              }))}
            onChange={(id) => {
              if (!id) return;
              update((current) => ({
                ...current,
                relationships: {
                  relatedProducts: [...(current.relationships?.relatedProducts ?? []), id],
                },
              }));
            }}
            hint="Saves productId only. The current product cannot be selected."
          />
          <ul className="space-y-2 pt-2">
            {(draft.relationships?.relatedProducts ?? []).map((id) => {
              const option = productOptions.find((item) => item.id === id);
              return (
                <li key={id} className="flex items-center justify-between rounded-md bg-[var(--canvas)] px-3 py-2 text-sm">
                  <span>
                    {option?.name ?? id}
                    <span className="ml-2 text-[var(--subtle)]">{id}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        relationships: {
                          relatedProducts: (current.relationships?.relatedProducts ?? []).filter(
                            (item) => item !== id,
                          ),
                        },
                      }))
                    }
                    className="text-[var(--danger)]"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </AdminSection>
      </div>
      <CanonicalJsonPreview value={normalizedDraft} />
    </form>
  );
}
