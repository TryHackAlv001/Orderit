"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export default function DeliveryCodeBox({
  code,
  isUsed,
}: {
  code: string | null;
  isUsed: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
    }
  };

  // Show "Code already used" if delivery was completed
  if (isUsed) {
    return (
      <div className="mt-4 rounded-lg bg-accent/10 px-6 py-4">
        <p className="flex items-center gap-2 text-lg font-semibold text-accent-text">
          <span>✓</span> Code already used - Order delivered
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Button to reveal code */}
      <div className="mt-4">
        <Button
          onClick={() => setShowModal(true)}
          className="rounded-full bg-accent px-6 py-2 text-accent-on hover:bg-accent-hover"
        >
          🔐 Get Delivery Code
        </Button>
      </div>

      {/* Modal overlay */}
      {showModal && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-background/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-xl">
            {/* Code Display */}
            <div className="mb-8 rounded-lg bg-accent/10 p-6 text-center">
              <p className="mb-4 text-sm font-medium text-accent-text">Your Delivery Code</p>
              <p className="text-5xl font-bold tracking-widest text-accent-text">
                {code.split("").join(" ")}
              </p>
            </div>

            {/* Warning */}
            <div className="mb-6 rounded-lg bg-warning/10 p-4">
              <p className="text-sm font-medium text-text">
                ⚠️ Only share this when your rider arrives
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={copy}
                className="flex-1 rounded-full bg-accent px-4 py-2 text-accent-on hover:bg-accent-hover"
              >
                {copied ? "✓ Copied" : "📋 Copy Code"}
              </Button>
              <Button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-full border-2 border-border bg-surface px-4 py-2 text-text hover:bg-bg"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
