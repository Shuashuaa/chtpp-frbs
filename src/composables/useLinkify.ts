/**
 * Converts text containing URLs into clickable links or displays image URLs/Base64 strings as images.
 * @param text The input string potentially containing URLs or Base64 image data.
 * @returns A string with URLs replaced by HTML <a> tags or <img> tags for images.
 */
// export default function linkify(text: string): string {
//     // Regex to find URLs (http, https, www.) and also data:image/base64 strings.
//     // The data:image regex is more specific to capture valid base64 patterns.
//     const urlOrBase64Regex = /(https?:\/\/[^\s]+|www\.[^\s]+|data:image\/(jpeg|png|gif|bmp|svg|webp);base64,[a-zA-Z0-9+/=]+)/g;

//     // Regex to check for common image file extensions (before query parameters or fragments)
//     // This is for traditional URLs.
//     const imageExtensionRegex = /\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?(#.*)?$/i;

//     return text.replace(urlOrBase64Regex, (match) => {
//         // Check if the match is a Base64 image string
//         if (match.startsWith('data:image/')) {
//             // If it's a Base64 string, directly use it as the src
//             return `<img src="${match}" alt="Base64 Image" class="max-w-40 inline-block h-auto rounded-md shadow-sm my-2" />`;
//         } else {
//             // Handle traditional URLs
//             const href = match.startsWith('http') ? match : `https://${match}`;

//             if (imageExtensionRegex.test(match)) {
//                 // If it's likely an image URL, return an <img> tag
//                 return `<img src="${href}" alt="Linked Image" class="max-w-40 inline-block h-auto rounded-md shadow-sm my-2" />`;
//             } else {
//                 // If it's not an image URL, return a standard <a> tag
//                 return `<a href="${href}" target="_blank" class="text-blue-500 underline break-all">${match}</a>`;
//             }
//         }
//     });
// }

export default function linkify(text: string): string {
    // Regex to find URLs (http, https, www.) and also data:image/base64 strings.
    // The data:image regex is more specific to capture valid base64 patterns.
    const urlOrBase64Regex = /(https?:\/\/[^\s]+|www\.[^\s]+|data:image\/(jpeg|png|gif|bmp|svg|webp);base64,[a-zA-Z0-9+/=]+)/g;

    // Regex to check for common image file extensions (before query parameters or fragments)
    const imageExtensionRegex = /\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?(#.*)?$/i;

    return text.replace(urlOrBase64Regex, (match) => {
        // Ensure URLs have a protocol for proper linking
        const href = match.startsWith('http') || match.startsWith('data:image/') ? match : `https://${match}`;

        // Check if the match is a Base64 image string OR a traditional image URL
        if (match.startsWith('data:image/') || imageExtensionRegex.test(match)) {
            // For images, embed a small preview image directly and add a data attribute for the full source.
            // Add a class that we can easily target for click events.
            return `
                <img
                    src="${href}"
                    alt="Image"
                    class="chat-image-preview max-w-40 h-auto rounded-md shadow-sm my-2 cursor-pointer"
                    data-image-src="${href}"
                />
            `;
        } else {
            // For non-image URLs, return a standard <a> tag
            return `<a href="${href}" target="_blank" class="text-blue-500 underline break-all">${match}</a>`;
        }
    });
}