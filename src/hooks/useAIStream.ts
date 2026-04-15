import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "../types";

export interface UseAIStreamOptions {
  apiKey: string;
  apiUrl?: string;
  model?: string;
  onFinish?: (fullContent: string) => void;
}

export interface UseAIStreamReturn {
  submit: (messages: Message[]) => void;
  content: string;
  isLoading: boolean;
  error: Error | null;
  abort: () => void;
}

export function useAIStream(options: UseAIStreamOptions): UseAIStreamReturn {
  const {
    apiKey,
    apiUrl = "https://api.deepseek.com/v1",
    model = "deepseek-chat",
    onFinish,
  } = options;

  const [content, setContent] = useState("");
  const fullContentRef = useRef("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const submit = useCallback(
    async (messages: Message[]) => {
      abort();
      setContent("");
      fullContentRef.current = "";
      setError(null);
      setIsLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(`${apiUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "Unknown error");
          throw new Error(`API error ${response.status}: ${text}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const chunk = JSON.parse(data);
              const delta = chunk?.choices?.[0]?.delta?.content;
              if (typeof delta === "string") {
                fullContentRef.current += delta;
                setContent((prev) => prev + delta);
              }
            } catch {
              // Ignore malformed JSON lines
            }
          }
        }

        if (buffer.trim().startsWith("data: ")) {
          const data = buffer.trim().slice(6).trim();
          if (data && data !== "[DONE]") {
            try {
              const chunk = JSON.parse(data);
              const delta = chunk?.choices?.[0]?.delta?.content;
              if (typeof delta === "string") {
                setContent((prev) => prev + delta);
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User-initiated abort — do not surface as error
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
          abortControllerRef.current = null;
          onFinish?.(fullContentRef.current);
        }
      }
    },
    [apiKey, apiUrl, model, abort, onFinish]
  );

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  return {
    submit,
    content,
    isLoading,
    error,
    abort,
  };
}
