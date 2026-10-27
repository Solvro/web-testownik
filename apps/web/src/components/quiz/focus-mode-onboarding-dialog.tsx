import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEmbeddedSurface } from "@/components/ui/portal-container";

interface FocusModeOnboardingDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onConfirmAndHide: () => void;
}

function OnboardingCopy(): React.JSX.Element {
  return (
    <>
      Tryb skupienia to funkcja, która pomaga Ci skoncentrować się na quizie.
      <span className="mt-2 block">
        <strong>Jak to działa? </strong>
        Po włączeniu tego trybu, jeśli opuścisz tę kartę, przełączysz się do
        innego okna lub aplikacji albo nie wykonasz żadnej akcji przez 5 minut,
        timer zostanie automatycznie zatrzymany, a aplikacja odtworzy głośny
        dźwięk i pokaże powiadomienie przypominające o powrocie do nauki.
      </span>
      <span className="mt-2 block text-sm">
        Na niektórych urządzeniach i przeglądarkach, zwłaszcza na iPhonie i
        iPadzie, system może zablokować automatyczne odtworzenie dźwięku.
        Powiadomienie nadal się pokaże, ale dźwięk trybu skupienia może nie
        zawsze zadziałać.
      </span>
    </>
  );
}

const TITLE = "Czym jest tryb skupienia?";

/** Explains focus mode the first time it is switched on. */
export function FocusModeOnboardingDialog({
  open,
  onCancel,
  onConfirm,
  onConfirmAndHide,
}: FocusModeOnboardingDialogProps): React.JSX.Element {
  // Alert dialogs are always modal and lock the document's scroll. Inside an
  // embedded surface the dialog has to leave the page around it alone, so it
  // falls back to a plain dialog there.
  const embedded = useEmbeddedSurface() !== null;
  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      onCancel();
    }
  };

  if (embedded) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TITLE}</DialogTitle>
            <DialogDescription className="space-y-1 text-base">
              <OnboardingCopy />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={onConfirmAndHide}
              className="sm:mr-auto"
            >
              OK, nie pokazuj ponownie
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Anuluj
            </Button>
            <Button onClick={onConfirm}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{TITLE}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-1 text-base">
            <OnboardingCopy />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            variant="secondary"
            onClick={onConfirmAndHide}
            className="sm:mr-auto"
          >
            OK, nie pokazuj ponownie
          </AlertDialogAction>
          <AlertDialogCancel onClick={onCancel}>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
