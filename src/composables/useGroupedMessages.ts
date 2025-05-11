// composables/useGroupedMessages.ts
import { computed, type Ref } from 'vue';

interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  displayName: string;
  timestamp: any;
}

// Group messages by date (creates, yesterday, today and a specific date if far)
export function useGroupedMessages(messages: Ref<ChatMessage[]>) {
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

  return {
    groupedMessages,
  };
}
