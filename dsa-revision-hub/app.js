(() => {
  'use strict';
  const REPO = 'Codensity30/Strivers-A2Z-DSA-Sheet';
  const API = `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`;
  const STORAGE_KEY = 'dsa-revision-hub-v1';
  const STATUS = { green: 'Green · Solid', yellow: 'Yellow · Revise', red: 'Red · Relearn', none: 'Not rated' };
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  let problems = [], metadata = {}, currentProblemId = null, activeView = 'dashboard', selectedTopic = 'all', toastTimer;

  function readSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }
  function saveSaved() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ metadata, customProblems: problems.filter(p => p.custom) })); } catch { showToast('Could not save: browser storage may be full.'); } }
  function cleanName(filename) {
    let n = filename.replace(/\.(cpp|cc|cxx|c|md|txt)$/i, '').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
    n = n.replace(/^\d+[.) _-]*/, '').replace(/\b([a-z])/g, c => c.toUpperCase());
    return n || filename;
  }
  function niceTopic(folder) { return folder.replace(/^\d+[.) _-]*/, '').replace(/[_]+/g,' ').replace(/\s+/g,' ').trim(); }
  function isProblemFile(path) {
    const base = path.split('/').pop();
    if (!/\.(cpp|cc|cxx|c)$/i.test(base)) return false;
    return !/(main|template|boilerplate|driver|test|solution[_ -]?template)/i.test(base);
  }
  function fromTree(tree) {
    const files = tree.filter(x => x.type === 'blob' && isProblemFile(x.path) && !x.path.startsWith('.github/'));
    const mapped = files.map(file => {
      const parts = file.path.split('/');
      const topicFolder = parts.length > 1 ? parts[0] : 'Uncategorized';
      const difficulty = parts.length > 2 ? parts[1] : '';
      const filename = parts[parts.length-1];
      const id = `repo:${file.path}`;
      return { id, name: cleanName(filename), topic: niceTopic(topicFolder), difficulty: difficulty && /easy|medium|hard|basic/i.test(difficulty) ? difficulty : '', url: `https://github.com/${REPO}/blob/main/${file.path}`, path: file.path, custom: false };
    });
    const unique = new Map(); mapped.forEach(p => { if (!unique.has(p.id)) unique.set(p.id,p); });
    return [...unique.values()].sort((a,b) => a.path.localeCompare(b.path, undefined, {numeric:true}));
  }
  function fallbackProblems() {
    const groups = {
      '01.Arrays': ['Largest Element in an Array','Second Largest Element','Check if Array Is Sorted','Remove Duplicates from Sorted Array','Left Rotate Array by One','Left Rotate Array by D Places','Move Zeroes to End','Linear Search','Union of Two Sorted Arrays','Missing Number','Maximum Consecutive Ones','Single Number','Longest Subarray with Sum K','Two Sum','Sort Colors','Majority Element','Maximum Subarray Sum','Best Time to Buy and Sell Stock','Rearrange Array Elements by Sign','Next Permutation','Leaders in an Array','Longest Consecutive Sequence','Set Matrix Zeroes','Rotate Matrix','Spiral Matrix','Count Subarrays with Given XOR'],
      '02.Binary Search': ['Binary Search','Lower Bound','Upper Bound','Search Insert Position','Floor and Ceil','First and Last Occurrence','Count Occurrences','Search in Rotated Sorted Array','Find Minimum in Rotated Sorted Array','Single Element in Sorted Array','Find Peak Element','Square Root of a Number','Nth Root of a Number','Koko Eating Bananas','Minimum Days to Make Bouquets','Smallest Divisor','Capacity to Ship Packages Within D Days','Kth Missing Positive Number','Aggressive Cows','Allocate Books'],
      '03.Strings': ['Remove Outer Parentheses','Reverse Words in a String','Largest Odd Number in a String','Longest Common Prefix','Isomorphic Strings','Rotate String','Valid Anagram','Sort Characters by Frequency','Roman to Integer','String to Integer (atoi)','Longest Palindromic Substring'],
      '04.Linked List': ['Introduction to Linked List','Insert Node in Linked List','Delete Node in Linked List','Reverse a Linked List','Middle of the Linked List','Detect a Loop','Starting Point of Loop','Length of Loop','Palindrome Linked List','Odd Even Linked List','Remove Nth Node From End','Add Two Numbers'],
      '05.Recursion': ['Print Name N Times','Print 1 to N','Print N to 1','Sum of First N Numbers','Factorial of N','Reverse an Array','Check Palindrome String','Fibonacci Number','Generate All Subsets'],
      '06.Bit Manipulation': ['Check if the i-th Bit Is Set','Check Odd or Even','Check Power of Two','Count Set Bits','Set the i-th Bit','Clear the i-th Bit','Remove the Last Set Bit'],
      '07.Stack and Queues': ['Implement Stack Using Array','Implement Queue Using Array','Valid Parentheses','Next Greater Element','Min Stack','Largest Rectangle in Histogram'],
      '08. Sliding Window': ['Maximum Sum Subarray of Size K','Longest Substring Without Repeating Characters','Max Consecutive Ones III','Minimum Window Substring'],
      '09. Heaps': ['Introduction to Priority Queue','Kth Largest Element','Top K Frequent Elements','Merge K Sorted Lists'],
      '10. Greedy Approach': ['Assign Cookies','Lemonade Change','Jump Game','N Meetings in One Room','Minimum Platforms'],
      '11. Binary Trees': ['Inorder Traversal','Preorder Traversal','Postorder Traversal','Level Order Traversal','Maximum Depth of Binary Tree','Diameter of Binary Tree','Balanced Binary Tree','Lowest Common Ancestor'],
      '12. Binary Search Trees': ['Search in a BST','Insert into a BST','Delete Node in a BST','Validate BST','Kth Smallest Element in a BST'],
      '13. Graphs': ['BFS Traversal','DFS Traversal','Number of Provinces','Number of Islands','Flood Fill','Cycle Detection in Undirected Graph','Topological Sort','Dijkstra Algorithm'],
      '14. Dynamic Programming': ['Fibonacci DP','Climbing Stairs','House Robber','Unique Paths','Minimum Path Sum','Longest Common Subsequence','Longest Increasing Subsequence','0/1 Knapsack'],
      '15. Tries': ['Implement Trie','Search in a Trie','Longest Word With All Prefixes'],
      '16. Strings (Hard)': ['Minimum Window Substring','Rabin Karp Algorithm','Z Function']
    };
    return Object.entries(groups).flatMap(([topic,names]) => names.map((name,i) => ({id:`sample:${topic}:${i}:${slug(name)}`,name,topic:niceTopic(topic),difficulty:'',url:'https://github.com/'+REPO, path:'',custom:false,sample:true})));
  }
  async function importRepository() {
    setSync('loading','Connecting to GitHub…'); $('#refresh-btn').disabled = true;
    try {
      const response = await fetch(API, {headers:{'Accept':'application/vnd.github+json'}});
      if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.tree)) throw new Error('Repository file list was not available');
      const imported = fromTree(data.tree);
      if (!imported.length) throw new Error('No C/C++ problem files were found');
      const previous = readSaved(); metadata = previous.metadata || previous;
      const customs = previous.customProblems || problems.filter(p => p.custom);
      problems = [...imported, ...customs];
      setSync('synced',`Synced ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
      renderAll(); showToast(`Imported ${imported.length} problem files from GitHub.`);
    } catch (err) {
      const previous = readSaved(); metadata = previous.metadata || previous;
      const customs = previous.customProblems || problems.filter(p => p.custom);
      if (!problems.length) problems = fallbackProblems();
      problems = [...problems.filter(p => !p.custom), ...customs];
      // If the network is unavailable, preserve any saved state and make the fallback explicit.
      setSync('error','Offline sample list');
      renderAll();
      showToast('GitHub import failed. Showing a starter list; use Sync repository when online.');
      console.warn('Repository import failed:', err);
    } finally { $('#refresh-btn').disabled = false; }
  }
  function setSync(state,label) { const el=$('#sync-state'); el.className='sync-state '+(state==='synced'?'synced':state==='error'?'error':''); el.innerHTML=`<span class="sync-dot"></span> ${esc(label)}`; }
  function stateOf(p) { return metadata[p.id] || {}; }
  function statusOf(p) { return stateOf(p).status || 'none'; }
  function dateToday() { const d=new Date(); d.setHours(0,0,0,0); return d; }
  function dateStr(d) { const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
  function addDays(date,n) { const d=new Date(date+'T12:00:00'); d.setDate(d.getDate()+n); return dateStr(d); }
  function suggestedDue(status) { const days={red:1,yellow:3,green:14,none:3}; return addDays(dateStr(dateToday()),days[status]||3); }
  function dueDate(p) { const s=stateOf(p); return s.due || (s.status && s.status!=='none' ? suggestedDue(s.status) : ''); }
  function dueInfo(p) {
    const due=dueDate(p); if(!due) return {text:'Set date',due:false,overdue:false};
    const delta=Math.round((new Date(due+'T00:00:00')-dateToday())/86400000);
    if(delta<0) return {text:`${Math.abs(delta)}d overdue`,due:true,overdue:true};
    if(delta===0) return {text:'Due today',due:true,overdue:false};
    if(delta===1) return {text:'Tomorrow',due:false,overdue:false};
    return {text:`In ${delta} days`,due:false,overdue:false};
  }
  function isDue(p) { const s=stateOf(p), d=dueDate(p); return !!d && d<=dateStr(dateToday()) || (['red','yellow'].includes(s.status) && !d); }
  function topicNames() { return [...new Set(problems.map(p=>p.topic))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})); }
  function topicCount(topic) { return problems.filter(p=>p.topic===topic).length; }
  function progressTopic(topic) { const ps=problems.filter(p=>p.topic===topic); return ps.length ? Math.round(ps.filter(p=>stateOf(p).status==='green').length/ps.length*100) : 0; }
  function renderTopics() {
    const topics=topicNames();
    $('#topic-list').innerHTML=topics.map(t=>`<button class="topic-link ${selectedTopic===t?'selected':''}" data-topic="${esc(t)}"><i class="topic-symbol"></i><span>${esc(t)}</span><span class="topic-num">${topicCount(t)}</span></button>`).join('') || '<div class="muted small">No topics found</div>';
    $('#topic-filter').innerHTML='<option value="all">All topics</option>'+topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
    $('#topic-filter').value=selectedTopic;
    $('#topic-progress').innerHTML=topics.slice(0,12).map(t=>`<div class="topic-progress-item" data-topic="${esc(t)}"><div class="topic-progress-head"><span class="topic-progress-name">${esc(t)}</span><span class="topic-progress-count">${problems.filter(p=>p.topic===t&&stateOf(p).status==='green').length}/${topicCount(t)} green · ${progressTopic(t)}%</span></div><div class="topic-progress-track"><span style="width:${progressTopic(t)}%"></span></div></div>`).join('');
  }
  function stats() {
    const counts={green:0,yellow:0,red:0,none:0}; problems.forEach(p=>counts[statusOf(p)]++);
    $('#stat-total').textContent=problems.length.toLocaleString(); $('#stat-green').textContent=counts.green.toLocaleString(); $('#stat-yellow').textContent=counts.yellow.toLocaleString(); $('#stat-red').textContent=counts.red.toLocaleString();
    $('#tracked-count').textContent=(counts.green+counts.yellow+counts.red).toLocaleString();
    $('#legend-green').textContent=counts.green;$('#legend-yellow').textContent=counts.yellow;$('#legend-red').textContent=counts.red;$('#legend-none').textContent=counts.none;
    const pct=problems.length?Math.round(counts.green/problems.length*100):0;$('#side-percent').textContent=pct+'%';$('#side-progress').style.width=pct+'%';
    const totalTracked=counts.green+counts.yellow+counts.red; const deg=totalTracked?counts.green/totalTracked*360:0, deg2=totalTracked?(counts.green+counts.yellow)/totalTracked*360:0;
    $('#donut').style.background=`conic-gradient(#219966 0deg ${deg}deg,#e7b52d ${deg}deg ${deg2}deg,#dd5359 ${deg2}deg 360deg)`;
    const due=problems.filter(isDue).length;$('#sidebar-total').textContent=problems.length;$('#sidebar-due').textContent=due;
  }
  function statusPill(status) { return `<span class="status-pill ${status}">${status==='green'?'✓':status==='yellow'?'↻':status==='red'?'!':'○'} ${esc(STATUS[status]||STATUS.none)}</span>`; }
  function renderQueue() {
    const queue=problems.filter(p=>isDue(p)||['red','yellow'].includes(statusOf(p))).sort((a,b)=>({red:0,yellow:1,none:2,green:3}[statusOf(a)]-({red:0,yellow:1,none:2,green:3}[statusOf(b)]) || (dueDate(a)||'9999').localeCompare(dueDate(b)||'9999'))).slice(0,5);
    $('#revision-queue').innerHTML=queue.length?queue.map(p=>`<div class="queue-item"><span class="queue-color ${statusOf(p)}"></span><div><div class="queue-title" title="${esc(p.name)}">${esc(p.name)}</div><div class="queue-meta">${esc(p.topic)} · ${esc(dueInfo(p).text)}</div></div><div class="queue-actions">${statusPill(statusOf(p))}<button class="tiny-open" data-open="${esc(p.id)}" title="Open notes">↗</button></div></div>`).join(''):'<div class="empty-queue"><div class="empty-check">✓</div><strong>You are all caught up.</strong><p>Rate problems yellow or red to build your revision queue.</p></div>';
  }
  function matchesFilters(p) {
    const q=$('#search-input').value.trim().toLowerCase(), topic=$('#topic-filter').value, status=$('#status-filter').value;
    return (!q || `${p.name} ${p.topic} ${p.difficulty||''}`.toLowerCase().includes(q)) && (topic==='all'||p.topic===topic) && (status==='all'||statusOf(p)===status);
  }
  function renderTable() {
    let list=problems.filter(matchesFilters);const sort=$('#sort-filter').value;
    if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name));
    if(sort==='due') list.sort((a,b)=>(dueDate(a)||'9999').localeCompare(dueDate(b)||'9999'));
    if(sort==='recent') list.sort((a,b)=>(stateOf(b).updated||'').localeCompare(stateOf(a).updated||''));
    $('#results-count').textContent=`${list.length} problem${list.length===1?'':'s'}`;
    $('#problem-table').innerHTML=list.map(p=>{const di=dueInfo(p);return `<tr><td><button class="problem-name" data-open="${esc(p.id)}">${esc(p.name)}</button><div class="problem-subtitle">${p.custom?'Personal problem':p.difficulty?esc(p.difficulty):p.sample?'Starter example':'Repository file'}</div></td><td class="topic-cell" title="${esc(p.topic)}">${esc(p.topic)}</td><td><select class="status-select ${statusOf(p)}" data-status="${esc(p.id)}" aria-label="Status for ${esc(p.name)}"><option value="none" ${statusOf(p)==='none'?'selected':''}>○ Not rated</option><option value="green" ${statusOf(p)==='green'?'selected':''}>✓ Green</option><option value="yellow" ${statusOf(p)==='yellow'?'selected':''}>↻ Yellow</option><option value="red" ${statusOf(p)==='red'?'selected':''}>! Red</option></select></td><td><span class="due-text ${di.overdue?'overdue':''}">${esc(di.text)}</span></td><td><button class="row-more" data-open="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">···</button></td></tr>`;}).join('');
    $('#empty-state').classList.toggle('hidden',list.length!==0);$('#problem-table').parentElement.classList.toggle('hidden',list.length===0);$('#table-footer-count').textContent=`Showing ${list.length} of ${problems.length} problems`;
  }
  function renderDue() {
    const due=problems.filter(isDue).sort((a,b)=>(dueDate(a)||'9999').localeCompare(dueDate(b)||'9999'));
    $('#due-count').textContent=`${due.length} due`;
    $('#due-list').innerHTML=due.length?due.map(p=>`<div class="due-card"><span class="queue-color ${statusOf(p)}"></span><div class="due-card-main"><h3>${esc(p.name)}</h3><p>${esc(p.topic)} · ${esc(dueInfo(p).text)}</p></div>${statusPill(statusOf(p))}<div class="due-card-actions"><button class="button secondary" data-open="${esc(p.id)}">Review notes</button></div></div>`).join(''):'<div class="empty-due"><span style="font-size:26px">✓</span><strong>No revisions due right now</strong><p>Set review dates or mark a problem Yellow / Red to add it to the queue.</p><button class="button secondary" data-view="problems">Browse problems</button></div>';
  }
  function renderAll() { renderTopics();stats();renderQueue();renderTable();renderDue(); }
  function setView(view) {
    activeView=view;['dashboard','problems','due'].forEach(v=>$(`#${v}-view`).classList.toggle('hidden',v!==view));
    $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $('#breadcrumb-current').textContent=view==='dashboard'?'Overview':view==='problems'?'All problems':'Due for revision';
    $('#page-title').innerHTML=view==='dashboard'?'Good practice starts with <span>recall.</span>':view==='problems'?'Your problem <span>library.</span>':'Make revision <span>count.</span>';
    $('#page-subtitle').textContent=view==='dashboard'?'Track what you know, spot what needs work, and revisit it at the right time.':view==='problems'?'Search the sheet, record your thinking, and be honest about your recall.':'Focus on what is due, then update your status after a real attempt.';
    $('#today-label').textContent=view==='dashboard'?'YOUR LEARNING WORKSPACE':view==='problems'?'YOUR PRACTICE LIBRARY':'YOUR REVISION PLAN';
    $('#list-heading').textContent=selectedTopic==='all'?'All problems':selectedTopic;
    if(view==='problems') renderTable();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function openProblem(id) {
    const p=problems.find(x=>x.id===id);if(!p)return;currentProblemId=id;const s=stateOf(p);
    $('#dialog-title').textContent=p.name;$('#dialog-topic').textContent=`${p.topic}${p.difficulty?' · '+p.difficulty:''}`;
    const link=s.url||p.url||`https://github.com/${REPO}`;$('#source-link').href=link;$('#source-link').style.display=link?'inline':'none';$('#note-url').value=s.url||p.url||'';
    $$('input[name="status"]').forEach(r=>r.checked=(s.status||'none')===r.value);
    $('#note-intuition').value=s.intuition||'';$('#note-approach').value=s.approach||'';$('#note-time').value=s.time||'';$('#note-space').value=s.space||'';$('#note-mistakes').value=s.mistakes||'';$('#note-extra').value=s.notes||'';$('#note-due').value=s.due||'';
    $('#last-reviewed').textContent=s.reviewed?`Last reviewed ${s.reviewed}`:'Not reviewed yet';$('#problem-dialog').showModal();
  }
  function saveProblem(e) {
    e.preventDefault();if(!currentProblemId)return;
    const old=stateOf(problems.find(p=>p.id===currentProblemId)||{});const checked=$('input[name="status"]:checked');const newStatus=checked?checked.value:(old.status||'none');
    const changedStatus=newStatus!==(old.status||'none');const next={...old,status:newStatus,intuition:$('#note-intuition').value.trim(),approach:$('#note-approach').value.trim(),time:$('#note-time').value.trim(),space:$('#note-space').value.trim(),mistakes:$('#note-mistakes').value.trim(),notes:$('#note-extra').value.trim(),url:$('#note-url').value.trim(),due:$('#note-due').value,updated:new Date().toISOString()};
    if(changedStatus && newStatus!=='none') {next.reviewed=dateStr(dateToday()); if(!next.due) next.due=suggestedDue(newStatus);}
    if(newStatus==='none'&&!next.due) next.due='';
    metadata[currentProblemId]=next;saveSaved();$('#problem-dialog').close();renderAll();showToast('Notes saved on this device.');
  }
  function changeStatus(id,status) {
    const old=stateOf(problems.find(p=>p.id===id)||{});const next={...old,status,updated:new Date().toISOString()};
    if(status==='none'){next.reviewed='';}else{next.reviewed=dateStr(dateToday());if(!old.due||old.due<dateStr(dateToday()))next.due=suggestedDue(status);}
    metadata[id]=next;saveSaved();renderAll();showToast('Recall status updated.');
  }
  function addProblem(e) {
    e.preventDefault();const name=$('#add-name').value.trim(),topic=$('#add-topic').value.trim();if(!name||!topic)return;
    const id=`custom:${Date.now()}:${slug(name)}`;const url=$('#add-url').value.trim();problems.push({id,name,topic,difficulty:'',url,path:'',custom:true});metadata[id]={status:'none',url,updated:new Date().toISOString()};saveSaved();$('#add-dialog').close();$('#add-form').reset();selectedTopic='all';$('#topic-filter').value='all';setView('problems');renderAll();showToast('Problem added.');
  }
  function showToast(message) {const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2900);}
  function exportData() {const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),repository:`https://github.com/${REPO}`,metadata,customProblems:problems.filter(p=>p.custom)},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='dsa-revision-hub-backup.json';a.click();URL.revokeObjectURL(url);showToast('Backup exported. Keep it somewhere safe.');}
  document.addEventListener('click',e=>{
    const open=e.target.closest('[data-open]');if(open){openProblem(open.dataset.open);return;}
    const view=e.target.closest('[data-view]');if(view){setView(view.dataset.view);return;}
    const topic=e.target.closest('[data-topic]');if(topic){selectedTopic=topic.dataset.topic;$('#topic-filter').value=selectedTopic;setView('problems');renderTopics();renderTable();return;}
  });
  document.addEventListener('change',e=>{if(e.target.matches('[data-status]'))changeStatus(e.target.dataset.status,e.target.value);});
  ['search-input','topic-filter','status-filter','sort-filter'].forEach(id=>$('#'+id).addEventListener(id==='search-input'?'input':'change',()=>renderTable()));
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $('#clear-topic').addEventListener('click',()=>{selectedTopic='all';$('#topic-filter').value='all';renderTopics();renderTable();});
  $('#refresh-btn').addEventListener('click',importRepository);$('#add-btn').addEventListener('click',()=>$('#add-dialog').showModal());
  $('#dialog-form').addEventListener('submit',saveProblem);$('#add-form').addEventListener('submit',addProblem);
  $('#cancel-dialog').addEventListener('click',()=>$('#problem-dialog').close());$('#cancel-add').addEventListener('click',()=>$('#add-dialog').close());
  $('#reset-status').addEventListener('click',()=>{if(!currentProblemId)return;const s=stateOf(problems.find(p=>p.id===currentProblemId)||{});metadata[currentProblemId]={...s,status:'none',reviewed:'',updated:new Date().toISOString()};saveSaved();$('#problem-dialog').close();renderAll();showToast('Status reset. Your notes were kept.');});
  $('#export-btn').addEventListener('click',exportData);$('#backup-link').addEventListener('click',exportData);
  $('#reset-filters').addEventListener('click',()=>{$('#search-input').value='';$('#topic-filter').value='all';$('#status-filter').value='all';selectedTopic='all';renderTopics();renderTable();});
  $('#today-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
  const saved=readSaved();metadata=saved.metadata||saved;problems=[...fallbackProblems(),...(saved.customProblems||[])];renderAll();importRepository();
})();
