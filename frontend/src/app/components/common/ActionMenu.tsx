import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { FiMoreVertical } from "react-icons/fi";

export interface ActionOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
}

interface ActionMenuProps {
  actions: ActionOption[];
  className?: string;
}

export function ActionMenu({ actions, className }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const targetNode = event.target as Node;
      const clickedInsideTrigger = menuRef.current?.contains(targetNode);
      const clickedInsideMenu = portalRef.current?.contains(targetNode);
      if (!clickedInsideTrigger && !clickedInsideMenu) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!buttonRef.current || !menuRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight =
        portalRef.current?.getBoundingClientRect()?.height || 250; // estimate height if portal not mounted, 250 matches ~5-6 actions
      const width = 208; // matches w-52

      const topSpace = rect.top;
      const bottomSpace = window.innerHeight - rect.bottom;

      let top = rect.bottom;

      // If not enough space below, and more space above, open upwards
      if (bottomSpace < menuHeight && topSpace > bottomSpace) {
        top = rect.top - menuHeight;
      }

      setMenuPos({
        top: top,
        left: rect.right - width,
      });
    };

    // Use setTimeout to allow portal content to render for accurate height detection
    setTimeout(updatePosition, 0);

    // Keep scroll tracking tight without document.body height expanding
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className || ""}`} ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
      >
        <FiMoreVertical className="h-4 w-4" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={portalRef}
            className="fixed z-50 w-52 origin-top-right rounded-xl border border-gray-100 bg-white p-1 shadow-lg ring-1 ring-black/5"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {actions.map((action) => (
              <button
                key={action.value}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${action.variant === "danger"
                    ? "text-red-600 hover:bg-red-50"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

export default ActionMenu;
