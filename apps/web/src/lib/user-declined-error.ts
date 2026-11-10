/** Rejects a mutation the user backed out of in a confirm prompt; nothing reports or toasts it. */
export class UserDeclinedError extends Error {
  constructor() {
    super("Declined");
    this.name = "UserDeclinedError";
  }
}
