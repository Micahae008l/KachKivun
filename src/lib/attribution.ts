/**
 * Where a visitor came from, kept on this device until they sign in, then sent once so the admin
 * can count users and payers per platform. First touch wins: a later visit never overwrites it.
 * Only the UTM tags, the referring site's host and the landing path are kept (no query strings,
 * no full referrer URLs). The server adds the in-app browser (TikTok/Instagram) from the request.
 */
import { apiFetch } from "./api";
import { getToken, subscribeAuth } from "./auth";

const KEY = "kk_attr";
const SENT = "kk_attr_sent";

type Attribution = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  referrer: string;
  landingPath: string;
};

function read(): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/** Remember how this visit arrived, if nothing is remembered yet. */
function capture() {
  if (read()) return;
  const params = new URLSearchParams(window.location.search);
  let referrer = "";
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : "";
    referrer = host && host !== window.location.hostname ? host : "";
  } catch {
    // unreadable referrer
  }
  const value: Attribution = {
    utmSource: params.get("utm_source")?.slice(0, 40) ?? "",
    utmMedium: params.get("utm_medium")?.slice(0, 40) ?? "",
    utmCampaign: params.get("utm_campaign")?.slice(0, 80) ?? "",
    referrer,
    landingPath: window.location.pathname.slice(0, 120),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // storage blocked: the server still sees the in-app browser at sign-in
  }
}

let sending = false;

async function sendOnce() {
  if (sending || !getToken()) return;
  try {
    if (localStorage.getItem(SENT)) return;
  } catch {
    return;
  }
  sending = true;
  try {
    await apiFetch("/api/profile/attribution", {
      method: "POST",
      body: JSON.stringify(read() ?? {}),
      retries: 0,
    });
    localStorage.setItem(SENT, "1");
  } catch {
    // try again on the next sign-in
  } finally {
    sending = false;
  }
}

/** Call once on app start: records the arrival now and sends it whenever a session exists. */
export function startAttribution(): () => void {
  capture();
  void sendOnce();
  return subscribeAuth(() => void sendOnce());
}
