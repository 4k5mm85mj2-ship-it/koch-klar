# Sicherheitsregeln für Entwicklung und Veröffentlichung

Verbindlicher kostenloser Basisstandard vom 14. November 2026. Bestehende fachliche, Accessibility-, UI-Abnahme- und Kostenregeln gelten weiter. Diese Regeln sind Arbeitsanweisungen; sie ersetzen weder technische Branchsperren noch eine vollständige Sicherheitsprüfung.

## Änderungen prüfen

- Vor einer Integration Änderungen an Workflows, Build-/Uploadskripten, Paket-Lockdateien und Signierung mit dem letzten geprüften Stand vergleichen. Auch neue Dateien, neue Branches und Herkunftsrepositories berücksichtigen.
- Fremde GitHub Actions auf überprüfte vollständige Commit-SHAs festlegen. Updates bewusst prüfen; feste Referenzen verhindern keine bereits im gewählten Stand enthaltene Schwachstelle. Transitive Downloads separat berücksichtigen.
- Neue oder geänderte Abhängigkeiten, Installationsskripte sowie Netzwerkziele prüfen. Keine ungeprüften Download-und-Ausführen-Ketten, verschleierten Skripte oder zusätzlichen Telemetrieziele übernehmen.
- Unvertrauenswürdigen Pull-Request-Code niemals mit Signier-/Uploadgeheimnissen ausführen. Kein `pull_request_target` mit fremdem Checkout oder ausführbaren fremden Artefakten.
- Schreibrechte und gespeicherte Checkout-Zugangsdaten nur in dem Job erlauben, der sie tatsächlich benötigt. Lese-/Testjobs erhalten keine Schreibrechte.

## Zugangsdaten schützen

- Geheimnisse ausschließlich in der vorhandenen geschützten Verwaltung halten. Keine Schlüssel, vollständigen Umgebungsvariablen, Zugangstokens, P12-/P8-Dateien oder Provisioning-Profile in Quellcode, Logs, Kommentare oder Prüfberichte kopieren.
- Bei Zugangsprüfungen nur Name/Zweck, Eigentümer, betroffene Repositories, Rechte, Ablaufdatum und letzte sichtbare Nutzung dokumentieren. Werte nicht einblenden.
- Einen Zugang vor Entfernung oder Rechteverkleinerung seinen aktuellen Verwendern zuordnen. Nicht belegte Nutzung ist kein Nachweis für Nichtnutzung. Keine pauschale Rotation mit Ausfallrisiko.
- Bei belastbarem Missbrauchsverdacht sofort den Nutzer informieren und den konkreten betroffenen Zugang sowie die kleinste notwendige Eindämmung benennen. Keine unaufgeforderten Nachrichten an Dritte senden.

## Bestehende Abläufe und Kosten erhalten

- Laufende Entwicklungsbranches nicht zurücksetzen, umschreiben oder ohne Auftrag zusammenführen. App-Oberflächen, Nutzerdaten, Fachfunktionen und bestehende Testabdeckung erhalten.
- Keine zusätzliche kostenpflichtige Sicherheitsfunktion, Tarifbuchung oder CI-Migration für diesen Basisstandard. Keine neue zeitgesteuerte Prüfung oder zusätzliche Build-Wiederholung allein zur Erstellung eines Berichts.
- Im nächsten ohnehin beauftragten Release Quellcommit, Workflowstand, bestehende Testresultate und Build-ID festhalten. Soweit vorhanden Artefakthash, Signieridentität und bestätigten Zielbuild ergänzen. Vor Signierung nur den dafür freigegebenen Quellstand verwenden.
- GitHub-/Apple-Kontoereignisse und Berechtigungen bei sicherheitsrelevanten Änderungen sowie vor Freigabe neuer Zugänge manuell kontrollieren. Nicht zugängliche Metadaten ausdrücklich als offen kennzeichnen.

## Stand dieses Standards

Die bisherige Prüfung lieferte keine belastbaren Kampagnennachweise in den untersuchten Quellen. Das ist keine vollständige Entwarnung. Kontoereignisse, alle Tokenrechte und Apple-Verwaltungszugänge sind nur mit entsprechendem Kontozugriff prüfbar. Ein installiertes Regelwerk beweist keine rückwirkende Integrität eines bestehenden TestFlight-Builds.

## KochKlar-CI

Installation, Import, Build und Tests laufen ausschließlich mit `contents: read` und ohne gespeicherte Checkout-Zugangsdaten. Ein separater Job übernimmt ausschließlich geprüfte JSON-Daten desselben Laufs; nur dieser Job besitzt `contents: write`. Er führt keine npm-Pakete oder Skripte aus dem Datenartefakt aus. Pfadfreigabe, JSON-Prüfung und Quellcommitbindung begrenzen die Übergabe.

Neue Rezeptdetails werden ebenso wie geänderte Wochen erfasst; bestehende Rezeptdetails werden nicht gelöscht. Ein fehlgeschlagener Daten-Commit blockiert die Veröffentlichung. Ein zwischenzeitlich geänderter Hauptbranch wird nicht überschrieben.

Nur der Veröffentlichungsjob erhält Pages-/OIDC-Rechte. Die bestehende tägliche Aktualisierung und Fehlermeldung bleiben bestehen. Die JSON-Übergabe wird komprimiert, auf höchstens 32 MiB begrenzt und nur einen Tag aufbewahrt. Es werden Standard-Ubuntu-Runner im öffentlichen Repository verwendet; keine zusätzlichen privaten/macOS-Läufe.

Die eingehenden JSON-Inhalte bleiben externe Daten. Der Pfadschutz ersetzt keine inhaltliche Prüfung; die bestehenden Regressionstests bleiben verbindlich.
