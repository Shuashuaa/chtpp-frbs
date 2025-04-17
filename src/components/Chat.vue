<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
  import { auth, db } from '@/firebase'; // Adjust import path
  import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
  
  const loggedInUser = computed(() => auth.currentUser);
  const messages = ref<any[]>([]);
  const newMessage = ref('');
  const isSending = ref(false);
  const isTyping = ref(false);
  const isSomeoneTyping = ref(false);
  const typingTimeout = ref<number | undefined>(undefined);
  
  onMounted(() => {
    if (db && loggedInUser.value) {
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
  
      onSnapshot(q, (snapshot) => {
        messages.value = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      });
  
      // Listen for typing status of other users
      const typingRef = collection(db, 'typing');
      onSnapshot(typingRef, (snapshot) => {
        isSomeoneTyping.value = snapshot.docs.some(
          (doc) => doc.id !== loggedInUser.value?.uid && doc.data()?.isTyping
        );
      });
    }
  });
  
  const handleTyping = () => {
    if (!loggedInUser.value || !db) return;
    if (!isTyping.value) {
      // User just started typing
      setTypingStatus(true);
      isTyping.value = true;
    } else {
      // User is still typing, reset the timeout
      if (typingTimeout.value) {
        clearTimeout(typingTimeout.value);
      }
    }
  
    // Set a timeout to stop typing after a while
    typingTimeout.value = setTimeout(() => {
      setTypingStatus(false);
      isTyping.value = false;
    }, 1500); // Adjust the timeout as needed (e.g., 1.5 seconds)
  };
  
  const stopTyping = () => {
    if (!loggedInUser.value || !db) return;
    clearTimeout(typingTimeout.value);
    setTypingStatus(false);
    isTyping.value = false;
  };
  
  const setTypingStatus = async (typing: boolean) => {
    if (!loggedInUser.value || !db) return;
    const typingRef = doc(db, 'typing', loggedInUser.value.uid);
    try {
      await setDoc(typingRef, { isTyping: typing }, { merge: true });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };
  
  const sendMessage = async () => {
    if (newMessage.value && loggedInUser.value && db && !isSending.value) {
      isSending.value = true;
      try {
        await addDoc(collection(db, 'messages'), {
          text: newMessage.value,
          userId: loggedInUser.value.uid,
          displayName: loggedInUser.value.displayName || null,
          timestamp: serverTimestamp(),
        });
        newMessage.value = ''; // Clear the input field
      } catch (error) {
        console.error('Error sending message:', error);
        // Handle error (e.g., show a notification to the user)
      } finally {
        isSending.value = false;
        stopTyping(); // Ensure typing status is off after sending
      }
    } else if (!loggedInUser.value) {
      alert('You must be logged in to send a message.');
    }
  };
  
  const formatTimestamp = (timestamp: any) => {
    if (timestamp) {
      const date = timestamp.toDate();
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return '';
  };
</script>

<template>
  <div>
    <h2 class="text-xl font-semibold mb-1">Chat</h2>
    <div class="chat-messages border border-gray-300 p-2 mb-2 h-[300px] overflow-y-auto">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="message.userId == loggedInUser?.uid ? 'text-right' : 'text-left'"
        class="message p-1 border-b border-dotted border-gray-200 last:border-b-0"
      >
        <span class="text-gray-700 font-bold mr-1">{{ message.displayName || 'Anonymous' }}:</span>
        <span class="text-gray-600">{{ message.text }}</span>
        <span class="timestamp text-[11px] text-gray-400 ml-2">{{ formatTimestamp(message.timestamp) }}</span>
      </div>
    </div>
    <p v-if="isSomeoneTyping && loggedInUser" class="text-sm italic text-gray-500">Someone is typing...</p>
    <div class="chat-input flex gap-2" v-if="loggedInUser">
      <input
        type="text"
        v-model="newMessage"
        placeholder="Type your message..."
        @input="handleTyping"
        @blur="stopTyping"
        @keydown.enter="sendMessage"
        class="flex-grow p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        @click="sendMessage"
        :disabled="!newMessage || isSending"
        class="px-3 py-2 border border-gray-300 rounded-r-md bg-blue-300 hover:bg-blue-200 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </div>
    <p v-else class="text-gray-600">Please log in to participate in the chat.</p>
  </div>
</template>