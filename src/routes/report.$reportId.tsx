import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/report/$reportId")({
  beforeLoad: () => {
    throw redirect({ to: "/ai-counselor", replace: true });
  },
});
