/** One colour token: a chip filled with the live value of the custom property, plus its name. */
export function ColorSwatch({ token }: { token: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="size-8 shrink-0 rounded-sm border border-border-strong"
        style={{ backgroundColor: `var(${token})` }}
      />
      <code className="text-small text-text-muted">{token}</code>
    </li>
  );
}
