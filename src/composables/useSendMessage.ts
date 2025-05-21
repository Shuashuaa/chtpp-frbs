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
        const now = new Date(); // Current client time

        // 1. Get the very last message in the entire chat (regardless of user)
        const lastMessageQuery = query(
            messagesRef,
            orderBy('timestamp', 'desc'), // Get the most recent
            limit(1) // Only need one
        );
        const lastMessageSnapshot = await getDocs(lastMessageQuery);

        // Helper function to check if two dates are in the same minute
        const areInSameMinute = (date1: Date, date2: Date) =>
            date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate() &&
            date1.getHours() === date2.getHours() &&
            date1.getMinutes() === date2.getMinutes();

        let shouldCreateNewMessage = true; // Default: always create a new message

        if (!lastMessageSnapshot.empty) {
            const lastMessageDoc = lastMessageSnapshot.docs[0];
            const lastMessageData = lastMessageDoc.data();
            const lastMessageUserId = lastMessageData.userId;
            const lastMessageTimestamp = lastMessageData.timestamp?.toDate(); // Convert Firestore Timestamp to Date object

            // Ensure timestamp exists for comparison
            if (lastMessageTimestamp) {
                if (lastMessageUserId === currentUserId) {
                    // Scenario: The last message was from THE CURRENT user
                    // Check if that last message (from me) is within the same minute as 'now'
                    if (areInSameMinute(lastMessageTimestamp, now)) {
                        // If same user and same minute, we should update
                        const messageDocRef = doc(db, 'messages_aports', lastMessageDoc.id);
                        const existingText = lastMessageData.text; // Use data from the fetched doc

                        await updateDoc(messageDocRef, {
                            text: `${existingText}\n${messageText}`, // Append new text with a newline
                            timestamp: serverTimestamp(), // Update timestamp to reflect the latest addition
                        });
                        console.log('Message updated:', lastMessageDoc.id);
                        shouldCreateNewMessage = false; // Set to false, as we've already updated
                    }
                    // If from the same user but not in the same minute, shouldCreateNewMessage remains true
                }
                // If lastMessageUserId !== currentUserId, shouldCreateNewMessage remains true
                // meaning a new message will be created, as per the requirement.
            }
        }

        // If shouldCreateNewMessage is still true at this point, it means:
        // 1. The chat was empty.
        // 2. The last message was from another user.
        // 3. The last message was from the current user, but not in the same minute.
        if (shouldCreateNewMessage) {
            await addDoc(messagesRef, {
                text: messageText,
                userId: currentUserId,
                displayName: loggedInUser.value.displayName || 'Anonymous',
                timestamp: serverTimestamp(),
            });
            console.log('New message added.');
        }

        // Reset input and UI state
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
