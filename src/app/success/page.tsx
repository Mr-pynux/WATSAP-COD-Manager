import Link from "next/link";
import { CheckCircle2, MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "تم تسجيل طلبك — ShoeSpot",
};

interface SuccessPageProps {
  searchParams: Promise<{ n?: string }>;
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { n } = await searchParams;
  const seller = process.env.NEXT_PUBLIC_SELLER_WHATSAPP || "212600000000";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 p-6">
            <CheckCircle2 className="h-16 w-16 text-emerald-600" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">
          تم تسجيل طلبك بنجاح!
        </h1>

        {n && (
          <p className="text-lg font-semibold bg-muted rounded-lg py-3 px-4 inline-block">
            رقم الطلب: <span className="ltr-num">#{`ORD-${n}`}</span>
          </p>
        )}

        <p className="text-muted-foreground text-lg leading-relaxed">
          غنتراسو معاك قريبا على واتساب باش نأكدو الطلب معاك
        </p>

        <div className="space-y-3 pt-2">
          <Button
            asChild
            size="lg"
            className="w-full h-12 bg-wa text-wa-foreground hover:bg-wa/90"
          >
            <a
              href={`https://wa.me/${seller}?text=${encodeURIComponent("سلام، عندي سؤال على الطلب ديالي")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-5 w-5" />
              تواصل معانا فواتساب
            </a>
          </Button>

          <Button asChild variant="outline" size="lg" className="w-full h-12">
            <Link href="/">
              <ArrowRight className="h-5 w-5" />
              الرجوع للمتجر
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
