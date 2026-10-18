import OrdersPageWrapper from "./OrdersPage";

export default function OrdersPage({
  searchParams,
}: {
  searchParams?: { filter?: string | string[]; view?: string | string[] };
}) {
  const showInProgressOnly = searchParams?.filter === "in_progress";
  const view = searchParams?.view === "items" ? "items" : "orders";
  return <OrdersPageWrapper showInProgressOnly={showInProgressOnly} view={view} />;
}