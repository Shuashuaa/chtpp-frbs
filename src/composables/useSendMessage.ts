import { ref, computed, type Ref, watchEffect } from 'vue'; // Import watchEffect
import { addDoc, updateDoc, collection, limit, orderBy, getDocs, doc, query, serverTimestamp, where, setDoc, getDoc } from 'firebase/firestore'; // Import getDoc
import { auth, db } from '@/firebase';
import { useSmartChatScroll } from './useSmartChatScroll';
import { useTyping } from './useTyping';

export function useSendMessage(newMessage: Ref<string>) {
  const isSending = ref(false);
  const loggedInUser = computed(() => auth.currentUser);

  const { scrollToBottom } = useSmartChatScroll();
  const { stopTyping } = useTyping();

  // Reactive state for ban status
  const isCurrentUserBanned = ref(false);
  const banReason = ref('');
  const banEndTime = ref<Date | null>(null);

  // Anti-spam constants for burst limit
  const BURST_MESSAGE_COUNT = 5; // The total number of messages in the sequence to check for burst
  const BURST_TIME_WINDOW_MILLISECONDS = 30 * 1000; // Time window in milliseconds (30 seconds)

  // Define a ban duration (e.g., 1 hour for spamming)
  const SPAM_BAN_DURATION_SECONDS = 30; // 30 seconds

  // Client-side tracking for burst anti-spam
  const recentSendTimestamps: Ref<number[]> = ref([]);

  // Function to check and update the user's ban status from Firestore
  const checkUserBanStatus = async () => {
    if (!loggedInUser.value || !db) {
      isCurrentUserBanned.value = false;
      return;
    }

    const currentUserId = loggedInUser.value.uid;
    const disabledUserDocRef = doc(db, 'disabled_users', currentUserId);

    try {
      const docSnap = await getDoc(disabledUserDocRef);

      if (docSnap.exists()) {
        const banData = docSnap.data();
        const isDisabled = banData.is_disabled;
        const banStartTime = banData.ban_start_time?.toDate(); // Convert Firestore Timestamp to Date
        const banDurationSeconds = banData.ban_duration_seconds;
        const reason = banData.ban_reason || 'No specific reason provided.';

        if (isDisabled && banStartTime && typeof banDurationSeconds === 'number') {
          const calculatedBanEndTime = new Date(banStartTime.getTime() + banDurationSeconds * 1000); // Calculate end time in milliseconds

          console.log(`DEBUG (Client): Ban Start Time: ${banStartTime.toLocaleString()}`);
          console.log(`DEBUG (Client): Ban Duration: ${banDurationSeconds} seconds`);
          console.log(`DEBUG (Client): Calculated Ban End Time: ${calculatedBanEndTime.toLocaleString()}`);
          console.log(`DEBUG (Client): Current Time: ${new Date().toLocaleString()}`);

          if (calculatedBanEndTime > new Date()) {
            // User is currently banned
            isCurrentUserBanned.value = true;
            banReason.value = reason;
            banEndTime.value = calculatedBanEndTime;
            console.warn(`User ${currentUserId} is currently banned until ${calculatedBanEndTime.toLocaleString()} for reason: ${reason}`);
          } else {
            // Ban has expired, optionally clean up the ban record
            isCurrentUserBanned.value = false;
            banReason.value = '';
            banEndTime.value = null;
            console.log(`User ${currentUserId} ban has expired.`);
            // Optional: Remove the expired ban document or set is_disabled to false
            // await updateDoc(disabledUserDocRef, { is_disabled: false });
          }
        } else {
          // Document exists but ban data is invalid or user is not marked as disabled
          isCurrentUserBanned.value = false;
          banReason.value = '';
          banEndTime.value = null;
        }
      } else {
        // Document does not exist, so user is not banned
        isCurrentUserBanned.value = false;
        banReason.value = '';
        banEndTime.value = null;
      }
    } catch (error) {
      console.error('Error fetching user ban status:', error);
      isCurrentUserBanned.value = false; // Assume not banned on error to avoid blocking
      banReason.value = '';
      banEndTime.value = null;
    }
  };

  // Use watchEffect to automatically re-run checkUserBanStatus when loggedInUser changes
  // Or when the component is mounted
  watchEffect(() => {
    // Re-check ban status whenever the loggedInUser changes (e.g., login/logout)
    if (loggedInUser.value) {
      checkUserBanStatus();
    } else {
      isCurrentUserBanned.value = false;
      banReason.value = '';
      banEndTime.value = null;
    }
  });

  const sendMessage = async () => {
    const messageText = newMessage.value.trim();
    if (!messageText || !loggedInUser.value || !db || isSending.value) return;

    // --- New client-side ban check ---
    // Re-check just before sending in case the status changed
    await checkUserBanStatus(); // Ensure ban status is up-to-date
    if (isCurrentUserBanned.value) {
      console.warn(`Message not sent: User ${loggedInUser.value.uid} is currently banned.`);
      // Optionally provide more explicit feedback to the user
      // alert(`You are currently banned from sending messages. Reason: ${banReason.value}. Your ban expires at: ${banEndTime.value?.toLocaleString()}`);
      return; // Prevent sending the message if banned
    }
    // --- End client-side ban check ---

    isSending.value = true;

    try {
      const messagesRef = collection(db, 'messages_aports');
      const disabledUsersRef = collection(db, 'disabled_users');
      const currentUserId = loggedInUser.value.uid;
      const now = new Date(); // Current client time

      // ... (your existing anti-spam burst check and message sending logic) ...
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
          console.error(`Anti-spam triggered: User ${currentUserId} sent ${BURST_MESSAGE_COUNT} messages too quickly. The duration of these messages (${durationOfBurst}ms) is less than ${BURST_TIME_WINDOW_MILLISECONDS}ms. Disabling user from sending messages.`);
          console.log("DEBUG: Burst anti-spam condition met. Preventing message.");
          isSending.value = false;

          await setDoc(doc(disabledUsersRef, currentUserId), {
            displayName: loggedInUser.value.displayName,
            is_disabled: true,
            ban_start_time: serverTimestamp(),
            ban_duration_seconds: SPAM_BAN_DURATION_SECONDS,
            ban_reason: 'Spamming (burst detection)',
          }, { merge: true });

          console.log(`User ${currentUserId} has been banned for ${SPAM_BAN_DURATION_SECONDS / 60} minutes.`);

          isSending.value = false;
          recentSendTimestamps.value = [];
          // After banning, immediately update the client-side ban status
          await checkUserBanStatus();
          return;
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
    isCurrentUserBanned, // Expose ban status
    banReason,           // Expose ban reason
    banEndTime,          // Expose ban end time
    checkUserBanStatus   // Expose function to manually refresh status if needed
  };
}