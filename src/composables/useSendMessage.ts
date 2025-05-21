import { ref, computed, type Ref } from 'vue';
import { addDoc, updateDoc, collection, limit, orderBy, getDocs, doc, query, serverTimestamp, where, setDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useSmartChatScroll } from './useSmartChatScroll';
import { useTyping } from './useTyping';

export function useSendMessage(newMessage: Ref<string>) {
  const isSending = ref(false);
  const loggedInUser = computed(() => auth.currentUser);

  const { scrollToBottom } = useSmartChatScroll();
  const { stopTyping } = useTyping();

  // Anti-spam constants for burst limit
  const BURST_MESSAGE_COUNT = 5; // The total number of messages in the sequence to check for burst
  const BURST_TIME_WINDOW_MILLISECONDS = 30 * 1000; // Time window in milliseconds (30 seconds)

  // Define a ban duration (e.g., 1 hour for spamming)
  // const SPAM_BAN_DURATION_SECONDS = 60 * 60; // 1 hour
  const SPAM_BAN_DURATION_SECONDS = 30; // 30 seconds

  // Client-side tracking for burst anti-spam
  // This array will store timestamps of the last BURST_MESSAGE_COUNT send attempts
  const recentSendTimestamps: Ref<number[]> = ref([]);

  // Anti-spam constants for rapid-fire gap check (temporarily commented out)
  // const RAPID_FIRE_MESSAGE_LIMIT = 7; // The total number of messages in the sequence to check for rapid-fire gap
  // const MIN_GAP_MILLISECONDS = 1000; // Minimum allowed gap between consecutive messages (1 second)

  const sendMessage = async () => {
    const messageText = newMessage.value.trim();
    if (!messageText || !loggedInUser.value || !db || isSending.value) return;

    isSending.value = true;

    try {
      const messagesRef = collection(db, 'messages_aports');
      const disabledUsersRef = collection(db, 'disabled_users');
      const currentUserId = loggedInUser.value.uid;
      const now = new Date(); // Current client time

      // --- Anti-spam check 1: Burst message detection (client-side tracking) ---
      // Add the current message's timestamp to the local tracking array
      recentSendTimestamps.value.push(now.getTime());

      // Keep only the last BURST_MESSAGE_COUNT timestamps
      if (recentSendTimestamps.value.length > BURST_MESSAGE_COUNT) {
        recentSendTimestamps.value.shift(); // Remove the oldest timestamp
      }

      console.log('========User ID from client:', currentUserId, '================');
      console.log(`DEBUG: Burst Check (Client-side) - Attempting to send message. User: ${currentUserId}`);
      console.log(`DEBUG: Burst Check (Client-side) - Current message's 'now' timestamp: ${now.getTime()} (${now.toLocaleTimeString()})`);
      console.log(`DEBUG: Burst Check (Client-side) - Recent send timestamps: [${recentSendTimestamps.value.map(ts => new Date(ts).toLocaleTimeString() + ' (' + ts + ')').join(', ')}]`);
      console.log(`DEBUG: Burst Check (Client-side) - Count of recent send attempts: ${recentSendTimestamps.value.length}`);


      // Only perform the burst check if we have enough send attempts recorded
      if (recentSendTimestamps.value.length === BURST_MESSAGE_COUNT) {
        // Sort timestamps chronologically to find the earliest and latest in the sequence
        const sortedTimestamps = [...recentSendTimestamps.value].sort((a, b) => a - b);

        const earliestTimestamp = sortedTimestamps[0];
        const latestTimestamp = sortedTimestamps[sortedTimestamps.length - 1];
        const durationOfBurst = latestTimestamp - earliestTimestamp;

        console.log(`DEBUG: Burst Check (Client-side) - Earliest timestamp in burst: ${new Date(earliestTimestamp).toLocaleTimeString()} (${earliestTimestamp}), Latest timestamp in burst: ${new Date(latestTimestamp).toLocaleTimeString()} (${latestTimestamp})`);
        console.log(`DEBUG: Burst Check (Client-side) - Duration of burst (ms): ${durationOfBurst}`);
        console.log(`DEBUG: Burst Check (Client-side) - Required window (ms): ${BURST_TIME_WINDOW_MILLISECONDS}`);

        if (durationOfBurst < BURST_TIME_WINDOW_MILLISECONDS) {
          console.error(`Anti-spam triggered: User ${currentUserId} sent ${BURST_MESSAGE_COUNT} messages too quickly. The duration of these messages (${durationOfBurst}ms) is less than ${BURST_TIME_WINDOW_MILLISECONDS}ms. Disabling user from sending messages.`);
          console.log("DEBUG: Burst anti-spam condition met. Preventing message.");
          isSending.value = false;
          // Optionally, clear timestamps if user is 'banned' to prevent immediate re-trigger
          // recentSendTimestamps.value = [];
          // In a real application, you might update the user's status in a 'users' collection
          // e.g., await updateDoc(doc(db, 'users', currentUserId), { isBanned: true, banReason: 'Spamming' });
           // Update the user's ban status in the disabled_users collection

           await setDoc(doc(disabledUsersRef, currentUserId), {
            displayName: loggedInUser.value.displayName,
            is_disabled: true,
            ban_start_time: serverTimestamp(), // Use serverTimestamp for accuracy
            ban_duration_seconds: SPAM_BAN_DURATION_SECONDS,
            ban_reason: 'Spamming (burst detection)', // Optional: Add a reason
          }, { merge: true }); // Use merge: true to avoid overwriting other fields if they exist

          console.log(`User ${currentUserId} has been banned for ${SPAM_BAN_DURATION_SECONDS / 60} minutes.`);
          // --- END MISSING PART ---

          isSending.value = false;
          // Optionally, clear timestamps to prevent immediate re-trigger if they manage to get around the ban somehow before the rules take effect (though rules should be instant)
          recentSendTimestamps.value = [];
          return; // Prevent sending the message
        }
      }
      // --- End Anti-spam check ---

      // --- Anti-spam check 2: Rapid-fire message detection (e.g., 7 messages with <1s gap) ---
      // This entire block is commented out as per your request.
      /*
      const previousRapidFireMessagesQuery = query(
        messagesRef,
        where('userId', '==', currentUserId),
        orderBy('timestamp', 'desc'),
        limit(RAPID_FIRE_MESSAGE_LIMIT - 1)
      );
      const previousRapidFireMessagesSnapshot = await getDocs(previousRapidFireMessagesQuery);
      const previousRapidFireUserMessages = previousRapidFireMessagesSnapshot.docs;

      if (previousRapidFireUserMessages.length === RAPID_FIRE_MESSAGE_LIMIT - 1) {
        const allRapidFireTimestamps: number[] = [];

        previousRapidFireUserMessages.forEach(doc => {
          const timestamp = doc.data().timestamp?.toDate().getTime();
          if (timestamp) {
            allRapidFireTimestamps.push(timestamp);
          }
        });

        allRapidFireTimestamps.push(now.getTime());

        allRapidFireTimestamps.sort((a, b) => a - b);

        for (let i = 1; i < allRapidFireTimestamps.length; i++) {
          const gap = allRapidFireTimestamps[i] - allRapidFireTimestamps[i - 1];
          if (gap < MIN_GAP_MILLISECONDS) {
            console.error(`Anti-spam triggered: User ${currentUserId} sent messages too rapidly. Gap between messages is ${gap}ms, which is less than ${MIN_GAP_MILLISECONDS}ms. Disabling user from sending messages.`);
            isSending.value = false;
            return;
          }
        }
      }
      */
      // --- End Anti-spam check ---

      // --- Original message sending logic (reinstated same minute update) ---
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
      // 4. All anti-spam checks passed.
      if (shouldCreateNewMessage) {
        await addDoc(messagesRef, {
          text: messageText,
          userId: currentUserId,
          displayName: loggedInUser.value.displayName || 'Anonymous',
          timestamp: serverTimestamp(),
        });
        console.log('New message added.');
      }
      // --- End original message sending logic ---

      // Reset input and UI state
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
