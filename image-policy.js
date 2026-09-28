(function exposeImagePolicy(root, factory) {
  const policy = factory();
  if (typeof module === "object" && module.exports) module.exports = policy;
  root.HovaLettImagePolicy = policy;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  const MAX_IMAGES = 3;
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_MIME_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
  const ALLOWED_EXTENSIONS = Object.freeze(["jpg", "jpeg", "png", "webp"]);

  function extensionOf(name) {
    const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function detectImageMime(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
      && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
    if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
    return null;
  }

  function validateMetadata(file) {
    if (!file) return "Hiányzó fájl.";
    if (file.size > MAX_FILE_SIZE) return `Egy kép legfeljebb ${MAX_FILE_SIZE / 1024 / 1024} MB lehet.`;
    if (!ALLOWED_MIME_TYPES.includes(String(file.type || "").toLowerCase())) return "Nem engedélyezett kép MIME-típus.";
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) return "Nem engedélyezett képkiterjesztés.";
    return null;
  }

  async function validateImageFile(file) {
    const metadataError = validateMetadata(file);
    if (metadataError) throw new Error(metadataError);
    const signatureMime = detectImageMime(await file.slice(0, 16).arrayBuffer());
    if (!signatureMime || signatureMime !== file.type.toLowerCase()) {
      throw new Error("A fájl tartalma nem egyezik a megadott képformátummal.");
    }
    // A szignatúra mellett a böngésző dekóderével is ellenőrizzük a teljes fájlt.
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file).catch(() => null);
      if (!bitmap) throw new Error("A kép sérült vagy nem dekódolható.");
      bitmap.close();
    } else if (typeof Image === "function" && typeof URL?.createObjectURL === "function") {
      const objectUrl = URL.createObjectURL(file);
      const decoded = await new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
        image.onerror = () => resolve(false);
        image.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);
      if (!decoded) throw new Error("A kép sérült vagy nem dekódolható.");
    }
    return true;
  }

  function assertImageCount(files, existingCount = 0) {
    if (existingCount + Array.from(files || []).length > MAX_IMAGES) {
      throw new Error(`Bejelentésenként legfeljebb ${MAX_IMAGES} kép tölthető fel.`);
    }
    return true;
  }

  return { MAX_IMAGES, MAX_FILE_SIZE, ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, extensionOf, detectImageMime, validateMetadata, validateImageFile, assertImageCount };
});
