import { ref, computed } from 'vue';
import { db, auth } from '@/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  getDocs,
  where,
} from 'firebase/firestore';

export function useReactions() {
  const reactions = ref<Record<string, any[]>>({});
  const openReactionMessageId = ref<string | null>(null);

  const reactionEmojis: Record<string, string> = {
    like: '👍',
    heart: '❤️',
    haha: '😂',
    sad: '😢',
    angry: '😡',
    fire: '🔥'
  };

  const groupedReactions = computed(() => {
    const grouped: Record<
      string,
      Record<string, { count: number; users: string[] }>
    > = {};

    for (const messageId in reactions.value) {
      const counts: Record<string, { count: number; users: string[] }> = {};

      for (const reaction of reactions.value[messageId]) {
        const type = reaction.type;
        const userDisplay = reaction.displayName || reaction.userId;

        if (!counts[type]) {
          counts[type] = { count: 0, users: [] };
        }

        counts[type].count++;
        counts[type].users.push(userDisplay);
      }

      grouped[messageId] = counts;
    }
    
    return grouped;
  });

  const fetchReactions = (messageId: string) => {
    const reactionsRef = collection(db, 'messages_aports', messageId, 'reactions');
    const q = query(reactionsRef, orderBy('timestamp', 'asc'));

    onSnapshot(q, (snapshot) => {
      const reactionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      reactions.value[messageId] = reactionsData;
    });
  };

  const addReaction = async (messageId: string, reactionType: string) => {
    const user = auth.currentUser;
    if (!user) return;
  
    const reactionsRef = collection(db, 'messages_aports', messageId, 'reactions');
  
    // Query to check if this user already reacted with the same type
    const q = query(
      reactionsRef,
      where('userId', '==', user.uid),
      where('type', '==', reactionType)
    );
  
    const snapshot = await getDocs(q);
  
    if (!snapshot.empty) {
      // 👎 Already reacted → remove it
      const existingReaction = snapshot.docs[0];
      await deleteDoc(doc(db, 'messages_aports', messageId, 'reactions', existingReaction.id));
    } else {
      // 👍 Not yet reacted → add it
      await addDoc(reactionsRef, {
        userId: user.uid,
        displayName: user.displayName  || 'Anonymous',
        type: reactionType,
        timestamp: serverTimestamp(),
      });
    }
  
    openReactionMessageId.value = null;
  };

  const toggleReactionPicker = (messageId: string) => {
    openReactionMessageId.value =
      openReactionMessageId.value === messageId ? null : messageId;
  };

  return {
    reactions,
    fetchReactions,
    addReaction,
    toggleReactionPicker,
    groupedReactions,
    openReactionMessageId,
    reactionEmojis,
  };
}
