const fs = require("fs");
const path = require("path");
const { loadPlugin } = require("./pluginLoader");

function loadTheme(name) {
  const filename = name.endsWith(".json") ? name : `${name}.json`;
  const themePath = path.join(__dirname, "..", "themes", filename);

  const raw = fs.readFileSync(themePath, "utf8");
  if (!raw.trim()) {
    throw new Error("Empty theme file");
  }

  const theme = JSON.parse(raw);


  if (theme.plugin) {
    const plugin = loadPlugin(theme.plugin);

    
  if (plugin && typeof plugin.run === "function") {
     plugin.run(theme);
}
  }

  return theme;
}

module.exports = { loadTheme };

