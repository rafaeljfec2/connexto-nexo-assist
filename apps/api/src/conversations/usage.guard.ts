import {
  Injectable,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';

export const MAX_EMPLOYEE_MESSAGES = 30;
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_TOOL_STEPS = 4;
export const MAX_CONTEXT_MESSAGES = 10;
export const PROVIDER_TIMEOUT_MS = 20_000;
export const MAX_OUTPUT_TOKENS = 600;

@Injectable()
export class UsageGuard {
  assertMessageSize(content: string): void {
    if (content.length > MAX_MESSAGE_CHARS) {
      throw new PayloadTooLargeException(
        `Mensagem acima do limite de ${MAX_MESSAGE_CHARS} caracteres.`,
      );
    }
  }

  assertEmployeeMessageLimit(count: number): void {
    if (count >= MAX_EMPLOYEE_MESSAGES) {
      throw new UnprocessableEntityException(
        'Limite de 30 mensagens do funcionário nesta conversa.',
      );
    }
  }
}
