// api/products.js
//
// بترجّع منتجات متجر واحد + عروضه النشطة كـ JSON لصفحة المتجر على الويب
// (زرار "اضغط لعرض المنتجات" في api/link.js).
//
// الجداول المستخدمة (كلها اتأكدنا إن دور anon يقدر يقرأها):
// listings + listing_images + categories + listing_reviews + offers + offer_products
//
// 🧮 منطق العروض منقول من lib/offers.ts في التطبيق، وبالذات من الطريقة اللي
// شاشة المتجر (app/store/[id].tsx) بتشتغل بيها:
// - كل منتج بياخد أخص عرض: عرض "منتجات محددة" (الأحدث) له الأولوية، وإلا عرض
//   "جميع المنتجات" الأحدث للمتجر.
// - "خصم مباشر" بيتحسب بالطريقة القديمة (fallback) لأن شاشة المتجر في التطبيق
//   مبتسحبش base_cost، فالسعر هنا مطابق للي بيظهر في التطبيق.
// - "اشترِ واحصل على مجانًا / خصم" مفيهمش تعديل على السعر، بس شارة نصية.
// - "السعر المجمّع" (bundle) شارة مستقلة.
// - عروض جمهور "المتابعون" مبتظهرش على الويب: الزائر مش مسجّل دخول، فمش
//   متابع لأي متجر (نفس سلوك التطبيق للزائر). RLS بيسمح لـ anon يشوفها، فبنفلتر
//   بنفسنا بـ audience_type = general.
//
// ⚠️ ملحوظة: RLS على listings حاليًا (listings_select_all) بتسمح لـ anon بقراءة
// كل أعمدة كل الصفوف، بما فيها base_cost / mandatory_fee_amount / seller_id.
// الـ endpoint ده مبيرجّعش غير الحقول اللازمة للعرض، لكن المفتاح العام نفسه
// يقدر يقرأها - راجعي ده (عمود-عمود عن طريق view أو grants) لو سعر التكلفة سري.

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://bcktrkpbjacbrquimzrg.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const OFFER_TYPES = [
  "direct_discount",
  "buy_get_free",
  "buy_get_discount",
  "bundle_price",
];

// نفس ترتيب وعناوين وألوان كروت الفئات في components/StoreOffers.tsx
const CATEGORY_ORDER = [
  "buy_get_free",
  "direct_discount",
  "buy_get_discount",
  "bundle_price",
];
const CATEGORY_META = {
  buy_get_free: {
    title: "اشترِ واحصل على هدية",
    icon: "gift-outline",
    bg: "#E7F7F0",
    accent: "#1FA971",
  },
  direct_discount: {
    title: "خصومات مباشرة",
    icon: "pricetags-outline",
    bg: "#FFF3D6",
    accent: "#F2A93B",
  },
  buy_get_discount: {
    title: "اشترِ واحصل على خصم",
    icon: "bag-handle-outline",
    bg: "#EAF1FE",
    accent: "#2F6FED",
  },
  bundle_price: {
    title: "عروض مجمّعة",
    icon: "layers-outline",
    bg: "rgba(113, 136, 30, 0.14)",
    accent: "#6B7A3A",
  },
};

// أيقونات العروض الفردية (Ionicons) - نفس mapOfferRowToItem في StoreOffers.tsx
const INDIVIDUAL_ICONS = {
  buy_get_free: "cart-outline",
  direct_discount: "pricetag-outline",
  buy_get_discount: "bag-handle-outline",
  bundle_price: "layers-outline",
};

const TARGETS = ["all", "specific", "top_viewed", "most_saved"];

function headers() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

async function sbGet(path) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: headers(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// نفس فكرة parseSizeList في التطبيق: "S, M, L" -> ["S","M","L"]
function parseList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function fetchRatings(ids) {
  const map = {};
  if (ids.length === 0) return map;
  const rows = await sbGet(
    `listing_reviews?select=listing_id,rating&listing_id=in.(${ids
      .map(encodeURIComponent)
      .join(",")})`,
  );
  if (!rows) return map; // التقييمات اختيارية
  const agg = {};
  for (const r of rows) {
    const cur = agg[r.listing_id] || { sum: 0, count: 0 };
    cur.sum += Number(r.rating) || 0;
    cur.count += 1;
    agg[r.listing_id] = cur;
  }
  for (const k of Object.keys(agg)) {
    map[k] = { avg: agg[k].sum / agg[k].count, count: agg[k].count };
  }
  return map;
}

// ===================== العروض =====================

function isValidOffer(r) {
  if (!OFFER_TYPES.includes(r.offer_type)) return false;
  if (!TARGETS.includes(r.product_target_type)) return false;
  switch (r.offer_type) {
    case "direct_discount":
      return r.discount_value != null && !!r.discount_type;
    case "buy_get_free":
      return r.buy_quantity != null && r.get_quantity != null;
    case "buy_get_discount":
      return (
        r.buy_quantity != null &&
        r.get_quantity != null &&
        r.discount_value != null &&
        !!r.discount_type
      );
    case "bundle_price":
      return r.bundle_quantity != null && r.bundle_price != null;
    default:
      return false;
  }
}

const fmtNum = (n) => Number(n).toLocaleString("ar-EG");

// ⚠️ لازم تطابق MANDATORY_FEE_RATE في lib/pricing.ts بالظبط (تعليقات التطبيق
// بتقول 5%). لو غيّرتيها هناك، غيّريها هنا كمان.
const MANDATORY_FEE_RATE = 0.05;

// نفس computeBundleCustomerPrice(base, false).total في lib/bundles.ts:
// السعر الأساسي + رسوم التشغيل مقرّبة لأقرب جنيه، من غير تبرع العميل
// (الكارت في التطبيق بيستخدم customerCharityEnabled = false دايمًا)
function bundleCustomerPrice(base) {
  const b = Number(base);
  const safe = Number.isFinite(b) && b > 0 ? b : 0;
  return safe + Math.round(safe * MANDATORY_FEE_RATE);
}

// عنوان الكارت في شريط العروض - نفس mapOfferRowToItem في StoreOffers.tsx
function offerTitle(r) {
  const buy = r.buy_quantity ?? 1;
  const get = r.get_quantity ?? 1;
  const val = r.discount_value ?? 0;
  if (r.offer_type === "buy_get_free") return `اشترِ ${buy} احصل ${get}`;
  if (r.offer_type === "direct_discount") {
    return r.discount_type === "percentage" ? `خصم ${val}%` : `خصم ${val} ج.م`;
  }
  if (r.offer_type === "bundle_price") {
    return `${r.bundle_quantity ?? 0} قطع بـ${r.bundle_price ?? 0} ج.م`;
  }
  const dl = r.discount_type === "percentage" ? `${val}%` : `${val}ج`;
  return `اشترِ ${buy} خصم ${dl}`;
}

// نص الشارة على كارت المنتج - نفس buildBuyGetFreeLabel / buildBuyGetDiscountLabel /
// buildBundlePriceSummaryLabel في lib/offers.ts
function offerRibbon(r) {
  if (r.offer_type === "buy_get_free") {
    return `اشترِ ${r.buy_quantity} واحصل على ${r.get_quantity} مجانًا`;
  }
  if (r.offer_type === "buy_get_discount") {
    const d =
      r.discount_type === "percentage"
        ? `خصم ${r.discount_value}%`
        : `خصم ${r.discount_value} ج.م`;
    return `اشترِ ${r.buy_quantity} واحصل على ${d}`;
  }
  if (r.offer_type === "bundle_price") {
    return `${r.bundle_quantity} قطع بسعر ${fmtNum(r.bundle_price)} ج.م`;
  }
  return "";
}

// جلب عروض المتجر النشطة (جمهور "العامة" بس) + المنتجات المرتبطة بالعروض
// المحددة. الترتيب created_at تنازلي، فأول عرض مطابق هو الأحدث.
async function fetchShopOffers(shopId) {
  const nowIso = encodeURIComponent(new Date().toISOString());
  const rows = await sbGet(
    `offers?shop_id=eq.${encodeURIComponent(shopId)}` +
      `&status=eq.active&audience_type=eq.general` +
      `&offer_type=in.(${OFFER_TYPES.join(",")})` +
      `&start_at=lte.${nowIso}&end_at=gte.${nowIso}` +
      `&select=id,name,offer_type,discount_type,discount_value,buy_quantity,get_quantity,bundle_quantity,bundle_price,product_target_type,end_at,created_at` +
      `&order=created_at.desc`,
  );
  if (!rows || rows.length === 0) return [];

  const valid = rows.filter(isValidOffer);
  const specificIds = valid
    .filter((r) => r.product_target_type !== "all")
    .map((r) => r.id);

  const idsByOffer = {};
  if (specificIds.length > 0) {
    const links = await sbGet(
      `offer_products?select=offer_id,listing_id&offer_id=in.(${specificIds
        .map(encodeURIComponent)
        .join(",")})&limit=5000`,
    );
    for (const l of links || []) {
      (idsByOffer[l.offer_id] = idsByOffer[l.offer_id] || []).push(
        l.listing_id,
      );
    }
  }

  return valid.map((r) => ({
    id: r.id,
    type: r.offer_type,
    isAll: r.product_target_type === "all",
    ids: new Set(idsByOffer[r.id] || []),
    row: r,
  }));
}

// بيطبّق العروض على منتج واحد - نفس منطق fetchActiveOffersForListings +
// applyOfferToListing + attachBundleOffersToListings في lib/offers.ts
function applyOffers(item, offers) {
  const nonBundle = offers.filter((o) => o.type !== "bundle_price");
  const specific = nonBundle.filter((o) => !o.isAll && o.ids.has(item.id));
  const shopWide = nonBundle.find((o) => o.isAll);
  const chosen = specific[0] || shopWide || null;
  const activeCount = specific.length + (shopWide ? 1 : 0);

  const out = {
    ...item,
    originalPrice: null,
    discountPercentage: 0,
    badge: null, // { kind, text } - شوف الأولوية تحت
    hasOffer: false,
  };

  // العرض "اتطبّق فعلاً" على المنتج؟ في التطبيق activeOffersCount بيتحط بس لما
  // applyOfferDiscount/applyBuyGetFreeLabel/applyBuyGetDiscountLabel تشتغل -
  // يعني خصم مباشر ما اتحسبش (نسبة ≤ 0) مبيدّيش "عليه أكتر من عرض"
  let applied = false;
  let freeLabel = "";
  let bogoDiscountLabel = "";

  if (chosen) {
    const r = chosen.row;
    if (r.offer_type === "direct_discount") {
      const original = item.price;
      let discounted;
      let pct;
      if (r.discount_type === "percentage") {
        pct = Number(r.discount_value);
        discounted = original * (1 - pct / 100);
      } else {
        discounted = Math.max(0, original - Number(r.discount_value));
        pct =
          original > 0
            ? Math.round(((original - discounted) / original) * 100)
            : 0;
      }
      discounted = Math.round(discounted);
      if (pct > 0 && discounted < original) {
        out.price = discounted;
        out.originalPrice = original;
        out.discountPercentage = pct;
        applied = true;
      }
    } else if (r.offer_type === "buy_get_free") {
      freeLabel = offerRibbon(r);
      applied = true;
    } else {
      bogoDiscountLabel = offerRibbon(r);
      applied = true;
    }
    out.hasOffer = true;
  }

  const bundle = offers.find(
    (o) => o.type === "bundle_price" && (o.isAll || o.ids.has(item.id)),
  );
  if (bundle) out.hasOffer = true;

  // أولوية الشارة - نفس ListingCard.tsx بالظبط:
  // أكتر من عرض (ريبون أحمر مائل) > خصم (ريبون أصفر مائل) >
  // اشترِ واحصل مجانًا (بار أحمر) > اشترِ واحصل بخصم (بار غامق) > سعر مجمّع (بار زيتوني)
  const hasDiscount = out.originalPrice != null && out.discountPercentage > 0;
  const hasMulti = applied && activeCount > 1;
  const hasBogo = !hasDiscount && !!freeLabel;
  const hasBogoDiscount = !hasDiscount && !hasBogo && !!bogoDiscountLabel;
  const hasBundle = !hasDiscount && !hasBogo && !hasBogoDiscount && !!bundle;

  if (hasMulti) {
    out.badge = { kind: "multi", text: "عليه أكتر من عرض" };
  } else if (hasDiscount) {
    out.badge = {
      kind: "discount",
      text: `خصم ${Math.round(out.discountPercentage)}%`,
    };
  } else if (hasBogo) {
    out.badge = { kind: "bogo", text: freeLabel };
  } else if (hasBogoDiscount) {
    out.badge = { kind: "bogoDiscount", text: bogoDiscountLabel };
  } else if (hasBundle) {
    // bundle_price في قاعدة البيانات "سعر أساسي" خام - الكارت في التطبيق بيعرض
    // السعر بعد رسوم التشغيل (computeBundleCustomerPrice في lib/bundles.ts)
    out.badge = {
      kind: "bundle",
      text: `${bundle.row.bundle_quantity} قطع بـ ${fmtNum(
        bundleCustomerPrice(bundle.row.bundle_price),
      )} ج.م`,
    };
  }
  return out;
}

// نص الشارة الصغيرة على دايرة العرض الفردي - نفس badgeText في StoreOffers.tsx
function offerBadgeText(r) {
  const val = r.discount_value ?? 0;
  if (r.offer_type === "buy_get_free") {
    return `${r.buy_quantity ?? 1}+${r.get_quantity ?? 1}`;
  }
  if (r.offer_type === "direct_discount" || r.offer_type === "buy_get_discount") {
    return r.discount_type === "percentage" ? `${val}%` : `${val}ج`;
  }
  return `${r.bundle_quantity ?? 0}×`;
}

// كروت شريط العروض: العروض الفردية + كروت الفئات (نفس StoreOffers.tsx)
function buildStrip(offers) {
  const toDto = (o) => ({
    id: o.id,
    type: o.type,
    title: offerTitle(o.row),
    accent: CATEGORY_META[o.type].accent,
    bg: CATEGORY_META[o.type].bg,
    icon: INDIVIDUAL_ICONS[o.type],
    badgeText: offerBadgeText(o.row),
    isNew: true,
    isAll: o.isAll,
    listingIds: o.isAll ? null : [...o.ids],
  });

  const individual = offers.map(toDto);

  const categories = CATEGORY_ORDER.map((type) => {
    const members = offers.filter((o) => o.type === type);
    if (members.length === 0) return null;
    const isAll = members.some((m) => m.isAll);
    const ids = new Set();
    members.forEach((m) => m.ids.forEach((id) => ids.add(id)));
    return {
      id: `category_${type}`,
      type,
      title: CATEGORY_META[type].title,
      accent: CATEGORY_META[type].accent,
      bg: CATEGORY_META[type].bg,
      icon: CATEGORY_META[type].icon,
      count: members.length,
      isAll,
      listingIds: isAll ? null : [...ids],
    };
  }).filter(Boolean);

  return { offers: individual, categories };
}

module.exports = async (req, res) => {
  const shopId = String(req.query.shop || "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(shopId) || !SUPABASE_ANON_KEY) {
    res.status(400).json({ items: [], offers: [], categories: [] });
    return;
  }

  try {
    const rows = await sbGet(
      `listings?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&status=eq.available` +
        `&select=id,title,price,description,location,product_type,size,color,gender,is_featured,created_at,categories(name),listing_images(image_url,sort_order)` +
        `&order=created_at.desc&limit=200`,
    );
    if (!rows) {
      res.status(502).json({ items: [], offers: [], categories: [] });
      return;
    }

    const [ratings, shopOffers] = await Promise.all([
      fetchRatings(rows.map((x) => x.id)),
      fetchShopOffers(shopId),
    ]);

    const items = rows.map((row) => {
      const imgs = [...(row.listing_images || [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      );
      const rt = ratings[row.id];
      return applyOffers(
        {
          id: row.id,
          title: row.title,
          price: Number(row.price),
          image: imgs[0]?.image_url || "",
          location: (row.location || "").trim(),
          category: (row.categories && row.categories.name) || "أخرى",
          type: row.product_type || "",
          sizes: parseList(row.size),
          colors: parseList(row.color),
          gender: row.gender || "",
          featured: !!row.is_featured,
          rating: rt ? Math.round(rt.avg * 10) / 10 : 0,
          ratingCount: rt ? rt.count : 0,
        },
        shopOffers,
      );
    });

    const { offers, categories } = buildStrip(shopOffers);

    // كاش على الـ CDN عشان نخفف الضغط على Supabase (egress)
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.status(200).json({ items, offers, categories });
  } catch {
    res.status(500).json({ items: [], offers: [], categories: [] });
  }
};