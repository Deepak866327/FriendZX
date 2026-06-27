import React, { useCallback, useRef, useState } from 'react';
import { Upload, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { uploadFile, MediaItem, UploadProgress } from '@/services/mediaService';

const ACCEPTED_IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEOS = ['video/mp4', 'video/mov', 'video/webm', 'video/quicktime'];
const ACCEPTED = [...ACCEPTED_IMAGES, ...ACCEPTED_VIDEOS];
const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_VIDEO = 200 * 1024 * 1024;
const MAX_FILES = 10;

export interface PendingMedia {
  file:      File;
  preview:   string;
  mediaItem: MediaItem | null;
  progress:  number;
  error:     string | null;
  uploading: boolean;
  done:      boolean;
}

interface Props {
  onMediaReady: (items: MediaItem[]) => void;
  maxFiles?:    number;
  accept?:      'images' | 'videos' | 'both';
}

export const MediaUpload: React.FC<Props> = ({
  onMediaReady,
  maxFiles = MAX_FILES,
  accept   = 'both',
}) => {
  const [pending,  setPending]  = useState<PendingMedia[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = accept === 'images' ? ACCEPTED_IMAGES
                      : accept === 'videos' ? ACCEPTED_VIDEOS
                      : ACCEPTED;

  const validate = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) return `Unsupported format: ${file.type}`;
    if (file.type.startsWith('image/') && file.size > MAX_IMAGE) return 'Image exceeds 20 MB';
    if (file.type.startsWith('video/') && file.size > MAX_VIDEO) return 'Video exceeds 200 MB';
    return null;
  };

  const processFiles = useCallback(async (files: File[]) => {
    const available = maxFiles - pending.length;
    const toProcess = files.slice(0, available);
    if (!toProcess.length) return;

    const newPending: PendingMedia[] = toProcess.map(file => ({
      file, preview: URL.createObjectURL(file),
      mediaItem: null, progress: 0, error: validate(file),
      uploading: false, done: false,
    }));

    setPending(prev => [...prev, ...newPending]);

    for (let i = 0; i < toProcess.length; i++) {
      const file  = toProcess[i];
      const error = validate(file);
      if (error) continue;
      const idx = pending.length + i;
      setPending(prev => prev.map((p, j) => j === idx ? { ...p, uploading: true } : p));
      try {
        const mediaItem = await uploadFile(file, (prog: UploadProgress) => {
          setPending(prev => prev.map((p, j) => j === idx ? { ...p, progress: prog.percent } : p));
        });
        setPending(prev => {
          const next = prev.map((p, j) => j === idx ? { ...p, mediaItem, uploading: false, done: true, progress: 100 } : p);
          onMediaReady(next.filter(p => p.done && p.mediaItem).map(p => p.mediaItem!));
          return next;
        });
      } catch (err: any) {
        setPending(prev => prev.map((p, j) => j === idx ? { ...p, uploading: false, error: err.message } : p));
      }
    }
  }, [pending, maxFiles, onMediaReady]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const remove = (idx: number) => {
    setPending(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      const next = prev.filter((_, i) => i !== idx);
      onMediaReady(next.filter(p => p.done && p.mediaItem).map(p => p.mediaItem!));
      return next;
    });
  };

  const hintText =
    accept === 'both'   ? 'Images (JPG, PNG, WebP) · Videos (MP4, MOV, WebM)' :
    accept === 'images' ? 'JPG, PNG, WebP — max 20 MB each' :
                          'MP4, MOV, WebM — max 200 MB each';

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {pending.length < maxFiles && (
        <div
          className={`relative flex flex-col items-center gap-2.5 px-5 py-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
            dragging
              ? 'border-indigo-400 bg-indigo-50/60'
              : 'border-indigo-200/70 bg-indigo-50/30 hover:border-indigo-300 hover:bg-indigo-50/50'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef} type="file" hidden multiple
            accept={acceptedTypes.join(',')} onChange={onInput}
          />
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-indigo-100' : 'bg-indigo-50'}`}>
            <Upload size={22} className="text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-indigo-600">
              Drag & drop or <span className="underline underline-offset-2">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{hintText}</p>
            {maxFiles > 1 && <p className="text-xs text-slate-400 mt-0.5">Up to {maxFiles} files</p>}
          </div>
        </div>
      )}

      {/* Previews */}
      {pending.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {pending.map((item, i) => (
            <div
              key={i}
              className={`relative rounded-xl overflow-hidden bg-slate-100 aspect-square ${item.error ? 'ring-2 ring-rose-400' : ''}`}
            >
              {item.file.type.startsWith('video/')
                ? <video src={item.preview} className="w-full h-full object-cover" muted />
                : <img src={item.preview} className="w-full h-full object-cover" alt="" />
              }

              {/* Upload progress overlay */}
              {item.uploading && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1.5 px-2">
                  <div className="w-full h-1.5 rounded-full bg-white/30 overflow-hidden">
                    <div className="h-full bg-indigo-400 transition-all duration-300" style={{ width: `${item.progress}%` }} />
                  </div>
                  <span className="text-white text-[10px] font-semibold">{item.progress}%</span>
                </div>
              )}

              {/* Done badge */}
              {item.done && !item.uploading && (
                <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 size={12} className="text-white" />
                </div>
              )}

              {/* Error badge */}
              {item.error && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-2 text-center">
                  <AlertCircle size={16} className="text-rose-400 mb-1" />
                  <p className="text-[10px] text-rose-300 leading-tight">{item.error}</p>
                </div>
              )}

              {/* Remove button */}
              <button
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors disabled:opacity-40"
                onClick={e => { e.stopPropagation(); remove(i); }}
                disabled={item.uploading}
                aria-label="Remove"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
