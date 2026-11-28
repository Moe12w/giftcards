// web/lib/i18n/integrations.ts
// Copy for the public /plug-in-integrations page.
//
// Keep the language honest: the gateway and redemption lifecycle are built,
// but no third-party platform connector is live. Platform names are targets,
// not claims of an existing integration.

import type { Copy } from './index';

const en = {
  meta: {
    title: 'Plug in integrations | Tazella',
    description:
      'Use Tazella gift cards as a payment method inside delivery, marketplace and POS apps. One marketplace, one ledger, one verified business identity.',
    ogTitle: 'Plug Tazella gift cards into the apps people use',
    ogDescription:
      'A universal gift-card payment integration network built on the Tazella marketplace: verify, preview, reserve, capture and refund — with money decided on the server.',
  },
  hero: {
    eyebrow: 'Tazella for platforms',
    title: 'Plug in integrations',
    lede:
      'Make Tazella gift cards a payment method inside the apps your customers already use. One verified business identity, one balance ledger and one redemption history — wherever the card is spent.',
    primaryCta: 'Talk to our team',
    secondaryCta: 'See how it works',
    trustOne: 'One source of truth',
    trustTwo: 'Backend-authorised',
    trustThree: 'Sandbox first',
    statusNote:
      'Early infrastructure. WordPress/WooCommerce can be tested in sandbox today; marketplace connections need official documentation, credentials and written approval.',
  },
  value: {
    eyebrow: 'Why plug in',
    title: 'One gift card, usable beyond our own app.',
    body:
      'The marketplace stays the source of truth. External platforms ask Tazella to check a card and move value; they never hold a balance of their own.',
    cards: [
      {
        title: 'For customers',
        body:
          'Pay with a gift card at an external checkout instead of opening another app or typing a code by hand.',
      },
      {
        title: 'For platforms',
        body:
          'Add a local gift-card payment method through one documented API: validate, preview, reserve, capture and refund.',
      },
      {
        title: 'For businesses',
        body:
          'Your external store identity is mapped to your Tazella business and verified before it can accept a card.',
      },
      {
        title: 'For finance',
        body:
          'Every redemption and reversal lands in the same ledger and redemption history used by the marketplace today.',
      },
    ],
  },
  flow: {
    eyebrow: 'Payment lifecycle',
    title: 'Five steps, one authoritative decision-maker.',
    body:
      'The platform can request an operation. Tazella alone decides whether the card is valid, who owns it, how much is available and when value moves.',
    steps: [
      {
        title: 'Map and verify',
        body:
          'An external store or branch is linked to a Tazella business and verified. An ID typed by a user is never proof of ownership.',
      },
      {
        title: 'Validate and preview',
        body:
          'Read-only checks return a masked card, currency and available balance. No hold is created and no money moves.',
      },
      {
        title: 'Reserve',
        body:
          'A short-lived hold locks the eligible amount. The ledger is untouched, and the hold expires if checkout stalls.',
      },
      {
        title: 'Capture or release',
        body:
          'Capture writes the redemption and ledger entry. Release cancels the hold without writing any ledger entry.',
      },
      {
        title: 'Refund or reconcile',
        body:
          'A reversal is an audited, idempotent ledger entry. Uncertain payment states become a reconciliation case, never a guess.',
      },
    ],
    note:
      'An external redemption is never a purchase: it creates no order, no invoice and no fulfilment in the marketplace.',
  },
  platforms: {
    eyebrow: 'Platform status',
    title: 'Honest status, not a checkbox.',
    body:
      'Capabilities are tracked separately for each platform. A name on this page is a target for integration, not a live connection.',
    statusReview: 'Under review · not live',
    statusInternal: 'Internal testing only',
    statusWordpress: 'Sandbox available',
    disclaimer:
      'We do not claim access to a platform API until the platform has provided official documentation, credentials and written approval. No platform restriction is bypassed.',
    items: [
      {
        name: 'Snoonu',
        status: 'review',
        body: 'Capability review open. No card acceptance is enabled.',
      },
      {
        name: 'Talabat',
        status: 'review',
        body: 'Capability review open. No card acceptance is enabled.',
      },
      {
        name: 'Keeta',
        status: 'review',
        body: 'Capability review open. No card acceptance is enabled.',
      },
      {
        name: 'WordPress / WooCommerce',
        status: 'wordpress',
        body: 'Early plugin available in sandbox. Store identity comes from your key, not from a field you have to fill in.',
      },
      {
        name: 'Internal test platform',
        status: 'internal',
        body: 'Sandbox-only lifecycle testing against the same gateway.',
      },
    ],
  },
  wordpress: {
    eyebrow: 'For WordPress',
    title: 'Drop it into WooCommerce.',
    body:
      'Generate a key in your vendor dashboard, paste it into the plugin, and the gift-card method appears at checkout.',
    steps: [
      {
        title: 'Get your key',
        body:
          'In the vendor dashboard open Settings → WordPress payment keys and create a sandbox key. It is shown once.',
      },
      {
        title: 'Install the plugin',
        body:
          'Upload the Tazella Gift Cards ZIP in WordPress, activate it, then paste the API key and signing secret into the payment settings.',
      },
      {
        title: 'Take payments',
        body:
          'Works with classic shortcode checkout and WooCommerce Blocks. The card must match the store currency; no conversion is performed.',
      },
    ],
    downloadTitle: 'Download the plugin',
    downloadBody:
      'The installable ZIP is built from the same source as the gateway. Version {version}. Upload it to WordPress as-is — do not unzip it first.',
    downloadCta: 'Download plugin (ZIP)',
    downloadNote:
      'The connection check on the payment settings page must read “Connection verified” before you enable the method.',
    requirementsTitle: 'Before you start',
    requirements: [
      'WordPress 6.4 or newer with WooCommerce 8.0 or newer active.',
      'PHP 7.4 or newer, and HTTPS on the store domain.',
      'A verified store mapping in Tazella. A key is issued for exactly one mapping.',
      'Store currency equal to the currency configured in the plugin. No conversion is performed.',
    ],
    installTitle: 'Install in five steps',
    installSteps: [
      'Download the ZIP above and keep it zipped.',
      'In WordPress open Plugins → Add New → Upload Plugin, choose the ZIP, then Install Now.',
      'Activate “Tazella Gift Cards”.',
      'Open WooCommerce → Settings → Payments → Tazella gift cards, paste the API key and signing secret, and pick the environment the key was issued for.',
      'Save the settings. Confirm the connection check passes, enable the method, and place a sandbox order.',
    ],
    keysCta: 'Open WordPress payment keys',
    note:
      'This is an early plugin. Run it in sandbox first; production access requires verification and a production key.',
  },
  api: {
    eyebrow: 'For developers',
    title: 'The integration surface at a glance.',
    body:
      'A small, explicit API. Every money-moving call is authenticated, signed, rate-limited and idempotent.',
    headersTitle: 'Request headers',
    headers: [
      { name: 'Authorization', body: 'Bearer platform API key, stored server-side as a hash.' },
      { name: 'X-Timestamp / X-Signature', body: 'HMAC-SHA256 over the timestamp and raw body.' },
      { name: 'X-Idempotency-Key', body: 'Required on every money-moving operation.' },
    ],
    headersNote:
      'Platform, environment and store are derived from the key. Optional matching headers are accepted for platform-level connectors.',
    endpointsTitle: 'Operations',
    endpoints: [
      { method: 'GET', path: '/health', body: 'Credential and platform status.' },
      { method: 'POST', path: '/gift-cards/validate', body: 'Read-only card and merchant check.' },
      { method: 'POST', path: '/gift-cards/preview', body: 'Read-only eligible amount.' },
      { method: 'POST', path: '/reservations', body: 'Create a short-lived hold.' },
      { method: 'GET', path: '/reservations/{reference}', body: 'Reservation state.' },
      { method: 'POST', path: '/reservations/{reference}/capture', body: 'Finalise the redemption.' },
      { method: 'POST', path: '/reservations/{reference}/release', body: 'Cancel a hold.' },
      { method: 'POST', path: '/redemptions/{id}/refund', body: 'Audited reversal.' },
      { method: 'POST', path: '/orders/events', body: 'Verified platform order event.' },
    ],
    note:
      'The public API is under `/api/integrations/v1/`. Credentials and signing secrets are issued by Tazella; the checkout component never holds them.',
    idempotency:
      'Repeating a request with the same idempotency key returns the original response. Reusing a key with different content is rejected.',
    environments:
      'Sandbox and production are separate credential environments. Sandbox tests never touch production data.',
  },
  trust: {
    eyebrow: 'Safety by design',
    title: 'What the integration cannot do.',
    body: 'The same rules that protect the marketplace apply when a card is spent outside it.',
    bullets: [
      'No second balance store, ledger, business identity system or login.',
      'No money decision in the browser or in the checkout component.',
      'No full card code, buyer identity or internal voucher ID returned to a platform.',
      'No silent currency conversion, and no capture above the reserved amount.',
      'No release of a captured payment; uncertainty goes to reconciliation.',
      'No secret in client-side code, analytics or request logs.',
    ],
  },
  faq: {
    eyebrow: 'Questions',
    title: 'Good to know.',
    items: [
      {
        q: 'Can I use my Tazella card on Snoonu, Talabat or Keeta today?',
        a: 'Not yet. Those platforms are targets for integration. A connection only becomes live after official platform approval, credentials and verified merchant mapping. This page will not claim otherwise.',
      },
      {
        q: 'Does this create another gift-card system?',
        a: 'No. External payments write to the same vouchers, ledger entries and redemption history as in-app redemptions. The marketplace remains the single source of truth.',
      },
      {
        q: 'Does a platform get the full card number?',
        a: 'No. Platforms receive a masked card and only the information needed to complete a payment. The backend resolves the business and balance itself.',
      },
      {
        q: 'What happens if a payment is uncertain?',
        a: 'The reservation moves to a reconciliation case. Tazella does not guess, release captured value or duplicate a deduction.',
      },
      {
        q: 'Can I use this on my WordPress or WooCommerce store?',
        a: 'Yes, in sandbox. The WooCommerce plugin supports classic and block checkout. Generate a key in your vendor dashboard, paste the key and signing secret into the plugin, and everything else is derived from the key. It is not yet production-certified.',
      },
      {
        q: 'Where do I download the WordPress plugin?',
        a: 'From the WordPress section of this page. The ZIP is public and versioned. Upload it in Plugins → Add New → Upload Plugin. You still need a sandbox key from your vendor dashboard before the payment method appears at checkout.',
      },
      {
        q: 'How do I start an integration?',
        a: 'Contact our team with your platform, business and target go-live environment. We will review capabilities and issue sandbox credentials only where an integration is approved.',
      },
    ],
  },
  cta: {
    eyebrow: 'Let’s connect',
    title: 'Build the next place your gift card works.',
    body:
      'Tell us where your customers pay. We will review the platform capabilities and, where approved, issue sandbox credentials for the full lifecycle.',
    primary: 'Contact the team',
    secondary: 'Become a vendor',
  },
  dashboard: {
    eyebrow: 'Integrations',
    title: 'WordPress payment keys',
    description:
      'Each key belongs to one verified store mapping and can only redeem that business’s cards.',
    noMapping:
      'No verified store mapping yet. Contact Tazella to connect your WordPress site before generating a key.',
    mapping: 'Verified store',
    status: 'Status',
    credentials: 'Keys',
    noCredentials: 'No keys have been issued yet.',
    generate: 'Generate a key',
    environment: 'Environment',
    sandbox: 'Sandbox',
    production: 'Production',
    label: 'Label',
    labelPlaceholder: 'My WordPress site',
    create: 'Create key',
    shownOnce: 'Copy these now. They are shown only once.',
    apiKey: 'API key',
    signingSecret: 'Signing secret',
    warning: 'Store them in the WordPress plugin settings. Never paste them into customer-facing code.',
    revoke: 'Revoke',
    active: 'Active',
    revoked: 'Revoked',
    lastUsed: 'Last used',
    never: 'Never',
    needPermission: 'Only owners and managers can manage keys.',
  },
};

const ar: typeof en = {
  meta: {
    title: 'ربط التكاملات | تازيلا',
    description:
      'استخدم بطاقات هدايا تازيلا كوسيلة دفع داخل تطبيقات التوصيل والأسواق ونقاط البيع. سوق واحد، دفتر أستاذ واحد، وهوية عمل مؤكدة واحدة.',
    ogTitle: 'اربط بطاقات هدايا تازيلا بالتطبيقات التي يستخدمها الناس',
    ogDescription:
      'شبكة تكامل دفع ببطاقات الهدايا مبنية على سوق تازيلا: تحقق، معاينة، حجز، تحصيل واسترداد — مع قرار مالي تتخذه الخوادم وحدها.',
  },
  hero: {
    eyebrow: 'تازيلا للمنصات',
    title: 'ربط التكاملات',
    lede:
      'اجعل بطاقات هدايا تازيلا وسيلة دفع داخل التطبيقات التي يستخدمها عملاؤك بالفعل. هوية عمل مؤكدة واحدة، دفتر أستاذ واحد، وسجل استرداد واحد — أينما أُنفقت البطاقة.',
    primaryCta: 'تحدث مع فريقنا',
    secondaryCta: 'شاهد كيف تعمل',
    trustOne: 'مصدر واحد للحقيقة',
    trustTwo: 'قرار من الخادم',
    trustThree: 'بيئة تجريبية أولاً',
    statusNote:
      'بنية تحتية في مرحلة مبكرة. يمكن اختبار ووردبريس/WooCommerce في البيئة التجريبية اليوم؛ أما ربط المنصات الأخرى فيتطلب توثيقاً رسمياً وبيانات دخول وموافقة كتابية.',
  },
  value: {
    eyebrow: 'لماذا نربط',
    title: 'بطاقة هدية واحدة، خارج تطبيقنا أيضاً.',
    body:
      'يظل السوق هو مصدر الحقيقة. تطلب المنصات الخارجية من تازيلا التحقق من البطاقة وتحويل القيمة، ولا تحتفظ برصيد خاص بها.',
    cards: [
      {
        title: 'للعملاء',
        body: 'ادفع ببطاقة هدية عند إتمام الطلب خارج التطبيق، دون فتح تطبيق آخر أو إدخال الرمز يدوياً.',
      },
      {
        title: 'للمنصات',
        body: 'أضف وسيلة دفع محلية ببطاقات الهدايا عبر واجهة موثقة: تحقق، معاينة، حجز، تحصيل واسترداد.',
      },
      {
        title: 'للأنشطة التجارية',
        body: 'يُربط معرف متجرك الخارجي بنشاطك في تازيلا ويُتحقق منه قبل قبول أي بطاقة.',
      },
      {
        title: 'للشؤون المالية',
        body: 'كل استرداد أو إلغاء يُسجّل في دفتر الأستاذ وسجل الاسترداد نفسيهما اللذين يستخدمهما السوق اليوم.',
      },
    ],
  },
  flow: {
    eyebrow: 'دورة الدفع',
    title: 'خمس خطوات، وصانع قرار واحد.',
    body:
      'يمكن للمنصة طلب العملية، لكن تازيلا وحدها تقرر صحة البطاقة ومالكها والمتوفر منها ومتى تُحوّل القيمة.',
    steps: [
      {
        title: 'الربط والتحقق',
        body: 'يُربط المتجر أو الفرع الخارجي بنشاط تازيلا ويُتحقق منه. المعرف الذي يُدخله المستخدم ليس دليلاً على الملكية.',
      },
      {
        title: 'التحقق والمعاينة',
        body: 'فحوصات للقراءة فقط تعرض بطاقة مقنّعة والعملة والرصيد المتاح. لا يُنشأ حجز ولا تُحوّل أموال.',
      },
      {
        title: 'الحجز',
        body: 'يُثبّت حجز قصير الأمد المبلغ المؤهل. دفتر الأستاذ لا يتغير، وينتهي الحجز إذا توقف إتمام الطلب.',
      },
      {
        title: 'التحصيل أو الإلغاء',
        body: 'التحصيل يسجّل الاسترداد والقيد في دفتر الأستاذ. الإلغاء يفك الحجز دون أي قيد مالي.',
      },
      {
        title: 'الاسترداد أو التسوية',
        body: 'الإلغاء المالي قيد موثق وخاضع للمطابقة. حالات الدفع غير المؤكدة تتحول إلى ملف تسوية، لا إلى تخمين.',
      },
    ],
    note: 'الاسترداد الخارجي ليس عملية شراء: لا ينشئ طلباً ولا فاتورة ولا أي تنفيذ داخل السوق.',
  },
  platforms: {
    eyebrow: 'حالة المنصات',
    title: 'حالة صادقة، وليس مربع اختيار.',
    body: 'تُتابع القدرات لكل منصة على حدة. ذكر المنصة هنا هدف للتكامل، وليس رابطاً نشطاً.',
    statusReview: 'قيد المراجعة · غير مفعّل',
    statusInternal: 'اختبار داخلي فقط',
    statusWordpress: 'متاح تجريبياً',
    disclaimer:
      'لا ندّعي الوصول إلى واجهة أي منصة قبل أن توفر توثيقاً رسمياً وبيانات دخول وموافقة كتابية. لا يتم تجاوز أي قيد من قيود المنصات.',
    items: [
      { name: 'Snoonu', status: 'review', body: 'مراجعة القدرات مفتوحة. لا يوجد قبول للبطاقات بعد.' },
      { name: 'Talabat', status: 'review', body: 'مراجعة القدرات مفتوحة. لا يوجد قبول للبطاقات بعد.' },
      { name: 'Keeta', status: 'review', body: 'مراجعة القدرات مفتوحة. لا يوجد قبول للبطاقات بعد.' },
      { name: 'WordPress / WooCommerce', status: 'wordpress', body: 'إضافة مبكرة متاحة في البيئة التجريبية. هوية المتجر تأتي من المفتاح، لا من حقل تملؤه بنفسك.' },
      { name: 'منصة الاختبار الداخلية', status: 'internal', body: 'اختبار دورة كاملة في بيئة تجريبية عبر البوابة نفسها.' },
    ],
  },
  wordpress: {
    eyebrow: 'لووردبريس',
    title: 'أضفه إلى WooCommerce.',
    body: 'أنشئ مفتاحاً من لوحة البائع، الصقه في الإضافة، وستظهر وسيلة الدفع ببطاقة الهدايا عند إتمام الطلب.',
    steps: [
      { title: 'احصل على المفتاح', body: 'في لوحة البائع افتح الإعدادات ← مفاتيح دفع ووردبريس وأنشئ مفتاحاً تجريبياً. يظهر مرة واحدة فقط.' },
      { title: 'ثبّت الإضافة', body: 'ارفع ملف Tazella Gift Cards ZIP في ووردبريس، فعّله، ثم الصق مفتاح الواجهة وسر التوقيع في إعدادات الدفع.' },
      { title: 'استقبل المدفوعات', body: 'يعمل مع إتمام الطلب التقليدي وكتل WooCommerce. يجب أن تطابق البطاقة عملة المتجر؛ ولا يتم أي تحويل عملة.' },
    ],
    downloadTitle: 'حمّل الإضافة',
    downloadBody:
      'ملف ZIP القابل للتركيب مبني من المصدر نفسه المستخدم في البوابة. الإصدار {version}. ارفعه إلى ووردبريس كما هو — دون فك الضغط أولاً.',
    downloadCta: 'تحميل الإضافة (ZIP)',
    downloadNote:
      'يجب أن يظهر «تم التحقق من الاتصال» في صفحة إعدادات الدفع قبل تفعيل وسيلة الدفع.',
    requirementsTitle: 'قبل أن تبدأ',
    requirements: [
      'ووردبريس 6.4 أو أحدث مع WooCommerce 8.0 أو أحدث مفعّل.',
      'PHP 7.4 أو أحدث، وHTTPS على نطاق المتجر.',
      'ربط متجر مؤكد في تازيلا. يُصدر المفتاح لربط واحد فقط.',
      'عملة المتجر مطابقة للعملة المضبوطة في الإضافة. لا يتم أي تحويل.',
    ],
    installTitle: 'التثبيت في خمس خطوات',
    installSteps: [
      'حمّل ملف ZIP أعلاه واتركه مضغوطاً.',
      'في ووردبريس افتح إضافات ← أضف جديداً ← رفع إضافة، اختر الملف ثم «ثبّت الآن».',
      'فعّل «Tazella Gift Cards».',
      'افتح WooCommerce ← الإعدادات ← الدفع ← Tazella gift cards، والصق مفتاح الواجهة وسر التوقيع، واختر البيئة التي أُصدر لها المفتاح.',
      'احفظ الإعدادات. تأكد من نجاح فحص الاتصال، ثم فعّل وسيلة الدفع ونفّذ طلباً تجريبياً.',
    ],
    keysCta: 'افتح مفاتيح دفع ووردبريس',
    note: 'هذه إضافة مبكرة. اختبرها أولاً في البيئة التجريبية؛ الوصول للإنتاج يتطلب التحقق ومفتاح إنتاج.',
  },
  api: {
    eyebrow: 'للمطورين',
    title: 'لمحة عن واجهة التكامل.',
    body: 'واجهة صغيرة وواضحة. كل عملية تحوّل أموالاً موثقة وموقّعة ومحددة المعدل وخاضعة للمطابقة.',
    headersTitle: 'ترويسات الطلب',
    headers: [
      { name: 'Authorization', body: 'مفتاح منصة يحمله الرابط، ويُخزّن كتجزئة على الخادم.' },
      { name: 'X-Timestamp / X-Signature', body: 'توقيع HMAC-SHA256 على الطابع الزمني وجسم الطلب.' },
      { name: 'X-Idempotency-Key', body: 'مطلوب في كل عملية تحوّل أموالاً.' },
    ],
    headersNote: 'المنصة والبيئة والمتجر تُستمد من المفتاح. تُقبل ترويسات مطابقة اختيارية لتكاملات مستوى المنصة.',
    endpointsTitle: 'العمليات',
    endpoints: [
      { method: 'GET', path: '/health', body: 'حالة بيانات الدخول والمنصة.' },
      { method: 'POST', path: '/gift-cards/validate', body: 'فحص للقراءة فقط للبطاقة والتاجر.' },
      { method: 'POST', path: '/gift-cards/preview', body: 'المبلغ المؤهل للقراءة فقط.' },
      { method: 'POST', path: '/reservations', body: 'إنشاء حجز قصير الأمد.' },
      { method: 'GET', path: '/reservations/{reference}', body: 'حالة الحجز.' },
      { method: 'POST', path: '/reservations/{reference}/capture', body: 'إتمام الاسترداد.' },
      { method: 'POST', path: '/reservations/{reference}/release', body: 'إلغاء الحجز.' },
      { method: 'POST', path: '/redemptions/{id}/refund', body: 'إلغاء مالي موثق.' },
      { method: 'POST', path: '/orders/events', body: 'حدث طلب موثق من المنصة.' },
    ],
    note: 'الواجهة العامة تحت `/api/integrations/v1/`. بيانات الدخول وأسرار التوقيع تصدرها تازيلا، ولا يحملها مكوّن إتمام الطلب.',
    idempotency: 'إعادة الطلب بالمفتاح نفسه تُعيد الاستجابة الأصلية. إعادة استخدام المفتاح بمحتوى مختلف تُرفض.',
    environments: 'بيئتا sandbox وproduction منفصلتان. اختبارات البيئة التجريبية لا تمس بيانات الإنتاج.',
  },
  trust: {
    eyebrow: 'الأمان بالتصميم',
    title: 'ما لا يستطيع التكامل فعله.',
    body: 'القواعد نفسها التي تحمي السوق تسري عند إنفاق البطاقة خارجه.',
    bullets: [
      'لا رصيد إضافي ولا دفتر أستاذ ولا نظام هوية ولا دخول منفصل.',
      'لا قرار مالي في المتصفح أو في مكوّن إتمام الطلب.',
      'لا رقم بطاقة كامل ولا هوية المشتري ولا معرف بطاقة داخلي للمنصة.',
      'لا تحويل عملة ضمني، ولا تحصيل فوق المبلغ المحجوز.',
      'لا إلغاء لدفع مُحصّل؛ أي عدم يقين يذهب إلى التسوية.',
      'لا أسرار في كود العميل ولا في التحليلات ولا في سجلات الطلبات.',
    ],
  },
  faq: {
    eyebrow: 'أسئلة',
    title: 'ما تحتاج معرفته.',
    items: [
      {
        q: 'هل أستطيع استخدام بطاقة تازيلا على Snoonu أو Talabat أو Keeta اليوم؟',
        a: 'ليس بعد. هذه المنصات أهداف للتكامل. لا يُفعّل الربط إلا بعد موافقة رسمية من المنصة وبيانات دخول وربط تاجر مؤكد. لن تدّعي هذه الصفحة غير ذلك.',
      },
      {
        q: 'هل ينشئ هذا نظام بطاقات هدايا آخر؟',
        a: 'لا. عمليات الدفع الخارجية تكتب في البطاقات وقيود دفتر الأستاذ وسجل الاسترداد نفسها المستخدمة داخل التطبيق. السوق هو مصدر الحقيقة الوحيد.',
      },
      {
        q: 'هل تحصل المنصة على رقم البطاقة كاملاً؟',
        a: 'لا. تحصل على بطاقة مقنّعة فقط وعلى المعلومات اللازمة لإتمام الدفع. يتحقق الخادم من التاجر والرصيد بنفسه.',
      },
      {
        q: 'ماذا يحدث إذا كان الدفع غير مؤكد؟',
        a: 'ينتقل الحجز إلى ملف تسوية. لا تخمّن تازيلا، ولا تُطلق قيمة مُحصّلة، ولا تكرر الخصم.',
      },
      {
        q: 'هل أستطيع استخدام هذا على متجري ووردبريس أو WooCommerce؟',
        a: 'نعم، في البيئة التجريبية. تدعم إضافة WooCommerce إتمام الطلب التقليدي وكتل WooCommerce. أنشئ مفتاحاً من لوحة البائع، الصق المفتاح وسر التوقيع في الإضافة، وكل شيء آخر يُستمد من المفتاح. لم تُعتمد للإنتاج بعد.',
      },
      {
        q: 'من أين أحمّل إضافة ووردبريس؟',
        a: 'من قسم ووردبريس في هذه الصفحة. ملف ZIP متاح للعموم ومُصدّر بإصدار. ارفعه من إضافات ← أضف جديداً ← رفع إضافة. ما زلت تحتاج مفتاحاً تجريبياً من لوحة البائع قبل ظهور وسيلة الدفع عند إتمام الطلب.',
      },
      {
        q: 'كيف أبدأ التكامل؟',
        a: 'تواصل مع فريقنا واذكر المنصة والنشاط التجاري والبيئة المستهدفة. سنراجع القدرات ونصدر بيانات الدخول التجريبية حيث يُوافق على التكامل.',
      },
    ],
  },
  cta: {
    eyebrow: 'لنربط',
    title: 'ابنِ المكان التالي الذي تعمل فيه بطاقتك.',
    body: 'أخبرنا أين يدفع عملاؤك. سنراجع قدرات المنصة ونصدر، حيث يُوافق على التكامل، بيانات دخول تجريبية لدورة كاملة.',
    primary: 'تواصل مع الفريق',
    secondary: 'سجّل متجرك',
  },
  dashboard: {
    eyebrow: 'التكاملات',
    title: 'مفاتيح دفع ووردبريس',
    description: 'كل مفتاح يخص ربط متجر مؤكد واحد، ولا يمكنه استرداد بطاقات نشاط تجاري آخر.',
    noMapping: 'لا يوجد ربط متجر مؤكد بعد. تواصل مع تازيلا لربط موقع ووردبريس قبل إنشاء مفتاح.',
    mapping: 'المتجر المؤكد',
    status: 'الحالة',
    credentials: 'المفاتيح',
    noCredentials: 'لم تُصدر أي مفاتيح بعد.',
    generate: 'إنشاء مفتاح',
    environment: 'البيئة',
    sandbox: 'تجريبي',
    production: 'إنتاج',
    label: 'الاسم',
    labelPlaceholder: 'موقعي على ووردبريس',
    create: 'إنشاء',
    shownOnce: 'انسخ هذه القيم الآن. تظهر مرة واحدة فقط.',
    apiKey: 'مفتاح الواجهة',
    signingSecret: 'سر التوقيع',
    warning: 'احفظهما في إعدادات إضافة ووردبريس. لا تضعهما أبداً في كود يراه العملاء.',
    revoke: 'إلغاء',
    active: 'نشط',
    revoked: 'ملغي',
    lastUsed: 'آخر استخدام',
    never: 'لم يُستخدم',
    needPermission: 'المالكون والمدراء فقط هم من يديرون المفاتيح.',
  },
};

export const integrationsCopy: Copy<typeof en> = { en, ar };
