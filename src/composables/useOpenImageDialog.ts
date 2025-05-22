// composables/useImageDialog.ts
import { ref, onMounted, onUnmounted } from 'vue';

export function useOpenImageDialog() {

  const dialogImageUrl = ref<string | null>(null);

  const openImageDialog = (src: string) => {
    dialogImageUrl.value = src;
  };

  const closeImageDialog = () => {
    dialogImageUrl.value = null;
  };

  // This function will be returned and can be attached to the chat container
  const handleMessageContentClick = (event: Event) => {
    const target = event.target as HTMLElement;
    // Check if the clicked element is an image preview from linkify
    if (target.classList.contains('chat-image-preview')) {
      const imageSrc = target.getAttribute('data-image-src');
      if (imageSrc) {
        openImageDialog(imageSrc);
      }
    }
  };

  // Optional: Add keyboard listener for Escape key to close dialog
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && dialogImageUrl.value) {
      closeImageDialog();
    }
  };

  // We can add the keydown listener directly within the composable
  // This makes the composable self-contained for dialog closing.
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
  });


  return {
    dialogImageUrl,
    openImageDialog,
    closeImageDialog,
    handleMessageContentClick,
  };
}