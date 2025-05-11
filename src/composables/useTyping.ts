import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { auth, db } from '@/firebase';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';

export function useTyping() {
    
	const isSomeoneTyping = ref(false);
	const loggedInUser = computed(() => auth.currentUser);

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

	let unsubscribeTypingSnapshot: () => void;

	onMounted(() => {
		if (db && loggedInUser.value) {

            const typingRef = collection(db, 'typing'); 
            // ✅ Reference to the 'typing' collection in Firestore (stores typing status per user)

            unsubscribeTypingSnapshot = onSnapshot(typingRef, (snapshot) => {
                isSomeoneTyping.value = snapshot.docs.some(
                    (doc) => doc.id !== loggedInUser.value?.uid && doc.data()?.isTyping // checks if 'isTyping' is true or false
                );
            }); 
            // ✅ Listens for changes in typing status and sets `isSomeoneTyping` to true
            // if **any other user** (not the current one) has `isTyping: true`
        }
	});

	onBeforeUnmount(() => {
		if (unsubscribeTypingSnapshot) unsubscribeTypingSnapshot();
		stopTyping();
	});

	return {
		isSomeoneTyping,
		handleTyping,
		stopTyping,
	};
}
