import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PostSignupBootstrapSkeleton } from "@/components/skeletons/PageSkeletons";
import { PostSignupAssessmentPage } from "@/features/assessment/PostSignupAssessmentPage";
import { getPaymentOffer } from "@/lib/api";

export const Route = createFileRoute("/post-signup")({
  component: PostSignupRoutePage,
});

function PostSignupRoutePage() {
  const offerQuery = useQuery({
    queryKey: ["payment-offer"],
    queryFn: getPaymentOffer,
    staleTime: 60_000,
    retry: 1,
  });

  if (offerQuery.isPending) return <PostSignupBootstrapSkeleton />;

  return (
    <PostSignupAssessmentPage
      mode={offerQuery.data?.personalizedFunnelV2 ? "adaptive" : "legacy"}
      offer={offerQuery.data ?? null}
    />
  );
}
