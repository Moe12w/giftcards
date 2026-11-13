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
  id: 'vendor' | 'enterprise' | 'admin' | 'business';
  title: string;
  titleAr: string;
  intro: string;
  introAr: string;
  steps: TutorialStep[];
}

/**
 * The walkthrough for a business account buying gift cards in bulk.
 */
export const BUSINESS_SCRIPT: TutorialScript = {
  id: 'business',
  title: 'How bulk buying works for a business',
  titleAr: 'كيف يعمل الشراء بالجملة للشركات',
  intro:
    'Four minutes, and you will know how to buy gift cards at corporate prices and get them to your people without a spreadsheet.',
  introAr:
    'أربع دقائق فقط، وستعرف كيف تشتري بطاقات الهدايا بأسعار الشركات وتوصلها إلى فريقك دون جداول بيانات.',
  steps: [
    {
      id: 'lifecycle',
      art: 'lifecycle',
      title: 'One order, many gift cards',
      titleAr: 'طلب واحد، وبطاقات كثيرة',
      body:
        'A bulk order is one purchase of many gift cards. Each card keeps its own face value, its own code and its own claim link, so you can send them to different people.',
      bodyAr:
        'طلب الجملة هو شراء واحد لعدد من بطاقات الهدايا. ولكل بطاقة قيمتها الاسمية ورمزها ورابط الاستلام الخاص، فترسلها إلى أشخاص مختلفين.',
      tip: 'The discount is only on what you pay. Every card still redeems at face value.',
      tipAr: 'الخصم على ما تدفعه فقط، أما كل بطاقة فتبقى تُسترد بالقيمة الاسمية.',
      href: '/business',
    },
    {
      id: 'types',
      art: 'types',
      title: 'Volume pricing, applied for you',
      titleAr: 'تسعير الكميات يُطبَّق تلقائياً',
      body:
        'Vendors publish bulk offers with tiers: ten cards at one price, fifty at a lower one, five hundred at the best. Choose a quantity and the right tier is applied to the total automatically.',
      bodyAr:
        'ينشر البائعون عروض جملة بشرائح: عشر بطاقات بسعر، وخمسون بسعر أقل، وخمسمئة بالأفضل. اختر الكمية ويُطبَّق سعر الشريحة المناسب على الإجمالي تلقائياً.',
      tip: 'Bulk prices are only visible to approved business accounts.',
      tipAr: 'أسعار الجملة تظهر لحسابات الأعمال المعتمدة فقط.',
      href: '/business/deals',
    },
    {
      id: 'import',
      art: 'import',
      title: 'Upload the people who get them',
      titleAr: 'ارفع قائمة الأشخاص',
      body:
        'Paste a CSV of names and emails, or upload the file. The first row is matched to card one, the second to card two, and so on. A message column is optional.',
      bodyAr:
        'الصق قائمة أسماء وبريد إلكتروني، أو ارفع الملف. السطر الأول يُطابَق مع البطاقة الأولى، والثاني مع الثانية، وهكذا. ورسالة اختيارية يمكن إضافتها.',
      tip: 'One gift card is issued for every person on the list.',
      tipAr: 'تُصدر بطاقة هدية واحدة لكل شخص في القائمة.',
      href: '/business/orders',
    },
    {
      id: 'claim',
      art: 'claim',
      title: 'Send every card in one go',
      titleAr: 'أرسل كل البطاقات دفعة واحدة',
      body:
        'Once payment is confirmed, each gift card is issued and emailed to its recipient with a personal claim link, exactly like a normal gift. You can resend a single card or the whole batch.',
      bodyAr:
        'بعد تأكيد الدفع، تُصدر كل بطاقة هدية وتُرسل بالبريد إلى مستلمها برابط استلام خاص، تماماً كالهدية العادية. ويمكنك إعادة إرسال بطاقة واحدة أو المجموعة كاملة.',
      tip: 'Download the order as CSV for your finance records.',
      tipAr: 'حمّل الطلب كملف CSV لسجلاتك المالية.',
      href: '/business/orders',
    },
  ],
};

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
        'Ask the customer to open the app, or their wallet pass, and scan the code with the camera. You see the gift, the recipient and the balance left, and the amount comes off the moment you confirm. You can still type a code by hand.',
      bodyAr:
        'اطلب من العميل فتح التطبيق أو بطاقة المحفظة وامسح الرمز بالكاميرا. ترى الهدية والمستلم والرصيد المتبقي، ويُخصم المبلغ فور تأكيدك. ويمكنك أيضاً كتابة الرمز يدوياً.',
      tip: 'A handheld scanner works too: it types the code and presses enter, so keep the code field ready.',
      tipAr:
        'الماسح اليدوي يعمل أيضاً: يكتب الرمز ويضغط Enter، لذا أبقِ حقل الرمز جاهزاً.',
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
  titleAr: 'كيف تعمل جيفتلي للشريك',
  intro:
    'You bring the codes you already generated. We put them in the app, sell them like any other gift, and keep track of what is still out there and what has been used.',
  introAr:
    'أنت تجلب الأكواد التي أنشأتها بالفعل. نعرضها في التطبيق ونبيعها كأي هدية، ونتابع ما تبقى منها وما استُخدم.',
  steps: [
    {
      id: 'lifecycle',
      art: 'lifecycle',
      title: 'You are a marketplace for your own codes',
      titleAr: 'أنت سوق لأكوادك أنت',
      body:
        'Your codes come from your system, not ours. We list them in the app, a customer buys one like any gift, they use it in your app, and we close it. That is the whole job.',
      bodyAr:
        'أكوادك تأتي من نظامك، لا من عندنا. نعرضها في التطبيق، ويشتريها العميل كأي هدية، يستخدمها في تطبيقك، ونغلقها. هذه هي المهمة كلها.',
      href: '/enterprise',
    },
    {
      id: 'types',
      art: 'types',
      title: 'How your codes are different',
      titleAr: 'كيف تختلف أكوادك',
      body:
        'A partner code is one time and one value. We never validate it and we never measure it: when it is used, the whole value is spent. There is no partial spending and no session count.',
      bodyAr:
        'الرمز المؤسسي يُستخدم مرة واحدة وبقيمة واحدة. نحن لا نتحقق منه ولا نقيسه: عند استخدامه تُنفق القيمة كاملة. لا إنفاق جزئي ولا عد جلسات.',
      tip: 'You do not need to send us a report for every gift. A single list at the end of the day is enough.',
      tipAr: 'لا تحتاج إلى إرسال تقرير لكل هدية. قائمة واحدة في نهاية اليوم تكفي.',
      href: '/enterprise/inventory',
    },
    {
      id: 'setup',
      art: 'create',
      title: 'Set up the company',
      titleAr: 'جهّز بيانات الشركة',
      body:
        'Fill in the company profile so delivery messages and paperwork use the right name and contact. Your team gets its own logins and roles.',
      bodyAr:
        'أكمل ملف الشركة حتى تستخدم رسائل التسليم والأوراق الاسم وجهات التواصل الصحيحة. ويحصل فريقك على دخوله وأدواره.',
      href: '/enterprise/settings',
    },
    {
      id: 'product',
      art: 'create',
      title: 'Define the reward and the price',
      titleAr: 'عرّف المكافأة والسعر',
      body:
        'A product holds the face value of one of your codes and the price the customer pays. You set the price, Giftly takes its cut, and the rest is yours. Saving it publishes the gift in the app straight away.',
      bodyAr:
        'يحدد المنتج قيمة الرمز الواحد والسعر الذي يدفعه العميل. أنت تحدد السعر، وتأخذ جيفتلي حصتها، والباقي لك. وبالحفظ يظهر المنتج في التطبيق مباشرة.',
      tip: 'The gift in the app always follows this price, so your two screens can never drift apart.',
      tipAr: 'الهدية في التطبيق تتبع هذا السعر دائماً، فلا يتعارض سجلاك أبداً.',
      href: '/enterprise/products',
    },
    {
      id: 'import',
      art: 'import',
      title: 'Bring your codes',
      titleAr: 'استورد أكوادك',
      body:
        'Paste the codes you generated, one per line. We encrypt each one, check for duplicates, and keep only the last four digits readable in the dashboard.',
      bodyAr:
        'الصق الأكواد التي أنشأتها، رمزاً في كل سطر. نشفّر كل رمز، ونتحقق من التكرار، ولا يبقى منه إلا آخر أربعة أرقام في اللوحة.',
      tip: 'Import in batches of a few thousand. Each batch is reported so you can see what was accepted.',
      tipAr: 'استورد على دفعات بضعة آلاف. يُبلَّغ عن كل دفعة لتعرف ما قُبل منها.',
      href: '/enterprise/import',
    },
    {
      id: 'sell',
      art: 'sell',
      title: 'It sells like any other gift',
      titleAr: 'تُباع كأي هدية',
      body:
        'When a customer pays for one of your gifts, we reserve one of your codes and hand it to them. It is not ours and it never was: it is your code, and we keep the record of it.',
      bodyAr:
        ' عندما يدفع العميل ثمن إحدى هداياك، نحجز أحد أكوادك ونسلّمه له. الرمز ليس لنا ولن يكون: هو رمزك، ونحن نتابعه فقط.',
      href: '/enterprise/reports',
    },
    {
      id: 'use',
      art: 'redeem',
      title: 'The customer uses it in your app',
      titleAr: 'العميل يستخدمه في تطبيقك',
      body:
        'They type your code into your app and your system spends it. On our side the gift simply closes, in full, either because they tapped "I have used this" or because you told us later.',
      bodyAr:
        'يكتب العميل رمزك في تطبيقك وينفذه نظامك. وعندنا تُغلق الهدية ببساطة وبالكامل، إما لأن العميل ضغط «استخدمت هذا» أو لأن أخبرتنا لاحقاً.',
      tip: 'Nothing is measured, so there is no percentage to argue about.',
      tipAr: 'لا نقيس شيئاً، فلا يوجد نسبة يمكن الخلاف عليها.',
      href: '/enterprise/inventory',
    },
    {
      id: 'report',
      art: 'reconcile',
      title: 'Report the codes your app used',
      titleAr: 'أبلغ عن الأكواد التي استخدمها تطبيقك',
      body:
        'Paste the references of the codes your app consumed. Every one of them closes, and the gift the customer bought closes with it.',
      bodyAr:
        'الصق مراجع الأكواد التي استهلكها تطبيقك. كل رمز يُغلق، وتُغلق معه الهدية التي اشتراها العميل.',
      href: '/enterprise/import',
    },
    {
      id: 'money',
      art: 'report',
      title: 'The money',
      titleAr: 'المال',
      body:
        'You set the price, Giftly takes a cut of every code that sells, and the rest is yours. The codes still sitting in your inventory are stock, not a debt: they turn into money when someone buys one.',
      bodyAr:
        'أنت تحدد السعر، وتأخذ جيفتلي حصتها من كل رمز يُباع، والباقي لك. والأكواد المتبقية في مخزونك بضاعة لا دين: تتحول إلى مال عند بيع أحدها.',
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
