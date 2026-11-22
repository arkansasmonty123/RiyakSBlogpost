/**
 * Static SVG stage sets for the illustrated point-and-click prototype.
 *
 * These are decorative compositions only: every interactive object remains a real,
 * labelled button rendered by App. There are no image assets, no animation and no
 * case content — just architectural cues (desk, books, window, door, corridor).
 */
import type { ReactElement } from 'react';

const C = {
  brass: '#c8a75a',
  brassSoft: '#9c8147',
  brassFaint: '#6f5c33',
  paper: '#ddd5c3',
  paperShade: '#b7ae9b',
  wood: '#6b5138',
  woodDark: '#3d2e21',
  teal: '#456267',
  oxblood: '#63393b',
  slate: '#46586b',
  shadow: '#0b0d12',
} as const;

/** Shared wall/floor plane and reusable light sources. */
function Backdrop() {
  return (
    <g>
      <defs>
        <linearGradient id="bar-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#242c3a" />
          <stop offset="100%" stopColor="#12161e" />
        </linearGradient>
        <linearGradient id="bar-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d2720" />
          <stop offset="100%" stopColor="#100f0d" />
        </linearGradient>
        <linearGradient id="bar-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.wood} />
          <stop offset="100%" stopColor={C.woodDark} />
        </linearGradient>
        <linearGradient id="bar-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b7280" />
          <stop offset="65%" stopColor="#8f9a95" />
          <stop offset="100%" stopColor="#c9b98f" />
        </linearGradient>
        <radialGradient id="bar-glow">
          <stop offset="0%" stopColor={C.brass} stopOpacity="0.3" />
          <stop offset="100%" stopColor={C.brass} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bar-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d9bd77" />
          <stop offset="100%" stopColor={C.brassSoft} />
        </linearGradient>
      </defs>
      <rect width="800" height="332" fill="url(#bar-wall)" />
      <rect y="332" width="800" height="118" fill="url(#bar-floor)" />
      <rect y="328" width="800" height="6" fill="#0e1116" opacity="0.85" />
      <rect y="328" width="800" height="1.5" fill={C.brass} opacity="0.22" />
    </g>
  );
}

function Lamp({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y - 6} r="104" fill="url(#bar-glow)" />
      <rect x={x - 2} y={y - 4} width="4" height="64" fill={C.brassFaint} />
      <path d={`M ${x - 30} ${y - 4} Q ${x} ${y - 44} ${x + 30} ${y - 4} Z`} fill={C.brass} opacity="0.9" />
      <rect x={x - 16} y={y + 58} width="32" height="5" rx="2.5" fill={C.brassSoft} />
    </g>
  );
}

/** Simple office chair silhouette; `s` scales around its base point. */
function Chair({ x, y, s = 1, color = '#2b3442' }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="4" rx="34" ry="7" fill={C.shadow} opacity="0.4" />
      <rect x="-24" y="-70" width="48" height="52" rx="14" fill={color} stroke={C.brassFaint} strokeWidth="1" />
      <rect x="-28" y="-22" width="56" height="15" rx="6" fill={color} stroke={C.brassFaint} strokeWidth="1" />
      <rect x="-3" y="-7" width="6" height="18" fill={C.brassFaint} />
      <path d="M -26 11 L 26 11 L 18 17 L -18 17 Z" fill={C.brassFaint} />
    </g>
  );
}

/** Stack of case folders with brass label tabs. */
function FileStack({ x, y, count = 3, s = 1 }: { x: number; y: number; count?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {Array.from({ length: count }, (_, i) => (
        <g key={i} transform={`translate(0 ${-i * 7})`}>
          <rect x="0" y="0" width="62" height="10" rx="1.5" fill={i % 2 ? C.paperShade : C.paper} stroke="#7c735f" strokeWidth="0.6" />
          <rect x="7" y="3" width="20" height="3" fill={C.brassSoft} opacity="0.7" />
        </g>
      ))}
    </g>
  );
}

/** A sheet of ruled notes seen from above. */
function Paper({ x, y, w = 70, h = 52, lines = 4 }: { x: number; y: number; w?: number; h?: number; lines?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="1.5" fill={C.paper} stroke="#8c836f" strokeWidth="0.8" />
      {Array.from({ length: lines }, (_, i) => (
        <rect key={i} x="8" y={10 + i * 9} width={w - 16 - (i % 2) * 12} height="2" fill="#8f876f" opacity="0.7" />
      ))}
    </g>
  );
}

const BOOK_COLORS = [C.oxblood, C.teal, C.slate, C.brassSoft, '#6a6353', C.wood, '#4a4f5c'];

/** Deterministic row of book spines, optionally with a couple of fallen volumes. */
function BookRow({ x, y, width, height, seed = 0 }: { x: number; y: number; width: number; height: number; seed?: number }) {
  const books: Array<{ w: number; h: number; c: string }> = [];
  let cursor = 0;
  let i = 0;
  while (cursor < width - 6) {
    const w = 12 + ((i * 7 + seed * 5) % 13);
    const h = height - 6 - ((i * 11 + seed * 3) % 16);
    books.push({ w, h, c: BOOK_COLORS[(i + seed) % BOOK_COLORS.length] });
    cursor += w + 2;
    i += 1;
  }
  return (
    <g>
      {books.map((b, idx) => (
        <g key={idx}>
          <rect x={x + books.slice(0, idx).reduce((sum, prev) => sum + prev.w + 2, 0)} y={y + height - b.h} width={b.w} height={b.h} fill={b.c} stroke="#101318" strokeWidth="0.6" />
          <rect x={x + books.slice(0, idx).reduce((sum, prev) => sum + prev.w + 2, 0) + 2} y={y + height - b.h + 8} width={b.w - 4} height="1.5" fill={C.brass} opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

function Noticeboard({ x, y, w = 150, h = 96 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx="2" fill={C.woodDark} stroke={C.brassFaint} strokeWidth="2" />
      <rect x={x} y={y} width={w} height={h} fill="#514636" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${x + 12 + i * (w - 34) / 3} ${y + 12 + (i % 2) * 10})`}>
          <rect width="30" height="38" fill={i === 1 ? C.paperShade : C.paper} opacity="0.92" />
          {[0, 1, 2].map((l) => <rect key={l} x="4" y={8 + l * 7} width="22" height="1.6" fill="#7c735f" opacity="0.7" />)}
          <circle cx="15" cy="3" r="2" fill={C.oxblood} />
        </g>
      ))}
    </g>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M 0 0 Q -26 -26 -18 -54 Q -2 -40 0 0 Z" fill="#3d5c43" stroke="#26392a" strokeWidth="1" />
      <path d="M 0 0 Q 22 -30 20 -60 Q 2 -42 0 0 Z" fill="#4c6b4b" stroke="#26392a" strokeWidth="1" />
      <path d="M 0 0 Q -8 -42 2 -70 Q 12 -40 0 0 Z" fill="#557457" stroke="#26392a" strokeWidth="1" />
      <path d="M -16 0 L 16 0 L 12 26 L -12 26 Z" fill={C.wood} stroke={C.brassFaint} strokeWidth="1" />
    </g>
  );
}

function WallClock({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="30" fill="#161b23" stroke={C.brassSoft} strokeWidth="3" />
      <circle cx={x} cy={y} r="24" fill="#202733" stroke={C.brassFaint} strokeWidth="1" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={x + Math.sin(a) * 19} cy={y - Math.cos(a) * 19} r={i % 3 === 0 ? 2 : 1} fill={C.brass} />;
      })}
      <line x1={x} y1={y} x2={x + 10} y2={y - 8} stroke={C.paper} strokeWidth="2.5" strokeLinecap="round" />
      <line x1={x} y1={y} x2={x - 5} y2={y - 15} stroke={C.brass} strokeWidth="2" strokeLinecap="round" />
      <circle cx={x} cy={y} r="2.5" fill={C.brass} />
    </g>
  );
}

function EntranceScene() {
  return (
    <g>
      <ellipse cx="400" cy="408" rx="170" ry="20" fill="#1d1a16" opacity="0.7" />
      <rect x="300" y="66" width="196" height="264" fill={C.woodDark} stroke={C.brassFaint} strokeWidth="3" />
      <rect x="314" y="80" width="168" height="250" fill="#2a303b" stroke={C.brassSoft} strokeWidth="1" />
      <rect x="330" y="102" width="136" height="28" rx="2" fill="url(#bar-brass)" stroke={C.brassFaint} strokeWidth="1" />
      <text x="398" y="120" textAnchor="middle" fontSize="9" letterSpacing="0.8" fill="#1a1710" fontFamily="Georgia, serif">MEERA KULKARNI</text>
      <rect x="334" y="150" width="128" height="80" fill="#262c36" stroke={C.brassFaint} strokeWidth="1" />
      <rect x="334" y="244" width="128" height="74" fill="#262c36" stroke={C.brassFaint} strokeWidth="1" />
      <circle cx="462" cy="214" r="6" fill={C.brass} />
      <circle cx="462" cy="214" r="2.5" fill="#3a2f18" />
      <Lamp x={140} y={118} />
      <Chair x={606} y={372} s={1.05} color="#33404f" />
      <g transform="translate(150 300)">
        <rect x="0" y="18" width="96" height="8" rx="2" fill={C.wood} />
        <rect x="10" y="26" width="5" height="48" fill={C.woodDark} />
        <rect x="82" y="26" width="5" height="48" fill={C.woodDark} />
        <FileStack x={16} y={16} count={3} s={0.9} />
      </g>
    </g>
  );
}

function DeskScene() {
  return (
    <g>
      <g opacity="0.55">
        <rect x="70" y="74" width="180" height="196" fill="#2a2118" stroke={C.brassFaint} strokeWidth="1.5" />
        <rect x="70" y="138" width="180" height="4" fill={C.brassFaint} />
        <rect x="70" y="204" width="180" height="4" fill={C.brassFaint} />
        <BookRow x={78} y={80} width={164} height={56} seed={2} />
        <BookRow x={78} y={144} width={164} height={58} seed={4} />
      </g>
      <Chair x={400} y={256} s={1.1} color="#2f3a49" />
      <g>
        <polygon points="132,292 668,292 720,346 80,346" fill="url(#bar-wood)" stroke={C.brassFaint} strokeWidth="1.5" />
        <rect x="96" y="346" width="608" height="52" fill={C.woodDark} />
        <rect x="112" y="356" width="150" height="30" rx="2" fill="#33271c" stroke={C.brassFaint} strokeWidth="1" />
        <rect x="538" y="356" width="150" height="30" rx="2" fill="#33271c" stroke={C.brassFaint} strokeWidth="1" />
        <rect x="180" y="368" width="34" height="4" rx="2" fill={C.brass} />
        <rect x="586" y="368" width="34" height="4" rx="2" fill={C.brass} />
        <rect x="96" y="346" width="608" height="3" fill={C.brass} opacity="0.4" />
      </g>
      <FileStack x={196} y={290} count={4} />
      <Paper x={316} y={296} w={78} h={48} />
      <g transform="translate(438 296)">
        <rect width="64" height="46" rx="1" fill="#e6dfcd" stroke={C.brassSoft} strokeWidth="1" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x="7" y={9 + i * 8} width={i === 3 ? 28 : 48} height="1.8" fill="#8f876f" />)}
        <line x1="50" y1="6" x2="60" y2="40" stroke={C.oxblood} strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform="translate(584 312)">
        <ellipse cx="16" cy="24" rx="16" ry="5" fill={C.shadow} opacity="0.35" />
        <rect x="4" y="0" width="24" height="24" rx="3" fill="#cfc7b4" stroke="#7c735f" strokeWidth="1" />
        <path d="M 28 6 Q 38 12 28 18" fill="none" stroke="#cfc7b4" strokeWidth="3" />
      </g>
      <Lamp x={676} y={150} />
      <Chair x={744} y={388} s={0.85} color="#3a4655" />
    </g>
  );
}

function BookshelfScene() {
  return (
    <g>
      <rect x="108" y="44" width="584" height="288" fill="#2b2119" stroke={C.brassFaint} strokeWidth="3" />
      <rect x="120" y="56" width="560" height="264" fill="#1c1a19" />
      {[56, 140, 224, 308].map((y) => <rect key={y} x="120" y={y} width="560" height="7" fill={C.wood} stroke={C.brassFaint} strokeWidth="1" />)}
      <BookRow x={128} y={63} width={252} height={70} seed={1} />
      <BookRow x={396} y={63} width={276} height={70} seed={3} />
      <BookRow x={128} y={147} width={276} height={70} seed={5} />
      <g transform="translate(420 190)">
        <rect width="70" height="12" rx="1" fill={C.teal} stroke="#101318" strokeWidth="0.6" />
        <rect y="14" width="76" height="12" rx="1" fill={C.oxblood} stroke="#101318" strokeWidth="0.6" />
        <rect y="28" width="62" height="12" rx="1" fill={C.slate} stroke="#101318" strokeWidth="0.6" />
        <rect x="10" y="4" width="24" height="1.5" fill={C.brass} opacity="0.7" />
        <rect x="10" y="18" width="24" height="1.5" fill={C.brass} opacity="0.7" />
      </g>
      <BookRow x={128} y={231} width={210} height={70} seed={6} />
      <FileStack x={382} y={292} count={4} s={1.1} />
      <Paper x={506} y={280} w={72} h={36} lines={3} />
      <Lamp x={690} y={120} />
    </g>
  );
}

function WindowScene() {
  return (
    <g>
      <defs>
        <clipPath id="bar-panes">
          <rect x="182" y="56" width="436" height="238" />
        </clipPath>
      </defs>
      <rect x="170" y="44" width="460" height="262" fill={C.woodDark} stroke={C.brassFaint} strokeWidth="3" />
      <rect x="182" y="56" width="436" height="238" fill="url(#bar-sky)" />
      <g clipPath="url(#bar-panes)">
        <circle cx="540" cy="108" r="30" fill="#efe2b6" opacity="0.85" />
        <g opacity="0.8" fill="#3e4b50">
          <rect x="182" y="212" width="52" height="82" />
          <rect x="240" y="184" width="40" height="110" />
          <rect x="286" y="228" width="64" height="66" />
          <rect x="358" y="196" width="46" height="98" />
          <rect x="412" y="238" width="58" height="56" />
          <rect x="478" y="204" width="50" height="90" />
          <rect x="534" y="222" width="84" height="72" />
        </g>
        <g fill="#c8a75a" opacity="0.35">
          {[252, 292, 370, 410, 490, 550, 586].map((wx) => [224, 258, 214, 256, 222, 244, 236].map((wy, j) => (
            <rect key={`${wx}-${j}`} x={wx} y={wy + j * 14} width="4" height="5" />
          )))}
        </g>
        <rect x="182" y="278" width="436" height="16" fill="#2f3a3a" opacity="0.6" />
      </g>
      <rect x="398" y="56" width="5" height="238" fill={C.woodDark} />
      <rect x="182" y="172" width="436" height="5" fill={C.woodDark} />
      <rect x="176" y="294" width="448" height="12" fill={C.wood} stroke={C.brassFaint} strokeWidth="1" />
      <Plant x={588} y={294} />
      <WallClock x={694} y={112} />
      <g transform="translate(74 320)">
        <rect x="0" y="0" width="92" height="8" rx="2" fill={C.wood} />
        <rect x="12" y="8" width="5" height="44" fill={C.woodDark} />
        <rect x="76" y="8" width="5" height="44" fill={C.woodDark} />
        <FileStack x={14} y={-2} count={2} s={0.8} />
      </g>
    </g>
  );
}

function ReceptionScene() {
  return (
    <g>
      <Noticeboard x={92} y={66} w={150} h={100} />
      <rect x="618" y="62" width="104" height="128" rx="2" fill="#262d38" stroke={C.brassFaint} strokeWidth="2" />
      <rect x="634" y="80" width="72" height="10" rx="1" fill="url(#bar-brass)" />
      <rect x="638" y="104" width="64" height="64" fill="#202630" stroke={C.brassFaint} strokeWidth="1" />
      <Chair x={676} y={306} s={0.85} color="#33404f" />
      <g>
        <polygon points="96,290 704,290 744,352 56,352" fill="url(#bar-wood)" stroke={C.brassFaint} strokeWidth="1.5" />
        <rect x="72" y="352" width="656" height="58" fill={C.woodDark} />
        <rect x="72" y="352" width="656" height="3" fill={C.brass} opacity="0.4" />
        <rect x="372" y="366" width="56" height="30" rx="2" fill="#33271c" stroke={C.brassFaint} strokeWidth="1" />
        <rect x="390" y="378" width="20" height="3" rx="1.5" fill={C.brass} />
      </g>
      <g transform="translate(210 274)">
        <rect x="0" y="6" width="74" height="12" rx="2" fill={C.oxblood} stroke={C.brassFaint} strokeWidth="1" />
        <rect x="4" y="2" width="66" height="6" rx="1" fill={C.paper} />
        <line x1="58" y1="0" x2="70" y2="-16" stroke={C.brass} strokeWidth="2.5" strokeLinecap="round" />
        <rect x="8" y="12" width="2" height="6" fill={C.brass} />
      </g>
      <g transform="translate(500 278)">
        <path d="M 2 16 Q 2 -2 20 -2 Q 38 -2 38 16 Z" fill={C.brass} stroke={C.brassSoft} strokeWidth="1" />
        <rect x="-4" y="16" width="48" height="5" rx="2.5" fill={C.brassSoft} />
        <circle cx="20" cy="-6" r="4" fill={C.brass} />
      </g>
      <Plant x={762} y={352} />
    </g>
  );
}

function CorridorScene() {
  return (
    <g>
      <rect width="800" height="450" fill="#11151d" />
      <polygon points="0,0 800,0 506,152 294,152" fill="#1b212c" />
      <polygon points="0,450 800,450 506,300 294,300" fill="url(#bar-floor)" />
      <polygon points="0,0 294,152 294,300 0,450" fill="#252d3a" />
      <polygon points="800,0 506,152 506,300 800,450" fill="#202734" />
      <line x1="0" y1="450" x2="340" y2="300" stroke={C.brassFaint} strokeWidth="1" opacity="0.5" />
      <line x1="800" y1="450" x2="460" y2="300" stroke={C.brassFaint} strokeWidth="1" opacity="0.5" />
      <rect x="338" y="158" width="124" height="142" fill="#303846" stroke={C.brassSoft} strokeWidth="2" />
      <rect x="350" y="170" width="100" height="130" fill="#3d4756" />
      <rect x="372" y="182" width="56" height="8" rx="1" fill="url(#bar-brass)" opacity="0.9" />
      <circle cx="436" cy="240" r="4" fill={C.brass} />
      <rect x="338" y="150" width="124" height="8" fill={C.brassFaint} />
      <g>
        <polygon points="34,116 168,150 168,290 34,352" fill="#1a202a" stroke={C.brassFaint} strokeWidth="1.5" />
        <rect x="78" y="176" width="42" height="8" rx="1" fill={C.brassSoft} opacity="0.8" />
        <circle cx="150" cy="248" r="4" fill={C.brass} />
        <polygon points="766,116 632,150 632,290 766,352" fill="#1a202a" stroke={C.brassFaint} strokeWidth="1.5" />
        <rect x="680" y="176" width="42" height="8" rx="1" fill={C.brassSoft} opacity="0.8" />
        <circle cx="650" cy="248" r="4" fill={C.brass} />
      </g>
      <g opacity="0.65" fill="#0c1016">
        <ellipse cx="376" cy="298" rx="9" ry="4" />
        <path d="M 369 296 Q 369 272 376 272 Q 383 272 383 296 Z" />
        <ellipse cx="424" cy="298" rx="9" ry="4" />
        <path d="M 417 296 Q 417 274 424 274 Q 431 274 431 296 Z" />
      </g>
      <Lamp x={96} y={70} />
    </g>
  );
}

function WaitingScene() {
  return (
    <g>
      <Noticeboard x={318} y={54} w={168} h={104} />
      <rect x="40" y="120" width="96" height="206" fill="#262d38" stroke={C.brassFaint} strokeWidth="2" />
      <rect x="54" y="140" width="68" height="10" rx="1" fill="url(#bar-brass)" />
      <rect x="54" y="166" width="68" height="146" fill="#2b323d" stroke={C.brassFaint} strokeWidth="1" />
      <circle cx="112" cy="240" r="5" fill={C.brass} />
      <g transform="translate(250 300)">
        <rect x="-40" y="-58" width="80" height="46" rx="14" fill="#394858" stroke={C.brassFaint} strokeWidth="1" />
        <rect x="-46" y="-14" width="92" height="18" rx="7" fill="#394858" stroke={C.brassFaint} strokeWidth="1" />
        <rect x="-52" y="-30" width="12" height="30" rx="5" fill="#31404e" />
        <rect x="40" y="-30" width="12" height="30" rx="5" fill="#31404e" />
        <rect x="-34" y="4" width="6" height="12" fill={C.brassFaint} />
        <rect x="28" y="4" width="6" height="12" fill={C.brassFaint} />
      </g>
      <g transform="translate(480 300)">
        <rect x="-40" y="-58" width="80" height="46" rx="14" fill="#3b4b5c" stroke={C.brassFaint} strokeWidth="1" />
        <rect x="-46" y="-14" width="92" height="18" rx="7" fill="#3b4b5c" stroke={C.brassFaint} strokeWidth="1" />
        <rect x="-52" y="-30" width="12" height="30" rx="5" fill="#334250" />
        <rect x="40" y="-30" width="12" height="30" rx="5" fill="#334250" />
        <rect x="-34" y="4" width="6" height="12" fill={C.brassFaint} />
        <rect x="28" y="4" width="6" height="12" fill={C.brassFaint} />
      </g>
      <g transform="translate(366 344)">
        <ellipse cx="0" cy="30" rx="56" ry="8" fill={C.shadow} opacity="0.35" />
        <rect x="-52" y="0" width="104" height="10" rx="3" fill={C.wood} stroke={C.brassFaint} strokeWidth="1" />
        <rect x="-44" y="10" width="6" height="26" fill={C.woodDark} />
        <rect x="38" y="10" width="6" height="26" fill={C.woodDark} />
        <rect x="-18" y="-6" width="40" height="6" fill={C.oxblood} />
      </g>
      <Plant x={690} y={356} />
      <Lamp x={700} y={96} />
    </g>
  );
}

function ConsultationScene() {
  return (
    <g>
      <defs>
        <clipPath id="bar-consult-window">
          <rect x="40" y="62" width="92" height="150" />
        </clipPath>
      </defs>
      <rect x="32" y="54" width="108" height="166" fill={C.woodDark} stroke={C.brassFaint} strokeWidth="2" />
      <rect x="40" y="62" width="92" height="150" fill="url(#bar-sky)" />
      <g clipPath="url(#bar-consult-window)" opacity="0.7" fill="#3e4b50">
        <rect x="40" y="166" width="30" height="46" />
        <rect x="76" y="146" width="26" height="66" />
        <rect x="108" y="172" width="24" height="40" />
      </g>
      <rect x="84" y="62" width="4" height="150" fill={C.woodDark} />
      <rect x="40" y="132" width="92" height="4" fill={C.woodDark} />
      <rect x="332" y="58" width="136" height="104" rx="2" fill="#2a2119" stroke={C.brassFaint} strokeWidth="3" />
      <rect x="344" y="70" width="112" height="80" fill={C.paper} opacity="0.85" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="354" y={82 + i * 12} width={i === 4 ? 48 : 90} height="2.5" fill="#8f876f" opacity="0.75" />)}
      <circle cx="444" cy="140" r="6" fill={C.oxblood} opacity="0.8" />
      <Chair x={250} y={356} s={1.15} color="#35424f" />
      <Chair x={552} y={356} s={1.15} color="#35424f" />
      <ellipse cx="400" cy="404" rx="186" ry="16" fill={C.shadow} opacity="0.35" />
      <ellipse cx="400" cy="330" rx="184" ry="44" fill={C.woodDark} />
      <ellipse cx="400" cy="320" rx="184" ry="44" fill="url(#bar-wood)" stroke={C.brassFaint} strokeWidth="1.5" />
      <g transform="translate(372 300) rotate(-6)">
        <rect width="76" height="52" rx="1.5" fill={C.paper} stroke="#8c836f" strokeWidth="0.8" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x="8" y={10 + i * 9} width={i === 3 ? 30 : 58} height="2" fill="#8f876f" opacity="0.7" />)}
        <rect x="8" y="44" width="18" height="2" fill={C.brassSoft} />
      </g>
      <g transform="translate(472 306)">
        <ellipse cx="12" cy="20" rx="13" ry="4" fill={C.shadow} opacity="0.3" />
        <rect x="2" y="0" width="22" height="20" rx="3" fill="#cfc7b4" stroke="#7c735f" strokeWidth="1" />
        <path d="M 24 5 Q 33 10 24 15" fill="none" stroke="#cfc7b4" strokeWidth="2.5" />
      </g>
      <Lamp x={660} y={112} />
    </g>
  );
}

const SCENES: Record<string, () => ReactElement> = {
  entrance: EntranceScene,
  desk: DeskScene,
  bookshelf: BookshelfScene,
  window: WindowScene,
  'reception-desk': ReceptionScene,
  corridor: CorridorScene,
  'waiting-area': WaitingScene,
  'consultation-room': ConsultationScene,
};

export function SceneArt({ viewpointId }: { viewpointId: string }) {
  const Scene = SCENES[viewpointId] ?? EntranceScene;
  return (
    <svg
      className="scene-art"
      viewBox="0 0 800 450"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <Backdrop />
      <Scene />
    </svg>
  );
}
