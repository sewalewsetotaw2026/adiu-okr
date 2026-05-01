import React, { useRef, useState, useEffect } from "react";
import Button from "../../Core/ui/Button";
import { FiTrash2 } from "react-icons/fi";
import { MdCheck } from "react-icons/md";
import toast from "react-hot-toast";

interface StepSignatureProps {
  formData: {
    signature?: string; // URL string
  };
  handleChange: (field: string, value: any) => void;
  errors?: Record<string, string>;
}

export default function StepSignature({
  formData,
  handleChange,
  errors = {},
}: StepSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    // If we have a saved signature URL, we can't easily put it back on the canvas to edit.
    // Instead we should show the image and a "Retake" button.
    // implementing that logic separately.
  }, [formData.signature]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };


  const getCoordinates = (
    e: React.MouseEvent | React.TouchEvent,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ((e as React.TouchEvent).touches) {
      clientX = (e as React.TouchEvent).touches[0].clientX;
      clientY = (e as React.TouchEvent).touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
    };
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // If there was a saved one, we might want to clear it from formData too
      handleChange("signature", null);
    }
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trim the canvas
    const trimmedCanvas = trimCanvas(canvas);

    // Convert to file
    trimmedCanvas.toBlob(async (blob) => {
      if (blob) {
        setUploading(true);
        setUploadError(null);
        try {
          const file = new File([blob], "signature.png", { type: "image/png" });
          const { uploadFile } = await import("../../../services/fileUploadService");
          const url = await uploadFile(file);

          handleChange("signature", url);
          toast.success("Signature saved temporarily");
        } catch (error: any) {
          console.error("Signature upload failed", error);
          setUploadError(error.message || "Failed to upload signature");
          toast.error("Failed to save signature");
        } finally {
          setUploading(false);
        }
      }
    }, "image/png");
  };

  // Listen for mouseup outside
  useEffect(() => {
    const handleUp = () => setIsDrawing(false);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchend', handleUp);
    return () => {
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchend', handleUp);
    };
  }, []);


  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          Please sign below using your mouse or touch screen.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        {formData.signature ? (
          <div className="border border-gray-300 rounded-lg p-2 bg-white">
            <img src={formData.signature} alt="Signature" className="max-w-full h-auto" />
            <Button variant="secondary" onClick={() => handleChange("signature", null)} className="mt-2 w-full">
              Redraw Signature
            </Button>
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              width={500}
              height={200}
              className="border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none cursor-crosshair w-full max-w-[600px] bg-slate-50"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              // onMouseUp={stopDrawing} // Handled by global listener
              // onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
            // onTouchEnd={stopDrawing}
            />

            {errors.signature && (
              <p className="text-red-500 text-sm">{errors.signature}</p>
            )}

            <div className="flex gap-4">
              <Button variant="secondary" onClick={clearSignature} icon={FiTrash2}>
                Clear
              </Button>
              <Button
                variant="primary"
                onClick={saveSignature}
                icon={MdCheck}
                disabled={uploading}
                loading={uploading}
              >
                Save & Confirm
              </Button>
            </div>
            {uploadError && <p className="text-red-500 text-sm">{uploadError}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// Helper function to trim empty white/transparent space from canvas
const trimCanvas = (c: HTMLCanvasElement) => {
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const width = c.width;
  const height = c.height;

  // Get image data
  const pixels = ctx.getImageData(0, 0, width, height);
  const l = pixels.data.length;
  const bound = {
    top: -1,
    left: -1,
    right: -1,
    bottom: -1
  };

  // Iterate over every pixel to find the bounds
  let x, y;
  for (let i = 0; i < l; i += 4) {
    // Check if alpha is not 0
    if (pixels.data[i + 3] !== 0) {
      x = (i / 4) % width;
      y = Math.floor((i / 4) / width);

      if (bound.top === -1) {
        bound.top = y;
      }

      if (bound.left === -1) {
        bound.left = x;
      } else if (x < bound.left) {
        bound.left = x;
      }

      if (bound.right === -1) {
        bound.right = x;
      } else if (bound.right < x) {
        bound.right = x;
      }

      if (bound.bottom === -1) {
        bound.bottom = y;
      } else if (bound.bottom < y) {
        bound.bottom = y;
      }
    }
  }

  // If no pixels found, return original
  if (bound.top === -1) return c;

  // Add padding
  const padding = 10;
  const trimWidth = bound.right - bound.left + (padding * 2);
  const trimHeight = bound.bottom - bound.top + (padding * 2);

  const trimmed = document.createElement('canvas');
  trimmed.width = trimWidth;
  trimmed.height = trimHeight;
  const trimmedCtx = trimmed.getContext('2d');

  if (!trimmedCtx) return c;

  // Draw the cut image to the new canvas
  trimmedCtx.drawImage(
    c,
    bound.left, bound.top, bound.right - bound.left + 1, bound.bottom - bound.top + 1,
    padding, padding, bound.right - bound.left + 1, bound.bottom - bound.top + 1
  );

  return trimmed;
};
