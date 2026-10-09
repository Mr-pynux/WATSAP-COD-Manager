import { createRequire } from "module";
const require = createRequire(import.meta.url);
const citiesData = require("./express-coursier-cities.json");

export interface ExpressCoursierCity {
  id: string;
  name: string;
}

export interface CreateParcelParams {
  receiver_name: string;
  address: string;
  city: string; // City name (in Arabic or French) or City ID
  phone: string;
  price: string | number;
  product: string;
  note?: string;
  internal_id?: string;
}

export interface CreateParcelResult {
  success: boolean;
  package_id?: string;
  tracking?: string;
  error?: string;
  raw?: any;
}

// Arabic to French city name dictionary for Express Coursier
const ARABIC_CITY_MAP: Record<string, string> = {
  "الدار البيضاء": "casablanca",
  "الدارالبيضاء": "casablanca",
  "كازا": "casablanca",
  "كازابلانكا": "casablanca",
  "الرباط": "rabat",
  "سلا": "sale",
  "تمارة": "temara",
  "المحمدية": "mohammedia",
  "مراكش": "marrakech",
  "طنجة": "tanger",
  "فاس": "fes",
  "مكناس": "meknes",
  "أكادير": "agadir",
  "اكادير": "agadir",
  "القنيطرة": "kenitra",
  "الجديدة": "el jadida",
  "سطات": "settat",
  "برشيد": "berrechid",
  "بوسكورة": "bouskoura",
  "عين حرودة": "ain harrouda",
  "دار بوعزة": "dar bouazza",
  "الرحمة": "arrahma",
  "تطوان": "tetouan",
  "وجدة": "oujda",
  "بني ملال": "beni mellal",
  "بني-ملال": "beni mellal",
  "خريبكة": "khouribga",
  "آسفي": "safi",
  "اسفي": "safi",
  "الناظور": "nador",
  "ناظور": "nador",
  "تازة": "taza",
  "العرائش": "larache",
  "القصر الكبير": "ksar el kebir",
  "العيون": "laayoune",
  "الداخلة": "dakhla",
  "ورزازات": "ouarzazate",
  "الصويرة": "essaouira",
  "تارودانت": "taroudant",
  "بركان": "berkane",
  "كلميم": "guelmim",
  "سيدي قاسم": "sidi kacem",
  "سيدي سليمان": "sidi slimane",
  "الخميسات": "khemisset",
  "تيفلت": "tiflet",
};

/**
 * Resolves any city name (Arabic or French) to the corresponding Express Coursier City ID.
 * Defaults to "1" (Casablanca) if not found.
 */
export function resolveExpressCityId(cityName: string): string {
  if (!cityName) return "1";

  const clean = cityName.trim();

  // If already a numeric ID
  if (/^\d+$/.test(clean)) {
    const exists = (citiesData as ExpressCoursierCity[]).some((c) => c.id === clean);
    if (exists) return clean;
  }

  const lower = clean.toLowerCase();

  // 1. Check Arabic dictionary
  let frenchTarget = ARABIC_CITY_MAP[clean] || ARABIC_CITY_MAP[lower];
  if (!frenchTarget) {
    for (const [ar, fr] of Object.entries(ARABIC_CITY_MAP)) {
      if (lower.includes(ar.toLowerCase()) || ar.toLowerCase().includes(lower)) {
        frenchTarget = fr;
        break;
      }
    }
  }

  const query = (frenchTarget || lower).trim();

  // 2. Search in Express Coursier cities list
  const match = (citiesData as ExpressCoursierCity[]).find((c) => {
    const cName = c.name.toLowerCase().trim();
    return cName === query || cName.includes(query) || query.includes(cName);
  });

  if (match) {
    return match.id;
  }

  // Fallback to Casablanca (ID 1)
  return "1";
}

/**
 * Creates a real parcel on Express Coursier's merchant platform (expresscoursier.ma).
 */
export async function createExpressCoursierParcel(
  params: CreateParcelParams
): Promise<CreateParcelResult> {
  const token = process.env.EXPRESS_COURSIER_TOKEN?.trim();
  const storeId = Number(process.env.EXPRESS_COURSIER_STORE_ID || "12515");

  if (!token) {
    console.error("[Express Coursier] Missing EXPRESS_COURSIER_TOKEN");
    return {
      success: false,
      error: "Missing EXPRESS_COURSIER_TOKEN in server configuration",
    };
  }

  const cityId = resolveExpressCityId(params.city);

  // Normalize phone (strip spaces, symbols, international +212)
  let cleanPhone = params.phone.replace(/\D/g, "");
  if (cleanPhone.startsWith("212")) {
    cleanPhone = "0" + cleanPhone.slice(3);
  }
  if (!cleanPhone.startsWith("0") && cleanPhone.length === 9) {
    cleanPhone = "0" + cleanPhone;
  }

  const payload = {
    store_id: storeId,
    receiver_name: params.receiver_name.trim() || "الزبون",
    address: params.address.trim() || "عنوان التوصيل",
    city: cityId,
    phone: cleanPhone,
    price: String(params.price || 0),
    product: params.product.trim() || "منتج",
    note: (params.note || "").trim(),
    internal_id: (params.internal_id || "").trim(),
  };

  const endpoint = `https://expresscoursier.ma/v1.0/packages/${token}`;

  try {
    console.log("[Express Coursier API] Sending parcel to Express Coursier...", {
      endpoint: `https://expresscoursier.ma/v1.0/packages/***`,
      store_id: storeId,
      receiver_name: payload.receiver_name,
      city_id: cityId,
      phone: payload.phone,
      price: payload.price,
      internal_id: payload.internal_id,
    });

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    console.log("[Express Coursier API] Response:", data);

    if (data && (data.success === true || data.success === "true") && data.package_id) {
      return {
        success: true,
        package_id: data.package_id,
        tracking: data.package_id,
        raw: data,
      };
    }

    const errorMsg = data?.error || data?.message || `HTTP ${res.status} from Express Coursier`;
    console.error("[Express Coursier API Error]:", errorMsg);
    return {
      success: false,
      error: errorMsg,
      raw: data,
    };
  } catch (err: any) {
    console.error("[Express Coursier API Exception]:", err);
    return {
      success: false,
      error: err.message || "Failed to reach Express Coursier API",
    };
  }
}
