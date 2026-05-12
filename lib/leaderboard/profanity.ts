// Client-side profanity gate. The server runs the same check as a defense
// in depth — see supabase/schema.sql. Keep this list in sync if you edit
// either side.

const BLOCKLIST = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "dick",
  "cunt",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "slut",
  "whore",
  "rape",
  "bastard",
  "nazi",
  "pussy",
];

// Substring match, case-insensitive.
export function isProfane(name: string): boolean {
  const n = name.toLowerCase();
  return BLOCKLIST.some((w) => n.includes(w));
}

export const NAME_RULES = {
  min: 3,
  max: 16,
  /** Letters, digits, underscore, dash. */
  charset: /^[A-Za-z0-9_-]+$/,
};

export type NameValidation =
  | { ok: true }
  | { ok: false; reason: "length" | "charset" | "profanity" };

export function validateName(raw: string): NameValidation {
  const name = raw.trim();
  if (name.length < NAME_RULES.min || name.length > NAME_RULES.max) {
    return { ok: false, reason: "length" };
  }
  if (!NAME_RULES.charset.test(name)) {
    return { ok: false, reason: "charset" };
  }
  if (isProfane(name)) {
    return { ok: false, reason: "profanity" };
  }
  return { ok: true };
}

export function nameValidationMessage(v: NameValidation): string | null {
  if (v.ok) return null;
  switch (v.reason) {
    case "length":
      return `name must be ${NAME_RULES.min}–${NAME_RULES.max} characters`;
    case "charset":
      return "letters, digits, underscore and dash only";
    case "profanity":
      return "please pick a different name";
  }
}
