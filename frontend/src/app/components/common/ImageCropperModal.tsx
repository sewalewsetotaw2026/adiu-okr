import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "../../utils/imageUtils";
import { FiX, FiCheck, FiZoomIn, FiZoomOut } from "react-icons/fi";

interface ImageCropperModalProps {
  image: string;
  onCropComplete: (croppedImage: File) => void;
  onCancel: () => void;
  aspect?: number;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  image,
  onCropComplete,
  onCancel,
  aspect = 1,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteInternal = useCallback(
    (_croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    try {
      setProcessing(true);
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      if (croppedImage) {
        onCropComplete(croppedImage);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Crop Logo</h3>
            <p className="text-xs text-gray-500">Drag to position or use zoom</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper Area */}
        <div className="relative h-[400px] bg-gray-50">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={onZoomChange}
            classes={{
              containerClassName: "rounded-lg",
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-4 bg-white space-y-4">
          <div className="flex items-center space-x-4">
            <FiZoomOut className="text-gray-400" />
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="flex-1 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <FiZoomIn className="text-gray-400" />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={onCancel}
              className="px-6 py-2 text-gray-700 bg-gray-100 font-medium rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={processing}
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center relative overflow-hidden"
            >
              {processing && <div className="absolute inset-0 shimmer-bg opacity-30" />}
              <FiCheck className={`mr-2 ${processing ? "opacity-0" : ""}`} />
              <span className={processing ? "opacity-0" : ""}>
                Apply Crop
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
