type Choice = {
  key: string;
  label: string;
};

const IMPACT_CHOICES: Choice[] = [
  { key: 'self', label: 'Só eu' },
  { key: 'team', label: 'Minha equipe' },
  { key: 'company', label: 'Toda a empresa' },
  { key: 'unknown', label: 'Não sei' },
];

type ChoiceOptionsProps = {
  onSelect: (label: string) => void;
  disabled?: boolean;
};

/** Figma: plain text choice chips — no numbered badges. */
export function ChoiceOptions({ onSelect, disabled = false }: ChoiceOptionsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {IMPACT_CHOICES.map((choice) => (
        <button
          key={choice.key}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(choice.label)}
          className="rounded-lg border border-rule bg-paper px-3 py-1.5 text-[13.5px] font-medium text-ink transition hover:border-primary hover:bg-primary-soft hover:text-primary-text focus-visible:border-primary focus-visible:bg-primary-soft focus-visible:text-primary-text focus-visible:outline-none disabled:opacity-50"
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

export function messageAsksImpact(content: string): boolean {
  const normalized = content.toLowerCase();
  return (
    normalized.includes('quem está sendo afetado') ||
    normalized.includes('quem esta sendo afetado') ||
    normalized.includes('quem está afetado') ||
    normalized.includes('afetados?')
  );
}
