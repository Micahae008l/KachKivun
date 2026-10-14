import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Link2, MessageCircle, Share2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const noSubscribe = () => () => {};
const btn =
  "inline-flex min-h-11 flex-1 items-center whitespace-nowrap justify-center gap-2 rounded-md px-4 text-sm font-bold transition active:scale-[0.97] sm:flex-none";

/**
 * Share a result: the system share sheet where the browser has one, WhatsApp and copy-link always.
 * `text` is the message, `url` the link appended to it.
 */
export function ShareButtons({ text, url }: { text: string; url: string }) {
  // Only known after hydration; the server renders without the native button.
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const message = `${text} ${url}`;

  async function nativeShare() {
    try {
      await navigator.share({ text, url });
      trackEvent("share");
    } catch {
      // The share sheet was dismissed; nothing to do.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message).catch(() => {
        // In-app browsers often block the Clipboard API; the old selection copy still works there.
        const area = document.createElement("textarea");
        area.value = message;
        document.body.append(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        if (!ok) throw new Error("copy blocked");
      });
      trackEvent("share");
      toast.success("הקישור הועתק. אפשר להדביק לחברים.");
    } catch {
      toast.error("לא הצלחנו להעתיק. נסו את כפתור הוואטסאפ.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canShare ? (
        <button
          type="button"
          onClick={() => void nativeShare()}
          className={`${btn} bg-primary text-primary-foreground hover:brightness-110`}
        >
          <Share2 className="h-4 w-4" aria-hidden />
          שיתוף
        </button>
      ) : null}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent("share")}
        className={`${btn} border border-primary/50 text-foreground hover:bg-primary/10`}
      >
        <MessageCircle className="h-4 w-4 text-primary" aria-hidden />
        וואטסאפ
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        className={`${btn} border border-iron/40 text-foreground hover:border-primary/50`}
      >
        <Link2 className="h-4 w-4" aria-hidden />
        העתקת קישור
      </button>
    </div>
  );
}
