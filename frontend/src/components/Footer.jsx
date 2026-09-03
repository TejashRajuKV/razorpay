import React, { useRef } from 'react';
import { ArrowRight, ArrowUp, Bot, ShieldCheck, Activity } from 'lucide-react';

export default function Footer({ onLaunchConsole }) {
  const skyRef = useRef(null);
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="ed-footer">
      <div className="ed-top">
        <h2 className="ed-title font-serif-title">
          A recovery roadmap<br />for every rupee.
        </h2>
        <p className="ed-sub">Failed payments are a journey. Recover them with confidence.</p>
        <button className="ed-cta" onClick={onLaunchConsole}>
          <span>Open Merchant Console</span>
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="ed-scene">
        <video
          ref={skyRef}
          className="ed-video"
          src="/make_it_is_like_moving_clouds.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="ed-wash" aria-hidden="true" />
        <svg className="ed-horizon" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 110 L1440 110" stroke="#111110" strokeWidth="3" fill="none" />
          <path d="M560 220 L680 110 L760 110 L880 220 Z" fill="#FFFEFA" stroke="#111110" strokeWidth="3" strokeLinejoin="round" />
          <path d="M640 220 L700 110 M800 110 L860 220" stroke="#E4D3AC" strokeWidth="10" fill="none" />
        </svg>

        <button className="ed-seal" onClick={scrollTop} aria-label="Back to top">
          <span className="ed-seal-ring">back to top • back to top •</span>
          <ArrowUp size={20} />
        </button>

        <div className="ed-chat">
          <span className="ed-chat-label">Chat with</span>
          <h4 className="ed-chat-name font-serif-title">Recovery Agent</h4>
          <div className="ed-chat-avatar"><Bot size={28} color="#111110" /></div>
          <button className="ed-chat-btn" onClick={onLaunchConsole}>
            <span>Let's Chat</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <div className="ed-bar">
        <div className="ed-bar-inner">
          <div className="ed-brand">
            <span className="ed-logo"><Bot size={16} color="#fff" /></span>
            <span>Razorpay AI Recovery</span>
          </div>
          <nav className="ed-links">
            <button onClick={onLaunchConsole}>Console</button>
            <span>Guardrails</span>
            <span>Audit</span>
          </nav>
          <div className="ed-status"><Activity size={13} /><span>Agent Active</span><ShieldCheck size={13} /><span>100% Bounded</span></div>
        </div>
        <div className="ed-copy">© 2026 Razorpay AI Recovery • Track 03 • Autonomous, explainable, bounded</div>
      </div>

      <style>{`
        .ed-footer { background: #FFFEFA; border-top: 1px solid #EFE7D5; margin-top: 24px; overflow: hidden; }
        .ed-top { text-align: center; padding: 72px 20px 36px; max-width: 820px; margin: 0 auto; }
        .ed-title { font-size: clamp(42px, 6vw, 72px); line-height: 1.04; color: #111110; letter-spacing: -0.02em; font-weight: 500; margin: 0 0 14px; }
        .ed-sub { font-size: 16.5px; color: #1A1A1A; margin: 0 0 26px; }
        .ed-cta { display: inline-flex; align-items: center; gap: 10px; background: #7ED6C0; color: #111110; border: 1.5px solid #111110; border-radius: 999px; padding: 12px 28px; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 3px 3px 0px #111110; transition: all .15s ease; }
        .ed-cta:hover { transform: translate(-1px,-1px); box-shadow: 4px 4px 0px #111110; background: #5FC6AD; }
        .ed-scene { position: relative; width: 100vw; max-width: none; margin: 0 0 0 50%; transform: translateX(-50%); height: 460px; border-top: 1px solid #111110; border-bottom: 1px solid #111110; overflow: hidden; background: #F7EBD2; }
        .ed-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 30%; }
        .ed-wash { position: absolute; inset: 0; background: linear-gradient(180deg, #FFFEFA 0%, rgba(255,254,250,0) 28%, rgba(250,240,211,0.25) 55%, rgba(255,254,250,0.55) 100%), linear-gradient(90deg, rgba(249,232,221,0.5) 0%, rgba(249,232,221,0) 30%, rgba(249,232,221,0) 70%, rgba(249,232,221,0.5) 100%); pointer-events: none; }
        .ed-horizon { position: absolute; left: 0; right: 0; bottom: -2px; width: 100%; height: 220px; }
        .ed-seal { position: absolute; left: 28px; bottom: 28px; width: 84px; height: 84px; border-radius: 50%; background: #F6C945; border: 1.5px solid #111110; box-shadow: 3px 3px 0px #111110; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 3; }
        .ed-seal-ring { position: absolute; inset: 4px; font-size: 8px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #111110; animation: ed-spin 12s linear infinite; }
        @keyframes ed-spin { to { transform: rotate(360deg); } }
        .ed-chat { position: absolute; right: 24px; bottom: 24px; width: 210px; background: rgba(255,255,255,0.96); border: 1.5px solid #111110; border-radius: 16px; padding: 14px 14px 12px; text-align: center; z-index: 3; box-shadow: 4px 4px 0px #111110; }
        .ed-chat-label { font-size: 12px; font-weight: 600; color: #4E4E48; }
        .ed-chat-name { font-size: 30px; margin: 0 0 8px; color: #111110; }
        .ed-chat-avatar { width: 100%; height: 96px; border-radius: 10px; background: #FAF0D3; border: 1px solid #E9E1CC; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
        .ed-chat-btn { display: inline-flex; align-items: center; gap: 6px; background: #7ED6C0; border: 1.5px solid #111110; border-radius: 999px; padding: 8px 22px; font-weight: 800; font-size: 13px; cursor: pointer; color: #111110; }
        .ed-bar { background: #111110; color: #FFFEFA; }
        .ed-bar-inner { max-width: 1080px; margin: 0 auto; padding: 20px 24px 6px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .ed-brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; }
        .ed-logo { width: 28px; height: 28px; border-radius: 8px; background: #22221F; display: flex; align-items: center; justify-content: center; border: 1px solid #333; }
        .ed-links { display: flex; gap: 18px; font-size: 13px; font-weight: 600; color: #D8D2C2; }
        .ed-links button { background: none; border: none; color: inherit; font: inherit; cursor: pointer; }
        .ed-status { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #7ED6C0; }
        .ed-copy { text-align: center; font-size: 11.5px; color: #8A877F; padding: 6px 16px 18px; }
        @media (max-width: 860px) { .ed-scene { height: 380px; } .ed-chat { display: none; } .ed-seal { width: 64px; height: 64px; left: 16px; bottom: 16px; } }
      `}</style>
    </footer>
  );
}