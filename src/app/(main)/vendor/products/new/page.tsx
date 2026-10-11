"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogProductForm } from "@/components/vendor/CatalogProductForm";
import type { CatalogOptions } from "@/lib/product-attributes";

export default function NewVendorProductPage() {
  const router = useRouter();
  const [options, setOptions] = useState<CatalogOptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vendor/products")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load product options.");
        setOptions(result);
      })
      .catch((loadError: unknown) => {
        const message = loadError instanceof Error ? loadError.message : "Unable to load product options.";
        setError(message);
        if (message === "Unauthorized") router.push("/login");
      });
  }, [router]);

  if (error) return <div role="alert" className="m-4 rounded-lg bg-danger/10 p-4 text-danger-text">{error}</div>;
  if (!options) return <div className="flex min-h-[300px] items-center justify-center text-muted">Loading product options…</div>;

  return <div className="px-4 py-6"><CatalogProductForm mode="new" options={options} /></div>;
}
