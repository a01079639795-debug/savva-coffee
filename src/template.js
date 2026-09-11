/* Renders one language of the SAVVA site. Both pages are produced from the
   same content model so the Arabic edition can never drift from the English. */

const fs = require('fs');
const path = require('path');
const { site, facts, menu, signature, ritual, guestQuotes, gallery, copy } = require('./content.js');
const menuArt = require('./menu-art.js');
const { HALF_H: MAP_HALF } = require('./map-svg.js');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Split a heading on newlines into animatable lines. */
const lines = (text) => String(text).split('\n')
  .map((l) => `<span class="line"><span class="line__in">${esc(l)}</span></span>`).join('');

/* Every URL inside the site is relative to the page, so one build runs
   unchanged at a domain root or under a project path such as GitHub Pages'
   /<repo>/. The Arabic page sits one folder down. */
const baseOf = (lang) => (lang === 'ar' ? '../' : '');
const asset = (t, p) => baseOf(t.lang) + String(p).replace(/^\//, '');

/* A JPEG's pixel size, read from its frame header. */
function jpegSize(file) {
  const b = fs.readFileSync(file);
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xFF || b[i + 1] === 0xFF) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error('no frame header in ' + file);
}

/* SAVVA's photographs ship at Instagram's 640 px export. Where the original
   post is larger, a sharper copy sits in assets/img/hd/ under the same name,
   and the browser takes it when the frame is drawn wide or on a dense screen.
   Returns the src/srcset/sizes attributes, or with `preload` the <link> ones. */
const ROOT = path.join(__dirname, '..');
function photo(t, src, sizes, preload) {
  const rel = String(src).replace(/^\//, '');
  const name = path.basename(rel);
  const hd = path.join(ROOT, 'assets', 'img', 'hd', name);
  const [a, set, sz] = preload ? ['href', 'imagesrcset', 'imagesizes'] : ['src', 'srcset', 'sizes'];
  if (!fs.existsSync(hd)) return `${a}="${asset(t, rel)}"`;
  const list = `${asset(t, rel)} ${jpegSize(path.join(ROOT, rel))[0]}w, ${asset(t, 'assets/img/hd/' + name)} ${jpegSize(hd)[0]}w`;
  return `${a}="${asset(t, rel)}" ${set}="${list}" ${sz}="${sizes}"`;
}

/* How wide each use of a photograph is drawn: the hero's centre frame (scaled
   1.14 for its parallax, full-bleed on a phone), the flanking frames (hidden on
   a phone, so they ask for the small file there), the arch, the gallery tiles
   and the cup's stand-in photograph. */
const SIZES = {
  hero: '(min-width: 56rem) 48vw, 114vw',
  heroSide: '(min-width: 56rem) 42vw, 1px',
  pour: '30rem',
  tile: '(min-width: 56rem) 30vw, 50vw',
  tileWide: '(min-width: 56rem) 50vw, 100vw',
  ritual: '(min-width: 56rem) 34vw, 80vw'
};
const HERO_LEAD = '/assets/img/hibiscus-pour.jpg';

const FONTS = {
  en: 'https://fonts.googleapis.com/css2?family=Archivo:wght@300..600&family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..700,0..100,0..1&family=IBM+Plex+Sans+Arabic:wght@300;400&display=swap',
  ar: 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Archivo:wght@300..600&family=Fraunces:ital,wght@1,300&family=IBM+Plex+Sans+Arabic:wght@200..600&display=swap'
};

/* "10 – 13" is a real price on the menu, so it is published as a range rather
   than mangled into a single number. */
function offerFor(price) {
  const range = String(price).match(/^\s*(\d+)\s*[–-]\s*(\d+)\s*$/);
  if (range) {
    return {
      '@type': 'Offer',
      priceCurrency: 'SAR',
      priceSpecification: {
        '@type': 'PriceSpecification',
        minPrice: Number(range[1]),
        maxPrice: Number(range[2]),
        priceCurrency: 'SAR'
      }
    };
  }
  return { '@type': 'Offer', price: Number(price), priceCurrency: 'SAR' };
}

function head(lang, t, svg) {
  const alt = lang === 'en' ? site.url + '/ar/' : site.url + '/';
  const self = lang === 'en' ? site.url + '/' : site.url + '/ar/';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: lang === 'ar' ? facts.nameArabic : facts.nameLatin,
    alternateName: lang === 'ar' ? facts.nameLatin : facts.nameArabic,
    description: t.description,
    url: self,
    image: site.url + site.ogImage,
    telephone: facts.phone,
    servesCuisine: 'Coffee',
    priceRange: 'SAR 6–27',
    sameAs: [facts.instagram],
    address: {
      '@type': 'PostalAddress',
      streetAddress: lang === 'ar' ? facts.streetAr : facts.street,
      addressLocality: lang === 'ar' ? 'المدينة المنورة' : 'Madinah',
      postalCode: '42331',
      addressCountry: 'SA'
    },
    geo: { '@type': 'GeoCoordinates', latitude: facts.lat, longitude: facts.lng },
    hasMap: facts.mapsShort,
    openingHoursSpecification: facts.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.schema.map((d) => ({
        Sa: 'Saturday', Su: 'Sunday', Mo: 'Monday', Tu: 'Tuesday',
        We: 'Wednesday', Th: 'Thursday', Fr: 'Friday'
      }[d])),
      opens: h.open, closes: h.close
    })),
    hasMenu: {
      '@type': 'Menu',
      hasMenuSection: menu.map((sec) => ({
        '@type': 'MenuSection',
        name: lang === 'ar' ? sec.ar : sec.en,
        hasMenuItem: sec.items.map((it) => ({
          '@type': 'MenuItem',
          name: lang === 'ar' ? it.ar : it.en,
          offers: offerFor(it.price)
        }))
      }))
    }
  };

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<link rel="canonical" href="${self}">
<link rel="alternate" hreflang="${lang}" href="${self}">
<link rel="alternate" hreflang="${t.other}" href="${alt}">
<link rel="alternate" hreflang="x-default" href="${site.url}/">
<meta name="theme-color" content="#7F8265">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SAVVA">
<meta property="og:locale" content="${lang === 'ar' ? 'ar_SA' : 'en_US'}">
<meta property="og:locale:alternate" content="${lang === 'ar' ? 'en_US' : 'ar_SA'}">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:url" content="${self}">
<meta property="og:image" content="${site.url}${site.ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${asset(t, 'assets/img/favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${asset(t, 'assets/img/savva-mark-tile.jpg')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="image" ${photo(t, HERO_LEAD, SIZES.hero, true)} fetchpriority="high">
<link rel="stylesheet" href="${FONTS[lang]}">
<link rel="stylesheet" href="${asset(t, 'assets/css/savva.css')}">
<script>document.documentElement.classList.remove('no-js');document.documentElement.classList.add('js')</script>
<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

function header(t, svg) {
  return `<header class="nav" data-nav>
  <div class="nav__bar">
    <a class="nav__mark" href="./" aria-label="SAVVA — ${esc(facts.nameArabic)}">${svg.wordmark}</a>
    <nav class="nav__links" aria-label="${t.lang === 'ar' ? 'التنقل الرئيسي' : 'Primary'}">
      ${t.nav.map((n) => `<a href="${n.href}">${esc(n.label)}</a>`).join('')}
    </nav>
    <div class="nav__end">
      <a class="nav__lang" href="${t.otherHref}" lang="${t.other}" dir="${t.other === 'ar' ? 'rtl' : 'ltr'}" hreflang="${t.other}">${esc(t.otherLabel)}</a>
      <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-panel" data-nav-toggle>
        <span class="nav__toggle-lines" aria-hidden="true"><i></i><i></i></span>
        <span class="u-sr">${t.lang === 'ar' ? 'القائمة' : 'Menu'}</span>
      </button>
    </div>
  </div>
  <div class="nav__panel" id="nav-panel" hidden data-nav-panel>
    <nav aria-label="${t.lang === 'ar' ? 'تنقل الجوال' : 'Mobile'}">
      ${t.nav.map((n, i) => `<a href="${n.href}" style="--i:${i}">${esc(n.label)}</a>`).join('')}
    </nav>
    <a class="nav__panel-lang" href="${t.otherHref}" lang="${t.other}" hreflang="${t.other}">${esc(t.otherLabel)}</a>
  </div>
</header>`;
}

function hero(t, svg) {
  return `<section class="hero" data-hero>
  <div class="hero__media">
    <figure><img ${photo(t, '/assets/img/coffee-pour-cups.jpg', SIZES.heroSide)} alt="" width="360" height="640" decoding="async" data-parallax="0.10"></figure>
    <figure><img ${photo(t, HERO_LEAD, SIZES.hero)} alt="${esc(t.hero.alt)}" width="480" height="640" fetchpriority="high" decoding="async" data-parallax="0.16"></figure>
    <figure><img ${photo(t, '/assets/img/curbside-tray.jpg', SIZES.heroSide)} alt="" width="518" height="640" decoding="async" data-parallax="0.07"></figure>
  </div>
  <div class="hero__inner">
    <p class="hero__eyebrow reveal">${esc(t.hero.eyebrow)}</p>
    <h1 class="hero__lockup reveal"><span class="u-sr">${esc(t.hero.srTitle)}</span>${svg.lockup}</h1>
    <p class="hero__tagline reveal" lang="en" dir="ltr">${esc(t.hero.tagline)}</p>
    <div class="hero__cta reveal">
      <a class="btn btn--solid" href="${t.hero.primaryHref}">${esc(t.hero.primary)}</a>
      <a class="btn btn--ghost" href="${facts.directions}" target="_blank" rel="noopener">${esc(t.hero.secondary)}</a>
    </div>
  </div>
  <div class="hero__scroll" aria-hidden="true"><span>${esc(t.hero.scroll)}</span><i></i></div>
</section>`;
}

function intro(t, svg) {
  return `<section class="intro" aria-labelledby="intro-h">
  <div class="wrap intro__grid">
    <p class="kicker reveal">${esc(t.intro.kicker)}</p>
    <h2 class="display intro__h" id="intro-h" data-lines>${lines(t.intro.heading)}</h2>
    <div class="intro__side">
      <p class="lede reveal">${esc(t.intro.body)}</p>
      <dl class="stats reveal">
        ${t.intro.stats.map((s) => `<div class="stats__item"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}
      </dl>
    </div>
    <div class="intro__ornament" aria-hidden="true">${svg.cup(baseOf(t.lang))}</div>
  </div>
</section>`;
}

function pour(t) {
  const n = signature.length;
  return `<section class="pour" id="experience" aria-labelledby="pour-h" data-pour style="--count:${n};--stage:${signature[0].tone}">
  <div class="pour__stage">
    <div class="pour__media">
      ${signature.map((d, i) => `<figure class="pour__frame${i === 0 ? ' is-active' : ''}" data-frame="${i}" style="--tone:${d.tone}">
        <img ${photo(t, d.img, SIZES.pour)} alt="${esc(d.alt[t.lang])}" width="360" height="640" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async">
      </figure>`).join('')}
    </div>
    <div class="pour__panel">
      <p class="kicker">${esc(t.experience.kicker)}</p>
      <h2 class="display pour__h" id="pour-h">${esc(t.experience.heading)}</h2>
      <div class="pour__slides">
        ${signature.map((d, i) => `<div class="pour__slide${i === 0 ? ' is-active' : ''}" data-slide="${i}"${i === 0 ? '' : ' aria-hidden="true"'}>
          <h3 class="pour__name">${esc(d[t.lang].name)}</h3>
          <p class="pour__line">${esc(d[t.lang].line)}</p>
          <p class="pour__meta"><span class="num">${d.price}</span> ${esc(t.experience.priceLabel)} <i>/</i> <span class="num">${d.cals}</span> ${esc(t.experience.calsLabel)}</p>
        </div>`).join('')}
      </div>
      <ol class="pour__dots" aria-hidden="true">
        ${signature.map((d, i) => `<li${i === 0 ? ' class="is-active"' : ''} data-dot="${i}"><span></span></li>`).join('')}
      </ol>
    </div>
  </div>
  <div class="pour__track" aria-hidden="true"></div>
</section>`;
}

/* The picture beside a menu line: SAVVA's own photograph of the item, cropped
   square around it, or else the drawing of its kind from the menu sprite.
   Decorative either way — the name sits right next to it. */
function menuPicture(t, it) {
  if (it.photo) {
    const p = it.photo, s = p.span;
    // the image is sized and offset inside a square so that the square shows
    // exactly `span` source pixels centred on `at`
    const w = (100 * p.size[0] / s).toFixed(2), l = (50 - 100 * p.at[0] / s).toFixed(2), tp = (50 - 100 * p.at[1] / s).toFixed(2);
    return `<span class="row__art row__art--photo" aria-hidden="true"><img src="${asset(t, p.src)}" alt="" width="${p.size[0]}" height="${p.size[1]}" loading="lazy" decoding="async" style="--w:${w}%;--l:${l}%;--t:${tp}%"></span>`;
  }
  if (!menuArt.has(it.art)) throw new Error(`menu item "${it.en}" has neither a photo nor a drawing`);
  return `<span class="row__art" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><use href="${asset(t, 'assets/img/menu-art.svg')}#${it.art}"/></svg></span>`;
}

function menuSection(t) {
  const other = t.lang === 'ar' ? 'en' : 'ar';
  const otherDir = other === 'ar' ? 'rtl' : 'ltr';
  return `<section class="menu" id="menu" aria-labelledby="menu-h">
  <div class="wrap">
    <header class="menu__head">
      <p class="kicker reveal">${esc(t.menu.kicker)}</p>
      <h2 class="display menu__h" id="menu-h" data-lines>${lines(t.menu.heading)}</h2>
      <p class="menu__note reveal">${esc(t.menu.note)}</p>
    </header>
    <div class="menu__tabs" role="tablist" aria-label="${esc(t.menu.full)}">
      ${menu.map((s, i) => `<button role="tab" type="button" class="menu__tab${i === 0 ? ' is-active' : ''}" aria-selected="${i === 0}" aria-controls="cat-${s.id}" id="tab-${s.id}" data-tab="${s.id}">${esc(s[t.lang])}</button>`).join('')}
    </div>
    <div class="menu__body">
      ${menu.map((s, i) => `<section class="cat${i === 0 ? ' is-active' : ''}" id="cat-${s.id}" role="tabpanel" aria-labelledby="tab-${s.id}" data-cat="${s.id}">
        <div class="cat__head">
          <p class="cat__kicker">${esc(s.kicker[t.lang])}</p>
          <h3 class="display cat__h">${esc(s[t.lang])}</h3>
          <p class="cat__alt"><bdi lang="${other}" dir="${otherDir}">${esc(s[other])}</bdi></p>
        </div>
        <ul class="rows">
          ${s.items.map((it) => `<li class="row${it.signature ? ' row--sig' : ''}">
            ${menuPicture(t, it)}
            <span class="row__name">${esc(it[t.lang])}${it.signature ? `<i class="row__sig" title="${esc(t.menu.signature)}" aria-label="${esc(t.menu.signature)}"></i>` : ''}</span>
            <span class="row__alt"><bdi lang="${other}" dir="${otherDir}">${esc(it[other])}</bdi></span>
            <span class="row__lead" aria-hidden="true"></span>
            <span class="row__price"><span class="num">${esc(it.price)}</span><em>${esc(t.menu.priceLabel)}</em></span>
            ${it.cals !== undefined ? `<span class="row__cals"><span class="num">${it.cals}</span> ${esc(t.experience.calsLabel)}</span>` : '<span class="row__cals"></span>'}
          </li>`).join('')}
        </ul>
      </section>`).join('')}
    </div>
  </div>
</section>`;
}

/* The gallery in two justified bands — see `gallery` in content.js. Each tile
   carries its proportion as --a, which the stylesheet turns into a shared
   height per band. */
const ASPECT = { tall: .75, square: 1, wide: 1.5 };

function atmosphere(t) {
  const bands = [0, 1].map((b) => gallery.map((g, i) => ({ g, i })).filter((x) => x.g.band === b));
  return `<section class="atmos" id="atmosphere" aria-labelledby="atmos-h">
  <div class="wrap">
    <header class="atmos__head">
      <p class="kicker reveal">${esc(t.atmosphere.kicker)}</p>
      <h2 class="display atmos__h" id="atmos-h" data-lines>${lines(t.atmosphere.heading)}</h2>
      <p class="lede reveal">${esc(t.atmosphere.body)}</p>
    </header>
  </div>
  <div class="wrap">
    <div class="grid">
      ${bands.map((band) => `<div class="grid__band">
        ${band.map(({ g, i }) => `<figure class="tile tile--${g.shape} reveal" style="--d:${(i % 4) * 90}ms;--a:${ASPECT[g.shape]}">
          <img ${photo(t, g.img, g.shape === 'wide' ? SIZES.tileWide : SIZES.tile)} alt="${esc(g[t.lang])}" loading="lazy" decoding="async" data-parallax="${i % 2 ? '0.05' : '-0.05'}">
        </figure>`).join('')}
      </div>`).join('')}
    </div>
  </div>
</section>`;
}

/* The product moment: one real drink, alone on a lit stage. The scroll driver
   writes --enter / --dom / --name / --exit and CSS composes every transform from
   them, so the whole sequence still reads as a single composed frame with the
   defaults the stylesheet ships. */
function ritualSection(t) {
  const d = signature.find((s) => s.key === ritual.key);
  const R = t.ritual;
  return `<section class="ritual" id="ritual" aria-labelledby="ritual-h" data-ritual>
  <div class="ritual__stage" data-ritual-stage>
    <div class="ritual__space" aria-hidden="true">
      <span class="ritual__glow"></span>
      <span class="ritual__ring"></span>
      <span class="ritual__ring ritual__ring--wide"></span>
      <span class="ritual__grain"></span>
    </div>
    <div class="ritual__frame">
      <div class="ritual__lead">
        <p class="kicker">${esc(R.kicker)}</p>
        <h2 class="display ritual__h" id="ritual-h" data-lines>${lines(R.heading)}</h2>
      </div>
      <div class="ritual__tilt" data-ritual-tilt>
        <span class="ritual__cast" aria-hidden="true"></span>
        <figure class="ritual__object">
          <img ${photo(t, d.img, SIZES.ritual)} alt="${esc(d.alt[t.lang])}" width="477" height="640" loading="lazy" decoding="async" fetchpriority="low">
          <span class="ritual__sweep" aria-hidden="true"></span>
        </figure>
      </div>
      <div class="ritual__caption">
        <h3 class="ritual__name">${esc(d[t.lang].name)}</h3>
        <p class="ritual__line">${esc(d[t.lang].line)}</p>
        <p class="ritual__meta"><span class="num">${d.price}</span> ${esc(t.experience.priceLabel)} <i>/</i> <span class="num">${d.cals}</span> ${esc(t.experience.calsLabel)}</p>
        <a class="btn btn--ghost ritual__cta" href="${R.ctaHref}">${esc(R.cta)}</a>
      </div>
    </div>
  </div>
  <div class="ritual__track" aria-hidden="true"></div>
</section>`;
}

/* A rating row that shows the real figure rather than rounding it: the filled
   layer is clipped to value/5. Forced LTR in both editions — a star scale is a
   measure, not a sentence, so it reads left to right in Arabic too. */
const STAR = '<svg viewBox="0 0 20 18"><path d="M10 .2 12.29 6.55 19.04 6.76 13.71 10.91 15.58 17.39 10 13.6 4.42 17.39 6.29 10.91 .96 6.76 7.71 6.55Z"/></svg>';

function stars(value, label) {
  const fill = (Number(value) / 5) * 100;
  return `<span class="stars" role="img" aria-label="${esc(label)}">`
    + `<span class="stars__row" aria-hidden="true">${STAR.repeat(5)}</span>`
    + `<span class="stars__row stars__row--on" aria-hidden="true" style="--fill:${fill.toFixed(1)}%">${STAR.repeat(5)}</span>`
    + '</span>';
}

function reviews(t) {
  const R = t.reviews;
  /* The testimonial-card grammar — stars, the words, a rule, then who said it.
     One card per real, attributed guest review, verbatim: see guestQuotes in
     content.js. Nothing here is written on a guest's behalf, and no stock
     portrait stands in for a guest — the avatar is the initial of their name. */
  const cards = guestQuotes.map((q, i) => {
    const text = q[t.lang] || q.en || q.ar;
    const qlang = q[t.lang] ? t.lang : (q.en ? 'en' : 'ar');
    const initial = Array.from(String(q.name).trim())[0] || '';
    const byline = [q.source, q.role && q.role[t.lang], q.date].filter(Boolean).join(' · ');
    return `<figure class="tcard reveal" style="--d:${((i + 1) % 3) * 90}ms">
        ${stars(q.rating, `${q.rating} / 5`)}
        <blockquote class="tcard__text" lang="${qlang}" dir="${qlang === 'ar' ? 'rtl' : 'ltr'}"><p>${esc(text).replace(/\n/g, '<br>')}</p></blockquote>
        <figcaption class="tcard__by">
          <span class="tcard__avatar" aria-hidden="true">${esc(initial)}</span>
          <span class="tcard__who"><b dir="auto">${esc(q.name)}</b><small>${esc(byline)}</small></span>
        </figcaption>
      </figure>`;
  }).join('');

  // alone, the verified aggregate is the card; beside real guest cards it
  // becomes one line under the heading, so the row is the guests' own
  const scoreCard = `<figure class="tcard tcard--score reveal">
        ${stars(facts.rating, R.ratingAria)}
        <p class="tcard__score"><span class="num">${esc(facts.rating)}</span> <em>${esc(R.outOf)}</em></p>
        <figcaption class="tcard__by">
          <span class="tcard__avatar tcard__avatar--mark" aria-hidden="true">${STAR}</span>
          <span class="tcard__who"><b>${esc(R.source)}</b><small><span class="num">${facts.reviewCount}</span> ${esc(R.countLabel)}</small></span>
        </figcaption>
      </figure>`;
  const scoreLine = `<p class="reviews__score reveal">${stars(facts.rating, R.ratingAria)}<span><b class="num">${esc(facts.rating)}</b> ${esc(R.outOf)} · <span class="num">${facts.reviewCount}</span> ${esc(R.countLabel)} · ${esc(R.source)}</span></p>`;

  return `<section class="reviews" id="reviews" aria-labelledby="reviews-h">
  <div class="wrap reviews__inner">
    <header class="reviews__head">
      <p class="kicker reveal">${esc(R.kicker)}</p>
      <h2 class="display reviews__h" id="reviews-h" data-lines>${lines(R.heading)}</h2>
      <p class="lede reveal">${esc(R.body)}</p>
      ${cards ? scoreLine : ''}
    </header>
    <div class="tcards">
      ${cards ? '' : scoreCard}
      ${cards}
    </div>
    <p class="reviews__cta reveal"><a class="link" href="${facts.reviewsUrl}" target="_blank" rel="noopener">${esc(R.cta)}</a></p>
  </div>
</section>`;
}

/* The location card, on the real map. Collapsed it is a small plate that tilts
   toward the pointer: Bir Uthman's streets drawn flat from OpenStreetMap, a
   pulse where SAVVA stands, the name and the address. A click springs it open
   and assets/js/savva-map.js flies the camera down into those same streets in
   WebGL; the pin lands on SAVVA's real coordinates and the small plate with
   the address, the opening status and the way there comes up above it.
   The map never mirrors in Arabic — geography has no reading direction — so
   the view is LTR; the plate's own text follows the page. */
const JS_DAY = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };

function xmap(t) {
  const L = t.location;
  const hours = JSON.stringify(facts.hours.map((h) => ({ d: h.schema.map((s) => JS_DAY[s]), o: h.open, c: h.close })));
  const coords = `${facts.lat.toFixed(4)}° N, ${facts.lng.toFixed(4)}° E`;
  const street = t.lang === 'ar' ? facts.streetAr : facts.street;
  const status = `<span class="xmap__status" data-open-status data-hours='${hours}' data-open="${esc(L.openNow)}" data-closed="${esc(L.closedNow)}" hidden><i></i><span></span></span>`;
  return `<div id="savva-3d-location" class="xmap" data-xmap data-map="${asset(t, 'assets/data/savva-map.json')}" data-map-half="${MAP_HALF}">
        <div class="xmap__card" data-xmap-card data-src="https://www.google.com/maps?q=${facts.lat},${facts.lng}&hl=${t.lang}&z=17&output=embed" data-title="${esc(L.mapAlt)}">
          <img class="xmap__flat" src="${asset(t, 'assets/img/savva-map.svg')}" alt="${esc(L.mapAlt)}" width="1200" height="700" loading="lazy" decoding="async">
          <div class="xmap__view" data-xmap-view dir="ltr">
            <div class="xmap__labels" data-xmap-labels aria-hidden="true"></div>
          </div>
          <div class="xmap__marker" data-xmap-marker>
            <span class="xmap__here" aria-hidden="true"></span>
            <svg class="xmap__pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            <div class="xmap__plate" dir="${t.dir}">
              <p class="xmap__plate-name">SAVVA <bdi lang="ar" dir="rtl">${esc(facts.nameArabic)}</bdi></p>
              <p class="xmap__plate-addr">${esc(street)}</p>
              ${status}
              <p class="xmap__plate-cta"><a href="${facts.directions}" target="_blank" rel="noopener">${esc(L.plateRoute)}</a><a href="${facts.mapsShort}" target="_blank" rel="noopener">${esc(L.plateMaps)}</a></p>
            </div>
          </div>
          <div class="xmap__content">
            <div class="xmap__top">
              <svg class="xmap__icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
              ${status}
            </div>
            <div class="xmap__bottom">
              <h3 class="xmap__name">${esc(L.mapName)}</h3>
              <p class="xmap__addr">${esc(street)}</p>
              <p class="xmap__coords" dir="ltr">${coords}</p>
              <span class="xmap__line" aria-hidden="true"></span>
            </div>
          </div>
          <button class="xmap__hit" type="button" aria-expanded="false" data-xmap-toggle aria-label="${esc(L.expand)}"></button>
          <button class="xmap__close" type="button" data-xmap-close aria-label="${esc(L.collapse)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          <a class="xmap__osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" lang="en" dir="ltr">${esc(L.osm)}</a>
        </div>
        <p class="xmap__hint" aria-hidden="true"><span class="xmap__hint--click">${esc(L.hintClick)}</span><span class="xmap__hint--tap">${esc(L.hintTap)}</span><span class="xmap__hint--drag">${esc(L.hintDrag)}</span></p>
        <p class="xmap__actions">
          <button class="link" type="button" data-map-load>${esc(L.mapCta)}</button>
          <a class="link" href="${facts.mapsShort}" target="_blank" rel="noopener">${esc(L.openMaps)}</a>
        </p>
        <p class="xmap__note">${esc(L.mapNote)}</p>
      </div>`;
}

function location(t) {
  const L = t.location;
  const street = t.lang === 'ar' ? esc(facts.streetAr) : `<bdi dir="ltr">${esc(facts.street)}</bdi>`;
  return `<section class="loc" id="location" aria-labelledby="loc-h">
  <div class="wrap loc__grid">
    <div class="loc__info">
      <p class="kicker reveal">${esc(L.kicker)}</p>
      <h2 class="display loc__h" id="loc-h" data-lines>${lines(L.heading)}</h2>
      <dl class="facts reveal">
        <div class="facts__row">
          <dt>${esc(L.addressLabel)}</dt>
          <dd><address>${street}<br>${esc(t.lang === 'ar' ? facts.cityAr : facts.cityEn)}<br>${esc(t.lang === 'ar' ? facts.countryAr : facts.countryEn)}</address></dd>
        </div>
        <div class="facts__row">
          <dt>${esc(L.hoursLabel)}</dt>
          <dd>${facts.hours.map((h) => `<span class="facts__hours"><b>${esc(h.days[t.lang])}</b><em>${esc(h.time[t.lang])}</em></span>`).join('')}</dd>
        </div>
        <div class="facts__row">
          <dt>${esc(L.contactLabel)}</dt>
          <dd><a class="link" href="tel:${facts.phoneHref}"><bdi dir="ltr">${esc(facts.phone)}</bdi></a><br><a class="link" href="${facts.instagram}" target="_blank" rel="noopener"><bdi dir="ltr">@${esc(facts.handle)}</bdi></a></dd>
        </div>
        <div class="facts__row">
          <dt>${esc(L.plusLabel)}</dt>
          <dd><bdi dir="ltr">${esc(facts.plusCode)}</bdi> ${esc(t.lang === 'ar' ? 'المدينة المنورة' : 'Madinah')}</dd>
        </div>
      </dl>
      <div class="loc__cta reveal">
        <a class="btn btn--solid" href="${facts.directions}" target="_blank" rel="noopener">${esc(L.directions)}</a>
        <a class="btn btn--ghost" href="tel:${facts.phoneHref}">${esc(L.call)}</a>
      </div>
    </div>
    <div class="loc__map reveal">
      ${xmap(t)}
    </div>
  </div>
</section>`;
}

function footer(t, svg) {
  return `<footer class="foot">
  <div class="wrap foot__grid">
    <div class="foot__mark" role="img" aria-label="SAVVA">${svg.wordmark}</div>
    <p class="foot__tagline" lang="en" dir="ltr">${esc(t.footer.tagline)}</p>
    <ul class="foot__links">
      <li><a class="link" href="${facts.instagram}" target="_blank" rel="noopener">${esc(t.footer.instagram)}</a></li>
      <li><a class="link" href="${facts.directions}" target="_blank" rel="noopener">${esc(t.location.directions)}</a></li>
      <li><a class="link" href="tel:${facts.phoneHref}"><bdi dir="ltr">${esc(facts.phone)}</bdi></a></li>
      <li><a class="link" href="${t.otherHref}" lang="${t.other}" hreflang="${t.other}">${esc(t.footer.langLabel)}</a></li>
    </ul>
    <p class="foot__legal"><span class="num">© ${new Date().getFullYear()}</span> SAVVA · <bdi lang="ar" dir="rtl">${esc(facts.nameArabic)}</bdi> — ${esc(t.footer.rights)}</p>
  </div>
</footer>`;
}

module.exports = function render(lang, svg) {
  const t = copy[lang];
  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}" class="no-js">
<head>
${head(lang, t, svg)}
</head>
<body>
<a class="skip" href="#main">${esc(t.skip)}</a>
${header(t, svg)}
<main id="main">
${hero(t, svg)}
${intro(t, svg)}
${pour(t)}
${menuSection(t)}
${atmosphere(t)}
${ritualSection(t)}
${reviews(t)}
${location(t)}
</main>
${footer(t, svg)}
<script src="${asset(t, 'assets/js/savva.js')}" defer></script>
</body>
</html>
`;
};
