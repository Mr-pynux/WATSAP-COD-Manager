import { ORDER_STATUSES, type OrderStatus } from "./constants";

export interface OrdersFilterInput {
  status?: string;
  city?: string;
  courierId?: string;
  phone?: string;
  from?: string; // yyyy-MM-dd
  to?: string; // yyyy-MM-dd
  page?: number;
}

export interface PrismaOrderWhere {
  status?: { in: string[] };
  city?: string;
  courierId?: string;
  phone?: { contains: string };
  createdAt?: { gte?: Date; lte?: Date };
  AND?: unknown[];
}

/** Parse URLSearchParams into a typed filter object (tolerant). */
export function parseOrdersFilters(params: URLSearchParams): OrdersFilterInput {
  const status = params.get("status") || undefined;
  return {
    status: status && status !== "all" && ORDER_STATUSES.includes(status as OrderStatus) ? status : undefined,
    city: params.get("city") || undefined,
    courierId: params.get("courierId") || undefined,
    phone: params.get("phone") || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
    page: Number(params.get("page")) > 0 ? Number(params.get("page")) : 1,
  };
}

/** Build the Prisma `where` for order list filters (used by list + export). */
export function buildOrdersWhere(f: OrdersFilterInput) {
  const conditions: PrismaOrderWhere[] = [];
  if (f.status) conditions.push({ status: { in: [f.status] } });
  if (f.city) conditions.push({ city: f.city });
  if (f.courierId) conditions.push({ courierId: f.courierId });
  if (f.phone) conditions.push({ phone: { contains: f.phone.replace(/\s+/g, "") } });
  if (f.from || f.to) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (f.from) {
      const d = new Date(`${f.from}T00:00:00`);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (f.to) {
      const d = new Date(`${f.to}T23:59:59`);
      if (!Number.isNaN(d.getTime())) createdAt.lte = d;
    }
    conditions.push({ createdAt });
  }
  return conditions.length ? { AND: conditions } : {};
}

export const PAGE_SIZE = 20;
