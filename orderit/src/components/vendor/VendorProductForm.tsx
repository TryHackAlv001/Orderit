"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Category, Product } from "@/types";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  category_id: z.string().min(1, "Select a category"),
  price: z.number({ invalid_type_error: "Price is required" }).positive("Enter a valid price"),
  compare_price: z.preprocess((value) => {
    if (value === "" || value === undefined || value === null) {
      return null;
    }
    return Number(value);
  }, z.number().positive("Compare price must be greater than 0").nullable()),
  stock_quantity: z.number().int().nonnegative("Stock cannot be negative"),
  sku: z.string().optional(),
  is_active: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ImagePreview {
  id: string;
  url: string;
  file?: File;
  remoteUrl?: string;
}

interface VendorProductFormProps {
  product?: Product;
  categories: Category[];
  mode: "new" | "edit";
}

export function VendorProductForm({ product, categories, mode }: VendorProductFormProps) {
  const router = useRouter();
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>(
    product?.images?.map((url, index) => ({ id: `remote-${index}`, url, remoteUrl: url })) || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const defaultValues = useMemo(() => ({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ?? "",
    price: product?.price ?? 0,
    compare_price: product?.compare_price ?? null,
    stock_quantity: product?.stock_quantity ?? 0,
    sku: product?.sku ?? "",
    is_active: product?.is_active ?? true,
  }), [product]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues,
  });

  const isActive = watch("is_active");

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/vendor/products/images", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || "Image upload failed");
    }

    const data = await response.json();
    return data.url as string;
  };

  const onSubmit = async (values: ProductFormValues) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (imagePreviews.length === 0) {
        throw new Error("Please upload at least one product image.");
      }

      const imageUrls: string[] = [];
      for (const preview of imagePreviews) {
        if (preview.remoteUrl) {
          imageUrls.push(preview.remoteUrl);
          continue;
        }
        if (preview.file) {
          const url = await uploadImage(preview.file);
          imageUrls.push(url);
        }
      }

      const payload = {
        name: values.name,
        description: values.description,
        category_id: values.category_id,
        price: Number(values.price),
        compare_price: values.compare_price ? Number(values.compare_price) : null,
        stock_quantity: Number(values.stock_quantity),
        sku: values.sku || null,
        is_active: values.is_active,
        images: imageUrls,
      };

      const endpoint = mode === "new" ? "/api/vendor/products" : `/api/vendor/products/${product?.id}`;
      const method = mode === "new" ? "POST" : "PUT";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Unable to save product");
      }

      router.push("/vendor/products");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const next = Array.from(files).slice(0, 5 - imagePreviews.length).map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      file,
    }));

    setImagePreviews((current) => [...current, ...next]);
  };

  const removeImage = (id: string) => {
    setImagePreviews((current) => current.filter((image) => image.id !== id));
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    setImagePreviews((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, index: number) => {
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault();
    const fromIndex = Number(event.dataTransfer.getData("text/plain"));
    moveImage(fromIndex, index);
  };

  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <div className="space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{mode === "new" ? "Add Product" : "Edit Product"}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === "new"
              ? "Create a new product listing for your store."
              : "Update your product details and inventory."}
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200">
          <input
            type="checkbox"
            {...register("is_active")}
            checked={isActive}
            className="mr-3 h-4 w-4 rounded border-slate-300 text-slate-900"
          />
          {isActive ? "Active" : "Draft"}
        </label>
      </div>

      {formError && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Product Name</label>
            <input
              type="text"
              {...register("name")}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            {errors.name && <p className="text-sm text-rose-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Category</label>
            <select
              {...register("category_id")}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.category_id && <p className="text-sm text-rose-600">{errors.category_id.message}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <textarea
            {...register("description")}
            rows={8}
            className="w-full rounded-[1.75rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Add a detailed description of the product"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Price (₦)</label>
            <input
              type="number"
              step="0.01"
              {...register("price", { valueAsNumber: true })}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            {errors.price && <p className="text-sm text-rose-600">{errors.price.message}</p>}
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Compare Price (₦)</label>
            <input
              type="number"
              step="0.01"
              {...register("compare_price", { valueAsNumber: true })}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            {errors.compare_price && <p className="text-sm text-rose-600">{errors.compare_price.message}</p>}
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Stock Quantity</label>
            <input
              type="number"
              {...register("stock_quantity", { valueAsNumber: true })}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            {errors.stock_quantity && <p className="text-sm text-rose-600">{errors.stock_quantity.message}</p>}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">SKU</label>
            <input
              type="text"
              {...register("sku")}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Product Images</label>
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">Upload up to 5 images and drag to reorder.</p>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
                  <Plus className="h-4 w-4" />
                  Upload images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFiles}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {imagePreviews.map((image, index) => (
                  <button
                    type="button"
                    key={image.id}
                    draggable
                    onDragStart={(event) => handleDragStart(event, index)}
                    onDragOver={handleDragOver}
                    onDrop={(event) => handleDrop(event, index)}
                    className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white"
                  >
                    <img src={image.url} alt={`Preview ${index + 1}`} className="h-40 w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/70 to-transparent px-3 py-2 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          removeImage(image.id);
                        }}
                        className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                        <GripVertical className="h-3 w-3" /> Drag
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="submit"
            className="rounded-full bg-slate-900 px-7 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : mode === "new" ? "Create Product" : "Update Product"}
          </Button>
          <Button
            type="button"
            onClick={() => router.push("/vendor/products")}
            className="rounded-full border border-slate-200 bg-white px-7 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
