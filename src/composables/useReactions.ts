import { ref, computed } from 'vue';
import { db, auth } from '@/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
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
    const grouped: Record<string, Record<string, number>> = {};

    for (const messageId in reactions.value) {
      const counts: Record<string, number> = {};
      for (const reaction of reactions.value[messageId]) {
        if (!counts[reaction.type]) {
          counts[reaction.type] = 0;
        }
        counts[reaction.type]++;
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
    if (user) {
      try {
        await addDoc(collection(db, 'messages_aports', messageId, 'reactions'), {
          userId: user.uid,
          type: reactionType,
          timestamp: serverTimestamp(),
        });

        openReactionMessageId.value = null;
      } catch (error) {
        console.error('Error adding reaction:', error);
      }
    }
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
