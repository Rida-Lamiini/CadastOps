export default function ConformiteBadge({ conforme }: { conforme: boolean }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs uppercase tracking-wide border ${
        conforme
          ? "text-conforme border-conforme bg-[color-mix(in_srgb,var(--conforme)_12%,transparent)]"
          : "text-ecart border-ecart bg-[color-mix(in_srgb,var(--ecart)_12%,transparent)]"
      }`}
    >
      {conforme ? "Conforme" : "Écart"}
    </span>
  );
}
