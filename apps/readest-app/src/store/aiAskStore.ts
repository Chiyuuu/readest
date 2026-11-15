import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AIProviderProtocol = 'openai' | 'anthropic' | 'gemini';

export interface AIProviderConfig {
  id: string;
  name: string;
  protocol: AIProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  enableThinking?: boolean;
}

export interface QuickPromptChip {
  id: string;
  label: string;
  promptTemplate: string; // Supports {{text}}, {{context}}, {{bookTitle}}, {{bookAuthor}}
}

export interface AIChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
}

export interface SelectionContextPayload {
  selectedText: string;
  surroundingContext?: string;
  bookTitle?: string;
  bookAuthor?: string;
  chapterTitle?: string;
  cfi?: string;
}

interface AIAskState {
  isOpen: boolean;
  activeSelection: SelectionContextPayload | null;
  messages: AIChatMessage[];
  isStreaming: boolean;
  error: string | null;

  providers: AIProviderConfig[];
  activeProviderId: string;
  quickPrompts: QuickPromptChip[];

  // Actions
  openAskPopup: (payload: SelectionContextPayload, initialPrompt?: string) => void;
  closeAskPopup: () => void;
  setMessages: (messages: AIChatMessage[]) => void;
  appendMessage: (msg: AIChatMessage) => void;
  updateLastAssistantMessage: (content: string, reasoning?: string) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  clearSession: () => void;

  // Settings Actions
  addProvider: (provider: AIProviderConfig) => void;
  updateProvider: (id: string, partial: Partial<AIProviderConfig>) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => void;
  updateQuickPrompts: (prompts: QuickPromptChip[]) => void;
}

export const DEFAULT_QUICK_PROMPTS: QuickPromptChip[] = [
  {
    id: 'explain',
    label: '深度解析',
    promptTemplate:
      '请结合上下文，深入解释以下选中文本的含义、隐喻及核心逻辑：\n\n【选中内容】：{{text}}\n\n【所在段落上下文】：{{context}}',
  },
  {
    id: 'summarize',
    label: '提炼要点',
    promptTemplate:
      '请用简洁的要点提炼以下段落的核心观点：\n\n{{text}}',
  },
  {
    id: 'translate_context',
    label: '语境精译',
    promptTemplate:
      '请结合书籍《{{bookTitle}}》的语境，将以下内容翻译为自然流畅的中文，并指出关键术语或双关语：\n\n{{text}}\n\n【参考上下文】：{{context}}',
  },
  {
    id: 'background',
    label: '背景考据',
    promptTemplate:
      '请介绍以下内容涉及的历史、文化、学术或人物背景知识：\n\n{{text}}',
  },
  {
    id: 'critique',
    label: '批判思考',
    promptTemplate:
      '针对以下论述，请提供不同视角的补充或批判性思考问题：\n\n{{text}}',
  },
];

export const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'deepseek-default',
    name: 'DeepSeek (OpenAI 兼容)',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.7,
    enableThinking: false,
  },
  {
    id: 'openai-default',
    name: 'OpenAI / SiliconFlow / OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    enableThinking: false,
  },
  {
    id: 'gemini-default',
    name: 'Google Gemini (OpenAI 兼容接口)',
    protocol: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: '',
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    enableThinking: false,
  },
  {
    id: 'ollama-local',
    name: 'Ollama (局域网/本地模型)',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKey: 'ollama',
    model: 'qwen2.5:7b',
    temperature: 0.7,
    enableThinking: false,
  },
];

export const useAIAskStore = create<AIAskState>()(
  persist(
    (set) => ({
      isOpen: false,
      activeSelection: null,
      messages: [],
      isStreaming: false,
      error: null,

      providers: DEFAULT_PROVIDERS,
      activeProviderId: 'deepseek-default',
      quickPrompts: DEFAULT_QUICK_PROMPTS,

      openAskPopup: (payload) =>
        set({
          isOpen: true,
          activeSelection: payload,
          messages: [],
          error: null,
        }),

      closeAskPopup: () =>
        set({
          isOpen: false,
          isStreaming: false,
          error: null,
        }),

      setMessages: (messages) => set({ messages }),
      appendMessage: (msg) =>
        set((state) => ({ messages: [...state.messages, msg] })),

      updateLastAssistantMessage: (content, reasoning) =>
        set((state) => {
          const updated = [...state.messages];
          for (let i = updated.length - 1; i >= 0; i--) {
            const msg = updated[i];
            if (msg && msg.role === 'assistant') {
              updated[i] = {
                ...msg,
                content,
                ...(reasoning !== undefined ? { reasoning } : {}),
              };
              break;
            }
          }
          return { messages: updated };
        }),

      setStreaming: (isStreaming) => set({ isStreaming }),
      setError: (error) => set({ error }),
      clearSession: () => set({ messages: [], error: null }),

      addProvider: (provider) =>
        set((state) => ({ providers: [...state.providers, provider] })),

      updateProvider: (id, partial) =>
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, ...partial } : p
          ),
        })),

      removeProvider: (id) =>
        set((state) => ({
          providers: state.providers.filter((p) => p.id !== id),
        })),

      setActiveProvider: (id) => set({ activeProviderId: id }),
      updateQuickPrompts: (quickPrompts) => set({ quickPrompts }),
    }),
    {
      name: 'readest-ai-ask-storage',
      partialize: (state) => ({
        providers: state.providers,
        activeProviderId: state.activeProviderId,
        quickPrompts: state.quickPrompts,
      }),
    }
  )
);
