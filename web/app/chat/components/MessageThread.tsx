"use client";

import { useEffect, useRef, useMemo } from "react";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface MessageThreadProps {
  messages: Message[];
  isLoading: boolean;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-3 mb-1">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-2 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-gray-200 px-1 py-0.5 text-xs font-mono">$1</code>')
    .replace(/\n/g, "<br>");
}

function MessageContent({ content, role }: { content: string; role: string }) {
  const html = useMemo(() => {
    if (role === "user") return null;
    return renderMarkdown(content);
  }, [content, role]);

  if (role === "user") {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  return (
    <span
      className="message-content whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: html! }}
    />
  );
}

export function MessageThread({ messages, isLoading }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-700">Start a conversation</h2>
          <p className="mt-1 text-sm text-gray-500">
            Type a message below to begin.
          </p>
        </div>
      </div>
    );
  }

  const lastMessage = messages[messages.length - 1];
  const showLoadingDots =
    isLoading && (!lastMessage || lastMessage.role === "user" || lastMessage.content === "");

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((msg) => {
          if (msg.role === "assistant" && msg.content === "") return null;
          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-gray-900 text-white whitespace-pre-wrap"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <MessageContent content={msg.content} role={msg.role} />
              </div>
            </div>
          );
        })}

        {showLoadingDots && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-100 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
