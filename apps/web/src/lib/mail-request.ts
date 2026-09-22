export type KenbeiMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function resendMailRequest(input: KenbeiMailInput & { apiKey: string; from: string }): {
  url: string;
  headers: { Authorization: string; "Content-Type": string };
  body: { from: string; to: string[]; subject: string; text: string; html: string };
} {
  return {
    url: "https://api.resend.com/emails",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    },
  };
}
