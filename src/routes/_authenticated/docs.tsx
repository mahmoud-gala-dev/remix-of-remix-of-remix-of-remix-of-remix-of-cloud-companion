import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, BookOpen, LifeBuoy, Search } from "lucide-react";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModuleGlyph } from "@/components/docs/ModuleGlyph";
import { DOC_GROUPS, DOC_MODULES, type DocModule } from "@/lib/docs-modules";
import { requestModuleHelp } from "@/lib/module-help";
import { useI18n } from "@/lib/i18n";


export const Route = createFileRoute("/_authenticated/docs")({
  head: () => ({
    meta: [
      { title: "Module Documentation | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "Bilingual documentation for every module of the bug tracker with an animated map of the user journey and direct links to each screen.",
      },
      { property: "og:title", content: "Module Documentation | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Understand and navigate every module: errors, chat, analytics, admin and more.",
      },
    ],
  }),
  component: DocsPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="documentation page" />,
});

const COPY = {
  en: {
    kicker: "Product documentation",
    title: "Module map",
    detail:
      "Every module of the platform, what it does, who it is for, and a direct link to open it. Switch the interface language to read this page in Arabic.",
    search: "Search modules…",
    open: "Open module",
    empty: "No module matches your search.",
    count: "modules",
    help: "Ask for help",
    helpTitle: "Request help with this module",
    helpDetail: "Your request is sent to the admins and supervisors as a notification.",
    helpPlaceholder: "What do you need help with?",
    send: "Send request",
    cancel: "Cancel",
    sent: "Help request sent",
    noAdmins: "No admin is available to receive the request.",
  },
  ar: {
    kicker: "توثيق المنتج",
    title: "خريطة الموديولات",
    detail:
      "كل وحدة في النظام: وظيفتها، ومن يستخدمها، ورابط مباشر لفتحها. بدّل لغة الواجهة لقراءة هذه الصفحة بالإنجليزية.",
    search: "ابحث في الموديولات…",
    open: "افتح الموديول",
    empty: "لا يوجد موديول مطابق للبحث.",
    count: "موديول",
    help: "اطلب مساعدة",
    helpTitle: "طلب مساعدة في هذا الموديول",
    helpDetail: "يُرسل الطلب كإشعار إلى المديرين والمشرفين.",
    helpPlaceholder: "ما الذي تحتاج مساعدة فيه؟",
    send: "إرسال الطلب",
    cancel: "إلغاء",
    sent: "تم إرسال طلب المساعدة",
    noAdmins: "لا يوجد مدير متاح لاستلام الطلب.",
  },
} as const;

function DocCard({
  mod,
  lang,
  onAskHelp,
}: {
  mod: DocModule;
  lang: "en" | "ar";
  onAskHelp: (mod: DocModule) => void;
}) {
  const copy = COPY[lang];
  const body = mod[lang];
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 transition-shadow hover:shadow-md">
      <ModuleGlyph variant={mod.glyph} label={body.title} />
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{body.title}</h3>
          <Badge variant="outline" className="text-[10px]">
            {DOC_GROUPS[mod.group][lang]}
          </Badge>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body.summary}</p>
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {body.points.map((point) => (
          <li key={point} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <Link
          to={mod.to as "/dashboard"}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {copy.open} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
        <Button size="sm" variant="outline" className="h-8" onClick={() => onAskHelp(mod)}>
          <LifeBuoy className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {copy.help}
        </Button>
      </div>
    </article>
  );
}


function DocsPage() {
  const { language } = useI18n();
  const lang: "en" | "ar" = language === "ar" ? "ar" : "en";
  const copy = COPY[lang];
  const [query, setQuery] = useState("");
  const [helpModule, setHelpModule] = useState<DocModule | null>(null);
  const [helpMessage, setHelpMessage] = useState("");

  const sendHelp = useMutation({
    mutationFn: async () => {
      if (!helpModule) return 0;
      return requestModuleHelp({
        module: helpModule[lang].title,
        message: helpMessage.trim(),
      });
    },
    onSuccess: (count) => {
      toast[count > 0 ? "success" : "warning"](count > 0 ? copy.sent : copy.noAdmins);
      setHelpModule(null);
      setHelpMessage("");
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOC_MODULES;
    return DOC_MODULES.filter((mod) =>
      [mod.en.title, mod.ar.title, mod.en.summary, mod.ar.summary, mod.id]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  const groups = ["core", "collaboration", "insight", "admin"] as const;

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="border-b border-border/70 pb-6">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          <BookOpen className="h-3.5 w-3.5" />
          {copy.kicker}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy.detail}</p>
        <div className="relative mt-4 max-w-md">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            className="ps-9"
          />
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {filtered.length} {copy.count}
        </p>
      </header>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
          {copy.empty}
        </p>
      ) : (
        groups.map((group) => {
          const items = filtered.filter((mod) => mod.group === group);
          if (!items.length) return null;
          return (
            <section key={group} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {DOC_GROUPS[group][lang]}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((mod) => (
                  <DocCard key={mod.id} mod={mod} lang={lang} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </main>
  );
}

export default DocsPage;
