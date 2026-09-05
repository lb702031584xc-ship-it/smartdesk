export type SaveFailureKind = "session" | "conflict" | "database" | "validation" | "none";

export function saveRefreshStatusDetail(
  result: { ok: boolean; revalidated?: boolean; warnings: string[] } | null,
  status: string,
): string | undefined {
  if (status !== "saved" || !result?.ok) return undefined;
  if (result.revalidated) return "Published page refreshed";
  if (result.warnings.some((warning) => warning.includes("public page refresh failed"))) {
    return "Saved — public refresh failed";
  }
  return undefined;
}

export function classifySaveFailure(errors: string[]): {
  kind: SaveFailureKind;
  title: string;
} {
  const text = errors.join(" ").toLowerCase();
  if (!errors.length) return { kind: "none", title: "" };
  if (text.includes("session has expired") || text.includes("sign in again")) {
    return {
      kind: "session",
      title: "Your admin session has expired. Sign in again before saving.",
    };
  }
  if (text.includes("changed after you opened") || text.includes("changed since you opened")) {
    return {
      kind: "conflict",
      title: "This record has changed since you opened it.",
    };
  }
  if (text.includes("already exists")) {
    return { kind: "validation", title: "A product with this ID already exists." };
  }
  if (text.includes("database save failed")) {
    return { kind: "database", title: "Database save failed." };
  }
  return { kind: "validation", title: "Validation failed." };
}
