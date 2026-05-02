import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Celebration } from "../../models/celebration";
import { triggerFireworks, triggerSideCannons } from "../../utils/confetti";
import { celebrationActions } from "../../slice/celebrationSlice";
import { selectAuthUser } from "../../slice/authSlice/selectors";

interface CelebrationOverlayProps {
  celebration: Celebration;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
  celebration,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentUser = useSelector(selectAuthUser);
  const user = currentUser as any;
  const currentEmployeeId =
    user?.employee_id?.toString() ||
    user?.employee?.id?.toString() ||
    user?.id?.toString() ||
    "";
  const isCurrentUser = currentEmployeeId === celebration.employeeId.toString();
  const firstName = celebration.employeeName.split(" ")[0];

  useEffect(() => {
    triggerSideCannons();
    if (isCurrentUser || celebration.type === "promotion") {
      triggerFireworks();
    }
  }, [isCurrentUser, celebration.type]);

  const handleDismiss = () => {
    dispatch(celebrationActions.dismissCelebrationRequest(celebration.id));
  };

  const handleSendWishes = () => {
    dispatch(celebrationActions.dismissCelebrationRequest(celebration.id));
    navigate(`/celebrations/${celebration.id}`);
  };

  const isBirthday = celebration.type === "birthday";
  const isPromotion = celebration.type === "promotion";
  const isAnniversary = celebration.type === "anniversary";

  // Personalized content
  const title = isCurrentUser
    ? isBirthday
      ? `Happy Birthday, ${firstName}!`
      : isPromotion
        ? `Congratulations, ${firstName}!`
        : `Happy Anniversary, ${firstName}!`
    : isBirthday
      ? `It's ${firstName}'s Birthday! 🎂`
      : isPromotion
        ? `${firstName} Got Promoted! 🚀`
        : `${firstName}'s Work Anniversary! 🎉`;

  const subtitle = isCurrentUser
    ? isBirthday
      ? "See what your team wished you today."
      : isPromotion
        ? `See your congratulations for ${celebration.details?.newPosition}.`
        : `See your anniversary wishes from the team.`
    : isBirthday
      ? `Send ${firstName} a birthday wish to brighten their day!`
      : isPromotion
        ? `${firstName} has been promoted to ${celebration.details?.newPosition}. Congratulate them!`
        : `Celebrate ${firstName}'s ${celebration.details?.yearsOfService} years of dedication!`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/60 backdrop-blur-md"
      style={{ animation: "fadeInUp 0.5s ease-out" }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bg-korange/10 rounded-full blur-[120px] top-[-10%] left-[10%] w-150 h-150"></div>
        <div className="absolute bg-kyellow/20 rounded-full blur-[80px] top-[10%] left-[20%] w-50 h-50"></div>
        <div className="absolute bg-korange/10 rounded-full blur-[140px] bottom-[-10%] right-[-5%] w-175 h-175"></div>
      </div>

      {/* Card Container */}
      <div className="relative z-10 w-full max-w-140 bg-white border border-gray-100 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)] rounded-2xl overflow-hidden">
        {/* Close Button */}
        <div className="flex justify-end p-4 pb-0">
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-korange transition-all p-2 rounded-full hover:bg-korange/10"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 px-8 pb-6 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-gray-900 text-4xl md:text-5xl font-black leading-tight tracking-[-0.033em]">
              <span className="text-transparent bg-clip-text bg-linear-to-r from-korange to-kyellow">
                {title}
              </span>
            </h1>
            <p className="text-gray-600 text-lg font-medium leading-normal">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Details Card */}
        {celebration.details && (
          <div className="px-8 py-2">
            <div className="flex items-stretch justify-between gap-5 rounded-xl bg-gray-50 border border-gray-100 p-5 transition-transform hover:scale-[1.01] cursor-default">
              <div className="flex flex-col gap-2 flex-[2_2_0px] justify-center">
                {isBirthday && celebration.details?.zodiacSign && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">✨</span>
                      <p className="text-korange text-sm font-bold uppercase tracking-widest">
                        {celebration.details?.zodiacSign}
                      </p>
                    </div>
                    <p className="text-gray-600 text-sm font-normal leading-relaxed">
                      {celebration.details?.horoscope ||
                        "Your ambition is your superpower today. The stars align for great success."}
                    </p>
                  </>
                )}
                {isPromotion && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🚀</span>
                      <p className="text-korange text-sm font-bold uppercase tracking-widest">
                        Promotion
                      </p>
                    </div>
                    <p className="text-gray-900 text-lg font-bold leading-relaxed">
                      {celebration.details?.previousPosition} →{" "}
                      <span className="text-korange">
                        {celebration.details?.newPosition}
                      </span>
                    </p>
                  </>
                )}
                {isAnniversary && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎉</span>
                      <p className="text-korange text-sm font-bold uppercase tracking-widest">
                        {celebration.details?.yearsOfService} Years
                      </p>
                    </div>
                    <p className="text-gray-600 text-sm font-normal leading-relaxed">
                      Celebrating years of dedication and excellence!
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 px-8 pt-8 pb-6">
          {!isCurrentUser && celebration.visibility === "public" ? (
            <>
              <button
                onClick={handleSendWishes}
                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-linear-to-r from-korange to-[#ff7a00] hover:brightness-110 text-white gap-3 shadow-lg shadow-korange/20 transition-all transform hover:-translate-y-0.5"
              >
                <span className="text-2xl">💌</span>
                <span className="text-lg font-bold tracking-wide">
                  Send Wishes to {firstName}
                </span>
              </button>
              <button
                onClick={handleDismiss}
                className="text-center text-xs font-medium text-gray-400 hover:text-korange transition-colors uppercase tracking-widest hover:underline underline-offset-4 cursor-pointer py-2"
              >
                Skip for now
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDismiss}
                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-linear-to-r from-korange to-[#ff7a00] hover:brightness-110 text-white gap-3 shadow-lg shadow-korange/20 transition-all transform hover:-translate-y-0.5"
              >
                <span className="text-2xl">🎁</span>
                <span className="text-lg font-bold tracking-wide">
                  See Wishes
                </span>
              </button>
              <button
                onClick={() => {
                  handleDismiss();
                  navigate(`/celebrations/${celebration.id}`);
                }}
                className="text-center text-xs font-medium text-gray-400 hover:text-korange transition-colors uppercase tracking-widest hover:underline underline-offset-4 cursor-pointer py-2"
              >
                View all wishes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
