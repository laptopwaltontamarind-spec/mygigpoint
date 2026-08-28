const tg = window.Telegram?.WebApp;
if(tg) tg.expand();

let currentUser = null;

// অ্যাপ শুরুতেই সেটিং লোড করা
async function loadSiteSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if(document.getElementById('job-q')) document.getElementById('job-q').innerText = "প্রশ্ন: " + data.dailyJobQuestion;
        if(document.getElementById('verify-bkash-num')) document.getElementById('verify-bkash-num').innerText = data.verificationBkashNumber;
        if(document.getElementById('support-link')) document.getElementById('support-link').href = "https://t.me/" + data.supportTelegram.replace('@', '');
    } catch (err) {
        console.error("Error loading settings:", err);
    }
}
loadSiteSettings();

function showRegister() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

function showLogin() {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
}

// অ্যাকাউন্ট রেজিস্ট্রেশন
async function register() {
    const name = document.getElementById('reg-name').value;
    const mobile = document.getElementById('reg-mobile').value;
    const referralId = document.getElementById('reg-ref').value;
    const password = document.getElementById('reg-password').value;

    if (!name || !mobile || !password) return alert("সবগুলো ঘর পূরণ করুন!");

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile, referralId, password })
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) showLogin();
}

// অ্যাকাউন্ট লগইন
async function login() {
    const mobile = document.getElementById('login-mobile').value;
    const password = document.getElementById('login-password').value;

    if (!mobile || !password) return alert("মোবাইল নম্বর ও পাসওয়ার্ড প্রদান করুন!");

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, password })
    });
    const data = await res.json();
    if (data.success) {
        currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        renderDashboard();
    } else {
        alert(data.message);
    }
}

// ড্যাশবোর্ড আপডেট ও রেন্ডারিং
async function renderDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    document.getElementById('app-nav').style.display = 'flex';

    document.getElementById('u-name').innerText = currentUser.name;
    document.getElementById('u-balance').innerText = currentUser.balance;
    document.getElementById('u-refcode').innerText = currentUser.ownReferralCode;

    const statusElem = document.getElementById('u-status');
    const warningBox = document.getElementById('unverified-warning');
    const timerBox = document.getElementById('expire-timer-box');
    
    // ভেরিফিকেশন ফর্ম এবং অ্যাক্টিভ স্ট্যাটাস বক্সের HTML Elements (যদি HTML এ থাকে)
    const verifyFormSection = document.getElementById('verify-form-section') || document.querySelector('#tab-verify form') || document.getElementById('tab-verify');

    // তারিখ হিসাবের লজিক
    const today = new Date();
    const expireDate = currentUser.verifiedExpireDate ? new Date(currentUser.verifiedExpireDate) : null;
    const isStillValid = currentUser.isVerified && expireDate && expireDate > today;

    if (isStillValid) {
        // ১. একাউন্ট ভেরিফাইড হলে
        const formattedDate = expireDate.toLocaleDateString('en-GB'); // DD/MM/YYYY ফরম্যাট
        const diffDays = Math.ceil((expireDate - today) / (1000 * 60 * 60 * 24));

        statusElem.innerText = "ভেরিফাইড ✅";
        statusElem.style.color = "green";
        warningBox.style.display = "none";
        
        if (timerBox) {
            timerBox.style.display = "block";
            document.getElementById('u-expire').innerText = `${diffDays} দিন বাকি (মেয়াদ: ${formattedDate})`;
        }

        // ভেরিফাই ট্যাবের ভেতর ফর্ম লুকিয়ে মেয়াদ শেষ হওয়ার মেসেজ শো করা
        const verifyTab = document.getElementById('tab-verify');
        if (verifyTab) {
            verifyTab.innerHTML = `
                <div style="background: #e8f5e9; border: 1px solid #4caf50; padding: 20px; border-radius: 10px; color: #2e7d32; text-align: center; margin-top: 20px;">
                    <h3>✅ আপনার অ্যাকাউন্ট ভেরিফাইড!</h3>
                    <p style="margin-top: 10px; font-size: 16px;">আপনার অ্যাকাউন্টের ভেরিফিকেশন মেয়াদ সক্রিয় আছে।</p>
                    <p style="margin-top: 5px; font-weight: bold; font-size: 18px; color: #1b5e20;">
                        মেয়াদ শেষ হওয়ার তারিখ: ${formattedDate}
                    </p>
                    <p style="margin-top: 5px; font-size: 14px; color: #555;">(বাকি আছে: ${diffDays} দিন)</p>
                </div>
            `;
        }
    } else {
        // ২. আনভেরিফাইড বা মেয়াদ শেষ হয়ে গেলে
        statusElem.innerText = "আনভেরিফাইড ❌";
        statusElem.style.color = "red";
        warningBox.style.display = "block";
        if (timerBox) timerBox.style.display = "none";
        
        switchTab('verify'); // সরাসরি ভেরিফাই ট্যাবে নিয়ে যাবে
    }

    // টিম ও হিস্ট্রি ডাটা লোড
    fetchExtraDetails();
}

// অতিরিক্ত হিস্ট্রি ডাটা (উইথড্র ও টিম লিস্ট)
async function fetchExtraDetails() {
    try {
        const res = await fetch('/api/admin/data');
        const data = await res.json();

        // ১. টিম/রেফারাল ফিল্টার
        const myTeam = data.users.filter(u => u.referralId === currentUser.ownReferralCode);
        document.getElementById('team-count').innerText = myTeam.length;
        document.getElementById('team-list').innerHTML = myTeam.length ? myTeam.map(t => `
            <tr>
                <td>${t.name}</td>
                <td>${t.mobile}</td>
                <td>${t.isVerified ? '✅ Verified' : '❌ Unverified'}</td>
            </tr>
        `).join('') : '<tr><td colspan="3">কেউ আপনার রেফারে জয়েন করেনি</td></tr>';

        // ২. উইথড্র হিস্ট্রি ফিল্টার
        const myWithdraws = data.withdraws.filter(w => w.userId && (w.userId._id === currentUser._id || w.userId === currentUser._id));
        document.getElementById('withdraw-history').innerHTML = myWithdraws.length ? myWithdraws.map(w => `
            <tr>
                <td>${new Date(w.createdAt).toLocaleDateString()}</td>
                <td>৳${w.amount}</td>
                <td><span class="badge bg-${w.status.toLowerCase()}">${w.status}</span></td>
            </tr>
        `).join('') : '<tr><td colspan="3">কোনো উইথড্র রেকর্ড নেই</td></tr>';

        // ৩. মোট আর্নিং ক্যালকুলেশন
        let totalEarned = currentUser.balance;
        myWithdraws.forEach(w => { if(w.status === 'Approved') totalEarned += w.amount; });
        document.getElementById('u-total-earned').innerText = totalEarned;

    } catch (e) { console.error("History Error:", e); }
}

// ট্যাব সুইচিং ফাংশন
function switchTab(tabName) {
    const today = new Date();
    const expireDate = currentUser?.verifiedExpireDate ? new Date(currentUser.verifiedExpireDate) : null;
    const isStillValid = currentUser?.isVerified && expireDate && expireDate > today;

    if (!isStillValid && tabName !== 'verify' && tabName !== 'home') {
        alert("কাজ, উইথড্র ও টিম অপশন পেতে আগে ৳৫০০ দিয়ে একাউন্ট ভেরিফাই করুন!");
        return;
    }

    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).style.display = 'block';
    
    // Active class highlight
    const btns = document.querySelectorAll('.nav-item');
    if(tabName==='home') btns[0].classList.add('active');
    if(tabName==='verify') btns[1].classList.add('active');
    if(tabName==='job') btns[2].classList.add('active');
    if(tabName==='withdraw') btns[3].classList.add('active');
    if(tabName==='team') btns[4].classList.add('active');
}

// ডেইলি জব সাবমিট করা
async function submitJob() {
    const answer = document.getElementById('job-ans').value;
    if (!answer) return alert("উত্তর লিখুন!");

    const res = await fetch('/api/submit-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser._id, answer })
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
        currentUser.balance = data.newBalance;
        document.getElementById('u-balance').innerText = currentUser.balance;
        document.getElementById('job-ans').value = '';
        fetchExtraDetails();
    }
}

// অ্যাকাউন্ট ভেরিফিকেশন রিকোয়েস্ট
async function submitVerification() {
    const bkashSender = document.getElementById('v-bkash').value;
    const trxId = document.getElementById('v-trx').value;

    if (!bkashSender || !trxId) return alert("বিকাশ নম্বর এবং TrxID প্রদান করুন!");

    const res = await fetch('/api/verify-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser._id, bkashSender, trxId })
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
        document.getElementById('v-bkash').value = '';
        document.getElementById('v-trx').value = '';
    }
}

// উইথড্রয়াল রিকোয়েস্ট
async function submitWithdraw() {
    const paymentNumber = document.getElementById('w-number').value;
    const amount = Number(document.getElementById('w-amount').value);

    if (!paymentNumber || !amount) return alert("পেমেন্ট নম্বর এবং পরিমাণ লিখুন!");

    const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser._id, paymentNumber, amount })
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
        currentUser.balance = data.newBalance;
        document.getElementById('u-balance').innerText = currentUser.balance;
        document.getElementById('w-number').value = '';
        document.getElementById('w-amount').value = '';
        fetchExtraDetails();
    }
}

// লগআউট
function logout() {
    currentUser = null;
    localStorage.removeItem('user');
    location.reload();
}

// Auto Login Check
window.onload = () => {
    const saved = localStorage.getItem('user');
    if (saved) {
        currentUser = JSON.parse(saved);
        renderDashboard();
    }
}
