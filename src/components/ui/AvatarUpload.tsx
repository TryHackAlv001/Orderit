"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AvatarUploadProps {
  value?: string;
  onChange: (url: string) => void;
  folderPath?: string;
}

export function AvatarUpload({
  value,
  onChange,
  folderPath = "logos",
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const uploadToSupabase = async (file: File): Promise<string> => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("File size exceeds 5MB limit");
    }

    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
    const filePath = `${folderPath}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicData } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return publicData?.publicUrl || "";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size exceeds 5MB limit");
      return;
    }

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    // Upload file
    setIsUploading(true);
    try {
      const url = await uploadToSupabase(file);
      setPreview(url);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(value);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(undefined);
    onChange("");
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        disabled={isUploading}
        className="hidden"
      />

      <div
        onClick={handleClick}
        className={`relative flex h-32 w-32 items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
          isUploading
            ? "border-border bg-surface-raised"
            : "border-border bg-bg hover:border-muted"
        } ${isUploading ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Avatar preview"
              className="h-full w-full rounded-lg object-cover"
            />
            {!isUploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute -right-2 -top-2 rounded-full bg-danger p-1 text-accent-on transition-colors duration-200 hover:brightness-95"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <div className="text-center">
            {isUploading ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" />
            ) : (
              <>
                <Upload className="mx-auto h-6 w-6 text-muted" />
                <p className="mt-1 text-xs font-medium text-muted">Upload image</p>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-xs text-danger-text">
          {error}
        </div>
      )}
    </div>
  );
}
