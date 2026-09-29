/** Distinguish React echoes of native typing from intentional external field updates. */
export class NativeTextBinding {
  private pending: string[] = [];

  typed(text: string) {
    this.pending.push(text);
  }

  shouldApply(value: string): boolean {
    const echo = this.pending.lastIndexOf(value);
    if (echo >= 0) {
      this.pending.splice(0, echo + 1);
      return false;
    }
    this.pending = [];
    return true;
  }
}
