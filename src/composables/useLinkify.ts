/**
 * Converts text containing URLs into clickable links or displays image URLs as images.
 * @param text The input string potentially containing URLs.
 * @returns A string with URLs replaced by HTML <a> tags or <img> tags for images.
 */
export default function linkify(text: string): string {
  // Regex to find URLs. It captures http, https, and www. followed by non-whitespace characters.
  const urlRegex = /((https?:\/\/|www\.)[^\s]+)/g;

  // Regex to check for common image file extensions before query parameters or fragments (case-insensitive)
  // This regex looks for the extension followed by an optional query string (?...) or fragment (#...) before the end of the string.
  const imageExtensionRegex = /\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?(#.*)?$/i;

  return text.replace(urlRegex, (url) => {
      // Ensure the URL has a protocol for the href attribute
      const href = url.startsWith('http') ? url : `https://${url}`;

      // Check if the URL ends with a common image extension (ignoring query params/fragments)
      if (imageExtensionRegex.test(url)) {
          // If it's likely an image URL, return an <img> tag
          // Added basic styling and alt text for accessibility
          return `<img src="${href}" alt="Linked Image" class="max-w-40 inline-block h-auto rounded-md shadow-sm my-2" />`;
      } else {
          // If it's not an image URL, return a standard <a> tag
          return `<a href="${href}" target="_blank" class="text-blue-500 underline break-all">${url}</a>`;
      }
  });
}
