"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { getSizeConfig, isValidSize } from "@/constants/sizes";
import { z } from "zod";
import type { CatalogOptions, CatalogProductInput } from "@/lib/product-attributes";
import type { ProductVariant } from "@/types";

export type CatalogEditableProduct = Omit<
  Partial<CatalogProductInput>,
  "description" | "category_id" | "compare_price" | "sku"
> & {
  id: string;
  description?: string | null;
  category_id?: string | null;
  compare_price?: number | null;
  sku?: string | null;
  variants: ProductVariant[];
};

interface CatalogProductFormProps {
  mode: "new" | "edit";
  options: CatalogOptions;
  product?: CatalogEditableProduct;
}

interface VariantRow {
  color: string | null;
  size: string | null;
  stock_quantity: number;
  key: string;
}

const variantKey = (color: string | null, size: string | null) =>
  `${color ?? ""}::${size ?? ""}`;
const sizeSelectionSchema = z.object({
  sizeType: z.enum(["none", "single", "multi"]),
  categorySlug: z.string(),
  selectedSizes: z.array(z.string()),
}).superRefine((value, context) => {
  const config = getSizeConfig(value.categorySlug);
  if (config.type !== value.sizeType) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["selectedSizes"], message: "Size settings do not match this category." });
  }
  if (config.type !== "none" && value.selectedSizes.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["selectedSizes"], message: `Select at least one ${config.label.toLowerCase()}.` });
  }
  if (config.type === "single" && value.selectedSizes.length > 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["selectedSizes"], message: "Select only one size for this category." });
  }
  if (value.selectedSizes.some((size) => !isValidSize(value.categorySlug, size))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["selectedSizes"], message: "Choose a valid size for the selected category." });
  }
});

export function CatalogProductForm({ mode, options, product }: CatalogProductFormProps) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand === "Unspecified" ? "" : product?.brand ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [price, setPrice] = useState(product?.price?.toString() ?? "");
  const [comparePrice, setComparePrice] = useState(product?.compare_price?.toString() ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [minimumOrder, setMinimumOrder] = useState(product?.minimum_order?.toString() ?? "1");
  const [stockQuantity, setStockQuantity] = useState(product?.stock_quantity?.toString() ?? "0");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [tags, setTags] = useState(product?.tags?.join(", ") ?? "");
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [selectedColors, setSelectedColors] = useState<string[]>(
    Array.from(new Set(product?.variants?.map((variant) => variant.color).filter((value): value is string => Boolean(value)) ?? []))
  );
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    const productCategory = options.categories.find((item) => item.id === product?.category_id);
    if (getSizeConfig(productCategory?.slug ?? productCategory?.name).type === "none") return [];
    return Array.from(new Set(product?.variants?.map((variant) => variant.size)
      .filter((value): value is string => Boolean(value)) ?? []));
  });
  const [stockByVariant, setStockByVariant] = useState<Record<string, string>>(
    Object.fromEntries((product?.variants ?? []).map((variant) => [
      variantKey(variant.color, variant.size),
      String(variant.stock_quantity),
    ]))
  );
  const [measurementSize, setMeasurementSize] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const rule = options.categoryRules.find((item) => item.category_id === categoryId);
  const category = options.categories.find((item) => item.id === categoryId);
  const categorySlug = category?.slug ?? category?.name ?? "";
  const sizeConfig = getSizeConfig(categorySlug);
  const requiresColor = rule?.requires_color ?? false;
  const requiresSize = sizeConfig.type !== "none";

  const variantRows = useMemo(() => {
    if (!requiresColor && !requiresSize) return [];
    const colors: (string | null)[] = requiresColor ? selectedColors : [null];
    const sizes: (string | null)[] = requiresSize ? selectedSizes : [null];
    return colors.flatMap((color) => sizes.map((size) => ({
      color,
      size,
      key: variantKey(color, size),
      stock_quantity: Number(stockByVariant[variantKey(color, size)] ?? 0),
    })));
  }, [requiresColor, requiresSize, selectedColors, selectedSizes, stockByVariant]);

  const toggleOption = (
    value: string,
    values: string[],
    setValues: (values: string[]) => void,
    allowMultiple = true
  ) => {
    if (values.includes(value)) {
      setValues(values.filter((item) => item !== value));
    } else {
      setValues(allowMultiple ? [...values, value] : [value]);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Product name is required.";
    if (!brand.trim() || brand.trim().toLowerCase() === "unspecified") errors.brand = "Brand is required.";
    if (!categoryId) errors.category_id = "Select a category.";
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) errors.price = "Price must be a positive number.";
    if (comparePrice && (!Number.isFinite(Number(comparePrice)) || Number(comparePrice) <= 0)) {
      errors.compare_price = "Compare price must be a positive number.";
    }
    if (!Number.isInteger(Number(minimumOrder)) || Number(minimumOrder) < 1) {
      errors.minimum_order = "Minimum order must be at least 1.";
    }
    if (images.length === 0) errors.images = "Upload at least one product image.";
    if (requiresColor && selectedColors.length === 0) errors.colors = "Select at least one color.";
    const sizeValidation = sizeSelectionSchema.safeParse({
      sizeType: sizeConfig.type,
      categorySlug,
      selectedSizes,
    });
    if (!sizeValidation.success) {
      errors.sizes = sizeValidation.error.issues[0]?.message ?? "Choose a valid size for this category.";
    }
    if (!requiresColor && !requiresSize && (!Number.isInteger(Number(stockQuantity)) || Number(stockQuantity) < 0)) {
      errors.stock_quantity = "Stock must be zero or greater.";
    }
    if ((requiresColor || requiresSize) && variantRows.some((variant) => !Number.isInteger(variant.stock_quantity) || variant.stock_quantity < 0)) {
      errors.variants = "Enter a valid stock quantity for every selected variant.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const payload: CatalogProductInput = {
      name: name.trim(),
      brand: brand.trim().replace(/\s+/g, " "),
      description: description.trim(),
      category_id: categoryId,
      price: Number(price),
      compare_price: comparePrice ? Number(comparePrice) : null,
      minimum_order: Number(minimumOrder),
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      stock_quantity: requiresColor || requiresSize ? 0 : Number(stockQuantity),
      sku: sku.trim() || null,
      is_active: isActive,
      images,
      size_type: sizeConfig.type,
      available_sizes: selectedSizes,
      variants: variantRows,
    };

    setSubmitting(true);
    try {
      const response = await fetch(
        mode === "new" ? "/api/vendor/products" : `/api/vendor/products/${product?.id}`,
        {
          method: mode === "new" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save product.");
      router.push("/vendor/products");
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  const controlClass =
    "w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={onSubmit} className="space-y-7 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text">
            {mode === "new" ? "Add New Product" : "Complete or Edit Product"}
          </h1>
          <p className="mt-2 text-sm text-muted">Required fields are used to keep marketplace filters precise.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-text">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Published
        </label>
      </div>

      {formError && <p role="alert" className="rounded-lg bg-danger/10 p-4 text-sm text-danger-text">{formError}</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Product name" error={fieldErrors.name}>
          <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Brand" error={fieldErrors.brand}>
          <>
            <input
              className={controlClass}
              list="vendor-brand-suggestions"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              required
              maxLength={100}
            />
            <datalist id="vendor-brand-suggestions">
              {options.brands.map((suggestion) => <option value={suggestion} key={suggestion} />)}
            </datalist>
          </>
        </Field>
        <Field label="Category" error={fieldErrors.category_id}>
          <select className={controlClass} value={categoryId} onChange={(event) => {
            setCategoryId(event.target.value);
            setSelectedColors([]);
            setSelectedSizes([]);
            setStockByVariant({});
            setMeasurementSize("");
          }} required>
            <option value="">Select category</option>
            {options.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select>
        </Field>
        <Field label="Price (₦)" error={fieldErrors.price}>
          <input className={controlClass} type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required />
        </Field>
        <Field label="Compare price (₦)" error={fieldErrors.compare_price}>
          <input className={controlClass} type="number" min="0.01" step="0.01" value={comparePrice} onChange={(event) => setComparePrice(event.target.value)} />
        </Field>
        <Field label="Minimum order" error={fieldErrors.minimum_order}>
          <input className={controlClass} type="number" min="1" step="1" value={minimumOrder} onChange={(event) => setMinimumOrder(event.target.value)} required />
        </Field>
      </div>

      {(requiresColor || requiresSize) ? (
        <section className="space-y-4 rounded-lg bg-bg p-4 sm:p-5">
          <h2 className="font-semibold text-text">Variants and stock</h2>
          {requiresColor && (
            <OptionSelector label="Colors" values={options.colors} selected={selectedColors}
              onToggle={(value) => toggleOption(value, selectedColors, setSelectedColors)} />
          )}
          {fieldErrors.colors && <p className="text-sm text-danger-text">{fieldErrors.colors}</p>}
          {requiresSize && (
            <div className="space-y-3">
              <OptionSelector
                label={sizeConfig.label}
                values={Array.from(sizeConfig.options)}
                selected={selectedSizes}
                onToggle={(value) => toggleOption(
                  value,
                  selectedSizes,
                  setSelectedSizes,
                  sizeConfig.type === "multi"
                )}
                allowMultiple={sizeConfig.type === "multi"}
              />
              {sizeConfig.measurement && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-0 flex-1 space-y-1 text-sm text-text">
                    <span>{sizeConfig.label} in {sizeConfig.measurement.unit}</span>
                    <input
                      className={controlClass}
                      value={measurementSize}
                      onChange={(event) => setMeasurementSize(event.target.value)}
                      placeholder="e.g. 120 x 60 x 75"
                      aria-label={sizeConfig.label}
                    />
                  </label>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-accent px-4 text-sm font-semibold text-accent-text"
                    onClick={() => {
                      const value = `${measurementSize.trim()} ${sizeConfig.measurement?.unit ?? ""}`.trim();
                      if (!isValidSize(categorySlug, value)) {
                        setFieldErrors((current) => ({ ...current, sizes: "Enter valid dimensions in centimeters." }));
                        return;
                      }
                      setSelectedSizes(sizeConfig.type === "single" ? [value] : Array.from(new Set([...selectedSizes, value])));
                      setMeasurementSize("");
                      setFieldErrors((current) => ({ ...current, sizes: "" }));
                    }}
                  >
                    Add size
                  </button>
                </div>
              )}
              {selectedSizes.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label="Selected sizes">
                  {selectedSizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSizes((current) => current.filter((item) => item !== size))}
                      className="min-h-10 rounded-full bg-accent/10 px-4 text-sm font-medium text-accent-text"
                    >
                      {size} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {fieldErrors.sizes && <p className="text-sm text-danger-text">{fieldErrors.sizes}</p>}
          {variantRows.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {variantRows.map((variant) => (
                <label key={variant.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
                  <span>{[variant.color, variant.size].filter(Boolean).join(" / ")}</span>
                  <input
                    className="w-24 rounded-lg border border-border px-2 py-1.5"
                    type="number"
                    min="0"
                    step="1"
                    aria-label={`Stock for ${[variant.color, variant.size].filter(Boolean).join(" ")}`}
                    value={stockByVariant[variant.key] ?? "0"}
                    onChange={(event) => setStockByVariant((current) => ({ ...current, [variant.key]: event.target.value }))}
                    required
                  />
                </label>
              ))}
            </div>
          )}
          {fieldErrors.variants && <p className="text-sm text-danger-text">{fieldErrors.variants}</p>}
        </section>
      ) : (
        <Field label="Stock quantity" error={fieldErrors.stock_quantity}>
          <input className={controlClass} type="number" min="0" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} required />
        </Field>
      )}

      <Field label="At least one product image" error={fieldErrors.images}>
        <ImageUpload value={images} onChange={setImages} />
      </Field>

      <Field label="Description">
        <textarea className={controlClass} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="SKU">
          <input className={controlClass} value={sku} onChange={(event) => setSku(event.target.value)} />
        </Field>
        <Field label="Tags (comma separated)">
          <input className={controlClass} value={tags} onChange={(event) => setTags(event.target.value)} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting} className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-accent-on transition-colors duration-200 hover:brightness-95 disabled:opacity-60">
          {submitting ? "Saving…" : mode === "new" ? "Create product" : "Save product"}
        </button>
        <button type="button" onClick={() => router.push("/vendor/products")} className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-text">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-text">
      <span>{label}</span>
      {children}
      {error && <span className="block text-sm font-normal text-danger-text">{error}</span>}
    </label>
  );
}

function OptionSelector({
  label,
  values,
  selected,
  onToggle,
  allowMultiple = true,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  allowMultiple?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-text">
        {label}{allowMultiple ? " (select all that apply)" : " (select one)"}
      </legend>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <label key={value} className={`flex min-h-10 cursor-pointer items-center rounded-full border px-4 py-2 text-sm ${selected.includes(value) ? "border-accent bg-accent/10 text-accent-text" : "border-border bg-surface text-text"}`}>
            <input type="checkbox" className="sr-only" checked={selected.includes(value)} onChange={() => onToggle(value)} />
            {value}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
