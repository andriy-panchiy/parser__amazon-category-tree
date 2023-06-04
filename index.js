const puppeteer = require("puppeteer");
const fs = require("fs");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fetchDelay = 1000;

const parseJSON = (json) => {
  try {
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
};

const rootTreeFile = fs.readFileSync("./tree.json", "utf8");
const rootTreeJSON = parseJSON(rootTreeFile);

async function parseAmazonLinks() {
  const defaultViewport = { width: 1920, height: 1080 };
  const browser = await puppeteer.launch({
    headless: false,
    // headless: true,
    defaultViewport,
    devtools: true,
    channel: "chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--no-zygote",
      "--no-first-run",
      "--window-position=0,0",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-skip-list",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--hide-scrollbars",
      "--disable-notifications",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-component-extensions-with-background-pages",
      "--disable-features=TranslateUI,BlinkGenPropertyTrees",
      "--disable-ipc-flooding-protection",
      "--disable-renderer-backgrounding",
      "--enable-features=NetworkService,NetworkServiceInProcess",
      "--force-color-profile=srgb",
      "--metrics-recording-only",
      "--mute-audio",

      `--window-size=${defaultViewport.width},${defaultViewport.height}`,
      `--disable-features=DialMediaRouteProvider`,
      `--disable-features=DialMediaRouteProvider,TranslateUI,BlinkGenPropertyTrees`,
      `--allow-legacy-extension-manifests`,
      `--embedded-extension-options`,
      `--extensions-not-webstore`,
      `--extensions-on-chrome-urls`,
      `--force-dev-mode-highlighting`,
    ],
  });

  const [page] = await browser.pages();
  await page.goto("https://www.amazon.com/Best-Sellers/zgbs");

  await page.waitForSelector(`div[role="treeitem"] + div[role='group'] > div[role='treeitem']`);

  await delay(1000);

  const rootTree =
    rootTreeJSON ||
    (await page.$$eval('div[role="treeitem"] + div[role="group"] > div[role="treeitem"]', (elements) => {
      return elements.reduce((acc, el) => {
        acc[el.textContent.trim()] = {
          url: el.querySelector("a").href,
          tree: {},
        };
        return acc;
      }, {});
    }));

  async function parseLinks(parentCategory) {
    const categoryTitleElem = await page.$('div:has(> div[role="treeitem"] + div[role="group"]) > div[role="treeitem"]');
    const categoryGroupElem = await page.$('div:has(> div[role="treeitem"] + div[role="group"]) > div[role="treeitem"] + div[role="group"] > div[role="treeitem"]');
    const categoryTitle = await page.evaluate((el) => el?.textContent, categoryTitleElem);

    if (!parentCategory || !categoryTitle || categoryTitle !== parentCategory) return {};

    let category;
    let url;

    try {
      category = await categoryGroupElem.$eval("a", (a) => a?.textContent?.trim());
      url = await categoryGroupElem.$eval("a", (a) => a?.href);
    } catch (error) {
      console.log(parentCategory, categoryTitle);
      return {};
    }

    const subTree = await page.$$eval('div[role="treeitem"] + div[role="group"] > div[role="treeitem"]', (elements) => {
      return elements.reduce((acc, el) => {
        acc[el.textContent.trim()] = {
          url: el.querySelector("a")?.href,
          tree: {},
        };
        return acc;
      }, {});
    });

    for (const [category, value] of Object.entries(subTree)) {
      if (!value.url) continue;
      await page.goto(value.url);
      await delay(fetchDelay);

      const tree = await parseLinks(category);
      value.tree = tree;
    }

    return {
      [category]: {
        url,
        tree: subTree,
      },
    };
  }

  for (const [category, value] of Object.entries(rootTree)) {
    switch (category) {
      case "Amazon Devices & Accessories":
      case "Amazon Renewed":
      case "Appliances":
      case "Apps & Games":
      case "Arts, Crafts & Sewing":
      case "Audible Books & Originals":
      case "Automotive":
      case "Baby":
      case "Beauty & Personal Care":
      case "Books":
      case "Camera & Photo Products":
      case "CDs & Vinyl":
      case "Cell Phones & Accessories":
      case "Climate Pledge Friendly":
      case "Clothing, Shoes & Jewelry":
      case "Collectible Coins":
      case "Computers & Accessories":
      case "Digital Educational Resources":
      case "Digital Music":
      case "Electronics":
      case "Entertainment Collectibles":
      case "Gift Cards":
      case "Grocery & Gourmet Food":
      case "Handmade Products":
      case "Health & Household":
      case "Home & Kitchen":
      case "Industrial & Scientific":
      case "Kindle Store":
      case "Kitchen & Dining":
      case "Magazine Subscriptions":
      case "Movies & TV":
      case "Musical Instruments":
      case "Office Products":
      case "Patio, Lawn & Garden":
      case "Pet Supplies":
      case "Software":
      case "Sports & Outdoors":
      case "Sports Collectibles":
      case "Tools & Home Improvement":
      case "Toys & Games":
      case "Unique Finds":
      case "Video Games":
        continue;
    }

    if (!value.url) continue;

    await page.goto(value.url);
    await delay(fetchDelay);

    const tree = await parseLinks(category);
    value.tree = tree;
    fs.writeFileSync("./tree.json", JSON.stringify(rootTree, null, 2));
  }

  return rootTree;
}

parseAmazonLinks();
