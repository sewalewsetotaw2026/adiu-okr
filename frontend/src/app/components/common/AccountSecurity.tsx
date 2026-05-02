import React, { useState } from "react";
import Button from "../Core/ui/Button";
import { FiMail, FiLock, FiShield } from "react-icons/fi";
import makeCall from "../../API";
import apiRoutes from "../../API/apiRoutes";
import toast from "react-hot-toast";

export default function AccountSecurity() {
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Email state
  const [emailForm, setEmailForm] = useState({
    currentPassword: "",
    newEmail: "",
  });

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.currentPassword || !emailForm.newEmail) {
      toast.error("Please fill in all fields");
      return;
    }

    setEmailLoading(true);
    try {
      await makeCall({
        route: apiRoutes.updateMyEmail,
        method: "PATCH",
        isSecureRoute: true,
        body: {
          currentPassword: emailForm.currentPassword,
          newEmail: emailForm.newEmail,
        },
      });
      toast.success("Email updated successfully. Please use your new email next time you log in.");
      setEmailForm({ currentPassword: "", newEmail: "" });
    } catch (error: any) {
      toast.error(error?.message || "Failed to update email");
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }

    setPasswordLoading(true);
    try {
      await makeCall({
        route: apiRoutes.updateMyPassword,
        method: "PATCH",
        isSecureRoute: true,
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
      });
      toast.success("Password updated successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast.error(error?.message || "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Change Email Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <FiMail size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Change Email Address</h3>
            <p className="text-sm text-gray-500">Update your primary account email.</p>
          </div>
        </div>

        <form onSubmit={handleEmailChange} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">New Email Address</label>
            <input
              type="email"
              placeholder="Enter new email"
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary-light transition-all"
              value={emailForm.newEmail}
              onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Current Password</label>
            <input
              type="password"
              placeholder="Confirm with current password"
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary-light transition-all"
              value={emailForm.currentPassword}
              onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
            />
          </div>

          <Button type="submit" loading={emailLoading}>
            Update Email
          </Button>
        </form>
      </div>

      {/* Change Password Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <FiLock size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Change Password</h3>
            <p className="text-sm text-gray-500">Ensure your account is using a long, random password to stay secure.</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Current Password</label>
            <input
              type="password"
              placeholder="Current Password"
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary-light transition-all"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />
          </div>

          <div className="border-t border-gray-50 my-2"></div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">New Password</label>
            <input
              type="password"
              placeholder="New Password"
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary-light transition-all"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
            <p className="text-[10px] text-gray-400">Must be at least 8 characters.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Confirm New Password</label>
            <input
              type="password"
              placeholder="Confirm New Password"
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary-light transition-all"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </div>

          <Button type="submit" loading={passwordLoading}>
            Change Password
          </Button>
        </form>
      </div>

      {/* Account Deletion / Advanced Warning */}
      <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex items-start gap-4">
        <div className="p-2 bg-white text-red-600 rounded-lg shadow-sm">
          <FiShield size={20} />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-red-900">Security Recommendation</h4>
          <p className="text-sm text-red-700 leading-relaxed">
            We recommend changing your password regularly and ensuring it is unique to this service.
            If you suspect any unauthorized access, please update your credentials immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
