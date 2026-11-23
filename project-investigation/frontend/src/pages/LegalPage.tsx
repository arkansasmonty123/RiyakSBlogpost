import '../features/support/support.css';

type LegalKind = 'privacy' | 'terms';

interface LegalPageProps {
  kind: LegalKind;
  feedbackUrl?: string;
}

const CONTENT: Record<LegalKind, {
  title: string;
  updated: string;
  intro: string;
  sections: Array<{ heading: string; paragraphs: string[]; bullets?: string[] }>;
}> = {
  privacy: {
    title: 'Privacy notice',
    updated: '24 November 2026',
    intro:
      'This beta is a small, self-hosted investigation game. We collect the minimum needed to let you play and keep the service reliable. This notice explains what is stored and the controls available to you.',
    sections: [
      {
        heading: 'What we store',
        paragraphs: [
          'Your account includes an email address and a salted password hash. We also store your active session and the investigations, notes, messages, verdicts, and progress you create while playing.',
          'Server logs record request metadata such as timestamp, IP address, user agent, and status code for reliability and abuse investigation. Rate-limit counters are stored as hashed keys, not raw addresses.',
        ],
      },
      {
        heading: 'How the service is used',
        paragraphs: [
          'The default deployment uses a deterministic local responder for specialist conversation. If an operator enables an external AI provider, conversation text may be sent to that provider to generate replies; this should be documented in the deployment configuration.',
          'We do not sell your data, run advertising, or embed third-party analytics or trackers.',
        ],
      },
      {
        heading: 'Your controls',
        paragraphs: [
          'You can download a JSON copy of your own data at any time, and you can permanently delete your account and personal data from the Progress page. Deletion requires explicit confirmation and does not remove shared case content used by other players.',
        ],
        bullets: [
          'Export: Progress → Download my data',
          'Delete: Progress → Delete my account',
        ],
      },
      {
        heading: 'Retention and contact',
        paragraphs: [
          'Expired sessions and rate-limit counters are removed automatically. Account data is retained while your account is active, or until you delete it.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of use',
    updated: '24 November 2026',
    intro:
      'These terms cover a limited beta. By creating an account you agree to use the service responsibly and to treat it as an unfinished product.',
    sections: [
      {
        heading: 'Nature of the beta',
        paragraphs: [
          'The service is provided for evaluation and feedback, “as is”, without warranty of uninterrupted or error-free operation. Features may change or be withdrawn. Do not rely on it for anything important.',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          'Use the service lawfully. Do not attempt to bypass access controls, overload the service, scrape other players’ data, or submit unlawful content. Operators may limit or revoke beta access.',
        ],
      },
      {
        heading: 'Your content and shared case material',
        paragraphs: [
          'You keep ownership of the notes, theories, and other text you write. Shared case material (cases, evidence, authored specialist and knowledge content) is provided by the service for everyone to use and is not yours to redistribute as your own work.',
          'Perspectives and specialist dialogue are educational context and player-facing interpretation. They are not evidence and do not determine a verdict.',
        ],
      },
      {
        heading: 'Changes and feedback',
        paragraphs: [
          'We may update these terms as the beta evolves; the date above shows the latest revision. Feedback is welcome and helps decide what to build next.',
        ],
      },
    ],
  },
};

export function LegalPage({ kind, feedbackUrl }: LegalPageProps) {
  const page = CONTENT[kind];
  return (
    <article className="legal-page support-page page-enter">
      <h1>{page.title}</h1>
      <p className="legal-page__updated">Last updated: {page.updated}</p>
      <p className="legal-page__intro">{page.intro}</p>

      {page.sections.map((section) => (
        <section className="legal-page__section" key={section.heading} aria-labelledby={`legal-${kind}-${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
          <h2 id={`legal-${kind}-${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.bullets && (
            <ul>
              {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          )}
        </section>
      ))}

      <p className="legal-page__footer">
        Questions or feedback?{' '}
        {feedbackUrl ? (
          <a href={feedbackUrl} target="_blank" rel="noreferrer noopener">Contact the operators</a>
        ) : (
          <span>Use the feedback link in the footer.</span>
        )}
      </p>
    </article>
  );
}

export default LegalPage;
