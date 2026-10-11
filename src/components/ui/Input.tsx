import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-md border border-border bg-surface px-4 py-3 text-sm text-text shadow-sm outline-none transition-colors duration-200 focus:border-accent focus:ring-2 focus:ring-ring ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
