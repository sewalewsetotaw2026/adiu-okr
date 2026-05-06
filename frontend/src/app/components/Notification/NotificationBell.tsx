import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  MdNotifications,
  MdCheck,
  MdAccessTime,
  MdClose,
  MdStars,
  MdTimeline,
  MdAssignment,
  MdVisibility,
  MdComment,
  MdCancel,
  MdCheckCircle,
  MdPublish,
} from "react-icons/md";
import {
  useNotificationSlice,
  notificationActions,
} from "../../slice/notificationSlice";
import {
  selectNotifications,
  selectUnreadCount,
  selectNotificationLoading,
} from "../../slice/notificationSlice/selectors";
import { selectAuthUser } from "../../slice/authSlice/selectors";
import {
  Notification,
  NotificationType,
} from "../../slice/notificationSlice/types";
import Modal from "../common/Modal";
import { useManagerSlice } from "../../slice/managerSlice";
import { selectIsManager } from "../../slice/managerSlice/selectors";

const RAW_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_BASE_URL;

if (!RAW_BASE_URL) {
  throw new Error(
    "Missing API base URL. Set VITE_API_URL (recommended) or VITE_BASE_URL (example: VITE_API_URL=http://localhost:5000/api/v1).",
  );
}

const API_BASE_URL = String(RAW_BASE_URL).replace(/\/+$/, "");

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case NotificationType.LEAVE_APPROVED:
      case NotificationType.LEAVE_APPROVED_BY_MANAGER:
        return (
          <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
            <MdCheck size={16} />
          </div>
        );
      case NotificationType.LEAVE_REJECTED:
        return (
          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <MdClose size={16} />
          </div>
        );
      case NotificationType.LEAVE_SUBMITTED:
        return (
          <div className="w-8 h-8 rounded-full bg-orange-100 text-k-orange flex items-center justify-center">
            <MdNotifications size={16} />
          </div>
        );
      case NotificationType.RECALL_REQUEST:
        return (
          <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center">
            <MdNotifications size={16} />
          </div>
        );
      case NotificationType.PROMOTION:
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
            <MdStars size={16} />
          </div>
        );
      case NotificationType.OKR_PLAN_SUBMITTED:
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <MdAssignment size={16} />
          </div>
        );
      case NotificationType.OKR_PLAN_UNDER_REVIEW:
        return (
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <MdVisibility size={16} />
          </div>
        );
      case NotificationType.OKR_COMMENT_ADDED:
        return (
          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
            <MdComment size={16} />
          </div>
        );
      case NotificationType.OKR_PLAN_REJECTED:
        return (
          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <MdCancel size={16} />
          </div>
        );
      case NotificationType.OKR_PLAN_APPROVED:
        return (
          <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
            <MdCheckCircle size={16} />
          </div>
        );
      case NotificationType.OKR_PLAN_PUBLISHED:
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <MdPublish size={16} />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-orange-50 text-k-orange flex items-center justify-center">
            <MdNotifications size={16} />
          </div>
        );
  }
};

export default function NotificationBell() {
  useNotificationSlice();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loading = useSelector(selectNotificationLoading);
  const authUser = useSelector(selectAuthUser) as any;
  const [isOpen, setIsOpen] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<any>(null);

  // Get user role for navigation
  const { actions: managerActions } = useManagerSlice();
  const isManager = useSelector(selectIsManager);
  const userRole = authUser?.role?.name || authUser?.role || "";
  const isAdmin =
    userRole.toLowerCase().includes("admin") ||
    userRole.toLowerCase().includes("hr");

  useEffect(() => {
    dispatch(managerActions.checkIsManager());
  }, [dispatch, managerActions]);

  // SSE Connection Logic
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const connectSSE = () => {
      try {
        const url = `${API_BASE_URL}/notifications/stream`;
        const controller = new AbortController();

        fetch(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
        })
          .then(async (response) => {
            if (!response.ok || !response.body) {
              console.error("[SSE] Connection failed");
              setSseConnected(false);
              return;
            }

            setSseConnected(true);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Decode stream chunk and append to buffer
              buffer += decoder.decode(value, { stream: true });

              // Process complete lines from buffer
              const lines = buffer.split("\n");
              // Keep the last partial line in the buffer
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith("data: ")) {
                  try {
                    const dataStr = trimmedLine.slice(6);
                    if (dataStr === "[DONE]") continue;

                    const data = JSON.parse(dataStr);

                    if (data.type === "notification") {
                      dispatch(
                        notificationActions.getNotifications({
                          page: 1,
                          limit: 10,
                        }),
                      );
                      dispatch(notificationActions.getUnreadCount());
                    } else if (data.type === "unread_count") {
                      dispatch(notificationActions.getUnreadCount());
                    }
                  } catch (e) {
                    // Ignore JSON parse errors for keep-alive or malformed lines
                    // console.debug('SSE Parse Error:', e);
                  }
                }
              }
            }
          })
          .catch((error) => {
            if (error.name !== "AbortError") {
              console.error("[SSE] Stream error:", error);
              setSseConnected(false);
              // Reconnect logic is handled by re-running effect or external interval
            }
          });

        eventSourceRef.current = { abort: () => controller.abort() };
      } catch (error) {
        // console.error('[SSE] Setup error:', error);
        setSseConnected(false);
      }
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current?.abort) {
        eventSourceRef.current.abort();
      }
      setSseConnected(false);
    };
  }, [dispatch]);

  // Initial load + Slow fallback polling (120s) when SSE is disconnected
  useEffect(() => {
    dispatch(notificationActions.getUnreadCount());

    // Fallback polling only if SSE is disconnected and tab is visible
    const interval = setInterval(() => {
      if (!sseConnected && !document.hidden) {
        dispatch(notificationActions.getUnreadCount());
      }
    }, 120_000);

    return () => clearInterval(interval);
  }, [dispatch, sseConnected]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      dispatch(notificationActions.getNotifications({ page: 1, limit: 10 }));
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    dispatch(notificationActions.markAsRead(id));
  };

  const handleMarkAllAsRead = () => {
    dispatch(notificationActions.markAllAsRead());
  };

  const navigateToPending = (notification?: Notification) => {
    setIsOpen(false);

    // Handle specific notification types
    if (notification) {
      // Prefer explicit backend-provided action URL when available
      if (notification.action_url) {
        let targetUrl = notification.action_url;

        // Backward compatibility for legacy route names
        if (targetUrl.startsWith("/admin/leave-management")) {
          targetUrl = targetUrl.replace(
            "/admin/leave-management",
            "/admin/leaves",
          );
        }

        if (targetUrl.startsWith("/employee/leave/history")) {
          targetUrl = targetUrl.replace(
            "/employee/leave/history",
            "/employee/leave",
          );
        }

        if (
          notification.related_entity_type === "leave_application" &&
          notification.related_entity_id &&
          !targetUrl.includes("applicationId=")
        ) {
          const joinChar = targetUrl.includes("?") ? "&" : "?";
          targetUrl = `${targetUrl}${joinChar}applicationId=${notification.related_entity_id}`;
        }

        navigate(targetUrl);
        return;
      }

      // 1. Employee Leave Status Updates (Approved/Rejected) - For EVERYONE (Managers included)
      // These are about YOUR leave, so go to your leave page.
      if (
        notification.type === NotificationType.LEAVE_APPROVED ||
        notification.type === NotificationType.LEAVE_APPROVED_BY_MANAGER ||
        notification.type === NotificationType.LEAVE_REJECTED
      ) {
        navigate("/employee/leave");
        return;
      }

      if (
        notification.type === NotificationType.RECALL_REQUEST &&
        !isManager &&
        !isAdmin
      ) {
        navigate("/employee/leave-recall");
        return;
      }
      // Managers: Go to Team Leaves for submissions and recall responses
      if (
        isManager &&
        (notification.type === NotificationType.LEAVE_SUBMITTED ||
          notification.type === NotificationType.RECALL_ACCEPTED ||
          notification.type === NotificationType.RECALL_DECLINED)
      ) {
        navigate("/manager/team-leaves?tab=pending");
        return;
      }

      if (
        notification.type === NotificationType.RECALL_ACCEPTED ||
        notification.type === NotificationType.RECALL_DECLINED
      ) {
        if (isAdmin) {
          navigate("/admin/leaves");
          return;
        }
      }

      // 2. OKR Notifications - Use action_url (deep_link)
      if (
        notification.type === NotificationType.OKR_PLAN_SUBMITTED ||
        notification.type === NotificationType.OKR_PLAN_UNDER_REVIEW ||
        notification.type === NotificationType.OKR_COMMENT_ADDED ||
        notification.type === NotificationType.OKR_PLAN_REJECTED ||
        notification.type === NotificationType.OKR_PLAN_APPROVED ||
        notification.type === NotificationType.OKR_PLAN_PUBLISHED
      ) {
        if (notification.action_url) {
          navigate(notification.action_url);
        } else {
          navigate("/employee/execution");
        }
        return;
      }
    }

    // Default routing based on role
    if (isAdmin) {
      navigate("/admin/leaves?tab=pending");
    } else if (isManager) {
      // Default for managers should likely be team leaves if not specific
      navigate("/manager/team-leaves?tab=pending");
    } else {
      navigate("/employee/leave");
    }
  };

  const handleItemClick = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
    navigateToPending(notification);
  };

  const handleViewAll = () => {
    setIsOpen(false);
    dispatch(notificationActions.getNotifications({ page: 1, limit: 50 }));
    setShowAllModal(true);
  };

  const renderNotificationItem = (notification: any, inModal = false) => (
    <div
      key={notification.id}
      onClick={() => handleItemClick(notification)}
      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer flex gap-3 ${!notification.is_read ? "bg-orange-50/50" : ""}`}
    >
      <div className="shrink-0 mt-1">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${!notification.is_read ? "font-semibold text-gray-900" : "text-gray-700"}`}
        >
          {notification.title}
        </p>
        <p
          className={`text-xs text-gray-500 mt-1 ${inModal ? "" : "line-clamp-2"}`}
        >
          {notification.message}
        </p>
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
          <MdAccessTime size={12} />
          {formatTimeAgo(notification.created_at)}
        </div>
      </div>
      {!notification.is_read && (
        <div className="shrink-0 self-center">
          <div className="w-2 h-2 rounded-full bg-k-orange" />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Round notification button with simple UI */}
        <button
          onClick={handleToggle}
          className={`
            relative w-11 h-11 rounded-full flex items-center justify-center
            transition-all duration-300 cursor-pointer
            ${
              unreadCount > 0
                ? "bg-orange-50 hover:bg-orange-100"
                : "bg-gray-100 hover:bg-gray-200"
            }
          `}
        >
          <MdNotifications
            size={22}
            className={`transition-colors ${unreadCount > 0 ? "text-k-orange" : "text-gray-500"}`}
          />

          {/* Badge with simple ping animation */}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5">
              <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
              <span className="relative flex items-center justify-center min-w-4.5 h-4.5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            </span>
          )}
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-linear-to-r from-orange-50 to-yellow-50">
              <h3 className="font-semibold text-gray-800">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs font-medium text-k-orange hover:text-orange-600 transition-colors cursor-pointer"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="p-4 space-y-4">
                  <div className="h-12 w-full shimmer-bg rounded-xl" />
                  <div className="h-12 w-full shimmer-bg rounded-xl" />
                  <div className="h-12 w-full shimmer-bg rounded-xl" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MdNotifications className="text-4xl text-gray-300 mx-auto mb-2" />
                  <p className="font-medium">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications
                    .slice(0, 5)
                    .map((n: any) => renderNotificationItem(n))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-100 text-center bg-gray-50">
              <button
                onClick={handleViewAll}
                className="text-sm font-medium text-k-orange hover:text-orange-600 transition-colors cursor-pointer"
              >
                View All Notifications
              </button>
            </div>
          </div>
        )}
      </div>

      {/* All Notifications Modal */}
      <Modal
        isOpen={showAllModal}
        onClose={() => setShowAllModal(false)}
        title="All Notifications"
        size="lg"
      >
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm font-medium text-k-orange hover:text-orange-600 transition-colors cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-100">
            {loading ? (
              <div className="space-y-4 p-2">
                <div className="h-16 w-full shimmer-bg rounded-xl" />
                <div className="h-16 w-full shimmer-bg rounded-xl" />
                <div className="h-16 w-full shimmer-bg rounded-xl" />
                <div className="h-16 w-full shimmer-bg rounded-xl" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MdNotifications className="text-4xl text-gray-300 mx-auto mb-2" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n: any) => renderNotificationItem(n, true))
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
