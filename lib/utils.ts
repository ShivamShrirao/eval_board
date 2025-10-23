export const cn = (...classes: Array<string | null | undefined | false>) =>
  classes.filter(Boolean).join(" ");
