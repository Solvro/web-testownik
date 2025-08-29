import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import axios from "axios";
import { SERVER_URL } from "../config.ts";
import { toast } from "react-toastify";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { MessageSquareWarningIcon } from "lucide-react";

interface ReportBugModalProps {
  show: boolean;
  onHide: () => void;
}

const DEFAULT_FORM_STATE = {
  name: "",
  email: "",
  title: "",
  content: "",
  sendDiagnostics: false,
  diagnostic: "",
  reportType: "bug",
};

const ReportBugModal: React.FC<ReportBugModalProps> = ({ show, onHide }) => {
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);

  const quizId = location.pathname.includes("quiz/")
    ? location.pathname.split("/").pop()
    : null;

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) errors.name = "Podaj swoje imię.";
    if (!form.title.trim()) errors.title = "Podaj tytuł zgłoszenia.";
    if (!form.content.trim()) errors.content = "Podaj treść zgłoszenia.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { id, value, type, checked } = e.target as HTMLInputElement;
    setForm((prev) => ({
      ...prev,
      [id]: type === "checkbox" ? checked : value,
    }));

    // Clear the error message for this field when user types
    setFormErrors((prev) => ({
      ...prev,
      [id]: "",
    }));
  };

  const handleSend = () => {
    setIsSending(true);

    if (!validateForm()) {
      setIsSending(false);
      return;
    }

    if (form.sendDiagnostics) {
      const diagnostics = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,

        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,

        quiz_id: quizId,

        location: window.location.href,
        localStorage: {
          user_id: localStorage.getItem("user_id"),
          is_guest: localStorage.getItem("is_guest"),
          is_authenticated: localStorage.getItem("access_token")
            ? "true"
            : "false",
          quiz_progress: quizId
            ? localStorage.getItem(`${quizId}_progress`)
            : null,
        },
        sessionStorage: JSON.stringify(sessionStorage),
      };
      form.diagnostic = JSON.stringify(diagnostics, null, 2);
    }

    axios
      .post(`${SERVER_URL}/feedback/send`, {
        ...form,
        sendDiagnostics: form.sendDiagnostics ? "true" : "false",
      })
      .then(() => {
        setForm(DEFAULT_FORM_STATE);
        onHide();
        toast.success("Dziękujemy za zgłoszenie!");
      })
      .catch((error) => {
        toast.error("Wystąpił błąd podczas wysyłania zgłoszenia!", {
          position: "top-center",
        });
        console.error(error);
      })
      .finally(() => {
        setIsSending(false);
      });
  };

  return (
    <Dialog
      open={show}
      onOpenChange={(open) => {
        if (!open) onHide();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zgłoszenie błędu lub sugestia</DialogTitle>
          <DialogDescription>
            Opisz problem lub propozycję ulepszenia
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {quizId && (
            <Alert variant="default">
              <AlertDescription className="space-y-1 text-sm">
                <span>
                  Ten formularz służy do zgłaszania błędów w aplikacji. Jeśli
                  chcesz zgłosić błąd w quizie, użyj przycisku
                  <MessageSquareWarningIcon className="mx-1 inline-block size-4 align-text-top" />
                  w interfejsie quizu.
                </span>
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Twoja nazwa
              </Label>
              <Input
                id="name"
                disabled={isSending}
                placeholder="Jan Kowalski"
                value={form.name}
                onChange={handleChange}
                aria-invalid={!!formErrors.name}
              />
              {formErrors.name && (
                <p className="text-destructive text-xs">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Adres e-mail (opcjonalnie)
              </Label>
              <Input
                id="email"
                disabled={isSending}
                placeholder="jan.kowalski@solvro.pl"
                value={form.email}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Tytuł
            </Label>
            <Input
              id="title"
              disabled={isSending}
              placeholder="Tytuł zgłoszenia"
              value={form.title}
              onChange={handleChange}
              aria-invalid={!!formErrors.title}
            />
            {formErrors.title && (
              <p className="text-destructive text-xs">{formErrors.title}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="content" className="text-sm font-medium">
              Treść
            </Label>
            <Textarea
              id="content"
              disabled={isSending}
              placeholder="Treść zgłoszenia"
              value={form.content}
              onChange={handleChange}
              aria-invalid={!!formErrors.content}
            />
            {formErrors.content && (
              <p className="text-destructive text-xs">{formErrors.content}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex h-fit items-center gap-3">
              <Checkbox
                id="sendDiagnostics"
                checked={form.sendDiagnostics}
                onCheckedChange={() => {
                  setForm((prev) => ({
                    ...prev,
                    sendDiagnostics: !prev.sendDiagnostics,
                  }));
                }}
                disabled={isSending}
              />
              <Label htmlFor="sendDiagnostics">Wyślij dane diagnostyczne</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportType" className="text-sm font-medium">
                Typ zgłoszenia
              </Label>
              <Select
                value={form.reportType}
                onValueChange={(value) => {
                  setForm((prev) => ({
                    ...prev,
                    reportType: value,
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Błąd</SelectItem>
                  <SelectItem value="enhancement">Propozycja</SelectItem>
                  <SelectItem value="question">Pytanie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="pt-6">
          <Button variant="outline" onClick={onHide}>
            Anuluj
          </Button>
          <Button disabled={isSending} onClick={handleSend}>
            Wyślij formularz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportBugModal;
