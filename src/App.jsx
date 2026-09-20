import { useEffect, useRef, useState } from "react";
import fallbackMenu from "./data/menu-snapshot.json";
import menuWeeks from "./data/menu-weeks.json";

const bundledDefaultMenu = menuWeeks.menus?.[menuWeeks.defaultWeek] ?? fallbackMenu;

function Navigation({ view, recipe, onNavigate }) {
  return (
    <nav className="main-nav" aria-label="Hauptnavigation">
      <button className={view === "menu" ? "nav-link nav-link--active" : "nav-link"} type="button" aria-current={view === "menu" ? "page" : undefined} onClick={() => onNavigate("menu")}>Wochenmenü</button>
      <button className={view === "recipe" ? "nav-link nav-link--active" : "nav-link"} type="button" aria-current={view === "recipe" ? "page" : undefined} disabled={!recipe} onClick={() => onNavigate("recipe")}>Rezept</button>
      <button className={view === "cook" ? "nav-link nav-link--active" : "nav-link"} type="button" aria-current={view === "cook" ? "page" : undefined} disabled={!recipe} onClick={() => onNavigate("cook")}>Kochmodus</button>
    </nav>
  );
}

export function App() {
  const [menu, setMenu] = useState({ ...bundledDefaultMenu, dataStatus: "snapshot" });
  const [selectedWeek, setSelectedWeek] = useState("");
  const [dietFilter, setDietFilter] = useState("all");
  const [menuLoading, setMenuLoading] = useState(true);
  const [loadingRecipeId, setLoadingRecipeId] = useState(null);
  const [view, setView] = useState("menu");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const pageHeadingRef = useRef(null);
  const stepTextRef = useRef(null);
  const previousLocationRef = useRef("menu:");

  useEffect(() => {
    document.title = "Einfach kochen – barrierefreier Rezept-Prototyp";
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMenu() {
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
        setAnnouncement(`${importedMenu.weekLabel} mit ${importedMenu.recipes.length} Gerichten geladen.`);
      } catch (error) {
        if (error.name !== "AbortError") {
          const bundledWeek = selectedWeek || menuWeeks.defaultWeek;
          const bundledMenu = menuWeeks.menus?.[bundledWeek];
          if (bundledMenu) {
            setMenu({ ...bundledMenu, availableWeeks: menuWeeks.availableWeeks, dataStatus: "snapshot" });
            setAnnouncement(`${bundledMenu.weekLabel} mit ${bundledMenu.recipes.length} Gerichten aus dem gespeicherten Wochenstand geladen.`);
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
    if (view === "cook") {
      stepTextRef.current?.focus();
    } else {
      pageHeadingRef.current?.focus();
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view, selectedRecipe?.id]);

  const navigate = (nextView) => {
    if (nextView !== "menu" && !selectedRecipe) return;
    if (nextView === "cook" && view !== "cook") setStepIndex(0);
    setView(nextView);
  };

  const openRecipe = async (recipe) => {
    if (recipe.ingredients?.length && recipe.steps?.length) {
      setSelectedRecipe(recipe);
      setView("recipe");
      setAnnouncement(`${recipe.title} geöffnet.`);
      return;
    }
    setLoadingRecipeId(recipe.id);
    setAnnouncement(`${recipe.title} wird geladen.`);
    try {
      const response = await fetch(`/api/recipe?url=${encodeURIComponent(recipe.sourceUrl)}`, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("Rezept konnte nicht geladen werden.");
      const detail = await response.json();
      setSelectedRecipe({ ...recipe, ...detail, diet: recipe.diet, dietGroup: recipe.dietGroup, difficulty: recipe.difficulty });
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
    : [{ value: "fallback", label: menu.weekLabel }];
  const filteredRecipes = menu.recipes.filter((recipe) => {
    if (dietFilter === "all") return true;
    const group = recipe.dietGroup ?? (["Vegetarisch", "Vegan"].includes(recipe.diet) ? "vegetarian" : "non-vegetarian");
    return group === dietFilter;
  });
  const vegetarianCount = menu.recipes.filter((recipe) => (recipe.dietGroup ?? (["Vegetarisch", "Vegan"].includes(recipe.diet) ? "vegetarian" : "non-vegetarian")) === "vegetarian").length;

  const changeStep = (direction) => {
    if (!selectedRecipe) return;
    const nextStep = Math.min(Math.max(stepIndex + direction, 0), selectedRecipe.steps.length - 1);
    setStepIndex(nextStep);
    setAnnouncement("");
    requestAnimationFrame(() => stepTextRef.current?.focus());
  };

  const startCooking = () => {
    setStepIndex(0);
    navigate("cook");
  };

  return (
    <>
      <a className="skip-link" href="#main-content">Direkt zum Inhalt</a>

      <header className="site-header">
        <button className="wordmark" type="button" onClick={() => navigate("menu")} aria-label="Einfach kochen – zum Wochenmenü">Einfach kochen</button>
        <Navigation view={view} recipe={selectedRecipe} onNavigate={navigate} />
      </header>

      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>

      <main id="main-content" className="page-shell">
        {view === "menu" && (
          <section aria-labelledby="menu-heading">
            <div className="intro-block">
              <h1 id="menu-heading" ref={pageHeadingRef} tabIndex="-1">Wochenmenü</h1>
              <p>Wähle ein Gericht. Danach erhältst du Zutaten, Verpackungsbeschreibungen und Kochschritte.</p>
            </div>

            <div className="week-heading">
              <h2 className="week-title">{menu.weekLabel}</h2>
            </div>

            <section className="menu-controls" aria-labelledby="menu-controls-heading">
              <h2 id="menu-controls-heading">Woche und Ernährungsart</h2>
              <div className="week-select-wrap">
                <label htmlFor="week-select">Woche auswählen</label>
                <select id="week-select" value={selectedWeek || menu.week || "fallback"} disabled={menuLoading || availableWeeks.length < 2} onChange={(event) => {
                  setDietFilter("all");
                  setSelectedRecipe(null);
                  setSelectedWeek(event.target.value);
                }}>
                  {availableWeeks.map((week) => <option key={week.value} value={week.value}>{week.label}</option>)}
                </select>
              </div>
              <div className="diet-filter">
                <label htmlFor="diet-select">Gerichte auswählen</label>
                <select id="diet-select" value={dietFilter} onChange={(event) => setDietFilter(event.target.value)}>
                  <option value="all">Alle ({menu.recipes.length})</option>
                  <option value="vegetarian">Vegetarisch und vegan ({vegetarianCount})</option>
                  <option value="non-vegetarian">Nicht vegetarisch ({menu.recipes.length - vegetarianCount})</option>
                </select>
              </div>
              <p className="result-count" aria-live="polite" aria-atomic="true">{menuLoading ? "Wochenmenü wird geladen." : `${filteredRecipes.length} ${filteredRecipes.length === 1 ? "Gericht" : "Gerichte"} angezeigt.`}</p>
            </section>

            <aside className="data-source-note" aria-label="Datenquelle">
              <p>{menu.dataStatus === "live"
                ? `Echte Rezeptdaten von ${menu.sourceName}. Automatisch aktualisiert am ${menu.importedAt}.`
                : menu.dataStatus === "cached"
                  ? `Echte Rezeptdaten von ${menu.sourceName}. Zuletzt erfolgreich aktualisiert am ${menu.importedAt}; eine neue Prüfung läuft im Hintergrund.`
                  : menu.dataStatus === "snapshot"
                    ? `Echte Rezeptdaten von ${menu.sourceName}, importiert am ${menu.importedAt}. Vollständiger gespeicherter Wochenstand geladen.`
                    : `Echte Rezeptdaten von ${menu.sourceName}, importiert am ${menu.importedAt}. Gespeicherter Datenstand geladen.`}</p>
              <a className="text-link" href={menu.sourceUrl} target="_blank" rel="noreferrer">Öffentliches HelloFresh-Wochenmenü öffnen</a>
            </aside>

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
                      <p>{`Gesamtzeit: ${recipe.time}`}</p>
                      <p>{`Schwierigkeit: ${recipe.difficulty}`}</p>
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
                  <li>{`Portionen: ${selectedRecipe.servings}`}</li>
                  <li>{`Zeit: ${selectedRecipe.time}`}</li>
                  <li>{`Schwierigkeit: ${selectedRecipe.difficulty}`}</li>
                </ul>
                <div className="recipe-quick-actions">
                  <button className="button button--primary button--large" type="button" onClick={startCooking}>Kochmodus starten</button>
                  <a className="text-link" href="#ingredients">Direkt zur Zutatenliste</a>
                </div>
                <a className="text-link source-link" href={selectedRecipe.sourceUrl} target="_blank" rel="noreferrer">Originalrezept bei HelloFresh öffnen</a>
              </div>
              <img className="recipe-hero-image" src={selectedRecipe.image} alt={selectedRecipe.alt} width="1200" height="800" />
            </div>

            <section id="ingredients" className="content-section" aria-labelledby="ingredients-heading">
              <p className="eyebrow">Mengen und Erkennungsmerkmale</p>
              <h2 id="ingredients-heading">Zutaten und Verpackungen</h2>
              <p className="section-intro">Die Mengen stammen aus dem öffentlichen Originalrezept für zwei Portionen. Die Verpackungsbeschreibungen sind unsere beispielhafte Ergänzung und können je nach Lieferung abweichen.</p>
              <ul className="ingredient-list">
                {selectedRecipe.ingredients.map((ingredient) => (
                  <li key={ingredient.name}>
                    <p className="ingredient-title">{`${ingredient.name}, ${ingredient.amount}`}</p>
                    <p>{`Verpackung erkennen: ${ingredient.packaging}`}</p>
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
            <h1 id="cook-heading" ref={pageHeadingRef} tabIndex="-1">Schritt {stepIndex + 1} von {selectedRecipe.steps.length}</h1>
            <progress className="step-progress" value={stepIndex + 1} max={selectedRecipe.steps.length} aria-label={`Kochfortschritt: Schritt ${stepIndex + 1} von ${selectedRecipe.steps.length}`}>{stepIndex + 1} von {selectedRecipe.steps.length}</progress>
            <div className="step-panel">
              <p ref={stepTextRef} tabIndex="-1">{`Schritt ${stepIndex + 1} von ${selectedRecipe.steps.length}. ${selectedRecipe.steps[stepIndex]}`}</p>
            </div>
            <div className="step-controls">
              <button className="button button--secondary" type="button" disabled={stepIndex === 0} onClick={() => changeStep(-1)}>Vorheriger Schritt</button>
              {stepIndex < selectedRecipe.steps.length - 1 ? (
                <button className="button button--primary" type="button" onClick={() => changeStep(1)}>Nächster Schritt</button>
              ) : (
                <button className="button button--primary" type="button" onClick={() => navigate("menu")}>Fertig – zurück zum Wochenmenü</button>
              )}
            </div>
            <aside className="keyboard-hint" aria-label="Tastaturhinweis"><strong>Tastatur:</strong> Der vollständige Schritt ist fokussiert. Mit Tab gelangst du direkt zu den Schaltflächen.</aside>
          </article>
        )}
      </main>

      <footer className="site-footer"><p>Funktionaler Prototyp ohne Anmeldung und Bestellung. Rezeptdaten: HelloFresh; Verpackungsbeschreibungen: eigene Ergänzung.</p></footer>
    </>
  );
}
