"use client";

import { useEffect, useState } from "react";
import { getBotSettingsServer, saveBotSettingsServer } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bot, Save } from "lucide-react";

export default function BotSettingsPage() {
  const [isActive, setIsActive] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBotSettingsServer()
      .then((data) => {
        if (data.settings) {
          setIsActive(data.settings.is_active);
          setSystemPrompt(data.settings.system_prompt);
        }
      })
      .catch(() => toast.error("تعذر تحميل إعدادات البوت"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      await saveBotSettingsServer(isActive, systemPrompt);
      toast.success("تم حفظ إعدادات البوت بنجاح");
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">إعدادات البوت الذكي (WhatsApp AI)</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تهيئة البوت</CardTitle>
          <CardDescription>
            من هنا يمكنك تفعيل أو إيقاف الرد الآلي، وتحديد التعليمات اللي غادي يلتزم بيها البوت فالهضرة مع الكليان.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">تفعيل البوت</Label>
              <p className="text-sm text-muted-foreground">
                إيلا فعلتيه، البوت غيولي يجاوب الكليان بوحدو بناءً على الرسائل اللي كتوصل فـ Webhook.
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">تعليمات البوت (System Prompt)</Label>
            <p className="text-sm text-muted-foreground">
              شنو الدور ديال هاد البوت؟ كيفاش بغيتيه يهضر؟ (مثلاً: اهضر بالدارجة، كون محترم، الهدف ديالك هو تاخد الموافقة على الطلب).
            </p>
            <Textarea
              className="min-h-[200px] font-mono text-sm rtl"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="أنت مساعد ذكي لمتجر إلكتروني مغربي..."
              dir="rtl"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            <Save className="w-4 h-4 mr-2 ml-2" />
            {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </Button>
        </CardContent>
      </Card>
      
      <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="text-amber-800 dark:text-amber-400">ملاحظة هامة (Meta API)</CardTitle>
        </CardHeader>
        <CardContent className="text-amber-700 dark:text-amber-300 text-sm space-y-2">
          <p>
            باش يخدم هاد البوت، خاصك ضروري تكون ربطتي المشروع ديالك بـ <strong>WhatsApp Cloud API</strong>، وتزيد الـ Webhook URL ديالك فـ منصة Meta.
          </p>
          <p>
            الرابط ديال الـ Webhook لي خاصك تحط فـ Meta هو:
            <code className="mx-2 px-2 py-1 bg-amber-100 dark:bg-amber-900 rounded font-mono text-xs text-left inline-block" dir="ltr">
              https://[رابط-الموقع-ديالك]/api/webhook/whatsapp
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
