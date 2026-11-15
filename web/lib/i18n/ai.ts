// web/lib/i18n/ai.ts
// Copy for the public /ai-gift-cards landing page.
//
// The Arabic object is typed against the English one, so a missing string is a
// compile error. Keep the language honest: the MCP server is live and prepares
// gift card orders, the complete purchase handoff (prepare, send payment link,
// pay, issue) is the system we are rolling out, and connectors are still tested.

import type { Copy } from './index';

const en = {
  meta: {
    title: 'AI Gift Card Shopping in Qatar | Giftly',
    description:
      "Discover Qatari businesses and gift cards with AI assistants. Compare amounts, check details, and pay through a secure Giftly payment link sent in the conversation.",
    ogTitle: 'AI gift card shopping in Qatar',
    ogDescription:
      'Discover local businesses, compare gift cards, and pay through a secure Giftly payment link from the AI conversation to the issued gift card.',
  },
  hero: {
    eyebrow: 'AI gift card shopping in Qatar',
    titleLine1: 'AI gift card shopping',
    titleLine2: 'in Qatar',
    lede:
      "Discover Qatar's local businesses, compare gift cards and prepare a gift in one conversation. Giftly's AI assistant prepares the order, sends you a secure payment link in the chat, and you pay through the Giftly checkout — the gift card is then issued.",
    primaryCta: 'Browse gift cards',
    secondaryCta: 'See how it works',
    trustLocal: 'Qatari local businesses',
    trustMcp: 'MCP-compatible',
    trustSecure: 'Secure payment & issuance',
    chatLabel: 'AI assistant',
    chatUser: 'Find me a QAR 200 spa gift card in Doha.',
    chatAssistant:
      'I found three spa gift cards in Doha. The QAR 200 option at a local spa includes a 60-minute massage and is valid for 12 months.',
    chatResult: 'Compare details · Send secure payment link',
    chatNote: 'Illustrative conversation',
    status: 'Early access · complete purchase flow',
  },
  how: {
    eyebrow: 'How it works',
    title: 'From a sentence to a gift card in four steps.',
    body:
      'You do not need to learn a new app or browse a dozen websites. Describe the gift, and let the assistant do the searching.',
    steps: [
      {
        title: 'Ask your AI assistant',
        body:
          'Describe the occasion, city, kind of business or a specific amount. Ask in English or Arabic.',
      },
      {
        title: 'Discover businesses and cards',
        body:
          'Giftly searches approved local businesses and returns their available gift cards, amounts and experience packages.',
      },
      {
        title: 'Compare before you choose',
        body:
          'Check the amount, package, expiry, terms and redemption instructions, then confirm the details that matter.',
      },
      {
        title: 'Prepare the order securely',
        body:
          "Review the recipient and message, then prepare the order. The assistant sends you a secure payment link in the chat; you pay through the Giftly checkout and the gift card is issued after payment.",
      },
    ],
    note:
      'The assistant prepares the order and sends you a secure payment link in the chat. Payment happens through the Giftly checkout, and the gift card is issued after payment.',
  },
  why: {
    eyebrow: 'Why AI gift card shopping',
    title: 'The gift card shop that answers back.',
    body:
      'A conversation is often the fastest way to find a thoughtful gift. Giftly gives the assistant real catalogue data instead of guesses.',
    benefits: [
      {
        title: 'Discover through conversation',
        body:
          'Say what you want in your own words. The assistant searches the catalogue instead of making you open site after site.',
      },
      {
        title: 'Local options, not filler',
        body:
          'Independent cafés, salons, spas and experiences in Qatar, reviewed before they appear on Giftly.',
      },
      {
        title: 'Answers before you buy',
        body:
          'Ask about amounts, packages, expiry, restrictions and how a gift is redeemed before you decide.',
      },
      {
        title: 'A simpler path to a gift',
        body:
          'Search, compare and pay through one secure link in a single conversation, without repeating the details to every business.',
      },
    ],
  },
  platforms: {
    eyebrow: 'Compatible AI platforms',
    title: 'Built on MCP, not one assistant.',
    body:
      'MCP is an open standard for connecting assistants to tools and data. Giftly builds the connection once so more than one platform can use it.',
    statusLabel: 'Status',
    platforms: [
      {
        name: 'ChatGPT',
        body:
          'A remote MCP connector is being tested with the Giftly server before full purchasing is announced.',
        status: 'Connector testing in progress',
      },
      {
        name: 'Claude',
        body:
          'Claude supports remote MCP connections. The Giftly connector is being tested before full purchasing is announced.',
        status: 'Connector testing in progress',
      },
      {
        name: 'Other MCP assistants',
        body:
          'Any assistant that supports remote Streamable HTTP MCP can connect to the public Giftly server when its client allows custom connectors.',
        status: 'MCP server available',
      },
    ],
    disclaimer:
      'We are testing these connections before declaring that a platform can complete a purchase. Until a connector is verified, the assistant can run the complete gift flow — prepare the order, send the secure payment link and take the payment through the Giftly checkout — before any platform is declared ready to complete a purchase.',
  },
  forBusiness: {
    eyebrow: 'For businesses',
    title: 'Make your gift cards discoverable through AI.',
    body:
      'Join the Giftly marketplace and your published gift cards become part of a catalogue that MCP-compatible assistants can search and present to customers.',
    bullets: [
      'A presence in Giftly\'s public gift card catalogue',
      'Clear amounts, packages and redemption instructions',
      'Orders prepared and paid securely through the chat and Giftly checkout',
      'Your existing vendor dashboard for orders and redemptions',
    ],
    cta: 'Talk to our team',
    secondary: 'Corporate gifting',
  },
  mcp: {
    eyebrow: 'For AI platforms',
    title: 'One connection, many assistants.',
    body:
      'Giftly exposes its catalogue through MCP, an open standard for connecting assistants to tools and data. That means an assistant can search real local businesses and gift cards without a custom integration for every platform.',
    endpointLabel: 'MCP server URL',
    endpoint: 'https://rxrrbznwnsgzpinirzme.supabase.co/functions/v1/mcp',
    toolsLabel: 'Available tools',
    tools: [
      'search_businesses',
      'get_business_details',
      'get_gift_cards',
      'get_gift_card_details',
      'create_gift_card_order',
      'check_order_status',
    ],
    note:
      'The public catalogue tools work without a Giftly account. Preparing an order requires a signed-in Giftly customer; the assistant then sends a secure payment link in the chat. Payment happens through the Giftly checkout, and the gift card is issued after payment.',
    docsCta: 'Connection details for platforms',
  },
  faq: {
    eyebrow: 'Questions',
    title: 'AI gift card shopping, explained.',
    items: [
      {
        q: 'How does the AI purchase flow work?',
        a:
          'The assistant runs the complete gift flow: it prepares the gift card order, sends you a secure payment link in the chat, and you pay through the Giftly checkout. The gift card is issued after payment. We are testing platform connectors before declaring that a platform can complete the purchase.',      },
      {
        q: 'What can the assistant actually do?',
        a:
          'It can search approved businesses, show gift cards, amounts and experience packages, answer questions about expiry, terms and redemption, prepare the order and send the secure payment link in the chat.',
      },
      {
        q: 'Does the assistant charge my card?',
        a:
          'No. The assistant does not charge your card directly. It sends you a secure payment link in the chat; you pay through the Giftly checkout and the gift card is issued after payment.',
      },
      {
        q: 'Can I use Giftly in Arabic?',
        a:
          'Yes. The website and app support Arabic and English, and you can ask an assistant about businesses, amounts and terms in Arabic.',
      },
      {
        q: 'Are the gift cards from local businesses?',
        a:
          'Giftly focuses on independent businesses in Qatar, including cafés, salons, spas and experiences. Every business is reviewed before it appears in the marketplace.',
      },
      {
        q: 'How do I start?',
        a:
          'Ask an MCP-compatible assistant about Giftly. The assistant prepares the gift card, sends a secure payment link in the chat and takes the payment through the Giftly checkout; download the app to claim, store and use the issued card.',
      },
    ],
  },
  related: {
    title: 'Keep exploring',
    links: [
      { label: 'Browse local businesses', href: '/vendors' },
      { label: 'How Giftly works', href: '/faq' },
      { label: 'Corporate gifting', href: '/corporate' },
      { label: 'Get the app', href: '/download' },
      { label: 'Contact us', href: '/contact' },
    ],
  },
  cta: {
    eyebrow: 'Ready when you are',
    title: 'Find a gift worth talking about.',
    body:
      'Start with a local business, or let your assistant do the searching. Giftly brings discovery, comparison and redemption together.',
    primary: 'Browse gift cards',
    secondary: 'Get the app',
  },
};

type AiCopy = typeof en;

const ar: AiCopy = {
  meta: {
    title: 'تسوّق بطاقات الهدايا بالذكاء الاصطناعي في قطر | Giftly',
    description:
      'اكتشف متاجر قطر واستكشف بطاقات الهدايا عبر مساعدي الذكاء الاصطناعي. قارن المبالغ، واطّلع على التفاصيل، وادفع عبر رابط دفع آمن يرسله المساعد في المحادثة ثم تصدر البطاقة بعد الدفع.',
    ogTitle: 'تسوّق بطاقات الهدايا بالذكاء الاصطناعي في قطر',
    ogDescription:
      'اكتشف المتاجر المحلية، وقارن بطاقات الهدايا، وادفع عبر رابط دفع آمن من محادثة المساعد إلى البطاقة المصدرة.',
  },
  hero: {
    eyebrow: 'تسوّق بطاقات الهدايا بالذكاء الاصطناعي في قطر',
    titleLine1: 'تسوّق بطاقات الهدايا',
    titleLine2: 'بالذكاء الاصطناعي في قطر',
    lede:
      'اكتشف متاجر قطر المحلية، وقارن بطاقات الهدايا، وجهّز هديتك في محادثة واحدة. يعد المساعد الذكاء الاصطناعي الطلب، ويرسل رابط دفع آمن في المحادثة، وتدفع عبر تجربة Giftly — ثم تُصدر البطاقة بعد الدفع.',
    primaryCta: 'تصفّح بطاقات الهدايا',
    secondaryCta: 'كيف يعمل',
    trustLocal: 'متاجر قطرية محلية',
    trustMcp: 'متوافق مع MCP',
    trustSecure: 'دفع آمن وتصدير',
    chatLabel: 'مساعد الذكاء الاصطناعي',
    chatUser: 'ابحث لي عن بطاقة هدية سبا بقيمة 200 ريال في الدوحة.',
    chatAssistant:
      'وجدت ثلاث بطاقات سبا في الدوحة. خيار 200 ريال في أحد المراكز المحلية يشمل جلسة مساج 60 دقيقة وصالح لمدة 12 شهراً.',
    chatResult: 'قارن التفاصيل · أرسل رابط دفع آمن',
    chatNote: 'محادثة توضيحية',
    status: 'إطلاق مبكر · إتمام الشراء',
  },
  how: {
    eyebrow: 'كيف يعمل',
    title: 'من جملة واحدة إلى بطاقة هدية في أربع خطوات.',
    body:
      'لا تحتاج إلى تعلّم تطبيق جديد أو التنقل بين عشرات المواقع. صف الهدية، ودع المساعد يبحث عنك.',
    steps: [
      {
        title: 'اسأل مساعد الذكاء الاصطناعي',
        body:
          'اذكر المناسبة، أو المدينة، أو نوع المتجر، أو مبلغاً محدداً. اسأل بالعربية أو الإنجليزية.',
      },
      {
        title: 'اكتشف المتاجر والبطاقات',
        body:
          'يبحث Giftly في المتاجر المحلية المعتمدة ويعرض بطاقات الهدايا والمبالغ والباقات المتاحة.',
      },
      {
        title: 'قارن قبل أن تختار',
        body:
          'اطّلع على المبلغ أو الباقة، وتاريخ الانتهاء، والشروط، وتعليمات الاستخدام، ثم أكّد التفاصيل المهمة.',
      },
      {
        title: 'جهّز الطلب بأمان',
        body:
          'راجع بيانات المستلم والرسالة، ثم جهّز الطلب. يرسل المساعد رابط دفع آمن في المحادثة، وتدفع عبر تجربة Giftly، ويُصدر بعد الدفع.',
      },
    ],
    note:
      'المساعد يجهّز الطلب ويرسل رابط دفع آمن في المحادثة. الدفع يتم عبر تجربة Giftly، ويُصدر بعد الدفع.',
  },
  why: {
    eyebrow: 'لماذا التسوّق بالذكاء الاصطناعي؟',
    title: 'متجر بطاقات هدايا يجاوبك.',
    body:
      'المحادثة غالباً أسرع طريقة للعثور على هدية مميزة. يمنح Giftly المساعد بيانات حقيقية من الكتالوج بدلاً من التخمين.',
    benefits: [
      {
        title: 'اكتشاف بالمحادثة',
        body:
          'صف ما تريد بكلماتك. يبحث المساعد في الكتالوج بدلاً من أن تفتح موقعاً بعد موقع.',
      },
      {
        title: 'خيارات محلية حقيقية',
        body:
          'مقاهي وصالونات ومراكز سبا وتجارب مستقلة في قطر، تتم مراجعتها قبل ظهورها على Giftly.',
      },
      {
        title: 'إجابات قبل الشراء',
        body:
          'اسأل عن المبالغ والباقات والانتهاء والقيود وطريقة الاستخدام قبل أن تقرر.',
      },
      {
        title: 'طريق أبسط إلى الهدية',
        body:
          'ابحث وقارن وجهّز الطلب في مكان واحد، دون تكرار التفاصيل مع كل متجر.',
      },
    ],
  },
  platforms: {
    eyebrow: 'منصات الذكاء الاصطناعي المتوافقة',
    title: 'مبنية على MCP، لا على مساعد واحد.',
    body:
      'MCP معيار مفتوح لربط المساعدات بالأدوات والبيانات. يبني Giftly الاتصال مرة واحدة لتستخدمه أكثر من منصة.',
    statusLabel: 'الحالة',
    platforms: [
      {
        name: 'ChatGPT',
        body:
          'يجري اختبار موصل MCP عن بُعد مع خادم Giftly قبل الإعلان عن إتاحة الشراء الكامل.',
        status: 'اختبار الموصل جارٍ',
      },
      {
        name: 'Claude',
        body:
          'يدعم Claude اتصالات MCP عن بُعد. يجري اختبار موصل Giftly قبل الإعلان عن إتاحة الشراء الكامل.',
        status: 'اختبار الموصل جارٍ',
      },
      {
        name: 'مساعدات MCP الأخرى',
        body:
          'أي مساعد يدعم MCP عبر Streamable HTTP يمكنه الاتصال بخادم Giftly العام عندما يسمح عميله بالموصلات المخصصة.',
        status: 'خادم MCP متاح',
      },
    ],
    disclaimer:
      'نختبر هذه الاتصالات قبل أن نعلن أن منصة ما قادرة على إتمام الشراء. حتى يتم التحقق من الموصل، يمكن للمساعد أن يشغّل التدفق الكامل: يجهّز الطلب، ويرسل رابط الدفع الآمن، ويتولى الدفع عبر تجربة Giftly — قبل أن تُعلن منصة عن إتمام الشراء.',
  },
  forBusiness: {
    eyebrow: 'للأعمال',
    title: 'اجعل بطاقات هداياك قابلة للاكتشاف عبر الذكاء الاصطناعي.',
    body:
      'انضم إلى سوق Giftly، لتصبح بطاقات هداياك المنشورة جزءاً من كتالوج يمكن للمساعدات المتوافقة مع MCP البحث فيه وعرضه للعملاء.',
    bullets: [
      'حضور في كتالوج Giftly العام لبطاقات الهدايا',
      'مبالغ وباقات وتعليمات استخدام واضحة',
      'طلبات مجهّزة ومدفوعة بأمان عبر المحادثة وتجربة Giftly',
      'لوحة المتجر الحالية لمتابعة الطلبات والاستبدال',
    ],
    cta: 'تحدّث إلى فريقنا',
    secondary: 'الهدايا المؤسسية',
  },
  mcp: {
    eyebrow: 'لمنصات الذكاء الاصطناعي',
    title: 'اتصال واحد، مساعدات متعددة.',
    body:
      'يتيح Giftly كتالوجه عبر MCP، وهو معيار مفتوح لربط المساعدات بالأدوات والبيانات. لذلك يستطيع المساعد البحث في متاجر محلية حقيقية وبطاقات هدايا دون تكامل مخصص لكل منصة.',
    endpointLabel: 'عنوان خادم MCP',
    endpoint: 'https://rxrrbznwnsgzpinirzme.supabase.co/functions/v1/mcp',
    toolsLabel: 'الأدوات المتاحة',
    tools: [
      'search_businesses',
      'get_business_details',
      'get_gift_cards',
      'get_gift_card_details',
      'create_gift_card_order',
      'check_order_status',
    ],
    note:
      'أدوات الكتالوج العامة تعمل دون حساب Giftly. تجهيز الطلب يتطلب عميلاً مسجّلاً في Giftly؛ ثم يرسل المساعد رابط دفع آمن في المحادثة. الدفع يتم عبر تجربة Giftly، ويُصدر بعد الدفع.',
    docsCta: 'تفاصيل الاتصال للمنصات',
  },
  faq: {
    eyebrow: 'أسئلة',
    title: 'التسوّق بالذكاء الاصطناعي، ببساطة.',
    items: [
      {
        q: 'كيف يعمل تدفق شراء الذكاء الاصطناعي؟',
        a:
          'يعمل خادم Giftly عبر MCP: يجهّز طلب البطاقة الهدية، ويرسل رابط الدفع الآمن في المحادثة، وتدفع عبر تجربة Giftly، ويُصدر بعد الدفع. نختبر موصلات المنصات قبل أن تُعلن أن منصة ما قادرة على إتمام الشراء.',
      },
      {
        q: 'ما الذي يستطيع المساعد فعله فعلاً؟',
        a:
          'يبحث في المتاجر المعتمدة، ويعرض بطاقات الهدايا والمبالغ وباقات التجارب، ويجيب عن الانتهاء والشروط والاستخدام، ويجهّز الطلب ويرسل رابط الدفع الآمن في المحادثة.',
      },
      {
        q: 'هل يخصم المساعد المبلغ من بطاقتي؟',
        a:
          'لا. لا يخصم المساعد من بطاقيتك مباشرة؛ بل يرسل رابط دفع آمن في المحادثة، وتدفع عبر تجربة Giftly، ويُصدر بعد الدفع.',
      },
      {
        q: 'هل يمكنني استخدام Giftly بالعربية؟',
        a:
          'نعم. الموقع والتطبيق يدعمان العربية والإنجليزية، ويمكنك سؤال المساعد بالعربية عن المتاجر والمبالغ والشروط.',
      },
      {
        q: 'هل بطاقات الهدايا من متاجر محلية؟',
        a:
          'يركز Giftly على المتاجر المستقلة في قطر، مثل المقاهي والصالونات ومراكز السبا والتجارب. تتم مراجعة كل متجر قبل ظهوره في السوق.',
      },
      {
        q: 'كيف أبدأ؟',
        a:
          'اسأل مساعداً متوافقاً مع MCP عن Giftly. يجهّز المساعد البطاقة الهدية، ويرسل رابط الدفع الآمن في المحادثة، ويتولى الدفع عبر تجربة Giftly؛ وحمّل التطبيق لاستلام البطاقة المصدرة وحفظها واستخدامها.',
      },
    ],
  },
  related: {
    title: 'تابع الاستكشاف',
    links: [
      { label: 'تصفّح المتاجر المحلية', href: '/vendors' },
      { label: 'كيف تعمل Giftly', href: '/faq' },
      { label: 'الهدايا المؤسسية', href: '/corporate' },
      { label: 'حمّل التطبيق', href: '/download' },
      { label: 'تواصل معنا', href: '/contact' },
    ],
  },
  cta: {
    eyebrow: 'جاهز عندما تكون جاهزاً',
    title: 'اعثر على هدية تستحق الحديث عنها.',
    body:
      'ابدأ بمتجر محلي، أو دع مساعدك يبحث لك. يجمع Giftly الاكتشاف والمقارنة والاستخدام في مكان واحد.',
    primary: 'تصفّح بطاقات الهدايا',
    secondary: 'حمّل التطبيق',
  },
};

export const aiGiftCards: Copy<AiCopy> = { en, ar };
