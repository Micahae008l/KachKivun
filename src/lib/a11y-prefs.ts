/** User accessibility prefs. Applied as classes on <html>, persisted in localStorage. */

export const A11Y_STORAGE_KEY = "kachkivun-a11y";
export const A11Y_PREFS_EVENT = "kachkivun-a11y-change";

export type A11yTextSize = "md" | "lg" | "xl";

export type A11yPrefs = {
  text: A11yTextSize;
  contrast: boolean;
  reduceMotion: boolean;
};

export const DEFAULT_A11Y_PREFS: A11yPrefs = {
  text: "md",
  contrast: false,
  reduceMotion: false,
};

const TEXT_CLASSES = ["a11y-text-lg", "a11y-text-xl"] as const;

export function readA11yPrefs(): A11yPrefs {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_A11Y_PREFS };
    const parsed = JSON.parse(raw) as Partial<A11yPrefs>;
    return {
      text: parsed.text === "lg" || parsed.text === "xl" ? parsed.text : "md",
      contrast: Boolean(parsed.contrast),
      reduceMotion: Boolean(parsed.reduceMotion),
    };
  } catch {
    return { ...DEFAULT_A11Y_PREFS };
  }
}

export function applyA11yPrefs(prefs: A11yPrefs) {
  const root = document.documentElement;
  for (const cls of TEXT_CLASSES) root.classList.remove(cls);
  if (prefs.text === "lg") root.classList.add("a11y-text-lg");
  if (prefs.text === "xl") root.classList.add("a11y-text-xl");
  root.classList.toggle("a11y-contrast", prefs.contrast);
  root.classList.toggle("a11y-reduce-motion", prefs.reduceMotion);
  window.dispatchEvent(new CustomEvent<A11yPrefs>(A11Y_PREFS_EVENT, { detail: prefs }));
}

export function saveA11yPrefs(prefs: A11yPrefs) {
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can fail in private mode; the live preference must still apply.
  }
  applyA11yPrefs(prefs);
}

/** Inline boot so prefs apply before first paint. Keep in sync with applyA11yPrefs. */
export const A11Y_BOOT_SCRIPT = `(function(){try{var r=JSON.parse(localStorage.getItem("${A11Y_STORAGE_KEY}")||"{}");var h=document.documentElement;if(r.text==="lg")h.classList.add("a11y-text-lg");if(r.text==="xl")h.classList.add("a11y-text-xl");if(r.contrast)h.classList.add("a11y-contrast");if(r.reduceMotion)h.classList.add("a11y-reduce-motion");}catch(e){}})();`;
