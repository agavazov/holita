export function encodeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const encoded = typeof reader.result === 'string' ? reader.result.split(',')[1] : undefined;
      if (encoded) {
        resolve(encoded);
      } else {
        reject(new Error('Image could not be read'));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Image could not be read'));
    };
    reader.readAsDataURL(file);
  });
}
