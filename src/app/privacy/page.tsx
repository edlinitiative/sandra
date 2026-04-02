import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Sandra | EdLight',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-gray-800">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-gray-500">Last updated: March 31, 2026</p>

      <section className="space-y-6 text-base leading-relaxed">
        <div>
          <h2 className="mb-2 text-xl font-semibold">1. Introduction</h2>
          <p>
            Sandra is an AI-powered assistant built by <strong>EdLight Initiative</strong> to help
            users access information about EdLight programs, courses, scholarships, and services.
            This Privacy Policy explains how we collect, use, and protect your information when you
            interact with Sandra through our website, WhatsApp, Instagram, or email.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">2. Information We Collect</h2>
          <ul className="ml-6 list-disc space-y-1">
            <li>
              <strong>Messages you send:</strong> The text of messages you send to Sandra so we can
              provide relevant responses.
            </li>
            <li>
              <strong>Channel identifiers:</strong> Your phone number (WhatsApp), Instagram user ID,
              or email address, used to maintain your conversation and deliver replies.
            </li>
            <li>
              <strong>Session data:</strong> Conversation history within a session to provide
              context-aware responses.
            </li>
            <li>
              <strong>Usage analytics:</strong> Aggregated, anonymized data about how Sandra is used
              to improve the service.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">3. How We Use Your Information</h2>
          <ul className="ml-6 list-disc space-y-1">
            <li>To respond to your questions and provide information about EdLight services.</li>
            <li>To maintain conversation context across messages within a session.</li>
            <li>To improve Sandra&apos;s accuracy and helpfulness.</li>
            <li>To detect and prevent misuse of the service.</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">4. Third-Party Services</h2>
          <p>Sandra uses the following third-party services to operate:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>
              <strong>OpenAI:</strong> To process and generate responses. Messages are sent to
              OpenAI&apos;s API. See{' '}
              <a
                href="https://openai.com/policies/privacy-policy"
                className="text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenAI&apos;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Meta (WhatsApp &amp; Instagram):</strong> To send and receive messages via
              WhatsApp and Instagram. See{' '}
              <a
                href="https://www.facebook.com/privacy/policy"
                className="text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Meta&apos;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Vercel:</strong> To host the application. See{' '}
              <a
                href="https://vercel.com/legal/privacy-policy"
                className="text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel&apos;s Privacy Policy
              </a>
              .
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">5. Data Retention</h2>
          <p>
            Conversation data is retained for the duration of your session and may be stored for up
            to 90 days to improve service quality. You may request deletion of your data at any time
            by contacting us.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">6. Data Security</h2>
          <p>
            We implement industry-standard security measures including encryption in transit (TLS),
            secure database storage, and access controls to protect your information.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Request access to your personal data.</li>
            <li>Request deletion of your data.</li>
            <li>Opt out of data collection by discontinuing use of the service.</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">8. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or your data, contact us at:{' '}
            <a href="mailto:info@edlight.org" className="text-blue-600 underline">
              info@edlight.org
            </a>
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page
            with an updated revision date.
          </p>
        </div>
      </section>

      <footer className="mt-12 border-t pt-6 text-sm text-gray-500">
        © {new Date().getFullYear()} EdLight Initiative. All rights reserved.
      </footer>
    </main>
  );
}
