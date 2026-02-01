const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3000;

// ===== Middleware =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));


// ===== Report Queue =====
const reportQueue = [];

// ===== Load users =====
const USERS_FILE = path.join(__dirname, "data", "user.json");
let users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
const PRODUCTS_FILE = path.join(__dirname, "data", "products.json");
let products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));

// ===== Session store =====
let sessions = {};

// ===== Helper render layout =====
function render(res, view, data = {}) {
  let layout = fs.readFileSync("views/layout.html", "utf8");
  let content = fs.readFileSync(`views/${view}.html`, "utf8");

  // handle error block FIRST
  if (data.error) {
    content = content.replace(
      "{{error_block}}",
      `<p style="color:red; font-weight:bold;">${data.error}</p>`
    );
  } else {
    content = content.replace("{{error_block}}", "");
  }

  // replace remaining variables
  for (let key in data) {
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

// ==== Filter xss payloads in address and phone (ADDED) =====
function xssFilter(input) {
  return input
    .replace(/<script/gi, "")
    .replace(/<\/script>/gi, "")
    .replace(/javascript:/gi, "");

}


// ===== Pages =====
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

// ===== Product details =====
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

app.get("/login", (req, res) => {
  render(res, "login");
});

app.get("/register", (req, res) => {
  render(res, "register");
});

// ===== Register =====
app.post("/register", (req, res) => {
  const { username, password, address, phone } = req.body;

  if (!username || !password) {
    return render(res, "register", {
      error: "Username and password are required"
    });
  }

  const exists = users.find(u => u.username === username);
  if (exists) {
    return render(res, "register", {
      error: "Username already exists"
    });
  }

  users.push({
  username: xssFilter(username),
  password: xssFilter(password),
  address: xssFilter(address),
  phone: xssFilter(phone),
  role: "user"
});
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  res.redirect("/login");
});

// ===== Login =====
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return render(res, "login", {
      error: "Invalid username or password"
    });
  }

  const sid = uuidv4();
  sessions[sid] = user;

  res.cookie("session", sid, {
    httpOnly: false 
  });

  res.redirect("/profile");
});

// ===== Logout =====
app.get("/logout", (req, res) => {
  const sid = req.cookies.session;
  if (sid) {
    delete sessions[sid];
    res.clearCookie("session");
  }
  res.redirect("/");
});

// ===== Profile (Stored XSS here) =====
app.get("/profile", (req, res) => {
  if (!req.user) return res.redirect("/login");

  render(res, "profile", {
    username: req.user.username,
    address: req.user.address, 
    phone: req.user.phone
  });
});

// ===== Admin view user =====
app.get("/admin/user/:username", (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).send("Forbidden");
  }

  const target = users.find(u => u.username === req.params.username);
  if (!target) return res.send("User not found");

  render(res, "profile", {
    username: target.username,
    address: target.address,
    phone: target.phone
  });
});

// ===== Report =====
app.post("/report", (req, res) => {
  const { username } = req.body;

  if (!req.user) {
    return res.status(403).send("Login required");
  }

  reportQueue.push(username);
  console.log("[+] Report received:", username);

  res.send("Your report has been sent to admin.");
});

// ===== Admin bot API =====
app.get("/report-queue", (req, res) => {
  const username = reportQueue.shift() || null;
  res.json({ username });
});
// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Web running at http://localhost:${PORT}`);
});
