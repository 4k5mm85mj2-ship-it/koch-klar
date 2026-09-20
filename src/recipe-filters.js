export const TIME_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "up-to-20", label: "Bis 20 Minuten" },
  { value: "21-to-30", label: "21 bis 30 Minuten" },
  { value: "31-to-45", label: "31 bis 45 Minuten" },
  { value: "46-to-60", label: "46 bis 60 Minuten" },
  { value: "over-60", label: "Mehr als 60 Minuten" },
];

export function totalMinutes(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function timeFilterFor(value) {
  const minutes = totalMinutes(value);
  if (minutes === null) return null;
  if (minutes <= 20) return "up-to-20";
  if (minutes <= 30) return "21-to-30";
  if (minutes <= 45) return "31-to-45";
  if (minutes <= 60) return "46-to-60";
  return "over-60";
}

function dietGroup(recipe) {
  return recipe.dietGroup ?? (["Vegetarisch", "Vegan"].includes(recipe.diet) ? "vegetarian" : "non-vegetarian");
}

export function filterRecipes(recipes, { diet = "all", difficulty = "all", totalTime = "all" } = {}) {
  return recipes.filter((recipe) => {
    if (diet !== "all" && dietGroup(recipe) !== diet) return false;
    if (difficulty !== "all" && recipe.difficulty !== difficulty) return false;
    if (totalTime !== "all" && timeFilterFor(recipe.time) !== totalTime) return false;
    return true;
  });
}
