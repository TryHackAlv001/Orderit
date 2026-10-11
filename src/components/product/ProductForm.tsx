import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ProductForm() {
  return (
    <form className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm">
      <Input placeholder="Product name" />
      <Input placeholder="Price" type="number" />
      <Button type="submit">Save product</Button>
    </form>
  );
}
