"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import type { Order } from "@/types";

interface VendorOrdersExportButtonProps {
  orders: Array<{
    id: string;
    buyerName: string;
    total: number;
    payment_status: string;
    status: string;
    created_at: string;
  }>;
}

function buildCsv(orders: VendorOrdersExportButtonProps["orders"]) {
  const headers = ["Order ID", "Buyer", "Total", "Payment Status", "Order Status", "Created At"];
  const rows = orders.map((order) => [
    order.id,
    order.buyerName,
    `₦${order.total.toLocaleString()}`,
    order.payment_status,
    order.status,
    new Date(order.created_at).toLocaleString(),
  ]);
  const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  return csv;
}

export function VendorOrdersExportButton({ orders }: VendorOrdersExportButtonProps) {
  const csv = useMemo(() => buildCsv(orders), [orders]);

  const download = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vendor-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button type="button" onClick={download} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
      Export to CSV
    </Button>
  );
}
