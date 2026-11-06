import { replyLine } from './prompt-format';
import type { PromptContext } from './prompt-sources';
import { planningPrompts } from './prompts-planning';
import { spendingPrompts } from './prompts-spending';
import { taxPrompt } from './prompts-tax';

export type { PromptContext } from './prompt-sources';

export interface PromptTemplate {
  key: string;
  buildPrompt: (context: PromptContext) => Promise<string>;
}

export const promptTemplates: PromptTemplate[] = [
  ...spendingPrompts,
  taxPrompt,
  ...planningPrompts,
].map(({ key, buildPrompt }) => ({
  key,
  buildPrompt: async context => `${await buildPrompt(context)}\n\n${replyLine(context.locale)}`,
}));
