import type { Metadata } from "next";
import CategoriesPageClient from "./CategoriesPageClient";

export const metadata: Metadata = {
  title: "Shop by category | Tradeloft",
  description: "Browse product categories and discover items from trusted local vendors.",
};

export default function CategoriesPage() {
  return <CategoriesPageClient />;
}
