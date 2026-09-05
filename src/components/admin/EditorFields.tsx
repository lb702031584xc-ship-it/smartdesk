"use client";

import type { ChangeEvent, ReactNode } from "react";

const fieldClass =
  "w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none";

type FieldWrapProps = {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
};

export function FieldWrap({ label, hint, htmlFor, children }: FieldWrapProps) {
  return (
    <div className="grid gap-1 border-b border-[var(--line)] py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-start sm:gap-4">
      <label htmlFor={htmlFor} className="pt-2 text-sm font-medium text-[var(--muted)]">
        {label}
      </label>
      <div>
        {children}
        {hint ? <p className="mt-1 text-xs text-[var(--subtle)]">{hint}</p> : null}
      </div>
    </div>
  );
}

export function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <FieldWrap label={label} hint={hint}>
      <input
        readOnly
        value={value}
        className={`${fieldClass} cursor-not-allowed bg-[var(--canvas)] text-[var(--muted)]`}
      />
    </FieldWrap>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <FieldWrap label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        className={fieldClass}
      />
    </FieldWrap>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  hint,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <FieldWrap label={label} htmlFor={id} hint={hint}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </FieldWrap>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  allowEmpty,
  emptyLabel = "—",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  hint?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <FieldWrap label={label} htmlFor={id} hint={hint}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
}

export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <FieldWrap label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-2 h-4 w-4 accent-[var(--ink)]"
      />
    </FieldWrap>
  );
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
  min,
  max,
  step,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <FieldWrap label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step ?? "any"}
        value={value ?? ""}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          onChange(Number(raw));
        }}
        className={fieldClass}
      />
    </FieldWrap>
  );
}

export function RepeatableStrings({
  id,
  label,
  values,
  onChange,
  hint,
  addLabel = "Add",
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  hint?: string;
  addLabel?: string;
}) {
  return (
    <FieldWrap label={label} htmlFor={`${id}-0`} hint={hint}>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={`${id}-${index}`} className="flex gap-2">
            <input
              id={`${id}-${index}`}
              value={value}
              onChange={(event) => {
                const next = [...values];
                next[index] = event.target.value;
                onChange(next);
              }}
              className={fieldClass}
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
              className="shrink-0 rounded-md px-3 text-sm text-[var(--danger)] ring-1 ring-[var(--line)] hover:bg-[var(--canvas)]"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...values, ""])}
          className="rounded-md px-3 py-1.5 text-sm ring-1 ring-[var(--line)] hover:bg-[var(--canvas)]"
        >
          {addLabel}
        </button>
      </div>
    </FieldWrap>
  );
}
