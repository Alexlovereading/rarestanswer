/** Original vector artwork. Shared by the image generator; never shipped as client JS. */
import type { CategoryKey } from '../../lib/game/types';

export const categoryArt = {
  geography: {
    label: 'Geography',
    alt: 'An illustrated globe with a gold compass and orbiting location marker',
    accent: '#70dfdc',
  },
  animals: {
    label: 'Animals',
    alt: 'An illustrated fox with a curled tail, a butterfly, and forest leaves',
    accent: '#a3de9a',
  },
  food: {
    label: 'Food',
    alt: 'An illustrated bowl of noodles with chopsticks, an egg, and fresh leaves',
    accent: '#ffbc8b',
  },
  sports: {
    label: 'Sports',
    alt: 'An illustrated gold trophy beside a basketball and a victory pennant',
    accent: '#f8cf68',
  },
  screen: {
    label: 'Movies & TV',
    alt: 'An illustrated film clapperboard, cinema screen, and film reel',
    accent: '#cfb4ff',
  },
  music: {
    label: 'Music',
    alt: 'An illustrated vinyl record with a gold tonearm and floating music notes',
    accent: '#ffb2cf',
  },
  science: {
    label: 'Science',
    alt: 'An illustrated laboratory flask with an orbiting atom and colorful bubbles',
    accent: '#7fdef0',
  },
  history: {
    label: 'History',
    alt: 'An illustrated classical column, unfurled scroll, and gold laurel leaves',
    accent: '#e8ce9e',
  },
} satisfies Record<CategoryKey, { label: string; alt: string; accent: string }>;

export const categoryKeys = Object.keys(categoryArt) as CategoryKey[];

/** Assets intentionally have their own immutable palette, unlike theme-aware UI. */
export const palette = {
  ink: '#17113e',
  indigo: '#302087',
  violet: '#7561df',
  pale: '#ebe5ff',
  gold: '#f7ca59',
  goldLight: '#fff0b3',
  white: '#ffffff',
};

const sparkle = (x: number, y: number, r = 7, color = palette.gold) =>
  `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${color}"/>`;

function categorySubject(key: CategoryKey): string {
  const a = categoryArt[key].accent;
  const { gold: g, goldLight: gl, pale: p, ink, white: w } = palette;
  const subjects: Record<CategoryKey, string> = {
    geography: `
      <path d="M89 192h77m-60-1 10-26h24l11 26" fill="none" stroke="${g}" stroke-width="7" stroke-linecap="round"/>
      <path d="M169 57a74 74 0 0 1-56 124" fill="none" stroke="${gl}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="123" cy="112" r="61" fill="url(#object)" stroke="${p}" stroke-width="3"/>
      <ellipse cx="123" cy="112" rx="27" ry="61" fill="none" stroke="${w}" stroke-opacity=".25" stroke-width="2"/>
      <path d="M63 111h120m-110-31q50 24 100 0m-100 62q50-24 100 0" fill="none" stroke="${w}" stroke-opacity=".25" stroke-width="2"/>
      <path d="m85 70 15-9 15 8 1 15 14 8-5 18-18 1-10-14-15-5-8-13Zm48 50 19-12 19 6 3 23-14 9-5 16-16 6-6-21-8-12Z" fill="${a}"/>
      <circle cx="184" cy="169" r="26" fill="${ink}" stroke="${g}" stroke-width="3"/>
      <path d="m184 147 8 22-8 21-8-21Z" fill="${g}"/><path d="m184 147 8 22-8-3Z" fill="${gl}"/>
      <path d="M56 56c-14 0-19 17-13 27l13 16 13-16c7-10 1-27-13-27Z" fill="${g}"/><circle cx="56" cy="72" r="5" fill="${ink}"/>`,
    animals: `
      <path d="M74 182q-37-4-28-39 2-13 20-22-4 25 16 25 16 0 27 10" fill="${g}"/><path d="M48 134q-8 21 6 35l17-19q-9-5-5-18Z" fill="${gl}"/>
      <path d="M82 170q-6-35 15-57l48-4q35 28 22 72H92Z" fill="${a}"/>
      <path d="m83 74 7-37 32 25 32-25 11 37q15 19 2 43l-42 28-43-28Q68 92 83 74Z" fill="${g}" stroke="${gl}" stroke-width="2"/>
      <path d="m88 70 6-22 20 20m22 0 17-19 7 23" fill="${ink}"/>
      <path d="m81 92 43 12 43-12-8 25-35 22-35-22Z" fill="${gl}"/>
      <path d="m117 107 8 7 8-7" fill="${ink}"/><path d="m94 88 10 4m43-4-10 4" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
      <path d="m111 147-8 32m38-33 10 33" stroke="${ink}" stroke-opacity=".3" stroke-width="4" stroke-linecap="round"/>
      <path d="M184 153q-10-33 15-43 12 28-15 43Zm0 19q-3-22-23-25-5 23 23 25Z" fill="${a}"/>
      <path d="M185 74q-23-23-25-3 0 15 25 11 22-3 17-15-7-16-17 7Z" fill="${a}"/><path d="m183 72 5 16" stroke="${ink}" stroke-width="3"/>`,
    food: `
      <ellipse cx="124" cy="187" rx="68" ry="11" fill="${ink}" opacity=".5"/>
      <path d="m157 39 19 85m2-89 9 85" stroke="${g}" stroke-width="6" stroke-linecap="round"/>
      <path d="M67 122q-2-37 17-36t14 35q-2 11 9 10 13 0 11-21t13-21q17 0 14 30" fill="none" stroke="${gl}" stroke-width="7" stroke-linecap="round"/>
      <path d="M55 119h145q-8 65-72 66-63 0-73-66Z" fill="url(#object)" stroke="${p}" stroke-width="3"/>
      <ellipse cx="127" cy="120" rx="73" ry="15" fill="${a}" stroke="${gl}" stroke-width="3"/>
      <path d="M67 117q22-18 42-1t41 0 32 0" fill="none" stroke="${gl}" stroke-width="5" stroke-linecap="round"/>
      <path d="M98 112q-18-38 7-43 28-4 29 44Z" fill="${p}"/><ellipse cx="112" cy="98" rx="12" ry="14" fill="${g}"/>
      <path d="M151 111q-8-38 14-38 16 15-14 38Zm-4-7q-30-7-23-25 26-7 23 25Z" fill="#9bdcaa"/>
      <path d="M83 144q44 14 89 0" fill="none" stroke="${p}" stroke-opacity=".5" stroke-width="3"/>
      <path d="M75 64q-10-12 0-22m26 18q-9-13 1-23" fill="none" stroke="${p}" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>`,
    sports: `
      <path d="M96 76H66q-6 50 39 51m55-51h29q5 50-39 51" fill="none" stroke="${g}" stroke-width="9"/>
      <path d="M91 64h74l-6 48q-3 29-31 31-28-2-32-31Z" fill="url(#gold)" stroke="${gl}" stroke-width="3"/>
      <path d="M127 142v25m-25 12h52m-17-13h-21l-8 13h37Z" fill="${g}" stroke="${g}" stroke-width="6" stroke-linecap="round"/>
      <path d="m128 80 5 11 13 2-9 9 2 13-11-6-12 6 3-13-10-9 13-2Z" fill="${ink}" opacity=".75"/>
      <circle cx="180" cy="163" r="36" fill="${a}" stroke="${gl}" stroke-width="3"/>
      <path d="M145 160q35 15 69-6m-46-24q-9 38 11 69m17-65q-27 17-44 47m-1-40q42 9 57 43" fill="none" stroke="${ink}" stroke-width="3"/>
      <path d="M54 129V64l30 10-30 20" fill="${a}" stroke="${gl}" stroke-width="3" stroke-linejoin="round"/>`,
    screen: `
      <path d="M58 112h133v71H58Z" fill="url(#object)" stroke="${p}" stroke-width="3"/>
      <path d="M72 125h105v44H72Z" fill="${ink}"/><path d="m114 134 25 13-25 13Z" fill="${g}"/>
      <path d="m50 72 133-20 6 26L54 98Z" fill="${a}" stroke="${p}" stroke-width="3" stroke-linejoin="round"/>
      <path d="m62 70 17 23m11-27 17 23m11-27 17 23m11-27 17 23" stroke="${ink}" stroke-width="10"/>
      <path d="M55 98h134v18H55Z" fill="${a}"/><path d="m76 98-9 18m37-18-9 18m37-18-9 18m37-18-9 18m37-18-9 18" stroke="${ink}" stroke-width="8"/>
      <circle cx="189" cy="179" r="27" fill="${g}" stroke="${gl}" stroke-width="3"/>
      <g fill="${ink}"><circle cx="189" cy="179" r="4"/><circle cx="189" cy="164" r="6"/><circle cx="189" cy="194" r="6"/><circle cx="174" cy="179" r="6"/><circle cx="204" cy="179" r="6"/></g>
      <path d="m203 200 14 10" stroke="${g}" stroke-width="6" stroke-linecap="round"/>`,
    music: `
      <path d="M51 90h155v100H51Z" fill="url(#object)" stroke="${p}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="116" cy="137" r="54" fill="${ink}" stroke="${a}" stroke-width="2"/>
      <g fill="none" stroke="${p}" stroke-opacity=".22"><circle cx="116" cy="137" r="45"/><circle cx="116" cy="137" r="37"/><circle cx="116" cy="137" r="30"/></g>
      <path d="M80 118q12-25 38-24m34 62q-12 22-36 24" fill="none" stroke="${p}" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/>
      <circle cx="116" cy="137" r="21" fill="${a}"/><circle cx="116" cy="137" r="5" fill="${ink}"/>
      <circle cx="185" cy="108" r="8" fill="${g}"/><path d="m185 109-4 43-27 16" fill="none" stroke="${g}" stroke-width="6" stroke-linecap="round"/><path d="m151 166 9 7" stroke="${gl}" stroke-width="8" stroke-linecap="round"/>
      <path d="M99 67V42l36-7v27" fill="none" stroke="${a}" stroke-width="5" stroke-linejoin="round"/><ellipse cx="91" cy="68" rx="10" ry="7" fill="${a}" transform="rotate(-18 91 68)"/><ellipse cx="127" cy="64" rx="10" ry="7" fill="${a}" transform="rotate(-18 127 64)"/>
      <path d="M181 62V40l14 9" fill="none" stroke="${g}" stroke-width="4" stroke-linecap="round"/><ellipse cx="174" cy="64" rx="9" ry="6" fill="${g}"/>`,
    science: `
      <path d="M84 69h46m-36 0v39l-30 60q-10 23 14 23h63q23 0 12-23l-33-60V69" fill="${p}" fill-opacity=".14" stroke="${p}" stroke-width="4" stroke-linecap="round"/>
      <path d="m85 141-16 31q-6 12 8 12h65q13 0 7-12l-17-31q-23 12-47 0Z" fill="${a}"/>
      <path d="m88 151-9 23" stroke="${p}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="114" cy="167" r="5" fill="${ink}" fill-opacity=".35"/><circle cx="103" cy="136" r="5" fill="${a}"/><circle cx="116" cy="117" r="3" fill="${a}"/>
      <g fill="none" stroke="${g}" stroke-width="2.5"><ellipse cx="179" cy="86" rx="37" ry="13" transform="rotate(-25 179 86)"/><ellipse cx="179" cy="86" rx="37" ry="13" transform="rotate(35 179 86)"/><ellipse cx="179" cy="86" rx="37" ry="13" transform="rotate(95 179 86)"/></g>
      <circle cx="179" cy="86" r="8" fill="${g}"/><circle cx="211" cy="68" r="5" fill="${gl}"/>
      <circle cx="67" cy="79" r="8" fill="${a}" fill-opacity=".6"/><circle cx="88" cy="43" r="5" fill="${a}"/><circle cx="174" cy="167" r="7" fill="${a}" fill-opacity=".55"/>`,
    history: `
      <path d="M122 190h73v-13h-73Zm7-24h59v11h-59Zm10-72h38v72h-38Z" fill="url(#gold)" stroke="${gl}" stroke-width="3"/>
      <path d="M130 78h56v16h-56Zm-3-11 31-17 31 17v11h-62Z" fill="${a}" stroke="${gl}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M149 103v52m17-52v52" stroke="${ink}" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
      <path d="M61 91q-15 0-15 15v61q0 16 15 16h60q15 0 15-14h-14V105q0-14-14-14Z" fill="${a}" stroke="${gl}" stroke-width="3"/>
      <path d="M61 91q15 0 15 14H47m29 0h46m-57 62q1 15 15 16" fill="none" stroke="${ink}" stroke-opacity=".4" stroke-width="3"/>
      <path d="M87 119h23m-23 11h23m-23 11h17m-17 11h23" stroke="${ink}" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      <path d="M49 166q-23-37-8-65m-5 36q-25-6-18-24 21 1 18 24Zm1-14q-1-24 19-26 7 17-19 26Z" fill="#9fcea7"/>`,
  };
  return subjects[key];
}

export function categorySvg(key: CategoryKey): string {
  const a = categoryArt[key].accent;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="tile" x2=".8" y2="1"><stop stop-color="#5541b7"/><stop offset="1" stop-color="${palette.ink}"/></linearGradient>
      <linearGradient id="object" x2=".8" y2="1"><stop stop-color="#9789ed"/><stop offset="1" stop-color="${palette.indigo}"/></linearGradient>
      <linearGradient id="gold" x2=".7" y2="1"><stop stop-color="${palette.goldLight}"/><stop offset=".5" stop-color="${palette.gold}"/><stop offset="1" stop-color="#bd8531"/></linearGradient>
    </defs>
    <ellipse cx="128" cy="232" rx="83" ry="12" fill="${palette.ink}" opacity=".12"/>
    <rect x="25" y="28" width="206" height="202" rx="59" fill="${palette.ink}"/>
    <rect x="25" y="20" width="206" height="202" rx="59" fill="url(#tile)" stroke="#9e8fea" stroke-width="1.5"/>
    <rect x="34" y="29" width="188" height="184" rx="50" fill="none" stroke="${a}" stroke-opacity=".13"/>
    <circle cx="128" cy="118" r="79" fill="${a}" fill-opacity=".045" stroke="${a}" stroke-opacity=".15" stroke-dasharray="2 8"/>
    ${categorySubject(key)}
    ${sparkle(209, 46, 7)}${sparkle(45, 187, 5, a)}
    <circle cx="52" cy="46" r="2.5" fill="${a}"/><circle cx="209" cy="196" r="2" fill="${palette.gold}"/>
  </svg>`;
}

export function gemSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="260" viewBox="0 0 240 260">
    <defs><linearGradient id="gem" x2=".8" y2="1"><stop stop-color="#fff2bf"/><stop offset=".5" stop-color="#f7ca59"/><stop offset="1" stop-color="#c78b2e"/></linearGradient></defs>
    <ellipse cx="120" cy="240" rx="70" ry="11" fill="#17113e" opacity=".2"/>
    <path d="m120 16 86 53v102l-86 66-86-66V69Z" fill="#17113e" stroke="#f7ca59" stroke-width="3"/>
    <path d="m120 30 74 46v88l-74 58-74-58V76Z" fill="#4938a2" stroke="#8f80de" stroke-width="2"/>
    <path d="m76 81 88 0 27 38-71 81-71-81Z" fill="url(#gem)"/>
    <path d="m76 81 17 38h54l17-38m-115 38h142m-98 0 27 81 27-81" fill="none" stroke="#fff2bf" stroke-width="2"/>
    <path d="m76 81 17 38-44 0Zm71 38 44 0-71 81Z" fill="#a86523" opacity=".5"/><path d="m93 119 27 81 27-81Z" fill="#fff2bf" opacity=".6"/>
    ${sparkle(178, 56, 14, '#fff2bf')}${sparkle(58, 179, 8)}
    <path d="m109 44 11-9 11 9-11 8Z" fill="#f7ca59"/>
  </svg>`;
}

export function answerCardSvg(accent = palette.gold): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="150" viewBox="0 0 280 150">
    <defs><linearGradient id="card" x2=".8" y2="1"><stop stop-color="#4c3b99"/><stop offset="1" stop-color="#21164f"/></linearGradient></defs>
    <rect x="8" y="13" width="264" height="130" rx="22" fill="#17113e" opacity=".25"/>
    <rect x="8" y="5" width="264" height="130" rx="22" fill="url(#card)" stroke="#9e8fea" stroke-width="1.5"/>
    <rect x="22" y="19" width="236" height="102" rx="14" fill="none" stroke="#ebe5ff" stroke-opacity=".09"/>
    <path d="m48 45 14-9 14 9v19l-14 12-14-12Z" fill="${accent}"/><path d="m53 46 18 0-9 22Z" fill="#fff" opacity=".35"/>
    <path d="M96 47h95m-95 14h64" stroke="#ebe5ff" stroke-opacity=".8" stroke-width="7" stroke-linecap="round"/>
    <path d="M44 95h135" stroke="#ebe5ff" stroke-opacity=".13" stroke-width="10" stroke-linecap="round"/><path d="M44 95h94" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="224" cy="94" r="14" fill="${accent}"/><path d="m218 94 4 4 8-9" fill="none" stroke="#17113e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export function heroSceneSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="600" viewBox="0 0 720 600">
    <defs><radialGradient id="halo"><stop stop-color="#7561df" stop-opacity=".22"/><stop offset="1" stop-color="#7561df" stop-opacity="0"/></radialGradient><linearGradient id="pedestal" x2=".8" y2="1"><stop stop-color="#7561df"/><stop offset="1" stop-color="#21164f"/></linearGradient></defs>
    <circle cx="360" cy="290" r="280" fill="url(#halo)"/>
    <g fill="none" stroke="#9586e0"><ellipse cx="360" cy="318" rx="278" ry="113" transform="rotate(-25 360 318)" stroke-opacity=".25"/><ellipse cx="360" cy="318" rx="250" ry="158" transform="rotate(29 360 318)" stroke-opacity=".15" stroke-dasharray="4 10"/><circle cx="360" cy="286" r="185" stroke-opacity=".08"/></g>
    <ellipse cx="360" cy="510" rx="171" ry="24" fill="#17113e" opacity=".12"/>
    <path d="M223 441v30c0 37 274 37 274 0v-30" fill="url(#pedestal)" stroke="#9e8fea" stroke-width="1.5"/>
    <ellipse cx="360" cy="441" rx="137" ry="29" fill="#48378e" stroke="#b6a6ec" stroke-width="1.5"/>
    <ellipse cx="360" cy="439" rx="111" ry="18" fill="none" stroke="#f7ca59" stroke-opacity=".5"/>
    <path d="m238 449 0 19m244-19v19" stroke="#f7ca59" stroke-opacity=".4" stroke-width="3"/>
    ${sparkle(143, 202, 11)}${sparkle(555, 373, 13)}${sparkle(503, 102, 7, '#b9aaff')}${sparkle(232, 352, 5, '#b9aaff')}${sparkle(343, 83, 6)}
    <g fill="#b9aaff"><circle cx="183" cy="389" r="3"/><circle cx="566" cy="231" r="3"/><circle cx="274" cy="126" r="2"/><circle cx="484" cy="496" r="2"/></g>
    <circle cx="583" cy="306" r="11" fill="#70dfdc" stroke="#d8fffb" stroke-width="2"/><circle cx="178" cy="321" r="7" fill="#f7ca59"/>
  </svg>`;
}

export function magnifierSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="200" viewBox="0 0 180 200">
    <path d="m107 126 49 51" stroke="#17113e" stroke-width="25" stroke-linecap="round"/><path d="m112 132 41 43" stroke="#f7ca59" stroke-width="17" stroke-linecap="round"/>
    <circle cx="72" cy="79" r="58" fill="#17113e" fill-opacity=".82" stroke="#f7ca59" stroke-width="9"/><circle cx="72" cy="79" r="46" fill="#7561df" fill-opacity=".25" stroke="#fff0b3" stroke-width="1.5"/>
    <path d="M39 76q2-27 27-31" fill="none" stroke="#ebe5ff" stroke-width="5" stroke-linecap="round" opacity=".65"/>
    <path d="m73 55 21 23-21 26-21-26Z" fill="#70dfdc"/><path d="m73 55 0 49 21-26Z" fill="#3b9da9"/><path d="m73 55-6 23h-15" fill="none" stroke="#d8fffb" stroke-width="2"/>
  </svg>`;
}
