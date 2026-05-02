import React from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Celebration } from "../../models/celebration";
import { celebrationActions } from "../../slice/celebrationSlice";
import { selectAuthUser } from "../../slice/authSlice/selectors";

interface CelebrationBannerProps {
  celebration: Celebration;
}

export const CelebrationBanner: React.FC<CelebrationBannerProps> = ({
  celebration,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectAuthUser);
  const user = currentUser as any;
  const currentEmployeeId =
    user?.employee_id?.toString() ||
    user?.employee?.id?.toString() ||
    user?.id?.toString() ||
    "";
  const isCurrentUser = currentEmployeeId === celebration.employeeId.toString();
  const firstName = celebration.employeeName.split(" ")[0];

  const handleSendWishes = () => {
    dispatch(celebrationActions.dismissCelebrationRequest(celebration.id));
    navigate(`/celebrations/${celebration.id}`);
  };

  const handleDismiss = () => {
    dispatch(celebrationActions.dismissCelebrationRequest(celebration.id));
  };

  const getIcon = () => {
    switch (celebration.type) {
      case "birthday":
        return "🎂";
      case "promotion":
        return "🚀";
      case "anniversary":
        return "🎉";
      default:
        return "🎊";
    }
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-100 w-full bg-white text-gray-900 shadow-xl border-b-4 border-korange"
      style={{ animation: "slideInDown 0.5s ease-out" }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Left Section: Icon + Message */}
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-full bg-linear-to-br from-kyellow to-korange flex items-center justify-center shadow-md shrink-0">
            <span className="text-2xl drop-shadow-sm">{getIcon()}</span>
          </div>
          <div className="flex flex-col">
            <p className="font-bold text-lg leading-tight text-gray-900 tracking-tight">
              {celebration.type === "birthday" && (
                <>
                  {isCurrentUser ? (
                    <>
                      Happy Birthday,{" "}
                      <span className="text-korange">{firstName}!</span> 🎂
                    </>
                  ) : (
                    <>
                      It's <span className="text-korange">{firstName}'s</span>{" "}
                      birthday!
                    </>
                  )}
                </>
              )}
              {celebration.type === "promotion" && (
                <>
                  {isCurrentUser ? (
                    <>
                      Congratulations,{" "}
                      <span className="text-korange">{firstName}!</span> You got
                      promoted! 🚀
                    </>
                  ) : (
                    <>
                      <span className="text-korange">{firstName}</span> got
                      promoted to {celebration.details?.newPosition}!
                    </>
                  )}
                </>
              )}
              {celebration.type === "anniversary" && (
                <>
                  {isCurrentUser ? (
                    <>
                      Happy Anniversary,{" "}
                      <span className="text-korange">{firstName}!</span> 🎉{" "}
                      {celebration.details?.yearsOfService} years!
                    </>
                  ) : (
                    <>
                      Celebrating{" "}
                      <span className="text-korange">
                        {celebration.details?.yearsOfService} years
                      </span>{" "}
                      with us!
                    </>
                  )}
                </>
              )}
              {!["birthday", "promotion", "anniversary"].includes(
                celebration.type,
              ) && <>Celebrating {celebration.employeeName}!</>}
            </p>
            {!isCurrentUser ? (
              <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-green-500"></span>
                Join {celebration.totalWishes || 0} others in sending wishes
              </p>
            ) : (
              <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-green-500"></span>
                Your team wants to celebrate with you!
              </p>
            )}
          </div>
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-3">
          {/* Only show Send Wishes for public celebrations */}
          {celebration.visibility === "public" && (
            <button
              onClick={handleSendWishes}
              className="bg-korange text-white hover:bg-[#cc4b00] hover:shadow-lg font-bold py-2.5 px-6 rounded-lg transition-all shadow-md active:scale-95"
            >
              {isCurrentUser ? "View Wishes" : "Send Wishes"}
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
            aria-label="Dismiss"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>
      </div>
    </div>
  );
};
