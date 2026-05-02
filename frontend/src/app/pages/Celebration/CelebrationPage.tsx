import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FaTelegramPlane, FaChevronLeft } from "react-icons/fa";
import { celebrationActions } from "../../slice/celebrationSlice";
import { selectCelebrationById } from "../../slice/celebrationSlice/selectors";
import { selectAuthUser } from "../../slice/authSlice/selectors";
import { RootState } from "../../../store/types/RootState";
import { Celebration } from "../../models/celebration";
import { triggerFireworks, triggerQuickBurst } from "../../utils/confetti";
import { formatDate } from "../../utils/dayjs-format";

const CelebrationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const celebration = useSelector((state: RootState) =>
    selectCelebrationById(id || "")(state),
  ) as Celebration | undefined;
  const currentUser = useSelector(selectAuthUser);

  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (id) {
      // Always fetch the full detail (includes messages)
      dispatch(celebrationActions.fetchCelebrationByIdRequest(id));
    }
  }, [id, dispatch]);

  const handleSendMessage = () => {
    if (newMessage.trim() && id) {
      dispatch(
        celebrationActions.sendMessageRequest({
          celebrationId: id,
          message: newMessage.trim(),
        }),
      );
      setNewMessage("");
      triggerQuickBurst();
    }
  };

  const handleReaction = (reaction: string) => {
    if (id) {
      dispatch(
        celebrationActions.sendReactionRequest({
          celebrationId: id,
          reaction,
        }),
      );
      triggerQuickBurst();
    }
  };

  if (!celebration) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading celebration...</p>
      </div>
    );
  }

  const isBirthday = celebration.type === "birthday";
  const isPromotion = celebration.type === "promotion";
  const isAnniversary = celebration.type === "anniversary";
  // Robust user check
  const user = currentUser as any;
  const userId = user?.id?.toString() || user?.employee_id?.toString() || "";
  const celebrationUserId = celebration.employeeId.toString();
  const isCurrentUser = userId === celebrationUserId;
  const firstName = celebration.employeeName.split(" ")[0];

  // Personalized headings
  const pageTitle = isCurrentUser
    ? isBirthday
      ? `Happy Birthday, ${firstName}! 🎂`
      : isPromotion
        ? `Congratulations, ${firstName}! 🚀`
        : `Happy Anniversary, ${firstName}! 🎉`
    : isBirthday
      ? `It's ${firstName}'s Birthday! 🎂`
      : isPromotion
        ? `${firstName} Got Promoted! 🚀`
        : `${firstName}'s Work Anniversary! 🎉`;

  const pageSubtitle = isCurrentUser
    ? isBirthday
      ? "See the birthday wishes your team sent you."
      : isPromotion
        ? `See your promotion wishes for ${celebration.details?.newPosition}.`
        : `See your anniversary wishes from the team.`
    : isBirthday
      ? `Send ${firstName} a wish to brighten their special day!`
      : isPromotion
        ? `${firstName} has been promoted to ${celebration.details?.newPosition}. Congratulate them!`
        : `Celebrate ${firstName}'s ${celebration.details?.yearsOfService} years of dedication!`;

  // Show both wishes AND reactions in the feed
  // Sort by created date descending if needed, but assuming backend sends them sorted
  const allMessages = celebration.messages || [];

  useEffect(() => {
    if (isCurrentUser) {
      triggerFireworks();
    }
  }, [isCurrentUser, celebration.id]);

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Subject Floating Info */}
      {isCurrentUser && (
        <div className="fixed top-20 right-4 z-90 bg-linear-to-r from-korange to-kyellow text-white px-4 py-3 rounded-lg shadow-xl border border-white/20 animate-bounce">
          <p className="font-bold text-sm">🎉 Check out your team's wishes!</p>
        </div>
      )}

      {/* Decorative confetti elements */}
      <div className="fixed top-[20%] -left-2 w-3 h-3 bg-kyellow rotate-12 rounded-sm opacity-50"></div>
      <div className="fixed top-[35%] left-4 w-2 h-4 bg-korange/60 -rotate-12 rounded-full opacity-50"></div>
      <div className="fixed top-[15%] -right-2 w-4 h-4 bg-korange rotate-30 rounded-sm opacity-50"></div>

      <div className="max-w-300 mx-auto px-4 md:px-8 lg:px-10 py-8 lg:py-12">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 group"
        >
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-korange/20 group-hover:border-korange group-hover:text-korange transition-colors text-gray-600">
            <FaChevronLeft className="text-xs" />
          </div>
          <span className="text-sm font-bold text-gray-600 group-hover:text-korange transition-colors">
            Back
          </span>
        </button>

        {/* Page Heading */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10 border-b-2 border-korange/20 dark:border-korange/30 pb-8">
          <div className="flex flex-col gap-2">
            <span className="text-korange font-bold tracking-wider text-xs uppercase bg-korange/10 w-fit px-3 py-1 rounded-full">
              {isBirthday && "Birthday Celebration"}
              {isPromotion && "Promotion Celebration"}
              {isAnniversary && "Anniversary Celebration"}
            </span>
            <h1 className="text-gray-900 text-4xl lg:text-5xl font-black leading-tight tracking-[-0.033em]">
              {pageTitle}
            </h1>
            <p className="text-gray-600 text-lg font-normal leading-normal max-w-2xl">
              {pageSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-lg">👥</span>
            <span>{celebration.totalWishes || 0} Messages</span>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: Messages Feed */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <h2 className="text-gray-900 tracking-tight text-2xl font-bold leading-tight flex items-center gap-2">
              Messages from the Team
              {allMessages.length > 0 && (
                <span className="text-sm font-medium bg-korange/10 text-korange px-2 py-1 rounded-full">
                  {allMessages.length}
                </span>
              )}
            </h2>

            <div className="flex flex-col gap-4">
              {allMessages.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-korange/10 shadow-sm">
                  <p className="text-4xl mb-3">💌</p>
                  <p className="text-gray-500 font-medium">
                    {isCurrentUser
                      ? "No wishes yet — your team will send them soon!"
                      : `Be the first to send ${firstName} a wish!`}
                  </p>
                </div>
              ) : (
                allMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="group flex flex-col sm:flex-row gap-5 bg-white p-6 rounded-xl shadow-sm border border-korange/10 hover:shadow-md hover:border-korange/30 transition-all relative overflow-hidden"
                  >
                    <div className="shrink-0">
                      <div className="bg-korange/20 rounded-full h-15 w-15 flex items-center justify-center text-2xl ring-4 ring-white">
                        {msg.senderAvatar ? (
                          <img
                            src={msg.senderAvatar}
                            alt={msg.senderName}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          msg.senderName.charAt(0)
                        )}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col justify-center gap-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-gray-900 text-base font-bold">
                            {msg.senderName}
                          </h3>
                          <span className="text-gray-600 text-xs font-medium">
                            {msg.senderPosition}
                          </span>
                        </div>
                      </div>

                      {/* Show reaction or message content */}
                      {msg.isReaction ? (
                        <div className="mt-1">
                          <span className="text-4xl animate-bounce inline-block">
                            {msg.message}
                          </span>
                        </div>
                      ) : (
                        <p className="text-gray-700 text-base font-medium leading-relaxed">
                          {msg.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Send Message Section */}
            <div className="bg-white p-6 rounded-xl border border-korange/10 mt-6 shadow-sm">
              <h3 className="text-lg font-bold mb-4 text-gray-900">
                {isCurrentUser
                  ? "Reply to your team"
                  : `Send Your Wishes to ${firstName}`}
              </h3>

              {/* Quick Reactions */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => handleReaction("🎂")}
                  className="group flex items-center gap-2 px-3 py-2 bg-linear-to-r from-kyellow/10 to-korange/10 border border-korange/20 rounded-full hover:border-korange hover:from-kyellow/20 hover:to-korange/20 transition-all shadow-sm"
                >
                  <span className="text-lg group-hover:scale-125 transition-transform duration-200">
                    🎂
                  </span>
                  <span className="text-xs font-bold text-gray-700 group-hover:text-korange">
                    Cake
                  </span>
                </button>
                <button
                  onClick={() => handleReaction("🎆")}
                  className="group flex items-center gap-2 px-3 py-2 bg-linear-to-r from-kyellow/10 to-korange/10 border border-korange/20 rounded-full hover:border-korange hover:from-kyellow/20 hover:to-korange/20 transition-all shadow-sm"
                >
                  <span className="text-lg group-hover:scale-125 transition-transform duration-200">
                    🎆
                  </span>
                  <span className="text-xs font-bold text-gray-700 group-hover:text-korange">
                    Firework
                  </span>
                </button>
                <button
                  onClick={() => handleReaction("👏")}
                  className="group flex items-center gap-2 px-3 py-2 bg-linear-to-r from-kyellow/10 to-korange/10 border border-korange/20 rounded-full hover:border-korange hover:from-kyellow/20 hover:to-korange/20 transition-all shadow-sm"
                >
                  <span className="text-lg group-hover:scale-125 transition-transform duration-200">
                    👏
                  </span>
                  <span className="text-xs font-bold text-gray-700 group-hover:text-korange">
                    Clap
                  </span>
                </button>
              </div>

              {/* Text Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder={
                    isCurrentUser
                      ? "Say thanks to your team..."
                      : `Wish ${firstName} a happy ${isBirthday ? "birthday" : isPromotion ? "promotion" : "anniversary"}...`
                  }
                  className="flex-1 px-4 py-3 bg-white border border-korange/20 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-korange/20 focus:border-korange transition-all"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="p-3 bg-korange hover:brightness-110 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-12 h-12 shadow-md"
                >
                  <FaTelegramPlane className="text-xl" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Milestones Sidebar */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 flex flex-col gap-6">
              <h2 className="text-gray-900 tracking-tight text-2xl font-bold leading-tight">
                Milestones
              </h2>

              {/* Zodiac/Horoscope for Birthday */}
              {isBirthday && celebration.details?.zodiacSign && (
                <div className="bg-white rounded-xl p-6 lg:p-8 shadow-sm border border-korange/10">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">
                        Horoscope
                      </p>
                      <h3 className="text-2xl font-black text-gray-900 mt-1">
                        {celebration.details.zodiacSign}
                      </h3>
                    </div>
                    <div className="size-14 rounded-full bg-linear-to-br from-kyellow to-korange/50 text-white flex items-center justify-center shadow-md">
                      <span className="text-3xl">☀️</span>
                    </div>
                  </div>
                  <hr className="border-korange/10 mb-4" />
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {celebration.details.horoscope ||
                      "This year brings exciting opportunities. Your creativity and leadership will shine!"}
                  </p>
                </div>
              )}

              {/* Promotion Spotlight */}
              {isPromotion && (
                <div className="bg-linear-to-br from-kyellow/20 via-white to-korange/20 rounded-xl p-6 lg:p-8 shadow-sm border border-korange/20">
                  <div className="flex flex-col gap-4 text-center items-center">
                    <div className="size-16 rounded-full bg-linear-to-tr from-kyellow to-korange shadow-lg flex items-center justify-center text-white mb-2">
                      <span className="text-3xl">🏆</span>
                    </div>
                    <div>
                      <p className="text-korange font-bold text-xs uppercase tracking-widest mb-1">
                        Promotion
                      </p>
                      <h3 className="text-xl font-black text-gray-900">
                        {celebration.details?.newPosition}
                      </h3>
                      <p className="text-gray-600 text-sm font-medium mt-1">
                        Effective {formatDate(celebration.celebrationDate)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Like/Wish Stats */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-korange/10">
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <p className="text-3xl font-black text-korange">
                      {celebration.totalLikes || 0}
                    </p>
                    <p className="text-xs text-gray-600 uppercase tracking-wider">
                      Reactions
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-black text-korange">
                      {allMessages.length || 0}
                    </p>
                    <p className="text-xs text-gray-600 uppercase tracking-wider">
                      Wishes
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CelebrationPage;
