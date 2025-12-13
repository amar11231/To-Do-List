let todo = JSON.parse(localStorage.getItem("todo")) || [];
// Completed tasks list (separate from `todo`) - tasks moved here when finished
let completed = JSON.parse(localStorage.getItem('completed')) || [];
// XP & Level tracking (persisted)
let stats = JSON.parse(localStorage.getItem('stats')) || { xp: 0, level: 0 };
// Theme settings: controls which CSS theme is applied and the accent color
let theme = JSON.parse(localStorage.getItem('theme')) || { name: 'gradient', color: '#2d70fd' };

function applyTheme(t){
    // Apply theme classes and set the accent color as --accent CSS var.
    // The `theme` object contains the chosen name and optional custom color.
    const body = document.body;
    body.classList.remove('theme-light','theme-dark','theme-gradient','theme-custom');
    const name = t?.name || 'gradient';
    if (name === 'light') body.classList.add('theme-light');
    else if (name === 'dark') body.classList.add('theme-dark');
    else if (name === 'custom') body.classList.add('theme-custom');
    else body.classList.add('theme-gradient');
    // set accent
    const accent = t?.color || '#2d70fd';
    document.documentElement.style.setProperty('--accent', accent);
}
/* DOM references used by the script */
const todoInput = document.getElementById("todoInput");
const todoList = document.querySelector('.scroll'); 
const todoCount = document.querySelector('.counter-container span');
const addButton = document.querySelector(".btn");
const deleteButton = document.getElementById("deleteButton");
const focusButton = document.getElementById("focusButton");
const showCompletedButton = document.getElementById('showCompleted');
const completedModal = document.getElementById('completedModal');
const completedModalListId = 'completedModalList';
// Confirmation modal elements
const confirmModal = document.getElementById('confirmModal');
const confirmMessageEl = document.getElementById('confirmMessage');
const confirmYesBtn = document.getElementById('confirmYes');
const confirmCancelBtn = document.getElementById('confirmCancel');
let _confirmResolve = null;

// Focus panel elements (created when needed)
let focusOverlay = null;
let focusTimerId = null;
// Default pomodoro duration (in seconds). Can be changed from the overlay input.
let focusRemaining = 25 * 60; // 25 minutes in seconds
let focusRunning = false;

// Initialize
document.addEventListener("DOMContentLoaded", function() {
        if (addButton) addButton.addEventListener("click", addTask);
        if (todoInput) {
            todoInput.addEventListener('keydown', function(event){
                if(event.key === 'Enter'){
                    event.preventDefault();
                    addTask();
                }
            });
        }
        if (deleteButton) deleteButton.addEventListener("click", deleteAllTasks);
        // wire completed list clear button and initial render
        const clearCompletedBtn = document.getElementById('clearCompleted');
        if (clearCompletedBtn) clearCompletedBtn.addEventListener('click', clearCompletedTasks);
            // show completed modal button
            if (showCompletedButton) showCompletedButton.addEventListener('click', openCompletedModal);
            const closeCompleted = document.getElementById('closeCompleted');
            if (closeCompleted) closeCompleted.addEventListener('click', closeCompletedModal);
            const clearCompletedModalBtn = document.getElementById('clearCompletedModal');
            if (clearCompletedModalBtn) clearCompletedModalBtn.addEventListener('click', clearCompletedTasks);
            // initial render: tasks, theme, and stats
            displayTasks();
            renderCompleted();
            // apply theme & wire controls UI
            setupThemeControls();
            applyTheme(theme);
        // render stats
        renderStats();
    } );

    function setupThemeControls(){
        const select = document.getElementById('themeSelect');
        const picker = document.getElementById('colorPicker');
        if (!select) return;
        select.value = theme.name || 'gradient';
        if (picker) picker.value = theme.color || '#2d70fd';

        select.addEventListener('change', (e) => {
            const name = e.target.value;
            theme.name = name;
            // show picker only for custom
            if (picker) picker.style.display = (name === 'custom') ? 'inline-block' : 'none';
            localStorage.setItem('theme', JSON.stringify(theme));
            applyTheme(theme);
        });
        if (picker){
            picker.addEventListener('input', (e) => {
                theme.color = e.target.value;
                localStorage.setItem('theme', JSON.stringify(theme));
                applyTheme(theme);
            });
            picker.style.display = (theme.name === 'custom') ? 'inline-block' : 'none';
        }
    }
function addTask(){
        // Add a new task to the app and persist state
        const newTask  = todoInput.value.trim();
    if (newTask !== ""){
        todo.push({
            text: newTask, disabled: false,
        });
        saveToLocalStorage();
        todoInput.value = "";
        displayTasks();
    }
}
function deleteAllTasks() {
    // Confirm with the user (browser dialog). Be careful: this deletes all tasks and history.
    if (!confirm('Delete all tasks?')) return;
    todo = [];
    saveToLocalStorage();
    displayTasks();
}

function editTask(index) {
    
    // Obtain the currently rendered <p> that shows the task text so we can swap it with an input element
    const todoItem = document.getElementById(`todo-${index}`);
    if (!todoItem) return;

    const existingText = todo[index].text;
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.value = existingText;

    
    todoItem.replaceWith(inputElement);
    inputElement.focus();

    function finishEdit() {
        const updatedText = inputElement.value.trim();
        if (updatedText !== "") {
            todo[index].text = updatedText;
            saveToLocalStorage();
        }
        displayTasks();
    }

    inputElement.addEventListener('blur', finishEdit);
    inputElement.addEventListener('keydown', function(e){
        if (e.key === 'Enter') finishEdit();
        if (e.key === 'Escape') displayTasks();
    });
}


function toggleTaskStatus(index){
    // Toggle completed/incomplete state for the given task index and adjust XP accordingly.
    if (!todo[index]) return;
    // toggle and award XP when marking as completed
    const wasDisabled = !!todo[index].disabled;
    // flip completed state
    todo[index].disabled = !wasDisabled;

    // If it was not disabled and now is disabled -> task was just completed
    if (!wasDisabled && todo[index].disabled){
        // just completed: award XP if not already awarded for this task
        if (!todo[index].xpAwarded){
            stats.xp = (stats.xp || 0) + 1;
            stats.level = Math.floor(stats.xp / 10);
            todo[index].xpAwarded = true;
        }
        // Move item into completed array and remove from todo
        const completedTask = {
            ...todo[index],
            completedAt: new Date().toISOString()
        };
        completed.unshift(completedTask);
        todo.splice(index, 1);
        localStorage.setItem('stats', JSON.stringify(stats));
        saveToLocalStorage();
        renderCompleted();
    } else if (wasDisabled && !todo[index].disabled){
        // just unchecked (marked incomplete): remove previously awarded XP if any
        if (todo[index].xpAwarded){
            stats.xp = Math.max(0, (stats.xp || 0) - 1);
            stats.level = Math.floor(stats.xp / 10);
            todo[index].xpAwarded = false;
            localStorage.setItem('stats', JSON.stringify(stats));
        }
    }
    saveToLocalStorage();
    displayTasks();
    renderStats();
}

function displayTasks(){
    // Rebuild the visible `ul.scroll` element from the current `todo` array state.
    if (!todoList) return;
    
    todoList.innerHTML = '';

    // Create a list item for each task. Handlers for drag/drop, delete, and double-click to edit
    todo.forEach((item, index) => {
        const li = document.createElement('li');
        if (item.disabled) li.classList.add('disabled');
        li.draggable = true; // enable native HTML5 drag & drop reordering
        li.dataset.index = index;

        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);
            li.classList.add('dragging');
        });
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
        });

        // Checkbox that toggles the state of the task (completed/incomplete)
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!item.disabled;
        checkbox.addEventListener('change', () => toggleTaskStatus(index));

    // Paragraph element that holds the task text; id is used for inline editing
    const text = document.createElement('p');
    text.textContent = item.text;
    text.id = `todo-${index}`;
    
    text.addEventListener('dblclick', () => editTask(index));

        li.appendChild(checkbox);
        li.appendChild(text);

        // Delete button: shows confirmation in Arabic if the task is incomplete
        const delBtn = document.createElement('button');
        delBtn.className = 'item-delete';
        delBtn.title = 'Delete task';
        // trash SVG (uses currentColor)
        delBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor">
                <path d="M3 6h18v2H3V6zm2 3h14l-1 11H6L5 9zm5-6h4l1 1h5v2H3V4h5l1-1z" />
            </svg>
        `;
        delBtn.addEventListener('click', () => {
            // If task is not completed, ask for confirmation in Arabic
            const task = todo[index];
            if (!task) return;
            if (!task.disabled) {
                // Use our custom confirm modal and apply Cairo font for Arabic message
                showConfirm('هذه المهمة لم تكتمل بعد. هل أنت متأكد أنك تريد حذفها؟', 'حذف', () => {
                    // proceed to delete after confirmation
                    todo.splice(index, 1);
                    saveToLocalStorage();
                    displayTasks();
                }, { fontClass: 'confirm-cairo' });
                return; // do not proceed synchronously; wait for confirmation
            }
            // proceed to delete immediately if task was already completed
            todo.splice(index, 1);
            saveToLocalStorage();
            displayTasks();
        });
        li.appendChild(delBtn);

        todoList.appendChild(li);
    });

    // dragover & drop on list
    todoList.querySelectorAll('li').forEach(li => {
        li.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            li.classList.add('drag-over');
        });
        li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
        li.addEventListener('drop', (e) => {
            e.preventDefault();
            li.classList.remove('drag-over');
            // Determine dragged index from dataTransfer and the target index to reorder the array
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIndex = parseInt(li.dataset.index, 10);
            if (isNaN(fromIndex) || isNaN(toIndex) || fromIndex === toIndex) return;
            const [moved] = todo.splice(fromIndex, 1);
            todo.splice(toIndex, 0, moved);
            saveToLocalStorage();
            displayTasks();
        });
    });

    if (todoCount) todoCount.textContent = todo.length;
}
function saveToLocalStorage(){
    // Persist both todo and completed lists so UI restores state on reload
    localStorage.setItem("todo", JSON.stringify(todo));
    localStorage.setItem('completed', JSON.stringify(completed));
    localStorage.setItem('stats', JSON.stringify(stats));
}

// Render completed tasks area
function renderCompleted(){
    // Render completed tasks into the static completed list (if present) AND the modal list
    const targets = [document.getElementById('completedList'), document.getElementById(completedModalListId)];
    targets.forEach(list => {
        if (!list) return;
        list.innerHTML = '';
        completed.forEach((item, idx) => {
            const li = document.createElement('li');
            const p = document.createElement('p');
            p.textContent = item.text;
            p.style.margin = '0';
            const meta = document.createElement('span');
            meta.className = 'meta';
            meta.textContent = item.completedAt ? ` • ${formatDate(item.completedAt)}` : '';
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'restore-btn';
            restoreBtn.textContent = 'Restore';
            restoreBtn.addEventListener('click', () => restoreCompleted(idx));
            const delBtn = document.createElement('button');
            delBtn.className = 'item-delete';
            delBtn.title = 'Delete completed task';
            // Use trash SVG icon instead of text for the delete action
            delBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor">
                    <path d="M3 6h18v2H3V6zm2 3h14l-1 11H6L5 9zm5-6h4l1 1h5v2H3V4h5l1-1z" />
                </svg>
            `;
            // Delete completed task immediately without confirmation (user requested)
            delBtn.addEventListener('click', () => {
                completed.splice(idx, 1);
                saveToLocalStorage();
                renderCompleted();
            });

            li.appendChild(p);
            li.appendChild(meta);
            li.appendChild(restoreBtn);
            li.appendChild(delBtn);
            list.appendChild(li);
        });
    });
}

function openCompletedModal(){
    const modal = document.getElementById('completedModal');
    if (!modal) return;
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    renderCompleted();
    // close when clicking outside panel
    modal.addEventListener('click', function onClick(e){
        if (e.target === modal) closeCompletedModal();
    }, { once: true });
    // close on Escape
    document.addEventListener('keydown', onEscHideCompleted);
}

function closeCompletedModal(){
    const modal = document.getElementById('completedModal');
    if (!modal) return;
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onEscHideCompleted);
}

function onEscHideCompleted(e){
    if (e.key === 'Escape') closeCompletedModal();
}

// Restore a completed task back into `todo` at the top of the list
function restoreCompleted(idx){
    const item = completed[idx];
    if (!item) return;
    // If task had awarded XP, we should remove that XP because it's no longer completed
    if (item.xpAwarded){
        stats.xp = Math.max(0, (stats.xp || 0) - 1);
        stats.level = Math.floor(stats.xp / 10);
    }
    // restore into todo as incomplete
    const restored = { text: item.text, disabled: false, xpAwarded: false };
    todo.unshift(restored);
    // remove from completed
    completed.splice(idx, 1);
    saveToLocalStorage();
    displayTasks();
    renderCompleted();
    renderStats();
}

function clearCompletedTasks(){
    // Use custom confirm modal to avoid immediate deletion (display message in Cairo font)
    showConfirm('هل تريد مسح كل المهام المكتملة نهائياً؟', 'إفراغ', () => {
        completed = [];
        saveToLocalStorage();
        renderCompleted();
    }, { fontClass: 'confirm-cairo' });
}

function formatDate(iso){
    try{
        const d = new Date(iso);
        return d.toLocaleString();
    } catch(e){
        return iso;
    }
}

function renderStats(){
    // Update XP / Level counters and the crown badge visual
    const xpEl = document.getElementById('xp');
    const lvlEl = document.getElementById('level');
    const badgeEl = document.getElementById('badge');
    const xp = stats.xp || 0;
    const level = (typeof stats.level === 'number') ? stats.level : Math.floor(xp / 10);
    if (xpEl) xpEl.textContent = `XP: ${xp}`;
    if (lvlEl) lvlEl.textContent = `Level: ${level}`;
    if (badgeEl){
        // show multiple crowns for each level (cap display)
        if (level <= 0){
            badgeEl.classList.remove('visible');
            badgeEl.innerHTML = '';
        } else {
            badgeEl.classList.add('visible');
            const cap = 5;
            if (level <= cap) {
                badgeEl.innerHTML = '👑'.repeat(level);
            } else {
                badgeEl.innerHTML = `👑 x${level}`;
            }
        }
        badgeEl.title = `Level ${level}`;
    }

    // Update player profile fields if present
    const pLevel = document.getElementById('profile-level');
    const pXp = document.getElementById('profile-xp');
    const pNext = document.getElementById('profile-next');
    if (pLevel) pLevel.textContent = String(level);
    if (pXp) pXp.textContent = `${xp} XP`;
    if (pNext) {
        // next threshold is (level + 1) * 10 XP
        const nextThreshold = (level + 1) * 10;
        const left = Math.max(0, nextThreshold - xp);
        pNext.textContent = `${left} XP LEFT`;
    }
}

// Focus mode
if (focusButton) focusButton.addEventListener('click', openFocusMode);

function openFocusMode(){
    // Open a modal overlay that lets the user start a Pomodoro timer for a selected task.
    if (!todo || todo.length === 0) return alert('No tasks to focus on');

    // choose first not-disabled task or fallback to first
    // Prefer the first uncompleted task, otherwise fallback to the first task in the list
    const index = todo.findIndex(t => !t.disabled);
    const taskIndex = index === -1 ? 0 : index;

    // create overlay if not exists
    if (!focusOverlay){
        focusOverlay = document.createElement('div');
        focusOverlay.className = 'focus-overlay';
        focusOverlay.innerHTML = `
            <div class="focus-panel">
                <div class="focus-task" id="focus-task"></div>
                <div class="pom-duration">
                    <label for="pom-duration">Minutes</label>
                    <input id="pom-duration" type="number" min="1" max="180" value="25" />
                </div>
                <div class="pomodoro-timer" id="pomodoro-timer">25:00</div>
                <div class="focus-controls">
                    <button id="pom-start">Start</button>
                    <button id="pom-pause">Pause</button>
                    <button id="pom-stop">Stop</button>
                    <button id="pom-exit">Exit</button>
                </div>
            </div>
        `;
        document.body.appendChild(focusOverlay);

        // Wire the controls inside the overlay (start, pause, stop, exit). These call functions below.
        const startBtn = document.getElementById('pom-start');
        const pauseBtn = document.getElementById('pom-pause');
        if (startBtn) startBtn.addEventListener('click', () => { startFocusTimer(taskIndex); startBtn.disabled = true; if (pauseBtn) pauseBtn.textContent = 'Pause'; });
        if (pauseBtn) pauseBtn.addEventListener('click', () => togglePausePlay(taskIndex));
        document.getElementById('pom-stop').addEventListener('click', stopFocusTimer);
        document.getElementById('pom-exit').addEventListener('click', closeFocusMode);
    }

    // set task text
    const taskEl = document.getElementById('focus-task');
    taskEl.textContent = todo[taskIndex].text;

    focusRemaining = 25 * 60;
    updatePomodoroDisplay();
    focusOverlay.classList.add('visible');
    focusRunning = false;
    // ensure buttons reflect current play state
    const pb = document.getElementById('pom-pause');
    const sb = document.getElementById('pom-start');
    if (pb) pb.textContent = focusRunning ? 'Pause' : 'Play';
    if (sb) sb.disabled = false;
}

function updatePomodoroDisplay(){
    const el = document.getElementById('pomodoro-timer');
    if (!el) return;
    const m = Math.floor(focusRemaining / 60).toString().padStart(2,'0');
    const s = (focusRemaining % 60).toString().padStart(2,'0');
    el.textContent = `${m}:${s}`;
}

function startFocusTimer(index){
    if (focusRunning) return;
    // read duration from input (minutes)
    const input = document.getElementById('pom-duration');
    let minutes = 25;
    if (input) {
        const v = parseInt(input.value, 10);
        if (!isNaN(v) && v > 0) minutes = Math.min(180, v);
    }
    // Starting from input: set remaining time and begin countdown.
    focusRemaining = minutes * 60;
    // Start the countdown interval
    startInterval();
}

// Start the interval using current `focusRemaining` (used for both fresh start and resume)
function startInterval(){
    // If there is no remaining time, nothing to start
    if (!focusRemaining || focusRemaining <= 0) return;
    updatePomodoroDisplay();
    focusRunning = true;
    // ensure start button is disabled while running
    const sb = document.getElementById('pom-start'); if (sb) sb.disabled = true;
    focusTimerId = setInterval(() => {
        if (focusRemaining <= 0){
            clearInterval(focusTimerId);
            focusRunning = false;
            // set pause button to Play for consistency
            const pb = document.getElementById('pom-pause'); if (pb) pb.textContent = 'Play';
            const sb2 = document.getElementById('pom-start'); if (sb2) sb2.disabled = false;
            alert('Pomodoro complete!');
            return;
        }
        focusRemaining -= 1;
        updatePomodoroDisplay();
    }, 1000);
}

function pauseFocusTimer(){
    // Pause the running timer (keeps remaining seconds intact)
    if (!focusRunning) return;
    clearInterval(focusTimerId);
    focusRunning = false;
    // update UI: show Play and re-enable Start button
    const pb = document.getElementById('pom-pause'); if (pb) pb.textContent = 'Play';
    const sb = document.getElementById('pom-start'); if (sb) sb.disabled = false;
}

function stopFocusTimer(){
    clearInterval(focusTimerId);
    focusRunning = false;
    focusRemaining = 25 * 60;
    updatePomodoroDisplay();
    // Reset controls to initial state
    const pb = document.getElementById('pom-pause'); if (pb) pb.textContent = 'Play';
    const sb = document.getElementById('pom-start'); if (sb) sb.disabled = false;
}

// Toggle between pause and play for the focus timer
function togglePausePlay(index){
    if (focusRunning){
        // Pause while preserving the remaining seconds
        pauseFocusTimer();
    } else {
        // Resume from the current remaining seconds, if any; otherwise start fresh from input
        if (focusRemaining && focusRemaining > 0){
            // resume by starting the interval without touching `focusRemaining`
            startInterval();
            const pb = document.getElementById('pom-pause'); if (pb) pb.textContent = 'Pause';
        } else {
            // no remaining time -> treat as fresh start using input value
            startFocusTimer(index);
            const pb = document.getElementById('pom-pause'); if (pb) pb.textContent = 'Pause';
        }
    }
}

function closeFocusMode(){
    if (focusOverlay) focusOverlay.classList.remove('visible');
    stopFocusTimer();
}

// Custom confirmation modal helper
function showConfirm(message, yesText = 'Yes', onYes, options = {}){
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        // Fallback to built-in confirm if custom modal isn't present
        if (window.confirm(message)) onYes && onYes();
        return;
    }
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    const messageEl = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmYes');
    messageEl.textContent = message;
    yesBtn.textContent = yesText;
    // Setup handlers
    const panel = document.querySelector('.confirm-panel');
    if (options && options.fontClass && panel){
        panel.classList.add(options.fontClass);
    }

    function onConfirm(){
        onYes && onYes();
        cleanup();
    }
    function cleanup(){
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
        yesBtn.removeEventListener('click', onConfirm);
        const cancelBtn = document.getElementById('confirmCancel');
        if (cancelBtn) cancelBtn.removeEventListener('click', cleanup);
        if (options && options.fontClass && panel){
            panel.classList.remove(options.fontClass);
        }
    }
    yesBtn.addEventListener('click', onConfirm);
    const cancelBtn = document.getElementById('confirmCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', cleanup);
    // Close with Escape
    function onKey(e){
        if (e.key === 'Escape') cleanup();
    }
    document.addEventListener('keydown', onKey, { once: true });
}