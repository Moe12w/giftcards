// web/lib/i18n/site.ts
// The words on the public website.
//
// The English object is written first. The Arabic object is typed against it,
// so a missing translation is a compile error rather than a page that
// half-switches to Arabic.
import type { Copy } from './index';

const en = {
  nav: {
    main: 'Main',
    vendors: 'Vendors',
    business: 'For business',
    howItWorks: 'How it works',
    contact: 'Contact',
    vendorSignIn: 'Vendor sign in',
    getTheApp: 'Get the app',
    openMenu: 'Open the menu',
    closeMenu: 'Close the menu',
  },
  home: {
    heroTitleLine1: 'Give a gift they\'ll',
    heroTitleLine2: 'actually use',
    heroLede:
      'The best independent cafés, salons, spas and adventures in Qatar, wrapped into one thoughtful gift. Send it in seconds, spend it in parts, keep it in your wallet.',
    browseBusinesses: 'Browse businesses',
    walletReady: 'Apple & Google Wallet ready',
    spendInParts: 'Spend in parts',
    englishAndArabic: 'English & Arabic',
    artThreeSessions: '3 sessions',
    artSlowDown: 'Slow down · valid 12 months',
    artTreatYourself: 'Treat yourself · no expiry',
    artOneAdventure: 'One adventure',
    artForTwo: 'For two · Doha Corniche',
    artSentWhatsApp: 'Sent on WhatsApp',
    artScanCounter: 'Scan at the counter',
    artAddedWallet: 'Added to Wallet',
    statBusinesses: 'Businesses on Giftly',
    statGifts: 'Gifts ready to send',
    statCategories: 'Categories to explore',
    statWays: 'Ways to give',
    eyebrowThreeWays: 'One app, three ways to give',
    titleThreeWays: 'Whatever the moment, there is a Giftly for it.',
    bodyThreeWays:
      'A coffee on us, a proper spa afternoon, or a thank-you for the whole team. Every gift is stored digitally and can be spent in parts.',
    typeGiftCards: 'Gift cards',
    typeGiftCardsBody:
      'Pick a vendor and an amount. They spend what they need, when they need it — the balance stays on the card until it reaches zero.',
    tagAnyAmount: 'Any amount',
    tagNoChangeLost: 'No change lost',
    typeExperiences: 'Experiences',
    typeExperiencesBody:
      'Vendor-set packages with real sessions: a massage, a kayak trip, a cooking class. One gift, one lovely afternoon.',
    tagPackages: 'Packages',
    tagBookATime: 'Book a time',
    typeCorporateRewards: 'Corporate rewards',
    typeCorporateRewardsBody:
      'Buy codes in bulk, distribute them to your team, and see exactly what has been redeemed. Built for HR and finance.',
    tagBulkCodes: 'Bulk codes',
    tagReports: 'Reports',
    eyebrowLocal: 'Local favourites',
    titleLocal: 'Independent businesses doing lovely things.',
    bodyLocal:
      'Every business is reviewed before they go live. No chains, no filler — just places worth leaving the house for.',
    allBusinesses: 'All businesses',
    emptyBusinessesTitle: 'Businesses are moving in',
    emptyBusinessesBody: 'We are onboarding our first Doha partners right now. Check back soon.',
    enterprisePartner: 'Enterprise partner',
    qatar: 'Qatar',
    localFavourite: 'A local favourite on Giftly.',
    viewGifts: 'View gifts',
    eyebrowReady: 'Ready to send',
    titleReady: 'Gifts people are sending this week.',
    emptyGiftsTitle: 'No live gifts yet',
    emptyGiftsBody: 'Once our businesses publish their offers, they will appear right here.',
    giftlyPartner: 'Giftly partner',
    eyebrowSimple: 'Simple by design',
    titleSimple: 'From “thinking of you” to sent, in under a minute.',
    step1Title: 'Choose a gift',
    step1Body: 'Pick a vendor, an amount or a ready-made experience package.',
    step2Title: 'Make it theirs',
    step2Body: 'Add a note, pick a design and choose when it arrives.',
    step3Title: 'Send it anywhere',
    step3Body: 'Email, SMS, a link — or straight to their WhatsApp.',
    step4Title: 'Spend it slowly',
    step4Body: 'They scan at the counter. Whatever is left stays on the card.',
    eyebrowForVendors: 'For vendors',
    titleForVendors: 'Put your business on the gift list.',
    bodyForVendors:
      'Join Qatar\'s marketplace for thoughtful gifts. Set your own offers and packages, redeem with a QR scan, and get paid through one dashboard.',
    applyAsVendor: 'Apply as a vendor',
    corporateGifting: 'Corporate gifting',
    titleVerified: 'Every card is verified.',
    bodyVerified:
      'Balances live on our ledger, not on a screenshot. Vendors redeem with a scan and the remaining value is updated instantly.',
    checkPartial: 'Partial spending, always',
    checkExpiry: 'Expiry set by the vendor',
    checkWallet: 'Wallet passes with a QR code',
    titleOneBalance: 'One balance. No awkward maths.',
    bodyOneBalance:
      'Spend QAR 10 of a QAR 100 card and QAR 90 stays available. No vouchers lost in a drawer, no “use it or lose it” pressure.',
    labelBalance: 'Gift card balance',
    labelCoffee: 'Coffee and cake',
    labelAvailable: 'Still available',
    eyebrowGoodToKnow: 'Good to know',
    titleGoodToKnow: 'Questions people ask before their first gift.',
    allAnswers: 'All answers',
    faq1Q: 'Can the recipient spend only part of the card?',
    faq1A:
      'Yes. Every monetary gift card keeps a running balance. If they spend QAR 10 from a QAR 100 card, QAR 90 remains for next time.',
    faq2Q: 'How does the recipient actually receive the gift?',
    faq2A:
      'You can send it by email, SMS, a shareable link or WhatsApp. They open the link, add the card to their Giftly account and show the QR code at the vendor.',
    faq3Q: 'What is an experience gift?',
    faq3A:
      'Instead of a cash balance, experience gifts come as a package with a set number of sessions — for example three spa visits or a two-person kayak tour. The vendor sets the package and the price.',
    faq4Q: 'Do gift cards work in Apple and Google Wallet?',
    faq4A:
      'Wallet passes are part of the Giftly app experience. Once you claim a gift, you can add it to your phone\'s wallet and show the QR code at the counter.',
  },
  faq: {
    eyebrow: 'Good to know',
    title: 'Everything you might ask before your first gift.',
    lede:
      'Sending, claiming, spending and settling — here is how Giftly works on both sides of the gift.',
    sections: [
      {
        title: 'For the person sending',
        items: [
          {
            q: 'How do I buy a gift?',
            a: 'Open the Giftly app, choose a vendor, then pick a gift card amount or an experience package. Add a message and a design, choose how to send it, and pay. The gift is delivered as a link your recipient can claim.',
          },
          {
            q: 'Can I choose the amount on an experience?',
            a: 'No — experience gifts are packages created by the vendor. The vendor sets the sessions and the price, so you simply choose the package that fits. Monetary gift cards keep preset and custom amounts.',
          },
          {
            q: 'How do I send a gift on WhatsApp?',
            a: 'Choose WhatsApp as the delivery method, or tap “Send on WhatsApp” on the success screen. Giftly opens your own WhatsApp with a ready-written message and the gift link. You press send, so it comes from you.',
          },
          {
            q: 'Can I schedule a gift for later?',
            a: 'Yes. Pick a delivery date during checkout and the gift will be held until that morning. You can see scheduled gifts in your account.',
          },
          {
            q: 'Can I cancel or refund a gift?',
            a: 'Unclaimed gifts can be cancelled from your account within the cancellation window. Once a gift has been claimed, it can no longer be refunded. Contact us if something is not right.',
          },
        ],
      },
      {
        title: 'For the person receiving',
        items: [
          {
            q: 'How do I claim my gift?',
            a: 'Tap the link in the message you received. If you already have a Giftly account, sign in; if not, create one with the same email or phone number. The gift is added to My gifts automatically.',
          },
          {
            q: 'Can I spend only part of a gift card?',
            a: 'Yes. Monetary cards keep a running balance. Spend QAR 10 of a QAR 100 card and QAR 90 remains for your next visit. The balance is updated at the counter and in the app.',
          },
          {
            q: 'How do I use an experience gift?',
            a: 'Open the gift in My gifts and follow the vendor’s booking instructions. Some experiences need a booking; others can be used during opening hours. The card shows how many sessions remain.',
          },
          {
            q: 'Do gifts expire?',
            a: 'Each vendor sets an expiry for their gifts. The date is shown on the gift before you claim it and on the card afterwards. Gifts without an expiry stay valid until the balance reaches zero.',
          },
          {
            q: 'Can I add a gift to Apple or Google Wallet?',
            a: 'Yes — open a claimed gift in the app and use Add to Wallet. The pass shows the balance and a QR code that vendors scan at the counter.',
          },
        ],
      },
      {
        title: 'For vendors',
        items: [
          {
            q: 'How do I join Giftly?',
            a: 'Apply from the vendor sign-up page. Tell us about your business, what you sell and where you are. Our team reviews every application before your offers go live.',
          },
          {
            q: 'How do I redeem a gift?',
            a: 'Open the Redeem screen in your vendor dashboard, enter the card code, and choose the amount or sessions used. The balance updates instantly and a reference is recorded for your reports.',
          },
          {
            q: 'When do I get paid?',
            a: 'Vendor settlements are calculated from paid orders minus the agreed commission. Your dashboard shows sales, commission and your share. Payouts are made on the agreed settlement cycle.',
          },
          {
            q: 'Can I set my own prices and packages?',
            a: 'Yes. Monetary offers have a minimum, maximum and preset amounts. Experience offers are packages you define, with a label, number of sessions and price.',
          },
        ],
      },
      {
        title: 'For businesses',
        items: [
          {
            q: 'Can we buy gifts in bulk?',
            a: 'Yes. Enterprise partners buy codes in bulk, import them into the dashboard, and allocate them to employees or clients. Each code is encrypted at rest and only revealed when allocated.',
          },
          {
            q: 'Can we track redemptions?',
            a: 'The enterprise dashboard shows available, allocated, delivered and redeemed codes, plus reports by product and period. You can export the data whenever you need it.',
          },
          {
            q: 'Can the rewards be branded?',
            a: 'We can add a company message to the delivery email and agree a custom catalogue for larger programmes. Talk to our corporate team about what you need.',
          },
        ],
      },
    ],
    stillStuck: 'Still stuck?',
    stillStuckBody:
      'Send us a note and a real person will get back to you, usually the same day.',
    contactSupport: 'Contact support',
    browseVendors: 'Browse vendors',
  },
  contact: {
    eyebrow: 'Say hello',
    title: 'We are real people, in Doha.',
    lede:
      'Questions about a gift, a balance, a booking or a partnership — send us a note and we will help.',
    formTitle: 'Send us a message',
    formSuccess: 'Thank you — your message is with our team.',
    labelYourName: 'Your name',
    placeholderFullName: 'Full name',
    labelSubject: 'Subject',
    subjectGiftSupport: 'Gift support',
    subjectVendorQuestion: 'Vendor question',
    subjectCorporateGifting: 'Corporate gifting',
    subjectPress: 'Press or partnership',
    subjectOther: 'Something else',
    labelMessage: 'Message',
    placeholderHowCanWeHelp: 'How can we help?',
    sendMessage: 'Send message',
    replyNoteBefore: 'We usually reply within one working day. See our',
    privacyPolicy: 'privacy policy',
    replyNoteAfter: 'for how we handle your details.',
    phoneHours: 'Sunday to Thursday, 9am–6pm',
    officeTitle: 'Office',
    dohaQatar: 'Doha, Qatar',
    visitsByAppointment: 'Visits by appointment.',
    forVendorsTitle: 'For vendors',
    forVendorsBody:
      'Already selling on Giftly? Sign in to your dashboard for order and redemption support.',
    vendorFaq: 'Vendor FAQ',
    corporateQuoteBefore: 'Looking for a corporate quote? Use the',
    enterpriseEnquiryForm: 'enterprise enquiry form',
    corporateQuoteAfter: 'so it reaches the right team.',
  },
  corporate: {
    eyebrow: 'Giftly for business',
    title: 'Buy gift cards in bulk for your team and customers.',
    lede:
      'Register as a Business / Bulk Buyer to access exclusive corporate deals and volume pricing from vendors on Giftly. Get approved, browse bulk offers, place orders, and distribute digital gift cards from one place.',
    talkToTeam: 'Buy in bulk',
    partnerSignIn: 'Business sign in',
    trustInvoice: 'Invoices & receipts',
    trustReporting: 'Order history & exports',
    trustLocal: 'Exclusive bulk pricing',
    tileMembers: 'Register your business',
    tileMembersBody: 'Submit company details for approval',
    tileEach: 'Approved access',
    tileEachBody: 'Bulk prices visible only to approved buyers',
    tileRedeemed: 'Order & distribute',
    tileRedeemedBody: 'Track orders and export gift cards',
    eyebrowWhy: 'Why Giftly',
    titleWhy: 'Corporate bulk purchasing built into Giftly.',
    cardLocalTitle: 'Exclusive vendor bulk offers',
    cardLocalBody:
      'Vendors publish bulk-only products with discounted unit prices and volume tiers. Regular customers never see bulk pricing.',
    cardNumbersTitle: 'Clear totals and savings',
    cardNumbersBody:
      'Choose quantities, see tier pricing and totals update automatically, and place bulk orders with a full accounting breakdown.',
    cardSafeTitle: 'Approved and secure',
    cardSafeBody:
      'Business accounts are reviewed and approved by admins. Bulk offers and prices are enforced by backend permissions, not just the UI.',
    eyebrowHow: 'How it works',
    titleHow: 'From registration to delivery in four steps.',
    bodyHow:
      'Create a business account, get approved, and purchase exclusive bulk gift card offers with volume-based pricing and digital distribution.',
    check1: 'Register as a Business / Bulk Buyer with your company details',
    check2: 'Wait for admin approval to unlock restricted bulk deals and pricing',
    check3: 'Browse offers, choose quantity, apply tier pricing automatically and place a bulk order',
    check4: 'Track orders, download invoices/receipts and export/distribute gift cards (CSV/Excel)',
    timeline: [
      { title: 'Register', body: 'Create a business account with company and contact details.' },
      { title: 'Approval', body: 'Admin reviews and approves your bulk buyer access.' },
      { title: 'Bulk deals', body: 'Browse exclusive offers, volume tiers and place bulk orders.' },
      { title: 'Distribute', body: 'View orders, invoices and export/assign gift cards to recipients.' },
    ],
    eyebrowUseCases: 'Use cases',
    titleUseCases: 'Built for teams and campaigns.',
    bodyUseCases:
      'Employee rewards, customer incentives, events, onboarding, wellness, Ramadan and National Day gifting — purchased in bulk at discounted rates.',
    useCases: [
      'Employee rewards',
      'Customer incentives',
      'Events & campaigns',
      'Onboarding',
      'Wellness',
      'Ramadan',
      'National Day',
      'Client gifts',
    ],
    eyebrowLetsTalk: 'Need a custom program?',
    titleLetsTalk: 'Talk to us about larger requirements.',
    bodyLetsTalk:
      'Register for self-serve bulk buying above, or send an enquiry if you need a custom catalogue, special pricing, or help planning a larger program.',
    officeTitle: 'Office',
    dohaQatar: 'Doha, Qatar',
    alreadyPartnerBefore: 'Already registered as a business buyer?',
    signInDashboard: 'Sign in to bulk deals',
    alreadyPartnerAfter: 'to browse offers, place orders and manage distribution.',
    enquiryTitle: 'Custom corporate enquiry',
    enquirySuccess: 'Thank you — your enquiry is with our team.',
    placeholderCompanyName: 'Company name',
    labelYourName: 'Your name',
    placeholderFullName: 'Full name',
    labelWorkEmail: 'Work email',
    labelTeamSize: 'Team size',
    optionSelect: 'Select',
    labelPlanning: 'What are you planning?',
    placeholderPlanning: 'Occasion, headcount, budget per person, timeline…',
    sendEnquiry: 'Send enquiry',
    formConsentBefore: 'By sending this form you agree to our',
    privacyPolicy: 'privacy policy',
    eyebrowCta: 'Corporate & bulk gift cards',
    titleCta: 'Exclusive pricing for approved business buyers.',
    bodyCta:
      'Register your company, get approved, and unlock vendor bulk deals with tiered pricing, order tracking, invoices and gift card distribution.',
    requestDemo: 'Register for bulk buying',
  },
  download: {
    eyebrow: 'The Giftly app',
    title: 'Every gift, in one pocket.',
    lede:
      'Buy, send and keep gift cards and experiences from Qatar\'s best independent businesses. Balances update as you spend, and every card has a QR code ready for the counter.',
    comingSoonOnThe: 'Coming soon on the',
    comingSoonOn: 'Coming soon on',
    testingNote:
      'The app is in final testing. Join the launch list and we will send one email when it is ready.',
    myGifts: 'My gifts',
    balanceRemaining: 'Balance remaining',
    sessionsUsed: '2 of 3 sessions',
    bookNextVisit: 'Book your next visit',
    readyToUse: 'Ready to use',
    sentInSeconds: 'Sent in seconds',
    walletReady: 'Wallet ready',
    eyebrowInside: 'Inside the app',
    titleInside: 'Small app, thoughtful details.',
    cardGiftsTitle: 'Gift cards and experiences',
    cardGiftsBody:
      'Send a flexible amount or a vendor-made package. Both live in the same place, with clear balances and expiry dates.',
    cardScanTitle: 'One scan to redeem',
    cardScanBody:
      'Show the QR code at the counter. Vendors enter the amount or sessions used and the balance updates immediately.',
    cardWalletTitle: 'Apple and Google Wallet',
    cardWalletBody:
      'Add a claimed gift to your phone\'s wallet so it is always with you, even when the app is closed.',
    cardSendTitle: 'Send it your way',
    cardSendBody:
      'Email, SMS, a link or WhatsApp. Schedule it for a birthday morning and add a note in your own words.',
    cardLanguagesTitle: 'English and Arabic',
    cardLanguagesBody:
      'The whole experience works in both languages, with a proper right-to-left layout when Arabic is selected.',
    cardRemindersTitle: 'Gentle reminders',
    cardRemindersBody:
      'A nudge before a gift expires, and a note when someone claims what you sent. No noise.',
    eyebrowBeFirst: 'Be first',
    titleBeFirst: 'Join the launch list.',
    bodyBeFirst:
      'One email when the app goes live on iPhone and Android. No newsletter, no offers, no sharing your address.',
    beFirstSuccess: 'You are on the list. We will be in touch.',
    emailAddress: 'Email address',
    notifyMe: 'Notify me',
    browseFirstBefore: 'Prefer to browse first?',
    seeVendors: 'See the vendors already on Giftly',
    alreadyGiftTitle: 'Already have a gift?',
    alreadyGiftBody:
      'If someone sent you a Giftly link, open it on this phone. You can claim the gift in the browser now; the app will pick it up when you install it.',
    howClaimingWorks: 'How claiming works',
    getHelp: 'Get help',
    walletNote:
      'Wallet buttons are visible in the app today. The live Apple and Google Wallet passes will be switched on with the public launch.',
  },
  vendors: {
    pageTitle: 'Businesses',
    eyebrow: 'The directory',
    title: 'Find a business worth leaving the house for.',
    ledeOne:
      '{count} business on Giftly, reviewed and ready to welcome you. Every gift can be spent in parts.',
    ledeMany:
      '{count} businesses on Giftly, reviewed and ready to welcome you. Every gift can be spent in parts.',
    searchPlaceholder: 'Search cafés, spas, adventures…',
    searchLabel: 'Search businesses',
    emptyTitle: 'Nothing matches that search',
    emptyBody:
      'Try a different word, or clear the filters to see everyone on Giftly.',
    clearFilters: 'Clear filters',
    enterprisePartner: 'Enterprise partner',
    qatar: 'Qatar',
    localFavourite: 'A local favourite on Giftly.',
    giftCountOne: 'gift',
    giftCountMany: 'gifts',
    viewGifts: 'View gifts',
  },
  vendorDetail: {
    notFound: 'Business not found',
    metaDescription: 'Gifts from {name} on Giftly.',
    allBusinesses: 'All businesses',
    enterprisePartner: 'Enterprise partner',
    verifiedBusiness: 'Verified business',
    qatar: 'Qatar',
    localFavourite: 'A local favourite on Giftly.',
    getTheAppToSend: 'Get the app to send',
    sentAndStored: 'Gifts are sent and stored in the Giftly app.',
    giftsFrom: 'Gifts from {name}',
    title: 'Pick something they will remember.',
    emptyTitle: 'Gifts are on the way',
    emptyBody: '{name} has not published an offer yet. Check back shortly.',
    thoughtfulGift: 'A thoughtful local gift.',
    validDays: 'Valid {days} days',
    validUntil: 'Valid until {date}',
    noExpiry: 'No expiry',
    sendThisGift: 'Send this gift',
    whereToFind: 'Where to find them',
    doha: 'Doha',
    seeVendorForHours: 'See vendor for hours',
    questionsTitle: 'Questions about this gift?',
    questionsBody:
      'Reach the Giftly team and we will help with delivery, balances or bookings.',
    contactUs: 'Contact us',
  },
  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy policy',
    lastUpdated: 'Last updated: 11 November 2026',
    collectTitle: 'What we collect',
    collectBody:
      'Account details (name, email, phone), gift and order details, delivery details for the recipient, and the information you send us through support forms. Vendors provide business details, locations and payout information. Enterprise partners provide company and contact details.',
    useTitle: 'How we use it',
    useBody:
      'To create and secure your account, issue and deliver gifts, let vendors redeem them, calculate settlements, provide support, prevent fraud and meet our legal obligations. We also use aggregated, non-identifying information to understand which parts of the marketplace are working.',
    whoTitle: 'Who sees what',
    whoBody:
      'Vendors see the details needed to fulfil and redeem a gift, such as the recipient name, voucher code and redemption history. Enterprise partners see their own inventory and redemption reports. Our team sees what is needed to operate and support the platform. We do not sell personal data.',
    paymentsTitle: 'Payments',
    paymentsBody:
      'Card payments are processed by our licensed payment provider. Giftly does not store full card numbers. Payment references and status are kept so we can reconcile orders and refunds.',
    storageTitle: 'Storage and security',
    storageBody:
      'Data is stored with our cloud database provider using encryption in transit and at rest. Access is limited by role-based policies. Enterprise codes are stored encrypted and shown only when allocated. No system is perfect; if we become aware of a breach that affects you, we will tell you.',
    retentionTitle: 'Retention',
    retentionBody:
      'We keep account and transaction records for as long as needed to provide the service and meet accounting and legal requirements. Support messages are kept for two years unless they relate to an open dispute.',
    choicesTitle: 'Your choices',
    choicesBodyOne:
      'You can ask for a copy of your data, correct it, or ask us to close your account. Some records must be kept for tax and accounting. Email',
    choicesBodyTwo: 'and we will respond within 30 days.',
    cookiesTitle: 'Cookies',
    cookiesBody:
      'The website uses essential cookies to keep you signed in to a dashboard. We do not use advertising cookies. You can clear cookies in your browser, but you will need to sign in again.',
    contactTitle: 'Contact',
    contactBodyBefore: 'Giftly, Doha, Qatar. Questions?',
    contactLink: 'Contact us',
  },
  terms: {
    eyebrow: 'Legal',
    title: 'Terms of service',
    lastUpdated: 'Last updated: 11 November 2026',
    s1Title: '1. About Giftly',
    s1Body:
      'Giftly is a marketplace that connects customers with independent businesses in Qatar. We provide the platform for buying, sending and tracking gift cards and experience packages. The goods and services themselves are supplied by the vendor named on the gift.',
    s2Title: '2. Accounts',
    s2Body:
      'You must provide accurate details and keep your sign-in credentials secure. You are responsible for activity under your account. Vendors and enterprise partners must have authority to act for the business they register.',
    s3Title: '3. Buying a gift',
    s3Body:
      'Prices are shown in Qatari riyals and include the vendor\'s price. Experience gifts are sold as fixed packages set by the vendor; monetary gifts can be bought at preset or custom amounts within the vendor\'s limits. An order is confirmed when payment is authorised and the gift is issued.',
    s4Title: '4. Delivery and claiming',
    s4Body:
      'Gift links are delivered to the contact details you provide. You are responsible for checking those details. A gift can be claimed once, by the first person who signs in and opens the link. Unclaimed gifts remain available to the buyer to resend or cancel within the cancellation window.',
    s5Title: '5. Using a gift',
    s5Body:
      'Monetary gifts keep a balance and can be spent in parts until the balance reaches zero. Experience gifts have a set number of sessions. Vendors may require a booking. Expiry dates are shown before purchase and on the gift. Gifts cannot be exchanged for cash unless required by law.',
    s6Title: '6. Vendor obligations',
    s6Body:
      'Vendors must honour valid gifts, keep their offers and opening details accurate, and redeem only through the Giftly tools. Vendors are responsible for the services they supply and for their own licences and insurance.',
    s7Title: '7. Refunds and disputes',
    s7Body:
      'Unclaimed gifts may be cancelled in line with the refund window shown at checkout. Once a gift has been claimed, refunds are at the vendor\'s discretion except where the law requires otherwise. Contact us if a gift cannot be used and we will help resolve it with the vendor.',
    s8Title: '8. Acceptable use',
    s8Body:
      'Do not use Giftly for fraud, money laundering, resale of gift codes without permission, or any unlawful purpose. We may suspend accounts or void gifts where we reasonably suspect abuse.',
    s9Title: '9. Liability',
    s9Body:
      'We run the marketplace with reasonable care, but we do not control vendor premises or services. To the extent permitted by Qatari law, our liability is limited to the value of the affected order.',
    s10Title: '10. Contact',
    s10BodyOne: 'Questions about these terms? Email',
    s10BodyTwo: 'or use the',
    contactForm: 'contact form',
  },
};

type SiteCopy = typeof en;

const ar: SiteCopy = {
  nav: {
    main: 'القائمة الرئيسية',
    vendors: 'المتاجر',
    business: 'للأعمال',
    howItWorks: 'كيف تعمل',
    contact: 'تواصل معنا',
    vendorSignIn: 'دخول المتاجر',
    getTheApp: 'حمّل التطبيق',
    openMenu: 'افتح القائمة',
    closeMenu: 'أغلق القائمة',
  },
  home: {
    heroTitleLine1: 'امنحهم هدية',
    heroTitleLine2: 'يستخدمونها فعلاً',
    heroLede:
      'أفضل المقاهي وصالونات التجميل ومراكز السبا والمغامرات المستقلة في قطر، مجمّعة في هدية واحدة مميزة. أرسلها خلال ثوانٍ، وأنفقها على دفعات، واحتفظ بها في محفظتك.',
    browseBusinesses: 'تصفّح المتاجر',
    walletReady: 'متوافقة مع Apple وGoogle Wallet',
    spendInParts: 'أنفقها على دفعات',
    englishAndArabic: 'بالإنجليزية والعربية',
    artThreeSessions: '3 جلسات',
    artSlowDown: 'خذ وقتك · صالحة 12 شهراً',
    artTreatYourself: 'كافئ نفسك · بدون انتهاء',
    artOneAdventure: 'مغامرة واحدة',
    artForTwo: 'لشخصين · كورنيش الدوحة',
    artSentWhatsApp: 'أُرسلت عبر واتساب',
    artScanCounter: 'امسح الرمز عند الصندوق',
    artAddedWallet: 'أُضيفت إلى المحفظة',
    statBusinesses: 'متاجر على Giftly',
    statGifts: 'هدايا جاهزة للإرسال',
    statCategories: 'فئات تستكشفها',
    statWays: 'طرق للإهداء',
    eyebrowThreeWays: 'تطبيق واحد، ثلاث طرق للإهداء',
    titleThreeWays: 'لأي مناسبة، هناك هدية من Giftly.',
    bodyThreeWays:
      'قهوة على حسابنا، أو أصيل كامل في السبا، أو رسالة شكر للفريق كله. كل هدية تُحفظ رقمياً ويمكن إنفاقها على دفعات.',
    typeGiftCards: 'بطاقات الهدايا',
    typeGiftCardsBody:
      'اختر متجراً ومبلغاً. ينفقون ما يحتاجونه متى شاءوا — ويبقى الرصيد على البطاقة حتى يصل إلى الصفر.',
    tagAnyAmount: 'أي مبلغ',
    tagNoChangeLost: 'لا فاقد الريال',
    typeExperiences: 'التجارب',
    typeExperiencesBody:
      'باقات يحدّدها المتجر بجلسات حقيقية: جلسة مساج، أو رحلة كاياك، أو درس طبخ. هدية واحدة، وأمسية جميلة واحدة.',
    tagPackages: 'باقات',
    tagBookATime: 'احجز موعداً',
    typeCorporateRewards: 'مكافآت المؤسسات',
    typeCorporateRewardsBody:
      'اشترِ الرموز بالجملة، ووزّعها على فريقك، وتابع بدقة ما تم استبداله. مصمّمة لفرق الموارد البشرية والمالية.',
    tagBulkCodes: 'رموز بالجملة',
    tagReports: 'تقارير',
    eyebrowLocal: 'المفضّلة محلياً',
    titleLocal: 'متاجر مستقلة تقدّم أشياء جميلة.',
    bodyLocal:
      'كل متجر تتم مراجعته قبل نشره. لا سلاسل ولا حشو — فقط أماكن تستحق أن تخرج من البيت لأجلها.',
    allBusinesses: 'كل المتاجر',
    emptyBusinessesTitle: 'المتاجر في طور الانضمام',
    emptyBusinessesBody: 'نعمل الآن على ضمّ أول شركائنا في الدوحة. عد قريباً.',
    enterprisePartner: 'شريك مؤسسي',
    qatar: 'قطر',
    localFavourite: 'من المتاجر المفضّلة محلياً على Giftly.',
    viewGifts: 'عرض الهدايا',
    eyebrowReady: 'جاهزة للإرسال',
    titleReady: 'هدايا يتبادلها الناس هذا الأسبوع.',
    emptyGiftsTitle: 'لا توجد هدايا منشورة بعد',
    emptyGiftsBody: 'فور نشر متاجرنا لعروضها، ستظهر هنا مباشرة.',
    giftlyPartner: 'شريك على Giftly',
    eyebrowSimple: 'بسيطة بالتصميم',
    titleSimple: 'من «فكّرت فيك» إلى الإرسال، في أقل من دقيقة.',
    step1Title: 'اختر هدية',
    step1Body: 'اختر متجراً أو مبلغاً أو باقة تجربة جاهزة.',
    step2Title: 'اجعلها لهم',
    step2Body: 'أضف رسالة، واختر التصميم، وحدّد موعد وصولها.',
    step3Title: 'أرسلها أينما شئت',
    step3Body: 'بريد إلكتروني، أو رسالة نصية، أو رابط — أو مباشرة عبر واتساب.',
    step4Title: 'أنفقها على مهل',
    step4Body: 'يمسحون الرمز عند الصندوق. وما يتبقّى يبقى على البطاقة.',
    eyebrowForVendors: 'للمتاجر',
    titleForVendors: 'ضع متجرك على قائمة الهدايا.',
    bodyForVendors:
      'انضم إلى سوق الهدايا في قطر. حدّد عروضك وباقاتك، واستبدل عبر مسح رمز QR، واستلم مستحقاتك من لوحة تحكم واحدة.',
    applyAsVendor: 'انضم كتاجر',
    corporateGifting: 'الهدايا المؤسسية',
    titleVerified: 'كل بطاقة موثّقة.',
    bodyVerified:
      'الأرصدة محفوظة في سجلّنا، لا في لقطة شاشة. يستبدل المتجر بالمسح، وتتحدّث القيمة المتبقّية فوراً.',
    checkPartial: 'إنفاق جزئي، دائماً',
    checkExpiry: 'تاريخ انتهاء يحدّده المتجر',
    checkWallet: 'بطاقات محفظة مع رمز QR',
    titleOneBalance: 'رصيد واحد. بلا حسابات محرجة.',
    bodyOneBalance:
      'أنفق 10 ريالات من بطاقة بقيمة 100 ريال، ويتبقّى 90 ريالاً متاحة. لا قسائم تضيع في الدرج، ولا ضغط من نوع «استخدمها أو تفقدها».',
    labelBalance: 'رصيد بطاقة الهدايا',
    labelCoffee: 'قهوة وحلوى',
    labelAvailable: 'ما زال متاحاً',
    eyebrowGoodToKnow: 'معلومة مفيدة',
    titleGoodToKnow: 'أسئلة يطرحها الناس قبل أول هدية.',
    allAnswers: 'كل الإجابات',
    faq1Q: 'هل يمكن للمستلم إنفاق جزء فقط من البطاقة؟',
    faq1A:
      'نعم. كل بطاقة هدية نقدية تحتفظ برصيد متجدد. إذا أنفق 10 ريالات من بطاقة بقيمة 100 ريال، تبقى 90 ريالاً للمرّة القادمة.',
    faq2Q: 'كيف يستلم المستلم الهدية فعلياً؟',
    faq2A:
      'يمكنك إرسالها عبر البريد الإلكتروني أو رسالة نصية أو رابط قابل للمشاركة أو واتساب. يفتح الرابط، ويضيف البطاقة إلى حسابه على Giftly، ويعرض رمز QR عند المتجر.',
    faq3Q: 'ما هي هدية التجربة؟',
    faq3A:
      'بدلاً من رصيد نقدي، تأتي هدية التجربة على شكل باقة بعدد محدّد من الجلسات — مثلاً ثلاث زيارات إلى السبا أو رحلة كاياك لشخصين. المتجر يحدّد الباقة والسعر.',
    faq4Q: 'هل تعمل بطاقات الهدايا مع Apple وGoogle Wallet؟',
    faq4A:
      'بطاقات المحفظة جزء من تجربة تطبيق Giftly. بعد استلام الهدية، يمكنك إضافتها إلى محفظة هاتفك وعرض رمز QR عند الصندوق.',
  },
  faq: {
    eyebrow: 'معلومة مفيدة',
    title: 'كل ما قد تسأل عنه قبل أول هدية.',
    lede: 'الإرسال والاستلام والإنفاق والتسوية — إليك كيف يعمل Giftly على جانبي الهدية.',
    sections: [
      {
        title: 'للشخص الذي يهدي',
        items: [
          {
            q: 'كيف أشتري هدية؟',
            a: 'افتح تطبيق Giftly، واختر متجراً، ثم اختر مبلغ بطاقة الهدايا أو باقة تجربة. أضف رسالة وتصميماً، وحدّد طريقة الإرسال، ثم ادفع. تُسلَّم الهدية كرابط يمكن للمستلم استلامه.',
          },
          {
            q: 'هل يمكنني اختيار المبلغ في التجربة؟',
            a: 'لا — هدايا التجربة باقات ينشئها المتجر. المتجر يحدّد عدد الجلسات والسعر، فكل ما عليك هو اختيار الباقة المناسبة. أما بطاقات الهدايا النقدية فتُشترى بمبالغ جاهزة أو مخصصة.',
          },
          {
            q: 'كيف أرسل هدية عبر واتساب؟',
            a: 'اختر واتساب كطريقة للتسليم، أو اضغط على «الإرسال عبر واتساب» في شاشة النجاح. يفتح Giftly واتساب الخاص بك برسالة جاهزة ورابط الهدية. أنت تضغط إرسال، فتأتي منك أنت.',
          },
          {
            q: 'هل يمكنني جدولة هدية لوقت لاحق؟',
            a: 'نعم. اختر تاريخ التسليم أثناء الدفع، وستُحفظ الهدية حتى صباح ذلك اليوم. يمكنك رؤية الهدايا المجدولة في حسابك.',
          },
          {
            q: 'هل يمكنني إلغاء هدية أو استرداد قيمتها؟',
            a: 'يمكن إلغاء الهدايا غير المستلمة من حسابك ضمن نافذة الإلغاء. وبعد استلام الهدية لا يمكن استرداد قيمتها. تواصل معنا إن كان هناك أمر غير صحيح.',
          },
        ],
      },
      {
        title: 'للشخص الذي يستلم',
        items: [
          {
            q: 'كيف أستلم هديتي؟',
            a: 'اضغط على الرابط الموجود في الرسالة التي وصلتتك. إذا كان لديك حساب على Giftly فسجّل الدخول، وإن لم يكن فأنشئ حساباً بالبريد الإلكتروني أو رقم الهاتف نفسه. تُضاف الهدية تلقائياً إلى «هداياي».',
          },
          {
            q: 'هل يمكنني إنفاق جزء فقط من بطاقة الهدايا؟',
            a: 'نعم. تحتفظ البطاقات النقدية برصيد متجدد. أنفق 10 ريالات من بطاقة بقيمة 100 ريال، وتبقى 90 ريالاً لزيارتك القادمة. يتحدّث الرصيد عند الصندوق وفي التطبيق.',
          },
          {
            q: 'كيف أستخدم هدية التجربة؟',
            a: 'افتح الهدية من «هداياي» واتّبع تعليمات الحجز لدى المتجر. بعض التجارب تتطلّب حجزاً، وبعضها يمكن استخدامها خلال ساعات العمل. توضّح البطاقة كم جلسة متبقية.',
          },
          {
            q: 'هل تنتهي صلاحية الهدايا؟',
            a: 'يحدّد كل متجر تاريخ انتهاء لهداياه. يظهر التاريخ على الهدية قبل استلامها وعلى البطاقة بعده. أما الهدايا التي بلا تاريخ انتهاء فتبقى صالحة حتى يصل الرصيد إلى الصفر.',
          },
          {
            q: 'هل يمكنني إضافة هدية إلى Apple أو Google Wallet؟',
            a: 'نعم — افتح الهدية المستلمة في التطبيق واستخدم «إضافة إلى المحفظة». تعرض البطاقة الرصيد ورمز QR الذي يمسحه المتاجرون عند الصندوق.',
          },
        ],
      },
      {
        title: 'للمتاجر',
        items: [
          {
            q: 'كيف أنضم إلى Giftly؟',
            a: 'قدّم طلبك من صفحة التسجيل للمتاجر. أخبرنا عن متجرك وما تبيعه وأين كنت. يراجع فريقنا كل طلب قبل نشر عروضك.',
          },
          {
            q: 'كيف أستبدل هدية؟',
            a: 'افتح شاشة «الاستبدال» في لوحة تحكم المتجر، وأدخل رمز البطاقة، واختر المبلغ أو عدد الجلسات المستخدمة. يتحدّث الرصيد فوراً ويُسجَّل مرجع في تقاريرك.',
          },
          {
            q: 'متى أستلم مستحقاتي؟',
            a: 'تُحتسب مستحقات المتجر من الطلبات المدفوعة ناقص العمولة المتفق عليها. تعرض لوحة تحكمك المبيعات والعمولة وحصتك. وتُصرف المستحقات وفق دورة التسوية المتفق عليها.',
          },
          {
            q: 'هل يمكنني تحديد أسعاري وباقاتي؟',
            a: 'نعم. للعروض النقدية حدّ أدنى وحدّ أقصى ومبالغ جاهزة. أما عروض التجارب فهي باقات تعرّفها أنت، مع تسمية وعدد جلسات وسعر.',
          },
        ],
      },
      {
        title: 'للشركات',
        items: [
          {
            q: 'هل يمكننا شراء هدايا بالجملة؟',
            a: 'نعم. يشتري الشركاء المؤسسيون الرموز بالجملة، ويستوردونها إلى لوحة التحكم، ويوزّعونها على الموظفين أو العملاء. كل رمز مشفّر عند التخزين ولا يظهر إلا عند توزيعه.',
          },
          {
            q: 'هل يمكننا متابعة عمليات الاستبدال؟',
            a: 'تعرض لوحة التحكم المؤسسية الرموز المتاحة والموزّعة والمسلّمة والمستبدَلة، إضافة إلى تقارير حسب المنتج والفترة. يمكنك تصدير البيانات متى احتجت.',
          },
          {
            q: 'هل يمكن وضع علامتنا التجارية على المكافآت؟',
            a: 'يمكننا إضافة رسالة الشركة إلى بريد التسليم والاتفاق على كتالوج مخصّص للبرامج الأكبر. تحدّث مع فريقنا المؤسسي حول ما تحتاجه.',
          },
        ],
      },
    ],
    stillStuck: 'ما زلت متعثراً؟',
    stillStuckBody: 'أرسل لنا رسالة وسيرد عليك شخص حقيقي، عادةً في اليوم نفسه.',
    contactSupport: 'تواصل مع الدعم',
    browseVendors: 'تصفّح المتاجر',
  },
  contact: {
    eyebrow: 'قل مرحباً',
    title: 'نحن أشخاص حقيقيون في الدوحة.',
    lede: 'أسئلة عن هدية أو رصيد أو حجز أو شراكة — أرسل لنا رسالة وسنساعدك.',
    formTitle: 'أرسل لنا رسالة',
    formSuccess: 'شكراً لك — وصلتنا رسالتك وسيراجعها فريقنا.',
    labelYourName: 'اسمك',
    placeholderFullName: 'الاسم الكامل',
    labelSubject: 'الموضوع',
    subjectGiftSupport: 'دعم الهدايا',
    subjectVendorQuestion: 'استفسار للمتاجر',
    subjectCorporateGifting: 'الهدايا المؤسسية',
    subjectPress: 'صحافة أو شراكة',
    subjectOther: 'موضوع آخر',
    labelMessage: 'الرسالة',
    placeholderHowCanWeHelp: 'كيف يمكننا مساعدتك؟',
    sendMessage: 'إرسال الرسالة',
    replyNoteBefore: 'نردّ عادةً خلال يوم عمل واحد. راجع',
    privacyPolicy: 'سياسة الخصوصية',
    replyNoteAfter: 'للمعرفة كيف نتعامل مع بياناتك.',
    phoneHours: 'من الأحد إلى الخميس، 9 صباحاً – 6 مساءً',
    officeTitle: 'المكتب',
    dohaQatar: 'الدوحة، قطر',
    visitsByAppointment: 'الزيارة بموعد مسبق.',
    forVendorsTitle: 'للمتاجر',
    forVendorsBody:
      'هل تبيع بالفعل على Giftly؟ سجّل الدخول إلى لوحة التحكم للحصول على دعم الطلبات والاستبدال.',
    vendorFaq: 'أسئلة المتاجر',
    corporateQuoteBefore: 'تبحث عن عرض سعر مؤسسي؟ استخدم',
    enterpriseEnquiryForm: 'نموذج الاستفسار المؤسسي',
    corporateQuoteAfter: 'حتى تصل إلى الفريق المختص.',
  },
  corporate: {
    eyebrow: 'Giftly للأعمال',
    title: 'اشترِ بطاقات الهدايا بالجملة لفريقك وعملائك.',
    lede:
      'سجّل كمشتري أعمال/جملة للوصول إلى عروض الشركات الحصرية وأسعار الكميات من البائعين على Giftly. احصل على الموافقة، وتصفّح العروض، وأرسل الطلبات، ووزّع بطاقات الهدايا الرقمية من مكان واحد.',
    talkToTeam: 'اشترِ بالجملة',
    partnerSignIn: 'تسجيل دخول الأعمال',
    trustInvoice: 'فواتير وإيصالات',
    trustReporting: 'سجل الطلبات والتصدير',
    trustLocal: 'أسعار جملة حصرية',
    tileMembers: 'سجّل شركتك',
    tileMembersBody: 'قدّم بيانات الشركة للمراجعة',
    tileEach: 'وصول بعد الموافقة',
    tileEachBody: 'أسعار الجملة متاحة للمشترين المعتمدين فقط',
    tileRedeemed: 'اطلب ووزّع',
    tileRedeemedBody: 'تابع الطلبات وصدّر بطاقات الهدايا',
    eyebrowWhy: 'لماذا Giftly',
    titleWhy: 'شراء بطاقات الهدايا بالجملة مدمج في Giftly.',
    cardLocalTitle: 'عروض جملة حصرية من البائعين',
    cardLocalBody:
      'ينشر البائعون منتجات مخصّصة للجملة بأسعار مخفّضة وشرائح كمية. لا تظهر أسعار الجملة للعملاء العاديين أبداً.',
    cardNumbersTitle: 'إجماليات وتوفير واضح',
    cardNumbersBody:
      'اختر الكميات، وشاهد تسعير الشرائح والإجمالي يتحدّث تلقائياً، وأرسل طلبات الجملة مع تفاصيل محاسبية كاملة.',
    cardSafeTitle: 'موافقة وأمان',
    cardSafeBody:
      'تتم مراجعة حسابات الأعمال واعتمادها من الإدارة. وتُطبَّق قيود الوصول إلى عروض وأسعار الجملة عبر صلاحيات الخادم، وليس الواجهة فقط.',
    eyebrowHow: 'كيف تعمل',
    titleHow: 'من التسجيل إلى التوزيع في أربع خطوات.',
    bodyHow:
      'أنشئ حساب أعمال، واحصل على الموافقة، واشترِ عروض بطاقات الهدايا بالجملة بأسعار حسب الكمية مع توزيع رقمي.',
    check1: 'سجّل كمشتري أعمال/جملة وأدخل بيانات شركتك',
    check2: 'انتظر موافقة الإدارة لفتح عروض وأسعار الجملة المقيدة',
    check3: 'تصفّح العروض، اختر الكمية، يُطبَّق تسعير الشرائح تلقائياً وأرسل طلب الجملة',
    check4: 'تابع الطلبات، حمّل الفواتير/الإيصالات وصدّر/وزّع بطاقات الهدايا (CSV/Excel)',
    timeline: [
      { title: 'التسجيل', body: 'أنشئ حساب أعمال مع بيانات الشركة وجهة الاتصال.' },
      { title: 'الموافقة', body: 'تراجع الإدارة طلبك وتعتمد وصول مشتري الجملة.' },
      { title: 'عروض الجملة', body: 'تصفّح العروض الحصرية وشرائح الأسعار وأرسل طلبات الجملة.' },
      { title: 'التوزيع', body: 'اعرض الطلبات والفواتير وصدّر/عيّن بطاقات الهدايا للمستلمين.' },
    ],
    eyebrowUseCases: 'حالات الاستخدام',
    titleUseCases: 'مصمّمة للفرق والحملات.',
    bodyUseCases:
      'مكافآت الموظفين، حوافز العملاء، الفعاليات، الترحيب بالموظفين، العافية، وهدايا رمضان واليوم الوطني — تُشترى بالجملة بأسعار مخفّضة.',
    useCases: [
      'مكافآت الموظفين',
      'حوافز العملاء',
      'الفعاليات والحملات',
      'الترحيب بالموظفين',
      'العافية',
      'رمضان',
      'اليوم الوطني',
      'هدايا العملاء',
    ],
    eyebrowLetsTalk: 'تحتاج برنامجاً مخصّصاً؟',
    titleLetsTalk: 'تحدّث معنا حول المتطلبات الأكبر.',
    bodyLetsTalk:
      'سجّل للشراء بالجملة ذاتياً أعلاه، أو أرسل استفساراً إذا كنت تحتاج كتالوجاً مخصّصاً أو تسعيراً خاصاً أو مساعدة في تخطيط برنامج أكبر.',
    officeTitle: 'المكتب',
    dohaQatar: 'الدوحة، قطر',
    alreadyPartnerBefore: 'مسجّل بالفعل كمشتري أعمال؟',
    signInDashboard: 'سجّل الدخول إلى عروض الجملة',
    alreadyPartnerAfter: 'لتصفّح العروض وإرسال الطلبات وإدارة التوزيع.',
    enquiryTitle: 'استفسار مؤسسي مخصّص',
    enquirySuccess: 'شكراً لك — وصل استفسارك وسيراجعه فريقنا.',
    placeholderCompanyName: 'اسم الشركة',
    labelYourName: 'اسمك',
    placeholderFullName: 'الاسم الكامل',
    labelWorkEmail: 'البريد الإلكتروني للعمل',
    labelTeamSize: 'عدد الفريق',
    optionSelect: 'اختر',
    labelPlanning: 'ما الذي تخطّط له؟',
    placeholderPlanning: 'المناسبة، عدد الأشخاص، الميزانية لكل شخص، الجدول الزمني…',
    sendEnquiry: 'إرسال الاستفسار',
    formConsentBefore: 'بإرسال هذا النموذج، فإنك توافق على',
    privacyPolicy: 'سياسة الخصوصية',
    eyebrowCta: 'بطاقات هدايا للشركات والجملة',
    titleCta: 'أسعار حصرية لمشتري الأعمال المعتمدين.',
    bodyCta:
      'سجّل شركتك، واحصل على الموافقة، وافتح عروض الجملة من البائعين مع تسعير الشرائح وتتبع الطلبات والفواتير وتوزيع بطاقات الهدايا.',
    requestDemo: 'سجّل للشراء بالجملة',
  },
  download: {
    eyebrow: 'تطبيق Giftly',
    title: 'كل هدية في جيب واحد.',
    lede:
      'اشترِ وأرسل واحتفظ ببطاقات الهدايا والتجارب من أفضل المتاجر المستقلة في قطر. تتحدّث الأرصدة مع إنفاقك، وتحمل كل بطاقة رمز QR جاهزاً عند الصندوق.',
    comingSoonOnThe: 'قريباً على',
    comingSoonOn: 'قريباً على',
    testingNote:
      'التطبيق في مراحل الاختبار النهائية. انضم إلى قائمة الإطلاق وسنرسل لك رسالة واحدة عندما يكون جاهزاً.',
    myGifts: 'هداياي',
    balanceRemaining: 'الرصيد المتبقي',
    sessionsUsed: '2 من 3 جلسات',
    bookNextVisit: 'احجز زيارتك القادمة',
    readyToUse: 'جاهزة للاستخدام',
    sentInSeconds: 'تُرسل خلال ثوانٍ',
    walletReady: 'المحفظة جاهزة',
    eyebrowInside: 'داخل التطبيق',
    titleInside: 'تطبيق صغير، وتفاصيل مدروسة.',
    cardGiftsTitle: 'بطاقات هدايا وتجارب',
    cardGiftsBody:
      'أرسل مبلغاً مرناً أو باقة من إعداد المتجر. كلاهما في المكان نفسه، مع أرصدة واضحة وتواريخ انتهاء.',
    cardScanTitle: 'مسح واحد للاستبدال',
    cardScanBody:
      'اعرض رمز QR عند الصندوق. يسجّل المتجر المبلغ أو عدد الجلسات المستخدمة ويتحدّث الرصيد فوراً.',
    cardWalletTitle: 'Apple وGoogle Wallet',
    cardWalletBody:
      'أضف الهدية المستلمة إلى محفظة هاتفك لتبقى معك دائماً، حتى عند إغلاق التطبيق.',
    cardSendTitle: 'أرسلها بالطريقة التي تناسبك',
    cardSendBody:
      'بريد إلكتروني، أو رسالة نصية، أو رابط، أو واتساب. جدوِلها لصباح عيد ميلاد وأضف رسالة بكلماتك.',
    cardLanguagesTitle: 'العربية والإنجليزية',
    cardLanguagesBody:
      'تعمل التجربة بالكامل باللغتين، مع تخطيط صحيح من اليمين إلى اليسار عند اختيار العربية.',
    cardRemindersTitle: 'تذكيرات لطيفة',
    cardRemindersBody:
      'تنبيه قبل انتهاء صلاحية الهدية، ورسالة عند استلام أحدهم لما أرسلته. بلا ضجيج.',
    eyebrowBeFirst: 'كن أول من يعرف',
    titleBeFirst: 'انضم إلى قائمة الإطلاق.',
    bodyBeFirst:
      'رسالة واحدة عندما ينطلق التطبيق على iPhone وAndroid. بلا نشرة بريدية، وبلا عروض، وبلا مشاركة عنوانك.',
    beFirstSuccess: 'أنت على القائمة. سنتواصل معك.',
    emailAddress: 'عنوان البريد الإلكتروني',
    notifyMe: 'أبلغوني',
    browseFirstBefore: 'تفضّل التصفّح أولاً؟',
    seeVendors: 'اطّلع على المتاجر الموجودة بالفعل على Giftly',
    alreadyGiftTitle: 'لديك هدية بالفعل؟',
    alreadyGiftBody:
      'إذا أرسل لك أحدهم رابط Giftly، فافتحه على هذا الهاتف. يمكنك استلام الهدية في المتصفح الآن، وسيتعرّف عليها التطبيق عند تثبيته.',
    howClaimingWorks: 'كيف تتم عملية الاستلام',
    getHelp: 'احصل على المساعدة',
    walletNote:
      'أزرار المحفظة ظاهرة في التطبيق اليوم. أما بطاقات Apple وGoogle Wallet الفعّالة فسيُفعَّلها مع الإطلاق العلني.',
  },
  vendors: {
    pageTitle: 'المتاجر',
    eyebrow: 'الدليل',
    title: 'اكتشف متجراً يستحق أن تخرج من البيت لأجله.',
    ledeOne:
      '{count} متجر على Giftly، تمت مراجعته وجاهز لاستقبالك. كل هدية يمكن إنفاقها على دفعات.',
    ledeMany:
      '{count} متاجر على Giftly، تمت مراجعتها وجاهزة لاستقبالك. كل هدية يمكن إنفاقها على دفعات.',
    searchPlaceholder: 'ابحث عن مقاهي وسبا ومغامرات…',
    searchLabel: 'ابحث في المتاجر',
    emptyTitle: 'لا توجد نتائج مطابقة',
    emptyBody: 'جرّب كلمة أخرى، أو امسح عوامل التصفية لعرض كل ما هو موجود على Giftly.',
    clearFilters: 'مسح عوامل التصفية',
    enterprisePartner: 'شريك مؤسسي',
    qatar: 'قطر',
    localFavourite: 'من المتاجر المفضّلة محلياً على Giftly.',
    giftCountOne: 'هدية',
    giftCountMany: 'هدايا',
    viewGifts: 'عرض الهدايا',
  },
  vendorDetail: {
    notFound: 'لم يتم العثور على المتجر',
    metaDescription: 'هدايا من {name} على Giftly.',
    allBusinesses: 'كل المتاجر',
    enterprisePartner: 'شريك مؤسسي',
    verifiedBusiness: 'متجر موثّق',
    qatar: 'قطر',
    localFavourite: 'من المتاجر المفضّلة محلياً على Giftly.',
    getTheAppToSend: 'حمّل التطبيق للإرسال',
    sentAndStored: 'تُرسل الهدايا وتُحفظ في تطبيق Giftly.',
    giftsFrom: 'هدايا من {name}',
    title: 'اختر شيئاً لا يُنسى.',
    emptyTitle: 'الهدايا في الطريق',
    emptyBody: 'لم ينشر {name} أي عرض بعد. عد قريباً.',
    thoughtfulGift: 'هدية محلية مميزة.',
    validDays: 'صالحة {days} يوماً',
    validUntil: 'صالحة حتى {date}',
    noExpiry: 'بدون انتهاء',
    sendThisGift: 'أرسل هذه الهدية',
    whereToFind: 'أين تجدهم',
    doha: 'الدوحة',
    seeVendorForHours: 'راجع المتجر لمعرفة أوقات العمل',
    questionsTitle: 'أسئلة حول هذه الهدية؟',
    questionsBody: 'تواصل مع فريق Giftly وسنساعدك في التسليم والأرصدة والحجوزات.',
    contactUs: 'تواصل معنا',
  },
  privacy: {
    eyebrow: 'قانوني',
    title: 'سياسة الخصوصية',
    lastUpdated: 'آخر تحديث: 11 نوفمبر 2026',
    collectTitle: 'ما الذي نجمعه',
    collectBody:
      'بيانات الحساب (الاسم والبريد الإلكتروني ورقم الهاتف)، وبيانات الهدايا والطلبات، وبيانات تسليم المستلم، والمعلومات التي ترسلها إلينا عبر نماذج الدعم. وتقدّم المتاجر بيانات النشاط والمواقع ومعلومات التحويل البنكي. وتقدّم الشركاء المؤسسيون بيانات الشركة وبيانات التواصل.',
    useTitle: 'كيف نستخدمها',
    useBody:
      'لإنشاء حسابك وتأمينه، وإصدار الهدايا وتسليمها، والسماح للمتاجر باستبدالها، وحساب التسويات، وتقديم الدعم، ومنع الاحتيال، والوفاء بالتزاماتنا القانونية. ونستخدم أيضاً معلومات مجمّعة لا تكشف عن هويتك لفهم أجزاء السوق التي تعمل جيداً.',
    whoTitle: 'من يرى ماذا',
    whoBody:
      'ترى المتاجر التفاصيل اللازمة لتنفيذ الهدية واستبدالها، مثل اسم المستلم ورمز القسيمة وسجل الاستبدال. وترى الشركاء المؤسسيون مخزونها وتقارير الاستبدال الخاصة بهم. ويري فريقنا ما يلزم لتشغيل المنصة ودعمها. ولا نبيع البيانات الشخصية.',
    paymentsTitle: 'المدفوعات',
    paymentsBody:
      'تتم معالجة مدفوعات البطاقات عبر مزوّد خدمات الدفع المرخّص لنا. ولا يحتفظ Giftly بأرقام البطاقات الكاملة. ونحتفظ بمراجع الدفع وحالته، حتى نتمكّن من تصفية الطلبات والاستردادات.',
    storageTitle: 'التخزين والأمان',
    storageBody:
      'تُخزَّن البيانات لدى مزوّد قواعد البيانات السحابي لدينا مع التشفير أثناء النقل وفي حالة السكون. وتُقيَّد الوصول بسياسات قائمة على الأدوار. وتُخزَّن الرموز المؤسسية مشفّرة ولا تظهر إلا عند توزيعها. ولا يوجد نظام مثالي؛ وإذا تأكدنا من وقوع اختراق يمسّك فسنُبلغك.',
    retentionTitle: 'مدة الاحتفاظ',
    retentionBody:
      'نحتفظ بسجلات الحسابات والمعاملات طالما كانت ضرورية لتقديم الخدمة والوفاء بالمتطلبات المحاسبية والقانونية. وتُحفظ رسائل الدعم لمدة عامين إلا إذا كانت تتعلق بنزاع لم يُغلق.',
    choicesTitle: 'خياراتك',
    choicesBodyOne:
      'يمكنك أن تطلب نسخة من بياناتك أو تصحيحها أو أن تطلب إغلاق حسابك. ويجب الاحتفاظ ببعض السجلات للضرائب والمحاسبة. راسلنا على',
    choicesBodyTwo: 'وسنردّ عليك خلال 30 يوماً.',
    cookiesTitle: 'ملفات تعريف الارتباط',
    cookiesBody:
      'يستخدم الموقع ملفات تعريف ارتباط ضرورية لإبقائك مسجّل الدخول إلى لوحة التحكم. ولا نستخدم ملفات تعريف ارتباط إعلانية. يمكنك مسحها من متصفحك، لكنك ستحتاج إلى تسجيل الدخول من جديد.',
    contactTitle: 'تواصل معنا',
    contactBodyBefore: 'Giftly، الدوحة، قطر. هل لديك أسئلة؟',
    contactLink: 'تواصل معنا',
  },
  terms: {
    eyebrow: 'قانوني',
    title: 'شروط الخدمة',
    lastUpdated: 'آخر تحديث: 11 نوفمبر 2026',
    s1Title: '1. عن Giftly',
    s1Body:
      'Giftly سوق يربط العملاء بالمتاجر المستقلة في قطر. ونوفّر المنصة لشراء بطاقات الهدايا وباقات التجارب وإرسالها ومتابعتها. أما السلع والخدمات نفسها فيوفّرها المتجر المذكور على الهدية.',
    s2Title: '2. الحسابات',
    s2Body:
      'يجب أن تقدّم بيانات دقيقة وتحافظ على سرية بيانات تسجيل الدخول. وأنت مسؤول عن النشاط الذي يتم عبر حسابك. ويجب أن يكون للمتاجر والشركاء المؤسسيين صلاحية التصرّف نيابةً عن المتجر الذي يسجّلون فيه.',
    s3Title: '3. شراء هدية',
    s3Body:
      'تُعرض الأسعار بالريال القطري وتشمل سعر المتجر. وتُباع هدايا التجارب كباقات ثابتة يحدّدها المتجر؛ أما الهدايا النقدية فيمكن شراؤها بمبالغ جاهزة أو مخصصة ضمن حدود المتجر. ويُعتبر الطلب مؤكّداً عند الموافقة على الدفع وإصدار الهدية.',
    s4Title: '4. التسليم والاستلام',
    s4Body:
      'تُسلَّم روابط الهدايا إلى بيانات التواصل التي تقدّمها. وأنت مسؤول عن التحقق من تلك البيانات. ويمكن استلام الهدية مرة واحدة، من أول شخص يسجّل الدخول ويفتح الرابط. وتبقى الهدايا غير المستلمة متاحة للمشتري لإعادة إرسالها أو إلغائها ضمن نافذة الإلغاء.',
    s5Title: '5. استخدام الهدية',
    s5Body:
      'تحتفظ الهدايا النقدية برصيد ويمكن إنفاقها على دفعات حتى يصل الرصيد إلى الصفر. أما هدايا التجارب فلها عدد محدّد من الجلسات. وقد يطلب المتجر حجزاً. وتظهر تواريخ الانتهاء قبل الشراء وعلى الهدية. ولا يمكن استبدال الهدايا نقداً إلا إذا اقتضى القانون ذلك.',
    s6Title: '6. التزامات المتاجر',
    s6Body:
      'يجب على المتاجر الوفاء بالهدايا السارية، والحفاظ على دقة عروضها ومعلومات ساعات عملها، والاستبدال عبر أدوات Giftly فقط. وتتحمّل المتاجر مسؤولية الخدمات التي تقدّمها وتراخيصها وتأمينها.',
    s7Title: '7. الاستردادات والنزاعات',
    s7Body:
      'يمكن إلغاء الهدايا غير المستلمة وفقاً لنافذة الاسترداد المعروضة عند الدفع. وبعد استلام الهدية تكون الاستردادات وفق تقدير المتجر، إلا إذا نص القانون على خلاف ذلك. تواصل معنا إذا تعذّر استخدام هدية وسنساعدك في حلها مع المتجر.',
    s8Title: '8. الاستخدام المقبول',
    s8Body:
      'لا تستخدم Giftly في الاحتيال أو غسل الأموال أو إعادة بيع رموز الهدايا دون إذن أو لأي غرض غير قانوني. وقد نعلّق الحسابات أو نلغي الهدايا عند الاشتباه المعقول في إساءة الاستخدام.',
    s9Title: '9. المسؤولية',
    s9Body:
      'نشغّل السوق بعناية معقولة، لكننا لا نتحكّم في منشآت المتاجر أو خدماتهم. وإلى الحدّ الذي يسمح به القانون القطري، تقتصر مسؤوليتنا على قيمة الطلب المتأثر.',
    s10Title: '10. تواصل معنا',
    s10BodyOne: 'هل لديك أسئلة حول هذه الشروط؟ راسلنا على',
    s10BodyTwo: 'أو استخدم',
    contactForm: 'نموذج التواصل',
  },
};

export const site: Copy<SiteCopy> = { en, ar };
export type SiteCopyShape = SiteCopy;
