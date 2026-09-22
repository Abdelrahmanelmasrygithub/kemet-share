// api/link.js
//
// صفحة الـ fallback للينكات المشاركة. بتتفتح بس لما التطبيق مش منزّل
// (أو اللينك اتفتح من متصفح داخلي زي إنستجرام). لو التطبيق منزّل
// والـ universal links / app links مظبوطة، نظام التشغيل بيفتح التطبيق
// مباشرة ومبيوصلش للصفحة دي أصلاً.
//
// الصفحة بتترندر من السيرفر (مش JS في المتصفح) عشان واتساب وفيسبوك
// وتليجرام يقروا الـ og:title / og:image ويعرضوا كارت معاينة حلو.

// ===================== ⚙️ الإعدادات - عدّليها =====================
const CONFIG = {
  APP_NAME: "KEMET",
  APP_SCHEME: "thehookainshamsh",
 PLAY_STORE_URL: "https://play.google.com/store/apps/details?id=com.kemet.shop",
  APP_STORE_URL: "",
  DEFAULT_LOGO:
    "https://bcktrkpbjacbrquimzrg.supabase.co/storage/v1/object/public/category-images/pyramidpower.png",
};

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://bcktrkpbjacbrquimzrg.supabase.co";
// ضيفيه في Vercel: Settings -> Environment Variables (الـ anon key العادي)
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
// ==================================================================

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

async function fetchShop(id) {
  if (!SUPABASE_ANON_KEY) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/shops` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=name,logo_url,photo_url,category_label,description&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

function renderPage({ title, description, image, pageUrl, deepLink, logo, subtitle }) {
  const storeButtons = [
    CONFIG.PLAY_STORE_URL
      ? `<a class="btn secondary" href="${esc(CONFIG.PLAY_STORE_URL)}">تحميل من Google Play</a>`
      : "",
    CONFIG.APP_STORE_URL
      ? `<a class="btn secondary" href="${esc(CONFIG.APP_STORE_URL)}">تحميل من App Store</a>`
      : "",
  ].join("");

  const hint =
    CONFIG.PLAY_STORE_URL || CONFIG.APP_STORE_URL
      ? "لو التطبيق مش عندك، حمّله من هنا وبعدها افتح اللينك تاني."
      : "التطبيق قريبًا على المتاجر.";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(CONFIG.APP_NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 24px; background: #FEFDFB; color: #1C1C1C;
    font-family: system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
  }
  .card {
    width: 100%; max-width: 380px; background: #fff; border: 1px solid #ECE7DE;
    border-radius: 24px; padding: 28px 22px; text-align: center;
    box-shadow: 0 10px 30px rgba(0,0,0,.06);
  }
  .logo {
    width: 84px; height: 84px; margin: 0 auto 14px; border-radius: 22px;
    overflow: hidden; background: #F0EBE2; border: 1px solid #ECE7DE;
  }
  .logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  h1 { font-size: 20px; margin: 0 0 6px; font-weight: 800; }
  .sub { margin: 0 0 8px; color: #8A8377; font-size: 13px; }
  .desc { margin: 0 0 18px; color: #8A8377; font-size: 13px; line-height: 1.7; }
  .btn {
    display: block; padding: 14px 16px; border-radius: 14px; margin-top: 10px;
    font-size: 15px; font-weight: 700; text-decoration: none;
  }
  .primary { background: #1C1C1C; color: #fff; }
  .secondary { background: #fff; color: #1C1C1C; border: 1px solid #ECE7DE; }
  .hint { margin: 16px 0 0; font-size: 12px; color: #B9B2A6; }
</style>
</head>
<body>
  <main class="card">
    <div class="logo"><img src="${esc(logo)}" alt=""></div>
    <h1>${esc(title)}</h1>
    ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ""}
    ${description ? `<p class="desc">${esc(description)}</p>` : ""}
    <a class="btn primary" href="${esc(deepLink)}">افتح في التطبيق</a>
    ${storeButtons}
    <p class="hint">${esc(hint)}</p>
  </main>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const type = String(req.query.type || "stores");
  const id = String(req.query.id || "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const origin = `https://${host}`;

  let page;

  if (type === "store" && /^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    const shop = await fetchShop(id);
    const name = (shop && shop.name && shop.name.trim()) || "متجر على التطبيق";
    page = renderPage({
      title: name,
      subtitle: shop && shop.category_label,
      description:
        (shop && shop.description) || `تسوّق من ${name} على ${CONFIG.APP_NAME}`,
      image:
        (shop && (shop.photo_url || shop.logo_url)) || CONFIG.DEFAULT_LOGO,
      logo: (shop && (shop.logo_url || shop.photo_url)) || CONFIG.DEFAULT_LOGO,
      pageUrl: `${origin}/store/${id}`,
      deepLink: `${CONFIG.APP_SCHEME}://store/${id}`,
    });
  } else if (type === "offers") {
    page = renderPage({
      title: "أقوى العروض",
      description: `اكتشف أقوى العروض من كل المتاجر على ${CONFIG.APP_NAME}`,
      image: CONFIG.DEFAULT_LOGO,
      logo: CONFIG.DEFAULT_LOGO,
      pageUrl: `${origin}/offers`,
      deepLink: `${CONFIG.APP_SCHEME}://offers`,
    });
  } else {
    page = renderPage({
      title: "دليل المتاجر",
      description: `تصفّح المتاجر القريبة منك على ${CONFIG.APP_NAME}`,
      image: CONFIG.DEFAULT_LOGO,
      logo: CONFIG.DEFAULT_LOGO,
      pageUrl: `${origin}/store`,
      deepLink: `${CONFIG.APP_SCHEME}://store`,
    });
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(page);
};
