(() => {
  'use strict';

  const REPO = 'Codensity30/Strivers-A2Z-DSA-Sheet';
  const API = `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`;
  const STORAGE_KEY = 'dsa-revision-hub-v1';
  const STATUS = {
    green: 'Green · Solid',
    yellow: 'Yellow · Revise',
    red: 'Red · Relearn',
    none: 'Not rated'
  };

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  let problems = [];
  let metadata = {};
  let currentProblemId = null;
  let activeView = 'dashboard';
  let selectedTopic = 'all';
  let toastTimer = null;
  let autosaveTimer = null;

  // ---------------------------------------------------------------------------
  // Clean names & topics
  // ---------------------------------------------------------------------------
  function cleanName(filename) {
    let n = filename.replace(/\.(cpp|cc|cxx|c|md|txt)$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    n = n.replace(/^\d+[.) _-]*/, '').replace(/\b([a-z])/g, c => c.toUpperCase());
    return n || filename;
  }

  function niceTopic(folder) {
    return folder.replace(/^\d+[.) _-]*/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function cleanDifficulty(raw) {
    if (!raw) return '';
    if (/easy/i.test(raw)) return 'Easy';
    if (/medium/i.test(raw)) return 'Medium';
    if (/hard/i.test(raw)) return 'Hard';
    if (/basic/i.test(raw)) return 'Basic';
    return '';
  }

  function buildProblemFromPath(path) {
    const parts = path.split('/');
    const topicFolder = parts.length > 1 ? parts[0] : 'Uncategorized';
    const rawDiff = parts.length > 2 ? parts[1] : '';
    const filename = parts[parts.length - 1];
    const id = `repo:${path}`;
    return {
      id,
      name: cleanName(filename),
      topic: niceTopic(topicFolder),
      difficulty: cleanDifficulty(rawDiff),
      url: `https://github.com/${REPO}/blob/main/${encodeURI(path)}`,
      path,
      custom: false
    };
  }

  function buildDefaultProblems() {
    if (window.DEFAULT_SHEET_PATHS && Array.isArray(window.DEFAULT_SHEET_PATHS)) {
      return window.DEFAULT_SHEET_PATHS.map(buildProblemFromPath);
    }
    // Minimal fallback if data.js wasn't loaded
    const groups = {
      '01.Arrays': ['Largest Element in an Array', 'Second Largest Element', 'Check if Array Is Sorted', 'Remove Duplicates from Sorted Array', 'Two Sum', 'Sort Colors', 'Majority Element', 'Maximum Subarray Sum', 'Next Permutation', 'Longest Consecutive Sequence'],
      '02.Binary Search': ['Binary Search', 'Lower Bound', 'Upper Bound', 'Search Insert Position', 'Floor and Ceil', 'Search in Rotated Sorted Array', 'Find Minimum in Rotated Sorted Array', 'Find Peak Element', 'Koko Eating Bananas'],
      '03.Strings': ['Remove Outer Parentheses', 'Reverse Words in a String', 'Largest Odd Number in a String', 'Longest Common Prefix', 'Isomorphic Strings', 'Valid Anagram'],
      '04.Linked List': ['Introduction to Linked List', 'Reverse a Linked List', 'Middle of the Linked List', 'Detect a Loop', 'Starting Point of Loop'],
      '05.Recursion': ['Print Name N Times', 'Sum of First N Numbers', 'Factorial of N', 'Reverse an Array', 'Check Palindrome String'],
      '06.Bit Manipulation': ['Check if the i-th Bit Is Set', 'Check Odd or Even', 'Count Set Bits'],
      '07.Stack and Queues': ['Valid Parentheses', 'Next Greater Element', 'Min Stack', 'Largest Rectangle in Histogram'],
      '08. Sliding Window': ['Maximum Sum Subarray of Size K', 'Longest Substring Without Repeating Characters'],
      '09. Heaps': ['Introduction to Priority Queue', 'Kth Largest Element', 'Top K Frequent Elements'],
      '10. Greedy Approach': ['Assign Cookies', 'Lemonade Change', 'Jump Game', 'N Meetings in One Room'],
      '11. Binary Trees': ['Inorder Traversal', 'Preorder Traversal', 'Postorder Traversal', 'Maximum Depth of Binary Tree'],
      '12. Binary Search Trees': ['Search in a BST', 'Insert into a BST', 'Validate BST'],
      '13. Graphs': ['BFS Traversal', 'DFS Traversal', 'Number of Provinces', 'Dijkstra Algorithm'],
      '14. Dynamic Programming': ['Fibonacci DP', 'Climbing Stairs', 'House Robber', 'Longest Common Subsequence'],
      '15. Tries': ['Implement Trie', 'Search in a Trie'],
      '16. Strings (Hard)': ['Minimum Window Substring', 'Rabin Karp Algorithm', 'Z Function']
    };
    return Object.entries(groups).flatMap(([topic, names]) =>
      names.map((name, i) => ({
        id: `repo:${topic}/default_${i}_${slug(name)}.cpp`,
        name,
        topic: niceTopic(topic),
        difficulty: '',
        url: `https://github.com/${REPO}`,
        path: `${topic}/default_${i}_${slug(name)}.cpp`,
        custom: false
      }))
    );
  }

  // ---------------------------------------------------------------------------
  // LocalStorage Persistence
  // ---------------------------------------------------------------------------
  function readSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Could not read from localStorage:', e);
      return {};
    }
  }

  function saveSaved() {
    try {
      const payload = {
        version: 2,
        updatedAt: new Date().toISOString(),
        metadata,
        customProblems: problems.filter(p => p.custom),
        problems
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('LocalStorage save warning, trying compact payload:', err);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          version: 2,
          updatedAt: new Date().toISOString(),
          metadata,
          customProblems: problems.filter(p => p.custom)
        }));
      } catch (e2) {
        showToast('Could not save: browser storage may be full.');
      }
    }
  }

  function migrateLegacyMetadata(meta, currentProblems) {
    if (!meta || typeof meta !== 'object') return;
    const sampleKeys = Object.keys(meta).filter(k => k.startsWith('sample:'));
    if (!sampleKeys.length) return;
    sampleKeys.forEach(k => {
      const entry = meta[k];
      if (!entry) return;
      const parts = k.split(':');
      const slugName = parts[parts.length - 1];
      const match = currentProblems.find(p => {
        const s = slug(p.name);
        return s === slugName || s.includes(slugName) || slugName.includes(s);
      });
      if (match && match.id !== k) {
        if (!meta[match.id]) {
          meta[match.id] = { ...entry };
        } else {
          ['intuition', 'approach', 'mistakes', 'notes', 'time', 'space', 'status', 'due', 'reviewed'].forEach(field => {
            if (!meta[match.id][field] && entry[field]) {
              meta[match.id][field] = entry[field];
            }
          });
        }
      }
    });
  }

  function initData() {
    const saved = readSaved();

    // 1. Restore metadata
    if (saved.metadata && typeof saved.metadata === 'object') {
      metadata = saved.metadata;
    } else if (saved && typeof saved === 'object' && !saved.problems && !saved.customProblems) {
      metadata = saved;
    } else {
      metadata = {};
    }

    // 2. Restore custom problems
    const savedCustoms = Array.isArray(saved.customProblems)
      ? saved.customProblems
      : (Array.isArray(saved.problems) ? saved.problems.filter(p => p.custom) : []);

    // 3. Restore problems list
    if (Array.isArray(saved.problems) && saved.problems.length > 0) {
      const map = new Map(saved.problems.map(p => [p.id, p]));
      savedCustoms.forEach(c => map.set(c.id, c));
      problems = [...map.values()];
    } else {
      const defaults = buildDefaultProblems();
      const map = new Map(defaults.map(p => [p.id, p]));
      savedCustoms.forEach(c => map.set(c.id, c));
      problems = [...map.values()];
    }

    // 4. Migrate any legacy sample: IDs to repo: IDs
    migrateLegacyMetadata(metadata, problems);

    // 5. Persist the unified state
    saveSaved();
  }

  // ---------------------------------------------------------------------------
  // GitHub Syncing
  // ---------------------------------------------------------------------------
  function isProblemFile(path) {
    const base = path.split('/').pop();
    if (!/\.(cpp|cc|cxx|c)$/i.test(base)) return false;
    return !/(main|template|boilerplate|driver|test|solution[_ -]?template)/i.test(base);
  }

  function fromTree(tree) {
    const files = tree.filter(x => x.type === 'blob' && isProblemFile(x.path) && !x.path.startsWith('.github/'));
    const mapped = files.map(file => buildProblemFromPath(file.path));
    const unique = new Map();
    mapped.forEach(p => { if (!unique.has(p.id)) unique.set(p.id, p); });
    return [...unique.values()].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  }

  async function importRepository(isManual = false) {
    setSync('loading', 'Connecting to GitHub…');
    $('#refresh-btn').disabled = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const response = await fetch(API, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.tree)) throw new Error('Repository file list was not available');

      const imported = fromTree(data.tree);
      if (!imported.length) throw new Error('No C/C++ problem files were found');

      const customs = problems.filter(p => p.custom);
      problems = [...imported, ...customs];

      saveSaved();
      setSync('synced', `Synced ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      renderAll();
      if (isManual) {
        showToast(`Synced ${imported.length} problem files from GitHub.`);
      }
    } catch (err) {
      console.warn('Repository sync notice (retaining saved problems):', err.message || err);
      // Retain existing problems and metadata; indicate offline/local state
      const count = problems.length;
      setSync('synced', count ? `Saved library (${count} problems)` : 'Offline mode');
      renderAll();
      if (isManual) {
        showToast('Could not reach GitHub. Using your saved problem library.');
      }
    } finally {
      $('#refresh-btn').disabled = false;
    }
  }

  function setSync(state, label) {
    const el = $('#sync-state');
    if (!el) return;
    el.className = 'sync-state ' + (state === 'synced' ? 'synced' : state === 'error' ? 'error' : '');
    el.innerHTML = `<span class="sync-dot"></span> ${esc(label)}`;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function stateOf(p) {
    if (!p) return {};
    return metadata[p.id] || {};
  }

  function statusOf(p) {
    return stateOf(p).status || 'none';
  }

  function dateToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function dateStr(d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }

  function addDays(date, n) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return dateStr(d);
  }

  function suggestedDue(status) {
    const days = { red: 1, yellow: 3, green: 14, none: 3 };
    return addDays(dateStr(dateToday()), days[status] || 3);
  }

  function dueDate(p) {
    const s = stateOf(p);
    return s.due || (s.status && s.status !== 'none' ? suggestedDue(s.status) : '');
  }

  function dueInfo(p) {
    const due = dueDate(p);
    if (!due) return { text: 'Set date', due: false, overdue: false };
    const delta = Math.round((new Date(due + 'T00:00:00') - dateToday()) / 86400000);
    if (delta < 0) return { text: `${Math.abs(delta)}d overdue`, due: true, overdue: true };
    if (delta === 0) return { text: 'Due today', due: true, overdue: false };
    if (delta === 1) return { text: 'Tomorrow', due: false, overdue: false };
    return { text: `In ${delta} days`, due: false, overdue: false };
  }

  function isDue(p) {
    const s = stateOf(p);
    const d = dueDate(p);
    return (!!d && d <= dateStr(dateToday())) || (['red', 'yellow'].includes(s.status) && !d);
  }

  function topicNames() {
    return [...new Set(problems.map(p => p.topic))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function topicCount(topic) {
    return problems.filter(p => p.topic === topic).length;
  }

  function progressTopic(topic) {
    const ps = problems.filter(p => p.topic === topic);
    return ps.length ? Math.round(ps.filter(p => stateOf(p).status === 'green').length / ps.length * 100) : 0;
  }

  function statusPill(status) {
    return `<span class="status-pill ${status}">${status === 'green' ? '✓' : status === 'yellow' ? '↻' : status === 'red' ? '!' : '○'} ${esc(STATUS[status] || STATUS.none)}</span>`;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function renderTopics() {
    const topics = topicNames();
    $('#topic-list').innerHTML = topics.map(t =>
      `<button class="topic-link ${selectedTopic === t ? 'selected' : ''}" data-topic="${esc(t)}"><i class="topic-symbol"></i><span>${esc(t)}</span><span class="topic-num">${topicCount(t)}</span></button>`
    ).join('') || '<div class="muted small">No topics found</div>';

    $('#topic-filter').innerHTML = '<option value="all">All topics</option>' + topics.map(t =>
      `<option value="${esc(t)}">${esc(t)}</option>`
    ).join('');
    $('#topic-filter').value = selectedTopic;

    $('#topic-progress').innerHTML = topics.slice(0, 16).map(t =>
      `<div class="topic-progress-item" data-topic="${esc(t)}"><div class="topic-progress-head"><span class="topic-progress-name">${esc(t)}</span><span class="topic-progress-count">${problems.filter(p => p.topic === t && stateOf(p).status === 'green').length}/${topicCount(t)} green · ${progressTopic(t)}%</span></div><div class="topic-progress-track"><span style="width:${progressTopic(t)}%"></span></div></div>`
    ).join('');
  }

  function stats() {
    const counts = { green: 0, yellow: 0, red: 0, none: 0 };
    problems.forEach(p => counts[statusOf(p)]++);

    $('#stat-total').textContent = problems.length.toLocaleString();
    $('#stat-green').textContent = counts.green.toLocaleString();
    $('#stat-yellow').textContent = counts.yellow.toLocaleString();
    $('#stat-red').textContent = counts.red.toLocaleString();

    $('#tracked-count').textContent = (counts.green + counts.yellow + counts.red).toLocaleString();
    $('#legend-green').textContent = counts.green;
    $('#legend-yellow').textContent = counts.yellow;
    $('#legend-red').textContent = counts.red;
    $('#legend-none').textContent = counts.none;

    const pct = problems.length ? Math.round(counts.green / problems.length * 100) : 0;
    $('#side-percent').textContent = pct + '%';
    $('#side-progress').style.width = pct + '%';

    const totalTracked = counts.green + counts.yellow + counts.red;
    const deg = totalTracked ? counts.green / totalTracked * 360 : 0;
    const deg2 = totalTracked ? (counts.green + counts.yellow) / totalTracked * 360 : 0;
    $('#donut').style.background = `conic-gradient(#219966 0deg ${deg}deg,#e7b52d ${deg}deg ${deg2}deg,#dd5359 ${deg2}deg 360deg)`;

    const due = problems.filter(isDue).length;
    $('#sidebar-total').textContent = problems.length;
    $('#sidebar-due').textContent = due;
  }

  function queueSort(a, b) {
    const order = { red: 0, yellow: 1, none: 2, green: 3 };
    const diff = (order[statusOf(a)] ?? 2) - (order[statusOf(b)] ?? 2);
    if (diff !== 0) return diff;
    return (dueDate(a) || '9999').localeCompare(dueDate(b) || '9999');
  }

  function renderQueue() {
    const queue = problems
      .filter(p => isDue(p) || ['red', 'yellow'].includes(statusOf(p)))
      .sort(queueSort)
      .slice(0, 5);

    $('#revision-queue').innerHTML = queue.length
      ? queue.map(p => {
          const s = stateOf(p);
          const hasNotes = Boolean(s.intuition || s.mistakes || s.notes);
          const snippet = s.intuition
            ? `<div class="queue-snippet" title="${esc(s.intuition)}">💡 ${esc(s.intuition)}</div>`
            : (s.mistakes ? `<div class="queue-snippet" title="${esc(s.mistakes)}">⚠️ ${esc(s.mistakes)}</div>` : '');
          return `<div class="queue-item">
            <span class="queue-color ${statusOf(p)}"></span>
            <div>
              <div class="queue-title" title="${esc(p.name)}">${esc(p.name)}</div>
              <div class="queue-meta">${esc(p.topic)} · ${esc(dueInfo(p).text)}${hasNotes ? ' · 📝 Notes saved' : ''}</div>
              ${snippet}
            </div>
            <div class="queue-actions">
              ${statusPill(statusOf(p))}
              <button class="tiny-open" data-open="${esc(p.id)}" title="Open notes">↗</button>
            </div>
          </div>`;
        }).join('')
      : '<div class="empty-queue"><div class="empty-check">✓</div><strong>You are all caught up.</strong><p>Rate problems yellow or red to build your revision queue.</p></div>';
  }

  function matchesFilters(p) {
    const q = $('#search-input').value.trim().toLowerCase();
    const topic = $('#topic-filter').value;
    const status = $('#status-filter').value;
    const s = stateOf(p);

    const matchesSearch = !q ||
      `${p.name} ${p.topic} ${p.difficulty || ''} ${s.intuition || ''} ${s.mistakes || ''} ${s.notes || ''} ${s.approach || ''}`.toLowerCase().includes(q);

    const matchesTopic = (topic === 'all' || p.topic === topic);

    let matchesStatus = true;
    if (status === 'all') {
      matchesStatus = true;
    } else if (status === 'has-notes') {
      matchesStatus = Boolean(s.intuition || s.notes || s.approach);
    } else if (status === 'has-mistakes') {
      matchesStatus = Boolean(s.mistakes);
    } else if (status === 'due-only') {
      matchesStatus = isDue(p);
    } else {
      matchesStatus = statusOf(p) === status;
    }

    return matchesSearch && matchesTopic && matchesStatus;
  }

  function renderTable() {
    let list = problems.filter(matchesFilters);
    const sort = $('#sort-filter').value;
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'due') list.sort((a, b) => (dueDate(a) || '9999').localeCompare(dueDate(b) || '9999'));
    if (sort === 'status') {
      const order = { red: 0, yellow: 1, green: 2, none: 3 };
      list.sort((a, b) => (order[statusOf(a)] ?? 3) - (order[statusOf(b)] ?? 3));
    }
    if (sort === 'recent') list.sort((a, b) => (stateOf(b).updated || '').localeCompare(stateOf(a).updated || ''));

    $('#results-count').textContent = `${list.length} problem${list.length === 1 ? '' : 's'}`;

    $('#problem-table').innerHTML = list.map(p => {
      const s = stateOf(p);
      const di = dueInfo(p);
      const hasIntuition = Boolean(s.intuition);
      const hasMistakes = Boolean(s.mistakes);
      const hasNotes = Boolean(s.notes || s.approach);

      let badgesHtml = '';
      if (hasIntuition || hasMistakes || hasNotes) {
        badgesHtml = '<div class="note-badges">' +
          (hasIntuition ? '<span class="note-chip intuition" title="Intuition saved">💡 Intuition</span>' : '') +
          (hasMistakes ? '<span class="note-chip mistakes" title="Mistakes recorded">⚠️ Mistakes</span>' : '') +
          (hasNotes ? '<span class="note-chip notes" title="Personal notes saved">📝 Notes</span>' : '') +
        '</div>';
      }

      const typeDesc = p.custom ? 'Personal problem' : (p.difficulty ? esc(p.difficulty) : 'Sheet problem');

      return `<tr>
        <td>
          <button class="problem-name" data-open="${esc(p.id)}">${esc(p.name)}</button>
          <div class="problem-subtitle">${typeDesc}</div>
          ${badgesHtml}
        </td>
        <td class="topic-cell" title="${esc(p.topic)}">${esc(p.topic)}</td>
        <td>
          <select class="status-select ${statusOf(p)}" data-status="${esc(p.id)}" aria-label="Status for ${esc(p.name)}">
            <option value="none" ${statusOf(p) === 'none' ? 'selected' : ''}>○ Not rated</option>
            <option value="green" ${statusOf(p) === 'green' ? 'selected' : ''}>✓ Green</option>
            <option value="yellow" ${statusOf(p) === 'yellow' ? 'selected' : ''}>↻ Yellow</option>
            <option value="red" ${statusOf(p) === 'red' ? 'selected' : ''}>! Red</option>
          </select>
        </td>
        <td><span class="due-text ${di.overdue ? 'overdue' : ''}">${esc(di.text)}</span></td>
        <td><button class="row-more" data-open="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">···</button></td>
      </tr>`;
    }).join('');

    $('#empty-state').classList.toggle('hidden', list.length !== 0);
    $('#problem-table').parentElement.classList.toggle('hidden', list.length === 0);
    $('#table-footer-count').textContent = `Showing ${list.length} of ${problems.length} problems`;
  }

  function renderDue() {
    const due = problems.filter(isDue).sort((a, b) => (dueDate(a) || '9999').localeCompare(dueDate(b) || '9999'));
    $('#due-count').textContent = `${due.length} due`;
    $('#due-list').innerHTML = due.length
      ? due.map(p => {
          const s = stateOf(p);
          const hasNotes = Boolean(s.intuition || s.mistakes || s.notes);
          const intuitionBlock = s.intuition
            ? `<div class="due-card-intuition"><strong>💡 Intuition:</strong> ${esc(s.intuition)}</div>`
            : '';
          const mistakesBlock = s.mistakes
            ? `<div class="due-card-mistakes"><strong>⚠️ Mistakes to avoid:</strong> ${esc(s.mistakes)}</div>`
            : '';
          return `<div class="due-card">
            <span class="queue-color ${statusOf(p)}"></span>
            <div class="due-card-main">
              <h3>${esc(p.name)}</h3>
              <p>${esc(p.topic)} · ${esc(dueInfo(p).text)}${hasNotes ? ' · 📝 Notes saved' : ''}</p>
              ${intuitionBlock}
              ${mistakesBlock}
            </div>
            ${statusPill(statusOf(p))}
            <div class="due-card-actions">
              <button class="button secondary" data-open="${esc(p.id)}">Review notes</button>
            </div>
          </div>`;
        }).join('')
      : '<div class="empty-due"><span style="font-size:26px">✓</span><strong>No revisions due right now</strong><p>Set review dates or mark a problem Yellow / Red to add it to the queue.</p><button class="button secondary" data-view="problems">Browse problems</button></div>';
  }

  function renderAll() {
    renderTopics();
    stats();
    renderQueue();
    renderTable();
    renderDue();
  }

  function setView(view) {
    activeView = view;
    ['dashboard', 'problems', 'due'].forEach(v => $(`#${v}-view`).classList.toggle('hidden', v !== view));
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $('#breadcrumb-current').textContent = view === 'dashboard' ? 'Overview' : view === 'problems' ? 'All problems' : 'Due for revision';
    $('#page-title').innerHTML = view === 'dashboard' ? 'Good practice starts with <span>recall.</span>' : view === 'problems' ? 'Your problem <span>library.</span>' : 'Make revision <span>count.</span>';
    $('#page-subtitle').textContent = view === 'dashboard' ? 'Track what you know, spot what needs work, and revisit it at the right time.' : view === 'problems' ? 'Search the sheet, record your thinking, and be honest about your recall.' : 'Focus on what is due, then update your status after a real attempt.';
    $('#today-label').textContent = view === 'dashboard' ? 'YOUR LEARNING WORKSPACE' : view === 'problems' ? 'YOUR PRACTICE LIBRARY' : 'YOUR REVISION PLAN';
    $('#list-heading').textContent = selectedTopic === 'all' ? 'All problems' : selectedTopic;
    if (view === 'problems') renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------------------------------------------------------------------------
  // Dialog Actions & Autosave
  // ---------------------------------------------------------------------------
  function openProblem(id) {
    const p = problems.find(x => x.id === id);
    if (!p) return;
    currentProblemId = id;
    const s = stateOf(p);

    $('#dialog-title').textContent = p.name;
    $('#dialog-topic').textContent = `${p.topic}${p.difficulty ? ' · ' + p.difficulty : ''}`;
    const link = s.url || p.url || `https://github.com/${REPO}`;
    $('#source-link').href = link;
    $('#source-link').style.display = link ? 'inline' : 'none';
    $('#note-url').value = s.url || p.url || '';

    // Status radio buttons
    $$('input[name="status"]').forEach(r => {
      const isChecked = (s.status || 'none') === r.value;
      r.checked = isChecked;
      r.dataset.wasChecked = isChecked ? 'true' : 'false';
    });

    // Inputs
    $('#note-intuition').value = s.intuition || '';
    $('#note-approach').value = s.approach || '';
    $('#note-time').value = s.time || '';
    $('#note-space').value = s.space || '';
    $('#note-mistakes').value = s.mistakes || '';
    $('#note-extra').value = s.notes || '';
    $('#note-due').value = s.due || '';

    $('#last-reviewed').textContent = s.reviewed ? `Last reviewed ${s.reviewed}` : 'Not reviewed yet';

    // Toggle delete button for custom problems
    const deleteBtn = $('#delete-problem-btn');
    if (deleteBtn) {
      deleteBtn.classList.toggle('hidden', !p.custom);
    }

    const indicator = $('#dialog-autosave-indicator');
    if (indicator) indicator.textContent = '';

    $('#problem-dialog').showModal();
  }

  function autosaveCurrentProblem() {
    if (!currentProblemId) return;
    const p = problems.find(x => x.id === currentProblemId);
    if (!p) return;
    const old = stateOf(p);
    const checked = $('input[name="status"]:checked');
    const currentStatus = checked ? checked.value : (old.status || 'none');

    const next = {
      ...old,
      status: currentStatus,
      intuition: $('#note-intuition').value.trim(),
      approach: $('#note-approach').value.trim(),
      time: $('#note-time').value.trim(),
      space: $('#note-space').value.trim(),
      mistakes: $('#note-mistakes').value.trim(),
      notes: $('#note-extra').value.trim(),
      url: $('#note-url').value.trim(),
      due: $('#note-due').value,
      updated: new Date().toISOString()
    };

    metadata[currentProblemId] = next;
    saveSaved();

    const indicator = $('#dialog-autosave-indicator');
    if (indicator) {
      indicator.textContent = 'Saved to browser';
      setTimeout(() => {
        if (indicator.textContent === 'Saved to browser') indicator.textContent = '';
      }, 2000);
    }
  }

  function saveProblem(e) {
    e.preventDefault();
    if (!currentProblemId) return;
    const p = problems.find(x => x.id === currentProblemId);
    if (!p) return;

    const old = stateOf(p);
    const checked = $('input[name="status"]:checked');
    const newStatus = checked ? checked.value : (old.status || 'none');
    const changedStatus = newStatus !== (old.status || 'none');

    const next = {
      ...old,
      status: newStatus,
      intuition: $('#note-intuition').value.trim(),
      approach: $('#note-approach').value.trim(),
      time: $('#note-time').value.trim(),
      space: $('#note-space').value.trim(),
      mistakes: $('#note-mistakes').value.trim(),
      notes: $('#note-extra').value.trim(),
      url: $('#note-url').value.trim(),
      due: $('#note-due').value,
      updated: new Date().toISOString()
    };

    if (changedStatus && newStatus !== 'none') {
      next.reviewed = dateStr(dateToday());
      if (!next.due) next.due = suggestedDue(newStatus);
    }
    if (newStatus === 'none' && !next.due) {
      next.due = '';
    }

    // If it's a custom problem and URL was changed, keep in sync
    if (p.custom && next.url) {
      p.url = next.url;
    }

    metadata[currentProblemId] = next;
    saveSaved();
    $('#problem-dialog').close();
    renderAll();
    showToast('Notes and revision status saved.');
  }

  function changeStatus(id, status) {
    const p = problems.find(x => x.id === id);
    if (!p) return;
    const old = stateOf(p);
    const next = { ...old, status, updated: new Date().toISOString() };
    if (status === 'none') {
      next.reviewed = '';
    } else {
      next.reviewed = dateStr(dateToday());
      if (!old.due || old.due < dateStr(dateToday())) next.due = suggestedDue(status);
    }
    metadata[id] = next;
    saveSaved();
    renderAll();
    showToast('Recall status updated.');
  }

  function addProblem(e) {
    e.preventDefault();
    const name = $('#add-name').value.trim();
    const topic = $('#add-topic').value.trim();
    if (!name || !topic) return;

    const id = `custom:${Date.now()}:${slug(name)}`;
    const url = $('#add-url').value.trim();
    const newProb = { id, name, topic, difficulty: '', url, path: '', custom: true };

    problems.push(newProb);
    metadata[id] = { status: 'none', url, updated: new Date().toISOString() };
    saveSaved();

    $('#add-dialog').close();
    $('#add-form').reset();
    selectedTopic = 'all';
    $('#topic-filter').value = 'all';
    setView('problems');
    renderAll();
    showToast(`Added "${name}" to your library.`);
  }

  function deleteCurrentProblem() {
    if (!currentProblemId) return;
    const p = problems.find(x => x.id === currentProblemId);
    if (!p || !p.custom) return;

    if (!confirm(`Are you sure you want to remove "${p.name}"?`)) return;

    problems = problems.filter(x => x.id !== currentProblemId);
    delete metadata[currentProblemId];
    saveSaved();

    $('#problem-dialog').close();
    renderAll();
    showToast(`Removed "${p.name}".`);
  }

  function showToast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2900);
  }

  // ---------------------------------------------------------------------------
  // Export & Import Backup
  // ---------------------------------------------------------------------------
  function exportData() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      repository: `https://github.com/${REPO}`,
      metadata,
      customProblems: problems.filter(p => p.custom),
      problems
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsa-revision-hub-backup-${dateStr(dateToday())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported. Keep it somewhere safe.');
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data && (data.metadata || typeof data === 'object')) {
          const importedMeta = data.metadata || data;
          const importedCustoms = Array.isArray(data.customProblems) ? data.customProblems : [];
          const importedProblems = Array.isArray(data.problems) ? data.problems : [];

          // Merge metadata
          metadata = { ...metadata, ...importedMeta };

          // Merge custom problems
          if (importedCustoms.length) {
            const existingIds = new Set(problems.map(p => p.id));
            importedCustoms.forEach(cp => {
              if (!existingIds.has(cp.id)) {
                problems.push(cp);
                existingIds.add(cp.id);
              }
            });
          }

          // If backup contains problem definitions
          if (importedProblems.length) {
            const map = new Map(problems.map(p => [p.id, p]));
            importedProblems.forEach(p => map.set(p.id, p));
            problems = [...map.values()];
          }

          saveSaved();
          renderAll();
          showToast('Backup restored successfully!');
        } else {
          throw new Error('Invalid format');
        }
      } catch (err) {
        alert('Could not restore backup file. Please ensure it is a valid DSA Revision Hub JSON backup.');
      }
    };
    reader.readAsText(file);
  }

  // ---------------------------------------------------------------------------
  // Event Bindings
  // ---------------------------------------------------------------------------
  document.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if (open) {
      openProblem(open.dataset.open);
      return;
    }

    const view = e.target.closest('[data-view]');
    if (view) {
      setView(view.dataset.view);
      return;
    }

    const topic = e.target.closest('[data-topic]');
    if (topic) {
      selectedTopic = topic.dataset.topic;
      $('#topic-filter').value = selectedTopic;
      setView('problems');
      renderTopics();
      renderTable();
      return;
    }
  });

  document.addEventListener('change', e => {
    if (e.target.matches('[data-status]')) {
      changeStatus(e.target.dataset.status, e.target.value);
    }
  });

  // Filters & Search
  ['search-input', 'topic-filter', 'status-filter', 'sort-filter'].forEach(id => {
    const el = $('#' + id);
    if (el) {
      el.addEventListener(id === 'search-input' ? 'input' : 'change', () => renderTable());
    }
  });

  // Navigation
  $$('.nav-item').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  // Clear topic filter
  $('#clear-topic').addEventListener('click', () => {
    selectedTopic = 'all';
    $('#topic-filter').value = 'all';
    renderTopics();
    renderTable();
  });

  // Sync & Add Problem
  $('#refresh-btn').addEventListener('click', () => importRepository(true));
  $('#add-btn').addEventListener('click', () => $('#add-dialog').showModal());

  // Form Submissions
  $('#dialog-form').addEventListener('submit', saveProblem);
  $('#dialog-form').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      $('#dialog-form').requestSubmit();
    }
  });
  $('#add-form').addEventListener('submit', addProblem);

  // Autosave while typing in note dialog
  $('#dialog-form').addEventListener('input', () => {
    clearTimeout(autosaveTimer);
    const indicator = $('#dialog-autosave-indicator');
    if (indicator) indicator.textContent = 'Saving…';
    autosaveTimer = setTimeout(autosaveCurrentProblem, 400);
  });

  // Ensure any pending notes in modal are saved when tab closes or unloads
  window.addEventListener('beforeunload', () => {
    if (currentProblemId) {
      autosaveCurrentProblem();
    }
  });

  // Cancel & Close dialogs
  $('#cancel-dialog').addEventListener('click', () => $('#problem-dialog').close());
  $('#cancel-add').addEventListener('click', () => $('#add-dialog').close());

  // Status radio buttons: toggle off if clicked again
  $$('input[name="status"]').forEach(radio => {
    radio.addEventListener('click', () => {
      if (radio.dataset.wasChecked === 'true') {
        radio.checked = false;
        radio.dataset.wasChecked = 'false';
      } else {
        $$('input[name="status"]').forEach(r => { r.dataset.wasChecked = 'false'; });
        radio.dataset.wasChecked = 'true';
      }
      autosaveCurrentProblem();
    });
  });

  // Reset status button
  $('#reset-status').addEventListener('click', () => {
    if (!currentProblemId) return;
    $$('input[name="status"]').forEach(r => {
      r.checked = false;
      r.dataset.wasChecked = 'false';
    });
    const s = stateOf(problems.find(p => p.id === currentProblemId) || {});
    metadata[currentProblemId] = {
      ...s,
      status: 'none',
      reviewed: '',
      updated: new Date().toISOString()
    };
    saveSaved();
    $('#problem-dialog').close();
    renderAll();
    showToast('Status reset to Not rated.');
  });

  // Delete problem button (for custom problems)
  const deleteBtn = $('#delete-problem-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deleteCurrentProblem);
  }

  // Backup & Restore
  $('#export-btn').addEventListener('click', exportData);
  $('#backup-link').addEventListener('click', exportData);

  const importBtn = $('#import-btn');
  const importFile = $('#import-file');
  const restoreLink = $('#restore-link');

  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
  }
  if (restoreLink && importFile) {
    restoreLink.addEventListener('click', () => importFile.click());
  }
  if (importFile) {
    importFile.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) {
        importData(e.target.files[0]);
        importFile.value = '';
      }
    });
  }

  // Reset filters button
  $('#reset-filters').addEventListener('click', () => {
    $('#search-input').value = '';
    $('#topic-filter').value = 'all';
    $('#status-filter').value = 'all';
    selectedTopic = 'all';
    renderTopics();
    renderTable();
  });

  // Initialize date header
  $('#today-label').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).toUpperCase();

  // ---------------------------------------------------------------------------
  // Bootstrapping
  // ---------------------------------------------------------------------------
  initData();
  renderAll();
  importRepository(false);
})();
