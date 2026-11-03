import { SendIcon, Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getQuizService } from "@/services";

export interface CommentItem {
  id: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
  author: {
    id: string;
    email?: string;
  } | null;
  quiz: string;
  question: string | null;
  parent: string | null;
  replies?: CommentItem[];
}

interface QuizCommentsDialogProps {
  children: React.ReactElement;
  quizId: string;
  questionId?: string;
}

export function QuizCommentsDialog({
  children,
  quizId,
  questionId,
}: QuizCommentsDialogProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getQuizService().getComments(quizId, questionId);
      setComments(data);
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast.error("Wystąpił błąd podczas pobierania komentarzy.");
    } finally {
      setLoading(false);
    }
  }, [quizId, questionId]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      void fetchComments();
    }
  };

  const handlePostComments = async () => {
    if (!newContent.trim()) {
      toast.error("Treść komentarza nie może być pusta.");
      return;
    }
    setIsSubmitting(true);
    try {
      await getQuizService().createComment({
        quiz: quizId,
        question: questionId,
        content: newContent.trim(),
      });
      setNewContent("");
      toast.success("Komentarz został dodany.");
      await fetchComments();
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Wystąpił błąd podczas dodawania komentarza.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await getQuizService().deleteComment(commentId);
      toast.success("Komentarz został usunięty.");
      await fetchComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Wystąpił błąd podczas usuwania komentarza.");
    }
  };

  const filteredComments = comments.filter((comment) => {
    if (questionId !== undefined) {
      return comment.question === questionId;
    }
    return comment.question === null;
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children}></DialogTrigger>
      <DialogContent
        onKeyDown={(event_) => {
          event_.stopPropagation();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {questionId === undefined
              ? "Komentarze do quizu"
              : "Dyskusja do pytania"}
          </DialogTitle>
        </DialogHeader>
        <div className="my-4 max-h-[40vh] min-h-[200px] flex-1 space-y-4 overflow-y-auto pr-2">
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">
              Ładowanie komentarzy...
            </p>
          ) : filteredComments.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              Brak komentarzy.
            </p>
          ) : (
            filteredComments.map((comment) => (
              <div
                key={comment.id}
                className="bg-card text-card-foreground rounded-lg border p-3"
              >
                <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {comment.author?.email ?? "Użytkownik"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                    {!comment.is_deleted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-6 w-6"
                        onClick={async () => handleDeleteComment(comment.id)}
                        aria-label="Usuń komentarz"
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">
                  {comment.is_deleted ? (
                    <span className="text-muted-foreground italic">
                      Komentarz został usunięty
                    </span>
                  ) : (
                    comment.content
                  )}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="space-y-2 border-t pt-2">
          <Label htmlFor="new-comment-textarea">Napisz komentarz</Label>
          <div className="flex gap-2">
            <Textarea
              id="new-comment-textarea"
              rows={2}
              value={newContent}
              onChange={(event_) => {
                setNewContent(event_.target.value);
              }}
              placeholder="Podziel się swoją opinią..."
            />
            <Button
              onClick={handlePostComments}
              disabled={isSubmitting || !newContent.trim()}
            >
              {isSubmitting ? "Wysyłanie..." : <SendIcon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline">Anuluj</Button>}
          ></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
