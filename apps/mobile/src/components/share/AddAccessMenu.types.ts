export interface AddAccessMenuProps {
  name: string;
  busy: boolean;
  disabled: boolean;
  add: (role: "study" | "edit") => void;
}
