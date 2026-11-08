// Preserve the license text of resolved production packages shipped to browsers.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const lock = JSON.parse(
  await readFile(path.join(root, "package-lock.json"), "utf8"),
);
const sections = [
  "RouteCast browser dependency notices\nGenerated from package-lock.json production dependencies; includes source notices.\nProvider data and basemap licenses are separate; see docs/ATTRIBUTION.md.\n",
];
for (const [relative, entry] of Object.entries(lock.packages).sort(([a], [b]) =>
  a.localeCompare(b, "en"),
)) {
  if (!relative || entry.dev) continue;
  const directory = path.join(root, relative);
  let names;
  try {
    names = await readdir(directory);
  } catch {
    if (entry.optional) continue;
    throw Error(`Missing installed production package: ${relative}`);
  }
  const pkg = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  let fallback = "";
  const licenses = names
    .filter((n) => /^(licen[sc]e|notice)([.\-_].*)?$/i.test(n))
    .sort();
  if (!licenses.length) {
    const readme = names.find((n) => /^readme\.md$/i.test(n));
    if (readme) {
      const text = await readFile(path.join(directory, readme), "utf8");
      if (
        /##? License/i.test(text) &&
        /Permission is hereby granted/.test(text)
      )
        licenses.push(readme);
    }
    if (
      !licenses.length &&
      pkg.name === "react-remove-scroll-bar" &&
      pkg.version === "2.3.8"
    )
      fallback = await readFile(
        path.join(root, "licenses", "react-remove-scroll-bar-2.3.8.LICENSE"),
        "utf8",
      );
    if (!licenses.length && !fallback)
      throw Error(`Review missing license text: ${relative}`);
  }
  let body = `\n===== ${pkg.name} ${pkg.version} (${typeof pkg.license === "string" ? pkg.license : "see license"}) =====\n`;
  for (const file of licenses)
    body += `\n${file}\n${await readFile(path.join(directory, file), "utf8")}\n`;
  if (fallback)
    body +=
      "\nUpstream LICENSE (retained locally; see docs/ATTRIBUTION.md)\n" +
      fallback;
  sections.push(body);
}
const output = sections.join("\n");
const target = path.join(root, "public", "THIRD_PARTY_NOTICES.txt");
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== output)
    throw Error(
      "Dependency notices changed. Run npm run notices, review, then rebuild.",
    );
} else {
  await writeFile(target, output);
}
console.log(
  `${sections.length - 1} production package notices ${process.argv.includes("--check") ? "verified" : "generated"}.`,
);
