import { createFileRoute } from "@tanstack/react-router";
import { CheckoutPage } from "@/components/CheckoutPage";

export const Route = createFileRoute("/checkout")({
  component: CheckoutRoute,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "תשלום מאובטח | קח כיוון" },
      {
        name: "description",
        content: "פתיחה קבועה של שלוש התאמות התפקיד המובילות בתשלום חד־פעמי.",
      },
    ],
  }),
});

function CheckoutRoute() {
  return <CheckoutPage />;
}
