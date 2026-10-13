import OrdersPageWrapper from "./OrdersPage";

export default function OrdersPage({
  searchParams,
}: {
  searchParams?: { filter?: string | string[] };
}) {
  const showInProgressOnly = searchParams?.filter === "in_progress";
  return <OrdersPageWrapper showInProgressOnly={showInProgressOnly} />;
}