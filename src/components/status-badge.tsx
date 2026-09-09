import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  type OrderStatus,
} from "@/lib/constants";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = (status in STATUS_LABELS ? status : "new") as OrderStatus;
  return (
    <Badge variant="outline" className={cn(STATUS_BADGE_CLASS[key], className)}>
      {STATUS_LABELS[key]}
    </Badge>
  );
}
