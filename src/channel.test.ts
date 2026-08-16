import { describe, expect, test } from "vitest";
import {
  filterMessagesByChannel,
  formatAddress,
  groupConversations,
  isWhatsAppAddress,
  messageChannel,
  stripChannelPrefix,
} from "./channel";

describe("isWhatsAppAddress", () => {
  test("detects the whatsapp: prefix", () => {
    expect(isWhatsAppAddress("whatsapp:+15557318728")).toBe(true);
  });

  test("rejects a bare E.164 number", () => {
    expect(isWhatsAppAddress("+15557318728")).toBe(false);
  });
});

describe("stripChannelPrefix", () => {
  test("removes the whatsapp: prefix", () => {
    expect(stripChannelPrefix("whatsapp:+15557318728")).toBe("+15557318728");
  });

  test("leaves SMS numbers unchanged", () => {
    expect(stripChannelPrefix("+15551234567")).toBe("+15551234567");
  });
});

describe("formatAddress", () => {
  test("prefixes a bare number for WhatsApp", () => {
    expect(formatAddress("whatsapp", "+15557318728")).toBe(
      "whatsapp:+15557318728"
    );
  });

  test("does not double-prefix WhatsApp numbers", () => {
    expect(formatAddress("whatsapp", "whatsapp:+15557318728")).toBe(
      "whatsapp:+15557318728"
    );
  });

  test("returns a bare number for SMS", () => {
    expect(formatAddress("sms", "whatsapp:+15551234567")).toBe("+15551234567");
  });
});

describe("messageChannel", () => {
  test("classifies a WhatsApp inbound as whatsapp", () => {
    expect(messageChannel("whatsapp:+15550001111", "whatsapp:+15557318728")).toBe(
      "whatsapp"
    );
  });

  test("classifies SMS as sms", () => {
    expect(messageChannel("+15550001111", "+15551234567")).toBe("sms");
  });
});

describe("filterMessagesByChannel", () => {
  const sms = {
    from: "+15550001111",
    to: "+15551234567",
    direction: "inbound",
    date_created: "2026-08-16T10:00:00Z",
  };
  const wa = {
    from: "whatsapp:+15550002222",
    to: "whatsapp:+15557318728",
    direction: "inbound",
    date_created: "2026-08-16T11:00:00Z",
  };

  test("keeps only WhatsApp messages on the WhatsApp tab", () => {
    expect(filterMessagesByChannel([sms, wa], "whatsapp")).toEqual([wa]);
  });

  test("keeps only SMS messages on the Messages tab", () => {
    expect(filterMessagesByChannel([sms, wa], "sms")).toEqual([sms]);
  });
});

describe("groupConversations", () => {
  test("groups by the remote number without the whatsapp: prefix", () => {
    const messages = [
      {
        from: "whatsapp:+15550002222",
        to: "whatsapp:+15557318728",
        direction: "inbound",
        date_created: "2026-08-16T12:00:00Z",
      },
      {
        from: "whatsapp:+15557318728",
        to: "whatsapp:+15550002222",
        direction: "outbound-api",
        date_created: "2026-08-16T12:01:00Z",
      },
    ];

    const grouped = groupConversations(messages);
    expect(grouped).toHaveLength(1);
    expect(grouped[0][0]).toBe("+15550002222");
    expect(grouped[0][1]).toHaveLength(2);
  });
});
