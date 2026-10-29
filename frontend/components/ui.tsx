'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons';

/**
 * GitGrill UI primitives.
 *
 * A small, dependency-free component kit that replaces native controls
 * (`<select>`, `<input type="checkbox">`) with consistent, accessible,
 * theme-aware implementations. Every primitive is styled exclusively with
 * semantic tokens (`card`, `well`, `edge`, `muted`, `content`, `signal`)
 * so light and dark mode stay perfectly in sync.
 */

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

/* ==========================================================================
   Select — custom dropdown (portal, keyboard nav, type-ahead)
   ========================================================================== */

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
  ariaLabel?: string;
  zIndex?: number;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  align = 'left',
  ariaLabel,
  zIndex = 250,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    width: number;
    dropUp: boolean;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const listId = useId();

  useEffect(() => setMounted(true), []);

  const selected = options.find((o) => o.value === value);

  const position = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const dropUp = spaceBelow < 240 && spaceAbove > spaceBelow;

    // Boundary clamping
    const alignRight = align === 'right' || r.left + r.width > window.innerWidth - 20;
    const left = alignRight ? undefined : Math.max(12, r.left);
    const right = alignRight ? Math.max(12, window.innerWidth - r.right) : undefined;

    if (dropUp) {
      setCoords({
        bottom: window.innerHeight - r.top + 6,
        top: undefined,
        left,
        right,
        width: r.width,
        dropUp: true,
      });
    } else {
      setCoords({
        top: r.bottom + 6,
        bottom: undefined,
        left,
        right,
        width: r.width,
        dropUp: false,
      });
    }
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    position();
    const onScroll = () => position();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, position]);

  // Close on outside pointerdown
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (
        !triggerRef.current?.contains(t) &&
        !listRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (!open || highlight < 0) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const openMenu = () => {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const commit = (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openMenu();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) {
          const idx = options.findIndex((o) => o.value === value);
          setHighlight(idx >= 0 ? idx : options.length - 1);
          setOpen(true);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlight((h) => Math.min(options.length - 1, h + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlight >= 0) commit(highlight);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-card px-2.5 py-1.5 font-mono text-xs text-content shadow-xs outline-none transition-colors
          hover:border-signal/50 focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/20
          disabled:cursor-not-allowed disabled:opacity-50
          ${open ? 'border-signal ring-2 ring-signal/20' : 'border-edge'}
          ${buttonClassName}`}
      >
        <span className={`min-w-0 truncate ${selected ? '' : 'text-muted'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon.ChevronDown
          className={`h-3.5 w-3.5 flex-none text-muted transition-transform duration-150 ${open ? 'rotate-180 text-signal' : ''}`}
        />
      </button>

      {open && mounted && coords
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              onKeyDown={onListKeyDown}
              style={{
                position: 'fixed',
                top: coords.top !== undefined ? coords.top : undefined,
                bottom: coords.bottom !== undefined ? coords.bottom : undefined,
                left: coords.left !== undefined ? coords.left : undefined,
                right: coords.right !== undefined ? coords.right : undefined,
                minWidth: coords.width,
                zIndex,
              }}
              className={`max-h-72 overflow-y-auto rounded-xl border border-edge bg-card p-1 shadow-pop thin-scroll animate-in ${menuClassName}`}
            >
              {options.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlight;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-index={idx}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => commit(idx)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left font-mono text-xs transition-colors
                      ${isSelected ? 'text-signal font-semibold' : isHighlighted ? 'bg-well text-content' : 'text-content'}
                      ${opt.description ? 'items-start' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="mt-0.5 block truncate font-sans text-[10px] text-muted">
                          {opt.description}
                        </span>
                      )}
                    </span>
                    {isSelected && <Icon.Check className="h-3.5 w-3.5 flex-none text-signal" />}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

/* ==========================================================================
   Checkbox — premium square check with motion
   ========================================================================== */

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
  ariaLabel,
}: CheckboxProps) {
  const button = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border transition-all duration-150 outline-none cursor-pointer
        focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-1 focus-visible:ring-offset-card
        disabled:cursor-not-allowed disabled:opacity-40
        ${
          checked
            ? 'border-signal bg-signal text-white shadow-xs'
            : 'border-edge bg-card hover:border-signal/60'
        } ${className}`}
    >
      <Icon.Check
        className={`h-3 w-3 text-white transition-all duration-150 ${checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
        strokeWidth={3}
      />
    </button>
  );

  if (!label) return button;

  return (
    <label
      onClick={(e) => {
        if (!disabled) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      }`}
    >
      {button}
      <span className="font-mono text-xs text-content">{label}</span>
    </label>
  );
}

/* ==========================================================================
   Tooltip — sleek floating context popover
   ========================================================================== */

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'center' | 'start' | 'end';
  className?: string;
  delay?: number;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  align = 'center',
  className = '',
  delay = 150,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [computedAlign, setComputedAlign] = useState<'center' | 'start' | 'end'>(align);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setComputedAlign(align);
  }, [align]);

  useEffect(() => {
    if (visible && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const margin = 16;
      if (rect.right > window.innerWidth - margin) {
        setComputedAlign('end');
      } else if (rect.left < margin) {
        setComputedAlign('start');
      }
    }
  }, [visible]);

  let positionClass = '';
  if (position === 'top') {
    if (computedAlign === 'end') {
      positionClass = 'bottom-full right-0 mb-2';
    } else if (computedAlign === 'start') {
      positionClass = 'bottom-full left-0 mb-2';
    } else {
      positionClass = 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  } else if (position === 'bottom') {
    if (computedAlign === 'end') {
      positionClass = 'top-full right-0 mt-2';
    } else if (computedAlign === 'start') {
      positionClass = 'top-full left-0 mt-2';
    } else {
      positionClass = 'top-full left-1/2 -translate-x-1/2 mt-2';
    }
  } else if (position === 'left') {
    positionClass = 'right-full top-1/2 -translate-y-1/2 mr-2';
  } else if (position === 'right') {
    positionClass = 'left-full top-1/2 -translate-y-1/2 ml-2';
  }

  return (
    <div
      className={`relative inline-flex items-center ${visible ? 'z-50' : ''}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && content && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`pointer-events-none absolute z-[120] whitespace-nowrap rounded-lg border border-edge bg-card px-2.5 py-1 font-mono text-[11px] font-medium text-content shadow-pop animate-in fade-in-0 zoom-in-95 duration-150 ${positionClass} ${className}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Switch — settings toggle
   ========================================================================== */

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function Switch({ checked, onChange, disabled = false, ariaLabel, className = '' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[20px] w-[36px] flex-none items-center rounded-full border transition-colors duration-200 outline-none
        focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-1 focus-visible:ring-offset-card
        disabled:cursor-not-allowed disabled:opacity-40
        ${checked ? 'border-signal bg-signal' : 'border-edge bg-well'} ${className}`}
    >
      <span
        className={`inline-block h-[14px] w-[14px] transform rounded-full bg-card shadow-sm transition-transform duration-200
          ${checked ? 'translate-x-[19px] bg-[#0c0b0e]' : 'translate-x-[2px] bg-muted'}`}
      />
    </button>
  );
}

/* ==========================================================================
   StarRating — precise SVG star rating input
   ========================================================================== */

export function StarRating({
  value,
  onChange,
  size = 'sm',
  className = '',
}: {
  value: number;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [hover, setHover] = useState(0);
  const interactive = !!onChange;
  const display = hover || value;
  const px = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      onMouseLeave={() => interactive && setHover(0)}
      role={interactive ? 'radiogroup' : undefined}
      aria-label={interactive ? 'Rating' : undefined}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = display >= star;
        const IconCmp = filled ? Icon.Star : Icon.StarOutline;
        const starBtn = (
          <IconCmp
            className={`${px} transition-colors duration-100 ${
              filled ? 'text-signal' : 'text-muted/40'
            }`}
          />
        );
        if (!interactive) return <span key={star}>{starBtn}</span>;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            onClick={() => onChange(value === star ? 0 : star)}
            onMouseEnter={() => setHover(star)}
            className="rounded-sm p-px outline-none transition-transform duration-100 hover:scale-110 focus-visible:ring-2 focus-visible:ring-signal/40"
          >
            {starBtn}
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   SearchInput — bordered search field with icon + clear affordance
   ========================================================================== */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  inputClassName = '',
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border border-edge bg-card px-2.5 shadow-xs transition-colors focus-within:border-signal/70 focus-within:ring-2 focus-within:ring-signal/15 ${className}`}
    >
      <Icon.Search className="h-3.5 w-3.5 flex-none text-muted" />
      <input
        type="text"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-transparent py-1.5 font-mono text-xs text-content outline-none placeholder:text-muted/60 ${inputClassName}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="flex-none rounded p-0.5 text-muted transition-colors hover:text-signal"
        >
          <Icon.X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ==========================================================================
   SegmentedTabs — filter pill row (active uses solid brand accent)
   ========================================================================== */

export function SegmentedTabs({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: { value: string; label: string; count?: number }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 font-mono text-xs ${className}`}>
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-pressed={isActive}
            className={`rounded-lg px-2.5 py-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-signal/40 ${
              isActive
                ? 'bg-signal font-bold text-white shadow-xs'
                : 'bg-well text-muted hover:text-content'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && ` (${tab.count})`}
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   ConfirmModal — sleek, accessible, theme-aware confirmation dialog
   ========================================================================== */

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmButtonClassName?: string;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  confirmButtonClassName = '',
  isLoading = false,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-edge bg-card p-6 shadow-2xl transition-all duration-200 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 flex-none items-center justify-center rounded-2xl border ${
              isDanger
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-500'
                : isWarning
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                : 'border-signal/30 bg-signal/10 text-signal'
            }`}
          >
            {isDanger || isWarning ? (
              <Icon.Alert className="h-5 w-5" />
            ) : (
              <Icon.Info className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              id="confirm-modal-title"
              className="font-mono text-base font-bold text-content tracking-tight"
            >
              {title}
            </h3>
            <div className="mt-2 font-sans text-xs text-muted leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-edge">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="rounded-xl border border-edge bg-well px-4 py-2 font-mono text-xs font-semibold text-content hover:border-signal/40 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`rounded-xl px-4 py-2 font-mono text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : isWarning
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-signal hover:bg-signal/90 text-white'
            } ${confirmButtonClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ==========================================================================
   AlertModal — sleek informational alert modal replacing window.alert
   ========================================================================== */

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  actionLabel?: string;
  variant?: 'info' | 'warning' | 'error' | 'success';
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  description,
  actionLabel = 'Got it',
  variant = 'info',
}: AlertModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 flex-none items-center justify-center rounded-2xl border ${
              variant === 'error'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-500'
                : variant === 'warning'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                : variant === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                : 'border-signal/30 bg-signal/10 text-signal'
            }`}
          >
            {variant === 'error' || variant === 'warning' ? (
              <Icon.Alert className="h-5 w-5" />
            ) : variant === 'success' ? (
              <Icon.CheckCircle className="h-5 w-5" />
            ) : (
              <Icon.Info className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-mono text-base font-bold text-content tracking-tight">
              {title}
            </h3>
            <div className="mt-2 font-sans text-xs text-muted leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end pt-3 border-t border-edge">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ==========================================================================
   FormField, TextInput, TextArea — premium input components
   ========================================================================== */

export function FormField({
  label,
  badge,
  hint,
  error,
  children,
  className = '',
}: {
  label: string;
  badge?: React.ReactNode;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
          {label}
        </label>
        {badge}
      </div>
      {children}
      {hint && !error && (
        <p className="font-sans text-[10px] text-muted leading-tight">{hint}</p>
      )}
      {error && (
        <p className="font-mono text-[10px] font-bold text-rose-500 leading-tight flex items-center gap-1">
          <Icon.Alert className="h-3 w-3" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  required = false,
  className = '',
  mono = false,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={`w-full rounded-xl border border-edge bg-well px-3.5 py-2 text-xs text-content outline-none transition-all duration-150 focus:border-signal focus:ring-2 focus:ring-signal/15 disabled:cursor-not-allowed disabled:opacity-40 placeholder:text-muted/60 ${
        mono ? 'font-mono' : 'font-sans'
      } ${className}`}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
  required = false,
  className = '',
  mono = false,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  mono?: boolean;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={`w-full rounded-xl border border-edge bg-well px-3.5 py-2 text-xs text-content outline-none transition-all duration-150 focus:border-signal focus:ring-2 focus:ring-signal/15 disabled:cursor-not-allowed disabled:opacity-40 placeholder:text-muted/60 resize-y ${
        mono ? 'font-mono' : 'font-sans leading-relaxed'
      } ${className}`}
    />
  );
}
