<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue';
import { auth, db } from '@/firebase';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    setDoc,
    deleteDoc,
    doc,
} from 'firebase/firestore';
import { formatTimestamp } from '../composables/format';
import { useSmartChatScroll } from '@/composables/useSmartChatScroll';

const {
    chatContainerRef,
    isUserNearBottom,
    newMessageCount,
    scrollToBottom,
    handleScroll,
    handleNewMessage
} = useSmartChatScroll();

const loggedInUser = computed(() => auth.currentUser);
const messages = ref<any[]>([]);
const newMessage = ref('');
const isSending = ref(false);
const isEmojiOn = ref(false);

const sendMessage = async () => {
    if (newMessage.value.trim() && loggedInUser.value && db && !isSending.value) {
        isSending.value = true;
        try {
            await addDoc(collection(db, 'messages_aports'), {
                text: newMessage.value,
                userId: loggedInUser.value.uid,
                displayName: loggedInUser.value.displayName || 'Anonymous',
                timestamp: serverTimestamp(),
            });
            newMessage.value = '';
			scrollToBottom();
            stopTyping();
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            isSending.value = false;
        }
    }
};

// Group messages by date (creates, yesterday, today and a specific date if far)

const groupedMessages = computed(() => {
    const grouped: any[] = [];
    let lastDate = '';

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const formatDateKey = (date: Date) => {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    const getFriendlyLabel = (date: Date) => {
        const key = formatDateKey(date);
        const todayKey = formatDateKey(today);
        const yesterdayKey = formatDateKey(yesterday);

        if (key === todayKey) return 'Today';
        if (key === yesterdayKey) return 'Yesterday';

        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: '2-digit',
            year: 'numeric',
        }).replace(',', ' -');
    };

    messages.value.forEach((message) => {
        if (!message.timestamp?.toDate) return;

        const dateObj = message.timestamp.toDate();
        const dateKey = formatDateKey(dateObj);

        if (dateKey !== lastDate) {
            grouped.push({
                id: `date-${dateKey}`,
                type: 'date',
                label: getFriendlyLabel(dateObj),
            });
            lastDate = dateKey;
        }

        grouped.push(message);
    });

    return grouped;
});

const originalTitle = document.title;

watch(
	newMessageCount,
	(newCount) => {
		if (newCount > 0 && !isUserNearBottom.value) {
		document.title = `(${newCount}) New message${newCount > 1 ? 's' : ''}`;
		} else {
		document.title = originalTitle;
		}
	}
);

// Typing Feature (Someone is typing...)

const typingDocRef = computed(() =>
    loggedInUser.value ? doc(db, 'typing', loggedInUser.value.uid) : null
); 
// ✅ Connects the logged-in user to their own document in the 'typing' collection
// (e.g., typing/{userId}) — used for writing their typing status

const handleTyping = async () => {
    if (typingDocRef.value) {
        await setDoc(typingDocRef.value, { isTyping: true });
    }
}; 
// ✅ Writing — sets 'isTyping: true' for the logged-in user's document (when they start typing)

const stopTyping = async () => {
    if (typingDocRef.value) {
        await setDoc(typingDocRef.value, { isTyping: false });
    }
}; 
// ✅ Writing — sets 'isTyping: false' for the logged-in user's document (when they stop typing)

const isSomeoneTyping = ref(false);

onMounted(() => {
	chatContainerRef.value?.addEventListener('scroll', handleScroll);
	
    if (db && loggedInUser.value) {
        const messagesRef = collection(db, 'messages_aports'); 
        // ✅ Reference to the 'messages_aports' collection in Firestore (used for storing messages)

        const q = query(messagesRef, orderBy('timestamp', 'asc')); 
        // ✅ Creates a query to fetch messages ordered by timestamp (ascending)

        onSnapshot(q, (snapshot) => {
			const newMessages = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));

			const lastMessage = newMessages[newMessages.length - 1];

			messages.value = newMessages;

			nextTick(() => {
				// Only trigger new message behavior if it’s from someone else
				if (lastMessage?.userId !== loggedInUser.value?.uid) {
					handleNewMessage(); // Show banner if receiver and not near bottom
				} else {
					scrollToBottom(); // Always scroll for the sender
				}
			});
		});

        const typingRef = collection(db, 'typing'); 
        // ✅ Reference to the 'typing' collection in Firestore (stores typing status per user)

        onSnapshot(typingRef, (snapshot) => {
            isSomeoneTyping.value = snapshot.docs.some(
                (doc) => doc.id !== loggedInUser.value?.uid && doc.data()?.isTyping
            );
        }); 
        // ✅ Listens for changes in typing status and sets `isSomeoneTyping` to true
        // if **any other user** (not the current one) has `isTyping: true`
    }
});


onBeforeUnmount(() => {
	chatContainerRef.value?.removeEventListener('scroll', handleScroll);
	document.title = originalTitle;
    stopTyping();
});
</script>

<template>
	<div class="md:w-[600px]">
		<h2 class="text-xl font-semibold mb-1">Chat</h2>

		<div
			ref="chatContainerRef"
			class="chat-messages border border-gray-300 p-2 mb-2 h-[500px] overflow-y-auto bg-white rounded"
		>
			<div
				v-for="(message, index) in groupedMessages"
				:key="message.id || index"
				class="message p-1 border-b border-dotted border-gray-200 last:border-b-0"
				:class="message.userId == loggedInUser?.uid ? 'flex text-right justify-end' : 'text-left'"
			>
				<!-- Date Separator -->
				<div v-if="message.type === 'date'" class="w-full text-center my-4">
					<div class="flex items-center justify-center gap-2 text-gray-500 text-sm">
					<hr class="flex-grow border-t border-gray-300" />
					<span class="px-2">{{ message.label }}</span>
					<hr class="flex-grow border-t border-gray-300" />
					</div>
				</div>

				<!-- Message Content -->
				<div v-else>
					<span class="text-gray-700 text-sm font-bold mr-1">
						{{ message.displayName || 'Anonymous' }}:
					</span>
					<div class="text-gray-600 text-left text-sm whitespace-pre-wrap mb-2">
						{{ message.text }}
					</div>
					<span class="timestamp text-[11px] text-gray-400">
						{{ formatTimestamp(message.timestamp) }}
					</span>
				</div>
			</div>
		</div>

		<div class="chat-input flex flex-col gap-2 items-start" v-if="loggedInUser">
			<p v-if="isSomeoneTyping" class="text-sm text-slate-600">Someone is typing...</p>
			
			<div class="relative flex w-full">

				<!-- New Message Notification -->
				<div v-if="newMessageCount > 0 && !isUserNearBottom" class="absolute right-50 top-0 flex justify-center z-10">
					<button 
						@click="scrollToBottom" 
						class="cursor-pointer bg-gradient-to-r from-blue-600 to-blue-400 text-white px-6 py-2 rounded-lg shadow-lg text-sm font-semibold hover:from-blue-500 hover:to-blue-300 transition-all"
					>
						New message{{ newMessageCount > 1 ? 's' : '' }} ({{ newMessageCount }})
					</button>
				</div>

				<!-- Message Input Area -->
				<div class="flex w-full">
					<textarea 
						v-model="newMessage" 
						placeholder="Type your message..." 
						@input="handleTyping" 
						@blur="stopTyping" 
						@keydown.enter.exact.prevent="sendMessage"
						rows="2"
						class="w-full p-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all"
						ref="textarea"
					/>
					
					<!-- Send Button -->
					<button
						@click="sendMessage"
						:disabled="!newMessage.trim() || isSending"
						class="w-25 ml-2 text-sm px-5 py-2 border border-gray-300 rounded-r-md bg-blue-500 hover:bg-blue-400 text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
					>
						Send
					</button>
				</div>
			</div>
		</div>

  	</div>
</template>
