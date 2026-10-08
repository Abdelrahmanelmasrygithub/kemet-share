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
  // 🛠️ [إصلاح] كانت "pyramidpower" وده مش مطابق للـ scheme الفعلي في
  // app.json ("thehookainshamsh") - فزرار "افتح في التطبيق" كان بيحاول
  // يفتح scheme التطبيق مش مسجّله. لازم تفضل مطابقة لـ app.json بالظبط.
  APP_SCHEME: "thehookainshamsh", // لازم يطابق "scheme" في app.json بالظبط
 PLAY_STORE_URL: "https://play.google.com/store/apps/details?id=com.kemet.shop", // لينك التطبيق على Google Play (سيبيه فاضي لو لسه)
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

function renderPage({ title, description, image, pageUrl, deepLink, logo, subtitle, shopId }) {
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

  // 🆕 [عرض المنتجات] بيظهر في صفحة المتجر بس (لما shopId موجود).
  // الزرار بيفتح قسم المنتجات اللي بيتحمّل من /api/products وفيه فلاتر،
  // ومعاه تنبيه إن الطلب بيتم من تطبيق KEMET بس + لينكات التحميل.
  const productsButton = shopId
    ? `<button type="button" class="btn outline" id="showProducts" aria-expanded="false" aria-controls="products">اضغط لعرض المنتجات</button>`
    : "";

  const productsPanel = shopId
    ? `<section class="products" id="products" data-shop="${esc(shopId)}" hidden>
        <div class="notice">
          <strong>لطلب أوردر:</strong> لازم تحمّل تطبيق ${esc(CONFIG.APP_NAME)} وتطلب منه. الموقع هنا للتصفح بس. عروض "اشترِ واحصل" و"السعر المجمّع" وعروض المتابعين بتتطبق وبتظهر كاملة داخل التطبيق.
          ${storeButtons || `<div class="notice-soon">التطبيق قريبًا على المتاجر.</div>`}
        </div>
        <div class="offers" id="pOffers" hidden>
          <div class="offers-title">تصفح العروض</div>
          <div class="ostrip" id="pChips"></div>
        </div>
        <div class="obanner" id="pBanner" hidden>
          <button type="button" id="pBannerX" aria-label="مسح فلتر العرض">×</button>
          <span id="pBannerText"></span>
        </div>
        <div class="filters" id="pFilters"></div>
        <div class="pmeta"><span id="pCount"></span><button type="button" class="pclear" id="pClear" hidden>مسح الفلاتر</button></div>
        <div class="pstatus" id="pStatus"></div>
        <div class="pgrid" id="pGrid"></div>
      </section>`
    : "";

  const productsScript = shopId
    ? `<script>
(function () {
  var btn = document.getElementById("showProducts");
  var panel = document.getElementById("products");
  var card = document.querySelector(".card");
  if (!btn || !panel || !card) return;

  var shopId = panel.getAttribute("data-shop");
  var filtersBox = document.getElementById("pFilters");
  var countEl = document.getElementById("pCount");
  var clearBtn = document.getElementById("pClear");
  var statusEl = document.getElementById("pStatus");
  var grid = document.getElementById("pGrid");
  var offersBox = document.getElementById("pOffers");
  var chipsEl = document.getElementById("pChips");
  var bannerEl = document.getElementById("pBanner");
  var bannerText = document.getElementById("pBannerText");
  var bannerX = document.getElementById("pBannerX");

  var items = [];
  var offers = [];
  var categories = [];
  var selectedOfferId = null;
  var offerFilter = null; // Set من ids المنتجات، أو null = من غير فلتر عرض
  var loaded = false;
  var loading = false;
  var filters = { gender: "", category: "", type: "", color: "", size: "" };

  // نفس تسميات وترتيب StoreFiltersModal في التطبيق: حريمي، رجالي، أطفالي
  var GENDER_ORDER = ["women", "men", "kids"];
  var GENDER_LABELS = {
    women: "حريمي",
    men: "رجالي",
    kids: "أطفالي",
    unisex: "للجنسين"
  };

  // نفس COLOR_HEX_MAP في ListingCard.tsx (نقط الألوان فوق الصورة)
  var COLOR_HEX = {
    "أسود": "#1C1C1C", "أبيض": "#FFFFFF", "رمادي": "#9E9E9E", "كحلي": "#1B2A4A",
    "أزرق": "#2F6FED", "أزرق فاتح": "#8FC1E8", "أحمر": "#D0342C", "بورجندي": "#6E1E28",
    "وردي": "#F0A8C0", "بنفسجي": "#7A4EA3", "موف": "#B497C4", "أخضر": "#2E7D4F",
    "أخضر زيتي": "#6B7A3A", "تركواز": "#2FB6A8", "أصفر": "#F2D035", "برتقالي": "#EF8C2B",
    "بني": "#6B4A2F", "بيج": "#E4D2B0", "كريمي": "#F2E8D5", "أوف وايت": "#F5F1E9",
    "ذهبي": "#C6A15B", "فضي": "#C4C4C4", "متعدد الألوان": "#B9B2A6"
  };

  function colorHex(c) {
    if (COLOR_HEX[c]) return COLOR_HEX[c];
    if (String(c).charAt(0) === "#") return c;
    return "#CFCAC0";
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function uniq(arr) {
    var seen = {};
    var out = [];
    arr.forEach(function (v) {
      if (v && !seen[v]) { seen[v] = true; out.push(v); }
    });
    return out;
  }

  function flat(key) {
    var all = [];
    items.forEach(function (it) { all = all.concat(it[key] || []); });
    return uniq(all);
  }

  function labelFor(key, value) {
    if (key === "gender") return GENDER_LABELS[value] || value;
    return value;
  }

  function hasActiveFilters() {
    return !!(filters.gender || filters.category || filters.type || filters.color || filters.size);
  }

  function matches(it) {
    // فلتر العرض المختار من شريط العروض بيتفحص الأول، وبيشتغل مع باقي الفلاتر (AND)
    if (offerFilter && !offerFilter.has(it.id)) return false;
    // نفس منطق التطبيق: الجنس "للجنسين" بيظهر مع أي اختيار جنس
    if (filters.gender && it.gender !== filters.gender && it.gender !== "unisex") return false;
    if (filters.category && it.category !== filters.category) return false;
    if (filters.type && it.type !== filters.type) return false;
    if (filters.color && (it.colors || []).indexOf(filters.color) < 0) return false;
    if (filters.size && (it.sizes || []).indexOf(filters.size) < 0) return false;
    return true;
  }

  function buildFilters() {
    filtersBox.textContent = "";
    var defs = [
      { key: "gender", label: "الجنس", values: uniq(items.map(function (i) { return i.gender; })).filter(function (v) { return v !== "unisex"; }).sort(function (a, b) { return GENDER_ORDER.indexOf(a) - GENDER_ORDER.indexOf(b); }) },
      { key: "category", label: "القسم", values: uniq(items.map(function (i) { return i.category; })) },
      { key: "type", label: "النوع", values: uniq(items.map(function (i) { return i.type; })) },
      { key: "color", label: "اللون", values: flat("colors") },
      { key: "size", label: "المقاس", values: flat("sizes") }
    ];
    defs.forEach(function (d) {
      if (d.values.length < 2) return;
      var wrap = el("label", "");
      wrap.appendChild(el("span", "", d.label));
      var sel = el("select", "");
      sel.setAttribute("data-key", d.key);
      var all = el("option", "", "الكل");
      all.value = "";
      sel.appendChild(all);
      d.values.forEach(function (v) {
        var o = el("option", "", labelFor(d.key, v));
        o.value = v;
        sel.appendChild(o);
      });
      sel.value = filters[d.key];
      sel.addEventListener("change", function () {
        filters[d.key] = sel.value;
        render();
      });
      wrap.appendChild(sel);
      filtersBox.appendChild(wrap);
    });
  }

  function money(n) {
    return Number(n).toLocaleString("ar-EG") + " ج.م";
  }

  // كارت المنتج - نفس ListingCard.tsx: ريبون مائل (أكتر من عرض / خصم) أو بار أسفل
  // الصورة (مجاني / بخصم / مجمّع)، نقط الألوان بتتدفع لفوق لو فيه بار
  function productCard(it, reserveOld) {
    var a = el("a", "pcard");
    a.href = "/listing/" + encodeURIComponent(it.id);

    var w = el("div", "pimgw");
    if (it.image) {
      var img = el("img", "pimg");
      img.src = it.image;
      img.alt = "";
      img.loading = "lazy";
      w.appendChild(img);
    }

    var b = it.badge;
    var barClass = "";
    if (b && b.kind === "bogo") barClass = "bogo";
    else if (b && b.kind === "bogoDiscount") barClass = "bogod";
    else if (b && b.kind === "bundle") barClass = "bundle";

    if (it.colors && it.colors.length) {
      var dots = el("div", barClass ? "dots lifted" : "dots");
      it.colors.slice(0, 4).forEach(function (c) {
        var d = el("span", "dot");
        d.style.background = colorHex(c);
        dots.appendChild(d);
      });
      w.appendChild(dots);
    }

    if (b && b.kind === "multi") w.appendChild(el("div", "ribbon multi", b.text));
    if (b && b.kind === "discount") w.appendChild(el("div", "ribbon disc", b.text));
    if (barClass) w.appendChild(el("div", "bar " + barClass, b.text));
    a.appendChild(w);

    var info = el("div", "pinfo");
    info.appendChild(el("div", "ptitle", it.title));
    if (it.ratingCount > 0) {
      var rate = el("div", "prate");
      rate.appendChild(el("span", "star", "★"));
      rate.appendChild(el("span", "", Number(it.rating).toFixed(1) + " (" + it.ratingCount + ")"));
      info.appendChild(rate);
    }
    // صف الموقع (نفس distanceText في التطبيق: distanceLabel ?? location - على الويب مفيش مسافة فبنعرض location)
    if (it.location) {
      var loc = el("div", "ploc");
      loc.appendChild(pinIcon());
      loc.appendChild(el("span", "", it.location));
      info.appendChild(loc);
    }
    var bottom = el("div", "pbottom");
    bottom.appendChild(el("div", "pprice", money(it.price)));
    if (it.originalPrice && it.originalPrice > it.price) {
      bottom.appendChild(el("div", "pold", money(it.originalPrice)));
    } else if (reserveOld) {
      // لو فيه كروت مخفّضة في القايمة، بنحجز سطر السعر القديم (مخفي) في الباقي عشان
      // الأسعار تتساوى على نفس الخط جنب بعض
      bottom.appendChild(el("div", "pold ghost", "٠"));
    }
    info.appendChild(bottom);
    a.appendChild(info);
    return a;
  }

  // أيقونة location-outline (نفس شكل Ionicons) كـ SVG مدمج عشان متعتمدش على أي CDN
  function pinIcon() {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 512 512");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(NS, "path");
    path.setAttribute("d", "M256 48c-79.5 0-144 61.39-144 137 0 87 96 224.87 131.25 272.49a15.77 15.77 0 0025.5 0C304 409.89 400 272.07 400 185c0-75.61-64.5-137-144-137z");
    var circle = document.createElementNS(NS, "circle");
    circle.setAttribute("cx", "256");
    circle.setAttribute("cy", "192");
    circle.setAttribute("r", "48");
    [path, circle].forEach(function (n) {
      n.setAttribute("fill", "none");
      n.setAttribute("stroke", "currentColor");
      n.setAttribute("stroke-linecap", "round");
      n.setAttribute("stroke-linejoin", "round");
      n.setAttribute("stroke-width", "32");
      svg.appendChild(n);
    });
    return svg;
  }

  function render() {
    var list = items.filter(matches);
    grid.textContent = "";
    var anyOld = list.some(function (it) { return it.originalPrice && it.originalPrice > it.price; });
    list.forEach(function (it) { grid.appendChild(productCard(it, anyOld)); });
    countEl.textContent = list.length.toLocaleString("ar-EG") + " منتج";
    clearBtn.hidden = !hasActiveFilters();
    if (list.length === 0) {
      statusEl.textContent = items.length === 0
        ? "لسه مفيش منتجات في المتجر ده"
        : "مفيش منتجات مطابقة للفلتر المختار";
    } else {
      statusEl.textContent = "";
    }
  }

  clearBtn.addEventListener("click", function () {
    filters = { gender: "", category: "", type: "", color: "", size: "" };
    buildFilters();
    render();
  });

  // ===== شريط تصفح العروض (نفس StoreOffers.tsx في التطبيق) =====
  // "كل العروض" -> المنتجات اللي عليها أي عرض. فئة/عرض شامل المتجر كله ->
  // من غير فلترة. غير كده -> المنتجات المرتبطة بالعرض بس. الدوس على المختار تاني يمسحه.
  var IONICONS_ID = "ionicons-esm";

  function loadIcons() {
    if (document.getElementById(IONICONS_ID)) return;
    var s = document.createElement("script");
    s.id = IONICONS_ID;
    s.type = "module";
    s.src = "https://unpkg.com/ionicons@7.4.0/dist/ionicons/ionicons.esm.js";
    document.head.appendChild(s);
  }

  function ring(color, active) {
    var NS = "http://www.w3.org/2000/svg";
    var size = 52;
    var sw = active ? 1 : 0.8;
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "oring");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    var c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", size / 2);
    c.setAttribute("cy", size / 2);
    c.setAttribute("r", (size - sw) / 2);
    c.setAttribute("stroke", color);
    c.setAttribute("stroke-width", sw);
    c.setAttribute("fill", "none");
    c.setAttribute("stroke-dasharray", "2.2, 6");
    c.setAttribute("stroke-linecap", "round");
    svg.appendChild(c);
    return svg;
  }

  function stripItems() {
    var all = { id: "__all_offers__", title: "كل العروض", icon: "flame", accent: "#E1523D", bg: "#FDEAEA", count: offers.length, special: true };
    return [all].concat(categories, offers);
  }

  function selectOffer(chip) {
    if (selectedOfferId === chip.id) {
      clearOffer();
      return;
    }
    selectedOfferId = chip.id;
    if (chip.special) {
      var ids = {};
      items.forEach(function (it) { if (it.hasOffer) ids[it.id] = true; });
      offerFilter = new Set(Object.keys(ids));
      bannerText.textContent = "بتشوف كل المنتجات المخفّضة (" + offerFilter.size.toLocaleString("ar-EG") + ")";
    } else {
      offerFilter = chip.isAll ? null : new Set(chip.listingIds || []);
      bannerText.textContent = "بتشوف منتجات: " + chip.title;
    }
    bannerEl.hidden = false;
    renderStrip();
    render();
  }

  function clearOffer() {
    selectedOfferId = null;
    offerFilter = null;
    bannerEl.hidden = true;
    renderStrip();
    render();
  }

  bannerX.addEventListener("click", clearOffer);

  function renderStrip() {
    chipsEl.textContent = "";
    if (offers.length === 0) {
      offersBox.hidden = true;
      return;
    }
    stripItems().forEach(function (chip) {
      var on = selectedOfferId === chip.id;
      var b = el("button", "ocard");
      b.type = "button";
      b.setAttribute("data-id", chip.id);
      b.setAttribute("aria-pressed", on ? "true" : "false");

      var circle = el("div", "ocircle");
      if (on) {
        var bg = el("div", "obg");
        bg.style.background = chip.bg;
        circle.appendChild(bg);
      }
      circle.appendChild(ring(on ? chip.accent : "#C9C9C9", on));
      var icon = document.createElement("ion-icon");
      icon.setAttribute("name", chip.icon);
      icon.style.color = on ? chip.accent : "#111111";
      circle.appendChild(icon);

      if (chip.badgeText) {
        var mini = el("span", "omini", chip.badgeText);
        mini.style.background = chip.accent;
        circle.appendChild(mini);
      }
      if (chip.isNew) circle.appendChild(el("span", "onew", "جديد"));
      if (chip.count) {
        var cnt = el("span", "ocnt", Number(chip.count).toLocaleString("ar-EG"));
        cnt.style.background = chip.accent;
        circle.appendChild(cnt);
      }

      b.appendChild(circle);
      b.appendChild(el("div", "otitle", chip.title));
      b.addEventListener("click", function () { selectOffer(chip); });
      chipsEl.appendChild(b);
    });
    offersBox.hidden = false;
  }

  function load() {
    if (loading) return;
    loading = true;
    statusEl.textContent = "جاري تحميل المنتجات...";
    fetch("/api/products?shop=" + encodeURIComponent(shopId))
      .then(function (r) {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then(function (data) {
        items = (data && data.items) || [];
        offers = (data && data.offers) || [];
        categories = (data && data.categories) || [];
        loaded = true;
        if (offers.length > 0) loadIcons();
        renderStrip();
        buildFilters();
        render();
      })
      .catch(function () {
        statusEl.textContent = "تعذر تحميل المنتجات، اضغط على الزرار تاني للمحاولة.";
        loaded = false;
      })
      .then(function () { loading = false; });
  }

  btn.addEventListener("click", function () {
    var willOpen = panel.hidden;
    panel.hidden = !willOpen;
    card.classList.toggle("wide", willOpen);
    document.body.classList.toggle("products-open", willOpen);
    btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    btn.textContent = willOpen ? "إخفاء المنتجات" : "اضغط لعرض المنتجات";
    if (willOpen) {
      if (!loaded) load();
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
})();
</script>`
    : "";

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
    width: 100%; max-width: 380px; background: #fff;
    border-radius: 24px; text-align: center; overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,.06);
  }
  /* 🆕 [illustration] بانر عريض فوق الكارت - نفس الصورة اللي في شاشة
     اللوجين. object-fit: contain (مش cover) عشان الصورة كبيرة ونسبة
     أبعادها مش زي اللوجو الصغير المربع، فمش عايزين نقصّها. لو حابة
     تملي المساحة بالكامل حتى لو فيه قص بسيط، غيّري contain لـ cover.
     الارتفاع 188px (150px + 25%)، وخلفية بيضاء بنفس درجة خلفية اللوجو
     (#FFFFFF)، والصورة متراصة لفوق (flex-start) جوه
     الفريم بدل النص عشان تبان "طالعة" لفوق مش لازقة في النص. */
  .illustration {
    width: 100%; height: 188px; background: #FFFFFF;
    display: flex; align-items: flex-start; justify-content: center;
  }
  .illustration img {
    width: 100%; height: 100%; object-fit: contain; display: block;
  }
  .card-body {
    /* 🆕 مفيش overlap دلوقتي - اللوجو نزل تحت البانر تمامًا من غير ما
       يركب على حتة منه (padding-top عادي بدل الـ margin السالب اللي
       كان بيخلي اللوجو يغطي على جزء من الصورة) */
    padding: 20px 22px 28px;
  }
  /* 🆕 [floating-logo] نفس حركة "عوم" اللوجو في شاشة complete-profile
     (logoFloatAnim: 0 → -10px → 0، بحركة sin ناعمة، لوب مستمر) - هنا
     بنعملها بـ CSS keyframes بدل Animated.Value لأن الصفحة دي HTML
     عادي. المدة الكاملة 3.4s (1.7s لفوق + 1.7s لتحت) زي الأصل بالظبط. */
  @keyframes logoFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .logo {
    width: 84px; height: 84px; margin: 0 auto 14px; border-radius: 22px;
    overflow: hidden; background: #FFFFFF;
    box-shadow: 0 6px 14px rgba(0,0,0,.10);
    animation: logoFloat 3400ms ease-in-out infinite;
  }
  /* لليوزرز اللي مفعّلين "تقليل الحركة" في جهازهم - نوقف الأنيميشن */
  @media (prefers-reduced-motion: reduce) {
    .logo { animation: none; }
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

  /* 🆕 [عرض المنتجات] */
  body.has-products { align-items: flex-start; }
  .card.wide { max-width: 880px; }
  /* موبايل: لما المنتجات تتفتح الكارت الأبيض بياخد عرض الشاشة كله والشبكة بتاخد
     هوامش 12px بس - فعرض كارت المنتج بيطلع (عرض الشاشة - 36) ÷ 2 بالظبط زي
     CARD_WIDTH في ListingCard.tsx (CARD_GAP = 12) */
  @media (max-width: 639px) {
    body.products-open { padding: 0; }
    .card.wide { max-width: none; border-radius: 0; box-shadow: none; }
    .card.wide .products { margin-inline: -22px; padding-inline: 12px; }
  }
  button.btn { width: 100%; font-family: inherit; cursor: pointer; }
  .outline { background: #fff; color: #1C1C1C; border: 1.5px solid #1C1C1C; }
  .products {
    margin-top: 20px; padding-top: 16px; text-align: right;
    border-top: 1px solid #ECE7DE;
  }
  .products[hidden] { display: none; }
  .notice {
    background: #FFF7E6; border: 1px solid #F3E2B8; border-radius: 14px;
    padding: 12px 14px; font-size: 13px; line-height: 1.8; color: #5B4A1E;
  }
  .notice .btn { margin-top: 8px; padding: 11px 14px; font-size: 14px; text-align: center; }
  .notice-soon { margin-top: 6px; font-size: 12px; }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 4px; }
  .filters label {
    display: flex; flex-direction: column; gap: 4px; flex: 1 1 120px;
    font-size: 11px; color: #8A8377;
  }
  .filters select {
    font: inherit; font-size: 13px; padding: 9px 10px; color: #1C1C1C;
    border: 1px solid #ECE7DE; border-radius: 12px; background: #fff;
  }
  .pmeta {
    display: flex; justify-content: space-between; align-items: center;
    margin: 10px 0; font-size: 13px; font-weight: 700;
  }
  .pclear {
    background: none; border: 0; padding: 0; font: inherit; font-size: 12px;
    color: #2F6FED; cursor: pointer;
  }
  .pclear[hidden] { display: none; }
  .pstatus { text-align: center; color: #8A8377; font-size: 13px; padding: 12px 0; }
  .pstatus:empty { display: none; }

  /* 🆕 [شريط العروض] - نفس ستايل components/StoreOffers.tsx: دايرة 52px بحلقة
     منقطة (SVG) وأيقونة Ionicons، شارات صغيرة (قيمة العرض / جديد / عدد العروض) */
  .offers {
    margin-top: 14px; padding: 10px 0; background: #fff; border-radius: 22px;
    box-shadow: 0 2px 8px rgba(28, 28, 28, .04);
  }
  .offers[hidden] { display: none; }
  .offers-title { font-size: 14.5px; font-weight: 800; padding: 0 12px; margin-bottom: 8px; }
  .ostrip { display: flex; gap: 6px; overflow-x: auto; padding: 8px 12px 2px; scrollbar-width: none; }
  .ostrip::-webkit-scrollbar { display: none; }
  .ocard {
    flex: 0 0 86px; width: 86px; display: flex; flex-direction: column;
    align-items: center; padding: 4px; border: 0; background: none;
    font: inherit; color: inherit; border-radius: 16px; cursor: pointer;
  }
  .ocard:active { opacity: .85; transform: scale(.96); }
  .ocircle {
    position: relative; width: 52px; height: 52px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .obg { position: absolute; inset: 0; border-radius: 50%; opacity: .3; }
  .oring { position: absolute; inset: 0; }
  .ocircle ion-icon { position: relative; font-size: 18px; }
  .omini {
    position: absolute; bottom: -2px; right: -3px; min-width: 22px;
    padding: 1.3px 3px; border-radius: 7px; border: 1.3px solid #fff;
    font-size: 8px; font-weight: 800; color: #fff; text-align: center; line-height: 1.2;
  }
  .onew {
    position: absolute; top: -3px; right: -5px; background: #E1523D; color: #fff;
    border-radius: 5px; padding: 1.2px 4px; font-size: 7px; font-weight: 800;
  }
  .ocnt {
    position: absolute; bottom: -2px; right: -3px; min-width: 15px; height: 15px;
    padding: 0 3px; border-radius: 7.5px; border: 1.3px solid #fff;
    font-size: 8px; font-weight: 800; color: #fff;
    display: flex; align-items: center; justify-content: center;
  }
  .otitle {
    margin-top: 7px; font-size: 9.5px; font-weight: 600; line-height: 14px;
    min-height: 28px; text-align: center; color: #1C1C1C;
  }
  .obanner {
    display: flex; align-items: center; gap: 8px; margin-top: 10px;
    padding: 8px 12px; border-radius: 12px; background: #F3EEFC;
    font-size: 12px; font-weight: 700;
  }
  .obanner[hidden] { display: none; }
  .obanner button {
    background: none; border: 0; padding: 0; font-size: 18px; line-height: 1;
    color: #8A8377; cursor: pointer;
  }

  /* 🆕 [كارت المنتج] - نفس ستايل components/ListingCard.tsx */
  /* مقاسات الكارت مطابقة للتطبيق: العرض (W - 36) / 2 على الموبايل (عمودين، فجوة 12)،
     وارتفاع الصورة = العرض × 1.05 (IMAGE_HEIGHT في ListingCard.tsx). على الشاشات
     الكبيرة بنثبّت العرض 184px (حوالي عرض الكارت على موبايل عادي) وبنسيب عدد
     الأعمدة يتحدد حسب المساحة */
  .pgrid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
    margin-top: 10px; align-items: stretch;
  }
  @media (min-width: 640px) {
    .pgrid { grid-template-columns: repeat(auto-fill, 184px); justify-content: center; }
  }
  .pcard {
    display: flex; flex-direction: column; text-decoration: none; color: inherit;
    background: #fff; border-radius: 16px; overflow: hidden;
    /* البوردر الخفيف (0.5px في التطبيق) مرسوم كحلقة خارجية بدل border عشان مياكلش من
       عرض الصورة - فالصورة تاخد عرض الكارت كامل وارتفاعها = العرض × 1.05 بالظبط */
    box-shadow: 0 0 0 .5px #ECE7DE, 0 3px 10px rgba(28, 28, 28, .04);
  }
  .pimgw { position: relative; flex: 0 0 auto; width: 100%; aspect-ratio: 1 / 1.05; overflow: hidden; background: #F0EBE2; }
  .pimg { display: block; width: 100%; height: 100%; object-fit: cover; }
  .dots { position: absolute; bottom: 8px; left: 8px; display: flex; gap: 4px; }
  .dots.lifted { bottom: 26px; }
  .dot {
    width: 12px; height: 12px; border-radius: 50%; border: 1px solid #fff;
    box-shadow: 0 1px 1px rgba(0, 0, 0, .15);
  }
  .ribbon {
    position: absolute; top: 15px; right: -38px; width: 130px; padding: 2px 0;
    transform: rotate(45deg); text-align: center; white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .15); z-index: 5; pointer-events: none;
  }
  .ribbon.disc { background: #FFD700; color: #000; font-size: 10px; font-weight: 800; }
  .ribbon.multi { background: #D64545; color: #fff; font-size: 9.2px; font-weight: 800; padding: 3px 0; }
  .bar {
    position: absolute; left: 0; right: 0; bottom: 0; padding: 2.4px 6px;
    text-align: center; font-size: 9.8px; font-weight: 800; line-height: 13px;
    color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    z-index: 5; pointer-events: none;
  }
  .bar.bogo { background: #D64545; }
  .bar.bogod { background: #1C1C1C; }
  .bar.bundle { background: #6B7A3A; }
  .pinfo { flex: 1 1 auto; display: flex; flex-direction: column; padding: 10px; }
  .ptitle {
    font-size: 13px; font-weight: 600; line-height: 1.4; color: #1C1C1C; text-align: right;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  /* صف التقييم على الشمال (flexDirection: "row" في التطبيق)، وصف الموقع على اليمين (row-reverse) */
  .prate {
    display: flex; direction: ltr; justify-content: flex-start; align-items: center;
    gap: 3px; margin-top: 4px; font-size: 10.5px; font-weight: 600; color: #8A8377;
  }
  .prate .star { color: #F5A623; font-size: 11px; line-height: 1; }
  .ploc {
    display: flex; align-items: center; gap: 3px; margin-top: 4px;
    font-size: 10.5px; line-height: 1.3; color: #B9B2A6;
  }
  .ploc svg { flex: 0 0 auto; width: 11px; height: 11px; }
  .ploc span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  /* صف السعر بيتثبّت أسفل الكارت عشان الأسعار تتساوى في نفس الصف حتى لو كروت جنب بعض
     اختلف عدد صفوف المعلومات فيها */
  .pbottom { margin-top: auto; padding-top: 8px; direction: ltr; text-align: left; }
  .pprice { font-size: 13px; font-weight: 700; color: #1C1C1C; }
  .pold { margin-top: 2px; font-size: 11px; color: #9E9E9E; text-decoration: line-through; }
  .pold.ghost { visibility: hidden; }
</style>
</head>
<body${shopId ? ' class="has-products"' : ""}>
  <main class="card">
    <div class="illustration"><img src="${esc(CONFIG.DEFAULT_ILLUSTRATION)}" alt=""></div>
    <div class="card-body">
      <div class="logo"><img src="${esc(logo)}" alt=""></div>
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ""}
      ${description ? `<p class="desc">${esc(description)}</p>` : ""}
      <a class="btn primary" href="${esc(deepLink)}">افتح في التطبيق</a>
      ${productsButton}
      ${storeButtons}
      <p class="hint">${esc(hint)}</p>
      ${productsPanel}
    </div>
  </main>
  ${productsScript}
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
      shopId: id, // 🆕 بيفعّل زرار "اضغط لعرض المنتجات"
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