import { SendIcon, Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getQuizService } from "@/services";
import type { CommentItem } from "@/services/types";

interface QuizCommentsSectionProps {
  quizId: string;
  questionId?: string;
  isOpen: boolean;
}

export function QuizCommentsSection({
  quizId,
  questionId,
  isOpen,
}: QuizCommentsSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getQuizService().getComments(quizId, questionId);
      setComments(data);
      setHasLoaded(true);
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast.error("Wystąpił błąd podczas pobierania komentarzy.");
    } finally {
      setLoading(false);
    }
  }, [quizId, questionId]);

  if (isOpen && !hasLoaded && !loading) {
    void fetchComments();
  }

  const handlePostComment = async () => {
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
    return questionId === undefined
      ? comment.question === null
      : comment.question === questionId;
  });

  if (!isOpen) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {questionId === undefined
            ? "Komentarze do quizu"
            : "Dyskusja do pytania"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {loading && !hasLoaded ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Ładowanie komentarzy...
            </p>
          ) : filteredComments.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Brak komentarzy.
            </p>
          ) : (
            filteredComments.map((comment) => (
              <div
                key={comment.id}
                className="bg-muted/30 rounded-lg border p-3 text-sm"
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
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-6 w-6"
                        onClick={() => {
                          void handleDeleteComment(comment.id);
                        }}
                        aria-label="Usuń komentarz"
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap">
                  {comment.is_deleted ? (
                    <span className="text-muted-foreground italic">
                      Komentarz został usunięty.
                    </span>
                  ) : (
                    comment.content
                  )}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label htmlFor="inline-comment-textarea" className="text-xs">
            Napisz komentarz
          </Label>
          <div className="flex gap-2">
            <Textarea
              id="inline-comment-textarea"
              rows={2}
              value={newContent}
              onChange={(event_) => {
                setNewContent(event_.target.value);
              }}
              onKeyDown={(event_) => {
                event_.stopPropagation();
              }}
              placeholder={
                questionId === undefined
                  ? "Podziel się opinią o quizie..."
                  : "Skomentuj to pytanie..."
              }
            />
            <Button
              type="button"
              onClick={() => {
                void handlePostComment();
              }}
              disabled={isSubmitting || !newContent.trim()}
            >
              {isSubmitting ? "..." : <SendIcon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
