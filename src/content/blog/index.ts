/** Maps each post slug in posts.json to its body, FAQ and sources. */
import type { ComponentType } from "react";
import type { Source } from "@/components/blog/Prose";
import * as rolesForWomen from "./roles-for-women";
import * as womenCombat from "./women-combat";
import * as preferencesQuestionnaire from "./preferences-questionnaire";
import * as tzavRishon from "./tzav-rishon";
import * as yomHameah from "./yom-hameah";
import * as tironut from "./tironut";
import * as yomSayarot from "./yom-sayarot";
import * as medicalProfile from "./medical-profile";
import * as dapar from "./dapar";
import * as soldierPay from "./soldier-pay";
import * as rolesByProfile from "./roles-by-profile";
import * as rolesByDapar from "./roles-by-dapar";
import * as atuda from "./atuda";
import * as shnatSherut from "./shnat-sherut";
import * as yomHagiyus from "./yom-hagiyus";
import * as gibushim from "./gibushim";
import * as hayalBoded from "./hayal-boded";
import * as miyunim from "./miyunim";

export type PostFaq = { q: string; a: string };

export type PostContent = {
  Body: ComponentType;
  faq: PostFaq[];
  sources: Source[];
};

export const POST_CONTENT: Record<string, PostContent> = {
  "תפקידים-בצבא-לבנות": rolesForWomen,
  "לוחמות-בצהל": womenCombat,
  "שאלון-העדפות": preferencesQuestionnaire,
  "צו-ראשון": tzavRishon,
  "יום-המאה": yomHameah,
  טירונות: tironut,
  "יום-סיירות": yomSayarot,
  "פרופיל-צבאי": medicalProfile,
  דפר: dapar,
  "משכורת-חיילים": soldierPay,
  "תפקידים-לפי-פרופיל": rolesByProfile,
  "תפקידים-לפי-דפר": rolesByDapar,
  "עתודה-אקדמית": atuda,
  "שנת-שירות-ומכינה": shnatSherut,
  "מה-להביא-ליום-הגיוס": yomHagiyus,
  "גיבושים-בצהל": gibushim,
  "חייל-בודד": hayalBoded,
  "מיונים-בצבא": miyunim,
};
