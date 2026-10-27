import { ReturnManagement } from "@/components/returns/ReturnManagement";

export default function VendorReturnsPage() {
  return (
    <div className="w-full min-w-0 max-w-full space-y-5 overflow-x-clip px-0 pb-6 pt-0 md:px-4 md:py-6">
      <div>
        <h1 className="text-3xl font-semibold text-text">Return requests</h1>
        <p className="mt-2 text-sm text-muted">Review requests, coordinate pickup, and issue buyer-wallet refunds.</p>
      </div>
      <ReturnManagement />
    </div>
  );
}
