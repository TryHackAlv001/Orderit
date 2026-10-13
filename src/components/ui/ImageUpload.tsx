'use client';

import Image from "next/image";
import { useState, useRef, useCallback, useEffect } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  // optional path prefix inside the bucket (e.g. 'logos/' or 'banners/')
  pathPrefix?: string;
}

export function ImageUpload({ value, onChange, maxImages = 5, pathPrefix }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    if (file.size > 5 * 1024 * 1024) throw new Error("File size exceeds 5MB");
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const ext = extensions[file.type];
    if (!ext) throw new Error("Only JPG, PNG, and WEBP images are allowed");
    const prefix = pathPrefix ?? 'products/';
    const fileName = `${prefix}${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}.${ext}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
    return data.publicUrl;
  }, [pathPrefix]);

  const handleFiles = useCallback(async (files: FileList) => {
    if (value.length >= maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }
    const toUpload = Array.from(files).slice(0, maxImages - value.length);
    const unsupportedFile = toUpload.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (unsupportedFile) {
      setError("Only JPG, PNG, and WEBP images are allowed");
      return;
    }
    if (toUpload.some((file) => file.size > 5 * 1024 * 1024)) {
      setError("Each image must be 5MB or smaller");
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      const urls = await Promise.all(toUpload.map(uploadFile));
      onChange([...value, ...urls]);
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [value, onChange, maxImages, uploadFile]);

  const removeImage = useCallback((index: number) => {
    onChange(value.filter((_, i) => i !== index));
  }, [value, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 transition-colors duration-200 ${
          isDragging ? "border-accent bg-accent/10" : "border-border hover:border-accent hover:bg-surface-raised"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-muted">
            <Loader2 className="h-8 w-8 animate-spin text-accent-text" />
            <p className="text-sm">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted">
            <Upload className="h-8 w-8" />
            <p className="text-sm font-medium">Click to upload or drag images here</p>
            <p className="text-xs">JPG, PNG, WEBP up to 5MB — max {maxImages} images</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-sm text-danger-text">{error}</p>}

      {/* Previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {value.map((url, index) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-md border border-border">
              <Image
                src={url}
                alt={`Product ${index + 1}`}
                fill
                unoptimized
                sizes="(max-width: 640px) 33vw, 20vw"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute right-1 top-1 rounded-full bg-danger p-0.5 text-accent-on transition-colors duration-200 hover:brightness-95"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
