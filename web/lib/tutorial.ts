/**
 * The dashboard walkthrough.
 *
 * Each portal gets its own script because the work is different: a vendor
 * publishes and redeems, an enterprise partner imports codes, an admin
 * reviews and moderates. Every script follows the same life cycle:
 *
 *   set up -> create the gift -> sell -> issue -> claim -> redeem -> report
 */

export type TutorialArt =
  | 'lifecycle'
  | 'types'
  | 'create'
  | 'packages'
  | 'publish'
  | 'sell'
  | 'issue'
  | 'claim'
  | 'redeem'
  | 'ledger'
  | 'import'
  | 'reconcile'
  | 'approve'
  | 'moderate'
  | 'support'
  | 'report';

export interface TutorialStep {
  id: string;
  art: TutorialArt;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  tip?: string;
  tipAr?: string;
  /** Where this step happens, so the reader can jump straight to it. */
  href?: string;
}

export interface TutorialScript {
  id: 'vendor' | 'enterprise' | 'admin';
  title: string;
  titleAr: string;
  intro: string;
  introAr: string;
  steps: TutorialStep[];
}

const TYPES_STEP = (href: string): TutorialStep => ({
  id: 'types',
  art: 'types',
  title: 'Three kinds of gift, three different jobs',
  titleAr: 'ثلاثة أنواع من الهدايا، وثلاثة أعمال مختلفة',
  body:
    'A gift card holds money, an experience holds booked sessions, and a corporate code holds a pre-paid balance from a partner. Pick the one that matches what you actually sell — the customer sees a different flow for each.',
  bodyAr:
    'بطاقة الهدية تحتفظ بالمال، والتجربة تحتفظ بجلسات محجوزة، والرمز المؤسسي يحتفظ برصيد مدفوع مسبقاً من شريك. اختر النوع الذي يطابق ما تبيعه فعلاً، فكل نوع له رحلة مختلفة أمام العميل.',
  tip: 'Money can be spent in parts. Experience sessions are counted. Corporate codes are allocated from an inventory you import.',
  tipAr:
    'يمكن إنفاق المال على دفعات، بينما تُحسب جلسات التجربة، أما الرموز المؤسسية فتُخصم من مخزون تستورده.',
  href,
});

export const VENDOR_SCRIPT: TutorialScript = {
  id: 'vendor',
  title: 'How Giftly works for a vendor',
  titleAr: 'كيف تعمل جيفتلي لصاحب المتجر',
  intro:
    'Seven minutes, and you will know the whole journey of a gift: how you publish it, how it is sold, how it reaches the person, and how you get paid for redeeming it.',
  introAr:
    'سبع دقائق فقط، وستعرف رحلة الهدية كاملة: كيف تنشرها، وكيف تُباع، وكيف تصل إلى الشخص، وكيف تستحق مقابل الاستبدال.',
  steps: [
    {
      id: 'lifecycle',
      art: 'lifecycle',
      title: 'The journey of one gift',
      titleAr: 'رحلة هدية واحدة',
      body:
        'A gift is created by a vendor, bought by a customer, issued as a code, claimed by the recipient, and redeemed at the counter. Every screen in this dashboard belongs to one of those five moments.',
      bodyAr:
        'ينشئ صاحب المتجر الهدية، ويشتريها العميل، وتصدر برمزاً، ويطالب به المستلم، ويُستبدل عند الكاونتر. كل شاشة في هذه اللوحة تنتمي إلى إحدى هذه اللحظات الخمس.',
      tip: 'If you are ever unsure where something belongs, follow the arrows.',
      tipAr: 'إذا ترددت في مكان أي عنصر، اتبع الأسهم.',
      href: '/vendor',
    },
    TYPES_STEP('/vendor/products/new'),
    {
      id: 'create',
      art: 'create',
      title: 'Create the gift',
      titleAr: 'أنشئ الهدية',
      body:
        'On the products page, a new gift asks for a title, a category and how it is fulfilled. Fill in what you sell, add a photo and a description, then save it as a draft so you can check it before customers see it.',
      bodyAr:
        'في صفحة المنتجات، تطلب الهدية الجديدة عنواناً وفئة وطريقة التنفيذ. أدخل ما تبيعه، وأضف صورة ووصفاً، ثم احفظها كمسودة لتتحقق منها قبل أن يراها العملاء.',
      tip: 'Drafts are private. Nothing appears in the app until you publish.',
      tipAr: 'المسودات خاصة، ولا يظهر شيء في التطبيق حتى تنشر.',
      href: '/vendor/products/new',
    },
    {
      id: 'packages',
      art: 'packages',
      title: 'Money or packages, never both',
      titleAr: 'مال أو باقات، ولا يجمعان',
      body:
        'A money gift lets the customer choose an amount inside a range you set. An experience gift has fixed packages you define yourself, for example three sessions or a two-person trip. The customer never sets the price of a package.',
      bodyAr:
        'هدية المال تتيح للعميل اختيار مبلغ ضمن نطاق تحدده أنت. أما هدية التجربة فلها باقات ثابتة تعرّفها أنت، مثل ثلاث جلسات أو رحلة لشخصين. العميل لا يحدد سعر الباقة أبداً.',
      tip: 'Set the smallest sensible amount for money gifts, and keep package names short and concrete.',
      tipAr: 'ضع أصغر مبلغ معقول لهدايا المال، واجعل أسماء الباقات قصيرة وواضحة.',
      href: '/vendor/products',
    },
    {
      id: 'publish',
      art: 'publish',
      title: 'Publish it',
      titleAr: 'انشرها',
      body:
        'Publishing puts the gift on the marketplace and in the app. You can unpublish at any time by setting the gift back to draft, and archive it once you no longer sell it.',
      bodyAr:
        'النشر يضع الهدية في السوق وفي التطبيق. يمكنك إلغاء النشر في أي وقت بإعادة الهدية إلى المسودة، وأرشفتها عندما تتوقف عن بيعها.',
      href: '/vendor/products',
    },
    {
      id: 'sell',
      art: 'sell',
      title: 'Someone buys it',
      titleAr: 'يقوم أحدهم بالشراء',
      body:
        'When an order is paid, your dashboard shows the gift, the amount, the commission and your share. Nothing is owed to you yet: the money sits on the voucher until it is spent.',
      bodyAr:
        'عند دفع الطلب يظهر في لوحتك الهدية والمبلغ والعمولة وحصتك. لا يوجد مستحق لك بعد: يبقى المال على بطاقة الهدية حتى يُنفق.',
      href: '/vendor/orders',
    },
    {
      id: 'issue',
      art: 'issue',
      title: 'The code is issued and sent',
      titleAr: 'صدر الرمز وأُرسل',
      body:
        'Each paid gift becomes a voucher with its own code and balance. The customer chooses how to deliver it: email, SMS, a link, or straight to the recipient on WhatsApp from the app.',
      bodyAr:
        'كل هدية مدفوعة تصبح بطاقة برمزها ورصيدها. يختار العميل طريقة التسليم: بريد إلكتروني، أو رسالة نصية، أو رابط، أو مباشرة عبر واتساب من التطبيق.',
      href: '/vendor/vouchers',
    },
    {
      id: 'claim',
      art: 'claim',
      title: 'The recipient claims it',
      titleAr: 'يطالب به المستلم',
      body:
        'The recipient opens the message, signs in and claims the gift into their Giftly wallet. From then on the code is theirs, and the balance follows them.',
      bodyAr:
        'يفتح المستلم الرسالة، يسجّل الدخول، ويطالب بالهدية في محفظته. بعدها يصبح الرمز ملكه والرصيد يتابعه أينما ذهب.',
      href: '/vendor/vouchers',
    },
    {
      id: 'redeem',
      art: 'redeem',
      title: 'Redeeming at the counter',
      titleAr: 'الاستبدال عند الكاونتر',
      body:
        'At the till, scan the code or type it. The amount spent comes off the balance immediately, a redemption record is written, and the customer can come back and spend the rest.',
      bodyAr:
        'عند الصندوق، امسح الرمز أو اكتبه. يُخصم المبلغ من الرصيد فوراً، ويُسجَّل الاستبدال، ويمكن للعميل العودة وإنفاق الباقي.',
      tip: 'Redemption staff can do this. Only owners and managers can change prices, team roles or settings.',
      tipAr:
        'يستطيع موظفو الاستبدال تنفيذ هذه الخطوة، بينما 수정 الأسعار أو أدوار الفريق أو الإعدادات من صلاحية المالك والمدير فقط.',
      href: '/vendor/redeem',
    },
    {
      id: 'ledger',
      art: 'ledger',
      title: 'Balances, expiry and refunds',
      titleAr: 'الأرصدة والصلاحية والاسترجاع',
      body:
        'The balance on a voucher is the ledger. If a gift is refunded, void it here and the code stops working at the counter. Expired vouchers are marked for you, and you decide the validity window when you create the gift.',
      bodyAr:
        'رصيد البطاقة هو السجل نفسه. إذا استُرجعت هدية، ألغِها هنا فيتوقف الرمز عن العمل عند الكاونتر. وتُعلَّم البطاقات المنتهية صلاحيتها، وأنت تحدد مدة الصلاحية عند إنشاء الهدية.',
      href: '/vendor/vouchers',
    },
    {
      id: 'report',
      art: 'report',
      title: 'Report and get paid',
      titleAr: 'التقارير والمستحقات',
      body:
        'Analytics shows what sold, what is still unredeemed and how much is owed to you. The exposure limit in settings is the maximum unredeemed balance you are allowed to carry at one time.',
      bodyAr:
        'تعرض التحليلات ما بيع وما لم يُستبدل بعد وكم المستحق لك. أما حد التعرض في الإعدادات فهو أقصى رصيد غير مستبدل يُسمح لك بحمله في وقت واحد.',
      href: '/vendor/analytics',
    },
  ],
};

export const ENTERPRISE_SCRIPT: TutorialScript = {
  id: 'enterprise',
  title: 'How Giftly works for a partner',
  titleAr: 'كيف تعمل جيفتلي للشريك المؤسسي',
  intro:
    'You sell pre-paid codes to your own people. This guide covers the whole path: from defining your reward, to importing the codes, to seeing which ones were redeemed.',
  introAr:
    'تبيع رموزاً مدفوعة مسبقاً لفريقك. يشرح هذا الدليل المسار كاملاً: من تعريف المكافأة، إلى استيراد الرموز، إلى معرفة أيها استُبدل.',
  steps: [
    {
      id: 'lifecycle',
      art: 'lifecycle',
      title: 'The journey of one code',
      titleAr: 'رحلة رمز واحد',
      body:
        'You define a reward, import the codes your vendor issued, and each time somebody buys one the code leaves your inventory. When the vendor confirms a redemption, the code is closed.',
      bodyAr:
        'تعرّف مكافأة، وتستورد الرموز التي أصدرها شريكك، ومع كل عملية شراء يخرج رمز من مخزونك. وعندما يؤكد الشريك الاستبدال يُغلق الرمز.',
      href: '/enterprise',
    },
    {
      id: 'types',
      art: 'types',
      title: 'Why codes, not gift cards',
      titleAr: 'لماذا الرموز لا بطاقات الهدايا',
      body:
        'A corporate code is a pre-paid balance you bought in bulk. It is worth a fixed amount, it is encrypted in our database, and it is revealed to the person who receives it. Customers never choose the amount.',
      bodyAr:
        'الرمز المؤسسي هو رصيد مدفوع مسبقاً اشتريته بالجملة. له قيمة محددة، ومشفّر في قاعدة بياناتنا، ويُكشف لمن يستلمه. ولا يختار العميل المبلغ أبداً.',
      tip: 'Only the last four digits are visible in your dashboard, to everyone, including your team.',
      tipAr: 'لا يظهر في لوحتك سوى آخر أربعة أرقام، للجميع بما فيهم فريقك.',
      href: '/enterprise/products/new',
    },
    {
      id: 'setup',
      art: 'create',
      title: 'Set up the company',
      titleAr: 'جهّز بيانات الشركة',
      body:
        'Fill in the company profile so delivery messages and paperwork use the right name and contact. Your team members get their own login and role, so you can keep an eye on who imports codes.',
      bodyAr:
        'أكمل ملف الشركة حتى تستخدم رسائل التسليم والأوراق الاسم وجهات التواصل الصحيحة. ويحصل أعضاء فريقك على دخولهم ودورهم الخاص لمتابعة من يستورد الرموز.',
      href: '/enterprise/settings',
    },
    {
      id: 'product',
      art: 'create',
      title: 'Define the reward',
      titleAr: 'عرّف المكافأة',
      body:
        'A reward product holds the face value, your selling price and the commission for one code. The denomination here is the value every imported code will carry.',
      bodyAr:
        'منتج المكافأة يحمل قيمة الرمز وسعر البيع والعمولة. القيمة هنا هي ما سيحمله كل رمز مستورد.',
      href: '/enterprise/products',
    },
    {
      id: 'import',
      art: 'import',
      title: 'Import the codes',
      titleAr: 'استورد الرموز',
      body:
        'Paste your codes, one per line, against the right product. We check for duplicates, reject invalid rows, encrypt each code and keep only the last four digits readable.',
      bodyAr:
        'الصق رموزك، رمزاً في كل سطر، أمام المنتج الصحيح. نتحقق من التكرار، ونرفض الصفوف غير الصالحة، ونشفّر كل رمز ولا يبقى منه إلا آخر أربعة أرقام.',
      tip: 'Import in batches of a few thousand. Each batch is reported so you can see what was accepted.',
      tipAr: 'استورد على دفعات بضعة آلاف. يُبلَّغ عن كل دفعة لتعرف ما قُبل منها.',
      href: '/enterprise/import',
    },
    {
      id: 'allocate',
      art: 'sell',
      title: 'A code is allocated',
      titleAr: 'تم تخصيص رمز',
      body:
        'When an order is paid, the system reserves one available code for it and hides the full code until the recipient receives it. Your inventory count drops by one and the order appears in reports.',
      bodyAr:
        'عند دفع الطلب يحجز النظام رمزاً متاحاً له، ويُخفى الرمز الكامل حتى يصل إلى المستلم. ينقص عدد مخزونك واحداً، ويظهر الطلب في التقارير.',
      href: '/enterprise/reports',
    },
    {
      id: 'redeem',
      art: 'redeem',
      title: 'Your vendor redeems it',
      titleAr: 'يستبدله شريكك',
      body:
        'The vendor scans the code at their counter and the spend is recorded against the code. Until your partner confirms the redemption in a report, the code is only marked as delivered.',
      bodyAr:
        'يمسح شريكك الرمز عند كاونتره ويُسجَّل الإنفاق على الرمز. وحتى يؤكد شريكك الاستبدال في تقرير، لا يُعتبر الرمز سوى مسلَّم.',
      href: '/enterprise/inventory',
    },
    {
      id: 'reconcile',
      art: 'reconcile',
      title: 'Reconcile the month',
      titleAr: 'طابق بيانات الشهر',
      body:
        'Paste the inventory references from your vendor or their report and every matching code is closed as redeemed. Rows that do not match are skipped and listed, so nothing is closed by mistake.',
      bodyAr:
        'الصق مراجع المخزون من شريكك أو من تقريره، فيُغلق كل رمز مطابق كمستبدل. وتُتخطى الصفوف غير المطابقة وتُدرج لك، فلا يُغلق شيء بالخطأ.',
      tip: 'Reconciliation is permanent. Only import a report you trust.',
      tipAr: 'المطابقة دائمة، فاستورد فقط تقريراً تثق به.',
      href: '/enterprise/import',
    },
    {
      id: 'report',
      art: 'report',
      title: 'Report to finance',
      titleAr: 'ارفع التقرير للمحاسبة',
      body:
        'Reports show what is still available, what is allocated and what has been redeemed, and you can export the detail as a CSV for finance at any time.',
      bodyAr:
        'تعرض التقارير ما هو متاح وما تم تخصيصه وما استُبدل، ويمكنك تصدير التفاصيل بصيغة CSV للمحاسبة في أي وقت.',
      href: '/enterprise/reports',
    },
  ],
};

export const ADMIN_SCRIPT: TutorialScript = {
  id: 'admin',
  title: 'How Giftly works for the platform team',
  titleAr: 'كيف تعمل جيفتلي لفريق المنصة',
  intro:
    'You keep the marketplace honest: who is allowed to sell, what is live, and what has been redeemed. This guide walks the whole life cycle and shows you where each decision lives.',
  introAr:
    'أنت تحافظ على نزاهة السوق: من يُسمح له بالبيع، وما هو منشور، وما استُبدل. يشرح هذا الدليل دورة الحياة كاملة ويبين أين يوجد كل قرار.',
  steps: [
    {
      id: 'lifecycle',
      art: 'lifecycle',
      title: 'The journey of one gift',
      titleAr: 'رحلة هدية واحدة',
      body:
        'A business applies, you approve it, it publishes gifts, a customer buys one, the voucher is claimed, the vendor redeems it, and the ledger records the spend. The admin menu is arranged in that order.',
      bodyAr:
        'يطلب نشاط تجاري، توافق عليه، فينشر هدايا، ويشتريها عميل، وتُطالب بالبطاقة، فيستبدلها صاحب المتجر، ويسجّل السجل الإنفاق. وقائمة إدارة المنصة مرتبة بهذا الترتيب.',
      href: '/admin',
    },
    TYPES_STEP('/admin/products'),
    {
      id: 'approve',
      art: 'approve',
      title: 'Review the applications',
      titleAr: 'راجع الطلبات',
      body:
        'Every new business arrives as an application. Read the details, then approve, reject or suspend. Approving publishes their storefront and lets them create gifts; suspending hides them without touching their history.',
      bodyAr:
        'يصل كل نشاط تجاري كطلب. اقرأ التفاصيل، ثم وافق أو ارفض أو علّق. الموافقة تنشر واجهته وتتيح له إنشاء الهدايا، والتعليق يخفيه دون المساس بسجله.',
      tip: 'Add a decision note. The vendor sees it.',
      tipAr: 'أضف ملاحظة قرار، فسيراها صاحب المتجر.',
      href: '/admin/vendors?status=pending',
    },
    {
      id: 'terms',
      art: 'create',
      title: 'Set the commercial terms',
      titleAr: 'حدّد الشروط التجارية',
      body:
        'For each vendor you set the commission percentage, the maximum unredeemed balance you are willing to carry, and whether the business is featured on the marketplace. Orders show the split per item.',
      bodyAr:
        'لكل بائع تحدد نسبة العمولة، وأقصى رصيد غير مستبدل تقبل تحمله، وهل يظهر النشاط في واجهة السوق. وتعرض الطلبات التقسيم لكل بند.',
      href: '/admin/vendors',
    },
    {
      id: 'moderate',
      art: 'moderate',
      title: 'Moderate the catalogue',
      titleAr: 'راقب الكتالوج',
      body:
        'Every gift from every vendor and every partner lands in one list. Publish, unpublish or archive it here. Gifts that break the rules should never reach a customer.',
      bodyAr:
        'كل هدية من كل بائع وكل شريك تصل إلى قائمة واحدة. انشرها أو ألغِ نشرها أو أرشفتها من هنا. والهدايا التي تخالف القواعد لا يجب أن تصل إلى عميل.',
      href: '/admin/products',
    },
    {
      id: 'orders',
      art: 'sell',
      title: 'Watch the orders',
      titleAr: 'راقب الطلبات',
      body:
        'Orders show the buyer, the recipient, the gift and the money. Payment states are recorded outside this dashboard, so use the status controls only to correct a record.',
      bodyAr:
        'تظهر الطلبات المشتري والمستلم والهدية والمال. وتُسجَّل حالات الدفع خارج هذه اللوحة، فاستخدم أدوات الحالة لتصحيح السجل فقط.',
      tip: 'Refunding here records the decision. It does not move money.',
      tipAr: 'الاسترجاع هنا يسجّل القرار، ولا ينقل المال.',
      href: '/admin/orders',
    },
    {
      id: 'vouchers',
      art: 'issue',
      title: 'Follow the vouchers',
      titleAr: 'تابع البطاقات',
      body:
        'A voucher moves from issued to claimed to active, then to partially redeemed, redeemed, expired or void. The outstanding balance is the money the marketplace still owes vendors, so it is the number to watch.',
      bodyAr:
        'تنتقل البطاقة من صادرة إلى مطالب بها إلى نشطة، ثم مستبدلة جزئياً أو مستبدلة أو منتهية أو ملغاة. والرصيد المتبقي هو المال الذي ما زال المنصة تدين به للبائعين، فهو الرقم الذي يجب مراقبته.',
      href: '/admin/vouchers',
    },
    {
      id: 'redeem',
      art: 'redeem',
      title: 'Check the redemptions',
      titleAr: 'راجع عمليات الاستبدال',
      body:
        'Every redemption is written against a voucher with a reference, the amount spent and who processed it. Reversals are kept too, so a correction never hides the original.',
      bodyAr:
        'تُكتب كل عملية استبدال على بطاقة مع مرجع والمبلغ ومن نفّذها. وتُحفظ العكسات أيضاً، فلا يخفي التصحيح العملية الأصلية.',
      href: '/admin/vouchers',
    },
    {
      id: 'enterprise',
      art: 'import',
      title: 'Look after the partners',
      titleAr: 'رعِ الشركاء',
      body:
        'Enterprise partners bring pre-paid codes. Check their product prices, the size of their inventory and how much has been redeemed, and suspend a partner if their programme stops.',
      bodyAr:
        'يجلب الشركاء المؤسسيون رموزاً مدفوعة مسبقاً. راجع أسعار منتجاتهم وحجم مخزونهم ومقدار ما استُبدل، وعلق شريكاً إذا توقفبرنامجهم.',
      href: '/admin/enterprise',
    },
    {
      id: 'support',
      art: 'support',
      title: 'Handle support and keep the trail',
      titleAr: 'عالج الدعم واحفظ السجل',
      body:
        'The support queue holds messages from the website and from customers, and the audit log holds every sensitive action taken on the platform. Both are read-only history, which is exactly what you need when someone disputes something.',
      bodyAr:
        'تجمع قائمة الدعم رسائل الموقع والعملاء، ويجمع سجل التدقيق كل إجراء حساس على المنصة. كلاهما سجل للقراءة فقط، وهو بالضبط ما تحتاجه عند وجود اعتراض.',
      href: '/admin/support',
    },
    {
      id: 'report',
      art: 'report',
      title: 'Read the numbers',
      titleAr: 'اقرأ الأرقام',
      body:
        'The overview shows paid order value, the outstanding balance, the vendors waiting for review and the open support tickets. Start there in the morning and work down the list.',
      bodyAr:
        'تعرض الصفحة الرئيسية قيمة الطلبات المدفوعة، والرصيد المتبقي، والبائعين بانتظار المراجعة، ومذاكر الدعم المفتوحة. ابدأ منها صباحاً وتابع القائمة.',
      href: '/admin',
    },
  ],
};

export function tutorialScript(id: 'vendor' | 'enterprise' | 'admin'): TutorialScript {
  if (id === 'enterprise') return ENTERPRISE_SCRIPT;
  if (id === 'admin') return ADMIN_SCRIPT;
  return VENDOR_SCRIPT;
}

/**
 * Maps the page you are on to the step that explains it, so the guide can
 * open in the right place instead of at the beginning.
 */
export function stepForPath(pathname: string, script: TutorialScript): string {
  const path = pathname.toLowerCase();
  const known = new Set(script.steps.map((step) => step.id));

  // The landing page of every portal starts at the first step.
  if (path === '/vendor' || path === '/enterprise' || path === '/admin') return 'lifecycle';

  const candidates: [string, string[]][] = [
    ['/products/new', ['create', 'product']],
    ['/products', ['create', 'product']],
    ['/orders', ['sell', 'orders']],
    ['/vouchers', ['issue', 'vouchers']],
    ['/redeem', ['redeem']],
    ['/staff', ['redeem']],
    ['/onboarding', ['lifecycle']],
    ['/analytics', ['report']],
    ['/settings', ['publish', 'setup']],
    ['/import', ['import']],
    ['/inventory', ['allocate']],
    ['/reports', ['report']],
    ['/vendors', ['approve']],
    ['/customers', ['moderate']],
    ['/enterprise', ['enterprise', 'product']],
    ['/support', ['support']],
    ['/audit', ['support']],
    ['/promotions', ['lifecycle']],
  ];

  for (const [needle, stepIds] of candidates) {
    if (!path.includes(needle)) continue;
    for (const stepId of stepIds) {
      if (known.has(stepId)) return stepId;
    }
  }
  return 'lifecycle';
}
