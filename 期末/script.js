const WHITELIST = Array.from({length: 40}, (_, i) => `S${String(i + 1).padStart(3, '0')}`);
const ADM_ACC = { u: "admin", p: "1234" };
const CATS = ["文學", "數學", "英文", "社會", "自然", "藝術", "小說", "漫畫"];

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// 初始化書籍資料
let initialBooks = [];
CATS.forEach(c => {
    for(let i=1; i<=10; i++) initialBooks.push({ title: `${c}系列-第${i}冊`, cat: c, isBorrowed: false });
});

let books = JSON.parse(localStorage.getItem('lib_final_books')) || initialBooks;
let loans = JSON.parse(localStorage.getItem('lib_final_loans')) || [];
let students = JSON.parse(localStorage.getItem('lib_final_students')) || {}; 
let activeStudent = null;

// 當頁面載入完成後執行
document.addEventListener('DOMContentLoaded', () => {
    const idInput = document.getElementById('stu-id-field');
    const pwContainer = document.getElementById('pw-field-container');

    // 監聽學號輸入：顯示初次登入提示或密碼框
    idInput?.addEventListener('input', () => {
        const sid = idInput.value.trim().toUpperCase();
        if(WHITELIST.includes(sid)) {
            if (!students[sid]) {
                pwContainer.innerHTML = `
                    <div class="first-login-tip">💡 偵測到您是初次登入，請設定一組密碼。</div>
                    <input type="password" id="stu-pw-field" placeholder="請設定您的新密碼">`;
            } else {
                pwContainer.innerHTML = `<input type="password" id="stu-pw-field" placeholder="請輸入密碼">`;
            }
        } else {
            pwContainer.innerHTML = "";
        }
    });

    const addCatSelect = document.getElementById('add-cat');
    if(addCatSelect) addCatSelect.innerHTML = CATS.map(c => `<option value="${c}">${c}</option>`).join('');
});

// 學生登入
function handleStudentAuth() {
    const sid = document.getElementById('stu-id-field').value.trim().toUpperCase();
    const pwField = document.getElementById('stu-pw-field');
    const pw = pwField ? pwField.value : "";

    if(!WHITELIST.includes(sid)) return alert("此學號不在系統白名單內。");
    if(!students[sid]) {
        students[sid] = pw;
        save();
        alert("設定成功！這是您第一次登入。");
    } else if(students[sid] !== pw) {
        return alert("密碼錯誤，請再試一次。");
    }
    activeStudent = sid;
    showSection('library-hall');
}

function showSection(id) {
    // 管理後台權限檢查
    if (id === 'admin-backstage' && sessionStorage.getItem('isAdm') !== 'true') {
        alert("請先完成管理員驗證。");
        return showSection('admin-login');
    }

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    if(id === 'library-hall') renderShelf();
    if(id === 'admin-backstage') renderAdmin();
}

// 渲染書庫與個人清單
function renderShelf(filterCat = '全部') {
    const shelf = document.getElementById('book-shelf');
    const filterArea = document.getElementById('cat-btns');
    const myLoansList = document.getElementById('my-loans-list');
    
    shelf.innerHTML = "";
    filterArea.innerHTML = ['全部', ...CATS].map(c => 
        `<button class="filter-btn ${filterCat===c?'active':''}" onclick="renderShelf('${c}')">${c}</button>`
    ).join('');

    books.filter(b => !b.isBorrowed).forEach(book => {
        if(filterCat === '全部' || book.cat === filterCat) {
            shelf.innerHTML += `<div class="book-card">
                <span style="font-size:0.7rem; color:var(--primary); font-weight:bold;">${book.cat}</span>
                <h4>${escapeHTML(book.title)}</h4>
                <button class="btn btn-primary" onclick="doBorrow('${escapeHTML(book.title)}')">確認借閱</button>
            </div>`;
        }
    });

    const myCurrent = loans.filter(l => l.sid === activeStudent);
    myLoansList.innerHTML = myCurrent.length 
        ? myCurrent.map(l => `<div class="loan-item"><strong>${escapeHTML(l.book)}</strong><br><small>📅 ${l.date}</small></div>`).join('') 
        : '<p class="note">您目前沒有借閱中的書籍。</p>';

    document.getElementById('hello-user').innerText = `你好，${activeStudent}`;
}

function doBorrow(title) {
    const bIdx = books.findIndex(b => b.title === title);
    if(bIdx !== -1) {
        books[bIdx].isBorrowed = true;
        loans.push({ sid: activeStudent, book: title, date: new Date().toLocaleDateString() });
        save();
        renderShelf();
    }
}

// 管理員功能
function adminAuth() {
    const u = document.getElementById('adm-user').value;
    const p = document.getElementById('adm-pass').value;
    if(u === ADM_ACC.u && p === ADM_ACC.p) {
        sessionStorage.setItem('isAdm', 'true');
        showSection('admin-backstage');
    } else {
        alert("管理員密碼錯誤！");
    }
}

function adminLogout() {
    if(confirm("確定要退出管理模式嗎？")) {
        sessionStorage.removeItem('isAdm');
        showSection('student-entry');
    }
}

function renderAdmin() {
    document.getElementById('admin-loan-table').innerHTML = loans.map((l, i) => `
        <tr><td>${l.sid}</td><td>${escapeHTML(l.book)}</td><td>${l.date}</td>
        <td><button class="btn btn-danger" style="padding:5px 10px;" onclick="doReturn(${i})">歸還</button></td></tr>`).join('');

    document.getElementById('student-admin-list').innerHTML = WHITELIST.map(sid => `
        <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee;">
            <span>${sid} ${students[sid]?'✅':'❌'}</span>
            ${students[sid] ? `<button onclick="resetPw('${sid}')">重設</button>` : ''}
        </div>`).join('');
}

function doReturn(idx) {
    const title = loans[idx].book;
    const bIdx = books.findIndex(b => b.title === title);
    if(bIdx !== -1) books[bIdx].isBorrowed = false;
    loans.splice(idx, 1);
    save(); renderAdmin();
}

function resetPw(sid) {
    if(confirm(`確定重設 ${sid} 的密碼？`)) { delete students[sid]; save(); renderAdmin(); }
}

function manualAddBook() {
    const t = document.getElementById('add-title').value;
    const c = document.getElementById('add-cat').value;
    if(!t) return;
    books.push({ title: t, cat: c, isBorrowed: false });
    save(); renderAdmin();
    document.getElementById('add-title').value = "";
}

function save() {
    localStorage.setItem('lib_final_books', JSON.stringify(books));
    localStorage.setItem('lib_final_loans', JSON.stringify(loans));
    localStorage.setItem('lib_final_students', JSON.stringify(students));
}