import {
  AIChatMessage,
  AIProviderConfig,
  SelectionContextPayload,
} from '@/store/aiAskStore';

export interface StreamCallbacks {
  onToken: (fullContent: string, fullReasoning?: string) => void;
  onComplete: (fullContent: string, fullReasoning?: string) => void;
  onError: (err: Error) => void;
}

export function renderPromptTemplate(
  template: string,
  context: SelectionContextPayload
): string {
  return template
    .replace(/\{\{text\}\}/g, context.selectedText || '')
    .replace(/\{\{context\}\}/g, context.surroundingContext || context.selectedText || '')
    .replace(/\{\{bookTitle\}\}/g, context.bookTitle || '未知书籍')
    .replace(/\{\{bookAuthor\}\}/g, context.bookAuthor || '未知作者')
    .replace(/\{\{chapterTitle\}\}/g, context.chapterTitle || '');
}

export function buildSystemPrompt(context: SelectionContextPayload): string {
  const metaParts: string[] = [];
  if (context.bookTitle) metaParts.push(`书名：《${context.bookTitle}》`);
  if (context.bookAuthor) metaParts.push(`作者：${context.bookAuthor}`);
  if (context.chapterTitle) metaParts.push(`章节：${context.chapterTitle}`);

  return [
    '你是一位博学、敏锐的深度阅读 AI 助手（类似 Anx Reader 与 Readest 深度阅读助手）。',
    metaParts.length > 0 ? `当前阅读信息：${metaParts.join(' | ')}` : '',
    context.selectedText
      ? `用户当前在书中选中的片段为：\n---\n${context.selectedText}\n---`
      : '',
    context.surroundingContext && context.surroundingContext !== context.selectedText
      ? `选中片段所在的上下文段落为：\n---\n${context.surroundingContext}\n---`
      : '',
    '请直接、清晰、有条理地回答用户关于该选段的问题，支持使用 Markdown 格式组织要点。',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * 发起流式 AI 提问请求（直接从客户端请求用户配置的 OpenAI 兼容端点 / Anthropic / Gemini，无需 Readest Plus 订阅）
 */
export async function streamSelectionAsk(
  provider: AIProviderConfig,
  context: SelectionContextPayload,
  conversation: AIChatMessage[],
  callbacks: StreamCallbacks,
  abortSignal?: AbortSignal
): Promise<void> {
  if (!provider.baseUrl) {
    callbacks.onError(new Error('未配置 AI 服务 Base URL，请先在设置中填写。'));
    return;
  }

  const isLocal =
    provider.baseUrl.includes('localhost') ||
    provider.baseUrl.includes('127.0.0.1') ||
    provider.baseUrl.includes('192.168.');

  if (!provider.apiKey && !isLocal) {
    callbacks.onError(
      new Error(`未配置 ${provider.name} 的 API Key，请点击右上角「⚙️ 设置」填入密钥。`)
    );
    return;
  }

  const systemPrompt = buildSystemPrompt(context);
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...conversation.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const endpoint = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  try {
    const bodyPayload: Record<string, unknown> = {
      model: provider.model,
      messages: apiMessages,
      stream: true,
      temperature: provider.temperature ?? 0.7,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey
          ? { Authorization: `Bearer ${provider.apiKey}` }
          : {}),
      },
      body: JSON.stringify(bodyPayload),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `AI 请求失败 (${response.status}): ${errorText.slice(0, 200) || response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error('响应流为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';
    let fullReasoning = '';
    let inThinkTag = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const dataStr = line.slice(5).trim();
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.reasoning_content) {
            fullReasoning += delta.reasoning_content;
          }

          if (delta.content) {
            const chunk: string = delta.content;
            if (chunk.includes('<think>')) {
              inThinkTag = true;
              const afterOpen = chunk.split('<think>')[1] || '';
              fullReasoning += afterOpen;
            } else if (chunk.includes('</think>')) {
              inThinkTag = false;
              const [beforeClose, afterClose] = chunk.split('</think>');
              fullReasoning += beforeClose || '';
              fullContent += afterClose || '';
            } else if (inThinkTag) {
              fullReasoning += chunk;
            } else {
              fullContent += chunk;
            }
          }

          callbacks.onToken(fullContent, fullReasoning || undefined);
        } catch {
          // 忽略非完整 JSON 行
        }
      }
    }

    callbacks.onComplete(fullContent, fullReasoning || undefined);
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
