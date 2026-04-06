import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Sandra | EdLight',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <main className="mx-auto max-w-3xl px-6 py-16 text-on-surface">
        <h1 className="mb-8 text-3xl font-black tracking-tighter">Privacy Policy</h1>
        <p className="mb-8 text-sm text-outline">Last updated: March 31, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-on-surface-variant">
          <section>
            <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
              1. Introduction
            </h2>
            <p>
              Sandra (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is an AI
              assistant built by the EdLight Initiative. This Privacy Policy explains how we
              collect, use, and protect information when you interact with Sandra through our
              website, APIs, or integrated messaging channels.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
              2. Information We Collect
            </h2>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong className="text-on-surface">Google Account Info:</strong> When you sign in
                with Google, we receive your name, email address, and profile picture.
              </li>
              <li>
                <strong className="text-on-surface">Chat Messages:</strong> Messages you send to
                Sandra are processed to generate responses and may be stored for conversation
                continuity.
              </li>
              <li>
                <strong className="text-on-surface">Usage Data:</strong> We collect basic analytics
                such as message counts, response times, and feature usage to improve the service.
              </li>
              <li>
                <strong className="text-on-surface">Channel Data:</strong> If you interact via
                WhatsApp, Instagram, or voice, we process the data necessary to deliver those
                services.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
              3. How We Use Information
            </h2>
            <ul className="ml-4 list-disc space-y-2">
              <li>To provide, maintain, and improve Sandra&apos;s AI assistant capabilities</li>
              <li>To personalize your experience based on conversation history and preferences</li>
              <li>To connect with third-party services (Google Calendar, Drive, Zoom) when you authorize them</li>
              <li>To monitor system health and prevent abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
              4. Data Sharing
            </h2>
            <p>
              We do not sell your personal information. We may share data with third-party AI
              providers (such as Google Gemini) to process your requests. These providers are bound
              by their own privacy policies and data processing agreements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
              5. Data Retention
            </h2>
            <p>
              Conversation data is retained for the duration of your account. You may request
              deletion of your data by contacting us at{' '}
              <a href="mailto:privacy@edlight.org" className="text-primary underline underline-offset-2 hover:text-primary-fixed">
                privacy@edlight.org
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
              6. Security
            </h2>
            <p>
              We implement industry-standard security measures including encryption in transit
              (TLS), secure authentication (OAuth 2.0), and access controls. However, no system is
              100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[0.6875rem] font-bold uppercase tracking-widest text-outline">
              7. Contact
            </h2>
            <p>
              For questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@edlight.org" className="text-primary underline underline-offset-2 hover:text-primary-fixed">
                privacy@edlight.org
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
