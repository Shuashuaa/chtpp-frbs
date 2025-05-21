import { ref, computed, type Ref } from 'vue';
import { addDoc, updateDoc, collection, limit, orderBy, getDocs, doc, query, serverTimestamp, where } from 'firebase/firestore';
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
        const messagesRef = collection(db, 'messages_aports');
        const currentUserId = loggedInUser.value.uid;
        const now = new Date();

        // Calculate the start and end of the current minute
        const startOfMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
        const endOfMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 59, 999);

        // Query for messages from the current user within the current minute
        const q = query(
          messagesRef,
          where('userId', '==', currentUserId),
          where('timestamp', '>=', startOfMinute),
          where('timestamp', '<=', endOfMinute),
          orderBy('timestamp', 'desc'), // Order by timestamp to potentially get the latest if multiple exist (though ideally there'd be one)
          limit(1) // We only need to find one
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // A message from this user exists within the current minute, update it
            const existingMessageDoc = querySnapshot.docs[0];
            const messageDocRef = doc(db, 'messages_aports', existingMessageDoc.id);

            // Append the new message text to the existing one, or simply replace if preferred
            // For grouping, appending makes more sense. Add a separator like newline.
            const existingText = existingMessageDoc.data().text;
            await updateDoc(messageDocRef, {
                text: `${existingText}\n${messageText}`, // Append new text with a newline
                timestamp: serverTimestamp(), // Update timestamp to reflect the latest addition
            });
            console.log('Message updated:', existingMessageDoc.id);
        } else {
            // No existing message found for this user in the current minute, add a new one
            await addDoc(messagesRef, {
                text: messageText,
                userId: currentUserId,
                displayName: loggedInUser.value.displayName || 'Anonymous',
                timestamp: serverTimestamp(),
            });
            console.log('New message added.');
        }

        newMessage.value = '';
        scrollToBottom();
        stopTyping();
    } catch (error) {
      console.error('Error sending or updating message:', error);
    } finally {
      isSending.value = false;
    }
  };

  return {
    isSending,
    sendMessage,
  };
}
