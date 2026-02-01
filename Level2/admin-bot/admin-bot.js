const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

const BASE_URL = process.env.TARGET_URL || "http://xss-web:3000";
const ADMIN_USER = "admin";
const ADMIN_PASS = "ajsHdvyu!2348ScBa9gr9128rckabsjfa@28eA";

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log("[*] Admin bot starting (stable mode)...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

  const loginPage = await browser.newPage();
  await loginPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });

  await loginPage.type("input[name=username]", ADMIN_USER);
  await loginPage.type("input[name=password]", ADMIN_PASS);

  await Promise.all([
    loginPage.click("button[type=submit]"),
    loginPage.waitForNavigation({ waitUntil: "networkidle2" })
  ]);

  console.log("[+] Admin logged in");

  const cookies = await loginPage.cookies();
  await loginPage.close();

  console.log("[+] Waiting for reports...");

  while (true) {
    try {
      const res = await fetch(`${BASE_URL}/report-queue`);
      const { username } = await res.json();

      if (!username) {
        await sleep(2000);
        continue;
      }

      console.log(`[🚩] New report: ${username}`);

      const page = await browser.newPage();
      await page.setCookie(...cookies);

      const url = `${BASE_URL}/admin/user/${username}`;
      console.log(`[*] Visiting ${url}`);

      await page.goto(url, { waitUntil: "networkidle2" });
      await sleep(5000);

      await page.close();
      console.log(`[✓] Done reviewing ${username}`);
    } catch (err) {
      console.error("[!] Bot error:", err.message);
      await sleep(3000);
    }
  }
})();


