const DEFAULT_PASSWORD = "briaeval";
const DEFAULT_SECRET = "eval-board-default-cookie-secret";

export const AUTH_COOKIE_NAME = "eb_auth";
export const AUTH_HEADER_NAME = "x-eval-board-password";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const getPassword = () => process.env.EVAL_BOARD_PASSWORD?.trim() || DEFAULT_PASSWORD;
const getSecret = () => process.env.AUTH_COOKIE_SECRET?.trim() || DEFAULT_SECRET;

const encoder = new TextEncoder();

export const computeAuthToken = async (password: string = getPassword()): Promise<string> => {
  const data = encoder.encode(`${getSecret()}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const safeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

export const isValidAuthToken = async (token: string | undefined | null): Promise<boolean> => {
  if (!token) {
    return false;
  }
  const expected = await computeAuthToken();
  return safeCompare(token, expected);
};

export const isValidPassword = (password: string): boolean => {
  return safeCompare(password, getPassword());
};
