<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue';
import { auth, db } from '@/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { formatTimestamp } from '../composables/format';
import { useSmartChatScroll } from '@/composables/useSmartChatScroll';
import linkify from '@/composables/useLinkify';
import { useReactions } from '@/composables/useReactions';
import { useStagger } from '@/composables/useStagger';
import { useSendMessage } from '@/composables/useSendMessage';
import { useTyping } from '@/composables/useTyping';
import { useGroupedMessages } from '@/composables/useGroupedMessages';
import { useClipboardImage } from '@/composables/useClipboardImage'; // Import the new composable

import BanStatus from '@/components/BanStatus.vue';

const messageLimit = ref(15);
const allMessages = ref<ChatMessage[]>([]);
const hasMoreMessages = ref(true);

function updateVisibleMessages() {
    messages.value = allMessages.value.slice(-messageLimit.value);
    if (messageLimit.value >= allMessages.value.length) {
        hasMoreMessages.value = false;
    }
}

function loadMoreMessages() {
    if (hasMoreMessages.value) {
        const container = chatContainerRef.value;
        const oldScrollHeight = container?.scrollHeight || 0;

        messageLimit.value += 15;

        nextTick(() => {
        updateVisibleMessages();

        // Maintain scroll position after loading
        nextTick(() => {
            if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight;
            }
        });
        });
    }
}

const {
    chatContainerRef,
    isUserNearBottom,
    newMessageCount,
    scrollToBottom,
    handleScroll,
    handleNewMessage
} = useSmartChatScroll(loadMoreMessages);

const {
    reactions,
    fetchReactions,
    addReaction,
    toggleReactionPicker,
    groupedReactions,
    openReactionMessageId,
    reactionEmojis,
} = useReactions();

const {
    staggerEnter,
    staggerLeave
} = useStagger();

const newMessage = ref('');

const {
    sendMessage,
    isSending,
    isCurrentUserBanned,
    banReason,
    banEndTime,
    checkUserBanStatus
} = useSendMessage(newMessage);

const {
    isSomeoneTyping,
    handleTyping,
    stopTyping
} = useTyping();

// Use the new composable
const {
    imageUrl,
    shortenedImageUrl,
    isLoading: isProcessingImage, // Renamed for consistency with "processing"
    error: imageProcessError,    // Renamed for consistency with "processing"
    processClipboardImage, // Use the renamed function
    clearImage,
} = useClipboardImage();


interface ChatMessage {
    id: string;
    text: string;
    userId: string;
    displayName: string;
    timestamp: any;
}

const loggedInUser = computed(() => auth.currentUser);
const messages = ref<ChatMessage[]>([]);
const originalTitle = document.title;

const { groupedMessages } = useGroupedMessages(messages);

// Function to handle the paste event on the textarea
const handlePaste = async (event: ClipboardEvent) => {
    if (event.clipboardData && event.clipboardData.items) {
        const items = Array.from(event.clipboardData.items);
        const hasImage = items.some(item => item.type.indexOf('image') !== -1);

        if (hasImage) {
        event.preventDefault(); // Prevent default text paste if an image is detected
        await processClipboardImage(event);
        }
    }
};

// Create a wrapper function for sending messages
const sendChatMessage = async () => {
    // Call the original sendMessage from useSendMessage
    await sendMessage();
    // After the message is sent, clear the image preview
    clearImage();
};

// Watch for imageUrl changes and append to newMessage if available
watch(imageUrl, (newImageUrl) => {
    if (newImageUrl) {
        // Check if the URL is already present to avoid duplicates on re-paste attempts
        if (!newMessage.value.includes(newImageUrl)) {
        // Append the new image URL to the message. Add a newline for better readability.
        newMessage.value += `\n${newImageUrl}`;
        }
    }
});

const openImageInNewTab = () => {
    if (imageUrl.value) {
        window.open(imageUrl.value, '_blank');
    }
};

onMounted(() => {
    chatContainerRef.value?.addEventListener('scroll', handleScroll);

    checkUserBanStatus();

    if (db && loggedInUser.value) {
        const messagesRef = collection(db, 'messages_aports');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        onSnapshot(q, async (snapshot) => {
        allMessages.value = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as ChatMessage[];

        updateVisibleMessages();

        const visibleMessages = messages.value;
        visibleMessages.forEach((msg) => fetchReactions(msg.id));

        await Promise.all(
            visibleMessages.map((msg) => new Promise<void>((resolve) => {
            const reactionsRef = collection(db, 'messages_aports', msg.id, 'reactions');
            const reactionQuery = query(reactionsRef, orderBy('timestamp', 'asc'));

            const unsubscribe = onSnapshot(reactionQuery, (reactionSnap) => {
                const reactionsData = reactionSnap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                }));
                reactions.value[msg.id] = reactionsData;

                unsubscribe();
                resolve();
            });
            }))
        );

        nextTick(() => {
            const lastMessage = visibleMessages[visibleMessages.length - 1];

            if (lastMessage?.userId !== loggedInUser.value?.uid) {
            handleNewMessage();
            } else {
            scrollToBottom();
            }
        });
        });

    }
});

onBeforeUnmount(() => {
    chatContainerRef.value?.removeEventListener('scroll', handleScroll);
    document.title = originalTitle;
});

</script>

<template>
    <div class="h-screen flex flex-col py-5 px-5 bg-slate-50">
        <div class="min-h-[5%] flex justify-between items-center">
        <h2 class="text-xl font-semibold">Chat</h2>
        <div class="flex items-center pb-1">
            <div>
            <img draggable="false" class="w-6" src="/nexus.png" alt="">
            </div>
            &nbsp;
            <p class="text-[12px] text-slate-400">— v0.5.0.1</p>
        </div>
        </div>

        <div
        ref="chatContainerRef"
        class="relative flex-1 chat-messages border border-gray-300 p-2 pl-3 my-2 overflow-y-auto bg-white rounded"
        >
        <div
            v-for="(message, index) in groupedMessages"
            :key="message.id || index"
            class="flex message p-1 border-b border-dotted border-gray-200 last:border-b-0"
            :class="message.userId == loggedInUser?.uid ? 'text-right justify-end' : 'text-left'"
        >
            <div v-if="message.type === 'date'" class="w-full text-center my-4">
            <div class="flex items-center justify-center gap-2 text-gray-500 text-sm">
                <hr class="flex-grow border-t border-gray-300" />
                <span class="px-2">{{ message.label }}</span>
                <hr class="flex-grow border-t border-gray-300" />
            </div>
            </div>

            <div v-else>
            <span class="text-gray-700 text-sm font-bold mr-1">
                {{ message.displayName[0].toUpperCase() + message.displayName.slice(1) || 'Anonymous' }}:
            </span>

            <div
                class="text-left text-gray-600 text-sm whitespace-pre-wrap p-3 mb-2 rounded-lg"
                :class="message.userId == loggedInUser?.uid ? 'bg-gray-700 text-white' : 'bg-gray-200 text-black'"
                v-html="linkify(message.text)"
            ></div>

            <Transition
                name="reactions-popup"
                @enter="staggerEnter"
                @leave="staggerLeave"
                :css="false"
            >
                <div v-if="openReactionMessageId === message.id" class="flex space-x-2 mt-2 *:cursor-pointer">
                <button
                    v-for="(emoji, type, index) in reactionEmojis"
                    :key="type"
                    @click="addReaction(message.id, type)"
                    :style="{ transitionDelay: `${index * 200}ms` }"
                >
                    {{ emoji }}
                </button>
                </div>
            </Transition>

            <div v-if="groupedReactions[message.id]" class="mt-2 text-sm text-gray-600 flex gap-2">
                <span
                v-for="(data, type) in groupedReactions[message.id]"
                :key="type"
                class="relative group flex items-center bg-gray-100 px-2 py-1 rounded-full"
                >
                {{ reactionEmojis[type] }} {{ data.count }}
                <div
                    class="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
                >
                    {{ data.users.join(', ') }}
                </div>
                </span>
                <p @click="toggleReactionPicker(message.id)" class="cursor-pointer flex items-center bg-gray-100 px-2 py-1 rounded-full">+</p>
            </div>

            <span class="timestamp text-[11px] text-gray-400">
                {{ formatTimestamp(message.timestamp) }}
            </span>
            </div>
        </div>
        </div>


        <div class="min-h-[5%] chat-input flex flex-col gap-2 items-start bg-white" v-if="loggedInUser">
        <p v-if="isSomeoneTyping" class="text-sm text-slate-600">Someone is typing...</p>

        <div class="relative flex w-full">

            <div v-if="newMessageCount > 0 && !isUserNearBottom" class="absolute left-0 z-10">
            <button
                @click="() => scrollToBottom()"
                class="cursor-pointer bg-gradient-to-r from-blue-600 to-blue-400 text-white px-6 py-2 rounded-lg shadow-lg text-sm font-semibold hover:from-blue-500 hover:to-blue-300 transition-all"
            >
                New message{{ newMessageCount > 1 ? 's' : '' }} ({{ newMessageCount }})
            </button>
            </div>

            <div class="w-full">
            <div v-if="isCurrentUserBanned" class="ban-message text-center py-2 px-4 rounded-md">
                <BanStatus
                :is-banned="isCurrentUserBanned"
                :reason="banReason"
                :ban-ends-at="banEndTime"
                :on-ban-expired="checkUserBanStatus"
                />
            </div>

            <div v-else class="flex w-full flex-col">
                <div v-if="imageUrl" class="mb-2 p-2 border border-gray-300 rounded-md bg-gray-100 flex items-center justify-between">
                    <img :src="imageUrl" alt="Pasted Image" class="max-h-20 max-w-[100px] object-contain cursor-pointer" @click="openImageInNewTab" />
                    <p class="text-xs text-gray-600 mx-2 break-all">{{ shortenedImageUrl }}</p>
                    <button @click="clearImage" class="ml-auto text-red-500 hover:text-red-700 font-bold">X</button>
                </div>
                <p v-if="imageProcessError" class="text-red-500 text-sm mb-2">{{ imageProcessError }}</p>

                <div class="flex w-full">
                <textarea
                    v-model="newMessage"
                    placeholder="Type your message..."
                    @input="handleTyping"
                    @blur="stopTyping"
                    @keydown.enter.exact.prevent="sendChatMessage"
                    @paste="handlePaste" rows="2"
                    class="w-full p-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all"
                    :disabled="isCurrentUserBanned || isProcessingImage"
                />
                <!-- <button
                    @click="processClipboardImage($event as unknown as ClipboardEvent)" :disabled="isProcessingImage || isCurrentUserBanned"
                    class="w-auto ml-2 text-sm px-3 py-2 border border-gray-300 bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all rounded-none"
                >
                    {{ isProcessingImage ? 'Pasting...' : 'Paste Image' }}
                </button> -->
                <button
                    @click="sendChatMessage"
                    :disabled="!newMessage.trim() || isSending || isCurrentUserBanned || isProcessingImage"
                    class="w-25 ml-2 text-sm px-5 py-2 border border-gray-300 rounded-r-md bg-blue-500 hover:bg-blue-400 text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                >
                    Send
                </button>
                </div>
            </div>
            </div>
        </div>
        </div>

    </div>
</template>