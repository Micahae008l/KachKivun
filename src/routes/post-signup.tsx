import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PostSignupAssessmentPage } from "@/features/assessment/PostSignupAssessmentPage";
import { getPaymentOffer } from "@/lib/api";

export const Route = createFileRoute("/post-signup")({
  component: PostSignupRoutePage,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" },] }),
});

function PostSignupRoutePage() {
  const offerQuery = useQuery({
    queryKey: ["payment-offer"],
    queryFn: getPaymentOffer,
    staleTime: 60_000,
    retry: 1,
  });

  // No wait for the offer: the quiz (V2, the server default) renders in the server HTML, and only
  // an explicit personalizedFunnelV2: false switches to the legacy email-first flow.
  return (
    <PostSignupAssessmentPage
      mode={offerQuery.data?.personalizedFunnelV2 === false ? "legacy" : "adaptive"}
      offer={offerQuery.data ?? null}
    />
  );
}
