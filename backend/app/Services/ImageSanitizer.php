<?php

namespace App\Services;

use GdImage;
use Illuminate\Http\UploadedFile;

/**
 * Turns an uploaded photo into a fresh JPEG (A5): the original bytes are never stored or served.
 * Re-encoding drops EXIF (GPS location, device) and anything hidden after the image data.
 * Returns null when the file is not a decodable JPEG/PNG/WebP within the pixel limit.
 */
class ImageSanitizer
{
    /** Decoding cost is ~4 bytes per pixel; 16 MP keeps one decode well under the 128 MB memory limit. */
    public const MAX_PIXELS = 16_000_000;

    /** Long edge of the stored image: enough to read a part number on a nameplate. */
    public const MAX_EDGE = 2000;

    private const QUALITY = 82;

    /**
     * @return array{binary: string, width: int, height: int}|null
     */
    public function toJpeg(UploadedFile $file): ?array
    {
        $path = $file->getRealPath();
        if ($path === false) {
            return null;
        }

        // Header check first: refuses decompression bombs before any pixel is decoded.
        $info = @getimagesize($path);
        if ($info === false || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            return null;
        }
        if ($info[0] < 1 || $info[1] < 1 || $info[0] * $info[1] > self::MAX_PIXELS) {
            return null;
        }

        $contents = file_get_contents($path);
        $image = $contents === false ? false : @imagecreatefromstring($contents);
        if (! $image instanceof GdImage) {
            return null;
        }

        if ($info[2] === IMAGETYPE_JPEG) {
            $image = $this->applyExifOrientation($image, $path);
        }

        $image = $this->fitAndFlatten($image);

        ob_start();
        imagejpeg($image, null, self::QUALITY);
        $binary = (string) ob_get_clean();

        return ['binary' => $binary, 'width' => imagesx($image), 'height' => imagesy($image)];
    }

    /**
     * Phone photos are often stored sideways with an EXIF rotation flag; bake the rotation in,
     * since the flag itself is dropped on re-encode.
     */
    private function applyExifOrientation(GdImage $image, string $path): GdImage
    {
        $exif = function_exists('exif_read_data') ? @exif_read_data($path) : false;
        $angle = match (is_array($exif) ? ($exif['Orientation'] ?? 1) : 1) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };

        if ($angle === 0) {
            return $image;
        }

        $rotated = imagerotate($image, $angle, 0);

        return $rotated instanceof GdImage ? $rotated : $image;
    }

    /**
     * Downscale to MAX_EDGE and paint onto white (PNG/WebP transparency would turn black in JPEG).
     */
    private function fitAndFlatten(GdImage $image): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $scale = min(1, self::MAX_EDGE / max($width, $height));
        $newWidth = max(1, (int) round($width * $scale));
        $newHeight = max(1, (int) round($height * $scale));

        $canvas = imagecreatetruecolor($newWidth, $newHeight);
        imagefill($canvas, 0, 0, (int) imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled($canvas, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        return $canvas;
    }
}
