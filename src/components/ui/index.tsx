// Minimal shadcn/ui-style primitives (same API shape, so real shadcn components can drop in later).
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/format";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-slate-800",
        brand: "bg-brand text-white hover:bg-teal-800",
        outline: "border border-line bg-surface hover:bg-slate-50",
        ghost: "hover:bg-slate-100",
      },
      size: { sm: "h-8 px-2.5", md: "h-9 px-3.5", icon: "h-8 w-8" },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>>(
  ({ className, variant, size, ...p }, ref) => <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...p} />,
);

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)} {...p} />
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input
    ref={ref}
    className={cn("h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20", className)}
    {...p}
  />
));

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", {
  variants: {
    tone: {
      neutral: "bg-slate-100 text-slate-600",
      red: "bg-red-50 text-red-700",
      amber: "bg-amber-50 text-amber-700",
      green: "bg-green-50 text-green-700",
      brand: "bg-brand-soft text-teal-800",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export const Badge = ({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) => (
  <span className={cn(badgeVariants({ tone }), className)} {...p} />
);
