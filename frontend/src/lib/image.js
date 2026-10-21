// Recipe photos are stored as data URLs, so large camera photos are scaled
// down in the browser before upload. Any input size is accepted.
const MAX_DIMENSION = 1600;
const QUALITY = 0.85;

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('This image format could not be read. Try a JPG, PNG or WEBP file.'));
  img.src = src;
});

export async function readImageFile(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    // JPEG has no alpha; fill white so transparent PNGs don't turn black
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
