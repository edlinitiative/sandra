'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// TODO: read from API or env when tenant-aware login is implemented
const SITE_NAME = 'Sandra';

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/chat';

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      {/* Sandra orb */}
      <div className="ai-orb-glow mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-primary-container">
        <span
          className="material-symbols-outlined text-2xl text-on-primary-container"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          blur_on
        </span>
      </div>

      <h1 className="mb-2 text-2xl font-black tracking-tighter text-on-surface">
        Sign in to {SITE_NAME}
      </h1>
      <p className="mb-8 text-sm text-on-surface-variant">
        Use your Google account to continue
      </p>

      <button
        onClick={() => signIn('google', { callbackUrl })}
        className="flex items-center gap-3 rounded-full border border-outline-variant/30 bg-surface-container-low px-6 py-3 text-sm font-medium text-on-surface transition-all hover:bg-surface-container active:scale-95"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      <p className="mt-8 max-w-xs text-center text-xs leading-relaxed text-outline">
        By signing in you agree to the{' '}
        <a href="/privacy" className="underline underline-offset-2 hover:text-primary">
          Privacy Policy
        </a>
        .
      </p>
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
