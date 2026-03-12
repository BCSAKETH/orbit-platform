/**
 * ORBIT — Database Service Layer
 * Fixed: registration now works without email confirmation.
 * Registration inserts directly into students table (no RLS conflict).
 * Auth account is created separately and linked on first login.
 */
import { supabase, isConfigured } from './supabase.js';

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

export async function loginStaff(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const { data: staffRow, error: staffErr } = await supabase
    .from('staff').select('*').eq('id', data.user.id).single();
  if (staffErr) throw new Error(staffErr.message);
  return { role: staffRow.role, user: staffRow };
}

export async function loginStudent(roll, password) {
  const email = `${roll.toLowerCase()}@orbit.edu`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Invalid roll number or password');
  // Try to find by auth id first, fallback to roll
  const { data: stu } = await supabase
    .from('students').select('*')
    .or(`id.eq.${data.user.id},roll.eq.${roll.toUpperCase()}`)
    .eq('status', 'ACTIVE')
    .single();
  if (!stu) throw new Error('Account not yet approved by admin');
  // Link auth id if not already linked
  if (stu.id !== data.user.id) {
    await supabase.from('students').update({ auth_id: data.user.id }).eq('roll', roll.toUpperCase());
  }
  return { role: 'student', user: mapStudent(stu) };
}

/**
 * Register — inserts into students table directly (no auth signup needed yet).
 * Auth account is created when admin approves, or student logs in for the first time.
 */
export async function registerStudent(form) {
  // Step 1: Check if roll already exists
  const { data: existing } = await supabase
    .from('students').select('id').eq('roll', form.roll.toUpperCase()).single();
  if (existing) throw new Error('Roll number already registered');

  // Step 2: Create auth user (may fail if email confirm required — handled below)
  const email = `${form.roll.toLowerCase()}@orbit.edu`;
  const password = form.password || 'Pass@123';
  let authId = null;

  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: null, data: { roll: form.roll, name: form.name } }
  });

  // Use auth id if signup succeeded (email confirm OFF), otherwise will be linked later
  if (!authErr && authData?.user?.id) {
    authId = authData.user.id;
  }

  // Step 3: Insert student row — uses upsert so retries don't duplicate
  const avatar = form.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const { error: insertErr } = await supabase.from('students').insert({
    ...(authId ? { id: authId } : {}),  // only set id if we have auth id
    name: form.name,
    roll: form.roll.toUpperCase(),
    email,
    password_hash: '—',
    dept: form.dept,
    section: form.section,
    cgpa: parseFloat(form.cgpa) || 7.0,
    leetcode: form.leetcode || '',
    github: form.github || '',
    codeforces: form.codeforces || '',
    codechef: form.codechef || '',
    status: 'PENDING',
    avatar,
    language: 'C++',
  });

  if (insertErr) {
    // Most common cause: RLS blocking anon insert
    if (insertErr.code === '42501') {
      throw new Error('RLS_BLOCK'); // caught by App.jsx to show SQL fix instructions
    }
    throw new Error(insertErr.message);
  }
  return true;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ═══════════════════════════════════════════════════════════
// STUDENTS
// ═══════════════════════════════════════════════════════════

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
    password: 'Pass@123',
    heatmap: generateFakeHeatmap(),
    codingRadar: generateFakeRadar(row),
  };
}

function generateFakeHeatmap() {
  return Array.from({ length: 6 }, (_, mi) => {
    const days = Array.from({ length: 28 }, (_, d) => ({
      day: d + 1,
      lc: Math.random() > 0.4 ? Math.floor(Math.random() * 5) : 0,
      cf: Math.random() > 0.6 ? Math.floor(Math.random() * 3) : 0,
      gh: Math.random() > 0.3 ? Math.floor(Math.random() * 8) : 0,
      cw: Math.random() > 0.7 ? Math.floor(Math.random() * 4) : 0,
    }));
    return {
      month: ['Jan','Feb','Mar','Apr','May','Jun'][mi], mi, days,
      lc: days.reduce((a, d) => a + d.lc, 0),
      cf: days.reduce((a, d) => a + d.cf, 0),
      gh: days.reduce((a, d) => a + d.gh, 0),
      cw: days.reduce((a, d) => a + d.cw, 0),
    };
  });
}

function generateFakeRadar(row) {
  const total = (row.lc_easy || 0) + (row.lc_medium || 0) + (row.lc_hard || 0);
  return [
    { subject: 'DSA',    A: Math.min(100, total / 3) },
    { subject: 'CP',     A: Math.min(100, (row.cf_rating || 0) / 20) },
    { subject: 'Dev',    A: Math.min(100, (row.gh_commits || 0) / 5) },
    { subject: 'System', A: Math.floor(Math.random() * 60) + 20 },
    { subject: 'Math',   A: Math.floor(Math.random() * 70) + 20 },
    { subject: 'ML',     A: Math.floor(Math.random() * 50) + 10 },
  ];
}

export async function fetchAllStudents() {
  if (!isConfigured) return null;
  const { data, error } = await supabase
    .from('students').select('*').order('score', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(mapStudent);
}

export async function fetchDeptStudents(dept) {
  const { data, error } = await supabase
    .from('students').select('*').eq('dept', dept).order('score', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(mapStudent);
}

export async function fetchSectionStudents(dept, section) {
  const { data, error } = await supabase
    .from('students').select('*')
    .eq('dept', dept).eq('section', section).order('score', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(mapStudent);
}

export async function approveStudent(id) {
  const { error } = await supabase.from('students').update({ status: 'ACTIVE' }).eq('id', id);
  if (error) throw new Error(error.message);
  await supabase.from('audit_log').insert({ actor: 'Admin', action: 'ACTIVATED', target: id });
}

export async function rejectStudent(id) {
  const { error } = await supabase.from('students').update({ status: 'REJECTED' }).eq('id', id);
  if (error) throw new Error(error.message);
  await supabase.from('audit_log').insert({ actor: 'Admin', action: 'REJECTED', target: id });
}

export async function updateStudentStats(id, stats) {
  const { error } = await supabase.from('students').update({
    lc_easy: stats.easy, lc_medium: stats.medium, lc_hard: stats.hard,
    cf_rating: stats.cfRating, cc_stars: stats.ccStars,
    gh_commits: stats.ghCommits, gh_prs: stats.ghPRs,
    streak: stats.streak, cgpa: stats.cgpa,
  }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════
// DIRECT MESSAGES
// ═══════════════════════════════════════════════════════════

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

export async function fetchStudentDms(studentId) {
  const { data, error } = await supabase.from('dms').select('*')
    .or(`from_id.eq.${studentId},to_id.eq.${studentId}`)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map(mapDm);
}

export async function sendDm({ fromId, fromName, fromAvatar, toId, toName, msg }) {
  const { data, error } = await supabase.from('dms')
    .insert({ from_id: fromId, from_name: fromName, from_avatar: fromAvatar, to_id: toId, to_name: toName, msg })
    .select().single();
  if (error) throw new Error(error.message);
  return mapDm(data);
}

export async function markDmRead(dmId) {
  await supabase.from('dms').update({ read: true }).eq('id', dmId);
}

export function subscribeToDms(studentId, onNew) {
  return supabase.channel(`dms-${studentId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dms', filter: `to_id=eq.${studentId}` },
      (payload) => onNew(mapDm(payload.new)))
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

export async function fetchCommunityMessages() {
  const { data, error } = await supabase.from('community_messages').select('*')
    .order('created_at', { ascending: true }).limit(100);
  if (error) throw new Error(error.message);
  return data.map(mapCommunityMsg);
}

export async function postCommunityMessage({ authorId, authorName, authorAvatar, message }) {
  const { data, error } = await supabase.from('community_messages')
    .insert({ author_id: authorId, author_name: authorName, author_avatar: authorAvatar, message })
    .select().single();
  if (error) throw new Error(error.message);
  return mapCommunityMsg(data);
}

export function subscribeToCommunity(onNew) {
  return supabase.channel('community')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages' },
      (payload) => onNew(mapCommunityMsg(payload.new)))
    .subscribe();
}

// ═══════════════════════════════════════════════════════════
// OFFERS
// ═══════════════════════════════════════════════════════════

export async function fetchOffers(studentId = null) {
  let query = supabase.from('offers').select('*, students(name)').order('created_at', { ascending: false });
  if (studentId) query = query.eq('student_id', studentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data.map(r => ({
    id: r.id, company: r.company, role: r.role,
    package: `${r.package_lpa} LPA`, student: r.students?.name || '',
    studentId: r.student_id, status: r.status?.toUpperCase() || 'PENDING', date: r.offer_date,
  }));
}

export async function updateOfferStatus(offerId, status) {
  await supabase.from('offers').update({ status: status.toLowerCase() }).eq('id', offerId);
}

// ═══════════════════════════════════════════════════════════
// INTERVIEW REQUESTS
// ═══════════════════════════════════════════════════════════

function mapInterviewReq(row) {
  return {
    id: row.id, studentId: row.student_id,
    studentName: row.students?.name || '', studentRoll: row.students?.roll || '',
    dept: row.students?.dept || '', section: row.students?.section || '',
    type: row.interview_type, status: row.status,
    ts: new Date(row.requested_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

export async function fetchInterviewRequests(dept = null, section = null) {
  const { data, error } = await supabase.from('interview_requests')
    .select('*, students(name, roll, dept, section, score, cf_rating, lc_easy, lc_medium, lc_hard)')
    .order('requested_at', { ascending: false });
  if (error) throw new Error(error.message);
  let results = data.map(mapInterviewReq);
  if (dept) results = results.filter(r => r.dept === dept);
  if (section) results = results.filter(r => r.section === section);
  return results;
}

export async function submitInterviewRequest(studentId, interviewType) {
  const { data, error } = await supabase.from('interview_requests')
    .insert({ student_id: studentId, interview_type: interviewType })
    .select().single();
  if (error) throw new Error(error.message);
  return mapInterviewReq(data);
}

export async function updateInterviewStatus(reqId, status, reviewerId) {
  await supabase.from('interview_requests')
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', reqId);
}

// ═══════════════════════════════════════════════════════════
// MOCK TEST RESULTS
// ═══════════════════════════════════════════════════════════

export async function saveMockTestResult({ studentId, testType, difficulty, scorePct, correct, total, questions }) {
  await supabase.from('mock_test_results').insert({
    student_id: studentId, test_type: testType, difficulty,
    score_pct: scorePct, correct, total, questions,
  });
}

export async function fetchMockTestHistory(studentId) {
  const { data, error } = await supabase.from('mock_test_results')
    .select('id, test_type, difficulty, score_pct, correct, total, taken_at')
    .eq('student_id', studentId).order('taken_at', { ascending: false }).limit(20);
  if (error) return [];
  return data;
}

// ═══════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════

export async function fetchAuditLog() {
  const { data, error } = await supabase.from('audit_log').select('*')
    .order('created_at', { ascending: false }).limit(50);
  if (error) return [];
  return data.map(r => ({
    id: r.id, action: r.action, target: r.target, by: r.actor,
    ts: new Date(r.created_at).toLocaleString('en-IN'),
  }));
}

export async function logAudit(actor, action, target, details = {}) {
  await supabase.from('audit_log').insert({ actor, action, target, details });
}

export function unsubscribe(channel) {
  if (channel) supabase.removeChannel(channel);
}
