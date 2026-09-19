import { useEffect, useRef, useState } from "react";

const weeks = [
  "7.–13. September 2026",
  "14.–20. September 2026",
  "21.–27. September 2026",
];

const recipes = [
  {
    id: "pasta-tomate-basilikum",
    title: "Pasta mit Tomaten-Basilikum-Sauce",
    diet: "Vegetarisch",
    time: "25 Minuten",
    difficulty: "einfach",
    image: "/assets/pasta-tomate-basilikum.webp",
    alt: "Spaghetti mit Tomatensauce, Kirschtomaten, Basilikum und geriebenem Käse in einer weißen Schale.",
    intro: "Eine unkomplizierte Pasta mit fruchtiger Tomatensauce, frischem Basilikum und würzigem Hartkäse.",
    servings: "2 Portionen",
    ingredients: [
      { name: "Spaghetti", amount: "250 g", packaging: "Durchsichtiger, länglicher Kunststoffbeutel mit hellen, festen Nudeln." },
      { name: "Tomatensauce", amount: "250 ml", packaging: "Kleiner roter Getränkekarton mit weißem Schraubverschluss; beim Schütteln flüssiger Inhalt." },
      { name: "Kirschtomaten", amount: "150 g", packaging: "Kleine, durchsichtige Kunststoffschale mit Folienverschluss; runde feste Tomaten sind tastbar." },
      { name: "Basilikum", amount: "10 g", packaging: "Sehr leichter, flacher Klarsichtbeutel mit weichen Blättern und kräftigem Kräuterduft." },
      { name: "Geriebener Hartkäse", amount: "40 g", packaging: "Kleiner, flacher Klarsichtbeutel; der fein geriebene Inhalt fühlt sich locker und körnig an." },
    ],
    steps: [
      "Bringe in einem großen Topf reichlich gesalzenes Wasser zum Kochen.",
      "Gib die Spaghetti in das kochende Wasser und koche sie etwa 9 Minuten bissfest. Rühre nach der ersten Minute einmal um.",
      "Halbiere währenddessen die Kirschtomaten. Zupfe die Basilikumblätter ab und schneide sie grob.",
      "Erwärme die Tomatensauce in einer großen Pfanne. Gib die Tomaten hinzu und lasse alles 4 Minuten leise köcheln.",
      "Gieße die Nudeln ab, mische sie mit der Sauce und verteile alles auf zwei Teller. Gib Basilikum und Käse darüber.",
    ],
  },
  {
    id: "haehnchen-gemuese-reis",
    title: "Hähnchenbrust mit Gemüse und Reis",
    diet: "Mit Fleisch",
    time: "30 Minuten",
    difficulty: "einfach",
    image: "/assets/haehnchen-gemuese-reis.webp",
    alt: "Gebratene Hähnchenbrust mit Reis, Brokkoli, roter Paprika und Zucchini in einer weißen Schale.",
    intro: "Saftige Hähnchenbrust mit buntem Pfannengemüse und lockerem Reis.",
    servings: "2 Portionen",
    ingredients: [
      { name: "Hähnchenbrustfilets", amount: "300 g", packaging: "Flacher, rechteckiger Vakuumbeutel mit zwei weichen Fleischstücken und einem weißen Etikett." },
      { name: "Reis", amount: "150 g", packaging: "Kleiner, durchsichtiger Kunststoffbeutel; die trockenen Körner rieseln deutlich hörbar." },
      { name: "Brokkoli", amount: "1 kleiner Kopf", packaging: "Lose oder in dünner Folie; fester Stiel mit deutlich tastbaren, dicht verzweigten Röschen." },
      { name: "Rote Paprika", amount: "1 Stück", packaging: "Lose; glatte, feste, hohle Frucht mit Stielansatz." },
      { name: "Gewürzmischung", amount: "5 g", packaging: "Sehr kleines, flaches Sachet mit geriffelter Schweißnaht; feines Pulver im Inneren." },
    ],
    steps: [
      "Spüle den Reis in einem Sieb ab und koche ihn mit 300 Millilitern leicht gesalzenem Wasser auf.",
      "Lasse den Reis zugedeckt bei kleiner Hitze etwa 15 Minuten garen.",
      "Teile den Brokkoli in kleine Röschen und schneide die Paprika in mundgerechte Stücke.",
      "Würze die Hähnchenbrust und brate sie in einer großen Pfanne je Seite 5 bis 6 Minuten. Nimm sie anschließend kurz heraus.",
      "Brate das Gemüse 6 Minuten in derselben Pfanne. Schneide das Hähnchen in Scheiben und serviere es mit Gemüse und Reis.",
    ],
  },
  {
    id: "linsen-eintopf",
    title: "Linsen-Eintopf mit Wurzelgemüse",
    diet: "Vegetarisch",
    time: "40 Minuten",
    difficulty: "mittel",
    image: "/assets/linsen-eintopf.webp",
    alt: "Brauner Linseneintopf mit Karotten, Kartoffeln, Sellerie und Petersilie in einer hellen Schale.",
    intro: "Ein herzhafter, wärmender Eintopf mit Linsen, Kartoffeln und aromatischem Wurzelgemüse.",
    servings: "2 Portionen",
    ingredients: [
      { name: "Vorgegarte Linsen", amount: "250 g", packaging: "Weicher, standfester Kunststoffbeutel; der körnige, feuchte Inhalt lässt sich durch die Folie ertasten." },
      { name: "Kartoffeln", amount: "300 g", packaging: "Kleines Netz mit drei bis fünf festen, unregelmäßig runden Knollen." },
      { name: "Karotten", amount: "2 Stück", packaging: "Lose oder im durchsichtigen Beutel; länglich, fest und zum dünnen Ende spitz zulaufend." },
      { name: "Knollensellerie", amount: "150 g", packaging: "Festes, helles Gemüsestück in eng anliegender Klarsichtfolie; unregelmäßige Oberfläche." },
      { name: "Gemüsebrühe", amount: "10 g", packaging: "Kleines, flaches Papiersachet; feinkörniges Pulver und deutlich versiegelte Ränder." },
    ],
    steps: [
      "Schäle Kartoffeln, Karotten und Sellerie und schneide alles in etwa zwei Zentimeter große Stücke.",
      "Erhitze etwas Öl in einem großen Topf und brate das Gemüse 5 Minuten an. Rühre dabei mehrmals um.",
      "Gib 700 Milliliter Wasser und die Gemüsebrühe hinzu und bringe alles zum Kochen.",
      "Lasse den Eintopf zugedeckt bei mittlerer Hitze 20 Minuten köcheln, bis das Gemüse weich ist.",
      "Gib die Linsen hinzu, erwärme alles weitere 5 Minuten und schmecke den Eintopf mit Salz und Pfeffer ab.",
    ],
  },
  {
    id: "lachs-kartoffeln-bohnen",
    title: "Lachs aus dem Ofen mit Kartoffeln und Bohnen",
    diet: "Mit Fisch",
    time: "35 Minuten",
    difficulty: "einfach",
    image: "/assets/lachs-kartoffeln-bohnen.webp",
    alt: "Ofenlachs mit gerösteten Kartoffeln, grünen Bohnen und einer Zitronenspalte auf einem weißen Teller.",
    intro: "Zarter Ofenlachs mit goldenen Kartoffeln, grünen Bohnen und frischer Zitrone.",
    servings: "2 Portionen",
    ingredients: [
      { name: "Lachsfilets", amount: "250 g", packaging: "Flache, rechteckige Kunststoffschale mit dunklem Boden und durchsichtiger Folie; zwei weiche Filetstücke sind tastbar." },
      { name: "Kleine Kartoffeln", amount: "400 g", packaging: "Kleines Netz mit vielen festen, etwa walnussgroßen Knollen." },
      { name: "Grüne Bohnen", amount: "200 g", packaging: "Länglicher Klarsichtbeutel mit vielen dünnen, festen Bohnen; die Enden sind durch die Folie tastbar." },
      { name: "Zitrone", amount: "1 Stück", packaging: "Lose oder im dünnen Netz; ovale, feste Frucht mit fein genoppter Schale." },
      { name: "Kräutermischung", amount: "5 g", packaging: "Kleines, flaches Sachet; getrocknete Kräuter rascheln beim Bewegen." },
    ],
    steps: [
      "Heize den Backofen auf 220 Grad Ober- und Unterhitze vor.",
      "Halbiere die Kartoffeln, mische sie mit etwas Öl und Salz und backe sie auf einem Blech 15 Minuten vor.",
      "Schneide die Enden der Bohnen ab. Gib die Bohnen zu den Kartoffeln und backe alles weitere 8 Minuten.",
      "Lege die Lachsfilets auf das Blech, würze sie mit der Kräutermischung und backe alles weitere 10 bis 12 Minuten.",
      "Halbiere die Zitrone. Richte Lachs, Kartoffeln und Bohnen auf Tellern an und träufle etwas Zitronensaft darüber.",
    ],
  },
];

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
  const [view, setView] = useState("menu");
  const [weekIndex, setWeekIndex] = useState(1);
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
    const nextLocation = `${view}:${selectedRecipe?.id ?? ""}`;
    if (previousLocationRef.current === nextLocation) {
      return;
    }
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

  const openRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setView("recipe");
    setAnnouncement(`${recipe.title} geöffnet.`);
  };

  const changeWeek = (direction) => {
    const nextIndex = weekIndex + direction;
    if (nextIndex < 0 || nextIndex >= weeks.length) return;
    setWeekIndex(nextIndex);
    setAnnouncement(`Wochenmenü ${weeks[nextIndex]} geladen.`);
  };

  const changeStep = (direction) => {
    if (!selectedRecipe) return;
    const nextStep = Math.min(Math.max(stepIndex + direction, 0), selectedRecipe.steps.length - 1);
    setStepIndex(nextStep);
    setAnnouncement("");
    requestAnimationFrame(() => stepTextRef.current?.focus());
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

            <div className="week-switcher" aria-label="Woche auswählen">
              <button className="button button--secondary" type="button" disabled={weekIndex === 0} onClick={() => changeWeek(-1)}>Vorherige Woche</button>
              <h2 className="week-title">{weeks[weekIndex]}</h2>
              <button className="button button--secondary" type="button" disabled={weekIndex === weeks.length - 1} onClick={() => changeWeek(1)}>Nächste Woche</button>
            </div>

            <ol className="recipe-list">
              {recipes.map((recipe) => (
                <li className="recipe-row" key={recipe.id}>
                  <img className="recipe-thumbnail" src={recipe.image} alt={recipe.alt} width="320" height="180" />
                  <div className="recipe-summary">
                    <h3>{recipe.title}</h3>
                    <p className="recipe-type">{recipe.diet}</p>
                    <p className="recipe-meta">Gesamtzeit: {recipe.time}<span aria-hidden="true"> | </span><span className="meta-break">Schwierigkeit: {recipe.difficulty}</span></p>
                  </div>
                  <button className="button button--primary recipe-action" type="button" onClick={() => openRecipe(recipe)} aria-label={`Rezept öffnen: ${recipe.title}`}>Rezept öffnen</button>
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
                <dl className="facts">
                  <div><dt>Portionen</dt><dd>{selectedRecipe.servings}</dd></div>
                  <div><dt>Zeit</dt><dd>{selectedRecipe.time}</dd></div>
                  <div><dt>Schwierigkeit</dt><dd>{selectedRecipe.difficulty}</dd></div>
                </dl>
                <a className="text-link" href="#ingredients">Direkt zur Zutatenliste</a>
              </div>
              <img className="recipe-hero-image" src={selectedRecipe.image} alt={selectedRecipe.alt} width="1200" height="800" />
            </div>

            <section id="ingredients" className="content-section" aria-labelledby="ingredients-heading">
              <p className="eyebrow">Mengen und Erkennungsmerkmale</p>
              <h2 id="ingredients-heading">Zutaten und Verpackungen</h2>
              <p className="section-intro">Die Verpackungsbeschreibungen sind beispielhaft und helfen dir, die Zutaten durch Form, Material und Inhalt zu unterscheiden.</p>
              <ul className="ingredient-list">
                {selectedRecipe.ingredients.map((ingredient) => (
                  <li key={ingredient.name}>
                    <div className="ingredient-title"><strong>{ingredient.name}</strong><span>{ingredient.amount}</span></div>
                    <p><span className="label">Verpackung erkennen:</span> {ingredient.packaging}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="content-section" aria-labelledby="preparation-heading">
              <h2 id="preparation-heading">Zubereitung</h2>
              <p>Im Kochmodus wird immer nur ein Schritt angezeigt. Die Anleitung nennt Zeiten und Handlungen vollständig und in einer festen Reihenfolge.</p>
              <button className="button button--primary button--large" type="button" onClick={() => { setStepIndex(0); navigate("cook"); }}>Kochmodus starten</button>
            </section>
          </article>
        )}

        {view === "cook" && selectedRecipe && (
          <article className="cook-view" aria-labelledby="cook-heading">
            <button className="back-link" type="button" onClick={() => navigate("recipe")}>Zurück zu den Rezeptdetails</button>
            <p className="eyebrow">{selectedRecipe.title}</p>
            <h1 id="cook-heading" ref={pageHeadingRef} tabIndex="-1">Schritt {stepIndex + 1} von {selectedRecipe.steps.length}</h1>
            <progress className="step-progress" value={stepIndex + 1} max={selectedRecipe.steps.length} aria-label={`Kochfortschritt: Schritt ${stepIndex + 1} von ${selectedRecipe.steps.length}`}>{stepIndex + 1} von {selectedRecipe.steps.length}</progress>
            <div
              className="step-panel"
              ref={stepTextRef}
              tabIndex="-1"
              role="group"
              aria-label={`Schritt ${stepIndex + 1} von ${selectedRecipe.steps.length}: ${selectedRecipe.steps[stepIndex]}`}
            >
              <p>{selectedRecipe.steps[stepIndex]}</p>
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

      <footer className="site-footer"><p>Funktionaler Prototyp ohne Anmeldung und Bestellung.</p></footer>
    </>
  );
}
