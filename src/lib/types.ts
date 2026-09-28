// Shared DTO types between API routes and client components.

export interface ProductColor {
  name: string;
  hex: string;
}

export interface ProductDTO {
  id: string;
  name: string;
  imageUrls: string[];
  videoUrl: string | null;
  description: string | null;
  features: string[];
  priceMad: number;
  oldPriceMad: number | null;
  offerQty: number | null;
  offerTotalMad: number | null;
  costMad: number;
  sizes: string[];
  colors: ProductColor[];
  active: boolean;
  stockBySize?: Record<string, string>;
}

export interface CourierDTO {
  id: string;
  name: string;
  contact: string | null;
  feePerDeliveryMad: number;
  feePerReturnMad: number;
}

export interface OrderDTO {
  id: string;
  orderNumber: number;
  customerName: string;
  phone: string;
  city: string;
  district: string | null;
  landmark: string | null;
  productId: string;
  product: {
    id: string;
    name: string;
    costMad: number;
  };
  size: string;
  color: string | null;
  quantity: number;
  unitPriceMad: number;
  discountMad: number;
  totalMad: number;
  status: string;
  attempts: number;
  lastAttemptAt: string | null;
  shipDate: string | null;
  courierId: string | null;
  courier: { id: string; name: string } | null;
  tracking: string | null;
  notes: string | null;
  returnReason: string | null;
  createdAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface OrdersResponse {
  orders: OrderDTO[];
  total: number;
  page: number;
  totalPages: number;
  blacklistPhones: string[];
}

export interface TemplateDTO {
  key: string;
  bodyAr: string;
  label?: string;
}

export interface BlacklistEntryDTO {
  id: string;
  phone: string;
  strikes: number;
  reasons: string[];
  createdAt: string;
}

export interface KpisResponse {
  ordersToday: number;
  confirmationRate30d: number | null;
  deliveredRate30d: number | null;
  costPerDelivered30d: number | null;
  revenue30d: number;
  netProfit30d: number;
  adSpend30d: number;
  followupCount: number;
  latestOrders: OrderDTO[];
}
