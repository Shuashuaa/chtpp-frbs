import { ref, computed, type Ref } from 'vue';
import { addDoc, updateDoc, collection, limit, orderBy, getDocs, doc, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useSmartChatScroll } from './useSmartChatScroll';
import { useTyping } from './useTyping';
import { useChatBanStatus } from './useChatBanStatus';

export function useSendMessage(newMessage: Ref<string>) {
  const isSending = ref(false);
  const loggedInUser = computed(() => auth.currentUser);

  const { scrollToBottom } = useSmartChatScroll();
  const { stopTyping } = useTyping();
  
  // --- Use the new banning composable ---
  const { 
    isCurrentUserBanned, 
    banReason, 
    banEndTime, 
    checkUserBanStatus, 
    applyBan,
    SPAM_BAN_DURATION_SECONDS // If you need this constant in sendMessage itself
  } = useChatBanStatus();
  // -------------------------------------

  // Anti-spam constants for burst limit
  const BURST_MESSAGE_COUNT = 5; // The total number of messages in the sequence to check for burst
  const BURST_TIME_WINDOW_MILLISECONDS = 30 * 1000; // Time window in milliseconds (30 seconds)

  // Client-side tracking for burst anti-spam (still lives here as it's send-message specific)
  const recentSendTimestamps: Ref<number[]> = ref([]);

  const sendMessage = async () => {
    const messageText = newMessage.value.trim();
    if (!messageText || !loggedInUser.value || !db || isSending.value) return;

    // Client-side ban check (always perform before trying to send)
    // No need to await checkUserBanStatus here again, as it's watched by useChatBanStatus
    // and will be up-to-date from its own watchEffect
    if (isCurrentUserBanned.value) {
      console.warn(`Message not sent: User ${loggedInUser.value.uid} is currently banned.`);
      return; // Prevent sending the message if banned
    }

    isSending.value = true;

    try {
      const messagesRef = collection(db, 'messages_aports');
      const currentUserId = loggedInUser.value.uid;
      const now = new Date(); // Current client time

      // --- Anti-spam check 1: Burst message detection (client-side tracking) ---
      recentSendTimestamps.value.push(now.getTime());

      if (recentSendTimestamps.value.length > BURST_MESSAGE_COUNT) {
        recentSendTimestamps.value.shift();
      }

      console.log('========User ID from client:', currentUserId, '================');
      console.log(`DEBUG: Burst Check (Client-side) - Attempting to send message. User: ${currentUserId}`);
      console.log(`DEBUG: Burst Check (Client-side) - Current message's 'now' timestamp: ${now.getTime()} (${now.toLocaleTimeString()})`);
      console.log(`DEBUG: Burst Check (Client-side) - Recent send timestamps: [${recentSendTimestamps.value.map(ts => new Date(ts).toLocaleTimeString() + ' (' + ts + ')').join(', ')}]`);
      console.log(`DEBUG: Burst Check (Client-side) - Count of recent send attempts: ${recentSendTimestamps.value.length}`);

      if (recentSendTimestamps.value.length === BURST_MESSAGE_COUNT) {
        const sortedTimestamps = [...recentSendTimestamps.value].sort((a, b) => a - b);

        const earliestTimestamp = sortedTimestamps[0];
        const latestTimestamp = sortedTimestamps[sortedTimestamps.length - 1];
        const durationOfBurst = latestTimestamp - earliestTimestamp;

        console.log(`DEBUG: Burst Check (Client-side) - Earliest timestamp in burst: ${new Date(earliestTimestamp).toLocaleTimeString()} (${earliestTimestamp}), Latest timestamp in burst: ${new Date(latestTimestamp).toLocaleTimeString()} (${latestTimestamp})`);
        console.log(`DEBUG: Burst Check (Client-side) - Duration of burst (ms): ${durationOfBurst}`);
        console.log(`DEBUG: Burst Check (Client-side) - Required window (ms): ${BURST_TIME_WINDOW_MILLISECONDS}`);

        if (durationOfBurst < BURST_TIME_WINDOW_MILLISECONDS) {
          console.error(`Anti-spam triggered: User ${currentUserId} sent ${BURST_MESSAGE_COUNT} messages too quickly. The duration of these messages (${durationOfBurst}ms) is less than ${BURST_TIME_WINDOW_MILLISECONDS}ms.`);
          console.log("DEBUG: Burst anti-spam condition met. Preventing message and applying ban.");
          
          // --- Call applyBan from the new composable ---
          await applyBan(currentUserId, loggedInUser.value.displayName, 'Spamming (burst detection)');
          // ---------------------------------------------

          isSending.value = false;
          recentSendTimestamps.value = []; // Clear timestamps as user is banned
          return; // Prevent sending the message
        }
      }
      // --- End Anti-spam check ---

      // --- Original message sending logic ---
      const lastMessageQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const lastMessageSnapshot = await getDocs(lastMessageQuery);

      const areInSameMinute = (date1: Date, date2: Date) =>
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate() &&
        date1.getHours() === date2.getHours() &&
        date1.getMinutes() === date2.getMinutes();

      let shouldCreateNewMessage = true;

      if (!lastMessageSnapshot.empty) {
        const lastMessageDoc = lastMessageSnapshot.docs[0];
        const lastMessageData = lastMessageDoc.data();
        const lastMessageUserId = lastMessageData.userId;
        const lastMessageTimestamp = lastMessageData.timestamp?.toDate();

        if (lastMessageTimestamp) {
          if (lastMessageUserId === currentUserId) {
            if (areInSameMinute(lastMessageTimestamp, now)) {
              const messageDocRef = doc(db, 'messages_aports', lastMessageDoc.id);
              const existingText = lastMessageData.text;

              await updateDoc(messageDocRef, {
                text: `${existingText}\n${messageText}`,
                timestamp: serverTimestamp(),
              });
              console.log('Message updated:', lastMessageDoc.id);
              shouldCreateNewMessage = false;
            }
          }
        }
      }

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
    isCurrentUserBanned,
    banReason,
    banEndTime,
    checkUserBanStatus
  };
}