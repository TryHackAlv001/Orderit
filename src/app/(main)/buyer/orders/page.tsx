import OrdersPageWrapper from "./OrdersPage";

export default function OrdersPage({
  searchParams,
}: {
  searchParams?: { filter?: string | string[] };
}) {
  const filter = typeof searchParams?.filter === "string" ? searchParams.filter : "all";
  const selectedFilter =
    filter === "in_progress" || filter === "delivered" || filter === "cancelled"
      ? filter
      : "all";

  return <OrdersPageWrapper filter={selectedFilter} />;
}