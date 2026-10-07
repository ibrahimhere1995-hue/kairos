/** Temporary screen body until the real feature lands; keeps every route useful, never blank. */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="font-display text-h1">{title}</h1>
      <p className="text-text-muted">{description}</p>
    </section>
  );
}
