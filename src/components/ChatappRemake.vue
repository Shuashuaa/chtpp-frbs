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
import { useChatAnalytics } from '@/composables/useChatAnalytics';

const { 
    trackMessageInputFocused, 
    trackMessageSent, 
    trackReactionAdded 
} = useChatAnalytics();

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
// const isEmojiOn = ref(false);
const messageTextareaRef = ref<HTMLTextAreaElement | null>(null);

const sendMessage = async () => {
    const messageText = newMessage.value.trim();
    if (messageText && loggedInUser.value && db && !isSending.value) {
        isSending.value = true;
        try {
            await addDoc(collection(db, 'messages_aports'), {
                text: messageText,
                userId: loggedInUser.value.uid,
                displayName: loggedInUser.value.displayName || 'Anonymous',
                timestamp: serverTimestamp(),
            });

            trackMessageSent(messageText.length);

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

const reactionEmojis: Record<string, string> = {
    like: '👍',
    heart: '❤️',
    haha: '😂',
    angry: '😡',
    sad: '😢',
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

const openReactionMessageId = ref<string | null>(null);

const addReaction = async (messageId: string, reactionType: string) => {
    if (loggedInUser.value) {
        try {
            await addDoc(collection(db, 'messages_aports', messageId, 'reactions'), {
                userId: loggedInUser.value.uid,
                type: reactionType,
                timestamp: serverTimestamp(),
            });

            trackReactionAdded(reactionType);

            openReactionMessageId.value = null;

        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    }
};

const reactions = ref<any>({});

const fetchReactions = async (messageId: string) => {
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

const toggleReactionPicker = (messageId: string) => {
  if (openReactionMessageId.value === messageId) {
    openReactionMessageId.value = null; // Close if already open for this message
  } else {
    openReactionMessageId.value = messageId; // Open for the clicked message
  }
};

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

    if (messageTextareaRef.value) {
        messageTextareaRef.value.addEventListener('focus', trackMessageInputFocused);
    }
	
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

			messages.value = newMessages;

			newMessages.forEach((msg) => fetchReactions(msg.id)); // fetching reactions

			const lastMessage = newMessages[newMessages.length - 1];
            console.log(lastMessage, 'lastMessage');

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
                (doc) => doc.id !== loggedInUser.value?.uid && doc.data()?.isTyping // checks if 'isTyping' is true or false
            );
        }); 
        // ✅ Listens for changes in typing status and sets `isSomeoneTyping` to true
        // if **any other user** (not the current one) has `isTyping: true`
    }
});


onBeforeUnmount(() => {
	chatContainerRef.value?.removeEventListener('scroll', handleScroll);

    if (messageTextareaRef.value) {
        messageTextareaRef.value.removeEventListener('focus', trackMessageInputFocused);
    }

	document.title = originalTitle;
    stopTyping();
});

const staggerEnter = (el: Element, done: () => void) => {
    // 'el' is the div containing the buttons
    const buttons = el.querySelectorAll('button'); // Get all button children
    const delay = 200; // ms per button

    // Set initial state (same as enter-from)
    (el as HTMLElement).style.opacity = '0';
    (el as HTMLElement).style.transform = 'scale(0.8)';
    (el as HTMLElement).style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';

    // Force reflow to ensure transition starts from initial state
    document.body.offsetHeight;

    // Animate the container first
    (el as HTMLElement).style.opacity = '1';
    (el as HTMLElement).style.transform = 'scale(1)';

    buttons.forEach((button: HTMLElement) => {
        button.style.opacity = '0';
        button.style.transform = 'scale(0.8)';
        button.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
    });

    // Wait a tiny bit or use nextTick, then apply final state with staggered delay
    nextTick(() => {
        buttons.forEach((button: HTMLElement, index: number) => {
        setTimeout(() => {
            button.style.opacity = '1';
            button.style.transform = 'scale(1)';
        }, index * delay);
        });

        // Call done when the *longest* individual button animation should be finished
        // Or, if only animating opacity/scale on container, call done after container transition duration
        const totalDuration = 300; // 0.3s from CSS
        const totalDelay = (buttons.length - 1) * delay;
        setTimeout(done, totalDuration + totalDelay); // Wait for the last button to finish

    });
};

const staggerLeave = (el: Element, done: () => void) => {
    const buttons = el.querySelectorAll('button');
    const delay = 50; // ms per button
    const duration = 300; // ms for animation
    const totalButtons = buttons.length;

    // Set the transition property for all buttons
    buttons.forEach((button: HTMLElement) => {
        button.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`;
    });

    // Apply final state with reversed stagger delay
    buttons.forEach((button: HTMLElement, index: number) => {
        const leaveDelay = (totalButtons - 1 - index) * delay; // Reverse delay
        setTimeout(() => {
        // Apply final state to trigger transition
        button.style.opacity = '0';
        button.style.transform = 'scale(0.8)';
        }, leaveDelay);
    });

    // Call done after the last animation is expected to finish
    const totalDelay = (totalButtons - 1) * delay;
    setTimeout(done, totalDelay + duration);
};

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

					<!-- Reaction Buttons -->
					<Transition name="reactions-popup"
                    @enter="staggerEnter"
                    @leave="staggerLeave"
                    :css="false">
                        <div v-if="openReactionMessageId === message.id" class="flex space-x-2 mt-2 *:cursor-pointer">
                            <button
                                v-for="(emoji, type, index) in reactionEmojis"
                                :key="type"
                                @click="addReaction(message.id, type)"
                                :style="{ transitionDelay: `${index * 200}ms` }" >
                                {{ emoji }}
                            </button>
                        </div>
                    </Transition>

					<!-- Display Reactions -->
					<div v-if="groupedReactions[message.id]" class="mt-2 text-sm text-gray-600 flex gap-2">
						<span
							v-for="(count, type) in groupedReactions[message.id]"
							:key="type"
							class="flex items-center bg-gray-100 px-2 py-1 rounded-full"
						>
							{{ reactionEmojis[type] }} {{ count }}
						</span>
						<p @click="toggleReactionPicker(message.id)" class="cursor-pointer flex items-center bg-gray-100 px-2 py-1 rounded-full">+</p>
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
						ref="messageTextareaRef"
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