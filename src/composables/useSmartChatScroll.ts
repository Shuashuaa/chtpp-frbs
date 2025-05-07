// composables/useSmartChatScroll.ts
import { ref, nextTick } from 'vue';

export function useSmartChatScroll() {
    const chatContainerRef = ref<HTMLElement | null>(null);
    const isUserNearBottom = ref(true);
    const newMessageCount = ref(0);

    const isNearBottom = (): boolean => { // returns true or false
        const el = chatContainerRef.value;
        if (!el) return false;
        return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    };

    const scrollToBottom = (smooth = true) => { // scrolls to bottom of the chat page
        nextTick(() => {
            const el = chatContainerRef.value;
            if (el) {
                el.scrollTo({
                    top: el.scrollHeight,
                    behavior: smooth ? 'smooth' : 'auto',
                });
                newMessageCount.value = 0; // Clear when scrolled to bottom
            }
        });
    };

    const handleScroll = () => {
        if (!chatContainerRef.value) return;
        isUserNearBottom.value = isNearBottom(); // false || true
        
        if (isUserNearBottom.value) {
            newMessageCount.value = 0; // Clear when scrolled to bottom
        }
    };

    const handleNewMessage = () => {
        if (isUserNearBottom.value) {
            scrollToBottom();
        } else {
            newMessageCount.value++;
        }
    };

    return {
        chatContainerRef,
        isNearBottom,
        scrollToBottom,
        isUserNearBottom,
        newMessageCount,
        handleScroll,
        handleNewMessage,
    };
}