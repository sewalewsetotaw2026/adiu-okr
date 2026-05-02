import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Celebration, CelebrationMessage } from "../../models/celebration";

export interface CelebrationState {
  activeCelebrations: Celebration[];
  loading: boolean;
  error: string | null;
}

const initialState: CelebrationState = {
  activeCelebrations: [],
  loading: false,
  error: null,
};

const celebrationSlice = createSlice({
  name: "celebration",
  initialState,
  reducers: {
    // Fetch all celebrations
    fetchCelebrationsRequest(state) {
      state.loading = true;
      state.error = null;
    },
    fetchCelebrationsSuccess(state, action: PayloadAction<Celebration[]>) {
      const dismissedById = new Map<string, boolean>();
      state.activeCelebrations.forEach((c) => {
        if (c.isDismissed) {
          dismissedById.set(String(c.id), true);
        }
      });

      state.activeCelebrations = action.payload.map((incoming) => {
        const preservedDismissed =
          incoming.isDismissed ?? dismissedById.get(String(incoming.id));
        return {
          ...incoming,
          isDismissed: Boolean(preservedDismissed),
        };
      });
      state.loading = false;
    },
    fetchCelebrationsFailure(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
    },

    // Fetch a single celebration by ID (includes messages)
    fetchCelebrationByIdRequest(state, _action: PayloadAction<string>) {
      state.loading = true;
      state.error = null;
    },
    fetchCelebrationByIdSuccess(state, action: PayloadAction<Celebration>) {
      state.loading = false;
      const index = state.activeCelebrations.findIndex(
        (c) => String(c.id) === String(action.payload.id),
      );
      if (index !== -1) {
        // Merge full data (with messages) into existing entry
        state.activeCelebrations[index] = {
          ...action.payload,
          isDismissed:
            action.payload.isDismissed ??
            state.activeCelebrations[index].isDismissed ??
            false,
        };
      } else {
        state.activeCelebrations.push({
          ...action.payload,
          isDismissed: Boolean(action.payload.isDismissed),
        });
      }
    },
    fetchCelebrationByIdFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },

    // Add a new celebration (from SSE)
    addCelebration(state, action: PayloadAction<Celebration>) {
      const exists = state.activeCelebrations.find(
        (c) => String(c.id) === String(action.payload.id),
      );
      if (!exists) {
        state.activeCelebrations.push({
          ...action.payload,
          isDismissed: Boolean(action.payload.isDismissed),
        });
      }
    },

    // Update an existing celebration
    updateCelebration(state, action: PayloadAction<Celebration>) {
      const index = state.activeCelebrations.findIndex(
        (c) => String(c.id) === String(action.payload.id),
      );
      if (index !== -1) {
        state.activeCelebrations[index] = {
          ...action.payload,
          isDismissed:
            action.payload.isDismissed ??
            state.activeCelebrations[index].isDismissed ??
            false,
        };
      }
    },

    // Remove a celebration
    removeCelebration(state, action: PayloadAction<string>) {
      state.activeCelebrations = state.activeCelebrations.filter(
        (c) => String(c.id) !== String(action.payload),
      );
    },

    // Dismiss a celebration (marks as dismissed locally)
    dismissCelebrationRequest(state, action: PayloadAction<string>) {
      const celebration = state.activeCelebrations.find(
        (c) => String(c.id) === String(action.payload),
      );
      if (celebration) {
        celebration.isDismissed = true;
      }
    },
    dismissCelebrationSuccess(_state, _action: PayloadAction<string>) {
      // Already marked as dismissed in request
    },
    dismissCelebrationFailure(
      state,
      action: PayloadAction<{ id: string; error: string }>,
    ) {
      // Revert dismissal
      const celebration = state.activeCelebrations.find(
        (c) => String(c.id) === String(action.payload.id),
      );
      if (celebration) {
        celebration.isDismissed = false;
      }
      state.error = action.payload.error;
    },

    // Send message
    sendMessageRequest(
      _state,
      _action: PayloadAction<{ celebrationId: string; message: string }>,
    ) {
      // Optimistic update handled in saga
    },
    sendMessageSuccess(state, action: PayloadAction<CelebrationMessage>) {
      const celebration = state.activeCelebrations.find(
        (c) => c.id === action.payload.celebrationId,
      );
      if (celebration) {
        if (!celebration.messages) {
          celebration.messages = [];
        }
        celebration.messages.unshift(action.payload);
        if (celebration.totalWishes !== undefined) {
          celebration.totalWishes += 1;
        }
      }
    },
    sendMessageFailure(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },

    // Send reaction
    sendReactionRequest(
      state,
      action: PayloadAction<{ celebrationId: string; reaction: string }>,
    ) {
      // Optimistic update
      const celebration = state.activeCelebrations.find(
        (c) => c.id === action.payload.celebrationId,
      );
      if (celebration) {
        if (celebration.totalLikes !== undefined) {
          celebration.totalLikes += 1;
        }

        // Also add the reaction as a message optimistically
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const optimisticMessage: CelebrationMessage = {
          id: `temp-${Date.now()}`, // Temporary ID
          celebrationId: action.payload.celebrationId,
          senderId: currentUser.id || "",
          senderName:
            `${currentUser.first_name || "You"} ${currentUser.last_name || ""}`.trim(),
          senderAvatar: currentUser.profile_picture,
          senderPosition: currentUser.job_title || "Colleague",
          message: action.payload.reaction,
          isReaction: true,
          reactionType: action.payload.reaction,
          createdAt: new Date().toISOString(),
        };

        if (!celebration.messages) {
          celebration.messages = [];
        }
        celebration.messages.unshift(optimisticMessage);
      }
    },
    sendReactionSuccess(
      state,
      action: PayloadAction<{ celebrationId: string }>,
    ) {
      // Server confirmed, do nothing as we already updated properly
    },
    sendReactionFailure(
      state,
      action: PayloadAction<{ id: string; error: string }>,
    ) {
      // Revert optimistic update
      // Revert optimistic update
      const celebration = state.activeCelebrations.find(
        (c) => c.id === action.payload.id,
      );
      if (celebration) {
        if (celebration.totalLikes !== undefined) {
          celebration.totalLikes -= 1;
        }
        // Remove the temporary optimistic message (simplistic: remove latest reaction by user)
        // In a real app, we'd track the temp ID better, but this is a fallback.
        if (celebration.messages && celebration.messages.length > 0) {
          // Remove the first message if it looks like our failed reaction
          if (celebration.messages[0].id.startsWith("temp-")) {
            celebration.messages.shift();
          }
        }
      }
      state.error = action.payload.error;
    },
  },
});

export const { actions: celebrationActions } = celebrationSlice;
export default celebrationSlice.reducer;
