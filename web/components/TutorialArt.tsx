'use client';

import type { TutorialArt } from '@/lib/tutorial';
import { useLocale } from '@/components/I18nProvider';
import { pick } from '@/lib/i18n';
import { componentsCopy, type ComponentsCopyShape } from '@/lib/i18n/components';

type ArtCopy = ComponentsCopyShape['tutorialArt'];

const INK = 'var(--ink)';

/**
 * The little animated scenes used by the walkthrough. Every scene is plain
 * SVG in the ink-and-pastel style, animated with CSS so it stays light and
 * works in both directions.
 */
export function TutorialArt({ art }: { art: TutorialArt }) {
  const locale = useLocale();
  const t = pick(componentsCopy, locale).tutorialArt;
  return (
    <div className="tut-art" aria-hidden="true">
      <svg viewBox="0 0 340 190" role="presentation">
        {art === 'lifecycle' ? <Lifecycle t={t} /> : null}
        {art === 'types' ? <GiftTypes t={t} /> : null}
        {art === 'create' ? <CreateForm t={t} /> : null}
        {art === 'packages' ? <Packages t={t} /> : null}
        {art === 'publish' ? <Publish /> : null}
        {art === 'sell' ? <Sell t={t} /> : null}
        {art === 'issue' ? <Issue t={t} /> : null}
        {art === 'claim' ? <Claim t={t} /> : null}
        {art === 'redeem' ? <Redeem t={t} /> : null}
        {art === 'ledger' ? <Ledger t={t} /> : null}
        {art === 'import' ? <ImportCodes t={t} /> : null}
        {art === 'reconcile' ? <Reconcile t={t} /> : null}
        {art === 'approve' ? <Approve t={t} /> : null}
        {art === 'moderate' ? <Moderate /> : null}
        {art === 'support' ? <Support /> : null}
        {art === 'report' ? <Report /> : null}
      </svg>
    </div>
  );
}

function Label({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize="11"
      fontWeight="800"
      fill={INK}
      fontFamily="inherit"
    >
      {children}
    </text>
  );
}

function Lifecycle({ t }: { t: ArtCopy }) {
  const steps = [
    { x: 30, label: t.create, fill: 'var(--mint)' },
    { x: 100, label: t.sell, fill: 'var(--gold)' },
    { x: 170, label: t.issue, fill: 'var(--lavender)' },
    { x: 240, label: t.claim, fill: 'var(--sky)' },
    { x: 310, label: t.redeem, fill: 'var(--coral)' },
  ];
  return (
    <>
      <line x1="34" y1="80" x2="306" y2="80" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      {steps.map((step, index) => (
        <g key={step.label} className="tut-node" style={{ animationDelay: `${index * 0.18}s` }}>
          <circle cx={step.x} cy="80" r="17" fill={step.fill} stroke={INK} strokeWidth="2.5" />
          <circle cx={step.x} cy="80" r="6" fill={INK} opacity="0.18" />
          <Label x={step.x} y={120}>
            {step.label}
          </Label>
        </g>
      ))}
      <polygon className="tut-runner" points="300,74 312,80 300,86" fill={INK} />
    </>
  );
}

function GiftTypes({ t }: { t: ArtCopy }) {
  const cards = [
    { x: 12, fill: 'var(--mint)', label: t.giftCard, sub: t.anyAmount },
    { x: 117, fill: 'var(--lavender)', label: t.experience, sub: t.fixedPackages },
    { x: 222, fill: 'var(--coral)', label: t.corporate, sub: t.bulkCodes },
  ];
  return (
    <>
      {cards.map((card, index) => (
        <g key={card.label} className="tut-rise" style={{ animationDelay: `${index * 0.15}s` }}>
          <rect
            x={card.x}
            y="26"
            width="96"
            height="120"
            rx="16"
            fill={card.fill}
            stroke={INK}
            strokeWidth="2.5"
          />
          <rect x={card.x + 14} y="44" width="30" height="22" rx="7" fill="#fff" stroke={INK} strokeWidth="2" />
          <rect x={card.x + 54} y="48" width="28" height="14" rx="7" fill="#fff" stroke={INK} strokeWidth="2" />
          <Label x={card.x + 48} y={108}>
            {card.label}
          </Label>
          <text x={card.x + 48} y="128" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK} opacity="0.7">
            {card.sub}
          </text>
        </g>
      ))}
    </>
  );
}

function CreateForm({ t }: { t: ArtCopy }) {
  return (
    <>
      <rect x="58" y="18" width="224" height="150" rx="16" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <rect x="78" y="40" width="120" height="14" rx="7" fill="var(--mint)" stroke={INK} strokeWidth="2" />
      <rect x="78" y="66" width="184" height="16" rx="8" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
      <rect x="78" y="92" width="140" height="16" rx="8" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
      <rect x="78" y="118" width="90" height="16" rx="8" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
      <rect className="tut-write" x="82" y="70" width="70" height="8" rx="4" fill={INK} opacity="0.65" />
      <rect x="196" y="116" width="66" height="28" rx="10" fill="var(--gold)" stroke={INK} strokeWidth="2.5" />
      <Label x={229} y={134}>
        {t.save}
      </Label>
      <circle className="tut-pulse" cx="282" cy="60" r="10" fill="var(--lavender)" stroke={INK} strokeWidth="2" />
    </>
  );
}

function Packages({ t }: { t: ArtCopy }) {
  return (
    <>
      <rect x="16" y="24" width="144" height="132" rx="16" fill="var(--mint-soft)" stroke={INK} strokeWidth="2.5" />
      <Label x={88} y={50}>
        {t.money}
      </Label>
      {[0, 1, 2].map((index) => (
        <g key={index} className="tut-rise" style={{ animationDelay: `${index * 0.15}s` }}>
          <circle cx={50 + index * 38} cy="96" r="15" fill="var(--mint)" stroke={INK} strokeWidth="2.5" />
          <text x={50 + index * 38} y="100" textAnchor="middle" fontSize="10" fontWeight="800" fill={INK}>
            {50 + index * 50}
          </text>
        </g>
      ))}
      <polygon className="tut-pulse" points="160,86 176,96 160,106" fill={INK} />

      <rect x="182" y="24" width="144" height="132" rx="16" fill="var(--lavender-soft)" stroke={INK} strokeWidth="2.5" />
      <Label x={254} y={50}>
        {t.experience}
      </Label>
      {[0, 1, 2].map((index) => (
        <g key={index} className="tut-rise" style={{ animationDelay: `${0.15 + index * 0.15}s` }}>
          <rect x={202} y={66 + index * 26} width="104" height="20" rx="10" fill="var(--lavender)" stroke={INK} strokeWidth="2.5" />
          <text x={254} y={80 + index * 26} textAnchor="middle" fontSize="10" fontWeight="800" fill={INK}>
            {[t.oneSession, t.threeSessions, t.twoPeople][index]}
          </text>
        </g>
      ))}
    </>
  );
}

function Publish() {
  return (
    <>
      <rect x="92" y="46" width="150" height="96" rx="18" fill="var(--mint)" stroke={INK} strokeWidth="2.5" />
      <rect x="112" y="66" width="52" height="22" rx="8" fill="#fff" stroke={INK} strokeWidth="2" />
      <rect x="172" y="70" width="50" height="14" rx="7" fill="#fff" stroke={INK} strokeWidth="2" />
      <rect x="112" y="106" width="110" height="12" rx="6" fill={INK} opacity="0.18" />
      <g className="tut-rise">
        <circle cx="256" cy="40" r="16" fill="var(--gold)" stroke={INK} strokeWidth="2.5" />
        <path d="M250 40l5 5 9-10" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <polygon className="tut-pulse" points="236,150 248,164 260,150" fill={INK} />
      <rect x="140" y="164" width="54" height="12" rx="6" fill="var(--lavender)" stroke={INK} strokeWidth="2" />
    </>
  );
}

function Sell({ t }: { t: ArtCopy }) {
  return (
    <>
      <rect x="22" y="28" width="122" height="128" rx="16" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <rect x="40" y="48" width="86" height="54" rx="10" fill="var(--gold-soft)" stroke={INK} strokeWidth="2" />
      <circle cx="62" cy="70" r="10" fill="var(--gold)" stroke={INK} strokeWidth="2" />
      <rect x="82" y="64" width="32" height="12" rx="6" fill="#fff" stroke={INK} strokeWidth="2" />
      <rect x="40" y="116" width="60" height="12" rx="6" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
      <rect x="40" y="136" width="40" height="10" rx="5" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />

      <polygon className="tut-pulse" points="150,88 168,98 150,108" fill={INK} />

      <rect x="176" y="28" width="142" height="128" rx="16" fill="var(--lavender-soft)" stroke={INK} strokeWidth="2.5" />
      <Label x={247} y={60}>
        {t.paid}
      </Label>
      <rect x="196" y="76" width="102" height="14" rx="7" fill="#fff" stroke={INK} strokeWidth="2" />
      <rect x="196" y="100" width="72" height="14" rx="7" fill="#fff" stroke={INK} strokeWidth="2" />
      <g className="tut-rise">
        <rect x="196" y="124" width="102" height="20" rx="10" fill="var(--mint)" stroke={INK} strokeWidth="2.5" />
        <text x="247" y="138" textAnchor="middle" fontSize="10" fontWeight="800" fill={INK}>
          {t.giftCardIssued}
        </text>
      </g>
    </>
  );
}

function Issue({ t }: { t: ArtCopy }) {
  return (
    <>
      <rect x="40" y="52" width="180" height="104" rx="16" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <path d="M40 62l90 52 90-52" fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <g className="tut-fly">
        <rect x="236" y="34" width="76" height="46" rx="10" fill="var(--coral)" stroke={INK} strokeWidth="2.5" />
        <rect x="250" y="48" width="48" height="6" rx="3" fill="#fff" />
        <rect x="250" y="60" width="30" height="6" rx="3" fill="#fff" />
      </g>
      <g className="tut-rise" style={{ animationDelay: '0.5s' }}>
        <rect x="96" y="118" width="70" height="22" rx="11" fill="var(--mint)" stroke={INK} strokeWidth="2.5" />
        <text x="131" y="133" textAnchor="middle" fontSize="10" fontWeight="800" fill={INK}>
          {t.codeSent}
        </text>
      </g>
    </>
  );
}

function Claim({ t }: { t: ArtCopy }) {
  return (
    <>
      <rect x="96" y="18" width="120" height="158" rx="20" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <rect x="108" y="34" width="96" height="30" rx="10" fill="var(--sky-soft)" stroke={INK} strokeWidth="2" />
      <g className="tut-rise">
        <rect x="108" y="76" width="96" height="58" rx="12" fill="var(--mint)" stroke={INK} strokeWidth="2.5" />
        <rect x="120" y="90" width="36" height="20" rx="7" fill="#fff" stroke={INK} strokeWidth="2" />
        <rect x="164" y="94" width="30" height="12" rx="6" fill="#fff" stroke={INK} strokeWidth="2" />
      </g>
      <rect x="108" y="146" width="52" height="14" rx="7" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
      <polygon className="tut-pulse" points="240,92 258,102 240,112" fill={INK} />
      <g className="tut-rise" style={{ animationDelay: '0.4s' }}>
        <rect x="262" y="82" width="60" height="40" rx="10" fill="var(--gold)" stroke={INK} strokeWidth="2.5" />
        <text x="292" y="106" textAnchor="middle" fontSize="10" fontWeight="800" fill={INK}>
          {t.wallet}
        </text>
      </g>
    </>
  );
}

function Redeem({ t }: { t: ArtCopy }) {
  return (
    <>
      <rect x="36" y="30" width="120" height="130" rx="16" fill="var(--lavender-soft)" stroke={INK} strokeWidth="2.5" />
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={52 + col * 24}
            y={50 + row * 24}
            width="14"
            height="14"
            rx="3"
            fill={INK}
            opacity={(row + col) % 3 === 0 ? 0.85 : 0.2}
          />
        )),
      )}
      <g className="tut-scan">
        <rect x="30" y="96" width="132" height="8" rx="4" fill="var(--coral)" stroke={INK} strokeWidth="2" />
      </g>

      <polygon className="tut-pulse" points="166,88 186,100 166,112" fill={INK} />

      <rect x="196" y="30" width="116" height="130" rx="16" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <Label x={254} y={58}>
        {t.balance}
      </Label>
      <rect x="212" y="70" width="84" height="14" rx="7" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
      <rect className="tut-drain" x="212" y="96" width="84" height="18" rx="9" fill="var(--mint)" stroke={INK} strokeWidth="2.5" />
      <text x="254" y="110" textAnchor="middle" fontSize="9" fontWeight="800" fill={INK}>
        100 → 40
      </text>
      <rect x="212" y="126" width="60" height="12" rx="6" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
    </>
  );
}

function Ledger({ t }: { t: ArtCopy }) {
  return (
    <>
      <rect x="22" y="24" width="296" height="142" rx="16" fill="#fff" stroke={INK} strokeWidth="2.5" />
      {[0, 1, 2, 3].map((row) => (
        <g key={row}>
          <rect x="42" y={44 + row * 28} width="70" height="12" rx="6" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
          <rect x="124" y={44 + row * 28} width="52" height="12" rx="6" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
          <rect
            x="188"
            y={44 + row * 28}
            width="52"
            height="12"
            rx="6"
            fill={row === 3 ? 'var(--coral-soft)' : 'var(--mint-soft)'}
            stroke={INK}
            strokeWidth="2"
          />
          <circle
            className={row === 3 ? 'tut-pulse' : ''}
            cx="272"
            cy={50 + row * 28}
            r="6"
            fill={row === 3 ? 'var(--coral)' : 'var(--mint)'}
            stroke={INK}
            strokeWidth="2"
          />
        </g>
      ))}
      <text x="288" y="158" textAnchor="middle" fontSize="9" fontWeight="700" fill={INK} opacity="0.6">
        {t.everyMovement}
      </text>
    </>
  );
}

function ImportCodes({ t }: { t: ArtCopy }) {
  return (
    <>
      <rect x="18" y="30" width="120" height="130" rx="16" fill="#fff" stroke={INK} strokeWidth="2.5" />
      {[0, 1, 2, 3, 4].map((row) => (
        <g key={row} className="tut-rise" style={{ animationDelay: `${row * 0.12}s` }}>
          <rect x="34" y={48 + row * 22} width="88" height="12" rx="6" fill="var(--lavender-soft)" stroke={INK} strokeWidth="2" />
        </g>
      ))}
      <polygon className="tut-pulse" points="146,88 166,100 146,112" fill={INK} />
      <g>
        <rect x="176" y="52" width="140" height="88" rx="16" fill="var(--mint-soft)" stroke={INK} strokeWidth="2.5" />
        <rect x="212" y="30" width="68" height="52" rx="12" fill="var(--gold)" stroke={INK} strokeWidth="2.5" />
        <path d="M228 30v-10a18 18 0 0136 0v10" fill="none" stroke={INK} strokeWidth="2.5" />
        <circle cx="246" cy="54" r="5" fill={INK} />
        <text x="246" y="120" textAnchor="middle" fontSize="10" fontWeight="800" fill={INK}>
          {t.encrypted}
        </text>
      </g>
    </>
  );
}

function Reconcile({ t }: { t: ArtCopy }) {
  return (
    <>
      {[0, 1, 2].map((row) => (
        <g key={row}>
          <rect x="24" y={34 + row * 36} width="112" height="22" rx="11" fill="var(--lavender-soft)" stroke={INK} strokeWidth="2" />
          <rect x="26" y={37 + row * 36} width="108" height="16" rx="8" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
          <polygon className="tut-pulse" points="144,41 158,45 144,49" fill={INK} />
          <rect x="166" y={34 + row * 36} width="112" height="22" rx="11" fill="var(--mint-soft)" stroke={INK} strokeWidth="2" />
          <circle cx="292" cy={45 + row * 36} r="8" fill="var(--mint)" stroke={INK} strokeWidth="2" />
          <path
            d={`M287 ${45 + row * 36}l4 4 7-8`}
            fill="none"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
      <text x="170" y="160" textAnchor="middle" fontSize="10" fontWeight="800" fill={INK} opacity="0.7">
        {t.rowsMatched}
      </text>
    </>
  );
}

function Approve({ t }: { t: ArtCopy }) {
  return (
    <>
      <rect x="58" y="22" width="150" height="146" rx="16" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <rect x="80" y="46" width="106" height="14" rx="7" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
      <rect x="80" y="70" width="80" height="12" rx="6" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
      <rect x="80" y="92" width="96" height="12" rx="6" fill="var(--surface-soft)" stroke={INK} strokeWidth="2" />
      <g className="tut-stamp">
        <circle cx="196" cy="128" r="26" fill="var(--mint)" stroke={INK} strokeWidth="2.5" />
        <path d="M184 128l8 9 17-19" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <polygon className="tut-pulse" points="224,60 242,72 224,84" fill={INK} />
      <g className="tut-rise" style={{ animationDelay: '0.35s' }}>
        <rect x="248" y="56" width="74" height="34" rx="10" fill="var(--gold)" stroke={INK} strokeWidth="2.5" />
        <text x="285" y="78" textAnchor="middle" fontSize="10" fontWeight="800" fill={INK}>
          {t.approved}
        </text>
      </g>
    </>
  );
}

function Moderate() {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <g
          key={index}
          className="tut-rise"
          style={{ animationDelay: `${index * 0.12}s` }}
        >
          <rect
            x={22 + (index % 2) * 160}
            y={26 + Math.floor(index / 2) * 74}
            width="138"
            height="60"
            rx="14"
            fill={index === 1 ? 'var(--lavender)' : 'var(--mint-soft)'}
            stroke={INK}
            strokeWidth="2.5"
          />
          <rect x={38 + (index % 2) * 160} y={40 + Math.floor(index / 2) * 74} width="52" height="14" rx="7" fill="#fff" stroke={INK} strokeWidth="2" />
          <rect x={38 + (index % 2) * 160} y={62 + Math.floor(index / 2) * 74} width="92" height="10" rx="5" fill="#fff" opacity="0.8" stroke={INK} strokeWidth="2" />
        </g>
      ))}
      <g className="tut-pulse">
        <circle cx="160" cy="86" r="14" fill="var(--coral)" stroke={INK} strokeWidth="2.5" />
        <path d="M153 86h14M160 79v14" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </>
  );
}

function Support() {
  return (
    <>
      <g className="tut-rise">
        <rect x="24" y="34" width="126" height="62" rx="16" fill="var(--sky-soft)" stroke={INK} strokeWidth="2.5" />
        <path d="M48 96v18l22-18" fill="var(--sky-soft)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="44" y="52" width="86" height="10" rx="5" fill="#fff" stroke={INK} strokeWidth="2" />
        <rect x="44" y="70" width="58" height="10" rx="5" fill="#fff" stroke={INK} strokeWidth="2" />
      </g>
      <g className="tut-rise" style={{ animationDelay: '0.3s' }}>
        <rect x="176" y="84" width="140" height="70" rx="16" fill="var(--mint)" stroke={INK} strokeWidth="2.5" />
        <path d="M262 154v16l-20-16" fill="var(--mint)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="196" y="102" width="96" height="10" rx="5" fill="#fff" stroke={INK} strokeWidth="2" />
        <rect x="196" y="120" width="70" height="10" rx="5" fill="#fff" stroke={INK} strokeWidth="2" />
      </g>
      <g className="tut-pulse">
        <circle cx="248" cy="54" r="14" fill="var(--gold)" stroke={INK} strokeWidth="2.5" />
        <path d="M248 46v10M248 60v2" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      </g>
    </>
  );
}

function Report() {
  const bars = [40, 78, 56, 104, 132];
  return (
    <>
      <rect x="34" y="22" width="272" height="146" rx="16" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <line x1="58" y1="140" x2="286" y2="140" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      {bars.map((height, index) => (
        <rect
          key={index}
          className="tut-bar"
          style={{ animationDelay: `${index * 0.12}s` }}
          x={70 + index * 46}
          y={140 - height}
          width="26"
          height={height}
          rx="8"
          fill={index % 2 === 0 ? 'var(--mint)' : 'var(--lavender)'}
          stroke={INK}
          strokeWidth="2.5"
        />
      ))}
      <polygon className="tut-pulse" points="120,74 134,88 156,60" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}
