type Choice = {
  key: string;
  label: string;
};

const IMPACT_CHOICES: Choice[] = [
  { key: '1', label: 'Só eu' },
  { key: '2', label: 'Minha equipe' },
  { key: '3', label: 'Toda a empresa' },
  { key: '4', label: 'Não sei' },
];

type ChoiceOptionsProps = {
  onSelect: (label: string) => void;
  disabled?: boolean;
};

export function ChoiceOptions({ onSelect, disabled = false }: ChoiceOptionsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {IMPACT_CHOICES.map((choice, index) => (
        <button
          key={choice.key}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(choice.label)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-paper px-3 py-1.5 text-[13.5px] font-medium text-ink transition hover:border-primary hover:bg-primary-soft hover:text-primary-text disabled:opacity-50"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-md bg-desk text-[12.5px] text-ink-3">
            {index + 1}
          </span>
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
