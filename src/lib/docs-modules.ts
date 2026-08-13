/**
 * Bilingual documentation catalogue for every module of the app.
 * Rendered by `/docs`; each entry links straight to the live module so the
 * page doubles as a user-journey map.
 */
export type GlyphVariant = "flow" | "orbit" | "bars" | "grid" | "pulse";

export type DocModule = {
  id: string;
  to: string;
  glyph: GlyphVariant;
  group: "core" | "collaboration" | "insight" | "admin";
  en: { title: string; summary: string; points: string[] };
  ar: { title: string; summary: string; points: string[] };
};

export const DOC_GROUPS: Record<DocModule["group"], { en: string; ar: string }> = {
  core: { en: "Core workflow", ar: "المسار الأساسي" },
  collaboration: { en: "Collaboration", ar: "التعاون" },
  insight: { en: "Insight & tracking", ar: "التحليل والمتابعة" },
  admin: { en: "Administration", ar: "الإدارة" },
};

export const DOC_MODULES: DocModule[] = [
  {
    id: "dashboard",
    to: "/dashboard",
    glyph: "pulse",
    group: "core",
    en: {
      title: "Dashboard",
      summary:
        "Role-aware overview of every error: totals, status split, priority, severity and module health, plus the interactive Team Flow Map.",
      points: [
        "Admins and monitors see the whole portfolio",
        "Developers see errors assigned to them or to their projects",
        "Testers see the errors they reported",
      ],
    },
    ar: {
      title: "لوحة التحكم",
      summary:
        "نظرة شاملة حسب الدور على كل الأخطاء: الإجماليات وتوزيع الحالة والأولوية والخطورة وصحة الوحدات، مع خريطة تفاعل الفريق التفاعلية.",
      points: [
        "الأدمن والمراقب يرون كل السجلات",
        "المطور يرى الأخطاء المسندة إليه أو الخاصة بمشاريعه",
        "المختبر يرى الأخطاء التي سجّلها",
      ],
    },
  },
  {
    id: "bugs",
    to: "/bugs",
    glyph: "flow",
    group: "core",
    en: {
      title: "Errors (Bug Tracker)",
      summary:
        "The main register: filters saved in the URL, table and Kanban views, bulk actions, Excel import/export and full detail pages with history.",
      points: [
        "Filter by project, module, status, priority and severity",
        "Import from the Excel template with column validation",
        "Detail page offers comments, attachments, timers and next/previous navigation",
      ],
    },
    ar: {
      title: "الأخطاء (متتبّع الأخطاء)",
      summary:
        "السجل الرئيسي: فلاتر محفوظة في الرابط، عرض جدول ولوحة كانبان، إجراءات جماعية، استيراد وتصدير Excel، وصفحة تفاصيل كاملة مع سجل التغييرات.",
      points: [
        "فلترة حسب المشروع والوحدة والحالة والأولوية والخطورة",
        "استيراد من قالب Excel مع التحقق من الأعمدة",
        "صفحة التفاصيل تتضمن التعليقات والمرفقات والمؤقت والتنقل بين السجلات",
      ],
    },
  },
  {
    id: "my-work",
    to: "/my-work",
    glyph: "grid",
    group: "core",
    en: {
      title: "My Work",
      summary: "A personal queue that gathers the errors and tasks waiting on you right now.",
      points: ["Assigned errors first", "Priority tasks", "Quick status changes"],
    },
    ar: {
      title: "أعمالي",
      summary: "قائمة شخصية تجمع الأخطاء والمهام التي تنتظر إجراءً منك الآن.",
      points: ["الأخطاء المسندة إليك أولًا", "المهام ذات الأولوية", "تغيير سريع للحالة"],
    },
  },
  {
    id: "tasks",
    to: "/tasks",
    glyph: "bars",
    group: "core",
    en: {
      title: "Priority Tasks",
      summary: "Lightweight task board for work that is not a defect, with owners and timers.",
      points: ["Created by admins, supervisors, testers and monitors", "Important flag", "Per-task time tracking"],
    },
    ar: {
      title: "المهام ذات الأولوية",
      summary: "لوحة مهام خفيفة للأعمال غير المرتبطة بخطأ، مع تحديد المسؤول والمؤقت.",
      points: ["ينشئها الأدمن والمشرف والمختبر والمراقب", "وسم المهام المهمة", "تتبع الوقت لكل مهمة"],
    },
  },
  {
    id: "projects",
    to: "/projects",
    glyph: "orbit",
    group: "core",
    en: {
      title: "Projects",
      summary: "Project registry with keys, status and the member list that drives error visibility.",
      points: ["Add developers to a project to grant them access", "Project key prefixes error ids", "Per-project chat channel"],
    },
    ar: {
      title: "المشاريع",
      summary: "سجل المشاريع مع المفاتيح والحالة وقائمة الأعضاء التي تحدد صلاحية رؤية الأخطاء.",
      points: ["إضافة المطور للمشروع تمنحه صلاحية الرؤية", "مفتاح المشروع يظهر في معرّف الخطأ", "قناة دردشة لكل مشروع"],
    },
  },
  {
    id: "chat",
    to: "/chat",
    glyph: "flow",
    group: "collaboration",
    en: {
      title: "Team Chat",
      summary:
        "Realtime project channels with mentions, reactions, pinned messages, search, attachments and progressive loading.",
      points: ["Mention people, errors (#id) and projects (~key)", "Emoji reactions and pinning", "Load older messages in pages of 50"],
    },
    ar: {
      title: "دردشة الفريق",
      summary:
        "قنوات لحظية لكل مشروع مع المنشن والتفاعلات وتثبيت الرسائل والبحث والمرفقات والتحميل التدريجي.",
      points: ["منشن للأشخاص والأخطاء (#id) والمشاريع (~key)", "تفاعلات إيموجي وتثبيت الرسائل", "تحميل الأقدم بخمسين رسالة"],
    },
  },
  {
    id: "improvements",
    to: "/improvements",
    glyph: "pulse",
    group: "collaboration",
    en: {
      title: "Script Improvements",
      summary: "Suggestion board for enhancing the product, with screenshots, video and admin replies.",
      points: ["Anyone can submit an idea", "Comment threads", "Admin response and status"],
    },
    ar: {
      title: "تطوير الاسكريبت",
      summary: "لوحة مقترحات لتحسين المنتج، مع صور وفيديو وردود الإدارة.",
      points: ["أي عضو يمكنه إضافة مقترح", "تعليقات ونقاش", "رد الإدارة وحالة المقترح"],
    },
  },
  {
    id: "activity",
    to: "/activity",
    glyph: "flow",
    group: "insight",
    en: {
      title: "Activity Feed",
      summary: "Chronological trail of every change: status moves, assignments, comments and imports.",
      points: ["Who changed what and when", "Filter by project", "Links back to the source record"],
    },
    ar: {
      title: "سجل النشاط",
      summary: "تتبّع زمني لكل تغيير: الحالات والإسناد والتعليقات والاستيراد.",
      points: ["من عدّل وماذا ومتى", "تصفية حسب المشروع", "روابط مباشرة للسجل الأصلي"],
    },
  },
  {
    id: "resolution-times",
    to: "/resolution-times",
    glyph: "bars",
    group: "insight",
    en: {
      title: "Resolution Times",
      summary: "Developer timers turned into a leaderboard of time spent per error and per project.",
      points: ["Start/stop timer on the error page", "Totals per developer and project", "Visible to admins, monitors and supervisors"],
    },
    ar: {
      title: "أوقات الحل",
      summary: "مؤقتات المطورين تتحول إلى لوحة ترتيب للوقت المستغرق لكل خطأ ولكل مشروع.",
      points: ["تشغيل وإيقاف المؤقت من صفحة الخطأ", "إجماليات لكل مطور ومشروع", "متاحة للأدمن والمراقب والمشرف"],
    },
  },
  {
    id: "analytics",
    to: "/analytics",
    glyph: "grid",
    group: "insight",
    en: {
      title: "Analytics",
      summary: "Trends, module health and SLA metrics that show where quality is drifting.",
      points: ["Throughput over time", "Reopen and escape rates", "SLA breach counters"],
    },
    ar: {
      title: "التحليلات",
      summary: "اتجاهات وصحة الوحدات ومؤشرات SLA لمعرفة أين تتراجع الجودة.",
      points: ["معدل الإنجاز عبر الزمن", "نسب إعادة الفتح والتسريب", "عدّادات تجاوز SLA"],
    },
  },
  {
    id: "reports",
    to: "/reports",
    glyph: "bars",
    group: "insight",
    en: {
      title: "Reports",
      summary: "Printable and exportable summaries, plus manual SLA breach scans.",
      points: ["Excel and CSV export", "Print-friendly layout", "Trigger the SLA scan on demand"],
    },
    ar: {
      title: "التقارير",
      summary: "ملخصات قابلة للطباعة والتصدير، مع فحص يدوي لتجاوزات SLA.",
      points: ["تصدير Excel و CSV", "تنسيق مناسب للطباعة", "تشغيل فحص SLA عند الطلب"],
    },
  },
  {
    id: "compare",
    to: "/compare",
    glyph: "flow",
    group: "insight",
    en: {
      title: "Compare Excel",
      summary: "Diff two exported sheets to spot new, changed or missing error rows before importing.",
      points: ["Row-level differences", "Highlights duplicates", "Safe pre-import check"],
    },
    ar: {
      title: "مقارنة Excel",
      summary: "مقارنة ملفين مُصدّرين لاكتشاف السجلات الجديدة أو المتغيرة أو الناقصة قبل الاستيراد.",
      points: ["فروق على مستوى الصفوف", "إبراز التكرارات", "تحقق آمن قبل الاستيراد"],
    },
  },
  {
    id: "pomodoro",
    to: "/pomodoro",
    glyph: "orbit",
    group: "collaboration",
    en: {
      title: "Pomodoro Focus",
      summary: "Developer focus timer with session tasks, ambient sound, themes and 7-day performance.",
      points: ["Developers and admins only", "Voice input for session tasks", "CSV export of sessions"],
    },
    ar: {
      title: "بومودورو للتركيز",
      summary: "مؤقّت تركيز للمطورين مع مهام الجلسة والأصوات المحيطة والثيمات وأداء 7 أيام.",
      points: ["مخصص للمطورين والأدمن", "إدخال صوتي لمهام الجلسة", "تصدير الجلسات CSV"],
    },
  },
  {
    id: "notifications",
    to: "/notifications",
    glyph: "pulse",
    group: "collaboration",
    en: {
      title: "Notifications",
      summary: "Assignment, mention and SLA alerts in-app, with optional push delivery.",
      points: ["Realtime inbox", "Unread badge in the sidebar", "Push notifications when enabled"],
    },
    ar: {
      title: "الإشعارات",
      summary: "تنبيهات الإسناد والمنشن وتجاوز SLA داخل التطبيق، مع إمكانية الإشعارات الفورية.",
      points: ["صندوق لحظي", "شارة غير المقروء في الشريط الجانبي", "إشعارات Push عند التفعيل"],
    },
  },
  {
    id: "users",
    to: "/users",
    glyph: "grid",
    group: "admin",
    en: {
      title: "User Management",
      summary: "Admin console for accounts, roles, activation and bulk import/export of users.",
      points: ["Roles: admin, developer, tester, supervisor, auditor, monitor", "Activate or deactivate accounts", "Import and export the user list"],
    },
    ar: {
      title: "إدارة المستخدمين",
      summary: "لوحة الأدمن للحسابات والأدوار والتنشيط والاستيراد والتصدير الجماعي.",
      points: ["الأدوار: أدمن، مطور، مختبر، مشرف، مدقق، مراقب", "تنشيط أو تعطيل الحسابات", "استيراد وتصدير قائمة المستخدمين"],
    },
  },
  {
    id: "settings",
    to: "/settings",
    glyph: "orbit",
    group: "admin",
    en: {
      title: "Settings & Integrations",
      summary: "Personal preferences plus admin integrations: Slack, GitHub, AI provider and push keys.",
      points: ["Avatar and language", "Slack and GitHub wiring", "AI provider selection"],
    },
    ar: {
      title: "الإعدادات والتكاملات",
      summary: "التفضيلات الشخصية وتكاملات الأدمن: Slack و GitHub ومزوّد الذكاء الاصطناعي ومفاتيح الإشعارات.",
      points: ["الصورة الشخصية واللغة", "ربط Slack و GitHub", "اختيار مزوّد الذكاء الاصطناعي"],
    },
  },
];
