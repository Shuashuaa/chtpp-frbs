// src/composables/useChatBanStatus.ts

import { ref, computed, watchEffect, type Ref } from 'vue';
import { doc, getDoc, updateDoc, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';

import { useTyping } from '@/composables/useTyping'; // Import useTyping

export function useChatBanStatus() {
  const isCurrentUserBanned = ref(false);
  const banReason = ref('');
  const banEndTime = ref<Date | null>(null);

  const loggedInUser = computed(() => auth.currentUser);

  // Stop typing function
  const { stopTyping } = useTyping();

  // Define a ban duration (e.g., 1 hour for spamming)
  const SPAM_BAN_DURATION_SECONDS = 30; // 30 seconds for demonstration

  // Function to check and update the user's ban status from Firestore
  const checkUserBanStatus = async () => {
    if (!loggedInUser.value || !db) {
      isCurrentUserBanned.value = false;
      banReason.value = '';
      banEndTime.value = null;
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

          console.log(`DEBUG (useChatBanStatus): Ban Start Time: ${banStartTime.toLocaleString()}`);
          console.log(`DEBUG (useChatBanStatus): Ban Duration: ${banDurationSeconds} seconds`);
          console.log(`DEBUG (useChatBanStatus): Calculated Ban End Time: ${calculatedBanEndTime.toLocaleString()}`);
          console.log(`DEBUG (useChatBanStatus): Current Time: ${new Date().toLocaleString()}`);

          if (calculatedBanEndTime > new Date()) {
            // User is currently banned
            isCurrentUserBanned.value = true;
            banReason.value = reason;
            banEndTime.value = calculatedBanEndTime;
            console.warn(`User ${currentUserId} is currently banned until ${calculatedBanEndTime.toLocaleString()} for reason: ${reason}`);
            
            // NEW: If user becomes banned, stop their typing status
            await stopTyping(); // Stop typing when banned
            
          } else {
            // Ban has expired, clean up the ban record in Firestore
            isCurrentUserBanned.value = false;
            banReason.value = '';
            banEndTime.value = null;
            console.log(`User ${currentUserId} ban has expired. Removing ban record.`);
            await updateDoc(disabledUserDocRef, { is_disabled: false });
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

  // Function to apply a ban (called from anti-spam logic)
  const applyBan = async (userId: string, displayName: string | null, reason: string = 'Spamming') => {
    if (!db) return;
    const disabledUsersRef = collection(db, 'disabled_users');
    const disabledUserDocRef = doc(disabledUsersRef, userId);

    try {
      await setDoc(disabledUserDocRef, {
        displayName: displayName || 'Anonymous',
        is_disabled: true,
        ban_start_time: serverTimestamp(),
        ban_duration_seconds: SPAM_BAN_DURATION_SECONDS,
        ban_reason: reason,
      }, { merge: true });

      console.log(`User ${userId} has been banned for ${SPAM_BAN_DURATION_SECONDS} seconds. Reason: ${reason}`);
      
      // Immediately update the client-side ban status after applying a ban
      await checkUserBanStatus();
      
      // NEW: Explicitly stop typing after a ban is applied via applyBan
      await stopTyping(); // Stop typing when applyBan is called
      
    } catch (error) {
      console.error('Error applying ban:', error);
    }
  };

  // Use watchEffect to automatically re-run checkUserBanStatus when loggedInUser changes
  watchEffect(() => {
    if (loggedInUser.value) {
      checkUserBanStatus();
    } else {
      // Clear ban status if no user is logged in
      isCurrentUserBanned.value = false;
      banReason.value = '';
      banEndTime.value = null;
    }
  });

  return {
    isCurrentUserBanned,
    banReason,
    banEndTime,
    checkUserBanStatus,
    applyBan,
    SPAM_BAN_DURATION_SECONDS
  };
}