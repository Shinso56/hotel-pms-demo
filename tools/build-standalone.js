#!/usr/bin/env node
/* ==========================================================================
   build-standalone.js — inline the CSS and JS into a single HTML file.
   --------------------------------------------------------------------------
   Run:  node tools/build-standalone.js
   Out:  dist/kilimanjaro-view-pms.html   full document, open it anywhere
         dist/artifact.html               page content only, for hosts that
                                          supply their own document wrapper

   The point of a script rather than a hand-copied duplicate: the bundle is
   regenerated from source every time, so it cannot drift from the real app.
   ========================================================================== */

"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var DIST = path.join(ROOT, "dist");

var SCRIPTS = ["js/store.js", "js/ui.js", "js/views.js", "js/app.js"];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/* A literal </script> or </style> inside inlined source would close the tag
   early and corrupt the bundle. Nothing in this project does that, but a
   silent breakage later is worse than a loud failure now. */
function assertSafe(rel, source) {
  var bad = /<\/(script|style)/i.exec(source);
  if (bad) {
    throw new Error(
      "Cannot inline " + rel + ": it contains a literal '" + bad[0] +
      "', which would close the tag early. Split it (e.g. '<\\/script>')."
    );
  }
}

function build() {
  var html = read("index.html");
  var css = read("css/styles.css");

  assertSafe("css/styles.css", css);

  var js = SCRIPTS.map(function (rel) {
    var src = read(rel);
    assertSafe(rel, src);
    return "/* ---------- " + rel + " ---------- */\n" + src;
  }).join("\n\n");

  var styleTag = "<style>\n" + css + "\n</style>";
  var scriptTag = "<script>\n" + js + "\n</script>";

  /* ---- 1. full standalone document ---------------------------------- */
  var standalone = html
    .replace('<link rel="stylesheet" href="css/styles.css">', styleTag)
    .replace(
      /<script src="js\/store\.js"><\/script>[\s\S]*?<script src="js\/app\.js"><\/script>/,
      scriptTag
    );

  /* Check for surviving external references, not for the file names — the
     inlined banner comments legitimately contain those. */
  if (standalone.indexOf("<style>") === -1 ||
      /<script\s+src=/.test(standalone) ||
      /<link\s+rel="stylesheet"/.test(standalone)) {
    throw new Error("Inlining failed — index.html markup no longer matches the expected pattern.");
  }

  /* ---- 2. content-only build for a host-supplied wrapper ------------- */
  var titleMatch = html.match(/<title>([^<]*)<\/title>/);
  var title = titleMatch ? titleMatch[1] : "PMS demo";

  /* The theme script from <head>, which must still run before the app. */
  var headScript = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || "";

  var body = html.split("<body>")[1].split("</body>")[0];
  body = body.replace(/<script src="[^"]*"><\/script>\s*/g, "").trim();

  var artifact = [
    "<title>" + title + "</title>",
    "<script>" + headScript + "</script>",
    styleTag,
    body,
    scriptTag
  ].join("\n\n");

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

  var outA = path.join(DIST, "kilimanjaro-view-pms.html");
  var outB = path.join(DIST, "artifact.html");
  fs.writeFileSync(outA, standalone, "utf8");
  fs.writeFileSync(outB, artifact, "utf8");

  function kb(p) { return Math.round(fs.statSync(p).size / 1024) + " KB"; }

  console.log("Bundled " + SCRIPTS.length + " scripts + 1 stylesheet");
  console.log("  dist/kilimanjaro-view-pms.html  " + kb(outA) + "  (full document)");
  console.log("  dist/artifact.html              " + kb(outB) + "  (content only)");
}

try {
  build();
} catch (err) {
  console.error("Build failed: " + err.message);
  process.exit(1);
}
