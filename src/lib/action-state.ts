/** Result every server action returns to its form. */
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Changes on every submit so effects (toasts, resets) re-fire for identical results. */
  nonce?: number;
  data?: Record<string, unknown>;
};

export const initialState: ActionState = { ok: false };
