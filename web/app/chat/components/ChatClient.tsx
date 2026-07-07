"use client";

import { useState, useEffect, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "./Sidebar";
import { MessageThread } from "./MessageThread";
import { ChatInput } from "./ChatInput";

interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export function ChatClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId: number) => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, fetchMessages]);

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: number) => {
    setActiveConversationId(id);
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: number) => {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
    fetchConversations();
  };

  const handleSendMessage = async (content: string) => {
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          conversationId: activeConversationId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const data = await res.json();

      if (!activeConversationId) {
        setActiveConversationId(data.conversationId);
      }

      setMessages((prev) => [...prev, data.message]);
      fetchConversations();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Something went wrong. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 sm:hidden"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">AI Job Search</h1>
        </div>
        <UserButton />
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar
          conversations={conversations}
          activeId={activeConversationId}
          isOpen={sidebarOpen}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <MessageThread messages={messages} isLoading={isLoading} />
          <ChatInput onSend={handleSendMessage} disabled={isLoading} />
        </main>
      </div>
    </div>
  );
}
