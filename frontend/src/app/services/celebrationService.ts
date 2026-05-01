import API from "../API";
import apiRoutes from "../API/apiRoutes";
import { Celebration, CelebrationMessage } from "../models/celebration";
// No SERVER_URL import here

/**
 * Service for celebration-related API calls
 */
const celebrationService = {
  /**
   * Get all active celebrations
   */
  getCelebrations: async (): Promise<Celebration[]> => {
    const response = await API({
      route: apiRoutes.celebrations,
      method: "GET",
      isSecureRoute: true,
    });
    return response.data;
  },

  /**
   * Get a specific celebration by ID
   */
  getCelebrationById: async (id: string): Promise<Celebration> => {
    const response = await API({
      route: apiRoutes.celebrationById(id),
      method: "GET",
      isSecureRoute: true,
    });
    return response.data;
  },

  /**
   * Send a message/wish for a celebration
   */
  sendMessage: async (
    celebrationId: string,
    message: string,
  ): Promise<CelebrationMessage> => {
    const response = await API({
      route: apiRoutes.celebrationMessages(celebrationId),
      method: "POST",
      body: { message },
      isSecureRoute: true,
    });
    return response.data;
  },

  /**
   * Send a quick reaction to a celebration
   */
  sendReaction: async (
    celebrationId: string,
    reaction: string,
  ): Promise<{ success: boolean }> => {
    const response = await API({
      route: apiRoutes.celebrationReactions(celebrationId),
      method: "POST",
      body: { reaction },
      isSecureRoute: true,
    });
    return response.data;
  },

  /**
   * Dismiss a celebration for the current user
   */
  dismissCelebration: async (
    celebrationId: string,
  ): Promise<{ success: boolean }> => {
    const response = await API({
      route: apiRoutes.dismissCelebration(celebrationId),
      method: "POST",
      isSecureRoute: true,
    });
    return response.data;
  },

  /**
   * Connect to SSE for real-time celebration events using fetch API
   * Returns an object with abort controller for cleanup
   */
  connectSSE: (
    token: string,
    onMessage: (event: MessageEvent) => void,
    onOpen?: () => void,
    onError?: (error: Error) => void,
  ): { close: () => void } => {
    const controller = new AbortController();
    const url = `${apiRoutes.celebrationEvents}`;

    const connect = async () => {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
          credentials: "include", // Required for CORS when backend sends Access-Control-Allow-Credentials
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("SSE connection failed");
        }

        onOpen?.();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith("data: ")) {
              const dataStr = trimmedLine.slice(6);
              if (dataStr && dataStr !== "[DONE]") {
                // Create a MessageEvent-like object for compatibility
                const messageEvent = {
                  data: dataStr,
                  type: "message",
                } as MessageEvent;
                onMessage(messageEvent);
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("SSE connection error:", error);
          onError?.(error as Error);
        }
      }
    };

    connect();

    return {
      close: () => controller.abort(),
    };
  },
};

export default celebrationService;
