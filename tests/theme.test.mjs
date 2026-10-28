import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

function declarations(block) {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1], match[2]]));
}

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const lightBlock = styles.match(/^:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const darkBlock = styles.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}\s*\}/)?.[1] ?? "";
const themes = { light: declarations(lightBlock), dark: declarations(darkBlock) };

test("follows the system color scheme with native CSS", () => {
  assert.match(styles, /color-scheme:\s*light dark/);
  assert.match(styles, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(appSource, /matchMedia|data-theme|classList\.(?:add|toggle).*dark/i);
});

test("meets WCAG AA contrast for theme text, controls, links, and focus", () => {
  for (const [name, theme] of Object.entries(themes)) {
    for (const [foreground, background] of [
      ["--color-text", "--color-background"],
      ["--color-heading", "--color-background"],
      ["--color-muted", "--color-background"],
      ["--color-control-text", "--color-control-background"],
      ["--color-interactive", "--color-background"],
      ["--color-on-primary", "--color-primary"],
      ["--color-on-primary", "--color-primary-hover"],
      ["--color-disabled-text", "--color-disabled-background"],
    ]) {
      assert.ok(contrast(theme[foreground], theme[background]) >= 4.5, `${name}: ${foreground} on ${background}`);
    }

    assert.ok(contrast(theme["--color-control-border"], theme["--color-control-background"]) >= 3, `${name}: control border`);
    assert.ok(contrast(theme["--color-focus"], theme["--color-background"]) >= 3, `${name}: focus indicator`);
  }
});

test("uses semantic theme colors for native selects and major surfaces", () => {
  assert.match(appSource, /<select\s+id="week-select"/);
  assert.match(appSource, /<select\s+id="portion-select"/);
  assert.match(styles, /body\s*\{[\s\S]*background:\s*var\(--color-background\);[\s\S]*color:\s*var\(--color-text\)/);
  assert.match(styles, /\.filter-field select\s*\{[\s\S]*background:\s*var\(--color-control-background\);[\s\S]*color:\s*var\(--color-control-text\)/);
  assert.match(styles, /\.portion-field select\s*\{[\s\S]*background:\s*var\(--color-control-background\);[\s\S]*color:\s*var\(--color-control-text\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
});
