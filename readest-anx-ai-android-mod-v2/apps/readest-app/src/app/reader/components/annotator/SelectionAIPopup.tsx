import React, { useState, useRef, useEffect } from 'react';
import {
  useAIAskStore,
  AIChatMessage,
  QuickPromptChip,
} from '@/store/aiAskStore';
import {
  streamSelectionAsk,
  renderPromptTemplate,
} from '@/services/ai/selectionAskClient';

interface SelectionAIPopupProps {
  onSaveToNote?: (noteContent: string) => void;
}

export const SelectionAIPopup: React.FC<SelectionAIPopupProps> = ({
  onSaveToNote,
}) => {
  const {
    isOpen,
    activeSelection,
    messages,
    isStreaming,
    error,
    providers,
    activeProviderId,
    quickPrompts,
    closeAskPopup,
    appendMessage,
    updateLastAssistantMessage,
    setStreaming,
    setError,
    clearSession,
    setActiveProvider,
    updateProvider,
  } = useAIAskStore();

  const [inputVal, setInputVal] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Record<string, boolean>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const activeProvider =
    providers.find((p) => p.id === activeProviderId) || providers[0];

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  if (!isOpen || !activeSelection) return null;

  const triggerAsk = async (userPromptText: string, displayLabel?: string) => {
    if (!userPromptText.trim() || isStreaming) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayLabel || userPromptText,
      timestamp: Date.now(),
    };

    const actualMsgForAPI: AIChatMessage = {
      ...userMsg,
      content: userPromptText,
    };

    const assistantMsg: AIChatMessage = {
      id: `assistant-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
    };

    const historyForAPI = [...messages, actualMsgForAPI];
    appendMessage(userMsg);
    appendMessage(assistantMsg);
    setStreaming(true);
    setError(null);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    await streamSelectionAsk(
      activeProvider,
      activeSelection,
      historyForAPI,
      {
        onToken: (content, reasoning) => {
          updateLastAssistantMessage(content, reasoning);
        },
        onComplete: (content, reasoning) => {
          updateLastAssistantMessage(content, reasoning);
          setStreaming(false);
        },
        onError: (err) => {
          setError(err.message);
          setStreaming(false);
        },
      },
      controller.signal
    );
  };

  const handleQuickPromptClick = (chip: QuickPromptChip) => {
    const rendered = renderPromptTemplate(chip.promptTemplate, activeSelection);
    triggerAsk(rendered, `【${chip.label}】`);
  };

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const text = inputVal.trim();
    setInputVal('');
    triggerAsk(text);
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setStreaming(false);
  };

  const toggleReasoning = (id: string) => {
    setExpandedReasoningIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-2 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[440px] pointer-events-auto">
      <div className="flex flex-col w-full max-h-[82vh] rounded-2xl bg-base-100 text-base-content shadow-2xl border border-base-300 overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-base-200/70 border-b border-base-300">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-primary/15 text-primary font-bold text-xs">
              AI
            </span>
            <span className="font-semibold text-sm">选段 AI 助手</span>
            <select
              className="select select-bordered select-xs max-w-[145px]"
              value={activeProvider.id}
              onChange={(e) => setActiveProvider(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="btn btn-ghost btn-xs"
              title="配置 API Key 与模型"
            >
              ⚙️ 设置
            </button>
            <button
              type="button"
              onClick={clearSession}
              className="btn btn-ghost btn-xs"
              title="清空对话"
            >
              🗑️
            </button>
            <button
              type="button"
              onClick={() => {
                handleStop();
                closeAskPopup();
              }}
              className="btn btn-ghost btn-xs"
              title="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 快捷 API 设置折叠面板 */}
        {showSettings && (
          <div className="p-3 bg-base-200/40 border-b border-base-300 text-xs space-y-2">
            <div className="font-medium text-base-content/80">
              当前服务商配置：{activeProvider.name}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-base-content/60">Base URL (OpenAI 兼容接口)</span>
                <input
                  type="text"
                  className="input input-bordered input-xs w-full"
                  value={activeProvider.baseUrl}
                  onChange={(e) =>
                    updateProvider(activeProvider.id, { baseUrl: e.target.value })
                  }
                  placeholder="https://api.deepseek.com/v1"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-base-content/60">API Key</span>
                  <input
                    type="password"
                    className="input input-bordered input-xs w-full"
                    value={activeProvider.apiKey}
                    onChange={(e) =>
                      updateProvider(activeProvider.id, { apiKey: e.target.value })
                    }
                    placeholder="sk-..."
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-base-content/60">Model 模型名称</span>
                  <input
                    type="text"
                    className="input input-bordered input-xs w-full"
                    value={activeProvider.model}
                    onChange={(e) =>
                      updateProvider(activeProvider.id, { model: e.target.value })
                    }
                    placeholder="deepseek-chat / gpt-4o-mini"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 选中的原文引用卡片 */}
        <div className="px-4 py-2 bg-base-200/30 border-b border-base-200">
          <div className="text-[11px] text-base-content/50 mb-0.5 flex justify-between">
            <span>选中文本片段</span>
            {activeSelection.bookTitle && (
              <span className="truncate max-w-[200px]">
                《{activeSelection.bookTitle}》
              </span>
            )}
          </div>
          <blockquote className="text-xs italic text-base-content/80 border-l-2 border-primary pl-2 line-clamp-3">
            {activeSelection.selectedText}
          </blockquote>
        </div>

        {/* Anx Reader 风格的快捷 Prompt 胶囊栏 */}
        <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar border-b border-base-200">
          {quickPrompts.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={isStreaming}
              onClick={() => handleQuickPromptClick(chip)}
              className="btn btn-outline btn-xs rounded-full shrink-0 hover:btn-primary"
            >
              ✨ {chip.label}
            </button>
          ))}
        </div>

        {/* 聊天消息流 */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[180px] max-h-[360px]"
        >
          {messages.length === 0 && !error && (
            <div className="text-center text-xs text-base-content/50 py-8">
              点击上方快捷按钮，或在下方直接输入问题向 AI 提问。
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-content'
                    : 'bg-base-200 text-base-content'
                }`}
              >
                {msg.reasoning && (
                  <div className="mb-2 border-b border-base-300 pb-1.5">
                    <button
                      type="button"
                      onClick={() => toggleReasoning(msg.id)}
                      className="text-[11px] opacity-70 hover:opacity-100 flex items-center gap-1"
                    >
                      <span>{expandedReasoningIds[msg.id] ? '▼' : '▶'}</span>
                      <span>思考过程 (点击展开/收起)</span>
                    </button>
                    {expandedReasoningIds[msg.id] && (
                      <div className="mt-1 text-[11px] opacity-75 whitespace-pre-wrap pl-2 border-l border-base-content/20">
                        {msg.reasoning}
                      </div>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap">
                  {msg.content || (isStreaming && msg.role === 'assistant' ? '思考生成中...' : '')}
                </div>

                {msg.role === 'assistant' && msg.content && !isStreaming && (
                  <div className="flex items-center gap-2 mt-2 pt-1 border-t border-base-300/60 text-[11px] opacity-75">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(msg.content)}
                      className="hover:underline"
                    >
                      复制回答
                    </button>
                    {onSaveToNote && (
                      <button
                        type="button"
                        onClick={() => onSaveToNote(msg.content)}
                        className="hover:underline text-primary font-medium"
                      >
                        + 存入批注笔记
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="alert alert-error text-xs py-2 px-3 rounded-lg">
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* 底部追问输入框 */}
        <form
          onSubmit={handleSendCustom}
          className="flex items-center gap-2 px-3 py-2.5 bg-base-200/50 border-t border-base-300"
        >
          <input
            type="text"
            className="input input-bordered input-sm flex-1 text-xs"
            placeholder="针对选中内容继续追问 AI..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="btn btn-error btn-sm text-xs"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputVal.trim()}
              className="btn btn-primary btn-sm text-xs"
            >
              发送
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
