import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, MessageCircle, Video, Zap, Users, Shield,
  ChevronRight, ArrowRight, Star, Wifi, Globe,
} from 'lucide-react';
import { Logo } from '@/components/Common/Logo';

/* ── Intersection-observer hook for scroll reveal ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/* ── Phone mockup — shows a stylised Nearby view ── */
const PhoneMockup: React.FC = () => (
  <div className="relative flex justify-center items-center">
    {/* Glow behind the phone */}
    <div
      className="absolute inset-0 rounded-full opacity-30 blur-3xl"
      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#38bdf8)', transform: 'scale(0.75)' }}
    />

    {/* Phone frame */}
    <div
      className="relative w-[220px] sm:w-[260px] rounded-[2.8rem] p-[3px] shadow-card-lift"
      style={{ background: 'linear-gradient(145deg,#4f46e5,#8b5cf6,#38bdf8)' }}
    >
      {/* Screen */}
      <div className="rounded-[2.5rem] overflow-hidden bg-gradient-to-b from-[#f0f4ff] to-[#ede9fe] h-[440px] sm:h-[520px] relative">

        {/* Status bar */}
        <div className="flex justify-between items-center px-5 pt-3 pb-1 text-[10px] text-slate-500 font-medium">
          <span>9:41</span>
          <div className="flex gap-1 items-center">
            <Wifi size={10} />
            <div className="w-4 h-2 rounded-sm bg-slate-400" />
          </div>
        </div>

        {/* Dynamic island pill */}
        <div className="mx-auto w-20 h-5 bg-slate-900 rounded-full mb-2" />

        {/* App header */}
        <div className="mx-3 mb-3 glass rounded-xl p-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-primary flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-700">Nearby People</span>
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">● Live</span>
        </div>

        {/* Map area */}
        <div
          className="mx-3 rounded-2xl overflow-hidden relative mb-3"
          style={{ height: 160, background: 'linear-gradient(135deg,#dbeafe 0%,#ede9fe 50%,#cffafe 100%)' }}
        >
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#6366f1" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Avatar pins on map */}
          {[
            { top: '20%', left: '20%', color: '#6366f1', delay: '0s'   },
            { top: '50%', left: '55%', color: '#8b5cf6', delay: '0.4s' },
            { top: '30%', left: '70%', color: '#38bdf8', delay: '0.8s' },
            { top: '65%', left: '30%', color: '#a855f7', delay: '1.2s' },
          ].map((pin, i) => (
            <div
              key={i}
              className="absolute"
              style={{ top: pin.top, left: pin.left, animationDelay: pin.delay }}
            >
              {/* Pulse ring */}
              <div
                className="absolute -inset-1.5 rounded-full animate-ping opacity-30"
                style={{ background: pin.color, animationDuration: '2.5s', animationDelay: pin.delay }}
              />
              {/* Avatar circle */}
              <div
                className="w-8 h-8 rounded-full border-2 border-white shadow-avatar flex items-center justify-center text-white text-[10px] font-bold relative"
                style={{ background: `linear-gradient(135deg,${pin.color},${pin.color}bb)` }}
              >
                {['A','B','C','D'][i]}
              </div>
              {/* Distance badge */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-semibold px-1 py-0.5 rounded-full bg-white/90 text-slate-600 shadow-sm border border-white/60">
                {['50m','120m','200m','80m'][i]}
              </div>
            </div>
          ))}

          {/* You pin */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-9 h-9 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#38bdf8)' }}>
              You
            </div>
          </div>
        </div>

        {/* Nearby user cards */}
        <div className="mx-3 space-y-2">
          {[
            { name: 'Priya S.',   dist: '50m away',  status: 'online',  emoji: '🎵' },
            { name: 'Rohan M.',   dist: '120m away', status: 'online',  emoji: '📚' },
          ].map((u, i) => (
            <div key={i} className="glass rounded-xl px-3 py-2 flex items-center gap-2.5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                >
                  {u.name[0]}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-800 truncate">{u.name}</p>
                <p className="text-[9px] text-slate-400">{u.emoji} {u.dist}</p>
              </div>
              <button className="text-[9px] px-2 py-1 rounded-lg text-white font-semibold flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Floating notification card */}
    <div className="absolute -right-4 sm:-right-8 top-16 glass rounded-2xl px-3 py-2.5 shadow-glass-strong animate-float" style={{ animationDelay: '0.5s' }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-primary flex-shrink-0" />
        <div>
          <p className="text-[10px] font-semibold text-slate-800">Priya sent a request!</p>
          <p className="text-[9px] text-slate-400">50m away · just now</p>
        </div>
      </div>
    </div>

    {/* Floating challenge card */}
    <div className="absolute -left-4 sm:-left-8 bottom-20 glass rounded-2xl px-3 py-2.5 shadow-glass-strong animate-float" style={{ animationDelay: '1.2s' }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <Zap size={12} className="text-white" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-800">Daily challenge!</p>
          <p className="text-[9px] text-amber-500 font-medium">🔥 5-day streak</p>
        </div>
      </div>
    </div>
  </div>
);

/* ── Section: Sticky top nav ── */
const Nav: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-nav shadow-glass-nav' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Logo variant="full" size="md" />

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link to="/login" className="btn-ghost text-sm px-3 py-2" style={{ minHeight: 40 }}>
            Log in
          </Link>
          <Link to="/register" className="btn-primary text-sm px-4 py-2" style={{ minHeight: 40 }}>
            Sign up
            <ArrowRight size={15} />
          </Link>
        </nav>
      </div>
    </header>
  );
};

/* ── Features data ── */
const FEATURES = [
  {
    icon: <MapPin size={22} />,
    color: 'from-indigo-500 to-blue-500',
    title: 'Nearby Discovery',
    desc: 'Find people around you in real time with GPS or privacy-first Bluetooth proximity.',
  },
  {
    icon: <MessageCircle size={22} />,
    color: 'from-violet-500 to-purple-600',
    title: 'Encrypted Chat',
    desc: 'End-to-end encrypted messaging with image/file attachments and read receipts.',
  },
  {
    icon: <Video size={22} />,
    color: 'from-sky-400 to-cyan-500',
    title: 'Video Calls & Rooms',
    desc: 'One-on-one WebRTC video calls and spontaneous video rooms with nearby users.',
  },
  {
    icon: <Zap size={22} />,
    color: 'from-amber-400 to-orange-500',
    title: 'Daily Challenges',
    desc: 'Compete in daily math challenges, challenge friends to duels, and climb leaderboards.',
  },
  {
    icon: <Users size={22} />,
    color: 'from-emerald-400 to-teal-500',
    title: 'Communities',
    desc: 'Create and join local interest communities with shared feeds and events.',
  },
  {
    icon: <Shield size={22} />,
    color: 'from-pink-500 to-rose-500',
    title: 'Privacy First',
    desc: 'Bluetooth proximity sharing without GPS — your exact location stays with you.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Create your profile',
    desc: 'Set up your profile, add your interests, and let others discover the real you.',
    icon: <Star size={20} />,
  },
  {
    num: '02',
    title: 'Discover nearby',
    desc: 'Find people around you in real time using GPS or private Bluetooth proximity.',
    icon: <MapPin size={20} />,
  },
  {
    num: '03',
    title: 'Connect & play',
    desc: 'Chat, video call, join communities, and challenge friends to daily games.',
    icon: <Zap size={20} />,
  },
];

const STATS = [
  { value: '50K+',  label: 'Connections made' },
  { value: '120+',  label: 'Cities active'     },
  { value: '2M+',   label: 'Messages sent'     },
];

/* ── Main LandingPage ── */
export const LandingPage: React.FC = () => {
  const heroReveal    = useReveal();
  const stepsReveal   = useReveal();
  const featReveal    = useReveal();
  const ctaReveal     = useReveal();

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'linear-gradient(135deg,#f0f4ff 0%,#faf5ff 50%,#f0f9ff 100%)', backgroundAttachment: 'fixed' }}>

      {/* Background blobs */}
      <div className="fx-bg-blob-1" />
      <div className="fx-bg-blob-2" />
      <div className="fx-bg-blob-3" />

      <Nav />

      {/* ══════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════ */}
      <section className="relative z-10 pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Text block */}
            <div
              ref={heroReveal.ref}
              className={`transition-all duration-700 ${heroReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              {/* Beta badge */}
              <div className="inline-flex items-center gap-1.5 glass rounded-full px-3 py-1.5 mb-6 text-xs font-semibold text-indigo-600 border border-indigo-200/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Now in Beta — Join for free
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-slate-800 mb-5">
                Find your{' '}
                <span className="gradient-text">people</span>
                ,{' '}<br className="hidden sm:block" />
                nearby.
              </h1>

              <p className="text-base sm:text-lg text-slate-500 leading-relaxed mb-8 max-w-md">
                Connect with friends, discover people around you in real time,
                and build communities — all in one beautiful, privacy-first app.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <Link to="/register" className="btn-primary text-sm px-6 py-3" style={{ minHeight: 48 }}>
                  Get Started — it's free
                  <ArrowRight size={16} />
                </Link>
                <Link to="/login" className="btn-secondary text-sm px-6 py-3" style={{ minHeight: 48 }}>
                  Log in
                </Link>
              </div>

              {/* Mini social proof */}
              <div className="flex items-center gap-3">
                {/* Avatar stack */}
                <div className="flex -space-x-2">
                  {['#6366f1','#8b5cf6','#38bdf8','#a855f7'].map((c, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ background: c, zIndex: 4 - i }}
                    >
                      {['P','R','A','S'][i]}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">2,400+</span> people joined this week
                </div>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="flex justify-center lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="glass rounded-2xl p-1">
            <div className="grid grid-cols-3 divide-x divide-white/40">
              {STATS.map((s, i) => (
                <div key={i} className="py-4 px-2 text-center">
                  <p className="text-xl sm:text-2xl font-bold gradient-text">{s.value}</p>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-16 sm:py-24">
        <div
          ref={stepsReveal.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${stepsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Heading */}
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-indigo-500 mb-2">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800">Up and running in minutes</h2>
          </div>

          {/* Steps */}
          <div className="grid sm:grid-cols-3 gap-5 sm:gap-6">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="relative glass-hover rounded-2xl p-6"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                {/* Step number */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl font-black gradient-text opacity-25 leading-none">{step.num}</span>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                  >
                    {step.icon}
                  </div>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>

                {/* Connector arrow (hidden on last) */}
                {i < 2 && (
                  <div className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                    <ChevronRight size={20} className="text-indigo-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FEATURES GRID
      ══════════════════════════════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-16 sm:py-24">
        <div
          ref={featReveal.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${featReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Heading */}
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-indigo-500 mb-2">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800">Built for real connections</h2>
            <p className="mt-3 text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              Every feature designed to help you meet people nearby and build meaningful friendships.
            </p>
          </div>

          {/* 2–3 column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="glass-hover rounded-2xl p-5 group"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Icon */}
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4 shadow-sm transition-transform duration-300 group-hover:scale-110`}
                >
                  {f.icon}
                </div>
                <h3 className="font-semibold text-slate-800 mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SOCIAL PROOF BAND
      ══════════════════════════════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-12">
        <div className="max-w-4xl mx-auto glass rounded-3xl p-8 sm:p-10 text-center">
          {/* Star row */}
          <div className="flex justify-center gap-1 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={18} className="fill-amber-400 text-amber-400" />
            ))}
          </div>
          <blockquote className="text-lg sm:text-xl font-medium text-slate-700 max-w-xl mx-auto leading-relaxed mb-4">
            "FriendZX changed how I meet people around me. Found my study group in less than 10 minutes!"
          </blockquote>
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-primary" />
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-800">Ananya K.</p>
              <p className="text-xs text-slate-400">Student, Bengaluru</p>
            </div>
          </div>

          {/* Globe stat */}
          <div className="mt-6 pt-6 border-t border-white/40 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Globe size={14} className="text-indigo-400" /> Available worldwide</span>
            <span className="flex items-center gap-1.5"><Shield size={14} className="text-emerald-500" /> Privacy first</span>
            <span className="flex items-center gap-1.5"><Zap size={14} className="text-amber-500" /> Real-time</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FINAL CTA SECTION
      ══════════════════════════════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-20 sm:py-28">
        <div
          ref={ctaReveal.ref}
          className={`max-w-3xl mx-auto text-center transition-all duration-700 ${ctaReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Gradient card */}
          <div
            className="relative rounded-3xl p-10 sm:p-14 overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#38bdf8 100%)' }}
          >
            {/* Decorative blur spots inside the card */}
            <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />

            <div className="relative z-10">
              <p className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-3">Ready to start?</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
                Your people are<br />waiting nearby.
              </h2>
              <p className="text-white/75 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
                Join thousands of people already discovering friendships, communities, and adventures right around the corner.
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-indigo-700 font-semibold text-sm shadow-glass-strong transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-lift active:scale-95"
                  style={{ minHeight: 48 }}
                >
                  Create free account
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white/15 text-white font-semibold text-sm border border-white/30 backdrop-blur-sm transition-all duration-200 hover:bg-white/25 hover:-translate-y-0.5 active:scale-95"
                  style={{ minHeight: 48 }}
                >
                  Already have an account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════ */}
      <footer className="relative z-10 px-4 sm:px-6 pb-8 pt-4">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-2xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Logo variant="full" size="sm" />

            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-slate-400">
              <Link to="/login"    className="hover:text-indigo-600 transition-colors">Log in</Link>
              <Link to="/register" className="hover:text-indigo-600 transition-colors">Sign up</Link>
              <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
              <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
            </nav>

            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} FriendZX. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
