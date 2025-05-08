// src/composables/useChatAnalytics.ts
import { logEvent, type Analytics } from 'firebase/analytics';
import { analytics } from '@/firebase'; // Import your initialized analytics instance

// Define the composable function
export function useChatAnalytics() {

  /**
   * Tracks the event when the message input textarea gains focus.
   */
  const trackMessageInputFocused = () => {
    if (analytics) {
      logEvent(analytics as Analytics, 'message_input_focused', {
        // Optional parameters for context, e.g.:
        // chat_location: window.location.pathname,
      });
      console.log('Analytics: Message input focused.');
    }
  };

  /**
   * Tracks the event when a message is successfully sent.
   * @param messageLength The length of the sent message.
   */
  const trackMessageSent = (messageLength: number) => {
    if (analytics) {
      logEvent(analytics as Analytics, 'message_sent', {
        message_length: messageLength,
        // Optional parameters, e.g.:
        // chat_location: window.location.pathname,
        // user_authenticated: !!auth.currentUser, // Example: track if user was logged in
      });
      console.log('Analytics: Message sent, length:', messageLength);
    }
  };

  /**
   * Tracks the event when a reaction is added to a message.
   * @param reactionType The type of reaction (e.g., 'like', 'heart').
   */
   const trackReactionAdded = (reactionType: string) => {
    if (analytics) {
      logEvent(analytics as Analytics, 'message_reaction_added', {
        reaction_type: reactionType,
        // Optional parameters, e.g.:
        // chat_location: window.location.pathname,
      });
      console.log('Analytics: Reaction added:', reactionType);
    }
   };


  // Return the tracking functions
  return {
    trackMessageInputFocused,
    trackMessageSent,
    trackReactionAdded,
  };
}