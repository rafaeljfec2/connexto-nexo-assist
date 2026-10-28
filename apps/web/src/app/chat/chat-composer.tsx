import { FormEvent } from 'react';
import { Button } from '@/components/Button';
import { ArrowUpIcon, ChevronDownIcon } from '@/components/icons';

export type ChatComposerProps = {
  status: string | undefined;
  withAnalyst: boolean;
  input: string;
  inputLocked: boolean;
  sending: boolean;
  count: number;
  error: string | null;
  retryContent: string | null;
  showNewMessageCue: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onScrollToBottom: () => void;
  onRetry: () => void;
};

export function ChatComposer(props: ChatComposerProps) {
  const {
    status,
    withAnalyst,
    input,
    inputLocked,
    sending,
    count,
    error,
    retryContent,
    showNewMessageCue,
    onInputChange,
    onSubmit,
    onScrollToBottom,
    onRetry,
  } = props;

  return (
    <>
      {showNewMessageCue ? (
        <button
          type="button"
          onClick={onScrollToBottom}
          className="absolute bottom-[92px] left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-rule bg-paper px-3.5 py-2 text-[13px] font-semibold text-primary-text shadow-[0_8px_24px_rgba(27,36,49,0.14)] animate-rise transition hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Ir para a nova mensagem"
        >
          Nova mensagem
          <ChevronDownIcon width={14} height={14} />
        </button>
      ) : null}

      {error ? (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
          <span>{error}</span>
          {retryContent ? (
            <button
              type="button"
              className="font-semibold underline"
              onClick={onRetry}
            >
              Tentar novamente
            </button>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="shrink-0 space-y-1.5 pb-[18px] pt-2.5">
        <div className="flex h-12 items-center gap-x-2 rounded-xl border border-[rgba(27,36,49,0.12)] bg-paper py-0 pl-4 pr-1.5 focus-within:border-cta">
          <input
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3 disabled:opacity-50"
            placeholder={
              status === 'closed'
                ? 'Conversa encerrada'
                : status === 'waiting_analyst'
                  ? 'Agente pausado — aguarde o analista'
                  : withAnalyst
                    ? 'Escreva para o analista…'
                    : 'Escreva para o Nexo…'
            }
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={inputLocked || sending}
            maxLength={4000}
            aria-label="Mensagem"
          />
          <Button
            type="submit"
            disabled={inputLocked || sending || !input.trim()}
            className="h-9 shrink-0 gap-1.5 rounded-md px-3 text-[13.5px]"
          >
            <ArrowUpIcon className="text-white" width={14} height={14} />
            Enviar
          </Button>
        </div>
        <p className="text-right text-xs text-ink-3">
          {count}/30 mensagens nesta sessão
        </p>
      </form>
    </>
  );
}
