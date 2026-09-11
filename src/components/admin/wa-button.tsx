"use client";

import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WaButtonProps {
  orderId: string;
  templateKey?: string;
  size?: "default" | "sm" | "icon";
  label?: string;
  className?: string;
}

/**
 * WhatsApp deep-link button: POST /api/whatsapp → opens returned wa.me URL.
 * The API logs the click, increments attempts and switches no_answer → retry.
 */
import { logWhatsAppAttemptServer } from "@/app/admin/orders/actions";

export function WaButton({
  orderId,
  templateKey,
  size = "sm",
  label = "واتساب",
  className,
}: WaButtonProps) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const data = await logWhatsAppAttemptServer(orderId, templateKey);
      if (!data.url) {
        toast.error("وقع مشكل فواتساب");
        return;
      }
      window.open(data.url, "_blank");
    } catch {
      toast.error("تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size={size}
      onClick={onClick}
      disabled={loading}
      aria-label={`إرسال رسالة واتساب للطلب`}
      className={cn(
        "bg-wa text-wa-foreground hover:bg-wa/90 border border-wa/30 gap-1",
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}
      {size !== "icon" && label}
    </Button>
  );
}
