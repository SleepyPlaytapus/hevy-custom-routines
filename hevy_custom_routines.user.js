// ==UserScript==
// @name         Hevy Manager
// @namespace    https://github.com/YOUR_NICK/hevy-manager
// @version      1.0.0
// @description  Manage Hevy routines without Pro — import, edit, create from text or AI, sync back to Hevy
// @author       YOUR_NICK
// @match        https://hevy.com/*
// @grant        GM_xmlhttpRequest
// @connect      api.hevyapp.com
// @connect      hevy.com
// @run-at       document-start
// @license      MIT
// @homepageURL  https://github.com/YOUR_NICK/hevy-manager
// @supportURL   https://github.com/YOUR_NICK/hevy-manager/issues
// @updateURL    https://raw.githubusercontent.com/YOUR_NICK/hevy-manager/main/hevy_manager.user.js
// @downloadURL  https://raw.githubusercontent.com/YOUR_NICK/hevy-manager/main/hevy_manager.user.js
// @require      https://raw.githubusercontent.com/YOUR_NICK/hevy-manager/main/hevy_exercises.js
// ==/UserScript==

(function () {
    'use strict';

    // ── Cardio exercise types ──────────────────────────────────────
    const CARDIO_TYPES = new Set(['duration', 'distance_duration', 'distance']);
    const CARDIO_IDS = new Set([
        '213AB238','3303376C','AC1BB830','0222DB42','B60A678F','D8F7F851',
        '1C34A172','023947AB','84325755','911A58D3','24A809EF','527DA061',
        '8C9D2928','243710DE','4377A52B','4377A52C','9283BABA','E23F1F2B',
        '79EF4E4F','B4F2FF72','5E0DDACE','43573BB8','084A67CA'
    ]);

    function isCardio(ex) {
        return CARDIO_TYPES.has(ex.exercise_type) || CARDIO_IDS.has(ex.template_id);
    }

    // ── State ──────────────────────────────────────────────────────
    let capturedToken = null;
    let panel = null;
    let isOpen = false;
    let exerciseTemplates = [];

    // Load exercise DB
    (function initDB() {
        const stored = JSON.parse(localStorage.getItem('hcr_exercise_templates') || '[]');
        const clean = stored.filter(e =>
            e.id && e.title && e.title.length > 2
            && /[a-zA-Z]{2,}/.test(e.title)
            && !/^\d+\s*(kg|lbs|reps|x)$/i.test(e.title)
            && !e.title.toLowerCase().startsWith('exercise ')
        );
        if (clean.length === 0 && typeof HEVY_EXERCISES !== 'undefined') {
            exerciseTemplates = HEVY_EXERCISES;
            localStorage.setItem('hcr_exercise_templates', JSON.stringify(HEVY_EXERCISES));
        } else {
            exerciseTemplates = clean;
            if (clean.length !== stored.length)
                localStorage.setItem('hcr_exercise_templates', JSON.stringify(clean));
        }
    })();

    // ── 1. XHR token + exercise template interceptor ───────────────
    const origOpen = XMLHttpRequest.prototype.open;
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url; this._method = method;
        return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (this._url?.includes('hevyapp.com') && name.toLowerCase() === 'authorization' && !capturedToken) {
            capturedToken = value;
            console.log('[HCR] Token captured');
            updateTokenStatus();
        }
        return origSetHeader.apply(this, arguments);
    };

    let lastClickedName = null;

    XMLHttpRequest.prototype.send = function(body) {
        if (this._url?.includes('hevyapp.com')) {
            this.addEventListener('load', function() {
                // Capture exercise by click
                const tidMatch = this._url.match(/exerciseTemplateId=([A-Za-z0-9]+)/);
                if (tidMatch && lastClickedName) {
                    const id = tidMatch[1];
                    const current = JSON.parse(localStorage.getItem('hcr_exercise_templates') || '[]');
                    if (!current.some(e => e.id === id)) {
                        current.push({ id, title: lastClickedName });
                        localStorage.setItem('hcr_exercise_templates', JSON.stringify(current));
                        exerciseTemplates = current;
                        updateExCount();
                    }
                    lastClickedName = null;
                }
                // Capture from XHR responses
                try {
                    const data = JSON.parse(this.responseText);
                    let templates = null;
                    if (this._url.includes('custom_exercise_templates') && Array.isArray(data)) templates = data;
                    if (data?.exercise_templates && Array.isArray(data.exercise_templates)) templates = data.exercise_templates;
                    if (templates?.length > 0) {
                        let added = 0;
                        const current = JSON.parse(localStorage.getItem('hcr_exercise_templates') || '[]');
                        templates.forEach(t => {
                            if (t.id && t.title && !current.some(e => e.id === t.id)) {
                                current.push({ id: t.id, title: t.title });
                                added++;
                            }
                        });
                        if (added > 0) {
                            localStorage.setItem('hcr_exercise_templates', JSON.stringify(current));
                            exerciseTemplates = current;
                            updateExCount();
                        }
                    }
                } catch(e) {}
            });
        }
        return origSend.apply(this, arguments);
    };

    function setupExerciseClickInterceptor() {
        document.addEventListener('click', e => {
            const item = e.target.closest('.sc-e701c0fb-1');
            if (item) {
                const nameEl = item.querySelector('p.sc-cf0e62f1-7.eZWhEp');
                if (nameEl) lastClickedName = nameEl.innerText.trim();
            }
        }, true);
    }

    // ── 2. Auto-fetch exercises ────────────────────────────────────
    function autoFetchExercises() {
        const btn = document.getElementById('hcr-fetch-btn');
        if (!location.href.includes('/exercise')) {
            alert('Go to hevy.com/exercise first, then click this button.');
            return;
        }
        const items = [...document.querySelectorAll('.sc-e701c0fb-1')];
        if (items.length === 0) { alert('Exercise list not loaded yet. Wait and retry.'); return; }

        const known = new Set(JSON.parse(localStorage.getItem('hcr_exercise_templates') || '[]').map(e => e.title));
        const todo = items.filter(item => {
            const el = item.querySelector('p.sc-cf0e62f1-7.eZWhEp');
            return el && !known.has(el.innerText.trim());
        });

        if (todo.length === 0) {
            const n = JSON.parse(localStorage.getItem('hcr_exercise_templates') || '[]').length;
            if (btn) { btn.textContent = `ℹ️ All fetched (${n})`; btn.disabled = false; }
            return;
        }
        if (btn) { btn.textContent = `⏳ ${todo.length} remaining...`; btn.disabled = true; }

        let i = 0;
        function next() {
            if (i >= todo.length) {
                exerciseTemplates = JSON.parse(localStorage.getItem('hcr_exercise_templates') || '[]');
                updateExCount();
                if (btn) { btn.textContent = `✅ Done! (${exerciseTemplates.length} total)`; btn.disabled = false; }
                return;
            }
            const item = todo[i];
            const el = item.querySelector('p.sc-cf0e62f1-7.eZWhEp');
            if (el) { lastClickedName = el.innerText.trim(); item.click(); }
            i++;
            if (btn) btn.textContent = `⏳ ${i}/${todo.length} | DB: ${
                JSON.parse(localStorage.getItem('hcr_exercise_templates') || '[]').length
            }`;
            setTimeout(next, 800);
        }
        next();
    }

    // ── 3. Helpers ─────────────────────────────────────────────────
    function updateExCount() {
        const el = document.getElementById('hcr-ex-count');
        if (el) el.innerText = exerciseTemplates.length;
    }

    function updateTokenStatus() {
        const el = document.getElementById('hcr-token-status');
        if (el) el.innerHTML = capturedToken
            ? '✅ Token OK'
            : '⚠️ No token — browse the site';
    }

    function getSavedRoutines() {
        try { return JSON.parse(localStorage.getItem('hcr_routines') || '[]'); } catch { return []; }
    }

    function saveRoutines(r) { localStorage.setItem('hcr_routines', JSON.stringify(r)); }

    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || 'GET', url,
                headers: options.headers || {},
                data: options.body || null,
                onload: r => resolve({
                    ok: r.status >= 200 && r.status < 300,
                    status: r.status, text: r.responseText,
                    json: () => JSON.parse(r.responseText)
                }),
                onerror: () => reject(new Error('Network error'))
            });
        });
    }

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'authorization': capturedToken,
            'x-api-key': 'shelobs_hevy_web',
            'Hevy-Platform': 'web'
        };
    }

    function fmtDuration(secs) {
        if (!secs) return '';
        const m = Math.floor(secs / 60), s = secs % 60;
        return s > 0 ? `${m}min ${s}s` : `${m}min`;
    }

    // ── 4. Send / update routine in Hevy ──────────────────────────
    async function pushRoutineToHevy(routine) {
        if (!capturedToken) { alert('No token! Browse around the site first.'); return; }

        const body = {
            routine: {
                title: routine.name,
                exercises: routine.exercises.map(ex => ({
                    exercise_template_id: ex.template_id,
                    rest_seconds: ex.rest_seconds || 60,
                    notes: ex.notes || '',
                    sets: ex.sets.map((s, idx) => ({
                        index: idx,
                        indicator: s.indicator || 'normal',
                        weight_kg: s.weight_kg ?? null,
                        reps: s.reps ?? null,
                        duration_seconds: s.duration_seconds ?? null,
                        distance_meters: s.distance_meters ?? null
                    }))
                })),
                folder_id: null, index: routine.index ?? 0,
                program_id: null, notes: routine.notes || null,
                coach_force_rpe_enabled: false
            }
        };

        const isUpdate = !!routine.hevy_id;
        const url = isUpdate
            ? `https://api.hevyapp.com/routine/${routine.hevy_id}?sendSyncEventToMobileApp=true`
            : `https://api.hevyapp.com/routine?sendSyncEventToMobileApp=true`;

        try {
            const res = await gmFetch(url, { method: isUpdate ? 'PUT' : 'POST', headers: getHeaders(), body: JSON.stringify(body) });
            if (res.ok) {
                if (!isUpdate) {
                    try {
                        const newId = res.json()?.routine?.id;
                        if (newId) {
                            const rList = getSavedRoutines();
                            const idx = rList.findIndex(r => r.name === routine.name && !r.hevy_id);
                            if (idx >= 0) { rList[idx].hevy_id = newId; saveRoutines(rList); renderPanel(); }
                        }
                    } catch(e) {}
                }
                alert(`✅ "${routine.name}" ${isUpdate ? 'updated' : 'added'} in Hevy!`);
            } else {
                alert(`❌ Error ${res.status}: ${res.text}`);
            }
        } catch(e) { alert(`❌ ${e.message}`); }
    }

    // ── 5. Import routines from Hevy ──────────────────────────────
    async function importRoutinesFromHevy() {
        if (!capturedToken) { alert('No token! Browse around the site first.'); return; }

        const uuids = [...document.querySelectorAll('[data-rbd-draggable-id]')]
            .map(el => el.getAttribute('data-rbd-draggable-id'))
            .filter(id => id?.includes('-'));

        if (uuids.length === 0) {
            alert('No routines found. Go to hevy.com/routines first.');
            return;
        }

        const btn = document.getElementById('hcr-import-btn');
        if (btn) { btn.textContent = `⏳ Importing ${uuids.length}...`; btn.disabled = true; }

        let imported = 0;
        for (const uuid of uuids) {
            try {
                const res = await gmFetch(`https://api.hevyapp.com/routine/${uuid}`, { headers: getHeaders() });
                if (!res.ok) continue;
                const rd = res.json();
                const r = rd.routine || rd;
                if (!r?.title || !Array.isArray(r.exercises)) continue;

                const routine = {
                    name: r.title, hevy_id: r.id, index: r.index ?? 0,
                    exercises: r.exercises.map(ex => ({
                        template_id: ex.exercise_template_id,
                        name: exerciseTemplates.find(t => t.id === ex.exercise_template_id)?.title || ex.title || ex.exercise_template_id,
                        exercise_type: ex.exercise_type || 'weight_reps',
                        rest_seconds: ex.rest_seconds || 60,
                        notes: ex.notes || '',
                        sets: (ex.sets || []).map(s => ({
                            weight_kg: s.weight_kg ?? null, reps: s.reps ?? null,
                            duration_seconds: s.duration_seconds ?? null,
                            distance_meters: s.distance_meters ?? null,
                            indicator: s.indicator || 'normal'
                        }))
                    }))
                };

                const existing = getSavedRoutines();
                const idx = existing.findIndex(e =>
                    (e.hevy_id && e.hevy_id === routine.hevy_id) ||
                    (!e.hevy_id && e.name === routine.name)
                );
                if (idx >= 0) existing[idx] = routine; else existing.push(routine);
                saveRoutines(existing);
                imported++;
                console.log('[HCR] Imported:', routine.name);
            } catch(e) { console.log('[HCR] Import error:', uuid, e); }
        }

        if (btn) { btn.textContent = `✅ Imported ${imported}`; btn.disabled = false; }
        renderPanel();
    }

    // ── 6. Text format ─────────────────────────────────────────────
    function routineToText(routine) {
        const lines = [routine.name];
        routine.exercises.forEach(ex => {
            if (isCardio(ex)) {
                const dur = ex.sets[0]?.duration_seconds;
                const dist = ex.sets[0]?.distance_meters;
                const parts = [];
                if (dur) parts.push(fmtDuration(dur));
                if (dist) parts.push(`${dist}m`);
                lines.push(`${ex.name}: ${ex.sets.length}x ${parts.join(' ') || '?'}`);
            } else {
                const s0 = ex.sets[0];
                const reps = s0?.reps || 10;
                const weight = s0?.weight_kg;
                const sameReps = ex.sets.every(s => s.reps === reps);
                const sameWeight = ex.sets.every(s => s.weight_kg === weight);
                let line = `${ex.name}: ${ex.sets.length}x${sameReps ? reps : ex.sets.map(s => s.reps).join('/')}`;
                if (weight && sameWeight) line += ` @${weight}kg`;
                lines.push(line);
            }
        });
        return lines.join('\n');
    }

    function parseTextRoutine(text) {
        const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) return null;
        const routineName = lines[0];
        const exercises = [], errors = [];

        for (let i = 1; i < lines.length; i++) {
            const m = lines[i].match(/^(.*?):\s*(\d+)\s*[xX]\s*(\d+)(?:\s*@\s*([\d.,]+))?/);
            if (!m) continue;
            const exName = m[1].trim();
            const setsCount = parseInt(m[2]);
            const repsCount = parseInt(m[3]);
            const weightKg = m[4] ? parseFloat(m[4].replace(',', '.')) : null;
            const found = exerciseTemplates.find(t => t.title.toLowerCase() === exName.toLowerCase())
                       || exerciseTemplates.find(t => t.title.toLowerCase().includes(exName.toLowerCase()));
            if (found) {
                exercises.push({
                    template_id: found.id, name: found.title,
                    rest_seconds: 60, notes: '',
                    sets: Array.from({length: setsCount}, () => ({ weight_kg: weightKg, reps: repsCount }))
                });
            } else errors.push(exName);
        }
        if (errors.length > 0) alert(`Not found:\n\n${errors.join('\n')}\n\nThese will be skipped.`);
        return { name: routineName, exercises };
    }

    // ── 7. Backup ──────────────────────────────────────────────────
    function backupRoutines() {
        const routines = getSavedRoutines();
        if (routines.length === 0) { alert('No routines to backup.'); return; }
        const txt = routines.map(r => routineToText(r)).join('\n\n---\n\n');
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `hevy_backup_${date}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        localStorage.setItem(`hcr_backup_${date}`, JSON.stringify(routines));
        console.log(`[HCR] Backup saved: hcr_backup_${date}`);
    }

    // ── 8. UI Shell ────────────────────────────────────────────────
    const isMobile = () => window.innerWidth < 600;

    function createPanel() {
        const fab = document.createElement('button');
        fab.id = 'hcr-fab';
        fab.textContent = '📋';
        fab.style.cssText = `
            position:fixed;bottom:24px;right:16px;z-index:999999;
            width:52px;height:52px;background:#e05a2b;color:white;
            border:none;border-radius:50%;font-size:22px;cursor:pointer;
            box-shadow:0 4px 12px rgba(0,0,0,0.35);
            touch-action:manipulation;-webkit-tap-highlight-color:transparent;
        `;
        document.body.appendChild(fab);

        panel = document.createElement('div');
        panel.id = 'hcr-panel';
        panel.style.cssText = `
            display:none;position:fixed;z-index:999999;
            background:#1e1e2e;color:#cdd6f4;
            border-radius:14px;padding:16px;
            box-shadow:0 8px 32px rgba(0,0,0,0.5);
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-size:14px;overflow-y:auto;
        `;
        setPanelPosition();
        document.body.appendChild(panel);

        fab.addEventListener('click', () => {
            isOpen = !isOpen;
            panel.style.display = isOpen ? 'block' : 'none';
            if (isOpen) { setPanelPosition(); renderPanel(); }
        });

        window.addEventListener('resize', () => { if (isOpen) setPanelPosition(); });
    }

    function setPanelPosition() {
        if (isMobile()) {
            Object.assign(panel.style, {
                bottom: '0', left: '0', right: '0', top: 'auto',
                width: '100%', maxHeight: '85vh',
                borderRadius: '14px 14px 0 0', boxSizing: 'border-box'
            });
        } else {
            Object.assign(panel.style, {
                bottom: '86px', right: '16px', left: 'auto', top: 'auto',
                width: '400px', maxHeight: '80vh',
                borderRadius: '14px'
            });
        }
    }

    // ── 9. Main Panel ──────────────────────────────────────────────
    function renderPanel() {
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <strong style="font-size:16px">📋 Hevy Routines</strong>
                <div style="display:flex;gap:6px;align-items:center">
                    <button id="hcr-new-text" style="${btnStyle('#45475a','#cdd6f4')}">📝 Text</button>
                    <button id="hcr-new" style="${btnStyle('#313244','#a6e3a1')}">+ New</button>
                    ${isMobile() ? `<button id="hcr-close" style="${btnStyle('#313244','#f38ba8')}">✕</button>` : ''}
                </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:11px;color:#a6adc8;">
                <span>Exercise DB: <strong id="hcr-ex-count">${exerciseTemplates.length}</strong></span>
                <span id="hcr-token-status">${capturedToken ? '✅ Token OK' : '⚠️ No token — browse the site'}</span>
            </div>

            <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:10px">
                <button id="hcr-import-btn" style="${btnStyle('#313244','#cba6f7',true)}">🔄 Import Routines from Hevy</button>
                <button id="hcr-refresh-token-btn" style="${btnStyle('#313244','#89b4fa',true)}">🔑 Refresh Token</button>
            </div>
            <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:12px">
                <button id="hcr-backup-btn" style="${btnStyle('#313244','#f9e2af')}">💾 Backup</button>
                <button id="hcr-fetch-btn" style="${btnStyle('#313244','#89b4fa')}">⬇️ Fetch Exercises</button>
                <button id="hcr-export-btn" style="${btnStyle('#313244','#a6e3a1')}">📤 Export DB</button>
            </div>

            <div id="hcr-text-parser" style="display:none;margin-bottom:10px">
                <div style="font-size:11px;color:#a6adc8;margin-bottom:4px">
                    Format: <code style="color:#a6e3a1">Exercise Name: 4x8 @80kg</code> — separate routines with blank line
                </div>
                <textarea id="hcr-text-input" placeholder="Monday Push&#10;Bench Press (Barbell): 4x8 @80kg&#10;Triceps Pushdown: 3x12&#10;&#10;Wednesday Pull&#10;Bent Over Row (Barbell): 4x8 @60kg" style="${textareaStyle('140px')}"></textarea>
                <button id="hcr-parse-btn" style="${btnStyle('#a6e3a1','#1e1e2e',true)}">⚡ Parse & Save</button>
            </div>

            <div id="hcr-list"></div>
            <div id="hcr-editor" style="display:none"></div>
        `;

        // Bind events
        if (isMobile()) document.getElementById('hcr-close')?.addEventListener('click', () => {
            isOpen = false; panel.style.display = 'none';
        });
        document.getElementById('hcr-new').addEventListener('click', () => showEditor(null));
        document.getElementById('hcr-fetch-btn').addEventListener('click', autoFetchExercises);
        document.getElementById('hcr-import-btn').addEventListener('click', importRoutinesFromHevy);
        document.getElementById('hcr-backup-btn').addEventListener('click', backupRoutines);
        document.getElementById('hcr-refresh-token-btn').addEventListener('click', () => {
            capturedToken = null;
            updateTokenStatus();
            alert('Token cleared. Reload the page or browse around to capture a new token.');
        });
        document.getElementById('hcr-export-btn').addEventListener('click', exportExerciseDB);
        document.getElementById('hcr-new-text').addEventListener('click', () => {
            const p = document.getElementById('hcr-text-parser');
            p.style.display = p.style.display === 'none' ? 'block' : 'none';
        });
        document.getElementById('hcr-parse-btn').addEventListener('click', parseAndSaveText);

        renderList(getSavedRoutines());
    }

    function exportExerciseDB() {
        const templates = JSON.parse(localStorage.getItem('hcr_exercise_templates') || '[]');
        if (templates.length === 0) { alert('Exercise DB is empty!'); return; }
        const txt = templates.map(t => `${t.title}\t${t.id}`).join('\n');
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `hevy_exercises_${templates.length}.txt`;
        a.click(); URL.revokeObjectURL(url);
    }

    function parseAndSaveText() {
        const txt = document.getElementById('hcr-text-input').value;
        const blocks = txt.trim().split(/\n\s*\n/);
        let added = 0;
        const rList = getSavedRoutines();
        blocks.forEach(block => {
            const r = parseTextRoutine(block.trim());
            if (r?.exercises.length > 0) { rList.push(r); added++; }
        });
        if (added > 0) { saveRoutines(rList); renderPanel(); }
        else alert('No exercises found. Check format and exercise DB.');
    }

    // ── 10. Routine List ───────────────────────────────────────────
    function renderList(routines) {
        const list = document.getElementById('hcr-list');
        if (routines.length === 0) {
            list.innerHTML = `
                <div style="color:#6c7086;text-align:center;margin:20px 0;font-size:13px">
                    <div style="font-size:28px;margin-bottom:8px">📭</div>
                    No saved routines.<br>
                    <span style="font-size:11px">Go to hevy.com/routines and click<br>🔄 Import Routines from Hevy</span>
                </div>`;
            return;
        }

        list.innerHTML = routines.map((r, i) => `
            <div style="background:#313244;border-radius:10px;padding:10px 12px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                    <div style="min-width:0;flex:1">
                        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
                        <div style="color:#6c7086;font-size:11px;margin-top:2px">
                            ${r.exercises.length} exercises
                            ${r.hevy_id
                                ? '<span style="background:#2a2040;color:#cba6f7;border:1px solid #6c5f8a;border-radius:4px;padding:1px 5px;margin-left:4px">hevy</span>'
                                : '<span style="background:#252535;color:#585b70;border:1px solid #45475a;border-radius:4px;padding:1px 5px;margin-left:4px">local</span>'
                            }
                        </div>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <button data-edit="${i}" title="Edit (GUI)" style="${iconBtn('#45475a','#cdd6f4')}">✏️</button>
                        <button data-textedit="${i}" title="Edit (Text)" style="${iconBtn('#45475a','#89b4fa')}">📝</button>
                        <button data-load="${i}" title="${r.hevy_id ? 'Sync to Hevy' : 'Push to Hevy'}" style="${iconBtn('#e05a2b','white')}">${r.hevy_id ? '🔄' : '➡️'}</button>
                        <button data-del="${i}" title="Delete" style="${iconBtn('#3d2030','#f38ba8')}">🗑</button>
                    </div>
                </div>
            </div>
        `).join('');

        list.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => showEditor(+b.dataset.edit)));
        list.querySelectorAll('[data-textedit]').forEach(b => b.addEventListener('click', () => showTextEditor(+b.dataset.textedit)));
        list.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', () => pushRoutineToHevy(getSavedRoutines()[+b.dataset.load])));
        list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
            const idx = +b.dataset.del;
            const rList = getSavedRoutines();
            if (confirm(`Delete "${rList[idx].name}"?`)) { rList.splice(idx, 1); saveRoutines(rList); renderPanel(); }
        }));
    }

    // ── 11. Text Editor ────────────────────────────────────────────
    function showTextEditor(routineIndex) {
        const routines = getSavedRoutines();
        const routine = routines[routineIndex];
        document.getElementById('hcr-list').style.display = 'none';
        const editor = document.getElementById('hcr-editor');
        editor.style.display = 'block';
        editor.innerHTML = `
            <button id="hcr-back" style="${btnStyle('#45475a','#cdd6f4')}">← Back</button>
            <div style="font-size:11px;color:#a6adc8;margin:8px 0">
                Format: <code style="color:#a6e3a1">Exercise: 4x8 @80kg</code> — weight optional
            </div>
            <textarea id="hcr-text-editor" style="${textareaStyle('280px')}">${routineToText(routine)}</textarea>
            <div id="hcr-textedit-err" style="color:#f38ba8;font-size:12px;margin-top:6px;display:none"></div>
            <button id="hcr-text-save" style="${btnStyle('#a6e3a1','#1e1e2e',true)}">💾 Save</button>
        `;
        document.getElementById('hcr-back').addEventListener('click', () => { editor.style.display = 'none'; renderPanel(); });
        document.getElementById('hcr-text-save').addEventListener('click', () => {
            const parsed = parseTextRoutine(document.getElementById('hcr-text-editor').value);
            const err = document.getElementById('hcr-textedit-err');
            if (!parsed?.exercises.length) { err.style.display='block'; err.textContent='No recognized exercises.'; return; }
            if (routines[routineIndex].hevy_id) parsed.hevy_id = routines[routineIndex].hevy_id;
            if (routines[routineIndex].index !== undefined) parsed.index = routines[routineIndex].index;
            const rList = getSavedRoutines(); rList[routineIndex] = parsed;
            saveRoutines(rList); editor.style.display = 'none'; renderPanel();
        });
    }

    // ── 12. GUI Editor ─────────────────────────────────────────────
    let editingExercises = [];
    let editingIndex = null;

    function showEditor(idx) {
        editingIndex = idx;
        const r = idx !== null ? getSavedRoutines()[idx] : { name: '', exercises: [] };
        editingExercises = JSON.parse(JSON.stringify(r.exercises));
        document.getElementById('hcr-list').style.display = 'none';
        document.getElementById('hcr-text-parser').style.display = 'none';
        document.getElementById('hcr-editor').style.display = 'block';
        renderEditor(r.name);
    }

    function renderEditor(name) {
        document.getElementById('hcr-editor').innerHTML = `
            <button id="hcr-back" style="${btnStyle('#45475a','#cdd6f4')}">← Back</button>
            <input id="hcr-rname" placeholder="Routine name..." value="${name.replace(/"/g,'&quot;')}"
                style="width:100%;box-sizing:border-box;background:#313244;color:#cdd6f4;border:1px solid #45475a;border-radius:8px;padding:10px;font-size:14px;margin:8px 0">
            <div id="hcr-exlist"></div>
            <div style="margin-top:10px">
                <input id="hcr-search" placeholder="🔍 Search exercise..."
                    style="width:100%;box-sizing:border-box;background:#313244;color:#cdd6f4;border:1px solid #45475a;border-radius:8px;padding:10px;font-size:13px">
                <div id="hcr-suggestions" style="background:#2a2a3e;border-radius:0 0 8px 8px;max-height:180px;overflow-y:auto"></div>
            </div>
            <button id="hcr-save" style="${btnStyle('#a6e3a1','#1e1e2e',true)}">💾 Save Routine</button>
        `;
        renderExerciseList();
        setupSearch();
        document.getElementById('hcr-back').addEventListener('click', () => { document.getElementById('hcr-editor').style.display='none'; renderPanel(); });
        document.getElementById('hcr-save').addEventListener('click', saveEditor);
    }

    function saveEditor() {
        const n = document.getElementById('hcr-rname').value.trim();
        if (!n) return alert('Enter a routine name!');
        if (!editingExercises.length) return alert('Add at least one exercise!');
        const rList = getSavedRoutines();
        const existing = editingIndex !== null ? rList[editingIndex] : null;
        const updated = { name: n, exercises: editingExercises };
        if (existing?.hevy_id) updated.hevy_id = existing.hevy_id;
        if (existing?.index !== undefined) updated.index = existing.index;
        if (editingIndex !== null) rList[editingIndex] = updated; else rList.push(updated);
        saveRoutines(rList);
        document.getElementById('hcr-editor').style.display = 'none';
        renderPanel();
    }

    function renderExerciseList() {
        const el = document.getElementById('hcr-exlist');
        if (!editingExercises.length) {
            el.innerHTML = `<p style="color:#6c7086;font-size:12px;text-align:center;margin:12px 0">No exercises yet — search below</p>`;
            return;
        }
        el.innerHTML = editingExercises.map((ex, i) => `
            <div style="background:#252535;border-radius:8px;padding:8px 10px;margin-bottom:6px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span style="font-weight:600;font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ex.name}</span>
                    <button data-delex="${i}" style="${iconBtn('#3d2030','#f38ba8')}">✕</button>
                </div>
                <div id="hcr-sets-${i}"></div>
                <button data-addset="${i}" style="background:#313244;color:#a6adc8;border:none;border-radius:5px;padding:4px 10px;cursor:pointer;font-size:11px;margin-top:4px;width:100%">+ Add Set</button>
            </div>
        `).join('');

        editingExercises.forEach((_, i) => renderSets(i));
        el.querySelectorAll('[data-delex]').forEach(b => b.addEventListener('click', () => {
            editingExercises.splice(+b.dataset.delex, 1); renderExerciseList();
        }));
        el.querySelectorAll('[data-addset]').forEach(b => b.addEventListener('click', () => {
            const i = +b.dataset.addset;
            const sets = editingExercises[i].sets;
            const prev = sets.length > 0 ? { ...sets[sets.length - 1] } : null;
            if (prev && isCardio(editingExercises[i])) {
                sets.push({ duration_seconds: prev.duration_seconds, distance_meters: prev.distance_meters, indicator: 'normal' });
            } else if (prev) {
                sets.push({ weight_kg: prev.weight_kg, reps: prev.reps, indicator: 'normal' });
            } else {
                sets.push({ weight_kg: null, reps: 10, indicator: 'normal' });
            }
            renderExerciseList();
        }));
    }

    function renderSets(i) {
        const el = document.getElementById(`hcr-sets-${i}`);
        const ex = editingExercises[i];
        const cardio = isCardio(ex);

        el.innerHTML = ex.sets.map((s, si) => {
            if (cardio) {
                const mins = s.duration_seconds ? Math.floor(s.duration_seconds / 60) : '';
                const secs = s.duration_seconds ? s.duration_seconds % 60 : '';
                const dist = s.distance_meters || '';
                return `
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
                        <span style="color:#6c7086;font-size:11px;width:16px">${si+1}.</span>
                        <input type="number" placeholder="min" value="${mins}" min="0"
                            data-exidx="${i}" data-setidx="${si}" data-field="dur_min"
                            style="${setInput('52px')}">
                        <span style="color:#6c7086;font-size:11px">:</span>
                        <input type="number" placeholder="sec" value="${secs}" min="0" max="59"
                            data-exidx="${i}" data-setidx="${si}" data-field="dur_sec"
                            style="${setInput('52px')}">
                        <span style="color:#6c7086;font-size:11px">min:sec</span>
                        <input type="number" placeholder="m" value="${dist}" min="0"
                            data-exidx="${i}" data-setidx="${si}" data-field="distance_meters"
                            style="${setInput('60px')}">
                        <span style="color:#6c7086;font-size:11px">m</span>
                        <button data-delset="${i}-${si}" style="${iconBtn('#3a3a4a','#6c7086')}">✕</button>
                    </div>`;
            } else {
                return `
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
                        <span style="color:#6c7086;font-size:11px;width:16px">${si+1}.</span>
                        <input type="number" placeholder="kg" value="${s.weight_kg ?? ''}"
                            data-exidx="${i}" data-setidx="${si}" data-field="weight_kg"
                            style="${setInput('64px')}">
                        <span style="color:#6c7086;font-size:11px">×</span>
                        <input type="number" placeholder="reps" value="${s.reps ?? ''}"
                            data-exidx="${i}" data-setidx="${si}" data-field="reps"
                            style="${setInput('64px')}">
                        <button data-delset="${i}-${si}" style="${iconBtn('#3a3a4a','#6c7086')}">✕</button>
                    </div>`;
            }
        }).join('');

        el.querySelectorAll('input[data-field]').forEach(inp => inp.addEventListener('change', () => {
            const ei = +inp.dataset.exidx, si2 = +inp.dataset.setidx, field = inp.dataset.field;
            const val = inp.value === '' ? null : parseFloat(inp.value);
            if (field === 'dur_min' || field === 'dur_sec') {
                const minEl = el.querySelector(`[data-exidx="${ei}"][data-setidx="${si2}"][data-field="dur_min"]`);
                const secEl = el.querySelector(`[data-exidx="${ei}"][data-setidx="${si2}"][data-field="dur_sec"]`);
                const m = parseFloat(minEl?.value || 0) || 0;
                const s = parseFloat(secEl?.value || 0) || 0;
                editingExercises[ei].sets[si2].duration_seconds = m * 60 + s || null;
            } else {
                editingExercises[ei].sets[si2][field] = val;
            }
        }));

        el.querySelectorAll('[data-delset]').forEach(b => b.addEventListener('click', () => {
            const [ei, si2] = b.dataset.delset.split('-').map(Number);
            editingExercises[ei].sets.splice(si2, 1);
            renderExerciseList();
        }));
    }

    function setupSearch() {
        const search = document.getElementById('hcr-search');
        const suggestions = document.getElementById('hcr-suggestions');
        if (!search) return;
        search.addEventListener('input', () => {
            const q = search.value.trim().toLowerCase();
            if (q.length < 2) { suggestions.innerHTML = ''; return; }
            const matches = exerciseTemplates.filter(t => t.title.toLowerCase().includes(q)).slice(0, 20);
            if (!matches.length) {
                suggestions.innerHTML = `<div style="padding:8px 10px;color:#6c7086;font-size:12px">No results (DB: ${exerciseTemplates.length})</div>`;
                return;
            }
            suggestions.innerHTML = matches.map(t =>
                `<div data-tid="${t.id}" data-tname="${t.title.replace(/"/g,'&quot;')}"
                    style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #2a2a3e">
                    ${t.title}
                    ${CARDIO_IDS.has(t.id) ? '<span style="color:#f9e2af;font-size:10px;margin-left:4px">cardio</span>' : ''}
                </div>`
            ).join('');
            suggestions.querySelectorAll('[data-tid]').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = '#313244');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('click', () => {
                    const isC = CARDIO_IDS.has(item.dataset.tid);
                    editingExercises.push({
                        template_id: item.dataset.tid,
                        name: item.dataset.tname,
                        exercise_type: isC ? 'duration' : 'weight_reps',
                        rest_seconds: isC ? 0 : 60,
                        notes: '',
                        sets: [isC
                            ? { duration_seconds: null, distance_meters: null, indicator: 'normal' }
                            : { weight_kg: null, reps: 10, indicator: 'normal' }]
                    });
                    search.value = ''; suggestions.innerHTML = '';
                    renderExerciseList();
                });
            });
        });
    }

    // ── 13. Style helpers ──────────────────────────────────────────
    function btnStyle(bg, color, full = false) {
        return `background:${bg};color:${color};border:1px solid #45475a;border-radius:8px;
            padding:7px 12px;cursor:pointer;font-size:12px;
            ${full ? 'width:100%;display:block;margin-top:6px;font-weight:600;' : ''}
            touch-action:manipulation;`;
    }
    function iconBtn(bg, color) {
        return `background:${bg};color:${color};border:none;border-radius:6px;
            padding:5px 8px;cursor:pointer;font-size:13px;min-width:32px;
            touch-action:manipulation;`;
    }
    function setInput(w) {
        return `width:${w};background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;
            border-radius:5px;padding:4px 6px;font-size:12px;`;
    }
    function textareaStyle(h) {
        return `width:100%;height:${h};background:#181825;color:#cdd6f4;
            border:1px solid #45475a;border-radius:8px;padding:10px;
            box-sizing:border-box;font-size:12px;resize:vertical;line-height:1.6;font-family:monospace;`;
    }

    // ── 14. Init ───────────────────────────────────────────────────
    const interval = setInterval(() => {
        if (document.body) {
            createPanel();
            setupExerciseClickInterceptor();
            clearInterval(interval);
        }
    }, 300);

})();
