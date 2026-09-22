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
  APP_NAME: "KEMET", // اسم التطبيق اللي يظهر في الصفحة
  APP_SCHEME: "pyramidpower", // لازم يطابق "scheme" في app.json بالظبط
 PLAY_STORE_URL: "https://play.google.com/store/apps/details?id=com.kemet.shop",// لينك التطبيق على Google Play (سيبيه فاضي لو لسه)
  APP_STORE_URL: "", // لينك التطبيق على App Store (سيبيه فاضي لو لسه)
  DEFAULT_LOGO:
    "https://bcktrkpbjacbrquimzrg.supabase.co/storage/v1/object/public/category-images/pyramidpower.png",
  // 🆕 [illustration] نفس الصورة التوضيحية اللي فوق اللوجو في شاشة اللوجين
  // (app/login.tsx -> assets/images/bg.png)، لكن هنا بنجيبها من رابط
  // Supabase العام (public) بدل ما تكون asset محلي جوه التطبيق، عشان
  // صفحة الـ fallback دي بترندر من السيرفر ومالهاش وصول لملفات التطبيق.
  // ⚠️ الرابط ده بيفترض إن الملف اتربّط (upload) في نفس الـ bucket
  // "category-images" باسم "bg.png" بالظبط، وإن الـ bucket ده public.
  // لو الرابط ما اشتغلش (الصورة مش ظاهرة)، يبقى على الأغلب الملف
  // لسه متحطش في الباكت ده، أو اسمه مختلف، أو الباكت private.
  DEFAULT_ILLUSTRATION:
    "https://bcktrkpbjacbrquimzrg.supabase.co/storage/v1/object/public/category-images/bg.png",
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

async function fetchOffer(id) {
  if (!SUPABASE_ANON_KEY) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/offers` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=offer_type,discount_type,discount_value,buy_quantity,get_quantity,bundle_price,bundle_quantity,shops(name,logo_url)` +
      `&limit=1`;
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

async function fetchListing(id) {
  if (!SUPABASE_ANON_KEY) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/listings` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=title,price,description,listing_images(image_url,sort_order),shops(name)` +
      `&limit=1`;
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
    border-radius: 24px; text-align: center; overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,.06);
  }
  /* 🆕 [illustration] بانر عريض فوق الكارت - نفس الصورة اللي في شاشة
     اللوجين. object-fit: contain (مش cover) عشان الصورة كبيرة ونسبة
     أبعادها مش زي اللوجو الصغير المربع، فمش عايزين نقصّها. لو حابة
     تملي المساحة بالكامل حتى لو فيه قص بسيط، غيّري contain لـ cover. */
  .illustration {
    width: 100%; height: 150px; background: #F0EBE2;
    display: flex; align-items: center; justify-content: center;
  }
  .illustration img {
    width: 100%; height: 100%; object-fit: contain; display: block;
  }
  .card-body {
    /* margin-top سالب عشان اللوجو يركب على حافة البانر تحت (زي صورة
       غلاف بروفايل)، وممكن تشيليه لو عايزة اللوجو يبقى منفصل تمامًا */
    margin-top: -30px; padding: 0 22px 28px;
  }
  .logo {
    width: 84px; height: 84px; margin: 0 auto 14px; border-radius: 22px;
    overflow: hidden; background: #F0EBE2; border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,.10); position: relative; z-index: 1;
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
    <div class="illustration"><img src="${esc(CONFIG.DEFAULT_ILLUSTRATION)}" alt=""></div>
    <div class="card-body">
      <div class="logo"><img src="${esc(logo)}" alt=""></div>
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ""}
      ${description ? `<p class="desc">${esc(description)}</p>` : ""}
      <a class="btn primary" href="${esc(deepLink)}">افتح في التطبيق</a>
      ${storeButtons}
      <p class="hint">${esc(hint)}</p>
    </div>
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
  } else if (type === "listing" && /^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    const item = await fetchListing(id);
    const title = (item && item.title && item.title.trim()) || "منتج على التطبيق";
    const images = item && Array.isArray(item.listing_images)
      ? [...item.listing_images].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        )
      : [];
    const priceLabel =
      item && item.price != null
        ? `${Number(item.price).toLocaleString("ar-EG")} ج.م`
        : "";
    const shopName = item && item.shops && item.shops.name;
    page = renderPage({
      title,
      subtitle: priceLabel || undefined,
      description:
        (item && item.description) ||
        (shopName ? `من متجر ${shopName} على ${CONFIG.APP_NAME}` : `شوف ${title} على ${CONFIG.APP_NAME}`),
      image: images[0]?.image_url || CONFIG.DEFAULT_LOGO,
      logo: images[0]?.image_url || CONFIG.DEFAULT_LOGO,
      pageUrl: `${origin}/listing/${id}`,
      deepLink: `${CONFIG.APP_SCHEME}://listing/${id}`,
    });
  } else if (
    (type === "gift" || type === "discount" || type === "bundle") &&
    /^[A-Za-z0-9_-]{1,64}$/.test(id)
  ) {
    const offer = await fetchOffer(id);
    const shopName = (offer && offer.shops && offer.shops.name) || CONFIG.APP_NAME;
    const image = (offer && offer.shops && offer.shops.logo_url) || CONFIG.DEFAULT_LOGO;

    let title, description, deepLinkPath, pagePath;
    if (type === "gift") {
      const buyQ = (offer && offer.buy_quantity) || 1;
      const getQ = (offer && offer.get_quantity) || 1;
      title = `هدايا من ${shopName}`;
      description = `اشترِ ${buyQ} واحصل على ${getQ} ${getQ === 1 ? "هدية مجانًا" : "هدايا مجانًا"} من ${shopName}`;
      deepLinkPath = "offer";
      pagePath = "offer";
    } else if (type === "discount") {
      const buyQ = (offer && offer.buy_quantity) || 1;
      const getQ = (offer && offer.get_quantity) || 1;
      const discountLabel =
        offer && offer.discount_type === "percentage"
          ? `${offer.discount_value ?? 0}%`
          : `${(offer && offer.discount_value) || 0} ج.م`;
      title = `خصم من ${shopName}`;
      description = `اشترِ ${buyQ} واحصل على خصم ${discountLabel} على ${getQ} ${getQ === 1 ? "قطعة" : "قطع"} من ${shopName}`;
      deepLinkPath = "offer-discount";
      pagePath = "offer-discount";
    } else {
      const bq = (offer && offer.bundle_quantity) || 1;
      const bp = offer && offer.bundle_price != null ? Number(offer.bundle_price).toLocaleString("ar-EG") : "0";
      title = `عرض مجمّع من ${shopName}`;
      description = `جمع ${bq} قطع وادفع ${bp} ج.م بس من ${shopName}`;
      deepLinkPath = "offer-bundle";
      pagePath = "offer-bundle";
    }

    page = renderPage({
      title,
      subtitle: shopName,
      description,
      image,
      logo: image,
      pageUrl: `${origin}/${pagePath}/${id}`,
      deepLink: `${CONFIG.APP_SCHEME}://${deepLinkPath}/${id}`,
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