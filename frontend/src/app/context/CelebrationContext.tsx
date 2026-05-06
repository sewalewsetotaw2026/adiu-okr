import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { celebrationActions } from "../slice/celebrationSlice";
import { selectVisibleCelebrations } from "../slice/celebrationSlice/selectors";
import { selectAuthUser, selectAuthToken } from "../slice/authSlice/selectors";
import celebrationService from "../services/celebrationService";
import { Celebration, CelebrationEvent } from "../models/celebration";

interface CelebrationContextType {
  activeCelebrations: Celebration[];
  isConnected: boolean;
}

const CelebrationContext = createContext<CelebrationContextType | undefined>(
  undefined,
);

export const useCelebrations = () => {
  const context = useContext(CelebrationContext);
  if (!context) {
    throw new Error("useCelebrations must be used within CelebrationProvider");
  }
  return context;
};

interface CelebrationProviderProps {
  children: ReactNode;
}

export const CelebrationProvider: React.FC<CelebrationProviderProps> = ({
  children,
}) => {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectAuthUser);
  const token = useSelector(selectAuthToken);
  const activeCelebrations = useSelector(
    selectVisibleCelebrations(currentUser?.id || ""),
  );
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!currentUser || !token) return;

    // Fetch initial celebrations on mount
    dispatch(celebrationActions.fetchCelebrationsRequest());

    // Establish SSE connection using fetch-based streaming
    const sseConnection = celebrationService.connectSSE(
      token,
      (event: MessageEvent) => {
        try {
          const celebrationEvent: CelebrationEvent = JSON.parse(event.data);

          switch (celebrationEvent.type) {
            case "new_celebration":
              dispatch(
                celebrationActions.addCelebration(
                  celebrationEvent.data as Celebration,
                ),
              );
              break;
            case "celebration_update":
              dispatch(
                celebrationActions.updateCelebration(
                  celebrationEvent.data as Celebration,
                ),
              );
              break;
            case "new_message":
              dispatch(
                celebrationActions.sendMessageSuccess(
                  celebrationEvent.data as unknown as any // Cast to any to avoid type check issues if CelebrationMessage mismatch
                )
              );
              break;
            case "connected":
              // Initial connection event - ignore
              break;
            default:
              console.warn("Unknown celebration event type:", celebrationEvent);
          }
        } catch (error) {
          console.error("Error parsing SSE event:", error);
        }
      },
      () => {
        setIsConnected(true);
      },
      () => {
        setIsConnected(false);
        console.error("SSE connection error");
      },
    );

    // Cleanup on unmount
    return () => {
      sseConnection.close();
      setIsConnected(false);
    };
  }, [dispatch, currentUser, token]);

  const value: CelebrationContextType = {
    activeCelebrations,
    isConnected,
  };

  return (
    <CelebrationContext.Provider value={value}>
      {children}
    </CelebrationContext.Provider>
  );
};
