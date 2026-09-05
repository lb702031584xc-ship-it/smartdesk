"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateProductEditorialFieldsAction } from "@/lib/admin/actions";
import { PRODUCT_ROLES } from "@/lib/admin/editor-constants";
import { AdminSection } from "@/components/admin/AdminSection";
import {
  RepeatableStrings,
  SelectField,
  TextAreaField,
} from "@/components/admin/EditorFields";
import type { ProductEditorialRoleV1, ProductV1Document } from "@/types/product-v1";
import type { AdminWriteMode } from "@/lib/admin/types";

type ProductEditorialEditorProps = {
  product: ProductV1Document;
  version?: number;
  writeMode: AdminWriteMode;
};

/**
 * Minimal Phase 34 editorial editor — only role / verdict / bestFor / notFor.
 * No commerce, identity, media, specs, or relationship controls.
 */
export function ProductEditorialEditor({
  product,
  version,
  writeMode,
}: ProductEditorialEditorProps) {
  const router = useRouter();
  const [role, setRole] = useState(product.editorial?.role ?? "");
  const [verdict, setVerdict] = useState(product.editorial?.verdict ?? "");
  const [bestFor, setBestFor] = useState<string[]>(product.editorial?.bestFor ?? []);
  const [notFor, setNotFor] = useState<string[]>(product.editorial?.notFor ?? []);
  const [recordVersion, setRecordVersion] = useState(version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const writeBlocked = writeMode === "disabled";

  async function onSave() {
    if (recordVersion === undefined) {
      setError("Missing record version. Reload before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const changes = {
      editorial: {
        role: role as ProductEditorialRoleV1 | "",
        verdict,
        bestFor,
        notFor,
      },
    };

    const result = await updateProductEditorialFieldsAction(
      product.id,
      changes,
      recordVersion,
    );

    setSaving(false);

    if (!result.success) {
      setError(`${result.error}: ${result.message}`);
      return;
    }

    setRecordVersion(result.version);
    setSuccess(
      result.revisionCreated
        ? `Saved. Revision ${result.revisionId ?? "created"}.`
        : "Saved (no content change).",
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/products/${product.id}`}
          className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
        >
          ← Full product record
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--ink)]">
          Editorial edit
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Controlled mutation path for{" "}
          <span className="font-medium text-[var(--ink)]">{product.identity.name}</span>
          . Only editorial fields below are writable.
        </p>
        <p className="mt-1 text-xs text-[var(--subtle)]">
          Product ID: {product.id}
          {recordVersion !== undefined ? ` · Version: ${recordVersion}` : ""}
        </p>
      </div>

      <div className="rounded-md border border-[var(--line)] bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--muted)]">
        Identity, commerce (ASIN), media, specs, and relationships are not editable
        here. Use the full product record only when those fields must change outside
        this controlled path.
      </div>

      <AdminSection
        title="Editorial fields"
        description="role, verdict, bestFor, notFor — Phase 34 allowlist."
      >
        <SelectField
          id="editorial-role"
          label="role"
          allowEmpty
          value={role}
          options={PRODUCT_ROLES.map((value) => ({ value, label: value }))}
          onChange={setRole}
        />
        <TextAreaField
          id="editorial-verdict"
          label="verdict"
          value={verdict}
          onChange={setVerdict}
        />
        <RepeatableStrings
          id="editorial-bestFor"
          label="bestFor"
          values={bestFor}
          onChange={setBestFor}
        />
        <RepeatableStrings
          id="editorial-notFor"
          label="notFor"
          values={notFor}
          onChange={setNotFor}
        />
      </AdminSection>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          {success}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving || writeBlocked || recordVersion === undefined}
          onClick={() => void onSave()}
          className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save editorial"}
        </button>
        <Link
          href={`/admin/products/${product.id}/history`}
          className="rounded-md px-4 py-2 text-sm text-[var(--muted)] ring-1 ring-[var(--line)]"
        >
          Revision history
        </Link>
      </div>
    </div>
  );
}
