const fs = require("fs");
const path = require("path");
const serialize = require("node-serialize");

function loadPlugin(name) {
  const pluginPath = path.join(__dirname, "..", "plugins", name);
  console.log("[*] Loading plugin:", pluginPath);

  const raw = fs.readFileSync(pluginPath, "utf8");
  console.log("[*] Plugin content:\n", raw);

  return serialize.unserialize(raw);
}

module.exports = { loadPlugin };