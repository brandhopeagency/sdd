import type { AgentMemorySystemMessage } from '../../types/agentMemory';
import type { StoredConversation } from '../../types/conversation';

export function buildAgentMemoryAggregationPrompt(input: {
  existingMemory: AgentMemorySystemMessage[];
  conversation: StoredConversation;
}): string {
  const { existingMemory, conversation } = input;

  const memoryJson = JSON.stringify(existingMemory, null, 2);
  const transcript = conversation.messages
    .map((m) => `[${m.timestamp}] ${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  return `
Ти — модуль "пам'ять агента" (memory consolidator). Твоє завдання: оновити довготривалу пам'ять про користувача на основі нової закритої сесії.

ВАЖЛИВО:
- Додавай ТІЛЬКИ факти/стани, які явно згадував користувач у своїх повідомленнях. Не вигадуй і не домислюй.
- Дозволено зберігати персональні факти, якщо користувач прямо їх назвав (напр. ім'я, вік, професія). Не домислюй і не вигадуй.
- Уникай медичних діагнозів від себе. Можна зберігати "користувач сказав, що..." та "користувач відчував ...".
- Пам'ять має бути короткою, практичною і стабільною: видаляй застаріле, прибирай дублікати, суперечності позначай як "конфлікт" і тримай найновішу версію.
- Не додавай плейсхолдери типу "немає даних/нет данных/no data". Якщо по секції немає інформації — просто не повертай її.

ФОРМАТ ВИХОДУ (строго!):
- Поверни ТІЛЬКИ валідний JSON масив об'єктів.
- Кожен об'єкт має вигляд: { "role": "system", "content": "<text>", "meta": { ... optional ... } }
- Не додавай нічого поза JSON (без markdown, без пояснень).

ЩО ПОТРІБНО АГРЕГУВАТИ:
1) Стабільні факти про користувача (приклади: цілі, контекст життя, важливі події, ролі/обовʼязки, обмеження).
2) Уподобання та межі (як користувач хоче, щоб з ним спілкувалися; тригери; що допомагає/не допомагає).
3) Історія станів/відчуттів з часовою прив'язкою:
   - Витягни моменти, коли користувач описує стан (тривога/втома/радість/злість/страх/пригніченість тощо).
   - Записуй як лінії: "- <ISO time>: <state> (intensity 0..1, якщо можна оцінити) — цитата/перефраз коротко".

ІСНУЮЧА ПАМ'ЯТЬ (JSON):
${memoryJson}

НОВА ЗАКРИТА СЕСІЯ:
- sessionId: ${conversation.sessionId}
- startedAt: ${conversation.startedAt}
- endedAt: ${conversation.endedAt}
- languageCode: ${conversation.metadata.languageCode}

ТРАНСКРИПТ:
${transcript}

Тепер згенеруй оновлений JSON масив системних повідомлень. Рекомендована структура масиву (але можна адаптувати):
1) MEMORY: Facts
2) MEMORY: Preferences
3) MEMORY: State timeline
`;
}

export function buildInitialAssistantMessagePrompt(input: {
  memory: AgentMemorySystemMessage[];
  languageCode: string;
}): string {
  const memoryJson = JSON.stringify(input.memory, null, 2);
  const lang = input.languageCode || 'uk';

  return `
Ти — чат-асистент. Сформуй перше ініціативне повідомлення для початку нової сесії, використовуючи довготривалу пам'ять про користувача.

Вимоги:
- Мова відповіді: ${lang}.
- Тон: доброзичливий, підтримуючий, без нав'язливості.
- 1–3 короткі речення.
- Згадай 1 релевантний факт/контекст з пам'яті (якщо є) без деталей, що можуть бути чутливими.
- Заверши відкритим питанням "що зараз" / "як ти" / "з чого почнемо".
- Не згадуй слово "пам'ять", "системні повідомлення", "JSON".

ПАМ'ЯТЬ (JSON):
${memoryJson}

Відповідай тільки текстом повідомлення (без лапок, без markdown).
`;
}

