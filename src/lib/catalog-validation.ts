import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CatalogProductInput } from "@/lib/product-attributes";
import { getSizeConfig, isValidSize } from "@/constants/sizes";

export function getCatalogSchemaSetupError(error: { code?: string; message?: string } | null) {
  if (!error) return null;

  const missingSchemaCodes = new Set(["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"]);
  if (!error.code || !missingSchemaCodes.has(error.code)) return null;

  return "The product sizing migrations are missing or not yet visible. Apply supabase/migrations/003_product_attributes.sql and 005_category_specific_sizes.sql in order to the connected Supabase project, then retry.";
}

export async function validateCatalogAttributes(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  product: CatalogProductInput
) {
  const [
    { data: rule, error: ruleError },
    { data: category, error: categoryError },
    { data: colors, error: colorError },
  ] = await Promise.all([
    supabase.from("category_attribute_rules")
      .select("requires_color,requires_size")
      .eq("category_id", product.category_id)
      .maybeSingle(),
    supabase.from("categories")
      .select("slug,name")
      .eq("id", product.category_id)
      .maybeSingle(),
    supabase.from("product_color_options").select("value"),
  ]);
  const queryError = ruleError || categoryError || colorError;
  if (queryError) return `Unable to validate product attributes: ${queryError.message}`;
  if (!category) return "Select a valid product category.";

  const categorySlug = category.slug || category.name;
  const sizeConfig = getSizeConfig(categorySlug);
  const allowedColors = new Set((colors ?? []).map((item) => item.value));
  if (product.variants.some((variant) =>
    variant.color !== null && !allowedColors.has(variant.color)
  )) {
    return "Choose colors from the provided options.";
  }
  const variantSizes = Array.from(new Set(product.variants
    .map((variant) => variant.size)
    .filter((size): size is string => Boolean(size))));
  if (product.size_type !== sizeConfig.type) {
    return "The product size type does not match the selected category.";
  }
  if (product.available_sizes.length !== variantSizes.length ||
      product.available_sizes.some((size) => !variantSizes.includes(size)) ||
      variantSizes.some((size) => !isValidSize(categorySlug, size))) {
    return "Choose valid sizes for this category and enter stock for each one.";
  }
  if (sizeConfig.type === "none" && (product.available_sizes.length > 0 || variantSizes.length > 0)) {
    return "This category does not use product sizes.";
  }
  if (sizeConfig.type === "single" && product.available_sizes.length > 1) {
    return "Select only one size for this category.";
  }
  if (rule?.requires_color && !product.variants.some((variant) => variant.color)) {
    return "Add at least one color variant for this category.";
  }
  if (sizeConfig.type !== "none" && !variantSizes.length) {
    return "Add at least one size variant for this category.";
  }
  if ((rule?.requires_color || sizeConfig.type !== "none") && product.variants.length === 0) {
    return "Add stock for each required color and size combination.";
  }
  return null;
}
