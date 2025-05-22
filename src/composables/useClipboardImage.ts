// composables/useClipboardImage.ts
import { ref } from 'vue';

export function useClipboardImage() {
    const imageUrl = ref<string | null>(null);
    const shortenedImageUrl = ref<string | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // Modified to accept a ClipboardEvent, which will be provided by the paste handler
    const processClipboardImage = async (event: ClipboardEvent) => {
        isLoading.value = true;
        error.value = null;
        imageUrl.value = null;
        shortenedImageUrl.value = null;

        try {
            const clipboardItems = event.clipboardData?.items || [];
            let imageBlob: Blob | null = null;

            for (const item of clipboardItems) {
                if (item.type.indexOf('image') !== -1) {
                imageBlob = item.getAsFile();
                break;
                }
            }

            if (imageBlob) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    imageUrl.value = event.target?.result as string;
                    shortenedImageUrl.value = (event.target?.result as string).substring(0, 50) + '...';
                    isLoading.value = false;
                };
                reader.onerror = () => {
                    error.value = 'Failed to read image file.';
                    isLoading.value = false;
                };
                reader.readAsDataURL(imageBlob);
            } else {
                error.value = 'No image found in clipboard.';
                isLoading.value = false;
            }
        } catch (e: any) {
            console.error('Error processing clipboard:', e);
            error.value = `Failed to process clipboard contents: ${e.message}`;
            isLoading.value = false;
        }
    };

    const clearImage = () => {
        imageUrl.value = null;
        shortenedImageUrl.value = null;
        error.value = null;
    };

    return {
        imageUrl,
        shortenedImageUrl,
        isLoading,
        error,
        processClipboardImage,
        clearImage,
    };
}