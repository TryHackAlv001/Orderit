"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronDown, LoaderCircle, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import type { CartItem as CartItemType, ProductVariant } from "@/types";

type OptionField = "color" | "size";
type OptionChoice = { value: string | null; label: string };

interface CartItemProps {
  item: CartItemType;
  variants: ProductVariant[];
  unresolved: boolean;
  loading: boolean;
  stockLimit?: number;
  priceChanged: boolean;
  onVariantChange: (variant: ProductVariant) => void;
  onQuantityChange: (quantity: number) => void;
  onAcceptPrice: () => void;
}

const fieldLabels: Record<OptionField, string> = {
  color: "Color",
  size: "Size",
};

export function CartItem({
  item,
  variants,
  unresolved,
  loading,
  stockLimit,
  priceChanged,
  onVariantChange,
  onQuantityChange,
  onAcceptPrice,
}: CartItemProps) {
  const [activeField, setActiveField] = useState<OptionField | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const optionFields = useMemo(
    () => (["color", "size"] as const).filter((field) =>
      variants.some((variant) => variant[field] !== null),
    ),
    [variants],
  );
  const selectedVariant = variants.find((variant) => variant.id === item.variant_id);
  const selectedValues: Record<OptionField, string | null> = {
    color: selectedVariant ? selectedVariant.color : item.selected_color ?? null,
    size: selectedVariant ? selectedVariant.size : item.selected_size ?? null,
  };
  const choices = activeField
    ? Array.from(new Set(variants.map((variant) => variant[activeField]))).map((value) => ({
        value,
        label: value ?? `No ${fieldLabels[activeField].toLowerCase()}`,
      }))
    : [];

  useEffect(() => {
    if (!activeField) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveField(null);
      if (event.key !== "Tab") return;
      const buttons = sheetRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const firstButton = buttons[0];
      const lastButton = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        firstButton.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const frame = window.requestAnimationFrame(() => {
      const initialFocus = sheetRef.current?.querySelector<HTMLButtonElement>(
        "button:not(:disabled)[data-option-choice]",
      ) ?? sheetRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
      initialFocus?.focus();
    });
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(frame);
      triggerRef.current?.focus();
    };
  }, [activeField]);

  const chooseOption = (field: OptionField, value: string | null) => {
    const candidates = variants.filter(
      (variant) => variant[field] === value && variant.stock_quantity > 0,
    );
    if (!candidates.length) return;
    const otherFields = optionFields.filter((optionField) => optionField !== field);
    const variant = candidates.find((candidate) =>
      otherFields.every((optionField) => candidate[optionField] === selectedValues[optionField]),
    ) ?? candidates[0];
    setActiveField(null);
    onVariantChange(variant);
  };

  const subtotal = Number(item.price_at_add ?? item.product.price) * item.quantity;
  const selectedLabel = (field: OptionField) => {
    if (selectedValues[field] !== null) return selectedValues[field];
    return selectedVariant ? `No ${fieldLabels[field].toLowerCase()}` : "Choose";
  };
  const sheet = activeField && typeof document !== "undefined" ? createPortal(
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-black/60 pb-[calc(var(--bottom-nav-height)+var(--safe-bottom))] pt-[var(--safe-top)] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setActiveField(null);
      }}
    >
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-option-sheet-title"
        className="max-h-[calc(100dvh-var(--safe-top)-var(--bottom-nav-height)-var(--safe-bottom)-0.5rem)] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface px-4 pb-[calc(var(--safe-bottom)+1rem)] pt-5 text-text shadow-xl sm:max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-2rem)] sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="cart-option-sheet-title" className="text-lg font-semibold">
              Choose {fieldLabels[activeField].toLowerCase()}
            </h2>
            <p className="mt-1 break-words text-sm text-muted">{item.product.name}</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveField(null)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close option selector"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {choices.map((choice: OptionChoice) => {
            const available = variants.some(
              (variant) => variant[activeField] === choice.value && variant.stock_quantity > 0,
            );
            const selected = selectedValues[activeField] === choice.value;
            return (
              <button
                key={choice.value ?? "__none"}
                type="button"
                data-option-choice
                aria-pressed={selected}
                disabled={!available || loading}
                onClick={() => chooseOption(activeField, choice.value)}
                className={`flex min-h-14 min-w-0 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? "border-accent bg-accent/10 text-accent-text"
                    : "border-border bg-bg text-text"
                } disabled:cursor-not-allowed disabled:opacity-55`}
              >
                <span className="break-words">{choice.label}</span>
                {!available && <span className="mt-1 text-xs text-danger-text">Out of stock</span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <div className="min-w-0 p-4 transition-colors duration-200 hover:bg-surface-raised md:p-6">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:gap-6">
          <div className="flex min-w-0 gap-4 sm:flex-1">
            <div className="h-24 w-24 shrink-0 sm:h-[120px] sm:w-[120px]">
              {item.product.images?.[0] ? (
                <Image
                  src={item.product.images[0]}
                  alt={item.product.name}
                  width={120}
                  height={120}
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-md bg-surface-raised">
                  <ShoppingBag className="h-8 w-8 text-muted" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <h3 className="mb-1 line-clamp-2 break-words text-lg font-semibold text-text">
                  {item.product.name}
                </h3>
                {loading && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted" role="status">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </span>
                )}
              </div>
              <p className="mb-2 truncate text-sm text-muted" title={item.vendor?.shop_name || "Vendor Store"}>
                Sold by {item.vendor?.shop_name || "Vendor Store"}
              </p>
              {optionFields.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-2" aria-label="Product options">
                  {optionFields.map((field) => (
                    <button
                      key={field}
                      ref={activeField === field ? triggerRef : null}
                      type="button"
                      aria-expanded={activeField === field}
                      aria-haspopup="dialog"
                      disabled={loading}
                      onClick={(event) => {
                        triggerRef.current = event.currentTarget;
                        setActiveField(field);
                      }}
                      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    >
                      <span className="min-w-0 break-words">
                        <span className="font-semibold">{fieldLabels[field]}:</span>{" "}
                        {selectedLabel(field)}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : item.needs_selection ? (
                <p className="mt-2 text-sm font-semibold text-warning">Select options</p>
              ) : null}
              {unresolved && variants.length === 0 && (
                <p className="mt-2 text-sm text-danger-text">
                  Product options are no longer available. Remove this item and choose another product.
                </p>
              )}
              <p className="mb-4 mt-2 font-display text-xl font-bold text-accent-text">
                {unresolved
                  ? `From ₦${Number(item.product.price).toLocaleString()}`
                  : `₦${Number(item.price_at_add ?? item.product.price).toLocaleString()}`}
              </p>
              {priceChanged && (
                <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-text">
                  Price changed from ₦{Number(item.price_at_add).toLocaleString()} to ₦
                  {Number(item.product.price).toLocaleString()}.
                  <button
                    type="button"
                    onClick={onAcceptPrice}
                    className="ml-2 font-semibold text-accent-text underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Use new price
                  </button>
                </div>
              )}
              <div className="mt-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onQuantityChange(item.quantity - 1)}
                  disabled={loading}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface-raised text-text hover:border-accent hover:bg-accent/10 hover:text-accent-text disabled:opacity-50"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center font-semibold text-text" aria-label={`Quantity ${item.quantity}`}>
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(item.quantity + 1)}
                  disabled={loading || (stockLimit !== undefined && item.quantity >= stockLimit)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface-raised text-text hover:border-accent hover:bg-accent/10 hover:text-accent-text disabled:opacity-50"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 items-center justify-between sm:flex-col sm:items-end">
            <button
              type="button"
              onClick={() => onQuantityChange(0)}
              disabled={loading}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-danger-text hover:bg-danger/10 disabled:opacity-50"
              aria-label="Remove item"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="min-w-0 text-right">
              <p className="mb-1 text-sm text-muted">Subtotal</p>
              <p className="break-words font-display text-lg font-bold text-text sm:text-xl">
                {unresolved ? "—" : `₦${subtotal.toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>
      </div>
      {sheet}
    </>
  );
}
