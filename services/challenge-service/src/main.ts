import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { KafkaProducer } from '../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../shared/utils/logger';

dotenv.config();

const app = express();
const logger = new Logger('ChallengeService');
const PORT = process.env.PORT || 3008;
const PASS_THRESHOLD = 8; // out of 10
const QUESTIONS_PER_SET = 10;

app.use(express.json());

app.use((req, res, next) => {
  (req as any).userId = req.headers['x-user-id'] as string;
  next();
});

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!(req as any).userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// ══════════════════════════════════════════════════════════════════════════════
//  Challenge Types
// ══════════════════════════════════════════════════════════════════════════════

export type ChallengeType = 'math';

export const CHALLENGE_TYPES: { key: ChallengeType; label: string; icon: string; desc: string }[] = [
  { key: 'math', label: 'Maths', icon: '🔢', desc: 'Arithmetic & Number Sense' },
];

function dailyTypeForDate(_dateStr: string): ChallengeType {
  return 'math';
}

// ══════════════════════════════════════════════════════════════════════════════
//  Question banks (MCQ)
// ══════════════════════════════════════════════════════════════════════════════

interface Question {
  id: string;
  text: string;
  options: string[] | number[];
  answer: string | number;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Math Question Generator (difficulty-aware)
// ══════════════════════════════════════════════════════════════════════════════

type MathQType = 'add' | 'sub' | 'mul' | 'div' | 'percent' | 'bodmas';

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle<T>(arr: T[]): T[] {
  return arr.slice().sort(() => Math.random() - 0.5);
}
function wrongNumbers(correct: number, count = 3): number[] {
  const offsets = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];
  const wrongs = new Set<number>();
  let tries = 0;
  while (wrongs.size < count && tries < 100) {
    tries++;
    const offset = offsets[rand(0, offsets.length - 1)];
    const sign = Math.random() < 0.5 ? 1 : -1;
    const candidate = correct + sign * offset;
    if (candidate > 0 && candidate !== correct) wrongs.add(candidate);
  }
  return Array.from(wrongs).slice(0, count);
}

function makeMathQuestion(type: MathQType, id: string, difficulty: number): Question {
  const easy = difficulty === 1;
  const hard = difficulty === 3;
  let text = '', answer: number = 0;

  switch (type) {
    case 'add': {
      const a = rand(easy ? 1 : 10, easy ? 20 : hard ? 999 : 99);
      const b = rand(easy ? 1 : 10, easy ? 20 : hard ? 999 : 99);
      text = `${a} + ${b}`; answer = a + b; break;
    }
    case 'sub': {
      const a = rand(easy ? 5 : 20, easy ? 30 : hard ? 500 : 99);
      const b = rand(1, a - 1);
      text = `${a} − ${b}`; answer = a - b; break;
    }
    case 'mul': {
      const a = rand(2, easy ? 5 : hard ? 25 : 15);
      const b = rand(2, easy ? 5 : hard ? 25 : 15);
      text = `${a} × ${b}`; answer = a * b; break;
    }
    case 'div': {
      const b = rand(2, easy ? 5 : hard ? 15 : 12);
      const a = b * rand(2, easy ? 5 : hard ? 15 : 12);
      text = `${a} ÷ ${b}`; answer = a / b; break;
    }
    case 'percent': {
      const pcts = easy ? [10, 25, 50] : hard ? [5, 15, 35, 45] : [5, 10, 15, 20, 25, 50];
      const pct = pcts[rand(0, pcts.length - 1)];
      const base = rand(easy ? 2 : 2, easy ? 10 : 20) * 10;
      text = `${pct}% of ${base} = ?`; answer = (pct * base) / 100; break;
    }
    case 'bodmas': {
      if (easy) {
        const a = rand(2, 8), b = rand(2, 8), c = rand(2, 8);
        text = `(${a} + ${b}) × ${c} = ?`; answer = (a + b) * c;
      } else if (hard) {
        const a = rand(2, 10), b = rand(2, 10), c = rand(2, 10), d = rand(2, 5);
        text = `(${a} + ${b}) × ${c} − ${d} = ?`; answer = (a + b) * c - d;
      } else {
        const v = rand(0, 1);
        if (v === 0) { const a = rand(2,10),b=rand(2,10),c=rand(2,10); text=`${a} × ${b} + ${c} = ?`; answer=a*b+c; }
        else { const a=rand(1,20),b=rand(2,8),c=rand(2,8); text=`${a} + ${b} × ${c} = ?`; answer=a+b*c; }
      }
      break;
    }
  }

  const opts = shuffle([answer, ...wrongNumbers(answer, 3)]);
  return { id, text, options: opts, answer };
}

const MATH_DIST: MathQType[] = ['add', 'add', 'sub', 'sub', 'mul', 'mul', 'div', 'percent', 'bodmas', 'bodmas'];

function generateMathSet(difficulty = 2): Question[] {
  return shuffle(MATH_DIST)
    .slice(0, QUESTIONS_PER_SET)
    .map((type, i) => makeMathQuestion(type, `q${i + 1}`, difficulty));
}

function generateQuestionSet(_type: ChallengeType = 'math', difficulty = 2): Question[] {
  return generateMathSet(difficulty);
}

function publicQuestions(questions: Question[]) {
  return questions.map(({ answer: _a, ...rest }) => rest);
}

function scoreSubmission(questions: Question[], answers: Record<string, any>): number {
  return questions.reduce((acc, q) => acc + (String(answers[q.id]) === String(q.answer) ? 1 : 0), 0);
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function today(): string { return new Date().toISOString().split('T')[0]; }
function yesterday(d: string): string {
  const dt = new Date(d); dt.setDate(dt.getDate() - 1);
  return dt.toISOString().split('T')[0];
}

// ══════════════════════════════════════════════════════════════════════════════
//  Schemas
// ══════════════════════════════════════════════════════════════════════════════

// Shared daily type (per day, same type for all)
const dailyChallengeSchema = new mongoose.Schema({
  date:          { type: String, unique: true, required: true },
  challengeType: { type: String, required: true },
});
const DailyChallenge = mongoose.model('DailyChallenge', dailyChallengeSchema);

// Per-user questions for today (personalized; changes on retry)
const dailyUserQSchema = new mongoose.Schema({
  userId:        { type: String, required: true },
  date:          { type: String, required: true },
  challengeType: { type: String, required: true },
  difficulty:    { type: Number, default: 2 },
  attemptNumber: { type: Number, default: 1 },
  questions:     { type: mongoose.Schema.Types.Mixed, required: true },
});
dailyUserQSchema.index({ userId: 1, date: 1 }, { unique: true });
const DailyUserQ = mongoose.model('DailyUserQ', dailyUserQSchema);

// One submission record per user per attempt
const dailyAttemptSchema = new mongoose.Schema({
  userId:        { type: String, required: true },
  date:          { type: String, required: true },
  challengeType: { type: String },
  attemptNumber: { type: Number, default: 1 },
  difficulty:    { type: Number, default: 2 },
  score:         { type: Number, required: true },
  passed:        { type: Boolean, required: true },
  submittedAt:   { type: Date, default: Date.now },
});
dailyAttemptSchema.index({ userId: 1, date: 1, attemptNumber: 1 }, { unique: true });
const DailyAttempt = mongoose.model('DailyAttempt', dailyAttemptSchema);

// Best result per user per day (for streak logic)
const dailyResultSchema = new mongoose.Schema({
  userId:      { type: String, required: true },
  date:        { type: String, required: true },
  bestScore:   { type: Number, default: 0 },
  passed:      { type: Boolean, default: false },
  totalTries:  { type: Number, default: 0 },
});
dailyResultSchema.index({ userId: 1, date: 1 }, { unique: true });
const DailyResult = mongoose.model('DailyResult', dailyResultSchema);

const streakSchema = new mongoose.Schema({
  userId:         { type: String, unique: true, required: true },
  currentStreak:  { type: Number, default: 0 },
  longestStreak:  { type: Number, default: 0 },
  lastPassedDate: { type: String, default: '' },
});
const Streak = mongoose.model('Streak', streakSchema);

const friendChallengeSchema = new mongoose.Schema({
  creatorId:       { type: String, required: true },
  opponentId:      { type: String, required: true },
  challengeType:   { type: String, default: 'math' },
  questions:       { type: mongoose.Schema.Types.Mixed, required: true },
  creatorAnswers:  { type: mongoose.Schema.Types.Mixed, default: null },
  opponentAnswers: { type: mongoose.Schema.Types.Mixed, default: null },
  creatorScore:    { type: Number, default: null },
  opponentScore:   { type: Number, default: null },
  status:          { type: String, enum: ['pending','accepted','completed','declined'], default: 'pending' },
  createdAt:       { type: Date, default: Date.now },
  expiresAt:       { type: Date, required: true },
});
const FriendChallenge = mongoose.model('FriendChallenge', friendChallengeSchema);

const communityChallengeSchema = new mongoose.Schema({
  communityId:   { type: String, required: true },
  creatorId:     { type: String, required: true },
  title:         { type: String, required: true },
  challengeType: { type: String, default: 'math' },
  questions:     { type: mongoose.Schema.Types.Mixed, required: true },
  attempts: [{
    userId: String, score: Number, passed: Boolean,
    submittedAt: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});
const CommunityChallenge = mongoose.model('CommunityChallenge', communityChallengeSchema);

const kafkaProducer = new KafkaProducer('challenge-service');

// ══════════════════════════════════════════════════════════════════════════════
//  Streak helpers
// ══════════════════════════════════════════════════════════════════════════════

async function getOrCreateStreak(userId: string) {
  return Streak.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, currentStreak: 0, longestStreak: 0, lastPassedDate: '' } },
    { upsert: true, new: true }
  );
}

async function recordPass(userId: string, dateStr: string) {
  const s = await getOrCreateStreak(userId);
  if (s!.lastPassedDate === dateStr) return s;
  const isConsecutive = s!.lastPassedDate === yesterday(dateStr);
  const newStreak = isConsecutive ? s!.currentStreak + 1 : 1;
  const newLongest = Math.max(newStreak, s!.longestStreak);
  return Streak.findOneAndUpdate(
    { userId },
    { currentStreak: newStreak, longestStreak: newLongest, lastPassedDate: dateStr },
    { new: true }
  );
}

async function breakStreakIfMissed(userId: string) {
  const s = await getOrCreateStreak(userId);
  if (!s!.lastPassedDate) return s;
  if (s!.lastPassedDate < yesterday(today())) {
    return Streak.findOneAndUpdate({ userId }, { currentStreak: 0 }, { new: true });
  }
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════
//  GET /challenge-types — list all types for UI picker
// ══════════════════════════════════════════════════════════════════════════════

app.get('/challenge-types', (_req, res) => {
  res.json(CHALLENGE_TYPES);
});

// ══════════════════════════════════════════════════════════════════════════════
//  Daily Challenge
// ══════════════════════════════════════════════════════════════════════════════

app.get('/daily', requireAuth, async (req, res) => {
  const userId  = (req as any).userId;
  const dateStr = today();

  try {
    // Determine today's type (shared for all users)
    let daily = await DailyChallenge.findOne({ date: dateStr });
    if (!daily) {
      const challengeType = dailyTypeForDate(dateStr);
      daily = await DailyChallenge.findOneAndUpdate(
        { date: dateStr },
        { $setOnInsert: { date: dateStr, challengeType } },
        { upsert: true, new: true }
      );
    }

    const challengeType = daily!.challengeType as ChallengeType;

    // Get or create this user's personal question set for today
    let userQ = await DailyUserQ.findOne({ userId, date: dateStr });
    if (!userQ) {
      const questions = generateQuestionSet(challengeType, 2);
      userQ = await DailyUserQ.findOneAndUpdate(
        { userId, date: dateStr },
        { $setOnInsert: { userId, date: dateStr, challengeType, difficulty: 2, attemptNumber: 1, questions } },
        { upsert: true, new: true }
      );
    }

    const result = await DailyResult.findOne({ userId, date: dateStr });
    const streak = await breakStreakIfMissed(userId);
    const typeInfo = CHALLENGE_TYPES.find(t => t.key === challengeType);

    res.json({
      date: dateStr,
      challengeType,
      typeInfo,
      questions: publicQuestions(userQ!.questions as Question[]),
      totalQuestions: QUESTIONS_PER_SET,
      passThreshold: PASS_THRESHOLD,
      currentAttempt: userQ!.attemptNumber,
      difficulty: userQ!.difficulty,
      alreadyPassed: result?.passed ?? false,
      canRetry: result ? !result.passed : false,
      lastScore: result?.bestScore ?? null,
      streak: {
        current: streak?.currentStreak ?? 0,
        longest: streak?.longestStreak ?? 0,
        lastPassedDate: streak?.lastPassedDate ?? '',
      },
    });
  } catch (err) {
    logger.error(`GET /daily: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to load daily challenge' });
  }
});

// POST /daily/submit
app.post('/daily/submit', requireAuth, async (req, res) => {
  const userId  = (req as any).userId;
  const dateStr = today();
  const { answers } = req.body;

  if (!answers || typeof answers !== 'object')
    return res.status(400).json({ error: 'answers object required' });

  try {
    const result = await DailyResult.findOne({ userId, date: dateStr });
    if (result?.passed)
      return res.status(409).json({ error: 'Already passed today', score: result.bestScore, passed: true });

    const userQ = await DailyUserQ.findOne({ userId, date: dateStr });
    if (!userQ) return res.status(404).json({ error: 'No challenge loaded — call GET /daily first' });

    const questions = userQ.questions as Question[];
    const score     = scoreSubmission(questions, answers);
    const passed    = score >= PASS_THRESHOLD;
    const correctAnswers = Object.fromEntries(questions.map(q => [q.id, q.answer]));

    // Save attempt record
    await DailyAttempt.findOneAndUpdate(
      { userId, date: dateStr, attemptNumber: userQ.attemptNumber },
      { $setOnInsert: { userId, date: dateStr, challengeType: userQ.challengeType, attemptNumber: userQ.attemptNumber, difficulty: userQ.difficulty, score, passed } },
      { upsert: true }
    ).catch(() => {});

    // Upsert best result
    await DailyResult.findOneAndUpdate(
      { userId, date: dateStr },
      {
        $max:  { bestScore: score },
        $set:  { passed: passed ? true : (result?.passed ?? false) },
        $inc:  { totalTries: 1 },
      },
      { upsert: true }
    );

    let streak = await getOrCreateStreak(userId);
    if (passed) streak = await recordPass(userId, dateStr) as any;

    await kafkaProducer.publish('challenge.daily.completed', { userId, date: dateStr, score, passed }).catch(() => {});

    res.json({
      score,
      total: questions.length,
      passed,
      passThreshold: PASS_THRESHOLD,
      correctAnswers,
      canRetry: !passed,
      nextDifficulty: !passed ? Math.max(1, userQ.difficulty - 1) : null,
      streak: { current: streak?.currentStreak ?? 0, longest: streak?.longestStreak ?? 0 },
    });
  } catch (err) {
    logger.error(`POST /daily/submit: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to submit' });
  }
});

// POST /daily/retry — new easier questions after a fail
app.post('/daily/retry', requireAuth, async (req, res) => {
  const userId  = (req as any).userId;
  const dateStr = today();

  try {
    const result = await DailyResult.findOne({ userId, date: dateStr });
    if (result?.passed) return res.status(409).json({ error: 'Already passed today' });

    const userQ = await DailyUserQ.findOne({ userId, date: dateStr });
    if (!userQ) return res.status(404).json({ error: 'No challenge found for today' });

    const newDifficulty = Math.max(1, userQ.difficulty - 1) as 1 | 2 | 3;
    const newAttempt    = userQ.attemptNumber + 1;
    const questions     = generateQuestionSet(userQ.challengeType as ChallengeType, newDifficulty);

    await DailyUserQ.updateOne(
      { userId, date: dateStr },
      { difficulty: newDifficulty, attemptNumber: newAttempt, questions }
    );

    res.json({
      questions: publicQuestions(questions),
      attemptNumber: newAttempt,
      difficulty: newDifficulty,
      totalQuestions: QUESTIONS_PER_SET,
      passThreshold: PASS_THRESHOLD,
    });
  } catch (err) {
    logger.error(`POST /daily/retry: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to load retry questions' });
  }
});

// GET /daily/streak
app.get('/daily/streak', requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const streak = await getOrCreateStreak(userId);
    res.json({
      current: streak!.currentStreak,
      longest: streak!.longestStreak,
      lastPassedDate: streak!.lastPassedDate,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch streak' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  Friend Challenges
// ══════════════════════════════════════════════════════════════════════════════

app.post('/friend', requireAuth, async (req, res) => {
  const creatorId = (req as any).userId;
  const { opponentId, challengeType = 'math' } = req.body;
  if (!opponentId) return res.status(400).json({ error: 'opponentId required' });
  if (opponentId === creatorId) return res.status(400).json({ error: 'Cannot challenge yourself' });

  const validType: ChallengeType = 'math';

  try {
    const questions = generateQuestionSet(validType, 2);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const challenge = await FriendChallenge.create({ creatorId, opponentId, challengeType: validType, questions, expiresAt });

    await kafkaProducer.publish('challenge.friend.created', {
      challengeId: challenge._id.toString(), creatorId, opponentId,
    }).catch(() => {});

    res.status(201).json({
      id: challenge._id.toString(),
      challengeType: validType,
      status: challenge.status,
      expiresAt: challenge.expiresAt,
    });
  } catch (err) {
    logger.error(`POST /friend: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

app.get('/friend/pending', requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const challenges = await FriendChallenge.find({
      opponentId: userId, status: 'pending', expiresAt: { $gt: new Date() },
    }).select('-questions').sort({ createdAt: -1 });

    res.json(challenges.map(c => ({
      id: c._id.toString(), creatorId: c.creatorId, challengeType: (c as any).challengeType,
      status: c.status, createdAt: c.createdAt, expiresAt: c.expiresAt,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending challenges' });
  }
});

app.get('/friend/my', requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const challenges = await FriendChallenge.find({ creatorId: userId })
      .select('-questions').sort({ createdAt: -1 }).limit(20);

    res.json(challenges.map(c => ({
      id: c._id.toString(), opponentId: c.opponentId, challengeType: (c as any).challengeType,
      creatorScore: c.creatorScore, opponentScore: c.opponentScore,
      status: c.status, createdAt: c.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

app.get('/friend/:id', requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const challenge = await FriendChallenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
    if (challenge.creatorId !== userId && challenge.opponentId !== userId)
      return res.status(403).json({ error: 'Not a participant' });
    if (challenge.status === 'declined') return res.status(410).json({ error: 'Challenge declined' });
    if (new Date() > challenge.expiresAt) return res.status(410).json({ error: 'Challenge expired' });

    const isCreator   = challenge.creatorId === userId;
    const myScore     = isCreator ? challenge.creatorScore : challenge.opponentScore;
    const alreadyDone = myScore !== null;

    res.json({
      id: challenge._id.toString(),
      creatorId: challenge.creatorId, opponentId: challenge.opponentId,
      challengeType: (challenge as any).challengeType,
      status: challenge.status,
      questions: alreadyDone ? [] : publicQuestions(challenge.questions as Question[]),
      alreadySubmitted: alreadyDone,
      creatorScore: challenge.creatorScore, opponentScore: challenge.opponentScore,
      expiresAt: challenge.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load challenge' });
  }
});

app.post('/friend/:id/accept', requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const challenge = await FriendChallenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ error: 'Not found' });
    if (challenge.opponentId !== userId) return res.status(403).json({ error: 'Not the opponent' });
    if (challenge.status !== 'pending') return res.status(409).json({ error: 'Already responded' });
    challenge.status = 'accepted';
    await challenge.save();
    res.json({ ok: true, questions: publicQuestions(challenge.questions as Question[]) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept' });
  }
});

app.post('/friend/:id/decline', requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const challenge = await FriendChallenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ error: 'Not found' });
    if (challenge.opponentId !== userId) return res.status(403).json({ error: 'Not the opponent' });
    challenge.status = 'declined';
    await challenge.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline' });
  }
});

app.post('/friend/:id/submit', requireAuth, async (req, res) => {
  const userId  = (req as any).userId;
  const { answers } = req.body;
  if (!answers) return res.status(400).json({ error: 'answers required' });

  try {
    const challenge = await FriendChallenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ error: 'Not found' });
    if (challenge.creatorId !== userId && challenge.opponentId !== userId)
      return res.status(403).json({ error: 'Not a participant' });
    if (new Date() > challenge.expiresAt) return res.status(410).json({ error: 'Expired' });

    const isCreator = challenge.creatorId === userId;
    if (isCreator ? challenge.creatorScore !== null : challenge.opponentScore !== null)
      return res.status(409).json({ error: 'Already submitted' });

    const questions = challenge.questions as Question[];
    const score = scoreSubmission(questions, answers);
    const correctAnswers = Object.fromEntries(questions.map(q => [q.id, q.answer]));

    if (isCreator) { challenge.creatorAnswers = answers; challenge.creatorScore = score; }
    else           { challenge.opponentAnswers = answers; challenge.opponentScore = score; }

    const bothDone = challenge.creatorScore !== null && challenge.opponentScore !== null;
    if (bothDone) challenge.status = 'completed';
    await challenge.save();

    const result: any = { score, total: questions.length, passed: score >= PASS_THRESHOLD, correctAnswers };

    if (bothDone) {
      const cScore = challenge.creatorScore as number;
      const oScore = challenge.opponentScore as number;
      result.bothDone = true;
      result.creatorScore = cScore; result.opponentScore = oScore;
      result.winner = cScore > oScore ? challenge.creatorId : oScore > cScore ? challenge.opponentId : 'draw';

      await kafkaProducer.publish('challenge.friend.completed', {
        challengeId: challenge._id.toString(), creatorId: challenge.creatorId,
        opponentId: challenge.opponentId, creatorScore: cScore, opponentScore: oScore, winner: result.winner,
      }).catch(() => {});
    }

    res.json(result);
  } catch (err) {
    logger.error(`POST /friend/:id/submit: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to submit' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  Community Challenges
// ══════════════════════════════════════════════════════════════════════════════

app.post('/community', requireAuth, async (req, res) => {
  const creatorId = (req as any).userId;
  const { communityId, title, challengeType = 'math' } = req.body;
  if (!communityId || !title) return res.status(400).json({ error: 'communityId and title required' });

  const validType: ChallengeType = 'math';

  try {
    const questions = generateQuestionSet(validType, 2);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const challenge = await CommunityChallenge.create({
      communityId, creatorId, title, challengeType: validType, questions, expiresAt,
    });

    await kafkaProducer.publish('challenge.community.created', {
      challengeId: challenge._id.toString(), communityId, creatorId, title, challengeType: validType,
    }).catch(() => {});

    res.status(201).json({
      id: challenge._id.toString(), communityId, title, challengeType: validType,
      createdAt: challenge.createdAt, expiresAt: challenge.expiresAt,
    });
  } catch (err) {
    logger.error(`POST /community: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to create community challenge' });
  }
});

app.get('/community/by-community/:communityId', requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const challenges = await CommunityChallenge.find({
      communityId: req.params.communityId, expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 }).limit(20);

    res.json(challenges.map(c => {
      const myAttempt = (c.attempts as any[]).find((a: any) => a.userId === userId);
      return {
        id: c._id.toString(), communityId: c.communityId, creatorId: c.creatorId,
        title: c.title, challengeType: (c as any).challengeType,
        attemptCount: c.attempts.length,
        myAttempt: myAttempt ? { score: myAttempt.score, passed: myAttempt.passed } : null,
        topScore: (c.attempts as any[]).reduce((m, a) => Math.max(m, a.score), 0),
        createdAt: c.createdAt, expiresAt: c.expiresAt,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch community challenges' });
  }
});

app.get('/community/:id', requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const challenge = await CommunityChallenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ error: 'Not found' });

    const myAttempt  = (challenge.attempts as any[]).find((a: any) => a.userId === userId);
    const leaderboard = [...(challenge.attempts as any[])]
      .sort((a, b) => b.score - a.score).slice(0, 10)
      .map(a => ({ userId: a.userId, score: a.score, submittedAt: a.submittedAt }));

    res.json({
      id: challenge._id.toString(), communityId: challenge.communityId,
      creatorId: challenge.creatorId, title: challenge.title,
      challengeType: (challenge as any).challengeType,
      questions: myAttempt ? [] : publicQuestions(challenge.questions as Question[]),
      alreadySubmitted: !!myAttempt,
      myAttempt: myAttempt ? { score: myAttempt.score, passed: myAttempt.passed } : null,
      leaderboard, attemptCount: challenge.attempts.length,
      createdAt: challenge.createdAt, expiresAt: challenge.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch challenge' });
  }
});

app.post('/community/:id/submit', requireAuth, async (req, res) => {
  const userId  = (req as any).userId;
  const { answers } = req.body;
  if (!answers) return res.status(400).json({ error: 'answers required' });

  try {
    const challenge = await CommunityChallenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ error: 'Not found' });
    if (new Date() > challenge.expiresAt) return res.status(410).json({ error: 'Challenge expired' });
    if ((challenge.attempts as any[]).some((a: any) => a.userId === userId))
      return res.status(409).json({ error: 'Already submitted' });

    const questions = challenge.questions as Question[];
    const score = scoreSubmission(questions, answers);
    const passed = score >= PASS_THRESHOLD;
    const correctAnswers = Object.fromEntries(questions.map(q => [q.id, q.answer]));

    (challenge.attempts as any[]).push({ userId, score, passed, submittedAt: new Date() });
    await challenge.save();

    const leaderboard = [...(challenge.attempts as any[])]
      .sort((a, b) => b.score - a.score).slice(0, 10)
      .map(a => ({ userId: a.userId, score: a.score }));

    res.json({ score, total: questions.length, passed, correctAnswers, leaderboard });
  } catch (err) {
    logger.error(`POST /community/:id/submit: ${(err as Error).message}`);
    res.status(500).json({ error: 'Failed to submit' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'Challenge Service running', timestamp: new Date() }));

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/challenges_db');
    logger.info('Connected to MongoDB');
    await kafkaProducer.connect();
    logger.info('Connected to Kafka');
    app.listen(PORT, () => logger.info(`Challenge Service running on port ${PORT}`));
  } catch (error) {
    logger.error(`Failed to start: ${(error as Error).message}`);
    process.exit(1);
  }
}

startServer();
export default app;
