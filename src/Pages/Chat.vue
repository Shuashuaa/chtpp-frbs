<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue';
import { auth, db } from '@/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { formatTimestamp } from '../composables/format';
import { useSmartChatScroll } from '@/composables/useSmartChatScroll';
import linkify from '@/composables/useLinkify';

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

import { useReactions } from '@/composables/useReactions';
const {
  reactions,
  fetchReactions,
  addReaction,
  toggleReactionPicker,
  groupedReactions,
  openReactionMessageId,
  reactionEmojis,
} = useReactions();

import { useStagger } from '@/composables/useStagger';
const {
    staggerEnter,
    staggerLeave
} = useStagger();

const newMessage = ref('');

import { useSendMessage } from '@/composables/useSendMessage';
const {
    sendMessage,
    isSending
} = useSendMessage(newMessage);

import { useTyping } from '@/composables/useTyping';
const {
    isSomeoneTyping,
    handleTyping,
    stopTyping
} = useTyping();

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

import { useGroupedMessages } from '@/composables/useGroupedMessages';
const { groupedMessages } = useGroupedMessages(messages);

//======================== End of Declaration ===============================

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

onMounted(() => {
	chatContainerRef.value?.addEventListener('scroll', handleScroll);
	
    if (db && loggedInUser.value) {
        const messagesRef = collection(db, 'messages_aports'); 
        // ✅ Reference to the 'messages_aports' collection in Firestore (used for storing messages)

        const q = query(messagesRef, orderBy('timestamp', 'asc')); 
        // ✅ Creates a query to fetch messages ordered by timestamp (ascending)

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
			class="flex-1 chat-messages border border-gray-300 p-2 my-2 overflow-y-auto bg-white rounded"
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
						{{ message.displayName[0].toUpperCase() + message.displayName.slice(1) || 'Anonymous' }}:
					</span>
                    <div
                        class="text-gray-600 text-left text-sm whitespace-pre-wrap mb-2"
                        v-html="linkify(message.text)"
                    ></div>

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

				<!-- New Message Notification -->
				<div v-if="newMessageCount > 0 && !isUserNearBottom" class="absolute left-0 z-10">
					<button 
						@click="() => scrollToBottom()" 
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