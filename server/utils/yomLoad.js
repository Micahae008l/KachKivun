import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { migrateLegacyYomHameah } from "./yomHameahKeys.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @typedef {{ id: string; category: string; question: string }} YomDef */

/** @returns {YomDef[]} */
export function loadYomQuestionDefs() {
  const filePath = path.join(__dirname, "../../content/he/yom-hameah-questions.txt");
  const text = fs.readFileSync(filePath, "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .map((line) => {
      const [id, category, question] = line.split("|");
      return {
        id: id?.trim() ?? "",
        category: category?.trim() ?? "",
        question: question?.trim() ?? "",
      };
    })
    .filter((d) => d.id && d.category);
}

const CATEGORIES = ["teamwork", "management", "technical", "field", "dataProcessing"];

/**
 * @param {{ questionId: string; score: number }[]} answers
 * @param {YomDef[]} defs
 * @returns {Record<string, number> | null}
 */
export function aggregateYomFromAnswers(answers, defs) {
  const byCat = {};
  for (const d of defs) {
    const a = answers.find((x) => x.questionId === d.id);
    if (!a || typeof a.score !== "number") continue;
    if (!byCat[d.category]) byCat[d.category] = [];
    byCat[d.category].push(a.score);
  }
  const yom = {};
  for (const k of CATEGORIES) {
    const arr = byCat[k];
    if (arr?.length) {
      yom[k] = Math.round(arr.reduce((s, x) => s + x, 0) / arr.length);
    }
  }
  if (Object.keys(yom).length !== 5) return null;
  return migrateLegacyYomHameah(yom);
}

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
