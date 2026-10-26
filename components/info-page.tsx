import Link from 'next/link';

type InfoPageProps = {
  eyebrow: string;
  title: string;
  sections: { heading: string; text: string }[];
};

export function InfoPage({ eyebrow, title, sections }: InfoPageProps) {
  return (
    <main className="info-page">
      <Link className="wordmark info-wordmark" href="/">
        MORROW <span>STUDIO</span>
      </Link>
      <article className="info-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {sections.map((section) => (
          <section className="info-section" key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.text}</p>
          </section>
        ))}
        <Link className="text-link info-back" href="/">
          <span aria-hidden="true">←</span> BACK TO MORROW STUDIO
        </Link>
      </article>
    </main>
  );
}
