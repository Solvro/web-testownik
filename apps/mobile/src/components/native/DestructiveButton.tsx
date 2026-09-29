import { Button } from "../ui";

export interface DestructiveButtonProps {
  children: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
}

/** The final, irreversible action of a flow. Android fills it in the error colour. */
export default function DestructiveButton(props: DestructiveButtonProps) {
  return <Button kind="danger" {...props} />;
}
