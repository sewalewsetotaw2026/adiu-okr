/**
 * Celebration types
 */
export type CelebrationType = "birthday" | "promotion" | "anniversary";

/**
 * Celebration visibility
 * - public: Shown to all employees except the celebrating employee
 * - private: Shown only to the celebrating employee
 */
export type CelebrationVisibility = "public" | "private";

/**
 * Celebration details based on type
 */
export interface CelebrationDetails {
  newPosition?: string; // For promotions
  previousPosition?: string; // For promotions
  effectiveDate?: string; // For promotions
  yearsOfService?: number; // For anniversaries
  zodiacSign?: string; // For birthdays
  horoscope?: string; // For birthdays
}

/**
 * Celebration message/wish from colleagues
 */
export interface CelebrationMessage {
  id: string;
  celebrationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderPosition?: string;
  message: string;
  isReaction?: boolean; // True if this is an emoji reaction, not a text wish
  reactionType?: string | null; // Emoji character for reactions
  reaction?: string; // Legacy emoji reaction field
  createdAt: string;
}

/**
 * Main celebration event model
 */
export interface Celebration {
  id: string;
  type: CelebrationType;
  employeeId: string;
  employeeName: string;
  employeeAvatar?: string;
  employeePosition?: string;
  celebrationDate: string;
  details?: CelebrationDetails;
  visibility: CelebrationVisibility;
  messages?: CelebrationMessage[];
  totalLikes?: number;
  totalWishes?: number;
  isDismissed?: boolean; // Client-side dismissal state
}

/**
 * SSE event from backend
 */
export interface CelebrationEvent {
  type: "new_celebration" | "celebration_update" | "new_message" | "connected";
  data: Celebration | CelebrationMessage | any; // "connected" might send different data structure
}
