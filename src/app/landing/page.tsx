'use client';

import { useEffect, useRef, useState } from 'react';

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useVisible(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVis(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, vis] as const;
}

// ── Brand colours ─────────────────────────────────────────────────────────────
const G = {
  sage: '#dde8b4',
  sageDark: '#c6d898',
  dark: '#1b4520',
  mid: '#3d7a14',
  light: '#8ccc46',
  cream: '#f4f2e8',
  text: '#1a2808',
  muted: '#5a7040',
};

// ── CSS keyframes injected once ───────────────────────────────────────────────
const STYLES = `
  @keyframes can-float {
    0%,100% { transform: translateY(0px) rotate(-1.5deg); }
    50%      { transform: translateY(-20px) rotate(1.5deg); }
  }
  @keyframes gentle-float {
    0%,100% { transform: translateY(0px); }
    50%      { transform: translateY(-10px); }
  }
  @keyframes marquee-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes fade-down {
    from { opacity:0; transform:translateY(-24px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes fade-up {
    from { opacity:0; transform:translateY(24px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes slide-left {
    from { opacity:0; transform:translateX(-44px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes slide-right {
    from { opacity:0; transform:translateX(44px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes pop-in {
    from { opacity:0; transform:scale(0.6); }
    to   { opacity:1; transform:scale(1); }
  }
  .can-hover:hover { transform: rotate(0deg) scale(1.04) !important; transition: transform 0.35s ease !important; }
`;

// ── Product Can (CSS artwork) ─────────────────────────────────────────────────
function Can({ h = 200, tilt = 0, className = '' }: { h?: number; tilt?: number; className?: string }) {
  const w = Math.round(h * 0.54);
  const r = Math.round(w * 0.12);
  return (
    <div
      className={className}
      style={{ width: w, height: h, transform: `rotate(${tilt}deg)`, flexShrink: 0, transition: 'transform 0.35s ease' }}
    >
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(148deg, #a8d85a 0%, #7ec030 38%, #58a01c 68%, #3e7c10 100%)',
        borderRadius: `${r}px ${r}px ${Math.round(r * 0.6)}px ${Math.round(r * 0.6)}px`,
        boxShadow: `0 10px 36px rgba(0,0,0,0.22), inset -5px 0 18px rgba(0,0,0,0.12)`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* lid */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '16%',
          background: 'linear-gradient(90deg, #386e12, #6fb824, #386e12)',
          borderRadius: `${r}px ${r}px 0 0`,
        }} />
        {/* shine */}
        <div style={{
          position: 'absolute', top: '12%', left: '7%',
          width: '18%', height: '62%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.26), transparent)',
          borderRadius: '50%',
        }} />
        {/* content */}
        <div style={{
          position: 'absolute', top: '20%', left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(h * 0.02),
        }}>
          <span style={{
            fontFamily: 'var(--font-nunito), sans-serif', fontWeight: 900,
            fontSize: h * 0.12, color: 'white', lineHeight: 1,
            textShadow: '0 2px 8px rgba(0,0,0,0.28)', letterSpacing: '-0.02em',
          }}>more</span>
          <div style={{
            width: h * 0.22, height: h * 0.22,
            border: `${Math.max(1, Math.round(h * 0.008))}px solid rgba(255,255,255,0.5)`,
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font-nunito), sans-serif', fontWeight: 900,
              fontSize: h * 0.1, color: 'rgba(255,255,255,0.92)', lineHeight: 1,
            }}>m</span>
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.86)', fontSize: h * 0.046, fontWeight: 700,
            letterSpacing: '0.1em', lineHeight: 1.45, textAlign: 'center', marginTop: Math.round(h * 0.01),
          }}>
            PROTEIN<br />ICED MATCHA<br />LATTE
          </div>
        </div>
        {/* weight */}
        <div style={{
          position: 'absolute', bottom: '6%', left: 0, right: 0,
          textAlign: 'center', color: 'rgba(255,255,255,0.55)',
          fontSize: h * 0.038, fontWeight: 600, letterSpacing: '0.1em',
        }}>500g</div>
      </div>
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 52px',
      background: 'rgba(221,232,180,0.82)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(28,69,32,0.08)',
    }}>
      {/* socials */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[
          { label: 'IG', icon: '◯' },
          { label: 'TK', icon: '♪' },
          { label: 'YT', icon: '▶' },
        ].map(({ label, icon }) => (
          <div key={label} style={{
            width: 30, height: 30, background: G.dark, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            transition: 'transform 0.2s, background 0.2s',
          }}>
            <span style={{ color: 'white', fontSize: 12 }}>{icon}</span>
          </div>
        ))}
      </div>

      {/* links */}
      <div style={{ display: 'flex', gap: 36 }}>
        {['Nutrition', 'Benefits', 'Reviews'].map(link => (
          <a key={link} href="#" style={{
            color: G.dark, fontWeight: 700, fontSize: 14,
            textDecoration: 'none', letterSpacing: '0.02em',
          }}>{link}</a>
        ))}
      </div>

      {/* cta */}
      <button style={{
        background: 'transparent', border: `1.5px solid ${G.dark}`,
        borderRadius: 22, padding: '7px 22px',
        color: G.dark, fontWeight: 800, fontSize: 13,
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 0.2s',
      }}>
        <span style={{ fontSize: 11 }}>↗</span> Shop all
      </button>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{
      minHeight: '92vh', padding: '56px 52px 80px',
      background: G.sage, display: 'flex', flexDirection: 'column',
      alignItems: 'center', position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative circle */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-8%',
        width: 420, height: 420,
        border: `1.5px solid rgba(28,69,32,0.1)`,
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '-5%', right: '-4%',
        width: 280, height: 280,
        border: `1px solid rgba(28,69,32,0.07)`,
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      {/* Brand name */}
      <h1 style={{
        fontSize: 'clamp(88px, 16vw, 200px)',
        fontWeight: 900, fontFamily: 'var(--font-nunito), sans-serif',
        color: G.dark, lineHeight: 0.88, letterSpacing: '-0.045em',
        textAlign: 'center', margin: 0,
        animation: 'fade-down 0.75s cubic-bezier(0.22,1,0.36,1) both',
      }}>More</h1>

      {/* Buy now */}
      <button style={{
        marginTop: 28, marginBottom: 56,
        background: G.dark, color: 'white', border: 'none',
        borderRadius: 32, padding: '13px 34px',
        fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
        boxShadow: '0 6px 24px rgba(27,69,32,0.35)',
        animation: 'fade-up 0.75s 0.18s cubic-bezier(0.22,1,0.36,1) both',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(255,255,255,0.28)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
        }}>▶</span>
        Buy now
      </button>

      {/* Three-column row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '220px 1fr 340px',
        gap: 40, width: '100%', maxWidth: 1100, alignItems: 'center',
      }}>
        {/* Left: stats */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 16,
          animation: 'slide-left 0.85s 0.28s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <p style={{
            fontSize: 13, color: G.muted, lineHeight: 1.5,
            fontStyle: 'italic', margin: '0 0 6px',
            transform: 'rotate(-3deg)', display: 'inline-block',
          }}>Real Matcha,<br />Original Taste</p>

          {[
            { val: '20g', sub: 'of Protein' },
            { val: '95%', sub: 'less Sugar' },
            { val: '85mg', sub: 'of Caffeine' },
          ].map(({ val, sub }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 76, height: 76, background: 'white', borderRadius: '50%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 18px rgba(0,0,0,0.08)', flexShrink: 0,
              }}>
                <span style={{ fontWeight: 900, fontSize: 20, color: G.dark, lineHeight: 1 }}>{val}</span>
              </div>
              <span style={{ fontSize: 12, color: G.muted, fontWeight: 700 }}>{sub}</span>
            </div>
          ))}
        </div>

        {/* Center: floating can */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          animation: 'can-float 4.5s ease-in-out infinite, fade-up 0.75s 0.35s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <Can h={300} className="can-hover" />
        </div>

        {/* Right: dark green card */}
        <div style={{
          background: G.dark, borderRadius: 28, padding: '44px 38px',
          animation: 'slide-right 0.85s 0.28s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <h2 style={{
            fontWeight: 900, fontSize: 50,
            fontFamily: 'var(--font-nunito), sans-serif',
            color: 'white', lineHeight: 1.0,
            letterSpacing: '-0.03em', margin: '0 0 18px',
          }}>MATCHA<br />MEETS<br />PROTEIN</h2>
          <p style={{
            color: 'rgba(255,255,255,0.72)', fontSize: 13,
            lineHeight: 1.65, margin: '0 0 24px',
          }}>
            Our More Protein Iced Matcha Latte blends matcha with protein and glucomannin, a natural fiber that supports weight loss.
          </p>
          <button style={{
            background: 'white', color: G.dark, border: 'none',
            borderRadius: 28, padding: '11px 28px',
            fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            Buy now <span style={{ fontSize: 11 }}>↗</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Marquee arch ──────────────────────────────────────────────────────────────
function MarqueeArch() {
  const text = "IT'S A MATCH(A)  ·  IT'S A MATCH(A)  ·  IT'S A MATCH(A)  ·  IT'S A MATCH(A)  ·  ";
  return (
    <div style={{
      background: G.dark,
      padding: '52px 0 72px',
      borderRadius: '0 0 50% 50% / 0 0 70px 70px',
      overflow: 'hidden',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{ overflow: 'hidden' }}>
        <div style={{
          display: 'flex', width: 'max-content',
          animation: 'marquee-scroll 22s linear infinite',
        }}>
          {[text, text].map((t, i) => (
            <span key={i} style={{
              color: 'white', fontSize: 28, fontWeight: 800,
              letterSpacing: '0.06em', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-nunito), sans-serif',
            }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Quote section ─────────────────────────────────────────────────────────────
function Quote() {
  const [ref, vis] = useVisible(0.2);
  return (
    <section style={{ padding: '100px 52px', background: G.cream, textAlign: 'center' }}>
      <div ref={ref} style={{
        transition: 'opacity 0.9s ease, transform 0.9s ease',
        opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(44px)',
      }}>
        <p style={{
          fontSize: 'clamp(26px, 3.8vw, 54px)', fontWeight: 700, color: G.text,
          fontFamily: 'var(--font-nunito), sans-serif', lineHeight: 1.25, margin: '0 0 6px',
        }}>You deserve the best.<br />You deserve More:</p>
        <p style={{
          fontSize: 'clamp(26px, 3.8vw, 54px)', fontWeight: 700,
          color: G.mid, fontStyle: 'italic',
          fontFamily: 'var(--font-nunito), sans-serif', lineHeight: 1.25, margin: '0 0 32px',
        }}>Iced Matcha Latte.</p>
        <p style={{ color: G.muted, fontSize: 14, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
          We want to make healthy, science-backed nutrition taste incredible.
        </p>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
function Features() {
  const [ref, vis] = useVisible(0.1);
  return (
    <section style={{
      padding: '100px 52px', background: G.cream,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background swirl SVG */}
      <svg style={{
        position: 'absolute', right: '-40px', top: '5%',
        width: 520, height: 480, opacity: 0.12, pointerEvents: 'none',
      }} viewBox="0 0 520 480" fill="none">
        <path d="M420,240 C400,130 320,70 210,100 C100,130 55,225 100,340 C145,445 310,430 395,340"
          stroke="#1b4520" strokeWidth="4" fill="none" />
        <path d="M460,180 C435,100 355,50 240,75 C130,100 75,195 115,315 C155,420 330,445 420,350"
          stroke="#1b4520" strokeWidth="2" fill="none" opacity="0.6" />
        <path d="M380,300 C360,200 270,160 180,190 C95,220 70,300 110,390"
          stroke="#1b4520" strokeWidth="1.5" fill="none" opacity="0.4" />
      </svg>

      <div ref={ref} style={{
        display: 'grid', gridTemplateColumns: '1fr 220px 1fr',
        gap: 48, maxWidth: 1100, margin: '0 auto', alignItems: 'center',
        transition: 'opacity 0.9s ease, transform 0.9s ease',
        opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(52px)',
      }}>
        {/* Left: More Caffeine */}
        <div style={{ background: G.sage, borderRadius: 28, padding: '44px' }}>
          <h3 style={{
            fontWeight: 900, fontSize: 42, color: G.text, lineHeight: 1.05,
            fontFamily: 'var(--font-nunito), sans-serif', letterSpacing: '-0.03em', margin: '0 0 20px',
          }}>MORE<br />CAFFEINE</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', color: G.muted, fontSize: 13, lineHeight: 2.1 }}>
            <li>→ 85mg caffeine per serving</li>
            <li>→ Same as a cappuccino</li>
            <li>→ Sustained natural energy</li>
            <li>→ No jitters, no crash</li>
          </ul>
          <p style={{ fontSize: 13, color: G.mid, fontStyle: 'italic', margin: 0 }}>
            More from Coffee Lovers ♡
          </p>
        </div>

        {/* Center: glass + small can */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          {/* Matcha glass */}
          <div style={{
            width: 88, height: 160,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(140,204,70,0.25))',
            borderRadius: '10px 10px 18px 18px',
            border: '1.5px solid rgba(255,255,255,0.85)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.10)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* matcha layer */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '52%',
              background: 'linear-gradient(180deg, rgba(140,204,70,0.55), rgba(62,124,16,0.8))',
            }} />
            {/* foam */}
            <div style={{
              position: 'absolute', top: 10, left: 6, right: 6, height: 28,
              background: 'rgba(255,255,255,0.72)', borderRadius: 8,
            }} />
            {/* ice */}
            {[{ l: '20%', t: '28%' }, { l: '55%', t: '35%' }, { l: '30%', t: '52%' }].map((pos, i) => (
              <div key={i} style={{
                position: 'absolute', left: pos.l, top: pos.t,
                width: 14, height: 18,
                background: 'rgba(255,255,255,0.55)',
                borderRadius: 4, transform: 'rotate(20deg)',
              }} />
            ))}
            {/* brand */}
            <div style={{
              position: 'absolute', top: '42%', left: 0, right: 0, textAlign: 'center',
              fontFamily: 'var(--font-nunito), sans-serif', fontWeight: 900, fontSize: 11,
              color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.4)', zIndex: 1,
            }}>more</div>
          </div>
          <Can h={150} className="can-hover" />
        </div>

        {/* Right: Taste */}
        <div style={{ background: G.sage, borderRadius: 28, padding: '44px' }}>
          <h3 style={{
            fontWeight: 900, fontSize: 42, color: G.text, lineHeight: 1.05,
            fontFamily: 'var(--font-nunito), sans-serif', letterSpacing: '-0.03em', margin: '0 0 20px',
          }}>TASTE</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: G.muted, fontSize: 13, lineHeight: 2.1 }}>
            <li>→ Finest matcha, sourced & brewed</li>
            <li>→ 200ml makes a perfect ready-to-enjoy drink</li>
            <li>→ 5g choose protein for morning tea</li>
            <li>→ Glucomannin meets fewer calories</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── Flavours ──────────────────────────────────────────────────────────────────
function Flavours() {
  const [ref, vis] = useVisible(0.15);
  return (
    <section style={{
      padding: '100px 52px 120px', background: G.cream,
      position: 'relative', overflow: 'hidden',
    }}>
      <div ref={ref} style={{
        transition: 'opacity 0.85s ease, transform 0.85s ease',
        opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(44px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2 style={{
            fontSize: 'clamp(26px, 4.2vw, 58px)', fontWeight: 700, color: G.text,
            fontFamily: 'var(--font-nunito), sans-serif', lineHeight: 1.1, margin: '0 0 6px',
          }}>Matcha, just the way you like it.</h2>
          <h2 style={{
            fontSize: 'clamp(26px, 4.2vw, 58px)', fontWeight: 700, color: G.mid,
            fontFamily: 'var(--font-nunito), sans-serif', lineHeight: 1.1, margin: 0,
          }}>What&apos;s your flavour?</h2>
        </div>

        {/* Cans row with floating ingredients */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 28 }}>
          {/* Left floating ingredient */}
          <div style={{
            position: 'absolute', left: '8%', top: -30,
            animation: 'gentle-float 3.8s ease-in-out infinite',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 44 }}>🍪</span>
            <p style={{ fontSize: 11, color: G.muted, fontStyle: 'italic', margin: '4px 0 0', lineHeight: 1 }}>
              Vanilla<br />Crumble
            </p>
          </div>
          {/* Right floating ingredient */}
          <div style={{
            position: 'absolute', right: '8%', top: -20,
            animation: 'gentle-float 4.2s 0.6s ease-in-out infinite',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 44 }}>🍓</span>
            <p style={{ fontSize: 11, color: G.muted, fontStyle: 'italic', margin: '4px 0 0', lineHeight: 1 }}>
              Strawberry<br />Cheesecake
            </p>
          </div>
          {/* Right far ingredient */}
          <div style={{
            position: 'absolute', right: '5%', top: 80,
            animation: 'gentle-float 3.2s 1s ease-in-out infinite',
          }}>
            <span style={{ fontSize: 32 }}>🍓</span>
          </div>

          <Can h={210} tilt={-7} className="can-hover" />
          <Can h={260} tilt={0} className="can-hover" />
          <Can h={210} tilt={7} className="can-hover" />
        </div>
      </div>
    </section>
  );
}

// ── Payment CTA ───────────────────────────────────────────────────────────────
function PaymentCTA() {
  const [ref, vis] = useVisible(0.15);
  const methods = [
    { name: 'Mastercard', color: '#EB001B' },
    { name: 'PayPal', color: '#003087' },
    { name: 'Apple Pay', color: '#000' },
    { name: 'G Pay', color: '#4285F4' },
    { name: 'VISA', color: '#1A1F71' },
    { name: 'Klarna', color: '#17120E' },
  ];

  return (
    <section style={{
      padding: '110px 52px', background: G.cream,
      textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      {/* handwritten notes */}
      <p style={{
        position: 'absolute', left: 52, top: '18%',
        fontSize: 13, color: G.muted, fontStyle: 'italic', lineHeight: 1.6,
        transform: 'rotate(-7deg)', margin: 0, pointerEvents: 'none',
      }}>3–5 Days<br />Delivery</p>
      <p style={{
        position: 'absolute', right: 52, bottom: '18%',
        fontSize: 13, color: G.muted, fontStyle: 'italic', lineHeight: 1.6,
        transform: 'rotate(6deg)', margin: 0, pointerEvents: 'none',
      }}>Free Shipping over<br />£40.00</p>

      <div ref={ref} style={{
        transition: 'opacity 0.85s ease, transform 0.85s ease',
        opacity: vis ? 1 : 0, transform: vis ? 'scale(1)' : 'scale(0.96)',
      }}>
        {/* ghost headline */}
        <div style={{ position: 'relative', marginBottom: 64, display: 'inline-block' }}>
          <div style={{ position: 'relative' }}>
            {/* ghost shadow layer */}
            <div aria-hidden style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              fontFamily: 'var(--font-nunito), sans-serif', fontWeight: 900,
              fontSize: 'clamp(34px, 6vw, 84px)', lineHeight: 1.1,
              color: 'transparent',
              WebkitTextStroke: '1px rgba(27,69,32,0.1)',
              transform: 'translate(5px, 5px)',
              letterSpacing: '-0.03em',
              userSelect: 'none',
            }}>
              Don&apos;t just crave It.<br />Get It.
            </div>
            <h2 style={{
              fontFamily: 'var(--font-nunito), sans-serif', fontWeight: 900,
              fontSize: 'clamp(34px, 6vw, 84px)', lineHeight: 1.1,
              color: G.text, margin: 0, letterSpacing: '-0.03em', position: 'relative',
            }}>Don&apos;t just crave It.</h2>
            <h2 style={{
              fontFamily: 'var(--font-nunito), sans-serif', fontWeight: 900,
              fontSize: 'clamp(34px, 6vw, 84px)', lineHeight: 1.1,
              color: G.dark, margin: 0, letterSpacing: '-0.03em', position: 'relative',
            }}>Get It.</h2>
          </div>
        </div>

        {/* payment circles */}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 22 }}>
          {methods.map(({ name, color }, i) => (
            <div key={name} style={{
              width: 108, height: 108, borderRadius: '50%',
              background: 'white',
              boxShadow: '0 6px 28px rgba(0,0,0,0.09)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: `all 0.5s ${i * 0.08}s ease`,
              opacity: vis ? 1 : 0,
              transform: vis ? 'scale(1)' : 'scale(0.4)',
            }}>
              <span style={{
                fontSize: 12, fontWeight: 900, color, textAlign: 'center', lineHeight: 1.3,
              }}>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const [ref, vis] = useVisible(0.08);
  return (
    <footer>
      {/* Product split */}
      <div ref={ref} style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        minHeight: '58vh',
        transition: 'opacity 0.9s ease',
        opacity: vis ? 1 : 0,
      }}>
        {/* Left: green product block */}
        <div style={{
          background: G.dark, padding: '64px 52px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* faint watermark 'o' */}
          <div style={{
            position: 'absolute', right: '-20%', bottom: '-10%',
            fontSize: 320, fontWeight: 900, lineHeight: 1,
            fontFamily: 'var(--font-nunito), sans-serif',
            color: 'rgba(255,255,255,0.04)', userSelect: 'none', pointerEvents: 'none',
            letterSpacing: '-0.04em',
          }}>o</div>

          <h3 style={{
            fontWeight: 900, fontSize: 52,
            fontFamily: 'var(--font-nunito), sans-serif',
            color: 'white', lineHeight: 1.0, letterSpacing: '-0.03em', margin: 0,
          }}>MATCHA<br />MEETS<br />PROTEIN</h3>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
            <Can h={175} className="can-hover" />
            <Can h={130} tilt={-6} className="can-hover" />
          </div>
          <button style={{
            background: 'white', color: G.dark, border: 'none',
            borderRadius: 28, padding: '11px 30px',
            fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
            cursor: 'pointer', alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            Buy now <span style={{ fontSize: 11 }}>↗</span>
          </button>
        </div>

        {/* Right: product info */}
        <div style={{
          background: G.cream, padding: '64px 52px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18,
        }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {['SHOP ALL\nPRODUCTS', 'SAMPLES\n& SINGLES'].map(label => (
              <button key={label} style={{
                background: 'white', border: `1.5px solid rgba(27,69,32,0.15)`,
                borderRadius: 14, padding: '14px 18px',
                fontSize: 10, fontWeight: 900, color: G.dark,
                fontFamily: 'inherit', cursor: 'pointer',
                whiteSpace: 'pre-line', textAlign: 'center', lineHeight: 1.4,
                letterSpacing: '0.04em',
              }}>{label}</button>
            ))}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 22, color: G.dark, margin: '0 0 4px', fontFamily: 'var(--font-nunito), sans-serif' }}>
              MoreNutrition
            </p>
            <p style={{ fontWeight: 600, fontSize: 16, color: G.mid, margin: 0 }}>
              Iced Matcha Latte
            </p>
          </div>
          <div style={{ color: G.muted, fontSize: 13, lineHeight: 2.1 }}>
            <div style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent' }}>Shipping and Delivery</div>
            <div style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent' }}>Returns and Exchanges</div>
          </div>
          {/* socials */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {['◯', '♪', '▶'].map((icon, i) => (
              <div key={i} style={{
                width: 34, height: 34, background: G.dark, borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                transition: 'transform 0.2s',
              }}>
                <span style={{ color: 'white', fontSize: 14 }}>{icon}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Watermark */}
      <div style={{
        background: G.sage, textAlign: 'center',
        paddingTop: 12, overflow: 'hidden',
      }}>
        <div style={{
          fontSize: 'clamp(130px, 24vw, 300px)', fontWeight: 900,
          fontFamily: 'var(--font-nunito), sans-serif',
          color: G.dark, lineHeight: 0.82,
          letterSpacing: '-0.05em', userSelect: 'none',
        }}>more</div>
      </div>

      {/* Bottom bar */}
      <div style={{
        background: G.dark, padding: '16px 52px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
          © More Nutrition. All Rights Reserved.
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>
          Site Cookies
        </span>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        minHeight: '100vh', background: G.sage,
        fontFamily: 'var(--font-nunito), -apple-system, sans-serif',
        color: G.text, overflowX: 'hidden',
      }}>
        <Nav />
        <Hero />
        <MarqueeArch />
        <Quote />
        <Features />
        <Flavours />
        <PaymentCTA />
        <Footer />
      </div>
    </>
  );
}
