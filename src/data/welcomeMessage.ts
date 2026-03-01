import { WelcomeButton } from '../services/whatsapp';

// Welcome text shown above the buttons (or as plain-text fallback)
export const WELCOME_MESSAGE = `Olá! 👋 Sou a Luna, assistente virtual do Grupo Futura União.
Como posso te ajudar hoje?

1️⃣ Tirar dúvidas sobre seguros
2️⃣ Fazer uma cotação
3️⃣ Falar com um atendente`;

// Text displayed above the interactive buttons (shorter — buttons carry the options)
export const WELCOME_BUTTON_TEXT = 'Olá! 👋 Sou a Luna, assistente virtual do Grupo Futura União.\nComo posso te ajudar hoje?';

// Interactive buttons for Z-API (max 3)
export const WELCOME_BUTTONS: WelcomeButton[] = [
  { id: '1', label: 'Dúvidas sobre seguros' },
  { id: '2', label: 'Fazer cotação' },
  { id: '3', label: 'Falar com atendente' },
];
