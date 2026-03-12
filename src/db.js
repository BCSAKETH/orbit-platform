/**
 * ORBIT — Database Service Layer
 * All Supabase queries live here. App.jsx imports these and calls them.
 * Falls back gracefully if Supabase is not configured (demo mode).
 */
import { supabase, isConfigured } from './supabase.js';

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

/**
 * Sign in a staff member (admin / hod / incharge) via Supabase Auth.
 * Returns { role, user } or throws on failure.
 */
export async function loginStaff(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  // Fetch staff row to get role, dept, section etc.
  const { data: staffRow, error: staffErr } = await supabase
    .from('staff')
    .select('*')
    .eq('id', data.user.id)
    .single();
  if (staffErr) throw new Error(staffErr.message);

  return { role: staffRow.role, user: staffRow };
}

/**
 * Sign in a student by roll number + password.
 * We store students in the `students` table with email = roll@orbit.edu.
 */
export async function loginStudent(roll, password) {
  const email = `${roll.toLowerCase()}@orbit.edu`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Invalid roll number or password');

  const { data: stu, error: stuErr } = await supabase
    .from('students')
    .select('*')
    .eq('id', data.user.id)
    .single();
  if (stuErr) throw new Error(stuErr.message);

  return { role: 'student', user: mapStudent(stu) };
}

/**
 * Register a new student. Creates auth user + students row.
 */
export async function registerStudent(form) {
  const email = `${form.roll.toLowerCase()}@orbit.edu`;
  const password = form.password || 'Pass@123';

  // Create Supabase Auth user
  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
  if (authErr) throw new Error(authErr.message);
  const userId = authData.user?.id;
  if (!userId) throw new Error('Signup failed — try again');

  // Insert student row
  const { error: insertErr } = await supabase.from('students').insert({
    id: userId,
    name: form.name,
    roll: form.roll.toUpperCase(),
    email,
    password_hash: '—', // actual auth is via Supabase Auth
    dept: form.dept,
    section: form.section,
    cgpa: parseFloat(form.cgpa) || 7.0,
    leetcode: form.leetcode || '',
    github: form.github || '',
    codeforces: form.codeforces || '',
    codechef: form.codechef || '',
    status: 'PENDING',
    avatar: form.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
  });
  if (insertErr) throw new Error(insertErr.message);
  return true;
}

/** Sign out current user */
export async function logout() {
  await supabase.auth.signOut();
}

/** Get currently logged-in session */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ═══════════════════════════════════════════════════════════
// STUDENTS
// ═══════════════════════════════════════════════════════════

/** Map raw DB row → app-compatible student object */
function mapStudent(row) {
  return {
    id: row.id,
    name: row.name,
    roll: row.roll,
    email: row.email,
    dept: row.dept,
    section: row.section,
    batch: row.batch || '2022-26',
    cgpa: parseFloat(row.cgpa) || 0,
    status: row.status,
    leetcode: row.leetcode || '',
    github: row.github || '',
    codeforces: row.codeforces || '',
    codechef: row.codechef || '',
    language: row.language || 'C++',
    lcVerified: row.lc_verified || false,
    ghVerified: row.gh_verified || false,
    cfVerified: row.cf_verified || false,
    ccVerified: row.cc_verified || false,
    easy: row.lc_easy || 0,
    medium: row.lc_medium || 0,
    hard: row.lc_hard || 0,
    cfRating: row.cf_rating || 0,
    ccStars: row.cc_stars || 0,
    ghCommits: row.gh_commits || 0,
    ghPRs: row.gh_prs || 0,
    cwProblems: row.cw_problems || 0,
    streak: row.streak || 0,
    score: row.score || 0,
    tier: row.tier || 'Beginner',
    placementReady: row.placement_ready || false,
    avatar: row.avatar || row.name.slice(0, 2).toUpperCase(),
    password: 'Pass@123', // placeholder, auth is via Supabase
    // generate fake heatmap data if not stored
    heatmap: generateFakeHeatmap(),
    codingRadar: generateFakeRadar(row),
  };
}

function generateFakeHeatmap() {
  const months = Array.from({ length: 6 }, (_, mi) => {
    const days = Array.from({ length: 28 }, (_, d) => ({
      day: d + 1,
      lc: Math.random() > 0.4 ? Math.floor(Math.random() * 5) : 0,
      cf: Math.random() > 0.6 ? Math.floor(Math.random() * 3) : 0,
      gh: Math.random() > 0.3 ? Math.floor(Math.random() * 8) : 0,
      cw: Math.random() > 0.7 ? Math.floor(Math.random() * 4) : 0,
    }));
    return {
      month: ['Jan','Feb','Mar','Apr','May','Jun'][mi],
      mi, days,
      lc: days.reduce((a, d) => a + d.lc, 0),
      cf: days.reduce((a, d) => a + d.cf, 0),
      gh: days.reduce((a, d) => a + d.gh, 0),
      cw: days.reduce((a, d) => a + d.cw, 0),
    };
  });
  return months;
}

function generateFakeRadar(row) {
  const total = (row.lc_easy || 0) + (row.lc_medium || 0) + (row.lc_hard || 0);
  return [
    { subject: 'DSA', A: Math.min(100, total / 3) },
    { subject: 'CP', A: Math.min(100, (row.cf_rating || 0) / 20) },
    { subject: 'Dev', A: Math.min(100, (row.gh_commits || 0) / 5) },
    { subject: 'System', A: Math.floor(Math.random() * 60) + 20 },
    { subject: 'Math', A: Math.floor(Math.random() * 70) + 20 },
    { subject: 'ML', A: Math.floor(Math.random() * 50) + 10 },
  ];
}

/** Fetch ALL students (admin only) */
export async function fetchAllStudents() {
  if (!isConfigured) return null; // signal to use mock data
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('score', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(mapStudent);
}

/** Fetch students for a specific dept (HOD) */
export async function fetchDeptStudents(dept) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('dept', dept)
    .order('score', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(mapStudent);
}

/** Fetch students for a specific section (Incharge) */
export async function fetchSectionStudents(dept, section) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('dept', dept)
    .eq('section', section)
    .order('score', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(mapStudent);
}

/** Approve a student registration */
export async function approveStudent(id) {
  const { error } = await supabase
    .from('students')
    .update({ status: 'ACTIVE' })
    .eq('id', id);
  if (error) throw new Error(error.message);

  // Audit log
  await supabase.from('audit_log').insert({
    actor: 'Admin',
    action: 'ACTIVATED',
    target: id,
    details: { status: 'ACTIVE' },
  });
}

/** Reject a student */
export async function rejectStudent(id) {
  const { error } = await supabase
    .from('students')
    .update({ status: 'REJECTED' })
    .eq('id', id);
  if (error) throw new Error(error.message);

  await supabase.from('audit_log').insert({
    actor: 'Admin',
    action: 'REJECTED',
    target: id,
  });
}

/** Update student platform stats */
export async function updateStudentStats(id, stats) {
  const { error } = await supabase
    .from('students')
    .update({
      lc_easy: stats.easy,
      lc_medium: stats.medium,
      lc_hard: stats.hard,
      cf_rating: stats.cfRating,
      cc_stars: stats.ccStars,
      gh_commits: stats.ghCommits,
      gh_prs: stats.ghPRs,
      streak: stats.streak,
      cgpa: stats.cgpa,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  // trigger auto-recomputes score + tier
}

// ═══════════════════════════════════════════════════════════
// DIRECT MESSAGES
// ═══════════════════════════════════════════════════════════

/** Map raw DM row → app format */
function mapDm(row) {
  return {
    id: row.id,
    fromId: row.from_id,
    fromName: row.from_name,
    fromAvatar: row.from_avatar || '??',
    toId: row.to_id,
    toName: row.to_name,
    msg: row.msg,
    read: row.read,
    ts: new Date(row.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Fetch DMs for a student (both sent and received) */
export async function fetchStudentDms(studentId) {
  const { data, error } = await supabase
    .from('dms')
    .select('*')
    .or(`from_id.eq.${studentId},to_id.eq.${studentId}`)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map(mapDm);
}

/** Send a DM */
export async function sendDm({ fromId, fromName, fromAvatar, toId, toName, msg }) {
  const { data, error } = await supabase
    .from('dms')
    .insert({ from_id: fromId, from_name: fromName, from_avatar: fromAvatar, to_id: toId, to_name: toName, msg })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapDm(data);
}

/** Mark a DM as read */
export async function markDmRead(dmId) {
  const { error } = await supabase
    .from('dms')
    .update({ read: true })
    .eq('id', dmId);
  if (error) console.warn('[ORBIT] markDmRead error:', error.message);
}

/** Subscribe to new DMs for a student (realtime) */
export function subscribeToDms(studentId, onNew) {
  return supabase
    .channel(`dms-${studentId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dms', filter: `to_id=eq.${studentId}` },
      (payload) => onNew(mapDm(payload.new))
    )
    .subscribe();
}

// ═══════════════════════════════════════════════════════════
// COMMUNITY MESSAGES
// ═══════════════════════════════════════════════════════════

function mapCommunityMsg(row) {
  return {
    id: row.id,
    user: row.author_name,
    msg: row.message,
    avatar: row.author_avatar || row.author_name.slice(0, 2).toUpperCase(),
    ts: new Date(row.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Fetch community messages (last 100) */
export async function fetchCommunityMessages() {
  const { data, error } = await supabase
    .from('community_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return data.map(mapCommunityMsg);
}

/** Post a community message */
export async function postCommunityMessage({ authorId, authorName, authorAvatar, message }) {
  const { data, error } = await supabase
    .from('community_messages')
    .insert({ author_id: authorId, author_name: authorName, author_avatar: authorAvatar, message })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCommunityMsg(data);
}

/** Subscribe to new community messages */
export function subscribeToCommunity(onNew) {
  return supabase
    .channel('community')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'community_messages' },
      (payload) => onNew(mapCommunityMsg(payload.new))
    )
    .subscribe();
}

// ═══════════════════════════════════════════════════════════
// OFFERS
// ═══════════════════════════════════════════════════════════

function mapOffer(row) {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    package: `${row.package_lpa} LPA`,
    student: row.student_name || '',
    studentId: row.student_id,
    status: row.status?.toUpperCase() || 'PENDING',
    date: row.offer_date,
  };
}

export async function fetchOffers(studentId = null) {
  let query = supabase
    .from('offers')
    .select(`*, students(name)`)
    .order('created_at', { ascending: false });
  if (studentId) query = query.eq('student_id', studentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data.map(r => mapOffer({ ...r, student_name: r.students?.name }));
}

export async function updateOfferStatus(offerId, status) {
  const { error } = await supabase
    .from('offers')
    .update({ status: status.toLowerCase() })
    .eq('id', offerId);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════
// INTERVIEW REQUESTS
// ═══════════════════════════════════════════════════════════

function mapInterviewReq(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.students?.name || '',
    studentRoll: row.students?.roll || '',
    dept: row.students?.dept || '',
    section: row.students?.section || '',
    type: row.interview_type,
    status: row.status,
    ts: new Date(row.requested_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

export async function fetchInterviewRequests(dept = null, section = null) {
  let query = supabase
    .from('interview_requests')
    .select(`*, students(name, roll, dept, section, score, cf_rating, lc_easy, lc_medium, lc_hard)`)
    .order('requested_at', { ascending: false });
  // Filter by dept/section via students relation
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let results = data.map(mapInterviewReq);
  if (dept) results = results.filter(r => r.dept === dept);
  if (section) results = results.filter(r => r.section === section);
  return results;
}

export async function submitInterviewRequest(studentId, interviewType) {
  const { data, error } = await supabase
    .from('interview_requests')
    .insert({ student_id: studentId, interview_type: interviewType })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapInterviewReq(data);
}

export async function updateInterviewStatus(reqId, status, reviewerId) {
  const { error } = await supabase
    .from('interview_requests')
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', reqId);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════
// MOCK TEST RESULTS
// ═══════════════════════════════════════════════════════════

export async function saveMockTestResult({ studentId, testType, difficulty, scorePct, correct, total, questions }) {
  const { error } = await supabase.from('mock_test_results').insert({
    student_id: studentId,
    test_type: testType,
    difficulty,
    score_pct: scorePct,
    correct,
    total,
    questions,
  });
  if (error) console.warn('[ORBIT] saveMockTestResult error:', error.message);
}

export async function fetchMockTestHistory(studentId) {
  const { data, error } = await supabase
    .from('mock_test_results')
    .select('id, test_type, difficulty, score_pct, correct, total, taken_at')
    .eq('student_id', studentId)
    .order('taken_at', { ascending: false })
    .limit(20);
  if (error) return [];
  return data;
}

// ═══════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════

export async function fetchAuditLog() {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return data.map(r => ({
    id: r.id,
    action: r.action,
    target: r.target,
    by: r.actor,
    ts: new Date(r.created_at).toLocaleString('en-IN'),
  }));
}

export async function logAudit(actor, action, target, details = {}) {
  await supabase.from('audit_log').insert({ actor, action, target, details });
}

// ═══════════════════════════════════════════════════════════
// REALTIME — single cleanup helper
// ═══════════════════════════════════════════════════════════

/** Unsubscribe from a Supabase realtime channel */
export function unsubscribe(channel) {
  if (channel) supabase.removeChannel(channel);
}
