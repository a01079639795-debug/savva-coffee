/* ============================================================================
   SAVVA | سافا — content source of truth
   ----------------------------------------------------------------------------
   EVERY factual value below is taken from a verified SAVVA source:

     • Google Maps listing ("سافا savva", Zubairah Al Roumiah, Bir Uthman,
       Madinah 42331) — name, address (in both languages, as Google writes
       them), coordinates, plus code, phone, opening hours, rating, review
       count, category, and the guest reviews quoted below.
     • Instagram @savva_cafe — brand name lockup, positioning line
       ("Specialty coffee"), city line, and the brand's own tagline.
     • The SAVVA menu PDF — every category, item name (EN + AR), price in SAR
       and calorie value, extracted from the file's own text layer.
     • OpenStreetMap — the streets, buildings and landmarks on the map
       (src/map-data.json, baked by tools/fetch-map.js).

   Nothing here is invented. If a value cannot be sourced it is left out.
   ========================================================================== */

const site = {
  // ⚠ Set this to the real production domain before deploying.
  // It is used for canonical URLs, hreflang alternates and Open Graph only.
  url: process.env.SITE_URL || 'https://savvacoffee.sa',
  ogImage: '/assets/img/three-cups-shadow.jpg'
};

/* --- Verified business facts (Google Maps + Instagram) ------------------- */
const facts = {
  nameLatin: 'SAVVA',
  nameArabic: 'سافا',
  handle: 'savva_cafe',
  instagram: 'https://www.instagram.com/savva_cafe/',
  tagline: 'A day in savva is what you need to be savva',
  phone: '+966 56 437 0303',
  phoneHref: '+966564370303',
  street: 'Zubairah Al Roumiah, Bir Uthman',
  streetAr: 'زنيره الروميه، بئر عثمان',
  cityEn: 'Madinah 42331',
  cityAr: 'المدينة المنورة 42331',
  countryEn: 'Saudi Arabia',
  countryAr: 'المملكة العربية السعودية',
  plusCode: 'FHVJ+3W',
  lat: 24.4926931,
  lng: 39.5823565,
  rating: '4.7',
  reviewCount: 729,
  mapsShort: 'https://maps.app.goo.gl/geB2uSVz2UD7soM46',
  directions: 'https://www.google.com/maps/dir/?api=1&destination=24.4926931,39.5823565',
  reviewsUrl: 'https://www.google.com/maps/search/?api=1&query=24.4926931,39.5823565',
  hours: [
    { days: { en: 'Saturday – Thursday', ar: 'السبت – الخميس' }, time: { en: '6:30 AM – 2:00 AM', ar: '6:30 ص – 2:00 ص' }, schema: ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th'], open: '06:30', close: '02:00' },
    { days: { en: 'Friday', ar: 'الجمعة' }, time: { en: '1:00 PM – 2:00 AM', ar: '1:00 م – 2:00 ص' }, schema: ['Fr'], open: '13:00', close: '02:00' }
  ]
};

/* --- The menu, exactly as printed -----------------------------------------
   `price` is in Saudi Riyal, `cals` is the calorie figure printed alongside.
   Four English spellings are corrected from the print file where the Arabic
   confirms the intended product: FLAT WAIT → Flat White, WAIT MOCAH → White
   Mocha, ICE WAIT MOCHA → Ice White Mocha, CHEEESECAKE → Cheesecake.

   Every item carries a picture so a guest can see what the name is:
     • `photo` — SAVVA's own photograph of that very item, cropped to a square
       around it: `at` is the centre and `span` the side of the square, both
       in the photo's own pixels. Only where the item is certain: Matcha Berry
       and Savva Melon are captioned by name on SAVVA's post; the hibiscus pour
       and the halloumi sandwich are the drink and dish already paired with
       those photos elsewhere on the page.
     • `art` — otherwise, a drawing from src/menu-art.js of that kind of drink
       or dish. Add a `photo` to any item and it replaces the drawing.
   -------------------------------------------------------------------------- */
const menu = [
  {
    id: 'hot',
    en: 'Hot Drinks', ar: 'المشروبات الحارة',
    kicker: { en: 'Coffee', ar: 'قهوة' },
    items: [
      { en: 'Espresso', ar: 'إسبريسو', price: 11, cals: 2, art: 'espresso' },
      { en: 'Americano', ar: 'أمريكانو', price: 12, cals: 2, art: 'americano' },
      { en: 'Cortado', ar: 'كورتادو', price: 14, cals: 50, art: 'cortado' },
      { en: 'Macchiato', ar: 'ميكاتو', price: 13, cals: 13, art: 'macchiato' },
      { en: 'Flat White', ar: 'فلات وايت', price: 15, cals: 50, art: 'flatwhite' },
      { en: 'Latte', ar: 'لاتيه', price: 16, cals: 75, art: 'latte' },
      { en: 'Cappuccino', ar: 'كابتشينو', price: 16, cals: 60, art: 'cappuccino' },
      { en: 'Spanish Latte', ar: 'سبانش لاتيه', price: 18, cals: 178, art: 'spanish' },
      { en: 'Matcha Latte', ar: 'ماتشا لاتيه', price: 16, cals: 75, art: 'matchalatte' },
      { en: 'White Mocha', ar: 'وايت موكا', price: 16, cals: 230, art: 'whitemocha' },
      { en: 'Hot Chocolate', ar: 'هوت شوكليت', price: 15, cals: 237, art: 'hotchoc' },
      { en: 'English Tea', ar: 'شاي انجليزي', price: 6, cals: 2, art: 'tea' },
      { en: 'Turkish Coffee', ar: 'تركي سادة', price: 11, cals: 50, art: 'turkish' },
      { en: 'Turkish Coffee with Milk', ar: 'تركي حليب', price: 13, cals: 50, art: 'turkishmilk' },
      { en: 'Coffee of the Day — Hot / Ice', ar: 'قهوة اليوم بارد / حار', price: '10 – 13', art: 'daycoffee' },
      { en: 'V60 / Ice Drip', ar: 'قهوة المقطرة', price: 18, art: 'v60' }
    ]
  },
  {
    id: 'cold',
    en: 'Cold Drinks', ar: 'المشروبات الباردة',
    kicker: { en: 'Coffee', ar: 'قهوة' },
    items: [
      { en: 'Iced Americano', ar: 'ايس أمركانو', price: 15, cals: 2, art: 'iced-americano' },
      { en: 'Alfredo', ar: 'ألفريدو', price: 14, cals: 100, art: 'alfredo' },
      { en: 'Iced Latte', ar: 'ايس لاتيه', price: 17, cals: 100, art: 'iced-latte' },
      { en: 'Iced Spanish Latte', ar: 'ايس سبانيش لاتيه', price: 19, cals: 230, art: 'iced-spanish' },
      { en: 'Iced Matcha Latte', ar: 'ايس ماتشا لاتيه', price: 17, cals: 130, art: 'iced-matcha' },
      { en: 'Iced Matcha Spanish Latte', ar: 'ايس ماتشا سبانيش لاتيه', price: 19, cals: 230, art: 'iced-matcha-spanish' },
      { en: 'Savva Matcha', ar: 'سافا ماتشا', price: 22, cals: 2, signature: true, art: 'savva-matcha' },
      { en: 'Matcha Berry', ar: 'ماتشا بيري', price: 24, cals: 230, signature: true, art: 'matcha-berry',
        photo: { src: '/assets/img/matcha-berry-melon.jpg', size: [360, 640], at: [85, 400], span: 170 } },
      { en: 'Ice Tea Savva', ar: 'ايس تي سافا', price: 17, cals: 189, signature: true, art: 'iced-tea' },
      { en: 'Ice Hibiscus Savva', ar: 'ايس كركديه سافا', price: 17, cals: 180, signature: true, art: 'iced-hibiscus' },
      { en: 'Hibiscus Slush Savva', ar: 'سلاش كركديه سافا', price: 17, cals: 180, signature: true, art: 'hibiscus-slush',
        photo: { src: '/assets/img/hibiscus-pour.jpg', size: [480, 640], at: [238, 370], span: 380 } },
      { en: 'Ice Shaken', ar: 'ايس شيكن', price: 20, cals: 231, art: 'shaken' },
      { en: 'Ice White Mocha', ar: 'ايس وايت موكا', price: 19, cals: 230, art: 'iced-whitemocha' },
      { en: 'Ice Chocolate', ar: 'ايس شوكلت', price: 17, cals: 230, art: 'iced-choc' },
      { en: 'Savva Melon', ar: 'شمام سافا', price: 16, cals: 50, signature: true, art: 'melon',
        photo: { src: '/assets/img/melon-in-hand.jpg', size: [477, 640], at: [238, 330], span: 420 } }
    ]
  },
  {
    id: 'desserts',
    en: 'Desserts', ar: 'الحلى',
    kicker: { en: 'Pastry', ar: 'معجّنات' },
    items: [
      { en: 'Madini Cookies', ar: 'مديني كوكيز', price: 12, cals: 170, art: 'cookies' },
      { en: 'Cinnamon Danish', ar: 'دانيش سينابون', price: 19, cals: 170, art: 'danish' },
      { en: 'Marble Cake', ar: 'ماربل كيك', price: 11, cals: 170, art: 'marble' },
      { en: 'Crunchy Chocolate', ar: 'كرانشي شوكلت', price: 8, cals: 170, art: 'crunchy' },
      { en: 'Blueberry Cheesecake', ar: 'تشيز كيك بلوبيري', price: 27, cals: 170, art: 'cheesecake' },
      { en: 'Pecan Cake', ar: 'كيكة البيكان', price: 21, cals: 170, art: 'pecan' },
      { en: 'Chocolate Cake', ar: 'كيكة شوكلت', price: 18, cals: 170, art: 'chococake' }
    ]
  },
  {
    id: 'breakfast',
    en: 'Breakfast', ar: 'الفطور',
    kicker: { en: 'Kitchen', ar: 'المطبخ' },
    items: [
      { en: 'Turkey Sandwich', ar: 'ساندوتش تركي', price: 19, cals: 300, art: 'sandwich-turkey' },
      { en: 'Halloumi Sandwich', ar: 'ساندوتش حلوم', price: 18, cals: 300, art: 'sandwich-halloumi',
        photo: { src: '/assets/img/halloumi-sandwich.jpg', size: [512, 640], at: [255, 300], span: 460 } }
    ]
  }
];

/* --- The three drinks carried by the signature scroll sequence ------------
   All three are real SAVVA menu items, paired with the brand's own photography.
   -------------------------------------------------------------------------- */
const signature = [
  {
    key: 'matcha-berry',
    en: { name: 'Matcha Berry', line: 'Ceremonial green over a deep berry base.' },
    ar: { name: 'ماتشا بيري', line: 'ماتشا فوق طبقة من التوت.' },
    price: 24, cals: 230,
    img: '/assets/img/matcha-berry-melon.jpg',
    alt: { en: 'Matcha Berry and Savva Melon side by side on a wooden tray', ar: 'ماتشا بيري وشمام سافا على صينية خشبية' },
    tone: '#4d5a2e'
  },
  {
    key: 'melon',
    en: { name: 'Savva Melon', line: 'Cold, slow and unmistakably sweet.' },
    ar: { name: 'شمام سافا', line: 'بارد وخفيف وحلو على مهل.' },
    price: 16, cals: 50,
    img: '/assets/img/melon-in-hand.jpg',
    alt: { en: 'A Savva Melon slush held in hand against greenery', ar: 'كوب شمام سافا محمول باليد أمام أوراق خضراء' },
    tone: '#8a5a2b'
  },
  {
    key: 'hibiscus',
    en: { name: 'Hibiscus Slush Savva', line: 'Poured deep red, straight over ice.' },
    ar: { name: 'سلاش كركديه سافا', line: 'كركديه أحمر يُسكب على الثلج.' },
    price: 17, cals: 180,
    img: '/assets/img/hibiscus-pour.jpg',
    alt: { en: 'Deep red hibiscus poured into a Savva cup over ice', ar: 'كركديه أحمر يُسكب في كوب سافا فوق الثلج' },
    tone: '#5a1420'
  }
];

/* --- The product moment ---------------------------------------------------
   One real SAVVA drink, carried as the page's product hero. `key` points at a
   `signature` entry rather than repeating it, so the name, line, price and
   calorie figure can never drift from the sequence or the menu.
   -------------------------------------------------------------------------- */
const ritual = { key: 'melon' };

/* --- Guest reviews --------------------------------------------------------
   Verbatim from SAVVA's Google Maps listing, read on 2026-09-11. All three are
   five-star reviews by Google Local Guides, written in Arabic, and quoted in
   Arabic on both editions — nothing is translated or reworded on a guest's
   behalf. Google shows each one cut short with "…"; the quote runs exactly
   to that point and keeps the ellipsis. Google dated them "a month ago"
   (Afaf Halawany) and "7 months ago" (Hind Al, Funny): 2026 in every case.
   These are not the three English reviews other sites for SAVVA already use.

   Format, one entry per review:
     { name, rating, date, role: { en, ar }, source,
       en: 'text, if written in English', ar: 'text, if written in Arabic' }
   Supply only the language the review was written in; the card marks it with
   its own `lang`/`dir`. A line break in the text is kept.
   -------------------------------------------------------------------------- */
const guestQuotes = [
  {
    name: 'Afaf Halawany', rating: 5, date: '2026', source: 'Google',
    role: { en: 'Local Guide', ar: 'مرشد محلي' },
    ar: 'من اجمل الأماكن لإنجاز عمل او اجتماع ٣ اشخاص او الروقان وفريق العمل اكثر من رائع جميعهم ٥ اشخاص منجزين خلوقين راقيين شكرا سافا ✨👌🏻 …'
  },
  {
    name: 'Hind Al', rating: 5, date: '2026', source: 'Google',
    role: { en: 'Local Guide', ar: 'مرشد محلي' },
    ar: 'تجربة جميلة بكل تفاصيلها\nطلبت قهوة V60 وكانت لذيذة جداً ومضبوطة، نكهتها واضحة وتتحضر بعناية. المكان مريح وجميل، تفاصيله أنيقة، والجلسات مريحة وطاقتها هادئة وتشرح الصدر. …'
  },
  {
    name: 'Funny', rating: 5, date: '2026', source: 'Google',
    role: { en: 'Local Guide', ar: 'مرشد محلي' },
    ar: 'تجربة كانت بالصدفه لكن كانت جداً جميلة ماشاءالله تبارك الله من كل شي تعامل ومكان وقهوة والسحلب  والحلا اه ي الحلا ربي يباركلكم 👍🏽♥️ …'
  }
];

/* --- Gallery ---------------------------------------------------------------
   Two justified bands: every photograph in a band shares one height and keeps
   its own proportions, so each band fills the width exactly and nothing sits
   on top of anything else. `band` says which of the two a photograph is in.
   -------------------------------------------------------------------------- */
const gallery = [
  { band: 0, img: '/assets/img/coffee-pour-cups.jpg', shape: 'tall', en: 'Filter coffee poured into Savva cups in morning light', ar: 'قهوة مقطّرة تُسكب في أكواب سافا تحت ضوء الصباح' },
  { band: 0, img: '/assets/img/three-cups-shadow.jpg', shape: 'wide', en: 'Three Savva cold drinks lined up in hard afternoon shadow', ar: 'ثلاثة مشروبات باردة من سافا في ظلّ العصر' },
  { band: 0, img: '/assets/img/desk-morning.jpg', shape: 'tall', en: 'An iced coffee and a sandwich beside a laptop in the sun', ar: 'قهوة مثلجة وساندوتش بجانب حاسوب تحت أشعة الشمس' },
  { band: 1, img: '/assets/img/halloumi-sandwich.jpg', shape: 'square', en: 'A halloumi sandwich on Savva branded paper', ar: 'ساندوتش حلوم على ورق سافا' },
  { band: 1, img: '/assets/img/curbside-tray.jpg', shape: 'tall', en: 'A tray handed through a car window', ar: 'صينية تُسلَّم عبر نافذة السيارة' },
  { band: 1, img: '/assets/img/slush-wood-table.jpg', shape: 'tall', en: 'A slush on a warm wooden table', ar: 'سلاش على طاولة خشبية دافئة' },
  { band: 1, img: '/assets/img/three-cups-stone.jpg', shape: 'square', en: 'Cold drinks resting on a stone counter', ar: 'مشروبات باردة على طاولة حجرية' }
];

/* --- Interface + editorial copy ------------------------------------------- */
const copy = {
  en: {
    lang: 'en', dir: 'ltr', other: 'ar', otherLabel: 'العربية', otherHref: 'ar/',
    title: 'SAVVA — Specialty Coffee in Madinah',
    description:
      'SAVVA is a specialty coffee house in Madinah, Saudi Arabia. Espresso, filter, matcha and signature cold drinks, served from 6:30 in the morning until 2 AM.',
    skip: 'Skip to content',
    nav: [
      { href: '#experience', label: 'Experience' },
      { href: '#menu', label: 'Menu' },
      { href: '#atmosphere', label: 'Atmosphere' },
      { href: '#location', label: 'Visit' }
    ],
    hero: {
      eyebrow: 'Specialty Coffee · Madinah',
      tagline: facts.tagline,
      primary: 'View the menu', primaryHref: '#menu',
      secondary: 'Get directions',
      scroll: 'Scroll',
      srTitle: 'SAVVA — specialty coffee in Madinah, Saudi Arabia',
      alt: 'Deep red hibiscus poured into a Savva cup over ice'
    },
    intro: {
      kicker: 'The house',
      heading: 'Coffee, made carefully,\nin the city of Madinah.',
      body: 'Espresso and filter, matcha, and a shelf of cold drinks that belong to us alone. We open before the city does and stay until two in the morning.',
      stats: [
        { value: facts.rating, label: 'Google rating' },
        { value: String(facts.reviewCount), label: 'Reviews' },
        { value: '6:30 — 2:00', label: 'Open daily' }
      ]
    },
    experience: {
      kicker: 'Signature',
      heading: 'The pour',
      body: 'A short sequence of the drinks people come back for.',
      priceLabel: 'SAR', calsLabel: 'cals'
    },
    menu: {
      kicker: 'The menu',
      heading: 'Everything we make',
      note: 'Prices in Saudi Riyal; calories as printed on our menu. Photographs are SAVVA’s own — the drawings are illustrative.',
      priceLabel: 'SAR',
      signature: 'Savva signature',
      full: 'Full menu'
    },
    atmosphere: {
      kicker: 'Atmosphere',
      heading: 'Light, shade,\nand a long afternoon.',
      body: 'Sunlight across a stone counter, a tray carried out to the curb, a table that holds a laptop and a sandwich equally well.'
    },
    ritual: {
      kicker: 'The cup',
      heading: 'One cup,\nheld to the light.',
      cta: 'View the menu',
      ctaHref: '#menu'
    },
    reviews: {
      kicker: 'Guests',
      heading: 'In their own words',
      body: 'From reviews left for SAVVA on Google Maps — quoted as written, in the language they were written in.',
      cta: 'Read every review on Google',
      outOf: 'out of 5',
      countLabel: 'reviews',
      source: 'Google Maps',
      ratingAria: 'Rated 4.7 out of 5'
    },
    location: {
      kicker: 'Visit',
      heading: 'Bir Uthman,\nMadinah',
      addressLabel: 'Address',
      hoursLabel: 'Opening hours',
      contactLabel: 'Contact',
      plusLabel: 'Plus code',
      call: 'Call',
      directions: 'Get directions',
      mapCta: 'Show Google Maps here',
      mapNote: 'Streets and buildings © OpenStreetMap contributors. Google Maps loads only if you ask for it.',
      mapAlt: 'Map of the streets around SAVVA in Bir Uthman, Madinah',
      mapName: 'SAVVA — Bir Uthman, Madinah',
      expand: 'Open the map of Bir Uthman',
      collapse: 'Close the map',
      hintClick: 'Click to fly in',
      hintTap: 'Tap to fly in',
      hintDrag: 'Drag to turn the map',
      openNow: 'Open now',
      closedNow: 'Closed now',
      openMaps: 'Open in Google Maps',
      plateRoute: 'Directions',
      plateMaps: 'Google Maps',
      osm: '© OpenStreetMap'
    },
    footer: {
      tagline: facts.tagline,
      instagram: 'Instagram',
      rights: 'All rights reserved.',
      langLabel: 'العربية'
    }
  },

  ar: {
    lang: 'ar', dir: 'rtl', other: 'en', otherLabel: 'English', otherHref: '../',
    title: 'سافا — قهوة مختصّة في المدينة المنورة',
    description:
      'سافا بيت قهوة مختصّة في المدينة المنورة. إسبريسو وقهوة مقطّرة وماتشا ومشروبات باردة خاصة بنا، من السادسة والنصف صباحًا حتى الثانية بعد منتصف الليل.',
    skip: 'تخطَّ إلى المحتوى',
    nav: [
      { href: '#experience', label: 'التجربة' },
      { href: '#menu', label: 'القائمة' },
      { href: '#atmosphere', label: 'الأجواء' },
      { href: '#location', label: 'زورونا' }
    ],
    hero: {
      eyebrow: 'قهوة مختصّة · المدينة المنورة',
      tagline: facts.tagline,
      primary: 'تصفَّح القائمة', primaryHref: '#menu',
      secondary: 'الاتجاهات',
      scroll: 'انزل',
      srTitle: 'سافا — قهوة مختصّة في المدينة المنورة، المملكة العربية السعودية',
      alt: 'كركديه أحمر يُسكب في كوب سافا فوق الثلج'
    },
    intro: {
      kicker: 'عن سافا',
      heading: 'قهوة تُحضَّر على مهل،\nفي المدينة المنورة.',
      body: 'إسبريسو وقهوة مقطّرة وماتشا، ورفّ من المشروبات الباردة التي لا تجدها إلا عندنا. نفتح قبل أن تستيقظ المدينة ونبقى حتى الثانية بعد منتصف الليل.',
      stats: [
        { value: facts.rating, label: 'تقييم جوجل' },
        { value: String(facts.reviewCount), label: 'مراجعة' },
        { value: '6:30 — 2:00', label: 'يوميًا' }
      ]
    },
    experience: {
      kicker: 'مشروباتنا المميّزة',
      heading: 'السكب',
      body: 'لمحة قصيرة عن المشروبات التي يعود لها ضيوفنا.',
      priceLabel: 'ر.س', calsLabel: 'سعرة'
    },
    menu: {
      kicker: 'القائمة',
      heading: 'كل ما نُحضّره',
      note: 'الأسعار بالريال السعودي، والسعرات كما هي مطبوعة في قائمتنا. الصور من سافا، والرسومات توضيحية.',
      priceLabel: 'ر.س',
      signature: 'من توقيع سافا',
      full: 'القائمة كاملة'
    },
    atmosphere: {
      kicker: 'الأجواء',
      heading: 'ضوء وظِل،\nوعصريّة طويلة.',
      body: 'شمس تعبر طاولة حجرية، وصينية تُحمل إلى الرصيف، وطاولة تتّسع للحاسوب والساندوتش معًا.'
    },
    ritual: {
      kicker: 'الكوب',
      heading: 'كوبٌ واحد،\nفي مواجهة الضوء.',
      cta: 'تصفَّح القائمة',
      ctaHref: '#menu'
    },
    reviews: {
      kicker: 'ضيوفنا',
      heading: 'بكلماتهم',
      body: 'من مراجعات كتبها ضيوفنا عن سافا على خرائط جوجل، كما كُتبت وباللغة التي كُتبت بها.',
      cta: 'اقرأ كل المراجعات على جوجل',
      outOf: 'من 5',
      countLabel: 'مراجعة',
      source: 'خرائط جوجل',
      ratingAria: 'التقييم 4.7 من 5'
    },
    location: {
      kicker: 'زورونا',
      heading: 'بئر عثمان،\nالمدينة المنورة',
      addressLabel: 'العنوان',
      hoursLabel: 'ساعات العمل',
      contactLabel: 'للتواصل',
      plusLabel: 'الرمز البريدي المصغّر',
      call: 'اتصل بنا',
      directions: 'الاتجاهات',
      mapCta: 'اعرض خرائط جوجل هنا',
      mapNote: 'الشوارع والمباني © مساهمو OpenStreetMap. لا تُحمَّل خرائط جوجل إلا إذا طلبتها.',
      mapAlt: 'خريطة الشوارع حول سافا في بئر عثمان بالمدينة المنورة',
      mapName: 'سافا — بئر عثمان، المدينة المنورة',
      expand: 'افتح خريطة بئر عثمان',
      collapse: 'أغلق الخريطة',
      hintClick: 'اضغط للاقتراب',
      hintTap: 'المس للاقتراب',
      hintDrag: 'اسحب لتدوير الخريطة',
      openNow: 'مفتوح الآن',
      closedNow: 'مغلق الآن',
      openMaps: 'افتح في خرائط جوجل',
      plateRoute: 'الاتجاهات',
      plateMaps: 'خرائط جوجل',
      osm: '© OpenStreetMap'
    },
    footer: {
      tagline: facts.tagline,
      instagram: 'إنستغرام',
      rights: 'جميع الحقوق محفوظة.',
      langLabel: 'English'
    }
  }
};

module.exports = { site, facts, menu, signature, ritual, guestQuotes, gallery, copy };
