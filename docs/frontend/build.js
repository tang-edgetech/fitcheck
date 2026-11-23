// Builds self-contained design files: inlines src/core.js into each src/design-N.html.
// Usage: node docs/frontend/build.js
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "src");
const core = fs.readFileSync(path.join(src, "core.js"), "utf8");
const MARK = "<script>/*@CORE*/</script>";
for (const f of fs.readdirSync(src)) {
  if (!f.endsWith(".html")) continue;
  let html = fs.readFileSync(path.join(src, f), "utf8");
  if (html.includes(MARK)) html = html.split(MARK).join("<script>\n" + core + "\n</script>");
  fs.writeFileSync(path.join(__dirname, f), html);
  console.log("built", f, html.length, "bytes");
}
