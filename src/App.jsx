import { useCallback, useEffect, useRef, useState } from "react";
import fallbackMenu from "./data/menu-snapshot.json";
import menuWeeks from "./data/menu-weeks.json";
import { segmentCookStep } from "./cook-step-segments.js";
import { filterRecipes, TIME_FILTERS } from "./recipe-filters.js";
import { basePortionsFor, ingredientsForPortions, stepForPortions, supportedPortionsFor } from "./portion-scaling.js";

const bundledDefaultMenu = menuWeeks.menus?.[menuWeeks.defaultWeek] ?? fallbackMenu;
const recipeDetails = import.meta.glob("./data/recipes/*.json");

export function App() {
  const [menu, setMenu] = useState({ ...bundledDefaultMenu, dataStatus: "snapshot" });
  const [selectedWeek, setSelectedWeek] = useState("");
  const [dietFilter, setDietFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [menuLoading, setMenuLoading] = useState(true);
  const [loadingRecipeId, setLoadingRecipeId] = useState(null);
  const [view, setView] = useState("menu");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedPortions, setSelectedPortions] = useState(2);
  const [stepIndex, setStepIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const pageHeadingRef = useRef(null);
  const previousLocationRef = useRef("menu:");
  const pendingFilterFocusRef = useRef(null);

  const preserveControlFocus = (control, waitForMenu = false) => {
    pendingFilterFocusRef.current = { control, waitForMenu };
  };

  useEffect(() => {
    document.title = "KochKlar – barrierearm kochen mit Rezepten von HelloFresh";
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMenu() {
      if (import.meta.env.MODE === "pages") {
        const bundledWeek = selectedWeek || menuWeeks.defaultWeek;
        const bundledMenu = menuWeeks.menus?.[bundledWeek];
        if (bundledMenu) {
          setMenu({ ...bundledMenu, availableWeeks: menuWeeks.availableWeeks, dataStatus: "snapshot" });
          setAnnouncement(`${bundledMenu.recipes.length} Gerichte aus dem gespeicherten Wochenstand geladen.`);
        }
        setMenuLoading(false);
        return;
      }

      try {
        setMenuLoading(true);
        const query = selectedWeek && selectedWeek !== "fallback" ? `?week=${encodeURIComponent(selectedWeek)}` : "";
        const response = await fetch(`/api/menu${query}`, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Menü konnte nicht geladen werden.");
        const importedMenu = await response.json();
        if (!Array.isArray(importedMenu.recipes) || importedMenu.recipes.length === 0) {
          throw new Error("Menü enthält keine Rezepte.");
        }
        setMenu(importedMenu);
        setAnnouncement(`${importedMenu.recipes.length} Gerichte geladen.`);
      } catch (error) {
        if (error.name !== "AbortError") {
          const bundledWeek = selectedWeek || menuWeeks.defaultWeek;
          const bundledMenu = menuWeeks.menus?.[bundledWeek];
          if (bundledMenu) {
            setMenu({ ...bundledMenu, availableWeeks: menuWeeks.availableWeeks, dataStatus: "snapshot" });
            setAnnouncement(`${bundledMenu.recipes.length} Gerichte aus dem gespeicherten Wochenstand geladen.`);
          } else {
            setAnnouncement("Diese Woche konnte nicht geladen werden. Das bisherige Menü bleibt geöffnet.");
          }
        }
      } finally {
        if (!controller.signal.aborted) setMenuLoading(false);
      }
    }

    loadMenu();
    return () => controller.abort();
  }, [selectedWeek]);

  useEffect(() => {
    const nextLocation = `${view}:${selectedRecipe?.id ?? ""}`;
    if (previousLocationRef.current === nextLocation) return;
    previousLocationRef.current = nextLocation;
    pageHeadingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view, selectedRecipe?.id]);

  const navigate = useCallback((nextView) => {
    if (nextView !== "menu" && !selectedRecipe) return;
    if (nextView === "cook" && view !== "cook") setStepIndex(0);
    setView(nextView);
  }, [selectedRecipe, view]);

  const goBackOneLevel = useCallback(() => {
    if (view === "cook") navigate("recipe");
    else if (view === "recipe") navigate("menu");
  }, [navigate, view]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || view === "menu") return;
      event.preventDefault();
      goBackOneLevel();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [goBackOneLevel, view]);

  const openRecipe = async (recipe) => {
    if (recipe.ingredients?.length && recipe.steps?.length) {
      setSelectedRecipe(recipe);
      setSelectedPortions(basePortionsFor(recipe));
      setView("recipe");
      setAnnouncement(`${recipe.title} geöffnet.`);
      return;
    }
    setLoadingRecipeId(recipe.id);
    setAnnouncement(`${recipe.title} wird geladen.`);
    try {
      const loadDetail = recipeDetails[`./data/recipes/${recipe.id}.json`];
      if (!loadDetail) throw new Error("Rezept konnte nicht geladen werden.");
      const detail = (await loadDetail()).default;
      const completeRecipe = { ...recipe, ...detail, diet: recipe.diet, dietGroup: recipe.dietGroup, difficulty: recipe.difficulty };
      setSelectedRecipe(completeRecipe);
      setSelectedPortions(basePortionsFor(completeRecipe));
      setView("recipe");
      setAnnouncement(`${recipe.title} geöffnet.`);
    } catch {
      setAnnouncement(`${recipe.title} konnte nicht geladen werden. Bitte versuche es erneut.`);
    } finally {
      setLoadingRecipeId(null);
    }
  };

  const availableWeeks = menu.availableWeeks?.length
    ? menu.availableWeeks
    : [{ value: "fallback", label: menu.weekSpokenLabel ?? menu.weekLabel }];
  const filteredRecipes = filterRecipes(menu.recipes, {
    diet: dietFilter,
    difficulty: difficultyFilter,
    totalTime: timeFilter,
  });
  const vegetarianCount = menu.recipes.filter((recipe) => (recipe.dietGroup ?? (["Vegetarisch", "Vegan"].includes(recipe.diet) ? "vegetarian" : "non-vegetarian")) === "vegetarian").length;
  const filtersActive = dietFilter !== "all" || difficultyFilter !== "all" || timeFilter !== "all";
  const selectedIngredients = selectedRecipe ? ingredientsForPortions(selectedRecipe, selectedPortions) : [];
  const supportedPortions = selectedRecipe ? supportedPortionsFor(selectedRecipe) : [];
  const currentStepText = selectedRecipe ? stepForPortions(selectedRecipe.steps[stepIndex], selectedPortions) : "";
  const currentStepSegments = selectedRecipe ? segmentCookStep(currentStepText) : [];
  const currentStepLabel = selectedRecipe ? `Schritt ${stepIndex + 1} von ${selectedRecipe.steps.length}` : "";
  const currentStepAccessibleText = selectedRecipe ? `${currentStepLabel}.\n${currentStepSegments[0]}` : "";

  useEffect(() => {
    const pendingFocus = pendingFilterFocusRef.current;
    if (!pendingFocus || view !== "menu" || !document.contains(pendingFocus.control)) return;
    if (pendingFocus.waitForMenu && menuLoading) return;

    let secondFrame;
    let focusTimer;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        focusTimer = window.setTimeout(() => {
          if (pendingFilterFocusRef.current !== pendingFocus || !document.contains(pendingFocus.control)) return;
          pendingFocus.control.blur();
          pendingFocus.control.focus({ preventScroll: true });
          pendingFilterFocusRef.current = null;
        }, 120);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      if (focusTimer) window.clearTimeout(focusTimer);
    };
  }, [selectedWeek, dietFilter, difficultyFilter, timeFilter, view, menuLoading]);

  const changeStep = (direction) => {
    if (!selectedRecipe) return;
    const nextStep = Math.min(Math.max(stepIndex + direction, 0), selectedRecipe.steps.length - 1);
    setStepIndex(nextStep);
    setAnnouncement("");
    requestAnimationFrame(() => pageHeadingRef.current?.focus());
  };

  const startCooking = () => {
    setStepIndex(0);
    navigate("cook");
  };

  return (
    <>
      <a className="skip-link" href="#main-content">Direkt zum Inhalt</a>

      <header className="site-header">
        <span className="wordmark">KochKlar</span>
      </header>

      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>

      <main id="main-content" className="page-shell">
        {view === "menu" && (
          <section aria-labelledby="menu-heading">
            <div className="intro-block">
              <h1 id="menu-heading" ref={pageHeadingRef} tabIndex="-1">Wochenmenü</h1>
            </div>

            <section className="menu-controls" aria-labelledby="menu-controls-heading">
              <h2 id="menu-controls-heading">Woche und Filter</h2>
              <div className="filter-field">
                <label htmlFor="week-select">Woche auswählen</label>
                <select id="week-select" value={selectedWeek || menu.week || "fallback"} disabled={availableWeeks.length < 2} onChange={(event) => {
                  const control = event.currentTarget;
                  setDietFilter("all");
                  setDifficultyFilter("all");
                  setTimeFilter("all");
                  setSelectedRecipe(null);
                  setSelectedWeek(control.value);
                  preserveControlFocus(control, true);
                }}>
                  {availableWeeks.map((week) => <option key={week.value} value={week.value}>{week.label}</option>)}
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="diet-select">Gerichte auswählen</label>
                <select id="diet-select" value={dietFilter} onChange={(event) => {
                  const control = event.currentTarget;
                  setDietFilter(control.value);
                  preserveControlFocus(control);
                }}>
                  <option value="all">Alle ({menu.recipes.length})</option>
                  <option value="vegetarian">Vegetarisch und vegan ({vegetarianCount})</option>
                  <option value="non-vegetarian">Nicht vegetarisch ({menu.recipes.length - vegetarianCount})</option>
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="difficulty-select">Schwierigkeit filtern</label>
                <select id="difficulty-select" value={difficultyFilter} onChange={(event) => {
                  const control = event.currentTarget;
                  setDifficultyFilter(control.value);
                  preserveControlFocus(control);
                }}>
                  <option value="all">Alle</option>
                  <option value="einfach">Einfach</option>
                  <option value="mittel">Mittel</option>
                  <option value="schwierig">Schwierig</option>
                </select>
              </div>
              <div className="filter-field">
                <label htmlFor="time-select">Gesamtzeit filtern</label>
                <select id="time-select" value={timeFilter} onChange={(event) => {
                  const control = event.currentTarget;
                  setTimeFilter(control.value);
                  preserveControlFocus(control);
                }}>
                  {TIME_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                </select>
              </div>
              <button className="button button--secondary filter-reset" type="button" aria-disabled={!filtersActive} onClick={(event) => {
                  const control = event.currentTarget;
                  setDietFilter("all");
                  setDifficultyFilter("all");
                  setTimeFilter("all");
                  preserveControlFocus(control);
                }}>Filter zurücksetzen</button>
              <p className="result-count">{menuLoading ? "Wochenmenü wird geladen." : `${filteredRecipes.length} ${filteredRecipes.length === 1 ? "Gericht" : "Gerichte"} angezeigt.`}</p>
            </section>

            <ol className="recipe-list">
              {filteredRecipes.map((recipe, index) => (
                <li className="recipe-row" key={recipe.id}>
                  <div className="recipe-visual" role="img" aria-label={`Gericht ${index + 1} von ${filteredRecipes.length}. ${recipe.alt}`}>
                    <span className="recipe-number" aria-hidden="true">{index + 1}.</span>
                    <img className="recipe-thumbnail" src={recipe.image} alt="" aria-hidden="true" width="320" height="180" />
                  </div>
                  <div className="recipe-summary">
                    <h3>{recipe.title}</h3>
                    <p className="recipe-type">{recipe.diet}</p>
                    <div className="recipe-meta">
                      <p>{`Gesamtzeit, ${recipe.time}`}</p>
                      <p>{`Schwierigkeit, ${recipe.difficulty}`}</p>
                    </div>
                  </div>
                  <button className="button button--primary recipe-action" type="button" disabled={loadingRecipeId === recipe.id} onClick={() => openRecipe(recipe)} aria-label={`Rezept öffnen: ${recipe.title}`}>{loadingRecipeId === recipe.id ? "Rezept wird geladen" : "Rezept öffnen"}</button>
                </li>
              ))}
            </ol>

            <aside className="keyboard-hint" aria-label="Tastaturhinweis"><strong>Tastatur:</strong> Mit Tab zu den Gerichten, mit Enter öffnen.</aside>
          </section>
        )}

        {view === "recipe" && selectedRecipe && (
          <article aria-labelledby="recipe-heading">
            <button className="back-link" type="button" onClick={() => navigate("menu")}>Zurück zum Wochenmenü</button>
            <div className="recipe-hero">
              <div>
                <p className="eyebrow">Rezeptdetails</p>
                <h1 id="recipe-heading" ref={pageHeadingRef} tabIndex="-1">{selectedRecipe.title}</h1>
                <p className="lead">{selectedRecipe.intro}</p>
                <ul className="facts" aria-label="Rezeptinformationen">
                  <li className="portion-field">
                    <label htmlFor="portion-select">Portionen</label>
                    <select id="portion-select" value={selectedPortions} onChange={(event) => setSelectedPortions(Number(event.currentTarget.value))}>
                      {supportedPortions.map((portions) => <option key={portions} value={portions}>{portions}</option>)}
                    </select>
                  </li>
                  <li className="fact-time">{`Gesamtzeit, ${selectedRecipe.time}`}</li>
                  <li className="fact-difficulty">{`Schwierigkeit, ${selectedRecipe.difficulty}`}</li>
                </ul>
                <div className="recipe-quick-actions">
                  <button className="button button--primary button--large" type="button" onClick={startCooking}>Kochmodus starten</button>
                  <a className="text-link" href="#ingredients">Direkt zur Zutatenliste</a>
                </div>
                <a className="text-link source-link" href={selectedRecipe.sourceUrl} target="_blank" rel="noreferrer">Originalrezept bei HelloFresh öffnen</a>
              </div>
              <img className="recipe-hero-image" src={selectedRecipe.image} alt="" width="1200" height="800" />
            </div>

            <section id="ingredients" className="content-section" aria-labelledby="ingredients-heading">
              <p className="eyebrow">Mengen und Erkennungsmerkmale</p>
              <h2 id="ingredients-heading">Zutaten und Verpackungen</h2>
              <p className="section-intro">Die Ausgangsmengen stammen aus dem öffentlichen Originalrezept und werden für die gewählte Portionszahl angepasst. Eine Verpackungsbeschreibung erscheint nur, wenn eine konkrete Beschreibung vorhanden ist; die Verpackung kann je nach Lieferung abweichen.</p>
              <ul className="ingredient-list">
                {selectedIngredients.map((ingredient) => (
                  <li key={ingredient.name}>
                    <p className="ingredient-title">{`${ingredient.name}, ${ingredient.amount}`}</p>
                    {ingredient.packaging && <p>{`Verpackung erkennen: ${ingredient.packaging}`}</p>}
                  </li>
                ))}
              </ul>
            </section>

            <section className="content-section" aria-labelledby="preparation-heading">
              <h2 id="preparation-heading">Zubereitung</h2>
              <p>Im Kochmodus wird immer nur ein Schritt angezeigt. Die Anleitung nennt Zeiten und Handlungen vollständig und in einer festen Reihenfolge.</p>
              <button className="button button--primary button--large" type="button" onClick={startCooking}>Kochmodus starten</button>
              <a className="text-link recipe-return-link" href="#main-content" onClick={(event) => { event.preventDefault(); navigate("menu"); }}>Zurück zum Wochenmenü</a>
            </section>
          </article>
        )}

        {view === "cook" && selectedRecipe && (
          <article className="cook-view" aria-labelledby="cook-heading">
            <button className="back-link" type="button" onClick={() => navigate("recipe")}>Zurück zu den Rezeptdetails</button>
            <p className="eyebrow">{selectedRecipe.title}</p>
            <progress className="step-progress" value={stepIndex + 1} max={selectedRecipe.steps.length} aria-hidden="true" />
            <div className="step-panel">
              <div className="step-segments">
                <p id="cook-heading" className="cook-step-combined" ref={pageHeadingRef} tabIndex="-1">{currentStepAccessibleText}</p>
                {currentStepSegments.slice(1).map((segment, index) => <p className="step-segment" key={`${stepIndex}-${index + 1}`}>{segment}</p>)}
              </div>
            </div>
            <div className="step-controls">
              {stepIndex < selectedRecipe.steps.length - 1 ? (
                <button className="button button--primary" type="button" onClick={() => changeStep(1)}>Nächster Schritt</button>
              ) : (
                <button className="button button--primary" type="button" onClick={() => navigate("recipe")}>Zurück zu den Rezeptdetails</button>
              )}
              <button className="button button--secondary" type="button" disabled={stepIndex === 0} onClick={() => changeStep(-1)}>Vorheriger Schritt</button>
              {stepIndex === selectedRecipe.steps.length - 1 && (
                <button className="button button--secondary" type="button" onClick={() => navigate("menu")}>Zurück zum Wochenmenü</button>
              )}
            </div>
          </article>
        )}
      </main>

      <footer className="site-footer">
        <p>KochKlar ist ein unabhängiger, nicht kommerzieller Prototyp zur Erprobung einer barrierearmen Nutzung von Kochrezepten. KochKlar steht in keiner Verbindung zu HelloFresh und wird von HelloFresh weder angeboten noch unterstützt. HelloFresh ist eine Marke der jeweiligen Rechteinhaber.</p>
      </footer>
    </>
  );
}
