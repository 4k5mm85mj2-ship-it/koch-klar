export const SUPPORTED_PORTIONS = [2, 3, 4];

const FRACTIONS = new Map([
  ["¼", 0.25],
  ["½", 0.5],
  ["¾", 0.75],
  ["⅓", 1 / 3],
  ["⅔", 2 / 3],
]);

const CONTAINER_UNITS = /^(?:Packung|Dose|Becher|Bund)$/i;
const CONTAINER_PLURALS = new Map([
  ["packung", "Packungen"],
  ["dose", "Dosen"],
]);
const NUMERIC_AMOUNT = /^(\d+(?:[.,]\d+)?|[¼½¾⅓⅔])(?:\s+(.+))?$/;
const PORTION_NUMBER_BASE = /((?:(?:\d{1,3}(?:\.\d{3})+)|\d+)(?:[.,]\d+)?|[¼½¾⅓⅔])(?:\s*(?:kg|g|ml|l|EL|TL|Min\.?|Sek\.?|Stück(?:e)?|Prise(?:n)?))?\s*$/i;
const PORTION_WORD_BASE = /((?:[Ee]in(?:e[nmrs]?)?\s+)?(?:Hälfte|Viertel|Drittel|Sechstel)|[Hh]älfte|[Zz]wei Drittel|[Zz]wei)\s*$/;
const PORTION_NUMBER_ANY = /((?:(?:\d{1,3}(?:\.\d{3})+)|\d+)(?:[.,]\d+)?|[¼½¾⅓⅔])(?:\s*(?:kg|g|ml|l|EL|TL|Min\.?|Sek\.?|Stück(?:e)?|Prise(?:n)?))?/gi;
const PORTION_OPTIONS = /\[([^\[\]|]+?)\s*(?:\||\bI\b)\s*([^\[\]]+?)\]/g;
const STANDALONE_PORTION_OPTION = /^(?:\d+(?:[.,]\d+)?|[¼½¾⅓⅔]|[Ee]in(?:e[nmrs]?)?|[Zz]wei|[Dd]rei|[Vv]ier)(?:\s+(?:kg|g|ml|l|EL|TL|Stück(?:e)?))?$/;

function numberValue(value) {
  if (FRACTIONS.has(value)) return FRACTIONS.get(value);
  return Number(value.replace(",", "."));
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0.25) return "¼";
  if (rounded === 0.5) return "½";
  if (rounded === 0.75) return "¾";
  return String(rounded).replace(".", ",");
}

export function basePortionsFor(recipe) {
  return Number.parseInt(String(recipe?.servings ?? "2"), 10) || 2;
}

export function supportedPortionsFor() {
  return SUPPORTED_PORTIONS;
}

export function amountForPortions(ingredient, targetPortions, basePortions = 2) {
  const originalForPortion = ingredient?.amountsByPortion?.[targetPortions];
  if (originalForPortion) return originalForPortion;
  if (targetPortions === basePortions) return ingredient?.amount ?? "";

  const match = NUMERIC_AMOUNT.exec(ingredient?.amount ?? "");
  if (!match) return ingredient?.amount ?? "";
  const numericValue = numberValue(match[1]);
  if (!Number.isFinite(numericValue)) return ingredient.amount;

  const unit = match[2] ?? "";
  const scaledValue = numericValue * targetPortions / basePortions;
  if (CONTAINER_UNITS.test(unit) && !Number.isInteger(scaledValue)) return ingredient.amount;
  const scaledUnit = scaledValue > 1 ? (CONTAINER_PLURALS.get(unit.toLowerCase()) ?? unit) : unit;
  return `${formatNumber(scaledValue)}${scaledUnit ? ` ${scaledUnit}` : ""}`;
}

export function ingredientsForPortions(recipe, targetPortions) {
  const basePortions = basePortionsFor(recipe);
  return (recipe?.ingredients ?? []).map((ingredient) => ({
    ...ingredient,
    amount: amountForPortions(ingredient, targetPortions, basePortions),
  }));
}

function portionBaseAtEnd(value) {
  const direct = value.match(PORTION_NUMBER_BASE) ?? value.match(PORTION_WORD_BASE);
  if (direct) return direct;

  const candidates = [...value.matchAll(PORTION_NUMBER_ANY)];
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    const suffix = value.slice(candidate.index + candidate[0].length);
    if (suffix.length <= 40 && !/\d/.test(suffix)) return candidate;
  }
  return null;
}

export function stepForPortions(value, targetPortions) {
  const text = typeof value === "string" ? value : "";
  if (!SUPPORTED_PORTIONS.includes(Number(targetPortions)) || !text.includes("[")) return text;

  let result = "";
  let cursor = 0;
  for (const match of text.matchAll(PORTION_OPTIONS)) {
    const before = text.slice(cursor, match.index);
    const baseMatch = portionBaseAtEnd(before);
    if (!baseMatch) {
      const firstOption = match[1].trim();
      const secondOption = match[2].trim();
      if (STANDALONE_PORTION_OPTION.test(firstOption) && STANDALONE_PORTION_OPTION.test(secondOption)) {
        result += before + (Number(targetPortions) === 4 ? secondOption : firstOption);
        cursor = match.index + match[0].length;
        continue;
      }
      result += before + match[0];
      cursor = match.index + match[0].length;
      continue;
    }

    const baseValue = baseMatch[0].trim();
    const selectedValue = Number(targetPortions) === 2
      ? baseValue
      : match[Number(targetPortions) === 3 ? 1 : 2].trim();
    const baseStart = baseMatch.index ?? before.length - baseMatch[0].length;
    const baseEnd = baseStart + baseMatch[0].length;
    const suffix = before.slice(baseEnd).replace(/\s+$/, "");
    result += before.slice(0, baseStart) + selectedValue + suffix;
    cursor = match.index + match[0].length;
  }
  return result + text.slice(cursor);
}
