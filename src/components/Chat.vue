<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue';
  import { auth, db } from '@/firebase'; // Adjust import path
  import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
  import 'emoji-picker-element';

  const loggedInUser = computed(() => auth.currentUser);
  const messages = ref<any[]>([]);
  const newMessage = ref('');
  const isSending = ref(false);
  const isTyping = ref(false);
  const isSomeoneTyping = ref(false);
  const typingTimeout = ref<number | undefined>(undefined);
  const isEmojiOn = ref(false);
  
  onMounted(() => {
    if (db && loggedInUser.value) {
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
  
      onSnapshot(q, (snapshot) => {
        messages.value = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        // scrollToBottom();
      });
  
      // Listen for typing status of other users
      const typingRef = collection(db, 'typing');

      onSnapshot(typingRef, (snapshot) => {
        isSomeoneTyping.value = snapshot.docs.some(
          (doc) => doc.id !== loggedInUser.value?.uid && doc.data()?.isTyping
        );
      });
    }

    // v-if and v-show difference when using DOM
    const picker = document.querySelector('emoji-picker');
    if (picker) {
      picker.addEventListener('emoji-click', (event: any) => {
        const emoji = event.detail.unicode;
        newMessage.value += emoji; // append emoji to the input
      });
    }

    document.addEventListener('click', handleClickOutside);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  const emojiButtonRef = ref<HTMLElement | null>(null);
  const emojiPickerRef = ref<HTMLElement | null>(null);

  const handleClickOutside = (event: MouseEvent) => {
    const pickerEl = emojiPickerRef.value;
    const buttonEl = emojiButtonRef.value;

    if (
      pickerEl &&
      !pickerEl.contains(event.target as Node) &&
      buttonEl &&
      !buttonEl.contains(event.target as Node)
    ) {
      isEmojiOn.value = false;
    }
  };
  
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

  // Scrolling and New Messages Features

  const chatMessagesRef = ref<HTMLElement | null>(null);
  const shouldAutoScroll = ref(true);
  const showScrollToBottom = ref(false);
  const unseenMessageCount = ref(0);
  let isInitialLoad = true;

  const handleScroll = () => {
    const el = chatMessagesRef.value;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
    shouldAutoScroll.value = isAtBottom;

    if (isAtBottom) {
      showScrollToBottom.value = false;
      unseenMessageCount.value = 0;
    }
  };

  watch(messages, (newMessages) => {
    nextTick(() => {
      const el = chatMessagesRef.value;
      if (!el || !newMessages.length) return;

      const lastMessage = newMessages[newMessages.length - 1];

      // Skip if it's from the current user
      if (lastMessage.userId === loggedInUser.value?.uid) return;

      if (shouldAutoScroll.value || isInitialLoad) {
        el.scrollTop = el.scrollHeight;
        unseenMessageCount.value = 0;
      } else {
        unseenMessageCount.value += 1;
        if (!isWindowFocused.value && unseenMessageCount.value > 0) {
          document.title = `(${unseenMessageCount.value}) New Message${unseenMessageCount.value > 1 ? 's' : ''}`;
        }
        showScrollToBottom.value = true;
      }

      if (isInitialLoad) isInitialLoad = false;
    });
  });

  const scrollToBottom = () => {
    const el = chatMessagesRef.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
      unseenMessageCount.value = 0;
      showScrollToBottom.value = false;
      shouldAutoScroll.value = true;
      document.title = originalTitle;
    }
  };

  // Tab Title as Notification

  const originalTitle = document.title;
  const isWindowFocused = ref(true);

  window.addEventListener('focus', () => {
    isWindowFocused.value = true;
    unseenMessageCount.value = 0;
    document.title = originalTitle;
  });

  window.addEventListener('blur', () => {
    isWindowFocused.value = false;
  });

</script>

<template>
  <div class="md:w-[600px]">
    <h2 class="text-xl font-semibold mb-1">Chat</h2>
    <div ref="chatMessagesRef" @scroll="handleScroll" 
      class="chat-messages border border-gray-300 p-2 mb-2 h-[500px] overflow-y-auto">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="message.userId == loggedInUser?.uid ? 'text-right' : 'text-left'"
        class="message p-1 border-b border-dotted border-gray-200 last:border-b-0"
      >
        <span class="text-gray-700 text-sm font-bold mr-1">{{ message.displayName || 'Anonymous' }}:</span>
        <span class="text-gray-600 text-sm">{{ message.text }}</span>
        <span class="timestamp text-[11px] text-gray-400 ml-2">{{ formatTimestamp(message.timestamp) }}</span>
      </div>
    </div>
    <div v-if="showScrollToBottom" class="flex justify-center mt-1">
      <button
        @click="scrollToBottom"
        class="bg-blue-500 text-white px-3 py-1 rounded text-sm shadow hover:bg-blue-600 transition"
      >
        {{ unseenMessageCount > 0 ? `New messages (${unseenMessageCount})` : 'Scroll to latest' }}
      </button>
    </div>
    <p v-if="isSomeoneTyping && loggedInUser" class="text-sm italic text-gray-500">Someone is typing...</p>
    <div class="chat-input flex gap-2" v-if="loggedInUser">
      <div class="relative w-full">
        <!-- <svg @click="isEmojiOn = !isEmojiOn" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg> -->
        <svg ref="emojiButtonRef" class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 cursor-pointer" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
        <input
          type="text"
          v-model="newMessage"
          placeholder="Type your message..."
          @input="handleTyping"
          @blur="stopTyping"
          @keydown.enter="sendMessage"
          class="w-full flex-grow p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <emoji-picker ref="emojiPickerRef" v-show="isEmojiOn" class="absolute left-0 mt-2 z-50"></emoji-picker>
      </div>
      <button
        @click="sendMessage"
        :disabled="!newMessage || isSending"
        class="w-25 text-sm px-5 border border-gray-300 rounded-r-md bg-blue-300 hover:bg-blue-200 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </div>
    <p v-else class="text-gray-600">Please log in to participate in the chat.</p>
  </div>
</template>