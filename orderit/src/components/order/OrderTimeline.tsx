interface OrderTimelineProps {
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
}

const steps = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

function isComplete(step: string, status: string) {
  const order = ["pending", "confirmed", "shipped", "delivered"];
  return order.indexOf(step) <= order.indexOf(status);
}

export function OrderTimeline({ status }: OrderTimelineProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Order Timeline</h3>
      <p className="mt-2 text-sm text-slate-600">Track progress from pending to delivered.</p>

      {status === "cancelled" ? (
        <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-slate-700">
          <p className="text-sm font-semibold text-rose-800">Order Cancelled</p>
          <p className="mt-2 text-sm text-rose-700">This order has been cancelled and will not progress further.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {steps.map((step, index) => {
            const completed = isComplete(step.key, status);
            return (
              <div key={step.key} className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-slate-500"}`}>
                    {index + 1}
                  </div>
                  {index !== steps.length - 1 && <div className="h-10 w-px bg-slate-200" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{step.label}</p>
                  <p className="text-sm text-slate-500">{completed ? "Completed" : "Waiting"}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
