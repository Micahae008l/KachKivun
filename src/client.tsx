import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

// Same as TanStack Start's default client entry, except hydration waits for the first frame:
// the server HTML paints right away instead of after the (long, on phones) hydration task.
let started = false;
function hydrate() {
  if (started) return;
  started = true;
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}

// rAF runs just before the next paint; the timeout lands just after it. rAF never fires in a
// hidden tab or pane, so a plain timeout makes sure hydration still happens.
requestAnimationFrame(() => setTimeout(hydrate, 0));
setTimeout(hydrate, 200);
