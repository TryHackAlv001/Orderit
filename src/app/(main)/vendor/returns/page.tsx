import { ReturnManagement } from "@/components/returns/ReturnManagement";

export default function VendorReturnsPage() {
  return (
    <div className="space-y-5 px-4 py-6">
      <div>
        <h1 className="text-3xl font-semibold text-text">Return requests</h1>
        <p className="mt-2 text-sm text-muted">Review requests, coordinate pickup, and issue buyer-wallet refunds.</p>
      </div>
      <ReturnManagement />
    </div>
  );
}
