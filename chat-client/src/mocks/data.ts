import { User, Session, ChatMessage, Tag, UserRole, Annotation } from '../types';

// Helper to create dates relative to now
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

// Mock Users
export const mockUsers: User[] = [
  {
    id: 'usr_001',
    email: 'alex.chen@example.com',
    displayName: 'Alex Chen',
    role: UserRole.USER,
    status: 'active',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: hoursAgo(2),
    sessionCount: 42,
    createdAt: daysAgo(90),
    updatedAt: hoursAgo(2),
    metadata: {}
  },
  {
    id: 'usr_002',
    email: 'sarah.miller@example.com',
    displayName: 'Sarah Miller',
    role: UserRole.USER,
    status: 'blocked',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: daysAgo(5),
    sessionCount: 12,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(5),
    metadata: { blockReason: 'Inappropriate content' }
  },
  {
    id: 'usr_003',
    email: 'john.davis@example.com',
    displayName: 'John Davis',
    role: UserRole.QA_SPECIALIST,
    status: 'active',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: hoursAgo(1),
    sessionCount: 156,
    createdAt: daysAgo(180),
    updatedAt: hoursAgo(1),
    metadata: {}
  },
  {
    id: 'usr_004',
    email: 'emily.rodriguez@example.com',
    displayName: 'Emily Rodriguez',
    role: UserRole.RESEARCHER,
    status: 'active',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: minutesAgo(30),
    sessionCount: 8,
    createdAt: daysAgo(45),
    updatedAt: minutesAgo(30),
    metadata: {}
  },
  {
    id: 'usr_005',
    email: 'michael.brown@example.com',
    displayName: 'Michael Brown',
    role: UserRole.MODERATOR,
    status: 'active',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: hoursAgo(4),
    sessionCount: 23,
    createdAt: daysAgo(120),
    updatedAt: hoursAgo(4),
    metadata: {}
  },
  {
    id: 'usr_006',
    email: 'admin@mentalhealth.org',
    displayName: 'System Admin',
    role: UserRole.OWNER,
    status: 'active',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: minutesAgo(10),
    sessionCount: 5,
    createdAt: daysAgo(365),
    updatedAt: minutesAgo(10),
    metadata: {}
  },
  {
    id: 'usr_007',
    email: 'lisa.wong@example.com',
    displayName: 'Lisa Wong',
    role: UserRole.USER,
    status: 'active',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: daysAgo(1),
    sessionCount: 28,
    createdAt: daysAgo(75),
    updatedAt: daysAgo(1),
    metadata: {}
  },
  {
    id: 'usr_008',
    email: 'james.taylor@example.com',
    displayName: 'James Taylor',
    role: UserRole.USER,
    status: 'pending',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: null,
    sessionCount: 0,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    metadata: {}
  },
  {
    id: 'usr_009',
    email: 'anonymous_001@deleted.local',
    displayName: '[Anonymized User]',
    role: UserRole.USER,
    status: 'anonymized',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: daysAgo(30),
    sessionCount: 15,
    createdAt: daysAgo(200),
    updatedAt: daysAgo(10),
    metadata: { erasedAt: daysAgo(10).toISOString() }
  },
  {
    id: 'usr_010',
    email: 'karen.smith@example.com',
    displayName: 'Karen Smith',
    role: UserRole.USER,
    status: 'active',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: hoursAgo(8),
    sessionCount: 67,
    createdAt: daysAgo(150),
    updatedAt: hoursAgo(8),
    metadata: {}
  }
];

// Mock Sessions
export const mockSessions: Session[] = [
  {
    id: 'sess_001',
    userId: 'usr_001',
    userName: 'Alex Chen',
    dialogflowSessionId: 'df_abc123',
    status: 'ended',
    startedAt: daysAgo(2),
    endedAt: daysAgo(2),
    duration: 1800000, // 30 min
    messageCount: 24,
    moderationStatus: 'pending',
    tags: ['anxiety', 'work-stress'],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  },
  {
    id: 'sess_002',
    userId: 'usr_001',
    userName: 'Alex Chen',
    dialogflowSessionId: 'df_def456',
    status: 'ended',
    startedAt: daysAgo(5),
    endedAt: daysAgo(5),
    duration: 2400000, // 40 min
    messageCount: 32,
    moderationStatus: 'moderated',
    tags: ['depression', 'sleep-issues'],
    createdAt: daysAgo(5),
    updatedAt: daysAgo(4)
  },
  {
    id: 'sess_003',
    userId: 'usr_007',
    userName: 'Lisa Wong',
    dialogflowSessionId: 'df_ghi789',
    status: 'ended',
    startedAt: daysAgo(1),
    endedAt: daysAgo(1),
    duration: 900000, // 15 min
    messageCount: 12,
    moderationStatus: 'in_review',
    tags: ['grief'],
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(6)
  },
  {
    id: 'sess_004',
    userId: 'usr_010',
    userName: 'Karen Smith',
    dialogflowSessionId: 'df_jkl012',
    status: 'active',
    startedAt: hoursAgo(1),
    endedAt: null,
    duration: undefined,
    messageCount: 8,
    moderationStatus: 'pending',
    tags: [],
    createdAt: hoursAgo(1),
    updatedAt: minutesAgo(5)
  },
  {
    id: 'sess_005',
    userId: 'usr_002',
    userName: 'Sarah Miller',
    dialogflowSessionId: 'df_mno345',
    status: 'ended',
    startedAt: daysAgo(6),
    endedAt: daysAgo(6),
    duration: 3600000, // 60 min
    messageCount: 45,
    moderationStatus: 'moderated',
    tags: ['crisis', 'suicidal-ideation', 'escalated'],
    createdAt: daysAgo(6),
    updatedAt: daysAgo(5)
  }
];

// Mock Messages for a sample session
export const mockMessages: ChatMessage[] = [
  {
    id: 'msg_001',
    sessionId: 'sess_001',
    role: 'assistant',
    content: "Hello! I'm here to support you. How are you feeling today?",
    timestamp: daysAgo(2),
    feedback: null,
    metadata: {
      intent: 'greeting',
      confidence: 0.98,
      responseTimeMs: 245
    },
    tags: [],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  },
  {
    id: 'msg_002',
    sessionId: 'sess_001',
    role: 'user',
    content: "I've been feeling really overwhelmed lately with work and everything going on.",
    timestamp: daysAgo(2),
    feedback: null,
    metadata: {},
    tags: [],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  },
  {
    id: 'msg_003',
    sessionId: 'sess_001',
    role: 'assistant',
    content: "I hear you, and it sounds like you're carrying a lot right now. Feeling overwhelmed is completely valid, especially when multiple areas of life feel demanding at once.\n\nWould you like to tell me more about what's been weighing on you the most?",
    timestamp: daysAgo(2),
    feedback: { rating: 4, comment: null, submittedAt: daysAgo(2) },
    metadata: {
      intent: 'mental_health.feeling_overwhelmed',
      confidence: 0.94,
      responseTimeMs: 342,
      parameters: { emotion: 'overwhelmed', severity: 'moderate' }
    },
    tags: ['empathetic', 'validation'],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  },
  {
    id: 'msg_004',
    sessionId: 'sess_001',
    role: 'user',
    content: "It's mainly work. My boss keeps piling on more projects and I don't know how to say no. I end up working late every night and I'm exhausted.",
    timestamp: daysAgo(2),
    feedback: null,
    metadata: {},
    tags: [],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  },
  {
    id: 'msg_005',
    sessionId: 'sess_001',
    role: 'assistant',
    content: "That sounds really draining. It's hard when we feel like we can't set boundaries, especially at work where there might be pressure to always say yes.\n\nA few thoughts:\n\n- **Boundaries are healthy** - Saying no to protect your wellbeing isn't selfish, it's necessary\n- **Burnout is real** - Working late consistently without rest can seriously impact your mental and physical health\n- **You have options** - Even small changes can help\n\nHave you been able to talk to anyone about the workload, or does that feel too risky?",
    timestamp: daysAgo(2),
    feedback: { rating: 5, comment: 'Really helpful advice', submittedAt: daysAgo(2) },
    metadata: {
      intent: 'mental_health.work_stress',
      confidence: 0.91,
      responseTimeMs: 456,
      parameters: { topic: 'work', issue: 'boundaries' }
    },
    tags: ['practical-advice', 'validation'],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  },
  {
    id: 'msg_006',
    sessionId: 'sess_001',
    role: 'user',
    content: "I'm scared to bring it up. What if they think I can't handle the job?",
    timestamp: daysAgo(2),
    feedback: null,
    metadata: {},
    tags: [],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  },
  {
    id: 'msg_007',
    sessionId: 'sess_001',
    role: 'assistant',
    content: "That fear is very common, and it makes complete sense. Many people worry that asking for help or setting limits will be seen as weakness or incompetence.\n\nBut here's another way to look at it: recognizing your limits and communicating them proactively is actually a sign of **self-awareness and professionalism**. It's much better than burning out and having your work quality suffer.\n\nWould it help to think through how you might approach that conversation? We could work on some phrases that feel comfortable to you.",
    timestamp: daysAgo(2),
    feedback: null,
    metadata: {
      intent: 'mental_health.fear_judgment',
      confidence: 0.88,
      responseTimeMs: 398
    },
    tags: ['reframing', 'supportive'],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  }
];

// Mock Tags
export const mockTags: Tag[] = [
  { id: 'tag_001', name: 'High Quality', category: 'session', color: '#22c55e', description: 'Excellent conversation quality', isCustom: false, usageCount: 145, createdAt: daysAgo(365), updatedAt: daysAgo(30) },
  { id: 'tag_002', name: 'Needs Review', category: 'session', color: '#ca8a04', description: 'Requires additional review', isCustom: false, usageCount: 89, createdAt: daysAgo(365), updatedAt: daysAgo(15) },
  { id: 'tag_003', name: 'Crisis Detected', category: 'session', color: '#dc2626', description: 'Crisis indicators present', isCustom: false, usageCount: 23, createdAt: daysAgo(365), updatedAt: daysAgo(5) },
  { id: 'tag_004', name: 'Empathetic', category: 'message', color: '#3b82f6', description: 'Shows empathy', isCustom: false, usageCount: 567, createdAt: daysAgo(365), updatedAt: daysAgo(1) },
  { id: 'tag_005', name: 'Validation', category: 'message', color: '#8b5cf6', description: 'Validates user feelings', isCustom: false, usageCount: 423, createdAt: daysAgo(365), updatedAt: daysAgo(1) },
  { id: 'tag_006', name: 'Off-Topic', category: 'message', color: '#f97316', description: 'Response went off-topic', isCustom: false, usageCount: 34, createdAt: daysAgo(365), updatedAt: daysAgo(10) },
  { id: 'tag_007', name: 'Practical Advice', category: 'message', color: '#06b6d4', description: 'Contains actionable advice', isCustom: false, usageCount: 289, createdAt: daysAgo(365), updatedAt: daysAgo(2) },
  { id: 'tag_008', name: 'Factually Incorrect', category: 'message', color: '#dc2626', description: 'Contains incorrect information', isCustom: false, usageCount: 12, createdAt: daysAgo(365), updatedAt: daysAgo(20) }
];

// Mock Annotations
export const mockAnnotations: Annotation[] = [
  {
    id: 'ann_001',
    sessionId: 'sess_002',
    messageId: null,
    authorId: 'usr_004',
    qualityRating: 4,
    goldenReference: null,
    notes: 'Overall good conversation flow. Agent showed appropriate empathy throughout.',
    tags: ['High Quality'],
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4)
  },
  {
    id: 'ann_002',
    sessionId: 'sess_002',
    messageId: 'msg_003',
    authorId: 'usr_004',
    qualityRating: 5,
    goldenReference: 'I hear you, and that sounds really difficult...',
    notes: 'Excellent validation and open-ended follow-up.',
    tags: ['Empathetic', 'Validation'],
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4)
  }
];

// Find existing user or create a new one
export function findOrCreateUser(email: string, returnIsNew: true): { user: User; isNew: boolean };
export function findOrCreateUser(email: string, returnIsNew?: false): User;
export function findOrCreateUser(email: string, returnIsNew: boolean = false): User | { user: User; isNew: boolean } {
  const normalizedEmail = email.toLowerCase();
  
  // Check if user exists
  const existingUser = mockUsers.find(u => u.email.toLowerCase() === normalizedEmail);
  
  if (existingUser) {
    return returnIsNew ? { user: existingUser, isNew: false } : existingUser;
  }
  
  // Create new user
  const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const displayName = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  const newUser: User = {
    id: userId,
    email: normalizedEmail,
    displayName,
    role: UserRole.USER,
    status: 'active',
    groupId: null,
    approvedBy: null,
    approvedAt: null,
    disapprovedAt: null,
    disapprovalComment: null,
    disapprovalCount: 0,
    lastLoginAt: new Date(),
    sessionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {}
  };
  
  // Add to mock users array
  mockUsers.push(newUser);
  
  return returnIsNew ? { user: newUser, isNew: true } : newUser;
}

