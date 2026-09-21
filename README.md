# KochKlar

**KochKlar – barrierearm kochen mit Rezepten von HelloFresh.**

KochKlar ist ein unabhängiger, nicht kommerzieller Prototyp zur Erprobung einer reduzierten und besonders screenreaderfreundlichen Darstellung von Kochrezepten. KochKlar ist kein offizielles Angebot von HelloFresh, steht in keiner Verbindung zu HelloFresh und wird von HelloFresh weder angeboten noch unterstützt.

## Schwerpunkte

- VoiceOver und Screenreader-Navigation
- reduzierte Oberfläche mit wenigen unnötigen Fokusstopps
- Wochenmenü und Filter mit nativen Auswahlfeldern
- Zutaten und dynamische Portionsanpassung
- geführter Kochmodus mit segmentierten Kochschritten
- Tastaturbedienung und sichtbare Fokusmarkierung

Der Prototyp wurde umfangreich manuell mit VoiceOver getestet. Dies ist keine Aussage über eine vollständige Barrierefreiheit oder WCAG-Konformität.

## Rezeptdaten und Quellen

Die GitHub-Pages-Fassung verwendet lokal gespeicherte Snapshots öffentlich zugänglicher HelloFresh-Rezeptinformationen. Links zu den jeweiligen Originalrezepten bleiben in den Rezeptdetails erhalten. Gerichtsbilder werden von den in den Quelldaten angegebenen HelloFresh-Medienadressen geladen. HelloFresh ist eine Marke der jeweiligen Rechteinhaber.

Die Anwendung enthält keine Anmeldung, Bestellung oder Boxverwaltung.

## Technik

- React 19
- Vite 6
- statischer GitHub-Pages-Build

## Lokal entwickeln

Voraussetzung ist eine aktuelle Node.js-LTS-Version.

```bash
npm ci
npm run dev
```

Der lokale Entwicklungsbetrieb und der bisherige Standard-Build verwenden weiterhin die vorhandene interne Menü-API mit den gebündelten Daten als Rückfalloption.

## Produktions-Build für GitHub Pages

```bash
npm ci
npm run build:pages
npm run test:pages
```

Der statische Build liegt anschließend in `dist/client`. Seine Asset-Pfade sind relativ und funktionieren deshalb auch unter der vorgesehenen GitHub-Project-Page `https://BENUTZERNAME.github.io/koch-klar/`.

## Veröffentlichung

Der Workflow `.github/workflows/deploy-pages.yml` baut und prüft die Anwendung bei Änderungen am Branch `main` und veröffentlicht ausschließlich `dist/client` über GitHub Pages. Im GitHub-Repository muss unter **Settings → Pages → Build and deployment** als Quelle **GitHub Actions** ausgewählt sein.

Der gleiche Workflow prüft die öffentlichen HelloFresh-Menü- und Rezeptseiten einmal täglich. Er hält zwei vergangene Wochen, die aktuelle Woche und mindestens drei zukünftige Wochen im Wochenfilter vor. Weiter in der Zukunft verfügbare Wochen werden ebenfalls übernommen. Neue oder geänderte Snapshots werden erst nach vollständiger Validierung und den bestehenden Regressionstests gespeichert und veröffentlicht. Schlägt Import, Validierung oder Build fehl, bleibt die bisher veröffentlichte Version unverändert. Die öffentliche Datenquelle benötigt keine Zugangsdaten; im Browser und im Pages-Artefakt werden keine Secrets verwendet.

Der bestehende Build für das bisherige Hosting bleibt über `npm run build` verfügbar.
