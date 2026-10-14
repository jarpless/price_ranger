"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

import { PendingLink } from "@/components/pending-link";
import { FORM_ERRORS } from "@/lib/form";

const field =
  "w-full rounded-2xl border border-line bg-paper px-4 text-base text-ink outline-none focus:border-pine";

const variants = {
  primary: "bg-pine text-cream hover:bg-pine-deep",
  secondary: "border border-line bg-paper text-ink hover:border-pine hover:bg-cream",
  ghost: "bg-transparent text-pine hover:bg-cream",
  danger: "bg-transparent text-danger hover:bg-[#f8e8e4]",
};

const sizes = {
  md: "h-12 w-full whitespace-nowrap text-base lg:w-auto lg:min-w-48 lg:px-6",
  sm: "h-10 w-auto whitespace-nowrap px-3 text-sm",
};

export function SubmitButton({
  pendingLabel = "Working…",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending: formPending } = useFormStatus();
  const pending = formPending && props.type !== "button";
  return (
    <button
      {...props}
      aria-busy={pending || undefined}
      disabled={pending || props.disabled}
      className={`disabled:opacity-60 ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  pendingLabel?: string;
}) {
  return (
    <SubmitButton
      {...props}
      data-haptic={variant === "primary" ? "" : undefined}
      className={`inline-flex items-center justify-center rounded-2xl px-4 font-semibold ${variants[variant]} ${sizes[size]} ${className}`}
    />
  );
}

export function TextField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = props.id || props.name;
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input id={id} {...props} className={`${field} h-12`} />
    </label>
  );
}

export function TextArea({
  label,
  ...props
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = props.id || props.name;
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea id={id} {...props} className={`${field} min-h-28 py-3 leading-relaxed`} />
    </label>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = props.id || props.name;
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <select id={id} {...props} className={`${field} h-12`}>
        {children}
      </select>
    </label>
  );
}

export function Notice({ code, detail }: { code?: string; detail?: string }) {
  const message = detail?.trim() || (code ? FORM_ERRORS[code] : "");
  if (!message) return null;
  return (
    <p role="alert" className="rounded-2xl bg-[#f8e8e4] px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <PendingLink href={href} className="mb-3 inline-flex text-sm font-semibold text-pine">
      ← {children}
    </PendingLink>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`surface ${className}`}>
      {children}
    </section>
  );
}
