export function cn(...args) {
  const classes = [];

  args.forEach((arg) => {
    if (!arg) return;

    if (typeof arg === "string") {
      classes.push(arg);
      return;
    }

    if (Array.isArray(arg)) {
      arg.forEach((entry) => {
        if (entry) classes.push(entry);
      });
      return;
    }

    if (typeof arg === "object") {
      Object.entries(arg).forEach(([key, value]) => {
        if (value) classes.push(key);
      });
    }
  });

  return classes.join(" ");
}
