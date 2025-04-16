<template>
    <div>
      <h2 class="text-xl font-semibold mb-4">Global Chat</h2>
      <div class="chat-messages border border-gray-300 p-2 mb-2 h-[300px] overflow-y-auto">
        <div v-for="message in messages" :key="message.id" :class="message.userId == loggedInUser?.uid ? 'text-right' : 'text-left'" class="message py-1 border-b border-dotted border-gray-200 last:border-b-0">
          <span class="user font-bold mr-1">{{ message.displayName || 'Anonymous' }}:</span>
          <span class="text">{{ message.text }}</span>
          <span class="timestamp text-xs text-gray-500 ml-2">{{ formatTimestamp(message.timestamp) }}</span>
        </div>
      </div>
      <div class="chat-input flex" v-if="loggedInUser">
        <input
          type="text"
          v-model="newMessage"
          placeholder="Type your message..."
          class="flex-grow p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          @click="sendMessage"
          :disabled="!newMessage"
          class="px-3 py-2 border border-gray-300 rounded-r-md bg-gray-100 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
      <p v-else class="text-gray-600">Please log in to participate in the chat.</p>
    </div>
  </template>
  
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { auth, db } from '@/firebase'; // Adjust import path
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

const loggedInUser = computed(() => auth.currentUser);
const messages = ref<any[]>([]);
const newMessage = ref('');

onMounted(() => {
    if (db) {
        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        onSnapshot(q, (snapshot) => {
            messages.value = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
        });
    }
});

const sendMessage = async () => {
    if (newMessage.value && loggedInUser.value && db) {
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