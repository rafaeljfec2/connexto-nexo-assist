'use client';

type OptionChipsProps = {
  options: Array<{ label: string; onClick: () => void }>;
  disabled?: boolean;
};

/** Pencil option chips under the agent bubble (consulta overdue actions). */
export function OptionChips({ options, disabled = false }: OptionChipsProps) {
  return (
    <div className="mt-3 flex w-fit flex-row flex-wrap items-start gap-1.5">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          disabled={disabled}
          onClick={option.onClick}
          className="box-border inline-flex items-center rounded-lg bg-paper px-3 py-[7px] text-[13.5px] font-medium leading-none text-ink outline outline-1 outline-offset-[-0.5px] outline-rule transition hover:bg-desk disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
