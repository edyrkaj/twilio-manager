export type Channel = "sms" | "whatsapp";

export type MessageLike = {
  from: string;
  to: string;
  direction: string;
  date_created: string;
};

const WHATSAPP_PREFIX = "whatsapp:";

export function isWhatsAppAddress(address: string): boolean {
  return address.toLowerCase().startsWith(WHATSAPP_PREFIX);
}

export function stripChannelPrefix(address: string): string {
  if (isWhatsAppAddress(address)) {
    return address.slice(WHATSAPP_PREFIX.length);
  }
  return address;
}

export function formatAddress(channel: Channel, address: string): string {
  const stripped = stripChannelPrefix(address.trim());
  switch (channel) {
    case "whatsapp":
      return `${WHATSAPP_PREFIX}${stripped}`;
    case "sms":
      return stripped;
    default: {
      const _exhaustive: never = channel;
      return _exhaustive;
    }
  }
}

export function messageChannel(from: string, to: string): Channel {
  return isWhatsAppAddress(from) || isWhatsAppAddress(to) ? "whatsapp" : "sms";
}

export function filterMessagesByChannel<T extends Pick<MessageLike, "from" | "to">>(
  messages: T[],
  channel: Channel
): T[] {
  return messages.filter((msg) => messageChannel(msg.from, msg.to) === channel);
}

export function conversationPartner(message: MessageLike): string {
  const partner = message.direction.startsWith("outbound")
    ? message.to
    : message.from;
  return stripChannelPrefix(partner);
}

export function groupConversations<T extends MessageLike>(
  messages: T[]
): [string, T[]][] {
  const grouped = messages.reduce((acc, msg) => {
    const partner = conversationPartner(msg);
    const list = acc.get(partner) ?? [];
    list.push(msg);
    acc.set(partner, list);
    return acc;
  }, new Map<string, T[]>());

  return Array.from(grouped).sort(([, a], [, b]) => {
    const tA = new Date(a[0].date_created).getTime();
    const tB = new Date(b[0].date_created).getTime();
    return tB - tA;
  });
}
