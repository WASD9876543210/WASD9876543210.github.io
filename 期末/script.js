// --- 初始化 40 人白名單 ---
const WHITELIST = Array.from({length: 40}, (_, i) => `S${String(i + 1).padStart(3, '0')}`);
const ADM_ACC = { u: "admin", p: "1234" };
const CATS = ["文學", "數學", "英文", "社會", "自然", "藝術", "小說", "漫畫"];

// 安全過濾防止駭客腳本
function escapeHTML(str) {
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// 自動生成 80 本預設書籍
let initialBooks = [];
CATS.forEach(c => {
    for(let i=1; i<=10; i++) {
        initialBooks.push({ title: `${c}系列-第${i}冊`, cat: c, isBorrowed: false });
    }
});

// 資料讀取
let books = JSON.parse(localStorage.getItem('lib_final_books')) || initialBooks;
let loans = JSON.parse(localStorage.getItem('lib_final_loans')) || [];
let students = JSON.parse(localStorage.getItem('lib_final_students')) || {}; 

let loginAttempts = 0;
let isLocked = false;
let activeStudent = null;

// --- 學生登入邏輯 ---
const idInput = document.getElementById('stu-id-field');
const pwContainer = document.getElementById('pw-field-container');

idInput?.addEventListener('input', () => {
    const sid = escapeHTML(idInput.value.trim().toUpperCase());
    if(WHITELIST.includes(sid)) {
        pwContainer.innerHTML = students[sid] 
            ? `<input type="password" id="stu-pw-field" placeholder="請輸入密碼">`
            : `<p style="color:var(--success); font-size:0.8rem;">首次登入，請設定密碼：</p>
               <input type="password" id="stu-pw-field" placeholder="設定 4 位數以上密碼">`;
    } else { pwContainer.innerHTML = ""; }
});

function handleStudentAuth() {
    const sid = escapeHTML(idInput.value.trim().toUpperCase());
    const pw = document.getElementById('stu-pw-field')?.value;
    if(!WHITELIST.includes(sid)) return alert("安全性警告：學號無權限。");
    if(!pw || pw.length < 4) return alert("密碼長度不足。");

    if(!students[sid]) {
        students[sid] = pw;
        save();
        alert("密碼設定成功！");
    } else if(students[sid] !== pw) {
        return alert("認證失敗：密碼錯誤。");
    }
    activeStudent = sid;
    showSection('library-hall');
}

// --- 介面控制 ---
function showSection(id) {
    if(id === 'admin-backstage' && !sessionStorage.getItem('isAdm')) return showSection('admin-login');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'library-hall') renderShelf();
    if(id === 'admin-backstage') renderAdmin();
}

function renderShelf(filterCat = '全部') {
    const shelf = document.getElementById('book-shelf');
    const filterArea = document.getElementById('cat-btns');
    shelf.innerHTML = "";
    filterArea.innerHTML = ['全部', ...CATS].map(c => `<button class="filter-btn ${filterCat===c?'active':''}" onclick="renderShelf('${c}')">${c}</button>`).join('');

    books.filter(b => !b.isBorrowed).forEach(book => {
        if(filterCat === '全部' || book.cat === filterCat) {
            shelf.innerHTML += `<div class="book-card">
                <span class="badge">${book.cat}</span>
                <h4>${escapeHTML(book.title)}</h4>
                <button class="btn btn-primary" onclick="doBorrow('${escapeHTML(book.title)}')">確認借閱</button>
            </div>`;
        }
    });
    document.getElementById('hello-user').innerText = `你好，${activeStudent}`;
}

function doBorrow(title) {
    const bIdx = books.findIndex(b => b.title === title);
    books[bIdx].isBorrowed = true;
    loans.push({ sid: activeStudent, book: title, date: new Date().toLocaleDateString() });
    save();
    renderShelf();
}

// --- 管理員權限與安全 ---
function adminAuth() {
    if(isLocked) return;
    const u = document.getElementById('adm-user').value;
    const p = document.getElementById('adm-pass').value;
    if(u === ADM_ACC.u && p === ADM_ACC.p) {
        sessionStorage.setItem('isAdm', 'true');
        showSection('admin-backstage');
    } else {
        loginAttempts++;
        if(loginAttempts >= 3) {
            isLocked = true;
            document.getElementById('login-error-msg').style.display = "block";
            document.getElementById('adm-login-btn').disabled = true;
            setTimeout(() => { 
                isLocked = false; 
                loginAttempts = 0; 
                document.getElementById('login-error-msg').style.display = "none";
                document.getElementById('adm-login-btn').disabled = false;
            }, 30000);
        }
        alert(`驗證失敗！剩餘次數：${3 - loginAttempts}`);
    }
}

function renderAdmin() {
    document.getElementById('admin-loan-table').innerHTML = loans.map((l, i) => `
        <tr><td>${l.sid}</td><td>${escapeHTML(l.book)}</td><td>${l.date}</td>
        <td><button onclick="doReturn('${escapeHTML(l.book)}', ${i})" style="color:var(--success); font-weight:bold; border:none; background:none; cursor:pointer;">確認歸還</button></td></tr>`).join('');

    document.getElementById('student-admin-list').innerHTML = WHITELIST.map(sid => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;">
            <span><strong>${sid}</strong> <small style="color:${students[sid]?'#27ae60':'#ccc'}">${students[sid]?'已啟動':'未啟用'}</small></span>
            ${students[sid] ? `<button class="btn-warning btn" onclick="resetPassword('${sid}')">重設</button>` : ''}
        </div>`).join('');
}

function resetPassword(sid) {
    if(confirm(`警告：確定要清除學號 ${sid} 的密碼授權嗎？`)) { delete students[sid]; save(); renderAdmin(); }
}

function doReturn(title, idx) {
    const bIdx = books.findIndex(b => b.title === title);
    if(bIdx !== -1) books[bIdx].isBorrowed = false;
    loans.splice(idx, 1);
    save();
    renderAdmin();
}

function manualAddBook() {
    const t = escapeHTML(document.getElementById('add-title').value);
    const c = document.getElementById('add-cat').value;
    if(!t) return;
    books.push({ title: t, cat: c, isBorrowed: false });
    save();
    renderAdmin();
    document.getElementById('add-title').value = "";
}

function save() {
    localStorage.setItem('lib_final_books', JSON.stringify(books));
    localStorage.setItem('lib_final_loans', JSON.stringify(loans));
    localStorage.setItem('lib_final_students', JSON.stringify(students));
}