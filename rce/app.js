const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");

const pluginLoader = require("./utils/pluginLoader");
const { loadTheme } = require("./utils/theme");

const upload = multer({ dest: "uploads/" });
const AdmZip = require("adm-zip");
const app = express();
const PORT = 3002;

// ===== Middleware =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));


// ===== Load data =====
const USERS_FILE = path.join(__dirname, "data", "user.json");
const PRODUCTS_FILE = path.join(__dirname, "data", "products.json");

let users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));

// ===== Session store =====
let sessions = {};

// ===== Render helper =====
function render(res, view, data = {}) {
  let layout = fs.readFileSync("views/layout.html", "utf8");
  let content = fs.readFileSync(`views/${view}.html`, "utf8");

  const theme = res.locals.theme || {};

  // replace theme trong layout
  for (const key in theme) {
    layout = layout.replaceAll(`{{theme.${key}}}`, theme[key]);
  }

  // error block
  if (content.includes("{{error_block}}")) {
    content = data.error
      ? content.replace("{{error_block}}", `<p class="error">${data.error}</p>`)
      : content.replace("{{error_block}}", "");
  }

  // replace data trong content
  for (const key in data) {
    content = content.replaceAll(`{{${key}}}`, data[key]);
  }

  res.send(layout.replace("{{content}}", content));
}


// ===== Auth middleware =====
function auth(req, res, next) {
  const sid = req.cookies.session;
  if (sid && sessions[sid]) {
    req.user = sessions[sid];
  }
  next();
}
app.use(auth);

app.use((req, res, next) => {
  if (req.user && req.user.theme) {
    res.locals.theme = req.user.theme;
  } else {
    try {
      res.locals.theme = loadTheme("default.json");
    } catch {
      res.locals.theme = {};
    }
  }
  next();
});

// ===== Escape helper (NO XSS) =====
function escapeHTML(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== HOME =====
app.get("/", (req, res) => {
  const visibleProducts = products.filter(p => !p.hidden);

  const productsHTML = visibleProducts.map(p => `
    <div class="product-card">
      <img src="${p.image}">
      <h4>${p.name}</h4>
      <p>${p.price}</p>
      <a href="/product/${p.id}" class="view-btn">View details</a>
    </div>
  `).join("");

  render(res, "home", {
    username: req.user ? req.user.username : "Guest",
    products: productsHTML
  });
});

// ===== PRODUCT DETAILS (IDOR FIXED LATER IF NEEDED) =====
app.get("/product/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const product = products.find(p => p.id === id);

  if (!product) {
    return res.status(404).send("Product not found");
  }

  render(res, "details", {
    name: product.name,
    price: product.price,
    image: product.image,
    description: product.description
  });
});

// ===== AUTH =====
app.get("/login", (req, res) => render(res, "login"));
app.get("/register", (req, res) => render(res, "register"));

app.post("/register", (req, res) => {
  const { username, password, address, phone } = req.body;

  if (!username || !password) {
    return render(res, "register", { error: "Username and password required" });
  }

  if (users.find(u => u.username === username)) {
    return render(res, "register", { error: "Username already exists" });
  }

  users.push({ username, password, address, phone, role: "user" });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  res.redirect("/login");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return render(res, "login", { error: "Invalid credentials" });
  }

  const sid = uuidv4();
  sessions[sid] = user;

  res.cookie("session", sid, { httpOnly: false });
  res.redirect("/profile");
});

// ===== LOGOUT =====
app.get("/logout", (req, res) => {
  const sid = req.cookies.session;
  if (sid) delete sessions[sid];
  res.clearCookie("session");
  res.redirect("/");
});

// ===== PROFILE (SAFE) =====
app.get("/profile", (req, res) => {
  if (!req.user) return res.redirect("/login");

  render(res, "profile", {
    username: escapeHTML(req.user.username),
    address: escapeHTML(req.user.address),
    phone: escapeHTML(req.user.phone)
  });
});


app.get("/theme", (req, res) => {
  const themeDir = path.join(__dirname, "themes");
  let themes = [];

  try {
    themes = fs.readdirSync(themeDir)
      .filter(f => f.endsWith(".json"))
      .map(f => f.replace(".json", ""));
  } catch {}

  const options = themes.map(t =>
    `<option value="${t}">${t}</option>`
  ).join("");

  render(res, "ThemeSelect", {
    theme_options: options
  });
});



app.get("/theme/apply", (req, res) => {
  if (!req.user) return res.redirect("/login");

  const themeName = req.query.theme || "default";

  try {
    const theme = loadTheme(themeName);
    req.user.theme = theme;
    res.redirect("/");
  } catch (e) {
    console.error(e);
    res.status(500).send("Failed to apply theme");
  }
});


app.post("/theme/upload", upload.single("themeZip"), (req, res) => {
  if (!req.user) return res.redirect("/login");
  if (!req.file) return res.status(400).send("No file uploaded");

  try {
    const zip = new AdmZip(req.file.path);
    const extractPath = path.join(__dirname);

    zip.extractAllTo(extractPath, true);

    fs.unlinkSync(req.file.path); // cleanup zip
    res.redirect("/theme");
  } catch (e) {
    console.error(e);
    res.status(500).send("Invalid theme zip");
  }
});

app.get("/debug", (req, res) => {
  const file = req.query.file;

  try {
    const content = fs.readFileSync(file, "utf8");
    res.type("text/plain").send(content);
  } catch {
    res.status(500).send("Error reading file");
  }
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`🚀 Web running at http://localhost:${PORT}`);
});
