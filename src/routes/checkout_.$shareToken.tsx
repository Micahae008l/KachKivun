import { createFileRoute } from "@tanstack/react-router";
import { CheckoutPage } from "@/components/CheckoutPage";

export const Route = createFileRoute("/checkout_/$shareToken")({
  component: SharedCheckoutRoute,
  head: () => ({
    meta: [
      { title: "קישור לתשלום מאובטח | קח כיוון" },
      {
        name: "description",
        content: "תשלום חד־פעמי לפתיחת שתי התאמות התפקיד המובילות בחשבון.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function SharedCheckoutRoute() {
  const { shareToken } = Route.useParams();
  return <CheckoutPage shareToken={shareToken} />;
}
