"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Variable } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TEMPLATE_LABELS, TEMPLATE_VARIABLES } from "@/lib/constants";
import { getTemplatesServer, saveTemplateServer, type TemplateDTO } from "./actions";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateDTO[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getTemplatesServer();
      setTemplates(res.templates);
      const d: Record<string, string> = {};
      for (const t of res.templates) d[t.key] = t.bodyAr;
      setDrafts(d);
    } catch {
      toast.error("تعذر تحميل الرسائل");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(key: string) {
    const body = drafts[key];
    if (!body || body.trim().length < 5) {
      toast.error("نص الرسالة قصير بزاف");
      return;
    }
    setSavingKey(key);
    try {
      await saveTemplateServer(key, body);
      toast.success(`تسجل قالب "${TEMPLATE_LABELS[key] ?? key}"`);
      await load();
    } catch {
      toast.error("تعذر الحفظ");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* variables help */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Variable className="h-4 w-4 text-primary" />
            المتغيرات المتاحة فالرسائل
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((v) => (
              <Badge key={v} variant="secondary" className="ltr-num font-mono">
                {v}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            كل متغير كيتبدل أوتوماتيكيا بمعلومات الطلب ملي كتصيفط الرسالة من واتساب
          </p>
        </CardContent>
      </Card>

      {templates === null ? (
        <div className="space-y-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((t) => {
            const dirty = drafts[t.key] !== t.bodyAr;
            return (
              <Card key={t.key}>
                <CardHeader className="pb-2 space-y-0">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{t.label ?? t.key}</CardTitle>
                    <Badge variant="outline" className="ltr-num font-mono text-xs">
                      {t.key}
                    </Badge>
                  </div>
                  <CardDescription className="sr-only">
                    قالب رسالة واتساب {t.label ?? t.key}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={drafts[t.key] ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [t.key]: e.target.value }))
                    }
                    rows={6}
                    dir="rtl"
                    className="font-sans leading-relaxed nice-scroll"
                    aria-label={`نص قالب ${t.label ?? t.key}`}
                  />
                  <Button
                    onClick={() => save(t.key)}
                    disabled={!dirty || savingKey === t.key}
                    className="gap-1.5 w-full sm:w-auto"
                  >
                    {savingKey === t.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    حفظ
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
