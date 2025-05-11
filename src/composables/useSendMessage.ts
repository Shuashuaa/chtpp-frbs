import { ref, computed, type Ref } from 'vue';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useSmartChatScroll } from './useSmartChatScroll';
import { useTyping } from './useTyping';

export function useSendMessage(newMessage: Ref<string>) {
    
  const isSending = ref(false);
  const loggedInUser = computed(() => auth.currentUser);

  const { scrollToBottom } = useSmartChatScroll();
  const { stopTyping } = useTyping();

  const sendMessage = async () => {
    const messageText = newMessage.value.trim();
    if (!messageText || !loggedInUser.value || !db || isSending.value) return;

    isSending.value = true;

    try {
      await addDoc(collection(db, 'messages_aports'), {
        text: messageText,
        userId: loggedInUser.value.uid,
        displayName: loggedInUser.value.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
      });

      newMessage.value = '';
      scrollToBottom();
      stopTyping();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      isSending.value = false;
    }
  };

  return {
    isSending,
    sendMessage,
  };
}
