"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Eye, Edit3, Plus } from "lucide-react";

interface OwnerControlsProps {
  vendorId: string;
  onToggleView: (viewPublic: boolean) => void;
}

export function OwnerControls({ vendorId, onToggleView }: OwnerControlsProps) {
  const [viewPublic, setViewPublic] = useState(true);

  const handleToggle = () => {
    const next = !viewPublic;
    setViewPublic(next);
    onToggleView(next);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/vendor/settings">
          <Button>
            <Edit3 className="mr-2 h-4 w-4" />
            Edit Store
          </Button>
        </Link>

        <Link href="/vendor/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm text-text hover:bg-bg"
        >
          <Eye className="h-4 w-4" />
          {viewPublic ? 'View as Public' : 'Viewing as Owner'}
        </button>
      </div>
    </div>
  );
}

export default OwnerControls;
