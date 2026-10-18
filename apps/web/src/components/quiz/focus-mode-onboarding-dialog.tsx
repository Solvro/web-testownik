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

interface FocusModeOnboardingDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onConfirmAndHide: () => void;
}

/** Explains focus mode the first time it is switched on. */
export function FocusModeOnboardingDialog({
  open,
  onCancel,
  onConfirm,
  onConfirmAndHide,
}: FocusModeOnboardingDialogProps): React.JSX.Element {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Czym jest tryb skupienia?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-1 text-base">
            Tryb skupienia to funkcja, która pomaga Ci skoncentrować się na
            quizie.
            <span className="mt-2 block">
              <strong>Jak to działa? </strong>
              Po włączeniu tego trybu, jeśli opuścisz tę kartę, przełączysz się
              do innego okna lub aplikacji albo nie wykonasz żadnej akcji przez
              5 minut, timer zostanie automatycznie zatrzymany, a aplikacja
              odtworzy głośny dźwięk i pokaże powiadomienie przypominające o
              powrocie do nauki.
            </span>
            <span className="mt-2 block text-sm">
              Na niektórych urządzeniach i przeglądarkach, zwłaszcza na iPhonie
              i iPadzie, system może zablokować automatyczne odtworzenie
              dźwięku. Powiadomienie nadal się pokaże, ale dźwięk trybu
              skupienia może nie zawsze zadziałać.
            </span>
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
