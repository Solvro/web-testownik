import { toast } from "sonner";

/**
 * Copying a link and confirming it. One seam so that surfaces which must not
 * touch the visitor's clipboard (the landing-page device previews) can swap
 * the whole action, confirmation included.
 */
export class ClipboardService {
  async copyLink(url: string): Promise<void> {
    await navigator.clipboard.writeText(url);
    toast.success("Skopiowano link do quizu");
  }
}
