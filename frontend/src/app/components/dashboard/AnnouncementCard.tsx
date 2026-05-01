import React from "react";
import { MdKeyboardArrowDown, MdNotificationsActive, MdVisibility } from "react-icons/md";
import CardMenu from "./CardMenu";

const AnnouncementItem = ({ text }) => (
  <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-lg mb-2 last:mb-0 hover:bg-blue-50 transition-colors cursor-pointer group">
    <span className="text-sm text-gray-700 font-medium truncate">{text}</span>
    <MdKeyboardArrowDown className="text-gray-400 group-hover:text-gray-600" />
  </div>
);

import toast from "react-hot-toast";

export default function AnnouncementCard() {
  const actions = [
    { label: "View All", icon: MdVisibility, onClick: () => toast("Loading all announcements...") },
    { label: "Mark All Read", icon: MdNotificationsActive, onClick: () => toast.success("All announcements marked as read") },
  ];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-card h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-k-dark-grey">Announcement(s)</h3>
        <CardMenu actions={actions} />
      </div>
      
      <div className="space-y-2">
        <AnnouncementItem text="Welcome aaron - 'We have a new staff joining us'" />
        <AnnouncementItem text="Seedforth for Project Manager : Kindly gather at the meeting hall" />
        <AnnouncementItem text="Marriage Alert" />
        <AnnouncementItem text="Office Space Update" />
      </div>
    </div>
  );
}
