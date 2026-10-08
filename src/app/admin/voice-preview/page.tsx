"use client";

import { useState } from "react";
import { Mic, Volume2, Sparkles, CheckCircle2, Play, Info, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const SAMPLES = [
  {
    id: "greeting",
    title: "1. ترحيب وتأكيد الموديل والثمن والتوصيل",
    voice: "جمال (ar-MA-JamalNeural - مغربي)",
    type: "صوت ذكوري",
    src: "/audio/moroccan_voice_jamal_greeting.mp3",
    text: "مرحبا بك أخويا العزيز! الموديل اللي عجبك متوفر فـ النمرة ديالك، والثمن 150 درهم فقط. والتوصيل فابور لجميع المدن والدفع عند الاستلام حتى تقلب السلعة بعينيك عاد تخلص. واش نوجدو ليك الطلبية؟",
    situation: "فاش كيسول الكليان فـ الأول على الثمن ولا كيطلب القياس ديالو."
  },
  {
    id: "dispatch",
    title: "2. إشعار الشحن وخروج الطلبية مع الليفرور",
    voice: "جمال (ar-MA-JamalNeural - مغربي)",
    type: "صوت ذكوري",
    src: "/audio/moroccan_voice_jamal_dispatch.mp3",
    text: "سلام خويا، راه حنا صيفطنا لك الكوموند ديالك إن شاء الله تعالى، راه غادي يتواصل معاك الليفرور فـ أقرب وقت باش يجيبها ليك حتى لباب الدار.",
    situation: "إشعار الشحن المسائي ديال الـ 8 د الليل للحالات المؤكدة المستمرة."
  },
  {
    id: "reply",
    title: "3. رد سريع واحترافي على الكليان",
    voice: "جمال (ar-MA-JamalNeural - مغربي)",
    type: "صوت ذكوري",
    src: "/audio/moroccan_voice_jamal_reply.mp3",
    text: "أهلاً خويا، سمح لي على التعطيلة، راني معاك دابا على الراس والعين! قولي عافاك شحال النمرة اللي كتلبس باش نشوف ليك الموديلات المتوفرة.",
    situation: "ملي كيصيفط الكليان أوديو كيطلب شي استفسار أو كيسول واش كاين شي حد."
  },
  {
    id: "mouna",
    title: "4. عينة بنبرة صوت أنثوية (خدمة العملاء)",
    voice: "منى (ar-MA-MounaNeural - مغربية)",
    type: "صوت أنثوي",
    src: "/audio/moroccan_voice_mouna_sample.mp3",
    text: "مرحبا بك أخويا فـ متجر شوز سبوت! السلعة نقية بزاف وجودتها ممتازة، كتشوفها وتقلبها بعينيك عاد كتخلص والتوصيل فابور.",
    situation: "خيار بديل إذا فضلت نبرة نسوية لخدمة الزبائن."
  }
];

export default function VoicePreviewPage() {
  const [playingId, setPlayingId] = useState<string | null>(null);

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600">
              <Mic className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">معاينة الصوت المغربي (AI Moroccan Voice Notes)</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            استمع للعينات الصوتية بالدارجة المغربية وقيم النبرة والجودة قبل اتخاذ قرار تفعيلها على واتساب.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/admin/orders">
            <ArrowRight className="h-4 w-4" />
            الرجوع للطلبات
          </Link>
        </Button>
      </div>

      {/* Voice Samples List */}
      <div className="grid gap-4 md:grid-cols-2">
        {SAMPLES.map((sample) => (
          <Card key={sample.id} className="border-border/60 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                  <Volume2 className="h-3 w-3 me-1" />
                  {sample.voice}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {sample.type}
                </Badge>
              </div>
              <CardTitle className="text-base font-semibold mt-2">{sample.title}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">{sample.situation}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              {/* Text Quote */}
              <div className="bg-muted/40 p-3 rounded-lg border text-sm font-medium leading-relaxed">
                <span className="text-muted-foreground text-xs block mb-1">النص المنطوق:</span>
                "{sample.text}"
              </div>

              {/* HTML5 Audio Player */}
              <div className="pt-1">
                <audio
                  controls
                  preload="metadata"
                  className="w-full h-10 rounded-lg outline-none"
                  src={sample.src}
                  onPlay={() => setPlayingId(sample.id)}
                  onPause={() => setPlayingId(null)}
                >
                  متصفحك لا يدعم مشغل الصوت.
                </audio>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Technical Evaluation Section */}
      <Card className="bg-stone-50/50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg">التقييم التقني وملاحظات التطبيق على واتساب</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3 bg-background rounded-lg border">
              <h4 className="font-bold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                المميزات والإيجابيات:
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                <li>إحساس بشري عالي: الكليان كيحس بأنه كيتواصل مع بائع حقيقي فالمحل.</li>
                <li>مناسبة جداً للكليان اللي مكيعرفش يقرا أو كيفضل يسمع أوديو.</li>
                <li>سرعة المعالجة عالية جداً وبدون أي تكلفة API مدفوعة (Edge Neural TTS).</li>
              </ul>
            </div>

            <div className="p-3 bg-background rounded-lg border">
              <h4 className="font-bold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                <Info className="h-4 w-4" />
                نقاط يجب الانتباه لها:
              </h4>
              <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                <li>الكلمات بالفرنسية أو الأرقام كينطقها بنبرة عربية فصيحة نوعاً ما.</li>
                <li>الأوديو كياخد حوالي 1.5 ثانية إضافية باش يترفع لـ Meta API قبل الإرسال.</li>
                <li>الرسائل المكتوبة كتكون أسرع فـ تصفح المقاسات والموديلات المعروضة.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
