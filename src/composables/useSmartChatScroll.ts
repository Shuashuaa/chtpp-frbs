import { ref, nextTick } from 'vue';

export function useSmartChatScroll(onScrollTop?: () => void) {
    
    const chatContainerRef = ref<HTMLElement | null>(null);
    const isUserNearBottom = ref(true);
    const newMessageCount = ref(0);

    const isNearBottom = (): boolean => {
        const el = chatContainerRef.value;
        if (!el) return false;
        return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    };

    const scrollToBottom = (smooth = true) => {
        nextTick(() => {
            const el = chatContainerRef.value;
            if (el) {
                el.scrollTo({
                    top: el.scrollHeight,
                    behavior: smooth ? 'smooth' : 'auto',
                });
                newMessageCount.value = 0;
            }
        });
    };

    const handleScroll = () => {
        const el = chatContainerRef.value;
        if (!el) return;

        isUserNearBottom.value = isNearBottom();

        if (isUserNearBottom.value) {
            newMessageCount.value = 0;
        }

        // 🆕 Detect scroll to top and call callback
        if (el.scrollTop === 0 && typeof onScrollTop === 'function') {
            onScrollTop();
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
