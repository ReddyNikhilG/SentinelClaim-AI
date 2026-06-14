import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatHistoryRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claims-assistant`;
const MESSAGES_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-messages`;

export function ClaimsAssistantChat() {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const defaultMessages = useMemo<Message[]>(() => ([
    {
      id: '0',
      role: 'assistant',
      content: "Hello! I'm ClaimGuard AI, your insurance claims assistant. I can help you with:\n\n- Questions about claim types and processes\n- Understanding risk scores and fraud indicators\n- Documentation requirements\n- Claim status information\n- General claims policy questions\n\nHow can I assist you today?"
    }
  ]), []);

  const [messages, setMessages] = useState<Message[]>(defaultMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ----------- Load persisted chat history from backend -----------
  useEffect(() => {
    if (!session?.access_token) return;

    const load = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(MESSAGES_URL, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) throw new Error("Failed to load history");
        const data = await res.json() as { messages?: ChatHistoryRow[] };
        if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
        }
      } catch (error) {
        console.warn("Could not load chat history:", error);
      } finally {
        setLoadingHistory(false);
      }
    };
    void load();
  }, [session?.access_token]);

  // Persist new messages to backend (fire & forget)
  const saveMessage = useCallback(
    async (role: 'user' | 'assistant', content: string) => {
      if (!session?.access_token) return;
      try {
        await fetch(MESSAGES_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role, content }),
        });
      } catch {
        // ignore
      }
    },
    [session?.access_token]
  );

  const clearHistory = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      await fetch(MESSAGES_URL, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setMessages(defaultMessages);
    } catch {
      // ignore
    }
  }, [defaultMessages, session?.access_token]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const streamChat = useCallback(async (userMessages: Message[]) => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const retryDelays = [700, 1400, 2500];
    let resp: Response | null = null;

    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: userMessages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (resp.ok) break;
      if (resp.status !== 429 && resp.status < 500) break;
      if (attempt < retryDelays.length - 1) await wait(retryDelays[attempt]);
    }

    if (!resp || !resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      const msg = errorData?.error || `Chat request failed (${resp.status})`;
      if (resp.status === 429) throw new Error("Chat is temporarily busy. Please retry in a few seconds.");
      if (resp.status === 402) throw new Error("Chat service is temporarily unavailable—please try again later.");
      throw new Error(msg);
    }

    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";
    const assistantId = Date.now().toString();

    // Create initial assistant message
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);
    let assistantFinal = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr) as { choices?: Array<{ delta?: { content?: string } }> };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantContent += content;
            assistantFinal = assistantContent;
            setMessages(prev => 
              prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
            );
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr) as { choices?: Array<{ delta?: { content?: string } }> };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantContent += content;
            assistantFinal = assistantContent;
            setMessages(prev => 
              prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
            );
          }
        } catch { /* ignore */ }
      }
    }

    // Save final assistant message
    if (assistantFinal) {
      void saveMessage('assistant', assistantFinal);
    }
  }, [saveMessage, session?.access_token]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    void saveMessage('user', userMessage.content);

    try {
      await streamChat(updatedMessages);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: error instanceof Error
          ? `**Error:** ${error.message}`
          : "I'm sorry, I encountered an error. Please try again in a moment."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
        size="icon"
      >
        <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    );
  }

  return (
    <div 
      className={cn(
        "fixed z-50 bg-card border border-border rounded-lg shadow-2xl flex flex-col transition-all duration-300",
        isMinimized 
          ? "bottom-4 right-4 sm:bottom-6 sm:right-6 w-72 h-14" 
          : "bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 h-[calc(100vh-8rem)] sm:h-[500px] max-h-[600px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">ClaimGuard AI</h3>
            <p className="text-xs text-muted-foreground">Claims Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearHistory}
            title="Clear chat history"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            {loadingHistory && (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading history…
              </div>
            )}
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="h-3.5 w-3.5 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2 justify-start">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about claims..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
