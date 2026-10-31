"use client";

import React from "react";
import { Square, CheckSquare, MinusSquare } from "lucide-react";

export interface CheckboxProps {
  checked: boolean;
  onChange?: ((checked: boolean) => void) | (() => void);
  indeterminate?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  checkedColor?: string; // defaults to app brand accent "text-signal"
  uncheckedColor?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}

export default function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  className = "",
  title,
  disabled = false,
  checkedColor = "text-signal",
  uncheckedColor = "text-muted/50 group-hover:text-muted",
  label,
  description,
  children,
  size = "md",
  ariaLabel,
}: CheckboxProps) {
  const iconCls = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    (onChange as (val?: boolean) => void)(!checked);
  };

  const button = (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel || title || (typeof label === "string" ? label : undefined)}
      onClick={disabled ? undefined : handleClick}
      disabled={disabled}
      title={title}
      className={`p-1 rounded-md transition-all inline-flex items-center justify-center flex-none select-none ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "cursor-pointer hover:bg-well/80 active:scale-95"
      } ${className}`}
    >
      {checked ? (
        <CheckSquare className={`${checkedColor} ${iconCls} transition-transform duration-100`} />
      ) : indeterminate ? (
        <MinusSquare className={`${checkedColor} ${iconCls} transition-transform duration-100`} />
      ) : (
        <Square className={`${uncheckedColor} ${iconCls} transition-transform duration-100`} />
      )}
    </button>
  );

  const content = label || children;
  if (!content && !description) return button;

  return (
    <div
      onClick={disabled ? undefined : handleClick}
      className={`inline-flex items-start gap-2 cursor-pointer select-none group ${
        disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
      }`}
    >
      {button}
      <div className="flex flex-col pt-0.5">
        {content && (
          <span className="font-mono text-xs text-content group-hover:text-signal transition-colors leading-tight">
            {content}
          </span>
        )}
        {description && (
          <span className="font-sans text-[11px] text-muted leading-relaxed">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}

export { Checkbox };

