'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  Suspense,
  useState,
  useCallback,
  useRef,
  useEffect,
  type FormEvent,
} from 'react';
import { OracleOrb } from '@/components/ui/oracle-orb';

const SITE_NAME = 'Sandra';

// ── Shared button styles ──────────────────────────────────────────────────────

const socialBtnClass =
  'group relative flex w-full items-center gap-3 rounded-full border border-outline-variant/20 bg-surface-container-low/80 px-6 py-3 text-sm font-medium text-on-surface backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-surface-container hover:shadow-[0_0_20px_rgba(174,198,255,0.12)] active:scale-[0.97]';

const primaryBtnClass =
  'w-full rounded-full bg-primary/90 px-6 py-3 text-sm font-semibold text-on-primary backdrop-blur-sm transition-all duration-300 hover:bg-primary hover:shadow-[0_0_24px_rgba(174,198,255,0.25)] active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none';

// ── Icons ─────────────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
    </svg>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-on-primary/30 border-t-on-primary" />
  );
}

// ── Login form ────────────────────────────────────────────────────────────────

type AuthMethod = 'email' | 'phone';

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/chat';

  // Shared state
  const [method, setMethod] = useState<AuthMethod>('email');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Email OTP state ──
  const [emailStep, setEmailStep] = useState<'input' | 'verify'>('input');
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailCooldown, setEmailCooldown] = useState(0);

  // ── Phone (Firebase) state ──
  const [phoneStep, setPhoneStep] = useState<'input' | 'verify'>('input');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confirmationRef = useRef<any>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recaptchaVerifierRef = useRef<any>(null);

  // Start cooldown timer
  const startCooldown = useCallback(() => {
    setEmailCooldown(60);
    const t = setInterval(() => {
      setEmailCooldown((prev) => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Initialise invisible reCAPTCHA for Firebase phone auth
  useEffect(() => {
    if (method !== 'phone' || recaptchaVerifierRef.current) return;

    let mounted = true;
    (async () => {
      try {
        const { getFirebaseAuth } = await import('@/lib/firebase/client');
        const { RecaptchaVerifier } = await import('firebase/auth');
        const auth = getFirebaseAuth();

        if (!mounted || !recaptchaRef.current) return;

        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
          size: 'invisible',
        });
      } catch {
        // Firebase not configured — will show error on submit
      }
    })();

    return () => { mounted = false; };
  }, [method]);

  // ── Switch method ──
  const switchMethod = useCallback((m: AuthMethod) => {
    if (m === method) return;
    setMethod(m);
    setError(null);
  }, [method]);

  // ── Email: send OTP ──
  const handleEmailSend = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to send code'); return; }
      setEmailStep('verify');
      startCooldown();
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }, [email, startCooldown]);

  // ── Email: verify OTP ──
  const handleEmailVerify = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn('otp', {
        identifier: email.trim(),
        code: emailOtp.trim(),
        callbackUrl,
        redirect: true,
      });
      setError('Invalid or expired code. Please try again.');
    } catch { setError('Verification failed.'); }
    finally { setBusy(false); }
  }, [email, emailOtp, callbackUrl]);

  // ── Phone: send SMS via Firebase ──
  const handlePhoneSend = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { getFirebaseAuth } = await import('@/lib/firebase/client');
      const { signInWithPhoneNumber } = await import('firebase/auth');
      const auth = getFirebaseAuth();

      if (!recaptchaVerifierRef.current) {
        setError('Phone auth is not configured. Please contact support.');
        setBusy(false);
        return;
      }

      const confirmation = await signInWithPhoneNumber(
        auth,
        phone.trim(),
        recaptchaVerifierRef.current,
      );
      confirmationRef.current = confirmation;
      setPhoneStep('verify');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send SMS';
      if (msg.includes('invalid-phone-number')) {
        setError('Invalid phone number. Use format: +1234567890');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(msg);
      }
    } finally { setBusy(false); }
  }, [phone]);

  // ── Phone: verify code + get Firebase ID token → NextAuth ──
  const handlePhoneVerify = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!confirmationRef.current) {
        setError('Session expired. Please resend the code.');
        setBusy(false);
        return;
      }

      const result = await confirmationRef.current.confirm(phoneCode.trim());
      const idToken = await result.user.getIdToken();

      // Send Firebase ID token to NextAuth credentials provider
      await signIn('firebase-phone', {
        idToken,
        callbackUrl,
        redirect: true,
      });

      setError('Verification failed. Please try again.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid code';
      if (msg.includes('invalid-verification-code')) {
        setError('Invalid code. Please check and try again.');
      } else {
        setError(msg);
      }
    } finally { setBusy(false); }
  }, [phoneCode, callbackUrl]);

  // ── Render ──

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-12">
      {/* ── Nebula background ──────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-nebula-drift absolute -left-24 top-1/4 h-[400px] w-[400px] rounded-full bg-primary/[0.07] blur-[130px]" />
        <div
          className="animate-nebula-drift absolute -right-16 top-10 h-[300px] w-[300px] rounded-full bg-[rgba(100,60,255,0.05)] blur-[120px]"
          style={{ animationDelay: '-5s' }}
        />
        <div
          className="animate-nebula-drift absolute bottom-10 left-1/3 h-[250px] w-[450px] rounded-full bg-primary/[0.04] blur-[150px]"
          style={{ animationDelay: '-9s' }}
        />
      </div>

      {/* ── Glass card ─────────────────────────────────── */}
      <div className="glass relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl px-8 py-10 sm:px-10">
        {/* Oracle orb */}
        <div className="animate-orb-float relative mb-6">
          <div className="absolute inset-0 -m-3 animate-oracle-breathe rounded-full border border-primary/10" />
          <div
            className="absolute inset-0 -m-6 animate-oracle-breathe rounded-full border border-primary/5"
            style={{ animationDelay: '-2s' }}
          />
          <OracleOrb size={64} active={busy} />
        </div>

        <h1 className="mb-0.5 text-xl font-black tracking-tighter text-on-surface">
          Sign in to{' '}
          <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
            {SITE_NAME}
          </span>
        </h1>
        <p className="mb-6 text-xs text-on-surface-variant/60">
          Choose how you&apos;d like to continue
        </p>

        {/* ── Method tabs ─────────────────────────────── */}
        <div className="mb-5 flex w-full rounded-full border border-outline-variant/15 bg-surface-container-lowest/50 p-0.5">
          {(['email', 'phone'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMethod(m)}
              className={`flex-1 rounded-full py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                method === m
                  ? 'bg-primary/15 text-primary shadow-sm'
                  : 'text-on-surface-variant/50 hover:text-on-surface-variant'
              }`}
            >
              {m === 'email' ? '✉ Email' : '📱 Phone'}
            </button>
          ))}
        </div>

        {/* ── Email OTP flow ──────────────────────────── */}
        {method === 'email' && emailStep === 'input' && (
          <form onSubmit={handleEmailSend} className="flex w-full flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-outline-variant/15 bg-surface-container-lowest/60 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/30 outline-none backdrop-blur-sm transition-colors focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              autoComplete="email"
              autoFocus
            />
            <button type="submit" disabled={busy || !email.trim()} className={primaryBtnClass}>
              {busy ? <span className="flex items-center justify-center gap-2"><Spinner /> Sending…</span> : 'Send Code'}
            </button>
          </form>
        )}

        {method === 'email' && emailStep === 'verify' && (
          <form onSubmit={handleEmailVerify} className="flex w-full flex-col gap-3">
            <p className="text-center text-xs text-on-surface-variant/60">
              Code sent to <span className="font-medium text-on-surface-variant">{email}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-xl border border-outline-variant/15 bg-surface-container-lowest/60 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-on-surface placeholder:text-on-surface-variant/20 outline-none backdrop-blur-sm transition-colors focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              autoComplete="one-time-code"
              autoFocus
            />
            <button type="submit" disabled={busy || emailOtp.length < 6} className={primaryBtnClass}>
              {busy ? <span className="flex items-center justify-center gap-2"><Spinner /> Verifying…</span> : 'Verify & Sign In'}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setEmailStep('input'); setEmailOtp(''); setError(null); }} className="text-on-surface-variant/50 transition-colors hover:text-primary">
                ← Change email
              </button>
              <button type="button" onClick={(e) => handleEmailSend(e)} disabled={emailCooldown > 0} className="text-on-surface-variant/50 transition-colors hover:text-primary disabled:opacity-30">
                {emailCooldown > 0 ? `Resend in ${emailCooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {/* ── Phone (Firebase) flow ───────────────────── */}
        {method === 'phone' && phoneStep === 'input' && (
          <form onSubmit={handlePhoneSend} className="flex w-full flex-col gap-3">
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className="w-full rounded-xl border border-outline-variant/15 bg-surface-container-lowest/60 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/30 outline-none backdrop-blur-sm transition-colors focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              autoComplete="tel"
              autoFocus
            />
            <button type="submit" disabled={busy || !phone.trim()} className={primaryBtnClass}>
              {busy ? <span className="flex items-center justify-center gap-2"><Spinner /> Sending…</span> : 'Send Code'}
            </button>
          </form>
        )}

        {method === 'phone' && phoneStep === 'verify' && (
          <form onSubmit={handlePhoneVerify} className="flex w-full flex-col gap-3">
            <p className="text-center text-xs text-on-surface-variant/60">
              Code sent to <span className="font-medium text-on-surface-variant">{phone}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-xl border border-outline-variant/15 bg-surface-container-lowest/60 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-on-surface placeholder:text-on-surface-variant/20 outline-none backdrop-blur-sm transition-colors focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              autoComplete="one-time-code"
              autoFocus
            />
            <button type="submit" disabled={busy || phoneCode.length < 6} className={primaryBtnClass}>
              {busy ? <span className="flex items-center justify-center gap-2"><Spinner /> Verifying…</span> : 'Verify & Sign In'}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setPhoneStep('input'); setPhoneCode(''); setError(null); confirmationRef.current = null; }} className="text-on-surface-variant/50 transition-colors hover:text-primary">
                ← Change number
              </button>
            </div>
          </form>
        )}

        {/* Invisible reCAPTCHA container for Firebase */}
        <div ref={recaptchaRef} id="recaptcha-container" />

        {/* Error display */}
        {error && (
          <p className="mt-3 text-center text-xs font-medium text-red-400/90">{error}</p>
        )}

        {/* ── Divider ─────────────────────────────────── */}
        <div className="my-6 flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-outline-variant/10" />
          <span className="text-[0.65rem] uppercase tracking-widest text-on-surface-variant/30">
            or continue with
          </span>
          <div className="h-px flex-1 bg-outline-variant/10" />
        </div>

        {/* ── Social buttons ──────────────────────────── */}
        <div className="flex w-full flex-col gap-2.5">
          <button onClick={() => signIn('google', { callbackUrl })} className={socialBtnClass}>
            <GoogleIcon />
            Google
          </button>
          <button onClick={() => signIn('facebook', { callbackUrl })} className={socialBtnClass}>
            <FacebookIcon />
            Facebook
          </button>
        </div>

        <p className="mt-8 max-w-xs text-center text-[0.65rem] leading-relaxed text-outline/40">
          By signing in you agree to the{' '}
          <a href="/privacy" className="underline underline-offset-2 transition-colors hover:text-primary">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
