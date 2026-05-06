import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { MdSend, MdPerson, MdChatBubbleOutline } from "react-icons/md";
import { fetchSubmissionComments, postSubmissionComment } from "../../../../services/okr-execution.api";
import { SubmissionComment } from "../../../../../types/okr.types";
import { okrErrorMessage } from "../../../../utils/okrApi";
import ToastService from "../../../../../utils/ToastService";
import Button from "../../../../components/Core/ui/Button";

interface Props {
  submissionId: number;
  itemId: string;
  itemType: "MONTHLY_PLAN" | "WEEKLY_PLAN";
}

export default function CommentThread({ submissionId, itemId, itemType }: Props) {
  const [comments, setComments] = useState<SubmissionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const currentUser = useSelector((state: any) => state.auth?.user);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      // Actually the endpoint to fetch comments for a specific item might be different
      // Task 2 says: GET /okr/approvals/comments?plan_id=...&item_id=...&item_type=...
      // But we have fetchSubmissionComments(id) which gets all comments for the submission.
      // We'll filter them by item_id here for now.
      const allComments = await fetchSubmissionComments(String(submissionId));
      const filtered = allComments.filter(c => c.item_id === String(itemId) && c.item_type === itemType);
      setComments(filtered);
    } catch (e) {
      console.error(e);
      // Don't show toast for every thread if it fails, maybe just silently fail or show empty
    } finally {
      setLoading(false);
    }
  }, [submissionId, itemId, itemType]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const comment = await postSubmissionComment({
        submission_id: submissionId,
        item_id: String(itemId),
        item_type: itemType,
        comment: newComment.trim(),
      });
      setComments(prev => [...prev, comment]);
      setNewComment("");
    } catch (e) {
      ToastService.error(okrErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MdChatBubbleOutline className="text-slate-400" />
        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Discussion</h5>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-2">No comments yet. Start the conversation below.</p>
      ) : (
        <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {comments.map((comment) => {
            const isMe = String(comment.user_id) === String(currentUser?.id);
            return (
              <div 
                key={comment.id} 
                className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className="shrink-0">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-white shadow-sm">
                    {comment.user_avatar ? (
                      <img src={comment.user_avatar} alt={comment.user_name} className="w-full h-full object-cover" />
                    ) : (
                      <MdPerson className="text-slate-400" />
                    )}
                  </div>
                </div>
                <div className={`max-w-[80%] space-y-1 ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`p-3 rounded-2xl text-sm ${
                    isMe 
                      ? "bg-primary text-white rounded-tr-none" 
                      : "bg-white text-slate-700 border border-slate-100 shadow-sm rounded-tl-none"
                  }`}>
                    {comment.comment}
                  </div>
                  <div className={`flex items-center gap-2 px-1 text-[10px] text-slate-400 ${isMe ? "flex-row-reverse text-right" : ""}`}>
                    <span className="font-bold">{comment.user_name}</span>
                    <span>•</span>
                    <span>{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input 
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Type your feedback here..."
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          disabled={submitting}
        />
        <Button 
          type="submit" 
          variant="primary" 
          size="sm" 
          icon={MdSend} 
          disabled={!newComment.trim() || submitting}
          className="rounded-xl px-4"
        >
          {submitting ? "..." : "Send"}
        </Button>
      </form>
    </div>
  );
}
