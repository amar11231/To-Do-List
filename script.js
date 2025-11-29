// Retrieve todo from local stronage or initialize an empty a rray

let todo = JSON.parse(localStorage.getItem("todo")) || [];
// XP & Level tracking
let stats = JSON.parse(localStorage.getItem('stats')) || { xp: 0, level: 0 };
// Theme settings
let theme = JSON.parse(localStorage.getItem('theme')) || { name: 'gradient', color: '#2d70fd' };

function applyTheme(t){
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
const todoInput = document.getElementById("todoInput");
const todoList = document.querySelector('.scroll'); 
const todoCount = document.querySelector('.counter-container span');
const addButton = document.querySelector(".btn");
const deleteButton = document.getElementById("deleteButton");
const focusButton = document.getElementById("focusButton");

// Focus panel elements (created when needed)
let focusOverlay = null;
let focusTimerId = null;
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
            displayTasks();
            // apply theme & wire controls
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
    if (!confirm('Delete all tasks?')) return;
    todo = [];
    saveToLocalStorage();
    displayTasks();
}

function editTask(index) {
    
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
    if (!todo[index]) return;
    // toggle and award XP when marking as completed
    const wasDisabled = !!todo[index].disabled;
    // flip completed state
    todo[index].disabled = !wasDisabled;

    if (!wasDisabled && todo[index].disabled){
        // just completed: award XP if not already awarded for this task
        if (!todo[index].xpAwarded){
            stats.xp = (stats.xp || 0) + 1;
            stats.level = Math.floor(stats.xp / 10);
            todo[index].xpAwarded = true;
            localStorage.setItem('stats', JSON.stringify(stats));
        }
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
    if (!todoList) return;
    
    todoList.innerHTML = '';

    todo.forEach((item, index) => {
        const li = document.createElement('li');
        if (item.disabled) li.classList.add('disabled');
        li.draggable = true;
        li.dataset.index = index;

        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);
            li.classList.add('dragging');
        });
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!item.disabled;
        checkbox.addEventListener('change', () => toggleTaskStatus(index));

    const text = document.createElement('p');
    text.textContent = item.text;
    text.id = `todo-${index}`;
    
    text.addEventListener('dblclick', () => editTask(index));

        li.appendChild(checkbox);
        li.appendChild(text);

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
                const ok = confirm('هذه المهمة لم تكتمل بعد. هل أنت متأكد أنك تريد حذفها؟');
                if (!ok) return; // user chose No/Cancel -> keep the task
            }
            // proceed to delete
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
    localStorage.setItem("todo", JSON.stringify(todo));
}

function renderStats(){
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
    if (!todo || todo.length === 0) return alert('No tasks to focus on');

    // choose first not-disabled task or fallback to first
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

        document.getElementById('pom-start').addEventListener('click', () => startFocusTimer(taskIndex));
        document.getElementById('pom-pause').addEventListener('click', pauseFocusTimer);
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
    focusRemaining = minutes * 60;
    updatePomodoroDisplay();
    focusRunning = true;
    focusTimerId = setInterval(() => {
        if (focusRemaining <= 0){
            clearInterval(focusTimerId);
            focusRunning = false;
            alert('Pomodoro complete!');
            return;
        }
        focusRemaining -= 1;
        updatePomodoroDisplay();
    }, 1000);
}

function pauseFocusTimer(){
    if (!focusRunning) return;
    clearInterval(focusTimerId);
    focusRunning = false;
}

function stopFocusTimer(){
    clearInterval(focusTimerId);
    focusRunning = false;
    focusRemaining = 25 * 60;
    updatePomodoroDisplay();
}

function closeFocusMode(){
    if (focusOverlay) focusOverlay.classList.remove('visible');
    stopFocusTimer();
}