import { createFileRoute, redirect } from "@tanstack/react-router";

/** The counselor is the only personalized result product. */
export const Route = createFileRoute("/report")({
  beforeLoad: () => {
    throw redirect({ to: "/ai-counselor", replace: true });
  },
});
