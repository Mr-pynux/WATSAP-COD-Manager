// App-level constants (statuses are plain strings — SQLite/Prisma, no enums)

export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "no_answer",
  "retry",
  "postponed",
  "canceled",
  "shipped",
  "delivered",
  "returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  no_answer: "مجاوبش",
  retry: "إعادة المحاولة",
  postponed: "مؤجل",
  canceled: "ملغى",
  shipped: "مرسل",
  delivered: "تم التوصيل",
  returned: "مرجع",
};

export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  new: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  confirmed: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30",
  no_answer: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  retry: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
  postponed: "bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  canceled: "bg-red-600/15 text-red-700 dark:text-red-300 border-red-600/30",
  shipped: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  delivered: "bg-green-600/15 text-green-700 dark:text-green-300 border-green-600/30",
  returned: "bg-rose-600/15 text-rose-700 dark:text-rose-300 border-rose-600/30",
};

export const RETURN_REASONS = ["size", "quality", "changed_mind", "no_show"] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  size: "مقاس غالط",
  quality: "جودة",
  changed_mind: "بدل رأيه",
  no_show: "ماجاش يتسلم",
};

export const TEMPLATE_LABELS: Record<string, string> = {
  confirm_1: "التأكيد الأول",
  followup_2: "متابعة 1",
  followup_3: "متابعة أخيرة",
  day_before: "يوم قبل التوصيل",
  shipped: "تم الإرسال",
  thanks: "شكر",
  returned_sorry: "اعتذار المرجع",
};

export const TEMPLATE_VARIABLES = [
  "{name}",
  "{product}",
  "{size}",
  "{color}",
  "{quantity}",
  "{total}",
  "{city}",
  "{tracking}",
] as const;

export const MOROCCAN_CITIES = [
  "الدار البيضاء",
  "الرباط",
  "مراكش",
  "فاس",
  "طنجة",
  "أكادير",
  "مكناس",
  "وجدة",
  "القنيطرة",
  "تطوان",
  "سلا",
  "تمارة",
  "المحمدية",
  "آسفي",
  "الجديدة",
  "بني ملال",
  "الناظور",
  "خريبكة",
  "سطات",
  "برشيد",
  "الصويرة",
  "العرائش",
  "القصر الكبير",
  "كلميم",
  "تازة",
  "الخميسات",
  "وادي زم",
  "سيدي قاسم",
  "إنزكان",
  "الداخلة",
  "العيون",
  "الفنيدق",
  "سيدي سليمان",
  "جرافة",
  "بركان",
  "وارزازات",
  "الحسيمة",
  "أزرو",
  "تيفلت",
  "تارودانت",
  "الفقيه بن صالح",
  "خنيفرة",
  "زاكورة",
  "الرشيدية",
  "ميدلت",
  "تنغير",
  "إفران",
  "أزيلال",
  "شفشاون",
  "وزان",
  "سيدي بنور",
  "اليوسوفية",
  "بن سليمان",
  "تانطان",
  "مدينة أخرى",
] as const;

// Statuses that count as "confirmed-or-beyond" for the confirmation-rate KPI
export const CONFIRMED_LIKE: OrderStatus[] = ["confirmed", "shipped", "delivered"];

// Event types
export const EVENT_TYPES = {
  created: "created",
  whatsappClick: "whatsapp_click",
  statusChange: "status_change",
} as const;

/** Quick-pick image library for the admin product editor (OSS-hosted sneaker photos). */
export const PRODUCT_ASSET_LIBRARY = [
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/16e2e26e2d2f.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/0ebaa6145dcb.jpeg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/60716d5bb2e0.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/6fdca56479ce.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b7f0de266de9.png",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/8fa13a4e54cc.jpg",
];
