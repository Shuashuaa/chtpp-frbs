<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { db, auth } from '@/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const onlineUsers = ref<any[]>([]);
const offlineUsers = ref<any[]>([]);
const unsubscribe = ref<() => void | null>();
const unsubscribeOffline = ref<() => void | null>();

const setUserStatus = async (online: boolean, idle: boolean) => {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, 'online_users', user.uid);
  try {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || 'Anonymous',
      isOnline: online,
      isIdle: idle,
      lastSeen: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.error("Failed to update user status", e);
  }
};

onMounted(() => {
  setUserStatus(true, false); // Online and active

  const q = query(collection(db, 'online_users'), where('isOnline', '==', true));
  unsubscribe.value = onSnapshot(q, (snapshot) => {
    const users: any[] = [];
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    onlineUsers.value = users;
  });

  const q1 = query(collection(db, 'online_users'), where('isOnline', '==', false));
  unsubscribeOffline.value = onSnapshot(q1, (snapshot) => {
    const users: any[] = [];
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    offlineUsers.value = users;
  });

  // 👁 Set idle when not in focus
  window.addEventListener('blur', () => setUserStatus(true, true));
  window.addEventListener('focus', () => setUserStatus(true, false));
  window.addEventListener('beforeunload', () => setUserStatus(false, false));
});

onUnmounted(() => {
  setUserStatus(false, false); // Mark offline
  unsubscribe.value?.();
  unsubscribeOffline.value?.();
  window.removeEventListener('blur', () => setUserStatus(true, true));
  window.removeEventListener('focus', () => setUserStatus(true, false));
  window.removeEventListener('beforeunload', () => setUserStatus(false, false));
});
</script>


<template>
  <div class="border border-slate-300 p-3 rounded-md bg-white">
    <h3 class="text-lg font-semibold mb-2">Users</h3>
    <p class="italic text-sm text-slate-400">
      online — ({{ onlineUsers.length }})
    </p>
    <ul>
      <li v-for="user in onlineUsers" :key="user.id" class="mb-1">
        <span
          class="inline-block w-2 h-2 rounded-full mr-2"
          :class="user.isIdle ? 'bg-yellow-400' : 'bg-green-500'"
        />
        <p class="inline-block text-sm text-slate-700">{{ user.displayName[0].toUpperCase() + user.displayName.slice(1) }}</p>
      </li>
      <!-- <li v-if="onlineUsers.length === 0">No users online.</li> -->
    </ul>

    <p class="italic text-sm text-slate-400">
      offline — ({{ offlineUsers.length }})
    </p>
    <ul>
      <li v-for="user in offlineUsers" :key="user.id" class="mb-1">
        <span class="inline-block w-2 h-2 bg-slate-400 rounded-full mr-2"></span>
        <p class="inline-block text-sm text-slate-700">{{ user.displayName[0].toUpperCase() + user.displayName.slice(1) }}</p>
      </li>
      <!-- <li v-if="onlineUsers.length === 0">No users online.</li> -->
    </ul>
  </div>
</template>
